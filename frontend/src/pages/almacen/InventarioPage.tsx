import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardList, Search, Save, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface ArticuloInv {
  id: string;
  referencia: string;
  nombre: string;
  codigoBarras: string | null;
  stockActual: number;
  unidadMedida: string;
  familia?: { nombre: string };
}

interface LineaInventario {
  articuloId: string;
  referencia: string;
  nombre: string;
  stockSistema: number;
  cantidadReal: number;
  diferencia: number;
  unidad: string;
}

export default function InventarioPage() {
  const [search, setSearch] = useState('');
  const [artResults, setArtResults] = useState<ArticuloInv[]>([]);
  const [lineas, setLineas] = useState<LineaInventario[]>([]);
  const [observaciones, setObservaciones] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search articles
  const buscar = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSearch(q);
    if (q.length < 2) { setArtResults([]); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/almacen/articulos?search=${encodeURIComponent(q)}&limit=15&activo=true`, { headers: headers() });
        const d = await res.json();
        setArtResults(d.data || []);
      } catch { /* */ }
    }, 250);
  }, []);

  const addArticulo = (art: ArticuloInv) => {
    if (lineas.some(l => l.articuloId === art.id)) return; // already added
    setLineas(prev => [...prev, {
      articuloId: art.id,
      referencia: art.referencia,
      nombre: art.nombre,
      stockSistema: art.stockActual,
      cantidadReal: art.stockActual,
      diferencia: 0,
      unidad: art.unidadMedida,
    }]);
    setSearch('');
    setArtResults([]);
    searchRef.current?.focus();
  };

  const updateCantidad = (idx: number, cantidadReal: number) => {
    setLineas(prev => prev.map((l, i) => i === idx ? { ...l, cantidadReal, diferencia: cantidadReal - l.stockSistema } : l));
  };

  const removeLinea = (idx: number) => {
    setLineas(prev => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    if (lineas.length === 0) return;
    setGuardando(true);
    setResultado(null);
    try {
      const res = await fetch(`${API}/almacen/inventario`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          items: lineas.map(l => ({ articuloId: l.articuloId, cantidadReal: l.cantidadReal })),
          observaciones,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResultado({ ok: true, msg: `Inventario completado: ${data.movimientosCreados} artículos ajustados` });
        setLineas([]);
        setObservaciones('');
      } else {
        setResultado({ ok: false, msg: data.error || 'Error' });
      }
    } catch {
      setResultado({ ok: false, msg: 'Error de conexión' });
    }
    setGuardando(false);
  };

  const totalDiferencias = lineas.filter(l => l.diferencia !== 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><ClipboardList size={24} /> Regularización de Inventario</h1>
          <p className="text-slate-400 text-sm mt-1">Conteo físico y ajuste automático de stock</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLineas([]); setResultado(null); }} className="flex items-center gap-2 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-800">
            <RotateCcw size={14} /> Limpiar
          </button>
          <button onClick={guardar} disabled={guardando || lineas.length === 0}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Save size={14} /> {guardando ? 'Guardando...' : 'Aplicar inventario'}
          </button>
        </div>
      </div>

      {resultado && (
        <div className={clsx('px-4 py-3 rounded-lg text-sm flex items-center gap-2', resultado.ok ? 'bg-emerald-900/40 border border-emerald-700 text-emerald-300' : 'bg-red-900/40 border border-red-700 text-red-300')}>
          {resultado.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {resultado.msg}
        </div>
      )}

      {/* Search + add */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex gap-4 items-end">
          <div className="flex-1 relative">
            <label className="text-xs text-slate-400 mb-1 block">Buscar artículo (nombre, ref. o código de barras)</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input ref={searchRef} value={search} onChange={e => buscar(e.target.value)}
                placeholder="Escanear código de barras o escribir..."
                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus />
            </div>
            {artResults.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {artResults.map(a => (
                  <li key={a.id} onMouseDown={() => addArticulo(a)}
                    className="px-4 py-2.5 text-sm hover:bg-slate-700 cursor-pointer flex justify-between items-center">
                    <div>
                      <span className="font-mono text-blue-400 text-xs">{a.referencia}</span>
                      <span className="text-white ml-2">{a.nombre}</span>
                      {a.codigoBarras && <span className="text-slate-500 ml-2 text-xs">({a.codigoBarras})</span>}
                    </div>
                    <span className="text-slate-400 text-xs">Stock: {a.stockActual} {a.unidadMedida}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="w-64">
            <label className="text-xs text-slate-400 mb-1 block">Observaciones</label>
            <input value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Motivo del inventario..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>
        </div>
      </div>

      {/* Stats */}
      {lineas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-white">{lineas.length}</p>
            <p className="text-xs text-slate-400">Artículos contados</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <p className={clsx('text-2xl font-bold', totalDiferencias > 0 ? 'text-orange-400' : 'text-emerald-400')}>{totalDiferencias}</p>
            <p className="text-xs text-slate-400">Con diferencias</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{lineas.length - totalDiferencias}</p>
            <p className="text-xs text-slate-400">Correctos</p>
          </div>
        </div>
      )}

      {/* Lines table */}
      {lineas.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Ref.</th>
                <th className="text-left px-5 py-3 font-medium">Artículo</th>
                <th className="text-center px-5 py-3 font-medium">Stock sistema</th>
                <th className="text-center px-5 py-3 font-medium">Conteo real</th>
                <th className="text-center px-5 py-3 font-medium">Diferencia</th>
                <th className="text-center px-3 py-3 font-medium">Ud.</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, idx) => (
                <tr key={l.articuloId} className={clsx('border-b border-slate-800/50 transition-colors',
                  l.diferencia !== 0 ? 'bg-orange-500/5' : 'hover:bg-slate-800/30')}>
                  <td className="px-5 py-2 font-mono text-blue-400 text-xs">{l.referencia}</td>
                  <td className="px-5 py-2 text-white">{l.nombre}</td>
                  <td className="px-5 py-2 text-center text-slate-400">{l.stockSistema}</td>
                  <td className="px-5 py-2 text-center">
                    <input type="number" value={l.cantidadReal} min={0} step="0.001"
                      onChange={e => updateCantidad(idx, parseFloat(e.target.value) || 0)}
                      className="w-24 text-center bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </td>
                  <td className={clsx('px-5 py-2 text-center font-semibold',
                    l.diferencia > 0 ? 'text-emerald-400' : l.diferencia < 0 ? 'text-red-400' : 'text-slate-500')}>
                    {l.diferencia > 0 ? '+' : ''}{l.diferencia}
                  </td>
                  <td className="px-3 py-2 text-center text-slate-500 text-xs">{l.unidad}</td>
                  <td className="px-2 py-2">
                    <button onClick={() => removeLinea(idx)} className="text-slate-600 hover:text-red-400 text-xs">x</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lineas.length === 0 && !resultado && (
        <div className="text-center py-16 text-slate-500">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">Busca artículos para empezar el conteo</p>
          <p className="text-sm mt-1">Puedes escanear códigos de barras o buscar por nombre/referencia</p>
        </div>
      )}
    </div>
  );
}
