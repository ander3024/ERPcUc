import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/format';
import { imprimirDocumento } from '../ventas/printUtils';
import { ArrowLeft, Download, CheckCircle, FileText, Building2, Printer } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const ESTADOS: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  EMITIDA:  { label: 'Emitida',  cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  COBRADA:  { label: 'Cobrada',  cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  VENCIDA:  { label: 'Vencida',  cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ANULADA:  { label: 'Anulada',  cls: 'bg-slate-500/10 text-slate-500 border-slate-600/20' },
};

export default function FacturaDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: factura, isLoading } = useQuery({
    queryKey: ['factura', id],
    queryFn: () => api.get(`/facturas/${id}`).then(r => r.data),
  });

  const cobrarMutation = useMutation({
    mutationFn: () => api.post(`/facturas/${id}/cobrar`, { formaPago: 'TRANSFERENCIA' }),
    onSuccess: () => { toast.success('Factura cobrada'); qc.invalidateQueries({ queryKey: ['factura', id] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />)}</div>;
  if (!factura) return <div className="text-slate-400 text-center py-16">Factura no encontrada</div>;

  const est = ESTADOS[factura.estado] || ESTADOS.BORRADOR;
  const lineas = factura.lineas || [];
  const subtotal = lineas.reduce((a: number, l: any) => a + l.cantidad * l.precioUnitario, 0);
  const iva = lineas.reduce((a: number, l: any) => a + l.cantidad * l.precioUnitario * (l.tipoIva || 21) / 100, 0);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/facturas')} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{factura.numeroFactura}</h1>
          <p className="text-slate-500 text-sm">Emitida el {formatDate(factura.fecha)}</p>
        </div>
        <span className={clsx('text-sm px-3 py-1.5 rounded-full border font-medium', est.cls)}>{est.label}</span>
        <div className="flex gap-2">
          {(factura.estado === 'EMITIDA' || factura.estado === 'VENCIDA') && (
            <button onClick={() => cobrarMutation.mutate()}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/30 rounded-xl transition-colors">
              <CheckCircle size={14} />Marcar cobrada
            </button>
          )}
          <button onClick={() => imprimirDocumento(factura, 'FACTURA')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">
            <Printer size={14} />Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cliente */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2"><Building2 size={13} />Cliente</h3>
          <p className="text-sm font-semibold text-white mb-1">{factura.cliente?.nombre}</p>
          {factura.cliente?.cifNif && <p className="text-xs text-slate-500 font-mono">{factura.cliente.cifNif}</p>}
          {factura.cliente?.email && <p className="text-xs text-slate-500 mt-1">{factura.cliente.email}</p>}
          {factura.cliente?.direccion && <p className="text-xs text-slate-500 mt-1">{factura.cliente.direccion}</p>}
          {factura.cliente?.ciudad && <p className="text-xs text-slate-500">{[factura.cliente.codigoPostal, factura.cliente.ciudad].filter(Boolean).join(' ')}</p>}
        </div>

        {/* Datos factura */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-3 flex items-center gap-2"><FileText size={13} />Datos</h3>
          <div className="space-y-2">
            {[
              { label: 'Número', value: factura.numeroFactura },
              { label: 'Fecha', value: formatDate(factura.fecha) },
              { label: 'Vencimiento', value: factura.fechaVencimiento ? formatDate(factura.fechaVencimiento) : '—' },
              { label: 'Forma de pago', value: factura.formaPago?.nombre || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-slate-500">{label}</span>
                <span className="text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase mb-3">Importes</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-400">Base imponible</span><span className="text-white">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-400">IVA</span><span className="text-white">{formatCurrency(iva)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-slate-800 pt-2 mt-2">
              <span className="text-white">Total</span>
              <span className="text-blue-400">{formatCurrency(factura.total || subtotal + iva)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-300">Líneas de factura</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Descripción', 'Cantidad', 'Precio unit.', 'IVA', 'Importe'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-600 text-sm">Sin líneas</td></tr>
            ) : lineas.map((l: any, i: number) => (
              <tr key={i} className="border-b border-slate-800/50">
                <td className="px-4 py-3"><span className="text-sm text-white">{l.descripcion || l.articulo?.nombre}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{l.cantidad}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-white">{formatCurrency(l.precioUnitario)}</span></td>
                <td className="px-4 py-3"><span className="text-sm text-slate-400">{l.tipoIva || 21}%</span></td>
                <td className="px-4 py-3"><span className="text-sm font-semibold text-white">{formatCurrency(l.cantidad * l.precioUnitario)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
