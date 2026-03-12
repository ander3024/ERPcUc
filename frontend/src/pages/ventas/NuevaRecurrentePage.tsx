import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Search, Save, RefreshCw, Package } from "lucide-react"

const API = import.meta.env.VITE_API_URL || "/api"

interface LineaRec {
  articuloId: string
  referencia: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  descuento: number
  iva: number
  baseLinea: number
  ivaLinea: number
  totalLinea: number
}

interface Cliente {
  id: string
  nombre: string
  nif: string
  email: string
  telefono: string
  direccion: string
  formaPagoId?: string
  tarifaId?: string
}

interface Articulo {
  id: string
  referencia: string
  descripcion: string
  precioVenta: number
  iva: number
}

interface FormaPago {
  id: string
  nombre: string
}

const PERIODICIDADES = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "QUINCENAL", label: "Quincenal" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "BIMESTRAL", label: "Bimestral" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "SEMESTRAL", label: "Semestral" },
  { value: "ANUAL", label: "Anual" },
]

const RETENCIONES = [
  { value: 0, label: "Sin retención" },
  { value: 7, label: "7%" },
  { value: 15, label: "15%" },
  { value: 19, label: "19%" },
]

function formatEur(n: number) {
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ".").replace(/\.(\d+)$/, ",$1") + " EUR"
}

