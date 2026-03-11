import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, CreditCard, Euro, CheckCircle, ChevronRight, TrendingDown, X, Trash2, Save, AlertTriangle, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const METODO: Record<string, string> = {
  Transferencia: 'Transferencia',
  Efectivo: 'Efectivo',
  Cheque: 'Cheque',
  Domiciliacion: 'Domiciliacion',
  Tarjeta: 'Tarjeta',
  Pagare: 'Pagare',
  Compensacion: 'Compensacion',
};

const ESTADO_COBRO: Record<string, { label: string; color: string }> = {
  PAGADO:   { label: 'Pagado',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  EMITIDO:  { label: 'Emitido',  color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  DEVUELTO: { label: 'Devuelto', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function PanelDetalleCobro({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const [cobro, setCobro] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null);
  const [form, setForm] = useState({ importe: '', fecha: '', formaPago: '', referencia: '', observaciones: '' });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/ventas/cobros/' + id, { headers: hdrs() });
      if (!r.ok) throw new Error('Error');
      const d = await r.json();
      setCobro(d);
      setForm({
        importe: String(d.importe || ''),
        fecha: d.fecha ? d.fecha.split('T')[0] : '',
        formaPago: d.formaPago || 'Transferencia',
        referencia: d.referencia || '',
        observaciones: d.observaciones || '',
      });
    } catch { setCobro(null); } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  const guardar = async () => {
    setSaving(true);
    try {
      const body = {
        importe: parseFloat(form.importe),
        fecha: form.fecha,
        formaPago: form.formaPago,
        referencia: form.referencia || null,
        observaciones: form.observaciones || null,
      };
      const r = await fetch(API + '/ventas/cobros/' + id, { method: 'PUT', headers: hdrs(), body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Error'); }
      setMsg({ type: 'ok', text: 'Cobro actualizado' }); setEditing(false); cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  const cambiarEstado = async (estado: string) => {
    setSaving(true);
    try {
      const r = await fetch(API + '/ventas/cobros/' + id, { method: 'PUT', headers: hdrs(), body: JSON.stringify({ estado }) });
      if (!r.ok) throw new Error('Error');
      setMsg({ type: 'ok', text: 'Estado: ' + (ESTADO_COBRO[estado]?.label || estado) }); cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/cobros/' + id, { method: 'DELETE', headers: hdrs() });
      onRefresh(); onClose();
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!cobro) return <div className="p-5 text-slate-400 text-center">No se pudo cargar el cobro</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-5 border-b border-slate-700 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white">{fmt(cobro.importe)}</span>
            <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO_COBRO[cobro.estado]?.color || 'bg-slate-600 text-slate-300')}>
              {ESTADO_COBRO[cobro.estado]?.label || cobro.estado}
            </span>
          </div>
          <div className="text-sm text-slate-400">{cobro.factura?.cliente?.nombre || cobro.cliente?.nombre || '-'}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
      </div>

      {msg && <div className={"mx-5 mt-3 px-3 py-2 rounded-lg text-sm font-medium " + (msg.type === 'ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{msg.text}</div>}

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Info basica */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Fecha</div><div className="text-sm text-white">{fmtDate(cobro.fecha)}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Factura</div><div className="text-sm text-white font-mono">{cobro.factura?.numeroCompleto || '-'}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Forma de pago</div><div className="text-sm text-white">{METODO[cobro.formaPago] || cobro.formaPago || '-'}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Referencia</div><div className="text-sm text-white font-mono">{cobro.referencia || '-'}</div></div>
        </div>

        {/* Info factura */}
        {cobro.factura && (
          <div className="bg-slate-700/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Total factura</span><span className="text-white font-semibold">{fmt(cobro.factura.total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">Cobrado</span><span className="text-green-400 font-semibold">{fmt(cobro.factura.totalPagado || 0)}</span></div>
            {Number(cobro.factura.total) - Number(cobro.factura.totalPagado || 0) > 0.01 && (
              <div className="flex justify-between text-sm pt-2 border-t border-slate-600"><span className="text-orange-400 font-medium">Pendiente</span><span className="text-orange-400 font-bold">{fmt(Number(cobro.factura.total) - Number(cobro.factura.totalPagado || 0))}</span></div>
            )}
          </div>
        )}

        {cobro.observaciones && (
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Observaciones</div><div className="text-sm text-white">{cobro.observaciones}</div></div>
        )}

        {/* Cambiar estado */}
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Estado del cobro</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESTADO_COBRO).map(([k, v]) => (
              <button key={k} onClick={() => cambiarEstado(k)} disabled={saving || cobro.estado === k}
                className={"text-xs px-3 py-1.5 rounded-full border font-medium transition-all " + (cobro.estado === k ? v.color + ' opacity-50' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white')}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Formulario edicion */}
        {editing && (
          <div className="bg-slate-700/50 rounded-xl p-4 space-y-3 border border-teal-500/30">
            <div className="text-xs font-medium text-teal-400 uppercase tracking-wide">Editar cobro</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Importe</label>
                <input type="number" step="0.01" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })}
                  className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })}
                  className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-teal-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Forma de pago</label>
              <select value={form.formaPago} onChange={e => setForm({ ...form, formaPago: e.target.value })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none">
                {Object.entries(METODO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referencia</label>
              <input type="text" value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
                placeholder="N. transferencia, cheque..." />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Observaciones</label>
              <textarea value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} rows={2}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none resize-none"
                placeholder="Notas internas..." />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancelar</button>
              <button onClick={guardar} disabled={saving || !form.importe}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded text-sm font-medium">
                <Save className="w-4 h-4" />Guardar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-700 p-4 shrink-0 space-y-2">
        {/* Editar cobro - reglas por estado */}
        {!editing && cobro.estado === 'EMITIDO' && (
          <button onClick={() => setEditing(true)}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Save className="w-4 h-4" />Editar cobro
          </button>
        )}
        {!editing && cobro.estado === 'PAGADO' && (
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
            <span>Este cobro ya esta pagado. Cambia el estado a Emitido para poder editarlo.</span>
          </div>
        )}
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">
            <Trash2 className="w-4 h-4" />Eliminar cobro
          </button>
        ) : (
          <button onClick={eliminar} disabled={saving} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
            <AlertTriangle className="w-4 h-4" />Confirmar borrado
          </button>
        )}
      </div>
    </div>
  );
}

export default function CobrosPage() {
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search });
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const [dr, sr] = await Promise.all([
        fetch(API + '/ventas/cobros?' + params, { headers: hdrs() }).then(r => r.json()),
        fetch(API + '/ventas/cobros/stats', { headers: hdrs() }).then(r => r.json()).catch(() => ({})),
      ]);
      setData(Array.isArray(dr.data) ? dr.data : (Array.isArray(dr) ? dr : []));
      setPagination(dr.pagination || { page: 1, total: dr.length || 0, pages: 1 });
      setStats(sr);
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, desde, hasta]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const totalCobrado = data.reduce((s, c) => s + (c.importe || 0), 0);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortBy) return 0;
    const dir = sortDir === 'asc' ? 1 : -1;
    const valA = sortBy === 'cliente' ? (a.cliente?.nombre || a.factura?.cliente?.nombre || '')
      : sortBy === 'factura' ? (a.factura?.numeroCompleto || '')
      : sortBy === 'metodo' ? (a.formaPago || '')
      : sortBy === 'importe' ? (a.importe || 0)
      : sortBy === 'estado' ? (a.estado || '')
      : (a.fecha || a.createdAt || '');
    const valB = sortBy === 'cliente' ? (b.cliente?.nombre || b.factura?.cliente?.nombre || '')
      : sortBy === 'factura' ? (b.factura?.numeroCompleto || '')
      : sortBy === 'metodo' ? (b.formaPago || '')
      : sortBy === 'importe' ? (b.importe || 0)
      : sortBy === 'estado' ? (b.estado || '')
      : (b.fecha || b.createdAt || '');
    if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * dir;
    return String(valA).localeCompare(String(valB), 'es') * dir;
  });

  const exportCSV = () => {
    const rows = [['Fecha', 'Cliente', 'Factura', 'Metodo', 'Importe', 'Estado'].join(';')];
    sortedData.forEach(c => rows.push([
      fmtDate(c.fecha || c.createdAt),
      c.cliente?.nombre || c.factura?.cliente?.nombre || '',
      c.factura?.numeroCompleto || '',
      METODO[c.formaPago] || c.formaPago || '',
      String(c.importe || 0).replace('.', ','),
      ESTADO_COBRO[c.estado]?.label || c.estado || '',
    ].join(';')));
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cobros.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => sortBy === col
    ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />)
    : <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;

  const kpis = [
    { label: 'Total cobros', value: pagination.total, icon: CreditCard, color: 'text-teal-400' },
    { label: 'Importe cobrado', value: fmt(stats.totalCobrado || totalCobrado), icon: Euro, color: 'text-green-400', isText: true },
    { label: 'Este mes', value: fmt(stats.totalMes || 0), icon: TrendingDown, color: 'text-blue-400', isText: true },
    { label: 'Num. facturas cobradas', value: stats.facturasCobradas || '-', icon: CheckCircle, color: 'text-purple-400' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-teal-400" />Cobros
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} cobros registrados</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{k.label}</span>
                <k.icon className={"w-5 h-5 " + k.color} />
              </div>
              <div className={"font-bold " + (k.isText ? 'text-white text-lg' : 'text-white text-2xl')}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                placeholder="Buscar cliente o factura..." value={searchInput} onChange={e => setSearchInput(e.target.value)} />
            </div>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              title="Desde" />
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-teal-500"
              title="Hasta" />
            <button onClick={exportCSV} title="Exportar CSV" className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />Cargando...
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No hay cobros registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700">
                  {[
                    { key: 'fecha', label: 'Fecha' },
                    { key: 'cliente', label: 'Cliente' },
                    { key: 'factura', label: 'Factura' },
                    { key: 'metodo', label: 'Metodo' },
                    { key: '', label: 'Referencia' },
                    { key: 'importe', label: 'Importe' },
                    { key: 'estado', label: 'Estado' },
                    { key: '', label: '' },
                  ].map((h, i) => (
                    <th key={i} className={"text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide" + (h.key ? ' cursor-pointer select-none hover:text-white' : '')}
                      onClick={() => h.key && toggleSort(h.key)}>
                      {h.label}{h.key && <SortIcon col={h.key} />}
                    </th>
                  ))}
                </tr></thead>
                <tbody>{sortedData.map(c => (
                  <tr key={c.id} onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (c.id === selectedId ? 'bg-teal-500/10 border-l-2 border-l-teal-500' : '')}>
                    <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(c.fecha || c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-white font-medium">{c.cliente?.nombre || c.factura?.cliente?.nombre || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-indigo-400">{c.factura?.numeroCompleto || c.facturaId || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-1 rounded-full border bg-teal-500/20 text-teal-300 border-teal-500/30 font-medium">
                        {METODO[c.formaPago] || c.formaPago || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">{c.referencia || '-'}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-400">{fmt(c.importe)}</td>
                    <td className="px-4 py-3">
                      <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO_COBRO[c.estado]?.color || 'bg-slate-600 text-slate-300')}>
                        {ESTADO_COBRO[c.estado]?.label || c.estado || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ChevronRight className={"w-4 h-4 transition-transform " + (c.id === selectedId ? 'rotate-90 text-teal-400' : 'text-slate-500 group-hover:text-slate-300')} /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {pagination.pages > 1 && (
            <div className="p-4 flex items-center justify-between border-t border-slate-700">
              <span className="text-slate-400 text-sm">Pagina {pagination.page} de {pagination.pages} · {pagination.total} resultados</span>
              <div className="flex items-center gap-1">
                <button onClick={() => cargar(1)} disabled={pagination.page <= 1} className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">{'<<'}</button>
                <button onClick={() => cargar(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Anterior</button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  let p = pagination.page - 2 + i;
                  if (p < 1) p = i + 1;
                  if (p > pagination.pages) return null;
                  return (
                    <button key={p} onClick={() => cargar(p)}
                      className={"px-3 py-1.5 text-sm rounded-lg " + (p === pagination.page ? 'bg-teal-600 text-white font-bold' : 'bg-slate-700 hover:bg-slate-600 text-white')}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => cargar(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Siguiente</button>
                <button onClick={() => cargar(pagination.pages)} disabled={pagination.page >= pagination.pages} className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">{'>>'}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="w-96 shrink-0 border-l border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
          <PanelDetalleCobro id={selectedId} onClose={() => setSelectedId(null)} onRefresh={() => cargar(pagination.page)} />
        </div>
      )}
    </div>
  );
}
