import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { Search, Plus, Package, RefreshCw, ChevronRight, AlertTriangle, X } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function AlmacenPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [familia, setFamilia] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({
    referencia: '', nombre: '', descripcion: '', precioCompra: '', precioVenta: '',
    tipoIva: 21, stockActual: 0, stockMinimo: 5, controlStock: true,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['articulos', debouncedSearch, familia, page],
    queryFn: () => api.get('/almacen/articulos', { params: { search: debouncedSearch, familiaId: familia || undefined, page, limit: 20 } }).then(r => r.data),
  });

  const { data: familias } = useQuery({
    queryKey: ['familias'],
    queryFn: () => api.get('/almacen/familias').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => api.post('/almacen/articulos', {
      ...d,
      precioCompra: parseFloat(d.precioCompra) || 0,
      precioVenta: parseFloat(d.precioVenta) || 0,
      tipoIva: parseFloat(d.tipoIva) || 21,
      stockActual: parseInt(d.stockActual) || 0,
      stockMinimo: parseInt(d.stockMinimo) || 5,
    }),
    onSuccess: (res) => {
      toast.success('Artículo creado');
      qc.invalidateQueries({ queryKey: ['articulos'] });
      setShowModal(false);
      setForm({ referencia: '', nombre: '', descripcion: '', precioCompra: '', precioVenta: '', tipoIva: 21, stockActual: 0, stockMinimo: 5, controlStock: true });
      navigate(`/almacen/${res.data.id}`);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al crear'),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._artt);
    (window as any)._artt = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const articulos = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Almacén</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} artículos</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-600/20">
          <Plus size={16} />Nuevo artículo
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por nombre, referencia o código de barras..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        {(familias?.data || []).length > 0 && (
          <select value={familia} onChange={e => { setFamilia(e.target.value); setPage(1); }}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">Todas las familias</option>
            {(familias?.data || []).map((f: any) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </select>
        )}
        <button onClick={() => refetch()} className="p-2.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Artículo', 'Referencia', 'P. Venta', 'P. Compra', 'Stock', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : articulos.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center">
                <Package size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No hay artículos{debouncedSearch ? ' con ese criterio' : ''}</p>
                {!debouncedSearch && <button onClick={() => setShowModal(true)} className="mt-3 text-blue-400 text-sm hover:text-blue-300">Crear el primer artículo →</button>}
              </td></tr>
            ) : articulos.map((a: any) => {
              const stockBajo = a.controlStock && a.stockActual <= a.stockMinimo;
              return (
                <tr key={a.id} onClick={() => navigate(`/almacen/${a.id}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                        <Package size={14} className="text-slate-500" />
                      </div>
                      <span className="text-sm font-medium text-white">{a.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm font-mono text-slate-400">{a.referencia || '—'}</span></td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-white">{formatCurrency(a.precioVenta)}</span></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatCurrency(a.precioCompra)}</span></td>
                  <td className="px-4 py-3">
                    {a.controlStock ? (
                      <div className="flex items-center gap-1.5">
                        {stockBajo && <AlertTriangle size={13} className="text-amber-400" />}
                        <span className={clsx('text-sm font-medium', stockBajo ? 'text-amber-400' : 'text-green-400')}>{a.stockActual}</span>
                        <span className="text-xs text-slate-600">/{a.stockMinimo} mín</span>
                      </div>
                    ) : <span className="text-xs text-slate-600">Sin control</span>}
                  </td>
                  <td className="px-4 py-3"><ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 ml-auto" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">Página {page} de {totalPages} · {total} artículos</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">← Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear artículo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900">
              <h2 className="font-semibold text-white flex items-center gap-2"><Package size={18} className="text-blue-400" />Nuevo artículo</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Referencia</label>
                  <input value={form.referencia} onChange={e => set('referencia', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">IVA (%)</label>
                  <select value={form.tipoIva} onChange={e => set('tipoIva', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value={21}>21%</option>
                    <option value={10}>10%</option>
                    <option value={4}>4%</option>
                    <option value={0}>0%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Precio compra (€)</label>
                  <input type="number" step="0.01" value={form.precioCompra} onChange={e => set('precioCompra', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Precio venta (€) *</label>
                  <input type="number" step="0.01" value={form.precioVenta} onChange={e => set('precioVenta', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div className="col-span-2 flex items-center gap-3 py-1">
                  <input type="checkbox" id="ctrl-stock" checked={form.controlStock} onChange={e => set('controlStock', e.target.checked)}
                    className="w-4 h-4 accent-blue-500" />
                  <label htmlFor="ctrl-stock" className="text-sm text-slate-300">Control de stock</label>
                </div>
                {form.controlStock && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Stock inicial</label>
                      <input type="number" value={form.stockActual} onChange={e => set('stockActual', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Stock mínimo</label>
                      <input type="number" value={form.stockMinimo} onChange={e => set('stockMinimo', e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={2}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-slate-700 hover:border-slate-600">Cancelar</button>
              <button onClick={() => createMutation.mutate(form)} disabled={!form.nombre || !form.precioVenta || createMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white transition-colors">
                {createMutation.isPending ? 'Creando...' : 'Crear artículo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
