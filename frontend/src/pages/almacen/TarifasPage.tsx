import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Pencil, Trash2, Search, X, Save, Package } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface Tarifa {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: 'PORCENTAJE_DESCUENTO' | 'PRECIO_FIJO';
  activa: boolean;
  _count?: { lineas: number; clientes: number };
}

interface TarifaLinea {
  id: string;
  articuloId: string;
  precio: number | null;
  descuento: number;
  articulo?: { id: string; referencia: string; nombre: string; precioVenta: number };
}

interface Articulo {
  id: string;
  referencia: string;
  nombre: string;
  precioVenta: number;
}

export default function TarifasPage() {
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', tipo: 'PORCENTAJE_DESCUENTO' as Tarifa['tipo'], activa: true });

  // Detalle tarifa (lineas)
  const [detalleTarifa, setDetalleTarifa] = useState<Tarifa | null>(null);
  const [lineas, setLineas] = useState<TarifaLinea[]>([]);
  const [lineasLoading, setLineasLoading] = useState(false);

  // Articulo search for adding linea
  const [artQuery, setArtQuery] = useState('');
  const [artResults, setArtResults] = useState<Articulo[]>([]);
  const [newPrecio, setNewPrecio] = useState<number | ''>('');
  const [newDescuento, setNewDescuento] = useState(0);

  const fetchTarifas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/config/tarifas?search=${encodeURIComponent(search)}`, { headers: headers() });
      const data = await res.json();
      setTarifas(Array.isArray(data) ? data : data.data || []);
    } catch { /* */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchTarifas(); }, [fetchTarifas]);

  const openNew = () => { setEditId(null); setForm({ nombre: '', descripcion: '', tipo: 'PORCENTAJE_DESCUENTO', activa: true }); setModal(true); };
  const openEdit = (t: Tarifa) => { setEditId(t.id); setForm({ nombre: t.nombre, descripcion: t.descripcion || '', tipo: t.tipo, activa: t.activa }); setModal(true); };

  const save = async () => {
    const url = editId ? `${API}/config/tarifas/${editId}` : `${API}/config/tarifas`;
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
    setModal(false);
    fetchTarifas();
  };

  const deleteTarifa = async (id: string) => {
    if (!confirm('Eliminar tarifa?')) return;
    await fetch(`${API}/config/tarifas/${id}`, { method: 'DELETE', headers: headers() });
    fetchTarifas();
    if (detalleTarifa?.id === id) setDetalleTarifa(null);
  };

  // Lineas
  const openDetalle = async (t: Tarifa) => {
    setDetalleTarifa(t);
    setLineasLoading(true);
    try {
      const res = await fetch(`${API}/config/tarifas/${t.id}/lineas`, { headers: headers() });
      setLineas(await res.json());
    } catch { /* */ }
    setLineasLoading(false);
  };

  const searchArticulos = async (q: string) => {
    setArtQuery(q);
    if (q.length < 2) { setArtResults([]); return; }
    try {
      const res = await fetch(`${API}/articulos?search=${encodeURIComponent(q)}&limit=10`, { headers: headers() });
      const d = await res.json();
      setArtResults(Array.isArray(d) ? d : d.data || []);
    } catch { /* */ }
  };

  const addLinea = async (art: Articulo) => {
    if (!detalleTarifa) return;
    await fetch(`${API}/config/tarifas/${detalleTarifa.id}/lineas`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ articuloId: art.id, precio: newPrecio || null, descuento: newDescuento }),
    });
    setArtQuery(''); setArtResults([]); setNewPrecio(''); setNewDescuento(0);
    openDetalle(detalleTarifa);
  };

  const deleteLinea = async (lineaId: string) => {
    if (!detalleTarifa) return;
    await fetch(`${API}/config/tarifas/${detalleTarifa.id}/lineas/${lineaId}`, { method: 'DELETE', headers: headers() });
    openDetalle(detalleTarifa);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Tag size={24} /> Tarifas de Precios</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de tarifas y precios especiales por artículo</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva tarifa
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tarifas..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista tarifas */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando...</div>
          ) : tarifas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No hay tarifas</div>
          ) : tarifas.map(t => (
            <div key={t.id} onClick={() => openDetalle(t)}
              className={clsx('bg-slate-900 border rounded-xl p-4 cursor-pointer transition-all hover:border-blue-500/50',
                detalleTarifa?.id === t.id ? 'border-blue-500' : 'border-slate-800')}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{t.nombre}</h3>
                  {t.descripcion && <p className="text-xs text-slate-400 mt-0.5">{t.descripcion}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className={clsx('px-2 py-0.5 rounded-full', t.tipo === 'PORCENTAJE_DESCUENTO' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400')}>
                      {t.tipo === 'PORCENTAJE_DESCUENTO' ? 'Descuento %' : 'Precio fijo'}
                    </span>
                    <span className={clsx('px-2 py-0.5 rounded-full', t.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>
                      {t.activa ? 'Activa' : 'Inactiva'}
                    </span>
                    {t._count && <span className="text-slate-500">{t._count.lineas} artículos · {t._count.clientes} clientes</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(t); }} className="p-1.5 text-slate-500 hover:text-blue-400 rounded"><Pencil size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); deleteTarifa(t.id); }} className="p-1.5 text-slate-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Detalle / lineas */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          {!detalleTarifa ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Package size={32} className="mb-3 opacity-40" />
              <p className="text-sm">Selecciona una tarifa para ver sus artículos</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Artículos de "{detalleTarifa.nombre}"</h2>

              {/* Add articulo */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <input value={artQuery} onChange={e => searchArticulos(e.target.value)} placeholder="Buscar artículo para añadir..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                  {artResults.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                      {artResults.map(a => (
                        <li key={a.id} onMouseDown={() => addLinea(a)}
                          className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer">
                          <span className="font-medium text-white">{a.referencia}</span>
                          <span className="text-slate-400 ml-2">{a.nombre}</span>
                          <span className="float-right text-blue-400">{a.precioVenta.toFixed(2)} €</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <input type="number" value={newDescuento} onChange={e => setNewDescuento(parseFloat(e.target.value) || 0)}
                  placeholder="Dto%" className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-500" />
                <input type="number" value={newPrecio} onChange={e => setNewPrecio(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="Precio" className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-500" />
              </div>

              {/* Lineas list */}
              {lineasLoading ? (
                <div className="text-center py-8 text-slate-500">Cargando...</div>
              ) : lineas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">Sin artículos en esta tarifa</p>
              ) : (
                <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                  <div className="grid grid-cols-[1fr_1fr_80px_80px_40px] gap-2 text-xs text-slate-500 uppercase tracking-wide px-2 pb-1 border-b border-slate-800">
                    <span>Ref.</span><span>Artículo</span><span className="text-right">Dto %</span><span className="text-right">Precio</span><span />
                  </div>
                  {lineas.map(l => (
                    <div key={l.id} className="grid grid-cols-[1fr_1fr_80px_80px_40px] gap-2 items-center px-2 py-1.5 hover:bg-slate-800/50 rounded text-sm">
                      <span className="text-blue-400 font-mono text-xs truncate">{l.articulo?.referencia}</span>
                      <span className="text-slate-300 truncate">{l.articulo?.nombre}</span>
                      <span className="text-right text-slate-400">{l.descuento}%</span>
                      <span className="text-right text-white font-medium">{l.precio != null ? `${l.precio.toFixed(2)} €` : '-'}</span>
                      <button onClick={() => deleteLinea(l.id)} className="text-slate-600 hover:text-red-400"><Trash2 size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar' : 'Nueva'} Tarifa</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descripción</label>
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Tarifa['tipo'] }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="PORCENTAJE_DESCUENTO">Descuento por porcentaje</option>
                  <option value="PRECIO_FIJO">Precio fijo</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} className="rounded" />
                Activa
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={save} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
