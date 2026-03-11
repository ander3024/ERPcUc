import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AlbaranStats {
  total: number;
  pendientes: number;
  facturados: number;
  importePendiente: number;
}

interface Proveedor {
  id: number;
  nombre: string;
  nif?: string;
  email?: string;
  telefono?: string;
}

interface PedidoOrigen {
  id: number;
  numero: string;
}

interface LineaAlbaran {
  id: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  iva: number;
  total: number;
}

interface Albaran {
  id: number;
  numero: string;
  fecha: string;
  estado: 'PENDIENTE' | 'FACTURADO';
  total: number;
  baseImponible?: number;
  totalIva?: number;
  observaciones?: string;
  proveedor: Proveedor;
  pedidoOrigen?: PedidoOrigen;
  lineas?: LineaAlbaran[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── Toast ───────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium
            ${t.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'}`}
        >
          <span>
            {t.type === 'success' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            )}
          </span>
          <span>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Estado Badge ─────────────────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: string }) {
  const styles: Record<string, string> = {
    PENDIENTE: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
    FACTURADO: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30',
  };
  const labels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    FACTURADO: 'Facturado',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${styles[estado] ?? 'bg-slate-700 text-slate-300'}`}
    >
      {labels[estado] ?? estado}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

// ─── Convertir a Factura Modal ────────────────────────────────────────────────

function ConvertirFacturaModal({
  albaran,
  onConfirm,
  onCancel,
  loading,
}: {
  albaran: Albaran;
  onConfirm: (numeroFacturaProveedor: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [numeroFacturaProveedor, setNumeroFacturaProveedor] = useState('');

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Convertir a factura de compra</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              Albarán <span className="font-medium text-slate-300">{albaran.numero}</span> · {albaran.proveedor.nombre}
            </p>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">
            Número de factura del proveedor <span className="text-red-400">*</span>
          </label>
          <input
            autoFocus
            type="text"
            value={numeroFacturaProveedor}
            onChange={(e) => setNumeroFacturaProveedor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && numeroFacturaProveedor.trim()) onConfirm(numeroFacturaProveedor.trim());
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="Ej: F2024-001"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
          <p className="text-xs text-slate-500 mt-1.5">Introduce el número de factura tal como aparece en el documento del proveedor.</p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-600 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              if (numeroFacturaProveedor.trim()) onConfirm(numeroFacturaProveedor.trim());
            }}
            disabled={loading || !numeroFacturaProveedor.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  albaran,
  onClose,
  onConverted,
  addToast,
}: {
  albaran: Albaran;
  onClose: () => void;
  onConverted: () => void;
  addToast: (type: Toast['type'], message: string) => void;
}) {
  const navigate = useNavigate();
  const [showConvertirModal, setShowConvertirModal] = useState(false);
  const [convertirLoading, setConvertirLoading] = useState(false);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showConvertirModal) setShowConvertirModal(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, showConvertirModal]);

  const handleConvertir = async (numeroFacturaProveedor: string) => {
    setConvertirLoading(true);
    try {
      const res = await fetch(`/api/compras/albaranes/${albaran.id}/convertir-factura`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ numeroFacturaProveedor }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al convertir el albarán');
      }
      setShowConvertirModal(false);
      addToast('success', `Albarán ${albaran.numero} convertido a factura correctamente.`);
      onConverted();
      onClose();
    } catch (err: any) {
      addToast('error', err.message ?? 'Error al convertir el albarán');
    } finally {
      setConvertirLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const base = albaran.baseImponible ?? albaran.lineas?.reduce((s, l) => s + l.cantidad * l.precioUnitario, 0) ?? 0;
  const ivaTotal = albaran.totalIva ?? albaran.lineas?.reduce((s, l) => s + (l.cantidad * l.precioUnitario * l.iva) / 100, 0) ?? 0;
  const total = albaran.total ?? base + ivaTotal;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-2xl z-50 bg-slate-950 border-l border-slate-700/60 shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{albaran.numero}</h2>
              <p className="text-xs text-slate-400">{fmtDate(albaran.fecha)}</p>
            </div>
            <EstadoBadge estado={albaran.estado} />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition text-slate-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Proveedor info */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Proveedor</h3>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-1.5">
              <p className="text-sm font-semibold text-white">{albaran.proveedor.nombre}</p>
              {albaran.proveedor.nif && (
                <p className="text-xs text-slate-400">NIF: <span className="text-slate-300">{albaran.proveedor.nif}</span></p>
              )}
              {albaran.proveedor.email && (
                <p className="text-xs text-slate-400">
                  Email:{' '}
                  <a href={`mailto:${albaran.proveedor.email}`} className="text-sky-400 hover:underline">
                    {albaran.proveedor.email}
                  </a>
                </p>
              )}
              {albaran.proveedor.telefono && (
                <p className="text-xs text-slate-400">Tel: <span className="text-slate-300">{albaran.proveedor.telefono}</span></p>
              )}
            </div>
          </section>

          {/* Pedido origen */}
          {albaran.pedidoOrigen && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Pedido origen</h3>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <button
                  onClick={() => navigate(`/compras/pedidos/${albaran.pedidoOrigen!.id}`)}
                  className="flex items-center gap-2 text-sm font-medium text-sky-400 hover:text-sky-300 transition group"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  {albaran.pedidoOrigen.numero}
                </button>
              </div>
            </section>
          )}

          {/* Líneas */}
          {albaran.lineas && albaran.lineas.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Líneas</h3>
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cant.</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Precio</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">IVA</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {albaran.lineas.map((linea) => (
                      <tr key={linea.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-slate-200">{linea.descripcion}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{linea.cantidad}</td>
                        <td className="px-4 py-2.5 text-right text-slate-300">{fmt(linea.precioUnitario)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{linea.iva}%</td>
                        <td className="px-4 py-2.5 text-right font-medium text-white">{fmt(linea.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Totales */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Totales</h3>
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Base imponible</span>
                <span className="text-slate-200">{fmt(base)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>IVA</span>
                <span className="text-slate-200">{fmt(ivaTotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white border-t border-slate-700 pt-2 mt-2">
                <span>Total</span>
                <span className="text-lg">{fmt(total)}</span>
              </div>
            </div>
          </section>

          {/* Observaciones */}
          {albaran.observaciones && (
            <section>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Observaciones</h3>
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
                <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{albaran.observaciones}</p>
              </div>
            </section>
          )}
        </div>

        {/* Editar albaran - reglas por estado */}
        <div className="px-6 pt-4">
          {albaran.estado === 'PENDIENTE' ? (
            <button onClick={() => navigate('/compras/nuevo/albaran?edit=' + albaran.id)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar albaran
            </button>
          ) : albaran.estado === 'FACTURADO' ? (
            <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>Este albaran ya esta facturado y no se puede editar.</span>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            Imprimir
          </button>

          {albaran.estado === 'PENDIENTE' && (
            <button
              onClick={() => setShowConvertirModal(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-900/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              Convertir a factura
            </button>
          )}
        </div>
      </div>

      {/* Convertir Modal */}
      {showConvertirModal && (
        <ConvertirFacturaModal
          albaran={albaran}
          onConfirm={handleConvertir}
          onCancel={() => setShowConvertirModal(false)}
          loading={convertirLoading}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AlbaranesCompraPage() {
  const navigate = useNavigate();

  // Stats
  const [stats, setStats] = useState<AlbaranStats | null>(null);

  // List state
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  // Detail
  const [selectedAlbaran, setSelectedAlbaran] = useState<Albaran | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Fetch stats ────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/compras/albaranes/stats', { headers: authHeader() });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch {
      // silently ignore stats errors
    }
  }, []);

  // ── Fetch list ─────────────────────────────────────────────────────────────

  const fetchAlbaranes = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
          search,
          estado: estadoFilter,
        });
        const res = await fetch(`/api/compras/albaranes?${params}`, { headers: authHeader() });
        if (!res.ok) throw new Error('Error al cargar albaranes');
        const json = await res.json();
        setAlbaranes(json.data ?? []);
        setPagination(json.pagination ?? { page, limit: 20, total: 0, totalPages: 1 });
      } catch (err: any) {
        addToast('error', err.message ?? 'Error al cargar albaranes');
      } finally {
        setLoading(false);
      }
    },
    [search, estadoFilter, pagination.limit, addToast],
  );

  // ── Fetch detail ───────────────────────────────────────────────────────────

  const fetchDetail = useCallback(
    async (id: number) => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/compras/albaranes/${id}`, { headers: authHeader() });
        if (!res.ok) throw new Error('Error al cargar el albarán');
        const data = await res.json();
        setSelectedAlbaran(data);
      } catch (err: any) {
        addToast('error', err.message ?? 'Error al cargar el albarán');
      } finally {
        setDetailLoading(false);
      }
    },
    [addToast],
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchAlbaranes(1);
  }, [search, estadoFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRowClick = (albaran: Albaran) => {
    fetchDetail(albaran.id);
  };

  const handleCloseDetail = () => {
    setSelectedAlbaran(null);
  };

  const handleConverted = () => {
    fetchStats();
    fetchAlbaranes(pagination.page);
  };

  const handlePageChange = (page: number) => {
    fetchAlbaranes(page);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Albaranes de compra</h1>
            <p className="text-sm text-slate-400 mt-1">Gestión de albaranes de entrada de mercancía</p>
          </div>
          <button onClick={() => navigate('/compras/nuevo/albaran')}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            + Nuevo albarán
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total albaranes" value={stats?.total ?? '—'} />
          <StatCard label="Pendientes facturar" value={stats?.pendientes ?? '—'} accent="text-yellow-400" />
          <StatCard label="Facturados" value={stats?.facturados ?? '—'} accent="text-purple-400" />
          <StatCard label="Importe pendiente" value={stats ? fmt(stats.importePendiente) : '—'} accent="text-emerald-400" />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por número o proveedor..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
          </div>

          {/* Estado filter */}
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition min-w-[160px]"
          >
            <option value="">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="FACTURADO">Facturado</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/70 bg-slate-800/60">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Número</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Proveedor</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Pedido origen</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Fecha</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Total</th>
                  <th className="text-center px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span className="text-sm">Cargando albaranes...</span>
                      </div>
                    </td>
                  </tr>
                ) : albaranes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-slate-500">
                        <svg className="w-10 h-10 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                        </svg>
                        <span className="text-sm">No se encontraron albaranes</span>
                        {(search || estadoFilter) && (
                          <button
                            onClick={() => { setSearch(''); setEstadoFilter(''); }}
                            className="text-xs text-sky-400 hover:underline mt-1"
                          >
                            Limpiar filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  albaranes.map((albaran) => (
                    <tr
                      key={albaran.id}
                      onClick={() => handleRowClick(albaran)}
                      className="hover:bg-slate-700/30 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-sm font-semibold text-sky-400 group-hover:text-sky-300 transition-colors">
                          {albaran.numero}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-200 font-medium">{albaran.proveedor.nombre}</td>
                      <td className="px-5 py-3.5">
                        {albaran.pedidoOrigen ? (
                          <span className="font-mono text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded">
                            {albaran.pedidoOrigen.numero}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{fmtDate(albaran.fecha)}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-white tabular-nums">
                        {fmt(albaran.total)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <EstadoBadge estado={albaran.estado} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && albaranes.length > 0 && (
            <div className="px-5 py-3.5 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Mostrando{' '}
                <span className="font-medium text-slate-400">
                  {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                de <span className="font-medium text-slate-400">{pagination.total}</span> albaranes
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Primera página"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m18.75 4.5-7.5 7.5 7.5 7.5m-6-15L5.25 12l7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Página anterior"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>

                {/* Page numbers */}
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let page: number;
                  if (pagination.totalPages <= 5) {
                    page = i + 1;
                  } else if (pagination.page <= 3) {
                    page = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    page = pagination.totalPages - 4 + i;
                  } else {
                    page = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition ${
                        page === pagination.page
                          ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Página siguiente"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Última página"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail loading spinner overlay */}
      {detailLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 flex flex-col items-center gap-4">
            <svg className="w-8 h-8 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm text-slate-400">Cargando albarán...</span>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedAlbaran && !detailLoading && (
        <DetailPanel
          albaran={selectedAlbaran}
          onClose={handleCloseDetail}
          onConverted={handleConverted}
          addToast={addToast}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
