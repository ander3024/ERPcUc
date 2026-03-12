import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import {
  Search, Plus, Package, RefreshCw, ChevronRight, AlertTriangle, X,
  FolderTree, ArrowUpDown, Download, Trash2, Edit2, Check, BarChart3, DollarSign,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const tabs = [
  { key: 'articulos', label: 'Articulos', icon: Package },
  { key: 'familias', label: 'Familias', icon: FolderTree },
  { key: 'movimientos', label: 'Movimientos', icon: ArrowUpDown },
  { key: 'valoracion', label: 'Valoración', icon: DollarSign },
] as const;

type Tab = typeof tabs[number]['key'];

export default function AlmacenPage() {
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'articulos';
  const setTab = (t: Tab) => setSp({ tab: t });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Almacen</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gestion de articulos, familias y stock</p>
        </div>
      </div>

      {/* Stats */}
      <StatsBar />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            )}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {tab === 'articulos' && <ArticulosTab />}
      {tab === 'familias' && <FamiliasTab />}
      {tab === 'movimientos' && <MovimientosTab />}
      {tab === 'valoracion' && <ValoracionTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Stats Bar
// ═══════════════════════════════════════════════
function StatsBar() {
  const { data: stats } = useQuery({
    queryKey: ['almacen-stats'],
    queryFn: () => api.get('/almacen/stats').then(r => r.data),
  });
  if (!stats) return null;
  const items = [
    { label: 'Total articulos', value: stats.totalArticulos, cls: 'text-white' },
    { label: 'Activos', value: stats.activos, cls: 'text-green-400' },
    { label: 'Stock bajo', value: stats.stockBajo, cls: stats.stockBajo > 0 ? 'text-amber-400' : 'text-slate-400' },
    { label: 'Sin stock', value: stats.sinStock, cls: stats.sinStock > 0 ? 'text-red-400' : 'text-slate-400' },
    { label: 'Familias', value: stats.familias, cls: 'text-blue-400' },
    { label: 'Mov. hoy', value: stats.movimientosHoy, cls: 'text-purple-400' },
  ];
  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(i => (
        <div key={i.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
          <p className={`text-lg font-bold ${i.cls}`}>{i.value}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{i.label}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Articulos Tab
// ═══════════════════════════════════════════════
function ArticulosTab() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimitVal] = useState(() => {
    const saved = localStorage.getItem('erp_page_limit');
    return saved ? parseInt(saved) : 20;
  });
  const setLimit = (v: number) => { setLimitVal(v); localStorage.setItem('erp_page_limit', String(v)); };
  const [familia, setFamilia] = useState('');
  const [filterBajoMinimos, setFilterBajoMinimos] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const emptyForm = {
    referencia: '', nombre: '', descripcion: '', precioCoste: '', precioVenta: '',
    tipoIva: 21, stockActual: 0, stockMinimo: 5, controlStock: true, familiaId: '',
    codigoBarras: '', unidadMedida: 'UND',
  };
  const [form, setForm] = useState<any>(emptyForm);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['articulos', debouncedSearch, familia, page, limit],
    queryFn: () => api.get('/almacen/articulos', {
      params: { search: debouncedSearch, familiaId: familia || undefined, page, limit },
    }).then(r => r.data),
  });

  const { data: familias } = useQuery({
    queryKey: ['familias-todas'],
    queryFn: () => api.get('/almacen/familias/todas').then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/almacen/articulos', d),
    onSuccess: (res) => {
      toast.success('Articulo creado');
      qc.invalidateQueries({ queryKey: ['articulos'] });
      qc.invalidateQueries({ queryKey: ['almacen-stats'] });
      setShowModal(false);
      setForm(emptyForm);
      navigate(`/almacen/articulos/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._artSt);
    (window as any)._artSt = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const handleExport = () => {
    api.get('/almacen/export-csv', { responseType: 'blob' }).then(r => {
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = 'articulos.csv'; a.click();
      URL.revokeObjectURL(url);
    }).catch(() => toast.error('Error exportando'));
  };

  const articulosRaw = data?.data || [];
  const articulos = filterBajoMinimos
    ? articulosRaw.filter((a: any) => a.stockActual < a.stockMinimo && a.stockMinimo > 0)
    : articulosRaw;
  const total = filterBajoMinimos ? articulos.length : (data?.total || 0);
  const totalPages = filterBajoMinimos ? 1 : (data?.totalPages || 1);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';

  return (
    <>
      <div className="flex gap-2 mb-1">
        <button onClick={() => { setFilterBajoMinimos(false); setPage(1); }}
          className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium transition-all', !filterBajoMinimos ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
          Todos
        </button>
        <button onClick={() => { setFilterBajoMinimos(true); setPage(1); }}
          className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium transition-all', filterBajoMinimos ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800')}>
          <span className="flex items-center gap-1"><AlertTriangle size={12} />Bajo mínimos</span>
        </button>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, referencia o codigo de barras..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        </div>
        <select value={familia} onChange={e => { setFamilia(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Todas las familias</option>
          {(familias || []).map((f: any) => <option key={f.id} value={f.id}>{f.nombre} ({f._count?.articulos || 0})</option>)}
        </select>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700" title="Exportar CSV">
          <Download size={15} />CSV
        </button>
        <button onClick={() => refetch()} className="p-2.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700">
          <RefreshCw size={15} />
        </button>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20">
          <Plus size={16} />Nuevo articulo
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Articulo', 'Ref.', 'Familia', 'P. Venta', 'P. Coste', 'Stock', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : articulos.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <Package size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No hay articulos{debouncedSearch ? ' con ese criterio' : ''}</p>
              </td></tr>
            ) : articulos.map((a: any) => {
              const stockBajo = a.controlStock && a.stockActual <= a.stockMinimo;
              const sinStock = a.controlStock && a.stockActual <= 0;
              return (
                <tr key={a.id} onClick={() => navigate(`/almacen/articulos/${a.id}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Package size={14} className="text-slate-500" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-white block">{a.nombre}</span>
                        {a.codigoBarras && <span className="text-[10px] text-slate-600 font-mono">{a.codigoBarras}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm font-mono text-slate-400">{a.referencia}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-500">{a.familia?.nombre || '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-white">{formatCurrency(a.precioVenta)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatCurrency(a.precioCoste)}</span></td>
                  <td className="px-4 py-3">
                    {a.controlStock ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {(stockBajo || sinStock) && <AlertTriangle size={13} className={sinStock ? 'text-red-400' : 'text-amber-400'} />}
                        <span className={clsx('text-sm font-medium', sinStock ? 'text-red-400' : stockBajo ? 'text-amber-400' : 'text-green-400')}>{a.stockActual}</span>
                        <span className="text-xs text-slate-600">/{a.stockMinimo}</span>
                        {a.stockActual < a.stockMinimo && a.stockMinimo > 0 && (
                          <span className="ml-1 text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">Bajo mínimo</span>
                        )}
                      </div>
                    ) : <span className="text-xs text-slate-600">Sin ctrl</span>}
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 ml-auto" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">Mostrando {Math.min((page - 1) * limit + 1, total)}-{Math.min(page * limit, total)} de {total} articulos</p>
            <select value={limit} onChange={e => { setLimit(parseInt(e.target.value)); setPage(1); }} className="bg-slate-800 border border-slate-700 text-slate-400 text-xs rounded-lg px-2 py-1">
              <option value={20}>20/pag</option>
              <option value={50}>50/pag</option>
              <option value={100}>100/pag</option>
            </select>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:hover:bg-slate-800">Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:hover:bg-slate-800">Siguiente</button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <h2 className="font-semibold text-white flex items-center gap-2"><Package size={18} className="text-blue-400" />Nuevo articulo</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="block text-xs text-slate-500 mb-1">Nombre *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} className={inp} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Referencia</label><input value={form.referencia} onChange={e => set('referencia', e.target.value)} className={inp} placeholder="Auto si vacio" /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Codigo de barras</label><input value={form.codigoBarras} onChange={e => set('codigoBarras', e.target.value)} className={inp} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Familia</label>
                  <select value={form.familiaId} onChange={e => set('familiaId', e.target.value)} className={inp}>
                    <option value="">Sin familia</option>
                    {(familias || []).map((f: any) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Unidad</label>
                  <select value={form.unidadMedida} onChange={e => set('unidadMedida', e.target.value)} className={inp}>
                    {['UND', 'KG', 'L', 'M', 'M2', 'M3', 'CAJA', 'PACK'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-500 mb-1">Precio compra</label><input type="number" step="0.01" value={form.precioCoste} onChange={e => set('precioCoste', e.target.value)} className={inp} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">Precio venta *</label><input type="number" step="0.01" value={form.precioVenta} onChange={e => set('precioVenta', e.target.value)} className={inp} /></div>
                <div><label className="block text-xs text-slate-500 mb-1">IVA</label>
                  <select value={form.tipoIva} onChange={e => set('tipoIva', e.target.value)} className={inp}>
                    <option value={21}>21%</option><option value={10}>10%</option><option value={4}>4%</option><option value={0}>0%</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-3 py-1">
                  <input type="checkbox" id="ctrl-stock-n" checked={form.controlStock} onChange={e => set('controlStock', e.target.checked)} className="w-4 h-4 accent-blue-500" />
                  <label htmlFor="ctrl-stock-n" className="text-sm text-slate-300">Control de stock</label>
                </div>
                {form.controlStock && <>
                  <div><label className="block text-xs text-slate-500 mb-1">Stock inicial</label><input type="number" value={form.stockActual} onChange={e => set('stockActual', e.target.value)} className={inp} /></div>
                  <div><label className="block text-xs text-slate-500 mb-1">Stock minimo</label><input type="number" value={form.stockMinimo} onChange={e => set('stockMinimo', e.target.value)} className={inp} /></div>
                </>}
                <div className="col-span-2"><label className="block text-xs text-slate-500 mb-1">Descripcion</label><textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2} className={inp + ' resize-none'} /></div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-600">Cancelar</button>
              <button onClick={() => createMut.mutate(form)} disabled={!form.nombre || createMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white">
                {createMut.isPending ? 'Creando...' : 'Crear articulo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// Familias Tab
// ═══════════════════════════════════════════════
function FamiliasTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ codigo: '', nombre: '', padreId: '' });

  const { data: familias, isLoading } = useQuery({
    queryKey: ['familias-tree'],
    queryFn: () => api.get('/almacen/familias').then(r => r.data),
  });

  const { data: allFamilias } = useQuery({
    queryKey: ['familias-todas'],
    queryFn: () => api.get('/almacen/familias/todas').then(r => r.data),
  });

  const saveMut = useMutation({
    mutationFn: (d: any) => editId ? api.put(`/almacen/familias/${editId}`, d) : api.post('/almacen/familias', d),
    onSuccess: () => {
      toast.success(editId ? 'Familia actualizada' : 'Familia creada');
      qc.invalidateQueries({ queryKey: ['familias-tree'] });
      qc.invalidateQueries({ queryKey: ['familias-todas'] });
      qc.invalidateQueries({ queryKey: ['almacen-stats'] });
      close();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/almacen/familias/${id}`),
    onSuccess: () => {
      toast.success('Familia eliminada');
      qc.invalidateQueries({ queryKey: ['familias-tree'] });
      qc.invalidateQueries({ queryKey: ['familias-todas'] });
      qc.invalidateQueries({ queryKey: ['almacen-stats'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const close = () => { setShowModal(false); setEditId(null); setForm({ codigo: '', nombre: '', padreId: '' }); };
  const openEdit = (f: any) => { setEditId(f.id); setForm({ codigo: f.codigo || '', nombre: f.nombre, padreId: f.padreId || '' }); setShowModal(true); };
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{(familias || []).length} familias</p>
        <button onClick={() => { setEditId(null); setForm({ codigo: '', nombre: '', padreId: '' }); setShowModal(true); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-blue-600/20">
          <Plus size={16} />Nueva familia
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Codigo</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Nombre</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Subfamilias</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Articulos</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : (familias || []).length === 0 ? (
              <tr><td colSpan={5} className="py-12 text-center">
                <FolderTree size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No hay familias creadas</p>
              </td></tr>
            ) : (familias || []).map((f: any) => (
              <FamiliaRow key={f.id} familia={f} level={0} onEdit={openEdit} onDelete={(id: string) => {
                if (confirm('Eliminar esta familia?')) deleteMut.mutate(id);
              }} />
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">{editId ? 'Editar familia' : 'Nueva familia'}</h2>
              <button onClick={close} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div><label className="block text-xs text-slate-500 mb-1">Codigo</label><input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} className={inp} placeholder="Auto si vacio" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Nombre *</label><input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className={inp} /></div>
              <div><label className="block text-xs text-slate-500 mb-1">Familia padre</label>
                <select value={form.padreId} onChange={e => setForm(p => ({ ...p, padreId: e.target.value }))} className={inp}>
                  <option value="">Ninguna (raiz)</option>
                  {(allFamilias || []).filter((f: any) => f.id !== editId).map((f: any) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button onClick={close} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-slate-700">Cancelar</button>
              <button onClick={() => saveMut.mutate(form)} disabled={!form.nombre || saveMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white">
                {saveMut.isPending ? 'Guardando...' : editId ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FamiliaRow({ familia, level, onEdit, onDelete }: { familia: any; level: number; onEdit: (f: any) => void; onDelete: (id: string) => void }) {
  return (
    <>
      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
        <td className="px-4 py-3"><span className="text-sm font-mono text-slate-400">{familia.codigo || '—'}</span></td>
        <td className="px-4 py-3" style={{ paddingLeft: `${16 + level * 24}px` }}>
          <div className="flex items-center gap-2">
            <FolderTree size={14} className="text-blue-400" />
            <span className="text-sm text-white font-medium">{familia.nombre}</span>
          </div>
        </td>
        <td className="px-4 py-3"><span className="text-sm text-slate-400">{familia.hijos?.length || 0}</span></td>
        <td className="px-4 py-3"><span className="text-sm text-slate-400">{familia._count?.articulos || 0}</span></td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => onEdit(familia)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded-lg hover:bg-slate-800"><Edit2 size={14} /></button>
            <button onClick={() => onDelete(familia.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800"><Trash2 size={14} /></button>
          </div>
        </td>
      </tr>
      {familia.hijos?.map((h: any) => (
        <FamiliaRow key={h.id} familia={h} level={level + 1} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════
// Movimientos Tab
// ═══════════════════════════════════════════════
function MovimientosTab() {
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['movimientos', page, tipo, desde, hasta],
    queryFn: () => api.get('/almacen/movimientos', {
      params: { page, limit: 30, tipo: tipo || undefined, desde: desde || undefined, hasta: hasta || undefined },
    }).then(r => r.data),
  });

  const movimientos = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const tipoLabel: Record<string, { label: string; cls: string }> = {
    ENTRADA_COMPRA: { label: 'Compra', cls: 'text-green-400 bg-green-500/10' },
    SALIDA_VENTA: { label: 'Venta', cls: 'text-red-400 bg-red-500/10' },
    AJUSTE_POSITIVO: { label: 'Ajuste +', cls: 'text-green-400 bg-green-500/10' },
    AJUSTE_NEGATIVO: { label: 'Ajuste -', cls: 'text-red-400 bg-red-500/10' },
    ENTRADA_DEVOLUCION: { label: 'Dev. entrada', cls: 'text-blue-400 bg-blue-500/10' },
    SALIDA_DEVOLUCION: { label: 'Dev. salida', cls: 'text-orange-400 bg-orange-500/10' },
    INVENTARIO: { label: 'Inventario', cls: 'text-purple-400 bg-purple-500/10' },
    TRASPASO: { label: 'Traspaso', cls: 'text-cyan-400 bg-cyan-500/10' },
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const sel = 'bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500';

  return (
    <>
      <div className="flex gap-3 flex-wrap">
        <select value={tipo} onChange={e => { setTipo(e.target.value); setPage(1); }} className={sel}>
          <option value="">Todos los tipos</option>
          {Object.entries(tipoLabel).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Desde:</span>
          <input type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1); }} className={sel} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Hasta:</span>
          <input type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1); }} className={sel} />
        </div>
        <button onClick={() => refetch()} className="p-2.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Fecha', 'Articulo', 'Tipo', 'Cantidad', 'Antes', 'Despues', 'Concepto'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : movimientos.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center">
                <ArrowUpDown size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">Sin movimientos</p>
              </td></tr>
            ) : movimientos.map((m: any) => {
              const t = tipoLabel[m.tipo] || { label: m.tipo, cls: 'text-slate-400 bg-slate-500/10' };
              const esPositivo = m.cantidad > 0;
              return (
                <tr key={m.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3"><span className="text-xs text-slate-400">{fmtDate(m.createdAt)}</span></td>
                  <td className="px-4 py-3">
                    <div>
                      <span className="text-sm text-white">{m.articulo?.nombre || '—'}</span>
                      <span className="text-[10px] text-slate-600 block font-mono">{m.articulo?.referencia || ''}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full ${t.cls}`}>{t.label}</span></td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-sm font-bold', esPositivo ? 'text-green-400' : 'text-red-400')}>
                      {esPositivo ? '+' : ''}{m.cantidad}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-500">{m.cantidadAntes ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{m.cantidadDespues ?? '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-xs text-slate-500 truncate max-w-[200px] block">{m.concepto || m.referencia || '—'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">Pagina {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════
// Valoración Tab
// ═══════════════════════════════════════════════
function ValoracionTab() {
  const fmtCurrency = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  const { data, isLoading } = useQuery({
    queryKey: ['almacen-valoracion'],
    queryFn: () => api.get('/almacen/valoracion').then(r => r.data),
  });

  const items: any[] = data?.data || data || [];
  const totalGeneral = items.reduce((sum: number, a: any) => sum + ((a.stockActual || 0) * (a.precioCoste || 0)), 0);

  const handleExportCSV = () => {
    const header = 'Nombre;Referencia;Stock;Precio Coste;Valor Total\n';
    const rows = items.map((a: any) => {
      const valor = (a.stockActual || 0) * (a.precioCoste || 0);
      return `"${a.nombre || ''}";"${a.referencia || ''}";"${a.stockActual || 0}";"${a.precioCoste || 0}";"${valor}"`;
    }).join('\n');
    const footer = `\n"TOTAL";"";"";"";="${totalGeneral}"`;
    const blob = new Blob([header + rows + footer], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'valoracion_stock.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{items.length} artículos con stock valorado</p>
        <button onClick={handleExportCSV}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700">
          <Download size={15} />Exportar CSV
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Nombre', 'Referencia', 'Stock', 'Precio Coste', 'Valor Total'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 5 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : items.length === 0 ? (
              <tr><td colSpan={5} className="py-16 text-center">
                <DollarSign size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No hay datos de valoración</p>
              </td></tr>
            ) : items.map((a: any) => {
              const valorTotal = (a.stockActual || 0) * (a.precioCoste || 0);
              return (
                <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3"><span className="text-sm font-medium text-white">{a.nombre}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-mono text-slate-400">{a.referencia || '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-300">{a.stockActual}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{fmtCurrency(a.precioCoste || 0)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-white">{fmtCurrency(valorTotal)}</span></td>
                </tr>
              );
            })}
            {!isLoading && items.length > 0 && (
              <tr className="border-t-2 border-slate-700 bg-slate-800/30">
                <td colSpan={4} className="px-4 py-3 text-right"><span className="text-sm font-bold text-white">Total general</span></td>
                <td className="px-4 py-3"><span className="text-sm font-bold text-green-400">{fmtCurrency(totalGeneral)}</span></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
