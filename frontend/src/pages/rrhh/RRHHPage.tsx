import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Search, Plus, Users, ChevronRight } from 'lucide-react';

export default function RRHHPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['empleados', debouncedSearch, page],
    queryFn: () => api.get('/rrhh/empleados', { params: { search: debouncedSearch, page, limit: 20 } }).then(r => r.data),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._rrhht);
    (window as any)._rrhht = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const empleados = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recursos Humanos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} empleados</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} />Nuevo empleado
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar empleado..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Empleado', 'Cargo', 'Departamento', 'Teléfono', 'Estado', ''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : empleados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <Users size={32} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No hay empleados registrados</p>
                </td>
              </tr>
            ) : empleados.map((e: any) => (
              <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group cursor-pointer">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-purple-400">{e.nombre?.[0]}{e.apellidos?.[0]}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{e.nombre} {e.apellidos}</p>
                      <p className="text-xs text-slate-500">{e.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{e.cargo || '—'}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{e.departamento?.nombre || '—'}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{e.telefono || '—'}</span></td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${e.activo
                    ? 'bg-green-500/10 text-green-400 border-green-500/20'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                    {e.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 ml-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">← Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
