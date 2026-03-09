import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { Search, BookOpen, Plus } from 'lucide-react';

export default function ContabilidadPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['asientos', debouncedSearch, page],
    queryFn: () => api.get('/contabilidad/asientos', { params: { search: debouncedSearch, page, limit: 20 } }).then(r => r.data),
  });

  const { data: resumen } = useQuery({
    queryKey: ['cont-resumen'],
    queryFn: () => api.get('/contabilidad/resumen').then(r => r.data),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._contt);
    (window as any)._contt = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const asientos = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contabilidad</h1>
          <p className="text-slate-500 text-sm mt-0.5">Libro diario y asientos contables</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          <Plus size={16} />Nuevo asiento
        </button>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ingresos mes', value: formatCurrency(resumen.ingresosMes || 0), cls: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
            { label: 'Gastos mes', value: formatCurrency(resumen.gastosMes || 0), cls: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'Resultado', value: formatCurrency((resumen.ingresosMes || 0) - (resumen.gastosMes || 0)), cls: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Asientos mes', value: resumen.asientosMes || 0, cls: 'text-slate-300', bg: 'bg-slate-800 border-slate-700' },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Buscar asiento..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Nº Asiento', 'Fecha', 'Concepto', 'Debe', 'Haber', 'Tipo'].map(h => (
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
            ) : asientos.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <BookOpen size={32} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No hay asientos contables</p>
                  <p className="text-slate-600 text-xs mt-1">Se generan automáticamente al emitir facturas</p>
                </td>
              </tr>
            ) : asientos.map((a: any) => (
              <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3"><span className="text-sm font-mono text-blue-400">{a.numeroAsiento}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatDate(a.fecha)}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-white">{a.concepto}</span></td>
                <td className="px-4 py-3"><span className="text-sm font-medium text-green-400">{formatCurrency(a.debe)}</span></td>
                <td className="px-4 py-3"><span className="text-sm font-medium text-red-400">{formatCurrency(a.haber)}</span></td>
                <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{a.tipo}</span></td>
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
