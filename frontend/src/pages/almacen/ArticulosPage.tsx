import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/almacen';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const Ivas = [21, 10, 4, 0];
const UNIDADES = ['UND', 'KG', 'L', 'M', 'M2', 'M3', 'H', 'CAJA', 'PALET'];

export default function ArticulosPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [familias, setFamilias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [familiaId, setFamiliaId] = useState('');
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    nombre: '', referencia: '', descripcion: '', codigoBarras: '',
    familiaId: '', precioVenta: '', precioCompra: '', tipoIva: '21',
    stockMinimo: '0', unidadMedida: 'UND', controlStock: true, permitirNegativo: false,
  });

  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '20', search,
        ...(familiaId && { familiaId }),
        ...(soloStockBajo && { stockBajo: 'true' }),
      });
      const [dRes, sRes] = await Promise.all([
        fetch(`${API}/articulos?${params}`, { headers }),
        fetch(`${API}/articulos/stats`, { headers }),
      ]);
      const dData = await dRes.json();
      const sData = await sRes.json();
      setData(Array.isArray(dData.data) ? dData.data : []);
      setPagination({ page: dData.page || 1, total: dData.total || 0, totalPages: dData.totalPages || 0 });
      setStats(sData);
      if (sData.familias) setFamilias(sData.familias);
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, familiaId, soloStockBajo]);

  useEffect(() => { fetchData(1); }, [fetchData]);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.referencia.trim()) { setError('La referencia es obligatoria'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API}/articulos`, {
        method: 'POST', headers,
        body: JSON.stringify({
          ...form,
          precioVenta: parseFloat(form.precioVenta) || 0,
          precioCompra: parseFloat(form.precioCompra) || 0,
          tipoIva: parseFloat(form.tipoIva) || 21,
          stockMinimo: parseFloat(form.stockMinimo) || 0,
          familiaId: form.familiaId || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Error'); return; }
      setModal(false);
      fetchData(1);
    } catch { setError('Error de conexión'); } finally { setSaving(false); }
  };

  const openModal = () => {
    setForm({
      nombre: '', referencia: '', descripcion: '', codigoBarras: '',
      familiaId: '', precioVenta: '', precioCompra: '', tipoIva: '21',
      stockMinimo: '0', unidadMedida: 'UND', controlStock: true, permitirNegativo: false,
    });
    setError('');
    setModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Artículos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{pagination.total} artículos</p>
        </div>
        <button onClick={openModal}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
          + Nuevo artículo
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total artículos', value: stats.total, cls: 'text-white' },
            { label: 'Stock bajo mínimo', value: stats.stockBajo, cls: stats.stockBajo > 0 ? 'text-orange-400' : 'text-green-400' },
            { label: 'Sin stock', value: stats.sinStock, cls: stats.sinStock > 0 ? 'text-red-400' : 'text-green-400' },
            { label: 'Familias', value: familias.length, cls: 'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre, referencia, código..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        {familias.length > 0 && (
          <select value={familiaId} onChange={e => setFamiliaId(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
            <option value="">Todas las familias</option>
            {familias.map((f: any) => (
              <option key={f.id} value={f.id}>{f.nombre} ({f._count?.articulos || 0})</option>
            ))}
          </select>
        )}
        <button onClick={() => setSoloStockBajo(p => !p)}
          className={`px-3 py-2.5 text-sm rounded-xl border transition-colors ${soloStockBajo
            ? 'bg-orange-500/10 border-orange-500/30 text-orange-400'
            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}>
          ⚠️ Stock bajo
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Referencia', 'Artículo', 'Familia', 'P. Venta', 'P. Coste', 'IVA', 'Stock', 'Unidad'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center">
                <p className="text-slate-500">No hay artículos{search ? ' con ese criterio' : ''}</p>
                {!search && (
                  <button onClick={openModal} className="mt-3 text-sm text-blue-400 hover:text-blue-300">
                    + Crear el primer artículo
                  </button>
                )}
              </td></tr>
            ) : data.map(art => {
              const stockBajo = art.controlStock && art.stockActual <= art.stockMinimo;
              const sinStock = art.controlStock && art.stockActual <= 0;
              return (
                <tr key={art.id}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/almacen/articulos/${art.id}`)}>
                  <td className="px-4 py-3 font-mono text-sm text-blue-400">{art.referencia}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{art.nombre}</p>
                    {art.codigoBarras && <p className="text-xs text-slate-500 font-mono">{art.codigoBarras}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{art.familia?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(art.precioVenta)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmt(art.precioCoste)}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{art.tipoIva}%</td>
                  <td className="px-4 py-3">
                    {art.controlStock ? (
                      <span className={`text-sm font-semibold ${sinStock ? 'text-red-400' : stockBajo ? 'text-orange-400' : 'text-green-400'}`}>
                        {sinStock ? '⚠️ ' : stockBajo ? '↓ ' : ''}{art.stockActual}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600">Sin control</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{art.unidadMedida}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-xs text-slate-500">Pág. {pagination.page} de {pagination.totalPages} · {pagination.total} registros</span>
            <div className="flex gap-2">
              <button onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">← Anterior</button>
              <button onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo artículo */}
      {modal && (
        <Modal title="Nuevo artículo" onClose={() => setModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5">Nombre *</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  placeholder="Nombre del artículo"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Referencia *</label>
                <input value={form.referencia} onChange={e => set('referencia', e.target.value.toUpperCase())}
                  placeholder="REF-001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Código de barras</label>
                <input value={form.codigoBarras} onChange={e => set('codigoBarras', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Precio venta (€)</label>
                <input type="number" step="0.01" value={form.precioVenta} onChange={e => set('precioVenta', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Precio coste (€)</label>
                <input type="number" step="0.01" value={form.precioCompra} onChange={e => set('precioCompra', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">IVA</label>
                <select value={form.tipoIva} onChange={e => set('tipoIva', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {Ivas.map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Unidad de medida</label>
                <select value={form.unidadMedida} onChange={e => set('unidadMedida', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {familias.length > 0 && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1.5">Familia</label>
                  <select value={form.familiaId} onChange={e => set('familiaId', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                    <option value="">Sin familia</option>
                    {familias.map((f: any) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1.5">Descripción</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  rows={2} placeholder="Descripción opcional"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
              <div className="col-span-2 flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.controlStock} onChange={e => set('controlStock', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <span className="text-sm text-slate-300">Control de stock</span>
                </label>
                {form.controlStock && (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.permitirNegativo} onChange={e => set('permitirNegativo', e.target.checked)}
                        className="w-4 h-4 rounded accent-blue-500" />
                      <span className="text-sm text-slate-300">Permitir stock negativo</span>
                    </label>
                    <div className="flex items-center gap-2 ml-auto">
                      <label className="text-xs text-slate-500">Stock mín.</label>
                      <input type="number" value={form.stockMinimo} onChange={e => set('stockMinimo', e.target.value)}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </>
                )}
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Crear artículo'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
