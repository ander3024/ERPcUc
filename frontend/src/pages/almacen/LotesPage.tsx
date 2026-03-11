import { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, Search, X, Save, Trash2, Package } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface Lote {
  id: string;
  articuloId: string;
  lote: string;
  numeroSerie: string | null;
  fechaCaducidad: string | null;
  cantidad: number;
  estado: string;
  ubicacion: string | null;
  createdAt: string;
  articulo?: { referencia: string; nombre: string; tipoTrazabilidad: string };
}

interface Articulo {
  id: string;
  referencia: string;
  nombre: string;
  tipoTrazabilidad: string;
}

export default function LotesPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ articuloId: '', lote: '', numeroSerie: '', fechaCaducidad: '', cantidad: 1, ubicacion: '' });
  const [artSearch, setArtSearch] = useState('');
  const [artResults, setArtResults] = useState<Articulo[]>([]);
  const [selectedArt, setSelectedArt] = useState<Articulo | null>(null);

  const fetchLotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (search) params.set('search', search);
      if (filtroEstado) params.set('estado', filtroEstado);
      const res = await fetch(`${API}/almacen/lotes?${params}`, { headers: headers() });
      const data = await res.json();
      setLotes(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch { /* */ }
    setLoading(false);
  }, [search, filtroEstado, page]);

  useEffect(() => { fetchLotes(); }, [fetchLotes]);

  const searchArticulos = async (q: string) => {
    setArtSearch(q);
    if (q.length < 2) { setArtResults([]); return; }
    try {
      const res = await fetch(`${API}/articulos?search=${encodeURIComponent(q)}&limit=10`, { headers: headers() });
      const d = await res.json();
      setArtResults(Array.isArray(d) ? d : d.data || []);
    } catch { /* */ }
  };

  const selectArticulo = (art: Articulo) => {
    setSelectedArt(art);
    setArtSearch(`${art.referencia} - ${art.nombre}`);
    setArtResults([]);
    setForm(f => ({ ...f, articuloId: art.id }));
  };

  const openNew = () => {
    setForm({ articuloId: '', lote: '', numeroSerie: '', fechaCaducidad: '', cantidad: 1, ubicacion: '' });
    setSelectedArt(null);
    setArtSearch('');
    setModal(true);
  };

  const save = async () => {
    if (!form.articuloId || !form.lote) return;
    await fetch(`${API}/almacen/lotes`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        articuloId: form.articuloId,
        lote: form.lote,
        numeroSerie: form.numeroSerie || null,
        fechaCaducidad: form.fechaCaducidad || null,
        cantidad: form.cantidad,
        ubicacion: form.ubicacion || null,
      }),
    });
    setModal(false);
    fetchLotes();
  };

  const deleteLote = async (id: string) => {
    if (!confirm('Eliminar lote?')) return;
    await fetch(`${API}/almacen/lotes/${id}`, { method: 'DELETE', headers: headers() });
    fetchLotes();
  };

  const ESTADOS = ['DISPONIBLE', 'RESERVADO', 'CUARENTENA', 'AGOTADO'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Layers size={24} /> Trazabilidad: Lotes y Series</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de lotes, números de serie y caducidades</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> Nuevo lote
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por lote, serie, artículo..."
            className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        <select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : lotes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Layers size={48} className="mx-auto mb-4 opacity-30" />
          <p>No hay lotes registrados</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Lote</th>
                <th className="text-left px-5 py-3 font-medium">N° Serie</th>
                <th className="text-left px-5 py-3 font-medium">Artículo</th>
                <th className="text-center px-5 py-3 font-medium">Cantidad</th>
                <th className="text-center px-5 py-3 font-medium">Estado</th>
                <th className="text-center px-5 py-3 font-medium">Caducidad</th>
                <th className="text-left px-5 py-3 font-medium">Ubicación</th>
                <th className="text-right px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map(l => (
                <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-2.5 font-mono text-white font-medium">{l.lote}</td>
                  <td className="px-5 py-2.5 font-mono text-slate-300 text-xs">{l.numeroSerie || '-'}</td>
                  <td className="px-5 py-2.5">
                    <span className="text-blue-400 text-xs font-mono">{l.articulo?.referencia}</span>
                    <span className="text-slate-300 ml-2">{l.articulo?.nombre}</span>
                  </td>
                  <td className="px-5 py-2.5 text-center text-white font-semibold">{l.cantidad}</td>
                  <td className="px-5 py-2.5 text-center">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs',
                      l.estado === 'DISPONIBLE' ? 'bg-emerald-500/20 text-emerald-400' :
                      l.estado === 'RESERVADO' ? 'bg-blue-500/20 text-blue-400' :
                      l.estado === 'CUARENTENA' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400')}>
                      {l.estado}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-center text-slate-400 text-xs">
                    {l.fechaCaducidad ? new Date(l.fechaCaducidad).toLocaleDateString('es-ES') : '-'}
                  </td>
                  <td className="px-5 py-2.5 text-slate-400 text-xs">{l.ubicacion || '-'}</td>
                  <td className="px-5 py-2.5 text-right">
                    <button onClick={() => deleteLote(l.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-slate-800">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i + 1} onClick={() => setPage(i + 1)}
                  className={clsx('w-8 h-8 rounded text-xs', page === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800')}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal nuevo lote */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Nuevo Lote / Serie</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="relative">
                <label className="text-xs text-slate-400 mb-1 block">Artículo *</label>
                <input value={artSearch} onChange={e => searchArticulos(e.target.value)}
                  placeholder="Buscar artículo..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                {artResults.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {artResults.map(a => (
                      <li key={a.id} onMouseDown={() => selectArticulo(a)}
                        className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer">
                        <span className="text-blue-400 font-mono text-xs">{a.referencia}</span>
                        <span className="text-white ml-2">{a.nombre}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">N° Lote *</label>
                  <input value={form.lote} onChange={e => setForm(f => ({ ...f, lote: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">N° Serie</label>
                  <input value={form.numeroSerie} onChange={e => setForm(f => ({ ...f, numeroSerie: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Cantidad</label>
                  <input type="number" min="0" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Caducidad</label>
                  <input type="date" value={form.fechaCaducidad} onChange={e => setForm(f => ({ ...f, fechaCaducidad: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Ubicación</label>
                  <input value={form.ubicacion} onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                    placeholder="Ej: A1-E3"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={save} disabled={!form.articuloId || !form.lote}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
