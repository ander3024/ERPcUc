import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { Search, FileText, RefreshCw, ChevronRight, Download, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ESTADOS: Record<string, { label: string; cls: string }> = {
  BORRADOR:  { label: 'Borrador',  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  EMITIDA:   { label: 'Emitida',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  COBRADA:   { label: 'Cobrada',   cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  VENCIDA:   { label: 'Vencida',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ANULADA:   { label: 'Anulada',   cls: 'bg-slate-500/10 text-slate-500 border-slate-600/20' },
};

export default function FacturasPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['facturas', debouncedSearch, estado, page],
    queryFn: () => api.get('/facturas', { params: { search: debouncedSearch, estado: estado || undefined, page, limit: 20 } }).then(r => r.data),
  });

  const { data: resumen } = useQuery({
    queryKey: ['facturas-resumen'],
    queryFn: () => api.get('/facturas/resumen').then(r => r.data).catch(() => null),
  });

  const cobrarMutation = useMutation({
    mutationFn: ({ id, formaPago }: any) => api.post(`/facturas/${id}/cobrar`, { formaPago }),
    onSuccess: () => { toast.success('Factura marcada como cobrada'); qc.invalidateQueries({ queryKey: ['facturas'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as any)._fact);
    (window as any)._fact = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  };

  const facturas = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Facturas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} facturas</p>
        </div>
      </div>

      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Pendiente cobro', value: formatCurrency(resumen.pendienteCobro || 0), cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Cobrado este mes', value: formatCurrency(resumen.cobradoMes || 0), cls: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
            { label: 'Vencidas', value: resumen.vencidas || 0, cls: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'Total emitido mes', value: formatCurrency(resumen.emitidoMes || 0), cls: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          ].map(s => (
            <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar por número, cliente..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => refetch()} className="p-2.5 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors">
          <RefreshCw size={15} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Nº Factura', 'Cliente', 'Fecha', 'Vencimiento', 'Total', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}
              </tr>
            )) : facturas.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center">
                <FileText size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No hay facturas{debouncedSearch ? ' con ese criterio' : ''}</p>
              </td></tr>
            ) : facturas.map((f: any) => {
              const est = ESTADOS[f.estado] || ESTADOS.BORRADOR;
              const isVencida = f.estado === 'VENCIDA';
              return (
                <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/facturas/${f.id}`)}>
                    <span className="text-sm font-mono font-medium text-blue-400">{f.numeroFactura}</span>
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => navigate(`/facturas/${f.id}`)}>
                    <span className="text-sm text-white">{f.cliente?.nombre}</span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatDate(f.fecha)}</span></td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-sm', isVencida ? 'text-red-400 font-medium' : 'text-slate-400')}>
                      {f.fechaVencimiento ? formatDate(f.fechaVencimiento) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm font-semibold text-white">{formatCurrency(f.total)}</span></td>
                  <td className="px-4 py-3"><span className={clsx('text-xs px-2 py-1 rounded-full border font-medium', est.cls)}>{est.label}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(f.estado === 'EMITIDA' || f.estado === 'VENCIDA') && (
                        <button onClick={() => cobrarMutation.mutate({ id: f.id, formaPago: 'TRANSFERENCIA' })}
                          className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Marcar como cobrada">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors" title="Descargar PDF">
                        <Download size={14} />
                      </button>
                      <button onClick={() => navigate(`/facturas/${f.id}`)} className="p-1.5 text-slate-600 hover:text-slate-400 rounded-lg transition-colors">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">Página {page} de {totalPages} · {total} facturas</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">← Anterior</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg">Siguiente →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
