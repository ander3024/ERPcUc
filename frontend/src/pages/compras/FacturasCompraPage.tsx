import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString('es-ES') : '—';

const getToken = () => localStorage.getItem('accessToken') || '';

const apiFetch = (url: string, opts: RequestInit = {}) =>
  fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers || {}),
    },
  });

// ─── Types ───────────────────────────────────────────────────────────────────

type Estado =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'PARCIALMENTE_COBRADA'
  | 'COBRADA'
  | 'VENCIDA'
  | 'ANULADA';

interface Proveedor {
  id: number;
  nombre: string;
  cif?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
}

interface Linea {
  id: number;
  descripcion: string;
  cantidad: number;
  precio: number;
  iva: number;
  total: number;
}

interface Pago {
  id: number;
  fecha: string;
  importe: number;
  formaPago: string;
}

interface FacturaResumen {
  id: number;
  numero: string;
  numeroProveedor?: string;
  proveedor: { nombre: string };
  fecha: string;
  fechaVencimiento: string;
  total: number;
  pagado: number;
  pendiente: number;
  estado: Estado;
}

interface FacturaDetalle extends FacturaResumen {
  proveedor: Proveedor;
  lineas: Linea[];
  pagos: Pago[];
  baseImponible: number;
  totalIva: number;
  observaciones?: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Stats {
  total: number;
  pendientes: number;
  pagadas: number;
  pendienteTotal: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

// ─── Estado badge ─────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<Estado, { label: string; cls: string }> = {
  BORRADOR:              { label: 'Borrador', cls: 'bg-slate-700 text-slate-300' },
  EMITIDA:               { label: 'Emitida',  cls: 'bg-blue-900 text-blue-300' },
  PARCIALMENTE_COBRADA:  { label: 'Parcial',  cls: 'bg-orange-900 text-orange-300' },
  COBRADA:               { label: 'Pagada',   cls: 'bg-green-900 text-green-300' },
  VENCIDA:               { label: 'Vencida',  cls: 'bg-red-900 text-red-300' },
  ANULADA:               { label: 'Anulada',  cls: 'bg-slate-800 text-slate-500' },
};

function EstadoBadge({ estado }: { estado: Estado }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, cls: 'bg-slate-700 text-slate-300' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            t.type === 'success'
              ? 'bg-green-800 text-green-100 border border-green-700'
              : 'bg-red-800 text-red-100 border border-red-700'
          }`}
        >
          <span>{t.type === 'success' ? '✓' : '✕'}</span>
          <span>{t.message}</span>
          <button
            onClick={() => onRemove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Stats bar ───────────────────────────────────────────────────────────────

function StatsBar({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  const items = [
    { label: 'Total facturas',    value: loading ? '—' : String(stats?.total ?? 0),         mono: false },
    { label: 'Pendientes pago',   value: loading ? '—' : String(stats?.pendientes ?? 0),    mono: false },
    { label: 'Pagadas',           value: loading ? '—' : String(stats?.pagadas ?? 0),       mono: false },
    { label: 'Importe pendiente', value: loading ? '—' : fmt(stats?.pendienteTotal ?? 0),   mono: true  },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-slate-800 border border-slate-700 rounded-xl p-4"
        >
          <p className="text-xs text-slate-400 mb-1">{item.label}</p>
          <p className={`text-xl font-bold text-white ${item.mono ? 'tabular-nums' : ''}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Search + filters ────────────────────────────────────────────────────────

const ESTADOS: Array<{ value: string; label: string }> = [
  { value: '',                    label: 'Todos los estados' },
  { value: 'BORRADOR',            label: 'Borrador' },
  { value: 'EMITIDA',             label: 'Emitida' },
  { value: 'PARCIALMENTE_COBRADA',label: 'Parcial' },
  { value: 'COBRADA',             label: 'Pagada' },
  { value: 'VENCIDA',             label: 'Vencida' },
  { value: 'ANULADA',             label: 'Anulada' },
];

interface SearchBarProps {
  search: string;
  estado: string;
  onSearch: (v: string) => void;
  onEstado: (v: string) => void;
}

function SearchBar({ search, estado, onSearch, onEstado }: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div className="relative flex-1">
        <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por nº factura o proveedor…"
          className="w-full bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500
                     rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <select
        value={estado}
        onChange={(e) => onEstado(e.target.value)}
        className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-52"
      >
        {ESTADOS.map((e) => (
          <option key={e.value} value={e.value}>{e.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

interface TableProps {
  rows: FacturaResumen[];
  loading: boolean;
  onRowClick: (row: FacturaResumen) => void;
  onSort: (col: string) => void;
  sortIcon: (props: { col: string }) => React.ReactNode;
}

function Table({ rows, loading, onRowClick, onSort, sortIcon: SortIconCmp }: TableProps) {
  const headers: Array<{ label: string; key: string }> = [
    { label: 'Nº Proveedor', key: 'numeroProveedor' },
    { label: 'Proveedor',    key: 'proveedor' },
    { label: 'Fecha',        key: 'fecha' },
    { label: 'Vencimiento',  key: 'fechaVencimiento' },
    { label: 'Total',        key: 'total' },
    { label: 'Pagado',       key: 'pagado' },
    { label: 'Pendiente',    key: 'pendiente' },
    { label: 'Estado',       key: 'estado' },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-800">
          <tr>
            {headers.map((h) => (
              <th
                key={h.key}
                onClick={() => onSort(h.key)}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-200 transition-colors"
              >
                {h.label}
                <SortIconCmp col={h.key} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h.key} className="px-4 py-3">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-slate-500">
                No se encontraron facturas.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                className="cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <td className="px-4 py-3 text-slate-200 font-medium">
                  {row.numeroProveedor || row.numero}
                </td>
                <td className="px-4 py-3 text-slate-300">{row.proveedor.nombre}</td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">{fmtDate(row.fecha)}</td>
                <td className="px-4 py-3 text-slate-400 tabular-nums">
                  <span className={row.estado === 'VENCIDA' ? 'text-red-400 font-medium' : ''}>
                    {fmtDate(row.fechaVencimiento)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-200 tabular-nums font-medium">{fmt(row.total)}</td>
                <td className="px-4 py-3 text-green-400 tabular-nums">{fmt(row.pagado)}</td>
                <td className="px-4 py-3 tabular-nums">
                  <span className={row.pendiente > 0 ? 'text-orange-400' : 'text-slate-500'}>
                    {fmt(row.pendiente)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <EstadoBadge estado={row.estado} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

interface PaginationProps {
  pagination: Pagination;
  onPage: (p: number) => void;
}

function PaginationBar({ pagination, onPage }: PaginationProps) {
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to   = Math.min(page * limit, total);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-sm text-slate-400">
      <span>
        {total === 0 ? 'Sin resultados' : `Mostrando ${from}–${to} de ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(1)}
          disabled={page <= 1}
          className="px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          «
        </button>
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ‹
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p: number;
          if (totalPages <= 5) {
            p = i + 1;
          } else if (page <= 3) {
            p = i + 1;
          } else if (page >= totalPages - 2) {
            p = totalPages - 4 + i;
          } else {
            p = page - 2 + i;
          }
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              className={`px-3 py-1 rounded ${
                p === page
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ›
        </button>
        <button
          onClick={() => onPage(totalPages)}
          disabled={page >= totalPages}
          className="px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          »
        </button>
      </div>
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  facturaId: number | null;
  onClose: () => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

function DetailPanel({ facturaId, onClose, onToast }: DetailPanelProps) {
  const navigate = useNavigate();
  const [factura, setFactura]       = useState<FacturaDetalle | null>(null);
  const [loading, setLoading]       = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Pago form
  const [pagoImporte,  setPagoImporte]  = useState('');
  const [pagoFecha,    setPagoFecha]    = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoForma,    setPagoForma]    = useState('Transferencia');
  const [pagoLoading,  setPagoLoading]  = useState(false);

  const fetchFactura = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/compras/facturas/${id}`);
      if (!res.ok) throw new Error('Error al cargar la factura');
      const data = await res.json();
      setFactura(data);
    } catch (err: any) {
      onToast('error', err.message || 'Error al cargar la factura');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    if (facturaId !== null) {
      setFactura(null);
      setPagoImporte('');
      fetchFactura(facturaId);
    }
  }, [facturaId, fetchFactura]);

  const handleRegistrarPago = async () => {
    if (!factura) return;
    const importe = parseFloat(pagoImporte.replace(',', '.'));
    if (isNaN(importe) || importe <= 0) {
      onToast('error', 'El importe debe ser un número positivo');
      return;
    }
    setPagoLoading(true);
    try {
      const res = await apiFetch('/api/compras/pagos', {
        method: 'POST',
        body: JSON.stringify({
          facturaId: factura.id,
          importe,
          fecha: pagoFecha,
          formaPago: pagoForma,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al registrar el pago');
      }
      onToast('success', 'Pago registrado correctamente');
      setPagoImporte('');
      fetchFactura(factura.id);
    } catch (err: any) {
      onToast('error', err.message || 'Error al registrar el pago');
    } finally {
      setPagoLoading(false);
    }
  };

  const handleDeletePago = async (pagoId: number) => {
    if (!factura) return;
    setDeletingId(pagoId);
    try {
      const res = await apiFetch(`/api/compras/pagos/${pagoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar el pago');
      onToast('success', 'Pago eliminado correctamente');
      fetchFactura(factura.id);
    } catch (err: any) {
      onToast('error', err.message || 'Error al eliminar el pago');
    } finally {
      setDeletingId(null);
    }
  };

  const visible = facturaId !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700
                    z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
                      visible ? 'translate-x-0' : 'translate-x-full'
                    }`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          {factura ? (
            <div className="flex items-center gap-3">
              <span className="text-white font-semibold text-lg">
                Factura {factura.numeroProveedor || factura.numero}
              </span>
              <EstadoBadge estado={factura.estado} />
            </div>
          ) : (
            <span className="text-slate-400 text-sm">Cargando…</span>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading && (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
              ))}
            </div>
          )}

          {!loading && factura && (
            <>
              {/* Proveedor info */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Proveedor
                </h3>
                <div className="bg-slate-800 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-400">Nombre: </span>
                    <span className="text-slate-100 font-medium">{factura.proveedor.nombre}</span>
                  </div>
                  {factura.proveedor.cif && (
                    <div>
                      <span className="text-slate-400">CIF: </span>
                      <span className="text-slate-100">{factura.proveedor.cif}</span>
                    </div>
                  )}
                  {factura.proveedor.telefono && (
                    <div>
                      <span className="text-slate-400">Tel.: </span>
                      <span className="text-slate-100">{factura.proveedor.telefono}</span>
                    </div>
                  )}
                  {factura.proveedor.email && (
                    <div>
                      <span className="text-slate-400">Email: </span>
                      <span className="text-slate-100">{factura.proveedor.email}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Fecha: </span>
                    <span className="text-slate-100">{fmtDate(factura.fecha)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Vencimiento: </span>
                    <span className={factura.estado === 'VENCIDA' ? 'text-red-400 font-medium' : 'text-slate-100'}>
                      {fmtDate(factura.fechaVencimiento)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Lines table */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Líneas
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-700">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-800">
                      <tr>
                        {['Descripción', 'Cant.', 'Precio', 'IVA', 'Total'].map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wider">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {(factura.lineas || []).map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2 text-slate-300">{l.descripcion}</td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">{l.cantidad}</td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">{fmt(l.precio)}</td>
                          <td className="px-3 py-2 text-slate-400 tabular-nums">{l.iva}%</td>
                          <td className="px-3 py-2 text-slate-200 tabular-nums font-medium">{fmt(l.total)}</td>
                        </tr>
                      ))}
                      {(!factura.lineas || factura.lineas.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500">Sin líneas</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-3 bg-slate-800 rounded-lg p-4 flex flex-col items-end gap-1 text-sm">
                  <div className="flex gap-8">
                    <span className="text-slate-400">Base imponible:</span>
                    <span className="text-slate-200 tabular-nums w-28 text-right">{fmt(factura.baseImponible)}</span>
                  </div>
                  <div className="flex gap-8">
                    <span className="text-slate-400">IVA:</span>
                    <span className="text-slate-200 tabular-nums w-28 text-right">{fmt(factura.totalIva)}</span>
                  </div>
                  <div className="flex gap-8 border-t border-slate-700 pt-2 mt-1">
                    <span className="text-white font-semibold">Total:</span>
                    <span className="text-white font-bold tabular-nums w-28 text-right">{fmt(factura.total)}</span>
                  </div>
                </div>
              </section>

              {/* Payment summary */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Estado de pago
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Pagado</p>
                    <p className="text-lg font-bold text-green-400 tabular-nums">{fmt(factura.pagado)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Pendiente</p>
                    <p className={`text-lg font-bold tabular-nums ${factura.pendiente > 0 ? 'text-orange-400' : 'text-slate-500'}`}>
                      {fmt(factura.pendiente)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Editar factura - reglas por estado */}
              {factura.estado !== 'ANULADA' && (() => {
                const hasPagos = (factura.pagos?.length || 0) > 0;
                const esEditable = factura.estado === 'BORRADOR' || factura.estado === 'EMITIDA' || factura.estado === 'VENCIDA';
                const esCobrada = factura.estado === 'COBRADA' || factura.estado === 'PARCIALMENTE_COBRADA';

                if (esCobrada || (esEditable && hasPagos)) {
                  return (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span>Para editar esta factura primero elimina los pagos registrados ({factura.pagos?.length || 0}).</span>
                    </div>
                  );
                }
                if (esEditable && !hasPagos) {
                  return (
                    <button onClick={() => navigate('/compras/nuevo/factura?edit=' + factura.id)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Editar factura
                    </button>
                  );
                }
                return null;
              })()}

              {/* Pagos list */}
              <section>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Pagos registrados
                </h3>
                {(factura.pagos || []).length === 0 ? (
                  <p className="text-sm text-slate-500 bg-slate-800 rounded-lg px-4 py-3">
                    No hay pagos registrados.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {factura.pagos.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-slate-400 tabular-nums">{fmtDate(p.fecha)}</span>
                          <span className="text-green-400 font-medium tabular-nums">{fmt(p.importe)}</span>
                          <span className="text-slate-500 text-xs bg-slate-700 px-2 py-0.5 rounded">
                            {p.formaPago}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeletePago(p.id)}
                          disabled={deletingId === p.id}
                          title="Eliminar pago"
                          className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 p-1 rounded hover:bg-slate-700"
                        >
                          {deletingId === p.id ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4h6v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Registrar pago form */}
              {factura.pendiente > 0 && factura.estado !== 'ANULADA' && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Registrar pago
                  </h3>
                  <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Importe (€)</label>
                        <input
                          type="text"
                          value={pagoImporte}
                          onChange={(e) => setPagoImporte(e.target.value)}
                          placeholder={`Máx. ${fmt(factura.pendiente)}`}
                          className="w-full bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500
                                     rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Fecha</label>
                        <input
                          type="date"
                          value={pagoFecha}
                          onChange={(e) => setPagoFecha(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-slate-100
                                     rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Forma de pago</label>
                      <select
                        value={pagoForma}
                        onChange={(e) => setPagoForma(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-slate-100
                                   rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option>Transferencia</option>
                        <option>Efectivo</option>
                        <option>Cheque</option>
                        <option>Domiciliación</option>
                      </select>
                    </div>
                    <button
                      onClick={handleRegistrarPago}
                      disabled={pagoLoading || !pagoImporte}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed
                                 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      {pagoLoading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Registrando…
                        </>
                      ) : (
                        'Registrar pago'
                      )}
                    </button>
                  </div>
                </section>
              )}

              {/* Observaciones */}
              {factura.observaciones && (
                <section>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Observaciones
                  </h3>
                  <p className="bg-slate-800 rounded-lg px-4 py-3 text-sm text-slate-300 whitespace-pre-wrap">
                    {factura.observaciones}
                  </p>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FacturasCompraPage() {
  const navigate = useNavigate();

  // Data state
  const [rows,       setRows]       = useState<FacturaResumen[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // UI state
  const [search,        setSearch]        = useState('');
  const [estado,        setEstado]        = useState('');
  const [desde,         setDesde]         = useState('');
  const [hasta,         setHasta]         = useState('');
  const [sortBy,        setSortBy]        = useState('');
  const [sortDir,       setSortDir]       = useState<'asc' | 'desc'>('asc');
  const [loadingList,   setLoadingList]   = useState(false);
  const [loadingStats,  setLoadingStats]  = useState(false);
  const [selectedId,    setSelectedId]    = useState<number | null>(null);
  const [toasts,        setToasts]        = useState<Toast[]>([]);

  // Toast helpers
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Fetch list
  const fetchList = useCallback(async (page = 1) => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(pagination.limit),
        search,
        estado,
      });
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const res = await apiFetch(`/api/compras/facturas?${params}`);
      if (!res.ok) throw new Error('Error al cargar facturas');
      const json = await res.json();
      setRows(json.data);
      setPagination(json.pagination);
    } catch (err: any) {
      addToast('error', err.message || 'Error al cargar facturas');
    } finally {
      setLoadingList(false);
    }
  }, [search, estado, desde, hasta, pagination.limit, addToast]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await apiFetch('/api/compras/facturas/stats');
      if (!res.ok) throw new Error('Error al cargar estadísticas');
      const data = await res.json();
      setStats(data);
    } catch {
      // stats failing is non-critical, silent
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Debounced search effect
  useEffect(() => {
    const t = setTimeout(() => fetchList(1), 350);
    return () => clearTimeout(t);
  }, [search, estado, desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Re-fetch stats when panel closes (pago may have been registered)
  const handlePanelClose = () => {
    setSelectedId(null);
    fetchStats();
    fetchList(pagination.page);
  };

  // ── Sort helpers ──
  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortBy) return rows;
    const sorted = [...rows].sort((a, b) => {
      let va: any, vb: any;
      switch (sortBy) {
        case 'numeroProveedor': va = a.numeroProveedor || a.numero; vb = b.numeroProveedor || b.numero; break;
        case 'proveedor':       va = a.proveedor.nombre; vb = b.proveedor.nombre; break;
        case 'fecha':           va = a.fecha; vb = b.fecha; break;
        case 'fechaVencimiento':va = a.fechaVencimiento; vb = b.fechaVencimiento; break;
        case 'total':           va = a.total; vb = b.total; break;
        case 'pagado':          va = a.pagado; vb = b.pagado; break;
        case 'pendiente':       va = a.pendiente; vb = b.pendiente; break;
        case 'estado':          va = a.estado; vb = b.estado; break;
        default: return 0;
      }
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? (va ?? 0) - (vb ?? 0) : (vb ?? 0) - (va ?? 0);
    });
    return sorted;
  }, [rows, sortBy, sortDir]);

  // ── CSV export ──
  const exportCSV = () => {
    const sep = ';';
    const header = ['NumProveedor', 'Proveedor', 'Fecha', 'Vencimiento', 'Total', 'Pagado', 'Pendiente', 'Estado'];
    const csvRows = sortedData.map((r) => [
      r.numeroProveedor || r.numero,
      r.proveedor.nombre,
      fmtDate(r.fecha),
      fmtDate(r.fechaVencimiento),
      (r.total ?? 0).toFixed(2),
      (r.pagado ?? 0).toFixed(2),
      (r.pendiente ?? 0).toFixed(2),
      r.estado,
    ].join(sep));
    const csv = [header.join(sep), ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_compra_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Sort icon component ──
  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 inline text-blue-400" />
      : <ArrowDown className="w-3 h-3 ml-1 inline text-blue-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Facturas de compra</h1>
            <p className="text-sm text-slate-400 mt-1">Gestión de facturas recibidas de proveedores</p>
          </div>
          <button onClick={() => navigate('/compras/nuevo/factura')}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            + Nueva factura
          </button>
        </div>

        {/* Stats */}
        <StatsBar stats={stats} loading={loadingStats} />

        {/* Search + filters */}
        <SearchBar
          search={search}
          estado={estado}
          onSearch={(v) => setSearch(v)}
          onEstado={(v) => setEstado(v)}
        />

        {/* Date range + CSV export */}
        <div className="flex flex-col sm:flex-row items-end gap-3 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-100
                       bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>

        {/* Table */}
        <Table
          rows={sortedData}
          loading={loadingList}
          onRowClick={(row) => setSelectedId(row.id)}
          onSort={toggleSort}
          sortIcon={SortIcon}
        />

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <PaginationBar
            pagination={pagination}
            onPage={(p) => fetchList(p)}
          />
        )}
      </div>

      {/* Detail slide-in */}
      <DetailPanel
        facturaId={selectedId}
        onClose={handlePanelClose}
        onToast={addToast}
      />
    </div>
  );
}
