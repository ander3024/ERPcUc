import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── Style constants ────────────────────────────────────────────────────────
const inp =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0)

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—')

// ─── Types ───────────────────────────────────────────────────────────────────
type Estado =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'PARCIALMENTE_RECIBIDO'
  | 'RECIBIDO'
  | 'FACTURADO'
  | 'CANCELADO'

interface Proveedor {
  id: number
  nombre: string
  nif?: string
  email?: string
  telefono?: string
}

interface LineaPedido {
  id: number
  descripcion: string
  cantidad: number
  cantidadRecibida: number
  precio: number
  iva: number
  total: number
}

interface Pedido {
  id: number
  numero: string
  estado: Estado
  fecha: string
  fechaEntrega?: string
  total: number
  baseImponible?: number
  totalIva?: number
  observaciones?: string
  proveedor: Proveedor
  lineas?: LineaPedido[]
  albaranes?: { id: number; numero: string }[]
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Stats {
  total: number
  pendientes: number
  parciales: number
  recibidos: number
  importePendiente: number
}

interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

// ─── Estado badge ────────────────────────────────────────────────────────────
const ESTADO_META: Record<Estado, { label: string; classes: string }> = {
  BORRADOR: {
    label: 'Borrador',
    classes: 'bg-slate-700 text-slate-300 border border-slate-600',
  },
  ENVIADO: {
    label: 'Enviado',
    classes: 'bg-blue-900/50 text-blue-300 border border-blue-700',
  },
  PARCIALMENTE_RECIBIDO: {
    label: 'Parcial',
    classes: 'bg-orange-900/50 text-orange-300 border border-orange-700',
  },
  RECIBIDO: {
    label: 'Recibido',
    classes: 'bg-green-900/50 text-green-300 border border-green-700',
  },
  FACTURADO: {
    label: 'Facturado',
    classes: 'bg-purple-900/50 text-purple-300 border border-purple-700',
  },
  CANCELADO: {
    label: 'Cancelado',
    classes: 'bg-slate-800 text-slate-500 border border-slate-700',
  },
}

function EstadoBadge({ estado }: { estado: Estado }) {
  const meta = ESTADO_META[estado] ?? {
    label: estado,
    classes: 'bg-slate-700 text-slate-300 border border-slate-600',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.classes}`}>
      {meta.label}
    </span>
  )
}

// ─── Toast system ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all
            ${t.type === 'success' ? 'bg-green-800 text-green-100 border border-green-600' : ''}
            ${t.type === 'error' ? 'bg-red-900 text-red-100 border border-red-700' : ''}
            ${t.type === 'info' ? 'bg-blue-900 text-blue-100 border border-blue-700' : ''}`}
        >
          <span>
            {t.type === 'success' && '✓ '}
            {t.type === 'error' && '✕ '}
            {t.type === 'info' && 'ℹ '}
            {t.message}
          </span>
          <button
            onClick={() => onRemove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Confirmation dialog ──────────────────────────────────────────────────────
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  confirmClasses = 'bg-red-600 hover:bg-red-700 text-white',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmClasses?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${confirmClasses}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── API helper ───────────────────────────────────────────────────────────────
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('accessToken')
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.message ?? `Error ${res.status}`)
  }
  return res.json()
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  pedidoId,
  onClose,
  onUpdated,
  addToast,
}: {
  pedidoId: number | null
  onClose: () => void
  onUpdated: () => void
  addToast: (type: Toast['type'], message: string) => void
}) {
  const navigate = useNavigate()
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [loading, setLoading] = useState(false)
  const [observaciones, setObservaciones] = useState('')
  const [savingObs, setSavingObs] = useState(false)
  const [newEstado, setNewEstado] = useState<Estado | ''>('')
  const [savingEstado, setSavingEstado] = useState(false)
  const [confirmConvertir, setConfirmConvertir] = useState(false)
  const [convertiendo, setConvertiendo] = useState(false)

  const fetchPedido = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const data = await apiFetch(`/api/compras/pedidos/${id}`)
      setPedido(data)
      setObservaciones(data.observaciones ?? '')
      setNewEstado('')
    } catch (err: any) {
      addToast('error', err.message ?? 'Error al cargar el pedido')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    if (pedidoId !== null) {
      fetchPedido(pedidoId)
    }
  }, [pedidoId, fetchPedido])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSaveObservaciones = async () => {
    if (!pedido) return
    setSavingObs(true)
    try {
      await apiFetch(`/api/compras/pedidos/${pedido.id}`, {
        method: 'PUT',
        body: JSON.stringify({ observaciones }),
      })
      addToast('success', 'Observaciones guardadas')
      onUpdated()
    } catch (err: any) {
      addToast('error', err.message ?? 'Error al guardar observaciones')
    } finally {
      setSavingObs(false)
    }
  }

  const handleChangeEstado = async () => {
    if (!pedido || !newEstado) return
    setSavingEstado(true)
    try {
      await apiFetch(`/api/compras/pedidos/${pedido.id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado: newEstado }),
      })
      addToast('success', `Estado cambiado a ${ESTADO_META[newEstado as Estado]?.label ?? newEstado}`)
      onUpdated()
      fetchPedido(pedido.id)
    } catch (err: any) {
      addToast('error', err.message ?? 'Error al cambiar estado')
    } finally {
      setSavingEstado(false)
    }
  }

  const handleConvertirAlbaran = async () => {
    if (!pedido) return
    setConvertiendo(true)
    setConfirmConvertir(false)
    try {
      await apiFetch(`/api/compras/pedidos/${pedido.id}/convertir-albaran`, {
        method: 'POST',
      })
      addToast('success', 'Albarán creado correctamente')
      onUpdated()
      fetchPedido(pedido.id)
    } catch (err: any) {
      addToast('error', err.message ?? 'Error al convertir a albarán')
    } finally {
      setConvertiendo(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const isOpen = pedidoId !== null

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl z-50 bg-slate-950 border-l border-slate-800 shadow-2xl
          flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {pedido && (
          <>
            {/* Panel header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white">{pedido.numero}</h2>
                    <EstadoBadge estado={pedido.estado} />
                  </div>
                  <p className="text-sm text-slate-400">
                    Pedido de compra · {fmtDate(pedido.fecha)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

              {/* Proveedor info */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Proveedor
                </h3>
                <p className="text-white font-semibold text-sm">{pedido.proveedor?.nombre ?? '—'}</p>
                {pedido.proveedor?.nif && (
                  <p className="text-slate-400 text-xs mt-1">NIF: {pedido.proveedor.nif}</p>
                )}
                {pedido.proveedor?.email && (
                  <p className="text-slate-400 text-xs mt-0.5">{pedido.proveedor.email}</p>
                )}
                {pedido.proveedor?.telefono && (
                  <p className="text-slate-400 text-xs mt-0.5">{pedido.proveedor.telefono}</p>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <p className="text-xs text-slate-500 mb-1">Fecha pedido</p>
                  <p className="text-white text-sm font-medium">{fmtDate(pedido.fecha)}</p>
                </div>
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <p className="text-xs text-slate-500 mb-1">Fecha entrega</p>
                  <p className="text-white text-sm font-medium">{fmtDate(pedido.fechaEntrega ?? '')}</p>
                </div>
              </div>

              {/* Lines table */}
              {pedido.lineas && pedido.lineas.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Líneas del pedido
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-slate-500 text-xs border-b border-slate-800">
                          <th className="text-left px-4 py-2 font-medium">Descripción</th>
                          <th className="text-right px-3 py-2 font-medium">Cant.</th>
                          <th className="text-right px-3 py-2 font-medium">Recib.</th>
                          <th className="text-right px-3 py-2 font-medium">Precio</th>
                          <th className="text-right px-3 py-2 font-medium">IVA%</th>
                          <th className="text-right px-4 py-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedido.lineas.map((l) => (
                          <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-2.5 text-white">{l.descripcion}</td>
                            <td className="px-3 py-2.5 text-right text-slate-300">{l.cantidad}</td>
                            <td className={`px-3 py-2.5 text-right font-medium ${
                              l.cantidadRecibida >= l.cantidad
                                ? 'text-green-400'
                                : l.cantidadRecibida > 0
                                ? 'text-orange-400'
                                : 'text-slate-400'
                            }`}>
                              {l.cantidadRecibida}
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-300">{fmt(l.precio)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-400">{l.iva}%</td>
                            <td className="px-4 py-2.5 text-right text-white font-medium">{fmt(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Importes
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Base imponible</span>
                    <span className="text-white">{fmt(pedido.baseImponible ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">IVA</span>
                    <span className="text-white">{fmt(pedido.totalIva ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-slate-700 pt-2 mt-1">
                    <span className="text-white">Total</span>
                    <span className="text-blue-400 text-base">{fmt(pedido.total)}</span>
                  </div>
                </div>
              </div>

              {/* Albaranes relacionados */}
              {pedido.albaranes && pedido.albaranes.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Albaranes asociados
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {pedido.albaranes.map((a) => (
                      <span
                        key={a.id}
                        className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-300"
                      >
                        {a.numero}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Observaciones
                </h3>
                <textarea
                  className={`${inp} min-h-[80px] resize-y`}
                  placeholder="Añade observaciones sobre este pedido..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveObservaciones}
                    disabled={savingObs}
                    className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {savingObs ? 'Guardando...' : 'Guardar observaciones'}
                  </button>
                </div>
              </div>

              {/* Change estado */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Cambiar estado
                </h3>
                <div className="flex gap-2">
                  <select
                    className={`${inp} flex-1`}
                    value={newEstado}
                    onChange={(e) => setNewEstado(e.target.value as Estado)}
                  >
                    <option value="">Seleccionar nuevo estado...</option>
                    {(Object.keys(ESTADO_META) as Estado[]).map((e) => (
                      <option key={e} value={e} disabled={e === pedido.estado}>
                        {ESTADO_META[e].label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleChangeEstado}
                    disabled={!newEstado || savingEstado}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    {savingEstado ? 'Guardando...' : 'Aplicar'}
                  </button>
                </div>
              </div>
            </div>

            {/* Panel footer: action buttons */}
            <div className="border-t border-slate-800 px-6 py-4 flex-shrink-0 space-y-3">
              {/* Editar pedido - reglas por estado */}
              {(pedido.estado === 'BORRADOR' || pedido.estado === 'ENVIADO') ? (
                <button onClick={() => navigate('/compras/nuevo/pedido?edit=' + pedido.id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Editar pedido
                </button>
              ) : (pedido.estado === 'PARCIALMENTE_RECIBIDO' || pedido.estado === 'RECIBIDO' || pedido.estado === 'FACTURADO') ? (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
                  <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span>Este pedido ya tiene recepciones o esta facturado y no se puede editar.</span>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmConvertir(true)}
                disabled={convertiendo || pedido.estado === 'CANCELADO'}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {convertiendo ? 'Convirtiendo...' : 'Convertir a albarán'}
              </button>

              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors border border-slate-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir
              </button>
              </div>
            </div>
          </>
        )}

        {!loading && !pedido && pedidoId !== null && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            No se pudo cargar el pedido
          </div>
        )}
      </div>

      {/* Confirm: convertir a albarán */}
      <ConfirmDialog
        open={confirmConvertir}
        title="Convertir a albarán"
        message={`¿Deseas crear un albarán de recepción a partir del pedido ${pedido?.numero}? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, convertir"
        confirmClasses="bg-green-700 hover:bg-green-600 text-white"
        onConfirm={handleConvertirAlbaran}
        onCancel={() => setConfirmConvertir(false)}
      />
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PedidosCompraPage() {
  const navigate = useNavigate()

  // State
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<Estado | ''>('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [toastCounter, setToastCounter] = useState(0)

  // Toast helpers
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, type, message }])
    setToastCounter((c) => c + 1)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4500)
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch('/api/compras/pedidos/stats')
      setStats(data)
    } catch {
      // stats failure is non-blocking
    }
  }, [])

  // Fetch list
  const fetchPedidos = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
          search,
          estado: estadoFilter,
        })
        const data = await apiFetch(`/api/compras/pedidos?${params}`)
        setPedidos(data.data ?? [])
        setPagination(data.pagination ?? { page, limit: 20, total: 0, totalPages: 1 })
      } catch (err: any) {
        addToast('error', err.message ?? 'Error al cargar pedidos')
      } finally {
        setLoading(false)
      }
    },
    [search, estadoFilter, pagination.limit, addToast]
  )

  // Initial load
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchPedidos(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, estadoFilter])

  const handleRowClick = (id: number) => {
    setSelectedId(id)
  }

  const handleClosePanel = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleUpdated = useCallback(() => {
    fetchPedidos(pagination.page)
    fetchStats()
  }, [fetchPedidos, fetchStats, pagination.page])

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Page header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Pedidos de compra</h1>
            <p className="text-slate-400 text-sm mt-0.5">Gestión de pedidos a proveedores</p>
          </div>
          <button
            onClick={() => navigate('/compras/nuevo/pedido')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo pedido
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-6">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total pedidos</p>
            <p className="text-2xl font-bold text-white">{stats?.total ?? '—'}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pendientes</p>
            <p className="text-2xl font-bold text-blue-400">{stats?.pendientes ?? '—'}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Parcial recibido</p>
            <p className="text-2xl font-bold text-orange-400">{stats?.parciales ?? '—'}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Importe pendiente</p>
            <p className="text-2xl font-bold text-green-400">
              {stats ? fmt(stats.importePendiente) : '—'}
            </p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
              />
            </svg>
            <input
              type="text"
              className={`${inp} pl-9`}
              placeholder="Buscar por número o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inp} sm:w-56`}
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value as Estado | '')}
          >
            <option value="">Todos los estados</option>
            {(Object.keys(ESTADO_META) as Estado[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_META[e].label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-700">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Número
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Proveedor
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    F. Entrega
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <div className="flex items-center justify-center gap-3 text-slate-500">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>Cargando pedidos...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && pedidos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-sm">No se encontraron pedidos</span>
                        {(search || estadoFilter) && (
                          <button
                            onClick={() => { setSearch(''); setEstadoFilter('') }}
                            className="text-blue-400 hover:text-blue-300 text-xs underline mt-1"
                          >
                            Limpiar filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  pedidos.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => handleRowClick(p.id)}
                      className={`border-b border-slate-800/60 cursor-pointer transition-colors hover:bg-slate-700/30
                        ${selectedId === p.id ? 'bg-slate-700/40 border-l-2 border-l-blue-500' : ''}`}
                    >
                      <td className="px-5 py-3.5 font-mono text-blue-400 font-medium">
                        {p.numero}
                      </td>
                      <td className="px-5 py-3.5 text-white">
                        {p.proveedor?.nombre ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">{fmtDate(p.fecha)}</td>
                      <td className="px-5 py-3.5 text-slate-400">{fmtDate(p.fechaEntrega ?? '')}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-white">
                        {fmt(p.total)}
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoBadge estado={p.estado} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-5 py-3 border-t border-slate-700 bg-slate-800/30 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Mostrando {(pagination.page - 1) * pagination.limit + 1}–
                {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                {pagination.total} pedidos
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => fetchPedidos(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-40 transition-colors"
                >
                  Anterior
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                  const totalPages = pagination.totalPages
                  const current = pagination.page
                  let page: number

                  if (totalPages <= 7) {
                    page = i + 1
                  } else if (current <= 4) {
                    page = i + 1
                  } else if (current >= totalPages - 3) {
                    page = totalPages - 6 + i
                  } else {
                    page = current - 3 + i
                  }

                  return (
                    <button
                      key={page}
                      onClick={() => fetchPedidos(page)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                        ${page === pagination.page
                          ? 'bg-blue-600 border-blue-500 text-white font-semibold'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                    >
                      {page}
                    </button>
                  )
                })}

                <button
                  onClick={() => fetchPedidos(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-40 transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}

          {/* Row count summary when single page */}
          {pagination.totalPages <= 1 && pedidos.length > 0 && (
            <div className="px-5 py-2.5 border-t border-slate-700 bg-slate-800/30">
              <p className="text-xs text-slate-500">
                {pagination.total} pedido{pagination.total !== 1 ? 's' : ''} en total
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <DetailPanel
        pedidoId={selectedId}
        onClose={handleClosePanel}
        onUpdated={handleUpdated}
        addToast={addToast}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
