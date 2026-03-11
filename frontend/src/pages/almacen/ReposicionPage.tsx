import { useState, useEffect } from 'react';
import { ShoppingCart, AlertTriangle, Package, RefreshCw, Filter } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface ArticuloRepo {
  id: string;
  referencia: string;
  nombre: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  puntoPedido: number;
  unidadMedida: string;
  precioCoste: number;
  familia?: { nombre: string };
  proveedorHabitual?: { id: string; nombre: string };
  cantidadPedir: number;
}

export default function ReposicionPage() {
  const [articulos, setArticulos] = useState<ArticuloRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'bajo_minimo' | 'bajo_pedido'>('bajo_minimo');
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/almacen/reposicion?filtro=${filtro}`, { headers: headers() });
      const data = await res.json();
      setArticulos(Array.isArray(data) ? data : data.data || []);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filtro]);

  const toggleSelect = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (seleccionados.size === articulos.length) setSeleccionados(new Set());
    else setSeleccionados(new Set(articulos.map(a => a.id)));
  };

  const totalCoste = articulos
    .filter(a => seleccionados.has(a.id))
    .reduce((s, a) => s + a.cantidadPedir * a.precioCoste, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><ShoppingCart size={24} /> Reposición de Stock</h1>
          <p className="text-slate-400 text-sm mt-1">Artículos que necesitan reposición según stock mínimo y punto de pedido</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-800">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter size={14} className="text-slate-500" />
        {[
          { key: 'bajo_minimo' as const, label: 'Bajo mínimo' },
          { key: 'bajo_pedido' as const, label: 'Bajo punto de pedido' },
          { key: 'todos' as const, label: 'Todos con control stock' },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm transition-colors',
              filtro === f.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-orange-400" />
            <span className="text-sm text-slate-400">Artículos a reponer</span>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{articulos.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-blue-400" />
            <span className="text-sm text-slate-400">Seleccionados</span>
          </div>
          <p className="text-2xl font-bold text-white mt-1">{seleccionados.size}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-emerald-400" />
            <span className="text-sm text-slate-400">Coste estimado</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{totalCoste.toFixed(2)} €</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : articulos.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">Stock correcto</p>
          <p className="text-sm mt-1">No hay artículos que necesiten reposición</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-3 py-3">
                  <input type="checkbox" checked={seleccionados.size === articulos.length} onChange={selectAll} className="rounded" />
                </th>
                <th className="text-left px-4 py-3 font-medium">Referencia</th>
                <th className="text-left px-4 py-3 font-medium">Artículo</th>
                <th className="text-left px-4 py-3 font-medium">Familia</th>
                <th className="text-center px-4 py-3 font-medium">Stock actual</th>
                <th className="text-center px-4 py-3 font-medium">Mínimo</th>
                <th className="text-center px-4 py-3 font-medium">Máximo</th>
                <th className="text-center px-4 py-3 font-medium">A pedir</th>
                <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                <th className="text-right px-4 py-3 font-medium">Coste unit.</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map(a => {
                const pct = a.stockMinimo > 0 ? (a.stockActual / a.stockMinimo) * 100 : 100;
                return (
                  <tr key={a.id} className={clsx('border-b border-slate-800/50 transition-colors',
                    seleccionados.has(a.id) ? 'bg-blue-500/5' : 'hover:bg-slate-800/30')}>
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={seleccionados.has(a.id)} onChange={() => toggleSelect(a.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-blue-400 text-xs">{a.referencia}</td>
                    <td className="px-4 py-2.5 text-white">{a.nombre}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{a.familia?.nombre || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className={clsx('font-semibold', pct <= 0 ? 'text-red-400' : pct <= 50 ? 'text-orange-400' : 'text-yellow-400')}>
                          {a.stockActual}
                        </span>
                        <span className="text-slate-600 text-xs">{a.unidadMedida}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-400">{a.stockMinimo}</td>
                    <td className="px-4 py-2.5 text-center text-slate-400">{a.stockMaximo ?? '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="font-bold text-emerald-400">{a.cantidadPedir}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 text-xs">{a.proveedorHabitual?.nombre || '-'}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{a.precioCoste.toFixed(2)} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
