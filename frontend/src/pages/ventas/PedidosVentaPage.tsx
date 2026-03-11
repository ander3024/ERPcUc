import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, ShoppingBag, TrendingUp, Clock, Truck, ChevronRight, X, Edit2, Trash2, ArrowRight, AlertTriangle, FileText, Download, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const ESTADO: Record<string, { label: string; color: string }> = {
  PENDIENTE:             { label: 'Pendiente',      color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  EN_PROCESO:            { label: 'En proceso',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  PARCIALMENTE_SERVIDO:  { label: 'Parc. servido',  color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  SERVIDO:               { label: 'Servido',        color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  FACTURADO:             { label: 'Facturado',      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  CANCELADO:             { label: 'Cancelado',      color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const TIMELINE_STEPS = [
  { key: 'PENDIENTE', label: 'Pendiente', color: 'bg-yellow-500' },
  { key: 'EN_PROCESO', label: 'En proceso', color: 'bg-blue-500' },
  { key: 'PARCIALMENTE_SERVIDO', label: 'Parc. servido', color: 'bg-orange-500' },
  { key: 'SERVIDO', label: 'Servido', color: 'bg-green-500' },
  { key: 'FACTURADO', label: 'Facturado', color: 'bg-purple-500' },
];

function TimelineProgress({ estado, lineas }: { estado: string; lineas: any[] }) {
  const stepIndex = TIMELINE_STEPS.findIndex(s => s.key === estado);
  const totalCantidad = lineas.reduce((s: number, l: any) => s + (Number(l.cantidad) || 0), 0);
  const totalServida = lineas.reduce((s: number, l: any) => s + (Number(l.cantidadServida) || 0), 0);
  const pct = totalCantidad > 0 ? Math.round((totalServida / totalCantidad) * 100) : 0;
  const isCancelado = estado === 'CANCELADO';

  if (isCancelado) return (
    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
      <div className="text-xs text-red-400 font-medium uppercase tracking-wide mb-1">Pedido cancelado</div>
    </div>
  );

  return (
    <div className="bg-slate-700/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Progreso del pedido</div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{pct}%</span>
          <span className="text-xs text-slate-500">servido</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={"h-full rounded-full transition-all duration-500 " + (pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-emerald-500' : 'bg-slate-600')}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>

      {/* Timeline steps */}
      <div className="flex items-center justify-between relative">
        <div className="absolute top-3 left-4 right-4 h-0.5 bg-slate-600" />
        <div
          className="absolute top-3 left-4 h-0.5 bg-emerald-500 transition-all duration-500"
          style={{ width: stepIndex >= 0 ? `${(stepIndex / (TIMELINE_STEPS.length - 1)) * 100}%` : '0%' }}
        />
        {TIMELINE_STEPS.map((step, i) => {
          const isActive = i <= stepIndex;
          const isCurrent = step.key === estado;
          return (
            <div key={step.key} className="flex flex-col items-center relative z-10" style={{ width: '20%' }}>
              <div className={
                "w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all " +
                (isCurrent ? step.color + ' border-transparent text-white shadow-lg shadow-emerald-500/20' :
                 isActive ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                 'bg-slate-800 border-slate-600 text-slate-500')
              }>
                {i + 1}
              </div>
              <span className={"text-center mt-1.5 leading-tight " + (isCurrent ? 'text-white text-[10px] font-semibold' : isActive ? 'text-emerald-400 text-[10px]' : 'text-slate-500 text-[10px]')}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Per-line summary */}
      {totalCantidad > 0 && (
        <div className="text-xs text-slate-500 pt-1 border-t border-slate-700">
          {totalServida} / {totalCantidad} unidades servidas
        </div>
      )}
    </div>
  );
}

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
      const d = await fetch(API + '/ventas/pedidos/' + id, { headers: headers() }).then(r => r.json());
      setDoc(d);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  const cambiarEstado = async (s: string) => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/pedidos/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify({ estado: s }) });
      setMsg({type:'ok', text:'Estado: ' + ESTADO[s]?.label}); cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({type:'error', text: e.message}); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/pedidos/' + id, { method: 'DELETE', headers: headers() });
      onRefresh(); onClose();
    } catch (e: any) { setMsg({type:'error', text: e.message}); setSaving(false); }
  };

  const convertir = async (tipo: 'albaran' | 'factura') => {
    setSaving(true);
    try {
      const endpoint = tipo === 'albaran' ? 'convertir-albaran' : 'convertir-factura';
      const r = await fetch(API + '/ventas/pedidos/' + id + '/' + endpoint, { method: 'POST', headers: headers() });
      if (!r.ok) throw new Error(await r.text());
      const nuevo = await r.json();
      setMsg({type:'ok', text:'Convertido: ' + (nuevo.numeroCompleto || nuevo.numero || '')});
      cargar(); onRefresh(); setTimeout(() => setMsg(null), 4000);
    } catch (e: any) { setMsg({type:'error', text: e.message}); }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-5 border-b border-slate-700 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white font-mono">{doc.numeroCompleto || doc.numero}</span>
            <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[doc.estado]?.color || '')}>{ESTADO[doc.estado]?.label}</span>
          </div>
          <div className="text-sm text-slate-400">{doc.cliente?.nombre || doc.nombreCliente}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5"/></button>
      </div>

      {msg && <div className={"mx-5 mt-3 px-3 py-2 rounded-lg text-sm font-medium " + (msg.type==='ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{msg.text}</div>}

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Timeline visual */}
        <TimelineProgress estado={doc.estado} lineas={doc.lineas || []} />

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Fecha pedido</div>
            <div className="text-sm text-white">{fmtDate(doc.fecha)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Forma de pago</div>
            <div className="text-sm text-white">{doc.formaPago?.nombre || '-'}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">CIF/NIF</div>
            <div className="text-sm text-white">{doc.cliente?.cifNif || doc.cifNif || '-'}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 mb-1">Fecha entrega</div>
            <div className="text-sm text-white">{fmtDate(doc.fechaEntrega)}</div>
          </div>
        </div>

        {/* Estado - cambio rapido */}
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Cambiar estado</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESTADO).map(([k, v]) => (
              <button key={k} onClick={() => cambiarEstado(k)} disabled={saving || doc.estado === k}
                className={"text-xs px-3 py-1.5 rounded-full border font-medium transition-all " + (doc.estado === k ? v.color + ' opacity-50' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white')}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {doc.lineas?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Lineas ({doc.lineas.length})</div>
            <div className="space-y-2">
              {doc.lineas.map((l: any, i: number) => {
                const servPct = l.cantidad > 0 ? Math.round(((l.cantidadServida || 0) / l.cantidad) * 100) : 0;
                return (
                  <div key={l.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between gap-2">
                      <div className="text-sm text-white flex-1 min-w-0 truncate">{l.descripcion || 'Linea ' + (i+1)}</div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-white">{fmt(l.totalLinea)}</div>
                        <div className="text-xs text-slate-500">{l.cantidad} x {fmt(l.precioUnitario)}</div>
                      </div>
                    </div>
                    {/* Served progress per line */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                        <div className={"h-full rounded-full transition-all " + (servPct >= 100 ? 'bg-green-500' : servPct > 0 ? 'bg-emerald-500' : 'bg-slate-600')}
                          style={{ width: `${Math.min(100, servPct)}%` }} />
                      </div>
                      <span className={"text-[10px] font-medium whitespace-nowrap " + (servPct >= 100 ? 'text-green-400' : servPct > 0 ? 'text-emerald-400' : 'text-slate-500')}>
                        {l.cantidadServida || 0}/{l.cantidad} ({servPct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
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

        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Observaciones</div>
          <div className="text-sm text-slate-300 bg-slate-700/50 rounded-lg p-3 min-h-10">{doc.observaciones || '-'}</div>
        </div>
      </div>

      <div className="border-t border-slate-700 p-4 shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => convertir('albaran')} disabled={saving || doc.estado === 'CANCELADO'}
            className="flex items-center justify-center gap-1.5 bg-cyan-600/80 hover:bg-cyan-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            <Truck className="w-3.5 h-3.5"/>Crear albaran
          </button>
          <button onClick={() => convertir('factura')} disabled={saving || doc.estado === 'CANCELADO'}
            className="flex items-center justify-center gap-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
            <ArrowRight className="w-3.5 h-3.5"/>Crear factura
          </button>
        </div>

        {/* Editar pedido - reglas por estado */}
        {(doc.estado === 'PENDIENTE' || doc.estado === 'EN_PROCESO') ? (
          <div className="flex gap-2">
            <button onClick={() => navigate('/ventas/nuevo/pedido?edit=' + id)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Edit2 className="w-4 h-4"/>Editar pedido
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">
                <Trash2 className="w-4 h-4"/>
              </button>
            ) : (
              <button onClick={eliminar} disabled={saving} className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
                <AlertTriangle className="w-4 h-4"/>Confirmar
              </button>
            )}
          </div>
        ) : (doc.estado === 'PARCIALMENTE_SERVIDO' || doc.estado === 'SERVIDO' || doc.estado === 'FACTURADO') ? (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
            <span>Este pedido ya tiene entregas o esta facturado y no se puede editar.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PedidosVentaPage() {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
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
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkEstado, setBulkEstado] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const navigate = useNavigate();

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search });
      if (estadoFilter) params.set('estado', estadoFilter);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const [dr, sr] = await Promise.all([
        fetch(API + '/ventas/pedidos?' + params, { headers: headers() }).then(r => r.json()),
        fetch(API + '/ventas/pedidos/stats', { headers: headers() }).then(r => r.json()).catch(() => ({})),
      ]);
      setData(Array.isArray(dr.data) ? dr.data : []);
      setPagination(dr.pagination || { page: 1, total: 0, pages: 0 });
      setStats(sr);
      setCheckedIds(new Set());
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, estadoFilter, desde, hasta]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'fecha' ? 'desc' : 'asc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const va = a[sortBy], vb = b[sortBy];
    if (typeof va === 'number') return (va - vb) * dir;
    if (sortBy === 'fecha' || sortBy === 'fechaEntrega') return (new Date(va || 0).getTime() - new Date(vb || 0).getTime()) * dir;
    return String(va || '').localeCompare(String(vb || '')) * dir;
  });

  const exportCSV = () => {
    const rows = data.map(f => [
      f.numero || '', f.cliente?.nombre || '', fmtDate(f.fecha),
      fmtDate(f.fechaEntrega), f.total?.toFixed(2) || '0', f.estado || '',
    ]);
    const csv = ['Numero;Cliente;Fecha;Entrega;Total;Estado', ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'pedidos_venta.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  // Bulk selection
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allChecked = sortedData.length > 0 && sortedData.every(f => checkedIds.has(f.id));
  const someChecked = sortedData.some(f => checkedIds.has(f.id));
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(sortedData.map(f => f.id)));
  };

  const bulkCambiarEstado = async () => {
    if (!bulkEstado || checkedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch(API + '/ventas/pedidos/bulk/estado', { method: 'PUT', headers: headers(), body: JSON.stringify({ ids: Array.from(checkedIds), estado: bulkEstado }) });
      setBulkEstado('');
      cargar(pagination.page);
    } catch {} finally { setBulkLoading(false); }
  };

  const kpis = [
    { label: 'Total pedidos', value: pagination.total, icon: ShoppingBag, color: 'text-emerald-400' },
    { label: 'Pendientes', value: stats.pendientes || 0, icon: Clock, color: 'text-yellow-400' },
    { label: 'En proceso', value: stats.enProceso || 0, icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Importe total', value: fmt(stats.importeTotal || 0), icon: Truck, color: 'text-purple-400', isText: true },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-emerald-400"/>Pedidos de venta
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} pedidos</p>
          </div>
          <button onClick={() => navigate('/ventas/nuevo/pedido')}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4"/>Nuevo pedido
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{k.label}</span>
                <k.icon className={"w-5 h-5 " + k.color}/>
              </div>
              <div className={"font-bold " + (k.isText ? 'text-white text-lg' : 'text-white text-2xl')}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                placeholder="Buscar cliente o numero..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
            </div>
            <select className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500">Desde</label>
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"/>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-slate-500">Hasta</label>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"/>
            </div>
            <button onClick={exportCSV} title="Exportar CSV" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><Download className="w-4 h-4"/></button>
            <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
          </div>

          {/* Bulk actions toolbar */}
          {checkedIds.size > 0 && (
            <div className="px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-emerald-300">{checkedIds.size} seleccionados</span>
              <div className="h-4 w-px bg-slate-600" />
              <div className="flex items-center gap-2">
                <select value={bulkEstado} onChange={e => setBulkEstado(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">Cambiar estado...</option>
                  {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {bulkEstado && (
                  <button onClick={bulkCambiarEstado} disabled={bulkLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-xs font-medium">
                    Aplicar
                  </button>
                )}
              </div>
              <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-xs text-slate-400 hover:text-white">
                Deseleccionar
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-400"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>Cargando...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400"><ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay pedidos</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700">
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-white">
                      {allChecked ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : someChecked ? <MinusSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {[
                    { label: 'Numero', col: 'numero' },
                    { label: 'Cliente', col: 'cliente' },
                    { label: 'Fecha', col: 'fecha' },
                    { label: 'F. entrega', col: 'fechaEntrega' },
                    { label: 'Base', col: 'baseImponible' },
                    { label: 'Total', col: 'total' },
                    { label: 'Estado', col: 'estado' },
                    { label: '', col: '' },
                  ].map(h => (
                    <th key={h.label} className="text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide">
                      {h.col ? (
                        <button onClick={() => toggleSort(h.col)} className="flex items-center gap-1 hover:text-white transition-colors">
                          {h.label} <SortIcon col={h.col} />
                        </button>
                      ) : h.label}
                    </th>
                  ))}
                </tr></thead>
                <tbody>{sortedData.map(p => (
                  <tr key={p.id}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (checkedIds.has(p.id) ? 'bg-emerald-500/10' : p.id === selectedId ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : '')}>
                    <td className="px-3 py-3 w-10" onClick={e => { e.stopPropagation(); toggleCheck(p.id); }}>
                      {checkedIds.has(p.id) ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-emerald-400 font-medium" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>{p.numeroCompleto || p.numero}</td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>
                      <div className="text-sm text-white font-medium">{p.cliente?.nombre || p.nombreCliente || '-'}</div>
                      {p.cifNif && <div className="text-xs text-slate-500">{p.cifNif}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>{fmtDate(p.fecha || p.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>{p.fechaEntrega ? fmtDate(p.fechaEntrega) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>{fmt(p.baseImponible)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>{fmt(p.total)}</td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}>
                      <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[p.estado]?.color || 'bg-slate-600 text-slate-300')}>{ESTADO[p.estado]?.label || p.estado}</span>
                    </td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(p.id === selectedId ? null : p.id)}><ChevronRight className={"w-4 h-4 transition-transform " + (p.id===selectedId ? 'rotate-90 text-emerald-400' : 'text-slate-500 group-hover:text-slate-300')}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-700">
              <span className="text-slate-400 text-sm">Pagina {pagination.page} de {pagination.pages} · {pagination.total} resultados</span>
              <div className="flex items-center gap-1">
                <button onClick={() => cargar(1)} disabled={pagination.page <= 1}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">«</button>
                <button onClick={() => cargar(pagination.page - 1)} disabled={pagination.page <= 1}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">‹</button>
                {(() => {
                  const pages: number[] = [];
                  const current = pagination.page;
                  const total = pagination.pages;
                  let start = Math.max(1, current - 2);
                  let end = Math.min(total, current + 2);
                  if (current <= 3) end = Math.min(total, 5);
                  if (current >= total - 2) start = Math.max(1, total - 4);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map(p => (
                    <button key={p} onClick={() => cargar(p)}
                      className={"px-3 py-1.5 text-sm rounded-lg font-medium transition-colors " +
                        (p === current ? 'bg-emerald-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300')}>
                      {p}
                    </button>
                  ));
                })()}
                <button onClick={() => cargar(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">›</button>
                <button onClick={() => cargar(pagination.pages)} disabled={pagination.page >= pagination.pages}
                  className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">»</button>
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
