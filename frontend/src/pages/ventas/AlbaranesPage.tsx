import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Package, Truck, CheckCircle, Clock, ChevronRight, X, Trash2, ArrowRight, AlertTriangle, Plus, Edit2, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const ESTADO: Record<string, { label: string; color: string }> = {
  PENDIENTE:  { label: 'Pendiente',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  FACTURADO:  { label: 'Facturado',  color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
};

function PanelDetalle({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{type:string; text:string} | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const d = await fetch(API + '/ventas/albaranes/' + id, { headers: headers() }).then(r => r.json());
      setDoc(d);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  const convertirFactura = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/albaranes/' + id + '/convertir-factura', { method: 'POST', headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      const nuevo = await r.json();
      setMsg({type:'ok', text:'Factura creada: ' + (nuevo.numeroCompleto || '')});
      cargar(); onRefresh(); setTimeout(() => setMsg(null), 4000);
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/albaranes/' + id, { method: 'DELETE', headers: headers() });
      onRefresh(); onClose();
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-5 border-b border-slate-700 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white font-mono">{doc.numeroCompleto || doc.numero}</span>
            <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[doc.estado]?.color || 'bg-slate-600 text-slate-300')}>{ESTADO[doc.estado]?.label || doc.estado}</span>
          </div>
          <div className="text-sm text-slate-400">{doc.cliente?.nombre || doc.nombreCliente}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5"/></button>
      </div>

      {msg && <div className={"mx-5 mt-3 px-3 py-2 rounded-lg text-sm font-medium " + (msg.type==='ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{msg.text}</div>}

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Fecha</div><div className="text-sm text-white">{fmtDate(doc.fecha)}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">CIF/NIF</div><div className="text-sm text-white">{doc.cliente?.cifNif || doc.cifNif || '-'}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Bultos</div><div className="text-sm text-white">{doc.bultos || '-'}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Peso total</div><div className="text-sm text-white">{doc.pesoTotal ? doc.pesoTotal + ' kg' : '-'}</div></div>
        </div>

        {doc.lineas?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Lineas ({doc.lineas.length})</div>
            <div className="space-y-2">
              {doc.lineas.map((l: any, i: number) => (
                <div key={l.id} className="bg-slate-700/50 rounded-lg p-3 flex justify-between gap-2">
                  <div className="text-sm text-white flex-1 min-w-0 truncate">{l.descripcion || 'Linea ' + (i+1)}</div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-white">{fmt(l.totalLinea)}</div>
                    <div className="text-xs text-slate-500">{l.cantidad} x {fmt(l.precioUnitario)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-400">Base</span><span className="text-white">{fmt(doc.baseImponible)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">IVA</span><span className="text-white">{fmt(doc.totalIva)}</span></div>
          <div className="flex justify-between text-base font-bold border-t border-slate-600 pt-2">
            <span className="text-white">TOTAL</span><span className="text-white">{fmt(doc.total)}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700 p-4 shrink-0 space-y-2">
        {doc.estado !== 'FACTURADO' && (
          <button onClick={convertirFactura} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <ArrowRight className="w-4 h-4"/>Crear factura
          </button>
        )}
        {/* Editar albaran - reglas por estado */}
        {doc.estado === 'PENDIENTE' ? (
          <button
            onClick={() => navigate('/ventas/nuevo/albaran?edit=' + id)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Edit2 className="w-4 h-4"/>Editar albaran
          </button>
        ) : doc.estado === 'FACTURADO' ? (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
            <span>Este albaran ya esta facturado y no se puede editar.</span>
          </div>
        ) : null}

        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">
            <Trash2 className="w-4 h-4"/>Eliminar
          </button>
        ) : (
          <button onClick={eliminar} disabled={saving} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
            <AlertTriangle className="w-4 h-4"/>Confirmar borrado
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlbaranesPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sortBy, setSortBy] = useState('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search });
      if (estadoFilter) params.set('estado', estadoFilter);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const dr = await fetch(API + '/ventas/albaranes?' + params, { headers: headers() }).then(r => r.json());
      setData(Array.isArray(dr.data) ? dr.data : []);
      setPagination(dr.pagination || { page: 1, total: 0, pages: 0 });
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, estadoFilter, desde, hasta]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    let va: any, vb: any;
    switch (sortBy) {
      case 'numero': va = a.numeroCompleto || a.numero || ''; vb = b.numeroCompleto || b.numero || ''; break;
      case 'cliente': va = a.cliente?.nombre || a.nombreCliente || ''; vb = b.cliente?.nombre || b.nombreCliente || ''; break;
      case 'fecha': va = a.fecha || a.createdAt || ''; vb = b.fecha || b.createdAt || ''; break;
      case 'bultos': va = a.bultos || 0; vb = b.bultos || 0; break;
      case 'total': va = a.total || 0; vb = b.total || 0; break;
      case 'estado': va = a.estado || ''; vb = b.estado || ''; break;
      default: va = ''; vb = '';
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const exportCSV = () => {
    const rows = [['Numero', 'Cliente', 'Fecha', 'Bultos', 'Total', 'Estado']];
    sortedData.forEach(a => {
      rows.push([
        a.numeroCompleto || a.numero || '',
        a.cliente?.nombre || a.nombreCliente || '',
        fmtDate(a.fecha || a.createdAt),
        String(a.bultos || ''),
        String(a.total || 0),
        ESTADO[a.estado]?.label || a.estado || ''
      ]);
    });
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'albaranes.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const pendientes = data.filter(a => a.estado === 'PENDIENTE').length;
  const facturados = data.filter(a => a.estado === 'FACTURADO').length;
  const kpis = [
    { label: 'Total', value: pagination.total, icon: Package, color: 'text-cyan-400' },
    { label: 'Pendientes', value: pendientes, icon: Clock, color: 'text-yellow-400' },
    { label: 'Facturados', value: facturados, icon: CheckCircle, color: 'text-purple-400' },
    { label: 'En pagina', value: data.length, icon: Truck, color: 'text-slate-400' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/ventas/nuevo/albaran")}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Truck className="w-6 h-6 text-cyan-400"/>Albaranes de venta
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} albaranes</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{k.label}</span>
                <k.icon className={"w-5 h-5 " + k.color}/>
              </div>
              <div className="text-2xl font-bold text-white">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                placeholder="Buscar..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
            </div>
            <select className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" value={desde} onChange={e => setDesde(e.target.value)} title="Desde"/>
            <input type="date" className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500" value={hasta} onChange={e => setHasta(e.target.value)} title="Hasta"/>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg text-sm" title="Exportar CSV"><Download className="w-4 h-4"/>CSV</button>
            <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
          </div>
          {loading ? (
            <div className="p-12 text-center text-slate-400"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>Cargando...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400"><Package className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay albaranes</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700">
                  {[{label:'Numero',col:'numero'},{label:'Cliente',col:'cliente'},{label:'Fecha',col:'fecha'},{label:'Bultos',col:'bultos'},{label:'Total',col:'total'},{label:'Estado',col:'estado'}].map(h => (
                    <th key={h.col} onClick={() => toggleSort(h.col)} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide cursor-pointer hover:text-white select-none">
                      <span className="inline-flex items-center gap-1">{h.label}<SortIcon col={h.col}/></span>
                    </th>
                  ))}
                  <th className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide"></th>
                </tr></thead>
                <tbody>{sortedData.map(a => (
                  <tr key={a.id} onClick={() => setSelectedId(a.id === selectedId ? null : a.id)}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (a.id === selectedId ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : '')}>
                    <td className="px-4 py-3 text-sm font-mono text-cyan-400 font-medium">{a.numeroCompleto || a.numero}</td>
                    <td className="px-4 py-3 text-sm text-white font-medium">{a.cliente?.nombre || a.nombreCliente || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(a.fecha || a.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{a.bultos || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(a.total)}</td>
                    <td className="px-4 py-3">
                      <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[a.estado]?.color || 'bg-slate-600 text-slate-300')}>{ESTADO[a.estado]?.label || a.estado || '-'}</span>
                    </td>
                    <td className="px-4 py-3"><ChevronRight className={"w-4 h-4 transition-transform " + (a.id===selectedId ? 'rotate-90 text-cyan-400' : 'text-slate-500 group-hover:text-slate-300')}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-700">
              <span className="text-slate-400 text-sm">Pagina {pagination.page} de {pagination.pages} ({pagination.total} registros)</span>
              <div className="flex gap-1">
                <button onClick={() => cargar(1)} disabled={pagination.page<=1} className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">&laquo;</button>
                <button onClick={() => cargar(pagination.page-1)} disabled={pagination.page<=1} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Anterior</button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pagination.pages || Math.abs(p - pagination.page) <= 2)
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && (p - (arr[i - 1] as number)) > 1) acc.push('...' + p);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map(p => typeof p === 'string' ? (
                    <span key={p} className="px-1.5 py-1.5 text-slate-500 text-sm">...</span>
                  ) : (
                    <button key={p} onClick={() => cargar(p)}
                      className={"px-3 py-1.5 text-sm rounded-lg " + (p === pagination.page ? 'bg-cyan-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white')}>
                      {p}
                    </button>
                  ))}
                <button onClick={() => cargar(pagination.page+1)} disabled={pagination.page>=pagination.pages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Siguiente</button>
                <button onClick={() => cargar(pagination.pages)} disabled={pagination.page>=pagination.pages} className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">&raquo;</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="w-96 shrink-0 border-l border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
          <PanelDetalle id={selectedId} onClose={() => setSelectedId(null)} onRefresh={() => cargar(pagination.page)} />
        </div>
      )}
    </div>
  );
}