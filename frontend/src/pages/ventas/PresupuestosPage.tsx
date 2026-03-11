import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, FileText, TrendingUp, CheckCircle, ChevronRight, X, Edit2, Trash2, ArrowRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const ESTADO: Record<string, { label: string; color: string }> = {
  BORRADOR:  { label: 'Borrador',  color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  ENVIADO:   { label: 'Enviado',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  ACEPTADO:  { label: 'Aceptado',  color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  RECHAZADO: { label: 'Rechazado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  CADUCADO:  { label: 'Caducado',  color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
};

function PanelDetalle({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{type: string; text: string} | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const d = await fetch(API + '/ventas/presupuestos/' + id, { headers: headers() }).then(r => r.json());
      setDoc(d);
    } catch { setMsg({type:'error', text:'Error cargando presupuesto'}); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const cambiarEstado = async (nuevoEstado: string) => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/presupuestos/' + id, {
        method: 'PUT', headers: headers(),
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg({type:'ok', text:'Estado actualizado a ' + ESTADO[nuevoEstado]?.label});
      cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({type:'error', text: e.message}); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/presupuestos/' + id, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      onRefresh(); onClose();
    } catch (e: any) { setMsg({type:'error', text: e.message}); setSaving(false); }
  };

  const convertirPedido = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/presupuestos/' + id + '/convertir-pedido', { method: 'POST', headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      const nuevo = await r.json();
      setMsg({type:'ok', text:'Convertido a pedido ' + (nuevo.numeroCompleto || '')});
      cargar(); onRefresh();
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) { setMsg({type:'error', text: e.message}); }
    setSaving(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Cabecera */}
      <div className="flex items-start justify-between p-5 border-b border-slate-700 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white font-mono">{doc.numeroCompleto || doc.numero}</span>
            <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[doc.estado]?.color || '')}>{ESTADO[doc.estado]?.label}</span>
          </div>
          <div className="text-sm text-slate-400">{doc.cliente?.nombre || doc.nombreCliente}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
      </div>

      {/* Notificacion */}
      {msg && (
        <div className={"mx-5 mt-3 px-3 py-2 rounded-lg text-sm font-medium " + (msg.type==='ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>
          {msg.text}
        </div>
      )}

      {/* Cuerpo scroll */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Datos principales */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Fecha</div>
            <div className="text-sm text-white">{fmtDate(doc.fecha)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Validez</div>
            <div className="text-sm text-white">{fmtDate(doc.fechaValidez)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">CIF/NIF</div>
            <div className="text-sm text-white">{doc.cliente?.cifNif || doc.cifNif || '-'}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Forma de pago</div>
            <div className="text-sm text-white">{doc.formaPago?.nombre || '-'}</div>
          </div>
        </div>

        {/* Estado - cambio rapido */}
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Cambiar estado</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESTADO).map(([k, v]) => (
              <button key={k} onClick={() => cambiarEstado(k)} disabled={saving || doc.estado === k}
                className={"text-xs px-3 py-1.5 rounded-full border font-medium transition-all " + (doc.estado === k ? v.color + ' opacity-50 cursor-default' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white')}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lineas */}
        {doc.lineas?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Lineas ({doc.lineas.length})</div>
            <div className="space-y-2">
              {doc.lineas.map((l: any, i: number) => (
                <div key={l.id} className="bg-slate-700/50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium">{l.descripcion || l.referencia || 'Linea ' + (i+1)}</div>
                      {l.referencia && l.descripcion && <div className="text-xs text-slate-500 mt-0.5">{l.referencia}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold text-white">{fmt(l.totalLinea)}</div>
                      <div className="text-xs text-slate-500">{l.cantidad} x {fmt(l.precioUnitario)} · IVA {l.tipoIva}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totales */}
        <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-400">Base imponible</span><span className="text-white">{fmt(doc.baseImponible)}</span></div>
          {doc.descuento > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400">Descuento</span><span className="text-orange-400">-{doc.descuento}%</span></div>}
          <div className="flex justify-between text-sm"><span className="text-slate-400">IVA</span><span className="text-white">{fmt(doc.totalIva)}</span></div>
          {doc.totalIrpf > 0 && <div className="flex justify-between text-sm"><span className="text-slate-400">IRPF</span><span className="text-orange-400">-{fmt(doc.totalIrpf)}</span></div>}
          <div className="flex justify-between text-base font-bold border-t border-slate-600 pt-2 mt-2">
            <span className="text-white">TOTAL</span><span className="text-white">{fmt(doc.total)}</span>
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Observaciones</div>
          <div className="text-sm text-slate-300 bg-slate-700/50 rounded-lg p-3 min-h-10">{doc.observaciones || '-'}</div>
        </div>
      </div>

      {/* Acciones fijas al fondo */}
      <div className="border-t border-slate-700 p-4 shrink-0 space-y-3">
        {/* Conversion */}
        <button onClick={convertirPedido} disabled={saving || doc.estado === 'RECHAZADO' || doc.estado === 'CADUCADO'}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <ArrowRight className="w-4 h-4"/>Convertir en pedido
        </button>

        {/* Editar presupuesto - reglas por estado */}
        {(doc.estado === 'BORRADOR' || doc.estado === 'ENVIADO') ? (
          <div className="flex gap-2">
            <button onClick={() => navigate('/ventas/nuevo/presupuesto?edit=' + id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Edit2 className="w-4 h-4"/>Editar presupuesto
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm transition-colors">
                <Trash2 className="w-4 h-4"/>
              </button>
            ) : (
              <button onClick={eliminar} disabled={saving} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors">
                <AlertTriangle className="w-4 h-4"/>Confirmar borrado
              </button>
            )}
          </div>
        ) : doc.estado === 'ACEPTADO' ? (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
            <span>Este presupuesto ya esta aceptado y no se puede editar. Conviertelo en pedido.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PresupuestosPage() {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search });
      if (estadoFilter) params.set('estado', estadoFilter);
      const [dr, sr] = await Promise.all([
        fetch(API + '/ventas/presupuestos?' + params, { headers: headers() }).then(r => r.json()),
        fetch(API + '/ventas/presupuestos/stats', { headers: headers() }).then(r => r.json()).catch(() => ({})),
      ]);
      setData(Array.isArray(dr.data) ? dr.data : []);
      setPagination(dr.pagination || { page: 1, total: 0, pages: 0 });
      setStats(sr);
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, estadoFilter]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const kpis = [
    { label: 'Total', value: pagination.total, icon: FileText, color: 'text-blue-400' },
    { label: 'Enviados', value: stats.enviados || 0, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Aceptados', value: stats.aceptados || 0, icon: CheckCircle, color: 'text-green-400' },
    { label: 'Importe total', value: fmt(stats.importeTotal || 0), icon: TrendingUp, color: 'text-purple-400', isText: true },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      {/* Lista principal */}
      <div className={"flex-1 overflow-y-auto p-6 transition-all " + (selectedId ? 'mr-0' : '')}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-400"/>Presupuestos
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} presupuestos</p>
          </div>
          <button onClick={() => navigate('/ventas/nuevo/presupuesto')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Nuevo presupuesto
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{k.label}</span>
                <k.icon className={"w-5 h-5 " + k.color}/>
              </div>
              <div className={"font-bold " + (k.isText ? 'text-white text-lg' : 'text-white text-2xl')}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                placeholder="Buscar cliente o numero..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
            </div>
            <select className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>Cargando...
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p>No hay presupuestos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700">
                  {['Numero','Cliente','Fecha','Validez','Total','Estado',''].map(h => (
                    <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide">{h}</th>
                  ))}
                </tr></thead>
                <tbody>{data.map(p => (
                  <tr key={p.id} onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (p.id === selectedId ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : '')}>
                    <td className="px-4 py-3 text-sm font-mono text-blue-400 font-medium">{p.numeroCompleto || p.numero}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-medium">{p.cliente?.nombre || p.nombreCliente || '-'}</div>
                      {p.cifNif && <div className="text-xs text-slate-500">{p.cifNif}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(p.fecha || p.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.fechaValidez ? fmtDate(p.fechaValidez) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(p.total)}</td>
                    <td className="px-4 py-3">
                      <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[p.estado]?.color || 'bg-slate-600 text-slate-300')}>
                        {ESTADO[p.estado]?.label || p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ChevronRight className={"w-4 h-4 transition-transform " + (p.id===selectedId ? 'rotate-90 text-blue-400' : 'text-slate-500 group-hover:text-slate-300')}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-700">
              <span className="text-slate-400 text-sm">Pagina {pagination.page} de {pagination.pages} · {pagination.total} resultados</span>
              <div className="flex gap-2">
                <button onClick={() => cargar(pagination.page-1)} disabled={pagination.page<=1} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Anterior</button>
                <button onClick={() => cargar(pagination.page+1)} disabled={pagination.page>=pagination.pages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Panel detalle slide-in */}
      {selectedId && (
        <div className="w-96 shrink-0 border-l border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
          <PanelDetalle id={selectedId} onClose={() => setSelectedId(null)} onRefresh={() => cargar(pagination.page)} />
        </div>
      )}
    </div>
  );
}
