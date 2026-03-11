import { useState, useEffect } from 'react';

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const inp =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors';

const authHeader = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
});

// ─── Types ──────────────────────────────────────────────────────────────────
interface Proveedor {
  id: number;
  nombre: string;
}

interface Factura {
  id: number;
  numeroProveedor: string;
  proveedor: Proveedor;
  fecha: string;
  fechaVencimiento: string;
  total: number;
  pagado: number;
  pendiente: number;
}

interface Stats {
  total: number;
  pendientes: number;
  pagadas: number;
  pendienteTotal: number;
}

interface PagoForm {
  importe: string;
  fecha: string;
  formaPago: string;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Toast Component ────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          <span>
            {t.type === 'success' ? '✓' : '✕'}
          </span>
          <span>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</span>
    </div>
  );
}

// ─── Payment Form ────────────────────────────────────────────────────────────
function PagoForm({
  factura,
  onSuccess,
  onCancel,
  addToast,
}: {
  factura: Factura;
  onSuccess: () => void;
  onCancel: () => void;
  addToast: (type: 'success' | 'error', message: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<PagoForm>({
    importe: String(factura.pendiente.toFixed(2)),
    fecha: today,
    formaPago: 'Transferencia',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<PagoForm>>({});

  const validate = (): boolean => {
    const e: Partial<PagoForm> = {};
    const importe = parseFloat(form.importe);
    if (!form.importe || isNaN(importe) || importe <= 0) {
      e.importe = 'Importe debe ser mayor que 0';
    } else if (importe > factura.pendiente) {
      e.importe = `No puede superar el pendiente (${fmt(factura.pendiente)})`;
    }
    if (!form.fecha) e.fecha = 'Fecha requerida';
    if (!form.formaPago) e.formaPago = 'Forma de pago requerida';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/compras/pagos', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          facturaId: factura.id,
          importe: parseFloat(form.importe),
          fecha: form.fecha,
          formaPago: form.formaPago,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Error ${res.status}`);
      }

      addToast('success', `Pago de ${fmt(parseFloat(form.importe))} registrado correctamente`);
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al registrar el pago';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof PagoForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="bg-slate-800/60 border border-blue-500/30 rounded-xl p-5 mt-1">
      {/* Factura summary */}
      <div className="mb-4 pb-4 border-b border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Factura seleccionada</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-slate-400">Nº Factura</span>
            <p className="text-white font-medium">{factura.numeroProveedor || '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Proveedor</span>
            <p className="text-white font-medium">{factura.proveedor?.nombre ?? '—'}</p>
          </div>
          <div>
            <span className="text-slate-400">Total factura</span>
            <p className="text-white font-medium">{fmt(factura.total)}</p>
          </div>
          <div>
            <span className="text-slate-400">Pendiente</span>
            <p className="text-amber-400 font-semibold">{fmt(factura.pendiente)}</p>
          </div>
        </div>
      </div>

      {/* Payment form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        {/* Importe */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Importe (€)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={factura.pendiente}
            value={form.importe}
            onChange={(e) => field('importe', e.target.value)}
            className={inp}
            placeholder="0,00"
          />
          {errors.importe && (
            <span className="text-xs text-red-400">{errors.importe}</span>
          )}
        </div>

        {/* Fecha */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Fecha de pago</label>
          <input
            type="date"
            value={form.fecha}
            onChange={(e) => field('fecha', e.target.value)}
            className={inp}
          />
          {errors.fecha && (
            <span className="text-xs text-red-400">{errors.fecha}</span>
          )}
        </div>

        {/* Forma de pago */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Forma de pago</label>
          <select
            value={form.formaPago}
            onChange={(e) => field('formaPago', e.target.value)}
            className={inp}
          >
            <option value="Transferencia">Transferencia</option>
            <option value="Efectivo">Efectivo</option>
            <option value="Cheque">Cheque</option>
            <option value="Domiciliación">Domiciliación</option>
          </select>
          {errors.formaPago && (
            <span className="text-xs text-red-400">{errors.formaPago}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Registrando…' : 'Registrar pago'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-2 text-sm text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PagosCompraPage() {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const today = new Date().toISOString().split('T')[0];

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 5000);
  };

  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [facturasRes, statsRes] = await Promise.all([
        fetch('/api/compras/pagos/pendientes', { headers: authHeader() }),
        fetch('/api/compras/facturas/stats', { headers: authHeader() }),
      ]);

      if (!facturasRes.ok) throw new Error(`Error cargando facturas (${facturasRes.status})`);
      if (!statsRes.ok) throw new Error(`Error cargando estadísticas (${statsRes.status})`);

      const [facturasData, statsData] = await Promise.all([
        facturasRes.json(),
        statsRes.json(),
      ]);

      setFacturas(facturasData);
      setStats(statsData);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error de conexión';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived values ─────────────────────────────────────────────────────────
  const vencidas = facturas.filter((f) => f.fechaVencimiento && f.fechaVencimiento < today);
  const isOverdue = (f: Factura) => f.fechaVencimiento && f.fechaVencimiento < today;

  const handleRowClick = (id: number) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handlePaymentSuccess = () => {
    setSelectedId(null);
    fetchData();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white px-4 sm:px-6 py-6">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Pagos a proveedores</h1>
        <p className="text-slate-400 text-sm mt-1">
          Gestión de facturas pendientes de pago
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total pendiente de pago"
          value={stats ? fmt(stats.pendienteTotal) : '—'}
          accent="text-amber-400"
        />
        <StatCard
          label="Facturas pendientes"
          value={stats ? stats.pendientes : '—'}
          accent="text-blue-400"
        />
        <StatCard
          label="Facturas vencidas"
          value={vencidas.length}
          accent={vencidas.length > 0 ? 'text-red-400' : 'text-emerald-400'}
        />
      </div>

      {/* Section A — Facturas pendientes de pago */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Facturas pendientes de pago
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Haga clic en una fila para registrar un pago
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Cargando…' : '↻ Actualizar'}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="px-5 py-6 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="text-xs bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="divide-y divide-slate-800">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="px-5 py-4 animate-pulse flex gap-4">
                <div className="h-4 bg-slate-800 rounded w-24" />
                <div className="h-4 bg-slate-800 rounded w-40" />
                <div className="h-4 bg-slate-800 rounded w-20 ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && facturas.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-slate-400 text-sm">No hay facturas pendientes de pago</p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && facturas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-800">
                  <th className="px-5 py-3 text-left">Nº Factura</th>
                  <th className="px-5 py-3 text-left">Proveedor</th>
                  <th className="px-5 py-3 text-left">Fecha</th>
                  <th className="px-5 py-3 text-left">Vencimiento</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Pagado</th>
                  <th className="px-5 py-3 text-right">Pendiente</th>
                  <th className="px-5 py-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {facturas.map((factura) => {
                  const overdue = isOverdue(factura);
                  const selected = selectedId === factura.id;

                  return (
                    <>
                      <tr
                        key={factura.id}
                        onClick={() => handleRowClick(factura.id)}
                        className={`cursor-pointer transition-colors
                          ${selected
                            ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
                            : overdue
                            ? 'bg-red-950/30 hover:bg-red-950/50'
                            : 'hover:bg-slate-800/60'
                          }`}
                      >
                        <td className="px-5 py-3.5 font-medium text-white">
                          {factura.numeroProveedor || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-300">
                          {factura.proveedor?.nombre ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">
                          {fmtDate(factura.fecha)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={overdue ? 'text-red-400 font-medium' : 'text-slate-400'}>
                            {fmtDate(factura.fechaVencimiento)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-300">
                          {fmt(factura.total)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-emerald-400">
                          {fmt(factura.pagado)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-amber-400">
                          {fmt(factura.pendiente)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {overdue ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400 bg-red-950/60 border border-red-900 px-2 py-0.5 rounded-full">
                              Vencida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full">
                              Pendiente
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Section B — Inline payment form */}
                      {selected && (
                        <tr key={`pago-${factura.id}`}>
                          <td colSpan={8} className="px-5 pb-4">
                            <PagoForm
                              factura={factura}
                              onSuccess={handlePaymentSuccess}
                              onCancel={() => setSelectedId(null)}
                              addToast={addToast}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {!loading && !error && facturas.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-950/60 border border-red-900" />
              Fila con fondo rojo: factura vencida
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-900/30 border border-blue-500/30" />
              Fila seleccionada
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