export default function NuevaRecurrentePage() {
  const navigate = useNavigate()
  const token = localStorage.getItem("accessToken")

  // Cliente
  const [clienteQuery, setClienteQuery] = useState("")
  const [clienteSugerencias, setClienteSugerencias] = useState<Cliente[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null)
  const [showClienteDrop, setShowClienteDrop] = useState(false)

  // Recurrencia fields
  const [nombre, setNombre] = useState("")
  const [periodicidad, setPeriodicidad] = useState("MENSUAL")
  const [diaEmision, setDiaEmision] = useState(1)
  const [fechaInicio, setFechaInicio] = useState(() => new Date().toISOString().split("T")[0])
  const [fechaFin, setFechaFin] = useState("")
  const [formaPagoId, setFormaPagoId] = useState("")
  const [formasPago, setFormasPago] = useState<FormaPago[]>([])
  const [retencion, setRetencion] = useState(0)
  const [notas, setNotas] = useState("")

  // Lines
  const [lineas, setLineas] = useState<LineaRec[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  // Tarifa
  const [tarifaLineas, setTarifaLineas] = useState<Record<string, { precio: number | null; descuento: number }>>({})

  // Article autocomplete state
  const [artQueryMap, setArtQueryMap] = useState<Record<number, string>>({})
  const [artSugMap, setArtSugMap] = useState<Record<number, Articulo[]>>({})
  const [artDropIdx, setArtDropIdx] = useState<number | null>(null)

  const clienteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const artTimerRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // Load formas de pago
  useEffect(() => {
    fetch(`${API}/clientes/formas-pago/list`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => setFormasPago(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  // Load tarifa when client changes
  useEffect(() => {
    if (!clienteSeleccionado?.tarifaId) { setTarifaLineas({}); return }
    fetch(`${API}/config/tarifas/${clienteSeleccionado.tarifaId}/lineas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then((data: any[]) => {
        const map: Record<string, { precio: number | null; descuento: number }> = {}
        for (const l of data) {
          map[l.articuloId] = { precio: l.precio, descuento: l.descuento }
        }
        setTarifaLineas(map)
      })
      .catch(() => setTarifaLineas({}))
  }, [clienteSeleccionado?.tarifaId])

  // Client search
  useEffect(() => {
    if (clienteTimerRef.current) clearTimeout(clienteTimerRef.current)
    if (clienteQuery.length < 2) { setClienteSugerencias([]); return }
    clienteTimerRef.current = setTimeout(() => {
      fetch(`${API}/clientes?search=${encodeURIComponent(clienteQuery)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => setClienteSugerencias(Array.isArray(d) ? d : (d.data || [])))
        .catch(() => {})
    }, 300)
  }, [clienteQuery])

  // Article search
  const buscarArticulo = useCallback((idx: number, q: string) => {
    if (artTimerRef.current[idx]) clearTimeout(artTimerRef.current[idx])
    setArtQueryMap(prev => ({ ...prev, [idx]: q }))
    if (q.length < 2) { setArtSugMap(prev => ({ ...prev, [idx]: [] })); return }
    artTimerRef.current[idx] = setTimeout(() => {
      fetch(`${API}/articulos?search=${encodeURIComponent(q)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(d => setArtSugMap(prev => ({ ...prev, [idx]: Array.isArray(d) ? d : (d.data || []) })))
        .catch(() => {})
    }, 300)
  }, [token])

  function calcLinea(l: Partial<LineaRec>): LineaRec {
    const cant = Number(l.cantidad) || 0
    const precio = Number(l.precioUnitario) || 0
    const dto = Number(l.descuento) || 0
    const iva = Number(l.iva) || 21
    const base = +(cant * precio * (1 - dto / 100)).toFixed(2)
    const ivaLinea = +(base * iva / 100).toFixed(2)
    const total = +(base + ivaLinea).toFixed(2)
    return {
      articuloId: l.articuloId || "",
      referencia: l.referencia || "",
      descripcion: l.descripcion || "",
      cantidad: cant,
      precioUnitario: precio,
      descuento: dto,
      iva,
      baseLinea: base,
      ivaLinea,
      totalLinea: total,
    }
  }

  function addLinea() {
    setLineas(prev => [...prev, calcLinea({ cantidad: 1, precioUnitario: 0, descuento: 0, iva: 21 })])
  }

  function updateLinea(idx: number, field: string, value: string | number) {
    setLineas(prev => prev.map((l, i) => i === idx ? calcLinea({ ...l, [field]: value }) : l))
  }

  function removeLinea(idx: number) {
    setLineas(prev => prev.filter((_, i) => i !== idx))
  }

  function seleccionarArticulo(idx: number, art: Articulo) {
    const tarifaInfo = tarifaLineas[art.id]
    const precio = tarifaInfo?.precio ?? art.precioVenta
    const dto = tarifaInfo?.descuento ?? 0
    setLineas(prev => prev.map((l, i) => i === idx ? calcLinea({
      ...l,
      articuloId: art.id,
      referencia: art.referencia,
      descripcion: art.descripcion,
      precioUnitario: precio,
      descuento: dto,
      iva: art.iva ?? 21,
    }) : l))
    setArtQueryMap(prev => ({ ...prev, [idx]: art.referencia + " - " + art.descripcion }))
    setArtSugMap(prev => ({ ...prev, [idx]: [] }))
    setArtDropIdx(null)
  }

  // Totals
  const totalBase = lineas.reduce((s, l) => s + l.baseLinea, 0)
  const totalIva = lineas.reduce((s, l) => s + l.ivaLinea, 0)
  const totalRetencion = retencion > 0 ? +(totalBase * retencion / 100).toFixed(2) : 0
  const totalGeneral = +(totalBase + totalIva - totalRetencion).toFixed(2)

  const desgloseIva: Record<number, { base: number; cuota: number }> = {}
  for (const l of lineas) {
    if (!desgloseIva[l.iva]) desgloseIva[l.iva] = { base: 0, cuota: 0 }
    desgloseIva[l.iva].base += l.baseLinea
    desgloseIva[l.iva].cuota += l.ivaLinea
  }

  async function guardar() {
    if (!nombre.trim()) { setError("Introduce un nombre para la recurrencia"); return }
    if (!clienteSeleccionado) { setError("Selecciona un cliente"); return }
    if (lineas.length === 0) { setError("Agrega al menos una línea"); return }
    setError("")
    setGuardando(true)
    try {
      const body: Record<string, unknown> = {
        clienteId: clienteSeleccionado.id,
        nombre: nombre.trim(),
        periodicidad,
        diaEmision,
        fechaInicio,
        fechaFin: fechaFin || undefined,
        formaPagoId: formaPagoId || undefined,
        retencion,
        notas: notas || undefined,
        proximaEmision: fechaInicio,
        lineas: lineas.map((l, idx) => ({
          articuloId: l.articuloId || undefined,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          descuento: l.descuento,
          iva: l.iva,
          orden: idx + 1,
        })),
      }
      const res = await fetch(`${API}/ventas/recurrentes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Error al guardar")
      }
      navigate("/ventas/recurrentes")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => navigate("/ventas/recurrentes")} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3 text-white">
            <RefreshCw size={24} />
            <h1 className="text-xl font-bold">Nueva Factura Recurrente</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Datos principales */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Datos de la recurrencia</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Nombre */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-400 mb-1">Nombre de la recurrencia *</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Mantenimiento mensual, Cuota trimestral..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Cliente autocomplete */}
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-slate-400 mb-1">Cliente *</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={clienteSeleccionado ? clienteSeleccionado.nombre : clienteQuery}
                  onChange={e => {
                    setClienteSeleccionado(null)
                    setClienteQuery(e.target.value)
                    setShowClienteDrop(true)
                  }}
                  onFocus={() => setShowClienteDrop(true)}
                  placeholder="Buscar cliente por nombre o NIF..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {clienteSeleccionado && (
                  <button
                    onClick={() => { setClienteSeleccionado(null); setClienteQuery(""); setTarifaLineas({}) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400"
                  >
                    x
                  </button>
                )}
              </div>
              {showClienteDrop && clienteSugerencias.length > 0 && !clienteSeleccionado && (
                <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {clienteSugerencias.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setClienteSeleccionado(c); setShowClienteDrop(false); if (c.formaPagoId) setFormaPagoId(c.formaPagoId) }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
                    >
                      <div className="font-medium text-white">{c.nombre}</div>
                      <div className="text-xs text-slate-500">{c.nif} - {c.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Periodicidad */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Periodicidad</label>
              <select
                value={periodicidad}
                onChange={e => setPeriodicidad(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                {PERIODICIDADES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Día de emisión */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Día de emisión</label>
              <input
                type="number"
                min={1}
                max={28}
                value={diaEmision}
                onChange={e => setDiaEmision(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Fecha inicio */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Fecha inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Fecha fin */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Fecha fin (opcional)</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Forma de pago */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Forma de pago</label>
              <select
                value={formaPagoId}
                onChange={e => setFormaPagoId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Sin especificar --</option>
                {formasPago.map(fp => (
                  <option key={fp.id} value={fp.id}>{fp.nombre}</option>
                ))}
              </select>
            </div>

            {/* Retención IRPF */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Retención IRPF</label>
              <select
                value={retencion}
                onChange={e => setRetencion(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500"
              >
                {RETENCIONES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Notas */}
            <div className="md:col-span-3">
              <label className="block text-sm font-medium text-slate-400 mb-1">Notas</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                placeholder="Notas internas sobre esta recurrencia..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Líneas */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Líneas de la factura</h2>
            <button
              onClick={addLinea}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              <Plus size={16} /> Agregar línea
            </button>
          </div>

          {lineas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package size={40} className="mx-auto mb-3 opacity-40" />
              <p>No hay líneas. Haz clic en "Agregar línea" para empezar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left pb-2 font-medium w-56">Artículo / Descripción</th>
                    <th className="text-right pb-2 font-medium w-16">Cant.</th>
                    <th className="text-right pb-2 font-medium w-24">Precio</th>
                    <th className="text-right pb-2 font-medium w-16">Dto%</th>
                    <th className="text-right pb-2 font-medium w-14">IVA%</th>
                    <th className="text-right pb-2 font-medium w-24">Base</th>
                    <th className="text-right pb-2 font-medium w-24">Total</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea, idx) => (
                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                      {/* Artículo con autocomplete */}
                      <td className="py-2 pr-2 relative">
                        <div className="relative">
                          <input
                            type="text"
                            value={artQueryMap[idx] ?? (linea.referencia ? linea.referencia + (linea.descripcion ? " - " + linea.descripcion : "") : "")}
                            onChange={e => { buscarArticulo(idx, e.target.value); setArtDropIdx(idx) }}
                            onFocus={() => setArtDropIdx(idx)}
                            placeholder="Ref. o descripción..."
                            className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-purple-400"
                          />
                          {artDropIdx === idx && (artSugMap[idx] || []).length > 0 && (
                            <div className="absolute z-30 left-0 top-full mt-1 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {(artSugMap[idx] || []).map(a => (
                                <button
                                  key={a.id}
                                  onClick={() => seleccionarArticulo(idx, a)}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0"
                                >
                                  <span className="font-mono text-xs text-purple-400">{a.referencia}</span>
                                  <span className="ml-2 text-slate-300">{a.descripcion}</span>
                                  <span className="ml-auto text-slate-500 float-right">{a.precioVenta.toFixed(2)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="text"
                          value={linea.descripcion}
                          onChange={e => updateLinea(idx, "descripcion", e.target.value)}
                          placeholder="Descripción..."
                          className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number" min="0" step="0.001"
                          value={linea.cantidad}
                          onChange={e => updateLinea(idx, "cantidad", parseFloat(e.target.value) || 0)}
                          className="w-full text-right px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number" min="0" step="0.01"
                          value={linea.precioUnitario}
                          onChange={e => updateLinea(idx, "precioUnitario", parseFloat(e.target.value) || 0)}
                          className="w-full text-right px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number" min="0" max="100"
                          value={linea.descuento}
                          onChange={e => updateLinea(idx, "descuento", parseFloat(e.target.value) || 0)}
                          className="w-full text-right px-1 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:ring-1 focus:ring-purple-400"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <select
                          value={linea.iva}
                          onChange={e => updateLinea(idx, "iva", parseInt(e.target.value))}
                          className="w-full text-right px-1 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white focus:ring-1 focus:ring-purple-400"
                        >
                          <option value={0}>0%</option>
                          <option value={4}>4%</option>
                          <option value={10}>10%</option>
                          <option value={21}>21%</option>
                        </select>
                      </td>
                      <td className="py-2 px-1 text-right text-slate-400 font-mono text-xs whitespace-nowrap">
                        {linea.baseLinea.toFixed(2)}
                      </td>
                      <td className="py-2 px-1 text-right font-semibold text-white font-mono text-xs whitespace-nowrap">
                        {linea.totalLinea.toFixed(2)}
                      </td>
                      <td className="py-2 pl-1">
                        <button
                          onClick={() => removeLinea(idx)}
                          className="text-red-400 hover:text-red-300 p-1 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Totales */}
        {lineas.length > 0 && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Base imponible</span>
                  <span className="font-mono text-white">{totalBase.toFixed(2)} EUR</span>
                </div>
                {Object.entries(desgloseIva).map(([tipoIva, vals]) => (
                  <div key={tipoIva} className="flex justify-between text-sm text-slate-400">
                    <span>IVA {tipoIva}%</span>
                    <span className="font-mono text-white">{vals.cuota.toFixed(2)} EUR</span>
                  </div>
                ))}
                {retencion > 0 && (
                  <div className="flex justify-between text-sm text-red-400">
                    <span>Retención IRPF {retencion}%</span>
                    <span className="font-mono">-{totalRetencion.toFixed(2)} EUR</span>
                  </div>
                )}
                <div className="border-t border-slate-700 pt-2 flex justify-between text-lg font-bold text-white">
                  <span>Total</span>
                  <span className="font-mono">{formatEur(totalGeneral)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex justify-end gap-3 pb-6">
          <button
            onClick={() => navigate("/ventas/recurrentes")}
            className="px-6 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {guardando ? "Guardando..." : "Crear Factura Recurrente"}
          </button>
        </div>
      </div>
    </div>
  )
}
