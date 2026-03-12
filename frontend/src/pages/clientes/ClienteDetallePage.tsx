import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const API = "/api";
const fmt = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("es-ES") : "—");
const token = () => localStorage.getItem("accessToken") || "";
const hdrs = () => ({ "Content-Type": "application/json", Authorization: "Bearer " + token() });

const TABS = [
  { key: "resumen", label: "Resumen" },
  { key: "facturas", label: "Facturas" },
  { key: "vencimientos", label: "Vencimientos" },
  { key: "cobros", label: "Cobros" },
  { key: "contactos", label: "Contactos" },
  { key: "notas", label: "Notas" },
];

const ESTADOS_FACTURA: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  EMITIDA: { label: "Emitida", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  PARCIALMENTE_COBRADA: { label: "Parcial", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  COBRADA: { label: "Cobrada", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  VENCIDA: { label: "Vencida", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  ANULADA: { label: "Anulada", cls: "bg-slate-600/10 text-slate-500 border-slate-600/20" },
};

const ESTADOS_VENCIMIENTO: Record<string, { label: string; cls: string }> = {
  PAGADO: { label: "Pagado", cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  PENDIENTE: { label: "Pendiente", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  VENCIDO: { label: "Vencido", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  PAGADO_PARCIAL: { label: "Parcial", cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

function Badge({ estado, map }: { estado: string; map: Record<string, { label: string; cls: string }> }) {
  const e = map[estado] || { label: estado, cls: "bg-slate-600/10 text-slate-500 border-slate-600/20" };
  return <span className={`text-xs px-2 py-1 rounded-full border font-medium ${e.cls}`}>{e.label}</span>;
}

function KpiCard({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function ClienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("resumen");
  const [toast, setToast] = useState("");

  // Resumen
  const [resumen, setResumen] = useState<any>(null);
  // Facturas
  const [facturas, setFacturas] = useState<any[]>([]);
  const [filtroEstadoFact, setFiltroEstadoFact] = useState("");
  // Vencimientos
  const [vencimientos, setVencimientos] = useState<any[]>([]);
  // Cobros
  const [cobros, setCobros] = useState<any[]>([]);
  // Contactos
  const [contactos, setContactos] = useState<any[]>([]);
  const [contactoForm, setContactoForm] = useState<any>({ nombre: "", cargo: "", email: "", telefono: "", principal: false });
  const [editingContacto, setEditingContacto] = useState<string | null>(null);
  const [showAddContacto, setShowAddContacto] = useState(false);
  // Notas
  const [notas, setNotas] = useState<any[]>([]);
  const [nuevaNota, setNuevaNota] = useState("");

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const cargarCliente = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/clientes/${id}`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const c = await res.json();
      setCliente(c);
      if (c.contactos) setContactos(c.contactos);
    } catch { showToast("Error al cargar cliente"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { cargarCliente(); }, [cargarCliente]);

  // Load tab data on tab change
  const cargarTabData = useCallback(async (tab: string) => {
    if (!id) return;
    try {
      if (tab === "resumen" && !resumen) {
        const res = await fetch(`${API}/clientes/${id}/resumen`, { headers: hdrs() });
        if (res.ok) setResumen(await res.json());
      }
      if (tab === "facturas" && facturas.length === 0) {
        const res = await fetch(`${API}/ventas/facturas?clienteId=${id}`, { headers: hdrs() });
        if (res.ok) {
          const data = await res.json();
          setFacturas(Array.isArray(data) ? data : (data.data || []));
        }
      }
      if (tab === "vencimientos" && vencimientos.length === 0) {
        const res = await fetch(`${API}/clientes/${id}/vencimientos`, { headers: hdrs() });
        if (res.ok) {
          const data = await res.json();
          setVencimientos(Array.isArray(data) ? data : (data.data || []));
        }
      }
      if (tab === "cobros" && cobros.length === 0) {
        const res = await fetch(`${API}/ventas/cobros?clienteId=${id}`, { headers: hdrs() });
        if (res.ok) {
          const data = await res.json();
          setCobros(Array.isArray(data) ? data : (data.data || []));
        }
      }
      if (tab === "contactos" && contactos.length === 0) {
        const res = await fetch(`${API}/clientes/${id}`, { headers: hdrs() });
        if (res.ok) {
          const data = await res.json();
          if (data.contactos) setContactos(data.contactos);
        }
      }
      if (tab === "notas" && notas.length === 0) {
        const res = await fetch(`${API}/clientes/${id}/notas`, { headers: hdrs() });
        if (res.ok) {
          const data = await res.json();
          setNotas(Array.isArray(data) ? data : (data.data || []));
        }
      }
    } catch { /* silently fail */ }
  }, [id, resumen, facturas.length, vencimientos.length, cobros.length, contactos.length, notas.length]);

  const handleTabClick = (key: string) => { setActiveTab(key); cargarTabData(key); };

  useEffect(() => {
    if (cliente) cargarTabData("resumen");
  }, [cliente]);

  // Contacto CRUD
  const guardarContacto = async () => {
    if (!contactoForm.nombre.trim()) return;
    try {
      if (editingContacto) {
        const res = await fetch(`${API}/clientes/${id}/contactos/${editingContacto}`, {
          method: "PUT", headers: hdrs(), body: JSON.stringify(contactoForm),
        });
        if (res.ok) {
          const updated = await res.json();
          setContactos(prev => prev.map(c => c.id === editingContacto ? updated : c));
          showToast("Contacto actualizado");
        } else { showToast("Error al actualizar"); }
      } else {
        const res = await fetch(`${API}/clientes/${id}/contactos`, {
          method: "POST", headers: hdrs(), body: JSON.stringify(contactoForm),
        });
        if (res.ok) {
          const nuevo = await res.json();
          setContactos(prev => [...prev, nuevo]);
          showToast("Contacto añadido");
        } else { showToast("Error al crear"); }
      }
    } catch { showToast("Error de conexión"); }
    setContactoForm({ nombre: "", cargo: "", email: "", telefono: "", principal: false });
    setEditingContacto(null);
    setShowAddContacto(false);
  };

  const eliminarContacto = async (cid: string) => {
    try {
      const res = await fetch(`${API}/clientes/${id}/contactos/${cid}`, { method: "DELETE", headers: hdrs() });
      if (res.ok) {
        setContactos(prev => prev.filter(c => c.id !== cid));
        showToast("Contacto eliminado");
      } else { showToast("Error al eliminar"); }
    } catch { showToast("Error de conexión"); }
  };

  const editarContacto = (c: any) => {
    setContactoForm({ nombre: c.nombre || "", cargo: c.cargo || "", email: c.email || "", telefono: c.telefono || "", principal: c.principal || false });
    setEditingContacto(c.id);
    setShowAddContacto(true);
  };

  // Notas
  const añadirNota = async () => {
    if (!nuevaNota.trim()) return;
    try {
      const res = await fetch(`${API}/clientes/${id}/notas`, {
        method: "POST", headers: hdrs(), body: JSON.stringify({ texto: nuevaNota }),
      });
      if (res.ok) {
        const nota = await res.json();
        setNotas(prev => [nota, ...prev]);
        setNuevaNota("");
        showToast("Nota añadida");
      } else { showToast("Error al añadir nota"); }
    } catch { showToast("Error de conexión"); }
  };

  // Filtered facturas
  const facturasFiltradas = filtroEstadoFact
    ? facturas.filter(f => f.estado === filtroEstadoFact)
    : facturas;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!cliente) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Cliente no encontrado</p>
      <button onClick={() => navigate("/clientes")} className="mt-4 text-blue-400 text-sm hover:underline">Volver a clientes</button>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">{toast}</div>}

      {/* Back button */}
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Clientes
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{cliente.nombre}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cliente.activo !== false ? "bg-green-500/10 text-green-400" : "bg-slate-700 text-slate-500"}`}>
              {cliente.activo !== false ? "Activo" : "Inactivo"}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {cliente.cifNif && <span className="font-mono text-sm text-slate-400">{cliente.cifNif}</span>}
            {cliente.ciudad && <span className="text-sm text-slate-500">{cliente.ciudad}</span>}
            {cliente.telefono && <span className="text-sm text-slate-500">{cliente.telefono}</span>}
            {cliente.email && <span className="text-sm text-slate-500">{cliente.email}</span>}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total facturado año"
          value={fmt(resumen?.totalFacturadoAnio ?? resumen?.totalFacturado ?? 0)}
          accent="text-white"
        />
        <KpiCard
          label="Pendiente cobro"
          value={fmt(resumen?.pendienteCobro ?? 0)}
          accent={(resumen?.pendienteCobro ?? 0) > 0 ? "text-orange-400" : "text-green-400"}
        />
        <KpiCard
          label="Nº facturas"
          value={String(resumen?.numFacturas ?? resumen?.nFacturas ?? 0)}
          accent="text-indigo-400"
        />
        <KpiCard
          label="Última factura"
          value={resumen?.ultimaFactura ? fmtDate(resumen.ultimaFactura.fecha || resumen.ultimaFactura) : "—"}
          accent="text-slate-300"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => handleTabClick(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.key ? "text-white border-blue-500" : "text-slate-500 border-transparent hover:text-slate-300"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB: RESUMEN ═══ */}
      {activeTab === "resumen" && (
        <div className="space-y-6">
          {resumen?.evolucionMensual && resumen.evolucionMensual.length > 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Facturación últimos 12 meses</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resumen.evolucionMensual}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="mes" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#475569" }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#475569" }} tickFormatter={(v: number) => fmt(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", color: "#fff" }}
                    labelStyle={{ color: "#94a3b8" }}
                    formatter={(value: number) => [fmt(value), "Importe"]}
                  />
                  <Bar dataKey="importe" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm italic">Sin datos de facturación disponibles</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: FACTURAS ═══ */}
      {activeTab === "facturas" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={filtroEstadoFact}
              onChange={e => setFiltroEstadoFact(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos los estados</option>
              {Object.entries(ESTADOS_FACTURA).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{facturasFiltradas.length} facturas</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Número", "Fecha", "Total", "Pagado", "Pendiente", "Estado"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facturasFiltradas.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-slate-500 italic">Sin facturas</td></tr>
                ) : facturasFiltradas.map((f: any) => (
                  <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm text-indigo-400">{f.numeroCompleto || f.numero}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(f.fecha)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(f.total)}</td>
                    <td className="px-4 py-3 text-sm text-green-400">{fmt(f.pagado ?? f.totalCobrado ?? 0)}</td>
                    <td className="px-4 py-3 text-sm text-orange-400">{fmt(f.pendiente ?? (f.total - (f.pagado ?? f.totalCobrado ?? 0)))}</td>
                    <td className="px-4 py-3"><Badge estado={f.estado} map={ESTADOS_FACTURA} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TAB: VENCIMIENTOS ═══ */}
      {activeTab === "vencimientos" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {["Factura", "Importe", "Fecha vto", "Pagado", "Estado"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vencimientos.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500 italic">Sin vencimientos</td></tr>
              ) : vencimientos.map((v: any, i: number) => (
                <tr key={v.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-indigo-400">{v.factura?.numeroCompleto || v.facturaNumero || v.factura || "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(v.importe)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(v.fechaVencimiento || v.fechaVto)}</td>
                  <td className="px-4 py-3 text-sm text-green-400">{fmt(v.pagado ?? v.importePagado ?? 0)}</td>
                  <td className="px-4 py-3"><Badge estado={v.estado} map={ESTADOS_VENCIMIENTO} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB: COBROS ═══ */}
      {activeTab === "cobros" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                {["Fecha", "Factura", "Importe", "Forma pago"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cobros.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-slate-500 italic">Sin cobros</td></tr>
              ) : cobros.map((c: any, i: number) => (
                <tr key={c.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(c.fecha)}</td>
                  <td className="px-4 py-3 font-mono text-sm text-indigo-400">{c.factura?.numeroCompleto || c.facturaNumero || c.factura || "—"}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(c.importe)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{c.formaPago?.nombre || c.formaPago || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ TAB: CONTACTOS ═══ */}
      {activeTab === "contactos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Contactos ({contactos.length})</h3>
            {!showAddContacto && (
              <button
                onClick={() => { setShowAddContacto(true); setEditingContacto(null); setContactoForm({ nombre: "", cargo: "", email: "", telefono: "", principal: false }); }}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Añadir contacto
              </button>
            )}
          </div>

          {showAddContacto && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-medium text-white">{editingContacto ? "Editar contacto" : "Nuevo contacto"}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nombre *</label>
                  <input
                    value={contactoForm.nombre}
                    onChange={e => setContactoForm((p: any) => ({ ...p, nombre: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Cargo</label>
                  <input
                    value={contactoForm.cargo}
                    onChange={e => setContactoForm((p: any) => ({ ...p, cargo: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Cargo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={contactoForm.email}
                    onChange={e => setContactoForm((p: any) => ({ ...p, email: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Teléfono</label>
                  <input
                    value={contactoForm.telefono}
                    onChange={e => setContactoForm((p: any) => ({ ...p, telefono: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    placeholder="Teléfono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={contactoForm.principal}
                  onChange={e => setContactoForm((p: any) => ({ ...p, principal: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500"
                />
                <label className="text-sm text-slate-400">Contacto principal</label>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button onClick={guardarContacto} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                  {editingContacto ? "Actualizar" : "Guardar"}
                </button>
                <button onClick={() => { setShowAddContacto(false); setEditingContacto(null); }} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {contactos.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <p className="text-slate-500 text-sm italic">Sin contactos registrados</p>
              </div>
            ) : contactos.map((c: any) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{c.nombre}</span>
                    {c.principal && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Principal</span>}
                  </div>
                  {c.cargo && <div className="text-xs text-slate-500 mt-0.5">{c.cargo}</div>}
                  <div className="flex gap-4 mt-1">
                    {c.email && <span className="text-xs text-slate-400">{c.email}</span>}
                    {c.telefono && <span className="text-xs text-slate-400">{c.telefono}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => editarContacto(c)} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors" title="Editar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                  </button>
                  <button onClick={() => eliminarContacto(c.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors" title="Eliminar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TAB: NOTAS ═══ */}
      {activeTab === "notas" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <textarea
              value={nuevaNota}
              onChange={e => setNuevaNota(e.target.value)}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Escribe una nota..."
            />
            <button
              onClick={añadirNota}
              disabled={!nuevaNota.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Añadir nota
            </button>
          </div>

          <div className="space-y-2">
            {notas.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
                <p className="text-slate-500 text-sm italic">Sin notas</p>
              </div>
            ) : notas.map((n: any, i: number) => (
              <div key={n.id || i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{n.texto}</p>
                <p className="text-xs text-slate-600 mt-2">{fmtDate(n.fecha || n.createdAt || n.creadoEn)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
