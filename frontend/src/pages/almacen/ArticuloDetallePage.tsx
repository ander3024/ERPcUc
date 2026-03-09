import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { ArrowLeft, Edit2, Save, X, Package, TrendingUp, TrendingDown, AlertTriangle, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ArticuloDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [showMovModal, setShowMovModal] = useState(false);
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', cantidad: '', motivo: '' });

  const { data: articulo, isLoading } = useQuery({
    queryKey: ['articulo', id],
    queryFn: () => api.get(`/almacen/articulos/${id}`).then(r => r.data),
    onSuccess: (d: any) => setForm(d),
  } as any);

  const { data: movimientos } = useQuery({
    queryKey: ['movimientos', id],
    queryFn: () => api.get(`/almacen/articulos/${id}/movimientos`).then(r => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: (d: any) => api.put(`/almacen/articulos/${id}`, {
      ...d,
      precioCompra: parseFloat(d.precioCompra) || 0,
      precioVenta: parseFloat(d.precioVenta) || 0,
      tipoIva: parseFloat(d.tipoIva) || 21,
      stockMinimo: parseInt(d.stockMinimo) || 5,
    }),
    onSuccess: () => { toast.success('Artículo actualizado'); setEditing(false); qc.invalidateQueries({ queryKey: ['articulo', id] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const movMutation = useMutation({
    mutationFn: (d: any) => api.post(`/almacen/articulos/${id}/movimientos`, { ...d, cantidad: parseInt(d.cantidad) }),
    onSuccess: () => { toast.success('Movimiento registrado'); setShowMovModal(false); setMovForm({ tipo: 'ENTRADA', cantidad: '', motivo: '' }); qc.invalidateQueries({ queryKey: ['articulo', id] }); qc.invalidateQueries({ queryKey: ['movimientos', id] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}</div>;
  if (!articulo) return <div className="text-slate-400 text-center py-16">Artículo no encontrado</div>;

  const stockBajo = articulo.controlStock && articulo.stockActual <= articulo.stockMinimo;
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const margen = articulo.precioCompra > 0 ? ((articulo.precioVenta - articulo.precioCompra) / articulo.precioCompra * 100).toFixed(1) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/almacen')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{articulo.nombre}</h1>
          {articulo.referencia && <p className="text-slate-500 text-sm font-mono">{articulo.referencia}</p>}
        </div>
        <div className="flex gap-2">
          {articulo.controlStock && (
            <button onClick={() => setShowMovModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 rounded-xl transition-colors">
              <Plus size={14} />Movimiento stock
            </button>
          )}
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm(articulo); }} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600"><X size={14} />Cancelar</button>
              <button onClick={() => updateMutation.mutate(form)} disabled={updateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors">
                <Save size={14} />{updateMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 hover:text-white transition-colors">
              <Edit2 size={14} />Editar
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Precio venta', value: formatCurrency(articulo.precioVenta), cls: 'text-white' },
          { label: 'Precio compra', value: formatCurrency(articulo.precioCompra), cls: 'text-slate-300' },
          { label: 'Margen', value: margen ? `${margen}%` : '—', cls: margen && parseFloat(margen) > 20 ? 'text-green-400' : 'text-amber-400' },
          { label: 'Stock actual', value: articulo.controlStock ? articulo.stockActual : 'N/A', cls: stockBajo ? 'text-amber-400' : 'text-green-400', extra: stockBajo },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              {k.extra && <AlertTriangle size={11} className="text-amber-400" />}{k.label}
            </p>
            <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Datos del artículo */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2"><Package size={15} className="text-blue-400" />Datos del artículo</h3>
          {editing ? (
            <div className="space-y-3">
              {[
                { k: 'nombre', label: 'Nombre *' },
                { k: 'referencia', label: 'Referencia' },
                { k: 'codigoBarras', label: 'Código de barras' },
                { k: 'precioVenta', label: 'Precio venta (€)', type: 'number' },
                { k: 'precioCompra', label: 'Precio compra (€)', type: 'number' },
              ].map(f => (
                <div key={f.k}>
                  <label className="block text-xs text-slate-500 mb-1">{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.k] || ''} onChange={e => set(f.k, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs text-slate-500 mb-1">IVA (%)</label>
                <select value={form.tipoIva || 21} onChange={e => set('tipoIva', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value={21}>21%</option><option value={10}>10%</option><option value={4}>4%</option><option value={0}>0%</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Stock mínimo</label>
                <input type="number" value={form.stockMinimo || ''} onChange={e => set('stockMinimo', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {[
                { label: 'Referencia', value: articulo.referencia },
                { label: 'Código barras', value: articulo.codigoBarras },
                { label: 'IVA', value: articulo.tipoIva != null ? `${articulo.tipoIva}%` : null },
                { label: 'Stock mínimo', value: articulo.controlStock ? articulo.stockMinimo : null },
                { label: 'Familia', value: articulo.familia?.nombre },
              ].map(({ label, value }) => value != null ? (
                <div key={label} className="flex justify-between items-center py-1.5 border-b border-slate-800/50 last:border-0">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className="text-sm text-white">{value}</span>
                </div>
              ) : null)}
              {articulo.descripcion && <p className="text-sm text-slate-400 pt-2">{articulo.descripcion}</p>}
            </div>
          )}
        </div>

        {/* Movimientos de stock */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-slate-300">Movimientos de stock</h3>
          </div>
          <div className="divide-y divide-slate-800/50 max-h-80 overflow-y-auto">
            {(movimientos?.data || []).length === 0 ? (
              <div className="py-10 text-center text-slate-600 text-sm">Sin movimientos registrados</div>
            ) : (movimientos?.data || []).map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_POSITIVO' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {m.tipo === 'ENTRADA' || m.tipo === 'AJUSTE_POSITIVO'
                    ? <TrendingUp size={14} className="text-green-400" />
                    : <TrendingDown size={14} className="text-red-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{m.motivo || m.tipo}</p>
                  <p className="text-xs text-slate-500">{formatDate(m.fecha)}</p>
                </div>
                <span className={`text-sm font-semibold ${m.cantidad > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {m.cantidad > 0 ? '+' : ''}{m.cantidad}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal movimiento */}
      {showMovModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">Registrar movimiento</h2>
              <button onClick={() => setShowMovModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                <select value={movForm.tipo} onChange={e => setMovForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE_POSITIVO">Ajuste +</option>
                  <option value="AJUSTE_NEGATIVO">Ajuste -</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cantidad *</label>
                <input type="number" value={movForm.cantidad} onChange={e => setMovForm(p => ({ ...p, cantidad: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Motivo</label>
                <input value={movForm.motivo} onChange={e => setMovForm(p => ({ ...p, motivo: e.target.value }))}
                  placeholder="Ej: Compra a proveedor, inventario..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setShowMovModal(false)} className="flex-1 py-2.5 rounded-xl text-sm text-slate-400 border border-slate-700">Cancelar</button>
              <button onClick={() => movMutation.mutate(movForm)} disabled={!movForm.cantidad || movMutation.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white transition-colors">
                {movMutation.isPending ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
