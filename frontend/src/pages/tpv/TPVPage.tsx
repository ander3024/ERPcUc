import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Articulo {
  id: number;
  referencia: string;
  nombre: string;
  precioVenta: number;
  tipoIva: number;
  stockActual: number;
  codigoBarras?: string;
  familia?: { nombre: string };
}

interface Familia {
  id: number;
  nombre: string;
}

interface LineaTicket {
  id: string;
  articuloId: number;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tipoIva: number;
  descuento: number;
}

interface Caja {
  id: number;
  nombre: string;
  fondoInicial: number;
  fechaApertura: string;
  estado: string;
}

interface TicketHistorial {
  id: number;
  numero: string;
  hora: string;
  total: number;
  formaPago: string;
}

type FormaPago = 'EFECTIVO' | 'TARJETA' | 'TICKET_RESTAURANT';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const today = () => new Date().toISOString().slice(0, 10);

const uid = () => Math.random().toString(36).slice(2);

const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// ─── Toast system ─────────────────────────────────────────────────────────────

function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl text-sm font-medium transition-all
            ${t.type === 'success' ? 'bg-emerald-600 text-white' : ''}
            ${t.type === 'error' ? 'bg-red-600 text-white' : ''}
            ${t.type === 'info' ? 'bg-blue-600 text-white' : ''}
          `}
        >
          <span>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((type: Toast['type'], message: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, add, remove };
}

// ─── Abrir Caja Screen ────────────────────────────────────────────────────────

function AbrirCajaScreen({ onOpened }: { onOpened: (caja: Caja) => void }) {
  const [nombre, setNombre] = useState('Caja Principal');
  const [fondoInicial, setFondoInicial] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAbrir = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tpv/caja/abrir', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ nombre, fondoInicial: parseFloat(fondoInicial) || 0 }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      onOpened(data);
    } catch (e: any) {
      setError(e.message || 'Error al abrir caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-10 w-full max-w-md shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">🏪</span>
          <div>
            <h1 className="text-2xl font-bold text-white">Terminal de Venta</h1>
            <p className="text-gray-400 text-sm">Abra la caja para comenzar</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Nombre de caja</label>
            <input
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Caja 1"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1">Fondo inicial (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-2.5 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleAbrir}
            disabled={loading || !nombre.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors text-lg mt-2"
          >
            {loading ? 'Abriendo...' : '🔓 Abrir Caja'}
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}

// ─── Article Card ─────────────────────────────────────────────────────────────

function ArticuloCard({ art, onAdd }: { art: Articulo; onAdd: (art: Articulo) => void }) {
  const stockColor =
    art.stockActual <= 0
      ? 'bg-red-500'
      : art.stockActual <= 5
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <button
      onClick={() => onAdd(art)}
      className="bg-gray-800 hover:bg-gray-700 active:scale-95 border border-gray-700 hover:border-gray-500 rounded-xl p-3 text-left transition-all flex flex-col gap-1 group"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-white text-xs font-semibold leading-tight line-clamp-2 flex-1">
          {art.nombre}
        </span>
        <span className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${stockColor}`} title={`Stock: ${art.stockActual}`} />
      </div>
      <span className="text-gray-500 text-[10px] font-mono">{art.familia?.nombre || art.referencia || ''}</span>
      <span className="text-emerald-400 font-bold text-sm mt-auto">{fmt(art.precioVenta)}</span>
    </button>
  );
}

// ─── Ticket Line Row ──────────────────────────────────────────────────────────

function LineaRow({
  linea,
  onQty,
  onRemove,
  onDescuento,
}: {
  linea: LineaTicket;
  onQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onDescuento: (id: string, dto: number) => void;
}) {
  const [editingDto, setEditingDto] = useState(false);
  const [dtoInput, setDtoInput] = useState(String(linea.descuento));
  const dtoRef = useRef<HTMLInputElement>(null);

  const baseLinea = linea.cantidad * linea.precioUnitario;
  const totalLinea = baseLinea * (1 - linea.descuento / 100);

  const confirmDto = () => {
    const val = Math.min(100, Math.max(0, parseFloat(dtoInput) || 0));
    onDescuento(linea.id, val);
    setEditingDto(false);
  };

  useEffect(() => {
    if (editingDto && dtoRef.current) dtoRef.current.focus();
  }, [editingDto]);

  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-800 group text-sm">
      {/* Remove */}
      <button
        onClick={() => onRemove(linea.id)}
        className="text-gray-600 hover:text-red-400 transition-colors shrink-0 w-5 text-center leading-none text-base"
        title="Eliminar línea"
      >
        ×
      </button>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{linea.descripcion}</p>
        <p className="text-gray-500 text-xs">{fmt(linea.precioUnitario)} u.</p>
      </div>

      {/* Qty */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onQty(linea.id, -1)}
          className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-lg leading-none"
        >
          −
        </button>
        <span className="w-8 text-center text-white font-bold">{linea.cantidad}</span>
        <button
          onClick={() => onQty(linea.id, +1)}
          className="w-6 h-6 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-center text-lg leading-none"
        >
          +
        </button>
      </div>

      {/* Descuento */}
      <div className="w-16 shrink-0 flex justify-center">
        {editingDto ? (
          <input
            ref={dtoRef}
            type="number"
            min="0"
            max="100"
            className="w-14 bg-gray-700 border border-amber-500 rounded px-1 py-0.5 text-amber-300 text-xs text-center focus:outline-none"
            value={dtoInput}
            onChange={(e) => setDtoInput(e.target.value)}
            onBlur={confirmDto}
            onKeyDown={(e) => e.key === 'Enter' && confirmDto()}
          />
        ) : (
          <button
            onClick={() => { setDtoInput(String(linea.descuento)); setEditingDto(true); }}
            className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
              linea.descuento > 0
                ? 'bg-amber-900/60 text-amber-300 border border-amber-700'
                : 'bg-gray-800 text-gray-500 hover:text-amber-400'
            }`}
            title="Click para editar descuento"
          >
            {linea.descuento > 0 ? `-${linea.descuento}%` : 'dto'}
          </button>
        )}
      </div>

      {/* Total */}
      <div className="w-20 text-right shrink-0">
        <span className="text-white font-semibold">{fmt(totalLinea)}</span>
      </div>
    </div>
  );
}

// ─── Historial ────────────────────────────────────────────────────────────────

function Historial({ cajaId }: { cajaId: number }) {
  const [tickets, setTickets] = useState<TicketHistorial[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tpv/tickets?desde=${today()}&cajaId=${cajaId}`,
        { headers: authHeaders() }
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : data.tickets || []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [cajaId]);

  useEffect(() => { load(); }, [load]);

  const totalDia = tickets.reduce((s, t) => s + (t.total || 0), 0);
  const byMethod: Record<string, number> = {};
  tickets.forEach((t) => {
    byMethod[t.formaPago] = (byMethod[t.formaPago] || 0) + t.total;
  });

  const methodLabel: Record<string, string> = {
    EFECTIVO: 'Efectivo',
    TARJETA: 'Tarjeta',
    TICKET_RESTAURANT: 'T. Restaurant',
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-gray-400 text-xs">Total del día</p>
          <p className="text-emerald-400 font-bold">{fmt(totalDia)}</p>
        </div>
        <div className="bg-gray-800 rounded-lg px-3 py-2">
          <p className="text-gray-400 text-xs">Nº tickets</p>
          <p className="text-white font-bold">{tickets.length}</p>
        </div>
        {Object.entries(byMethod).map(([k, v]) => (
          <div key={k} className="bg-gray-800 rounded-lg px-3 py-2">
            <p className="text-gray-400 text-xs">{methodLabel[k] || k}</p>
            <p className="text-blue-300 font-bold">{fmt(v)}</p>
          </div>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <p className="text-gray-500 text-sm text-center py-4">Cargando...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">Sin tickets hoy</p>
      ) : (
        <div className="overflow-auto max-h-48">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-800">
                <th className="text-left py-1 pr-3">Nº</th>
                <th className="text-left py-1 pr-3">Hora</th>
                <th className="text-left py-1 pr-3">Método</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-1.5 pr-3 text-gray-300 font-mono text-xs">{t.numero}</td>
                  <td className="py-1.5 pr-3 text-gray-400 text-xs">{fmtTime(t.hora)}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      t.formaPago === 'EFECTIVO'
                        ? 'bg-emerald-900/50 text-emerald-300'
                        : t.formaPago === 'TARJETA'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-purple-900/50 text-purple-300'
                    }`}>
                      {methodLabel[t.formaPago] || t.formaPago}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-white font-semibold">{fmt(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={load}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
      >
        ↻ Actualizar
      </button>
    </div>
  );
}

// ─── Cerrar Caja Modal ────────────────────────────────────────────────────────

function CerrarCajaModal({
  caja,
  onClose,
  onClosed,
  toast,
}: {
  caja: Caja;
  onClose: () => void;
  onClosed: () => void;
  toast: (type: Toast['type'], msg: string) => void;
}) {
  const [cierreReal, setCierreReal] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCerrar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tpv/caja/${caja.id}/cerrar`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ cierreReal: parseFloat(cierreReal) || 0 }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      toast('success', 'Caja cerrada correctamente');
      onClosed();
    } catch (e: any) {
      toast('error', e.message || 'Error al cerrar caja');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-1">Cerrar Caja</h2>
        <p className="text-gray-400 text-sm mb-6">{caja.nombre}</p>

        <div>
          <label className="block text-gray-300 text-sm font-medium mb-1">
            Efectivo en caja (recuento real)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-red-500 transition-colors"
            value={cierreReal}
            onChange={(e) => setCierreReal(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCerrar}
            disabled={loading}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white py-2.5 rounded-xl font-bold transition-colors"
          >
            {loading ? 'Cerrando...' : '🔒 Cerrar Caja'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main TPV Component ───────────────────────────────────────────────────────

export default function TPVPage() {
  // Toast
  const { toasts, add: addToast, remove: removeToast } = useToast();

  // Caja
  const [caja, setCaja] = useState<Caja | null>(null);
  const [cajaLoading, setCajaLoading] = useState(true);
  const [showCerrarCaja, setShowCerrarCaja] = useState(false);

  // Articulos
  const [articulos, setArticulos] = useState<Articulo[]>([]);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [familiaActiva, setFamiliaActiva] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [artLoading, setArtLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Ticket
  const [lineas, setLineas] = useState<LineaTicket[]>([]);

  // Payment
  const [formaPago, setFormaPago] = useState<FormaPago>('EFECTIVO');
  const [efectivo, setEfectivo] = useState('');
  const [cobrandoLoading, setCobrandoLoading] = useState(false);
  const [cambioMsg, setCambioMsg] = useState<string | null>(null);

  // Historial
  const [showHistorial, setShowHistorial] = useState(false);

  // ── Load active caja ──────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tpv/caja/activa', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setCaja(data || null);
        }
      } catch {
        // No caja active
      } finally {
        setCajaLoading(false);
      }
    })();
  }, []);

  // ── Load familias ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/articulos/familias', { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setFamilias(Array.isArray(data) ? data : data.familias || []);
        }
      } catch {
        // Optional, skip if unavailable
      }
    })();
  }, []);

  // ── Search articulos ──────────────────────────────────────────────────────

  const fetchArticulos = useCallback(async (q: string) => {
    setArtLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (familiaActiva) params.set('familiaId', String(familiaActiva));
      const res = await fetch(`/api/tpv/articulos-rapidos?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setArticulos(Array.isArray(data) ? data : data.articulos || []);
      }
    } catch {
      setArticulos([]);
    } finally {
      setArtLoading(false);
    }
  }, [familiaActiva]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchArticulos(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchArticulos]);

  // Focus search when caja opens
  useEffect(() => {
    if (caja && searchRef.current) searchRef.current.focus();
  }, [caja]);

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const addToCart = useCallback((art: Articulo) => {
    setLineas((prev) => {
      const existing = prev.find((l) => l.articuloId === art.id);
      if (existing) {
        return prev.map((l) =>
          l.articuloId === art.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: uid(),
          articuloId: art.id,
          descripcion: art.nombre,
          cantidad: 1,
          precioUnitario: art.precioVenta,
          tipoIva: art.tipoIva,
          descuento: 0,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((id: string, delta: number) => {
    setLineas((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0)
    );
  }, []);

  const removeLinea = useCallback((id: string) => {
    setLineas((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const setDescuento = useCallback((id: string, dto: number) => {
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, descuento: dto } : l)));
  }, []);

  const clearCart = useCallback(() => setLineas([]), []);

  // ── Totals ────────────────────────────────────────────────────────────────

  const ivaGroups = lineas.reduce<Record<number, { base: number; cuota: number }>>((acc, l) => {
    const base = l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
    const tipoIva = l.tipoIva || 21;
    const cuota = base * (tipoIva / 100);
    if (!acc[tipoIva]) acc[tipoIva] = { base: 0, cuota: 0 };
    acc[tipoIva].base += base;
    acc[tipoIva].cuota += cuota;
    return acc;
  }, {});

  const subtotal = Object.values(ivaGroups).reduce((s, g) => s + g.base, 0);
  const totalIva = Object.values(ivaGroups).reduce((s, g) => s + g.cuota, 0);
  const total = subtotal + totalIva;

  const efectivoNum = parseFloat(efectivo) || 0;
  const cambio = efectivoNum - total;

  // ── Cobrar ────────────────────────────────────────────────────────────────

  const handleCobrar = async () => {
    if (!caja) return;
    if (lineas.length === 0) { addToast('error', 'El ticket está vacío'); return; }
    if (formaPago === 'EFECTIVO' && efectivoNum < total) {
      addToast('error', 'Efectivo insuficiente');
      return;
    }

    setCobrandoLoading(true);
    try {
      const body = {
        cajaId: caja.id,
        lineas: lineas.map((l) => ({
          articuloId: l.articuloId,
          descripcion: l.descripcion,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          tipoIva: l.tipoIva,
          descuento: l.descuento,
        })),
        formaPago,
        efectivo: formaPago === 'EFECTIVO' ? efectivoNum : undefined,
      };

      const res = await fetch('/api/tpv/ticket', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }

      const ticket = await res.json();
      const cambioReal = ticket.cambio ?? cambio;

      clearCart();
      setEfectivo('');
      setCambioMsg(
        formaPago === 'EFECTIVO'
          ? `Ticket #${ticket.numero || ''} — Cambio: ${fmt(cambioReal)}`
          : `Ticket #${ticket.numero || ''} — Cobrado con ${formaPago === 'TARJETA' ? 'tarjeta' : 'ticket restaurant'}`
      );
      addToast('success', `Ticket registrado correctamente`);

      setTimeout(() => {
        setCambioMsg(null);
        if (searchRef.current) searchRef.current.focus();
      }, 5000);
    } catch (e: any) {
      addToast('error', e.message || 'Error al cobrar');
    } finally {
      setCobrandoLoading(false);
    }
  };

  // ── Render guards ─────────────────────────────────────────────────────────

  if (cajaLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">Cargando TPV...</div>
      </div>
    );
  }

  if (!caja) {
    return <AbrirCajaScreen onOpened={(c) => { setCaja(c); addToast('success', `Caja "${c.nombre}" abierta`); }} />;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      <ToastContainer toasts={toasts} remove={removeToast} />

      {showCerrarCaja && (
        <CerrarCajaModal
          caja={caja}
          onClose={() => setShowCerrarCaja(false)}
          onClosed={() => { setCaja(null); setShowCerrarCaja(false); }}
          toast={addToast}
        />
      )}

      {/* Cambio overlay */}
      {cambioMsg && (
        <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="bg-emerald-900 border-2 border-emerald-500 rounded-3xl px-10 py-8 text-center shadow-2xl animate-bounce">
            <div className="text-5xl mb-3">✓</div>
            <p className="text-emerald-300 font-bold text-2xl">{cambioMsg}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏪</span>
          <div>
            <span className="font-bold text-white">TPV</span>
            <span className="text-gray-500 text-xs ml-2">{caja.nombre}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>{new Date().toLocaleDateString('es-ES')}</span>
          <button
            onClick={() => setShowHistorial((v) => !v)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              showHistorial
                ? 'bg-blue-700 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
            }`}
          >
            📋 Historial
          </button>
          <button
            onClick={() => setShowCerrarCaja(true)}
            className="px-3 py-1.5 bg-gray-800 hover:bg-red-900/60 text-gray-300 hover:text-red-300 rounded-lg font-medium transition-colors"
          >
            🔒 Cerrar caja
          </button>
        </div>
      </header>

      {/* Historial panel */}
      {showHistorial && (
        <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 shrink-0">
          <Historial cajaId={caja.id} />
        </div>
      )}

      {/* 3-panel body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Article search ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-800">

          {/* Search + familia filters */}
          <div className="px-3 pt-3 pb-2 space-y-2 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input
                ref={searchRef}
                type="text"
                className="w-full bg-gray-800 border border-gray-700 focus:border-emerald-500 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none transition-colors"
                placeholder="Buscar por nombre o código de barras..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && articulos.length === 1) addToCart(articulos[0]);
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  ×
                </button>
              )}
            </div>

            {/* Familia filters */}
            {familias.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                <button
                  onClick={() => setFamiliaActiva(null)}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    familiaActiva === null
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Todos
                </button>
                {familias.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFamiliaActiva(f.id === familiaActiva ? null : f.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      familiaActiva === f.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {f.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Article grid */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {artLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm animate-pulse">
                Buscando...
              </div>
            ) : articulos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600 gap-2">
                <span className="text-3xl">📦</span>
                <span className="text-sm">Sin artículos</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 xl:grid-cols-5 gap-2">
                {articulos.map((art) => (
                  <ArticuloCard key={art.id} art={art} onAdd={addToCart} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── CENTER: Ticket lines ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-800">

          {/* Header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
            <span className="text-sm font-semibold text-gray-300">
              Ticket actual
              {lineas.length > 0 && (
                <span className="ml-2 bg-emerald-700 text-white text-xs rounded-full px-2 py-0.5">
                  {lineas.reduce((s, l) => s + l.cantidad, 0)} uds
                </span>
              )}
            </span>
            {lineas.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                🗑 Vaciar
              </button>
            )}
          </div>

          {/* Lines */}
          <div className="flex-1 overflow-y-auto px-4">
            {lineas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3">
                <span className="text-5xl">🛒</span>
                <span className="text-sm">Añade artículos al ticket</span>
              </div>
            ) : (
              <div className="divide-y divide-transparent">
                {/* Column headers */}
                <div className="flex items-center gap-2 py-1.5 text-xs text-gray-600 border-b border-gray-800 mb-1">
                  <div className="w-5" />
                  <div className="flex-1">Artículo</div>
                  <div className="w-[88px] text-center">Cantidad</div>
                  <div className="w-16 text-center">Dto.</div>
                  <div className="w-20 text-right">Total</div>
                </div>
                {lineas.map((l) => (
                  <LineaRow
                    key={l.id}
                    linea={l}
                    onQty={updateQty}
                    onRemove={removeLinea}
                    onDescuento={setDescuento}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Summary + payment ─────────────────────────────────────── */}
        <div className="w-[320px] shrink-0 flex flex-col bg-gray-900 overflow-hidden">

          {/* IVA Breakdown */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-800 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Base imponible</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {Object.entries(ivaGroups).map(([tipo, g]) => (
              <div key={tipo} className="flex justify-between text-sm text-gray-400">
                <span>IVA {tipo}%</span>
                <span>{fmt(g.cuota)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-gray-700">
              <span className="text-white font-bold text-base">TOTAL</span>
              <span className="text-emerald-400 font-bold text-2xl">{fmt(total)}</span>
            </div>
          </div>

          {/* Payment method selector */}
          <div className="px-4 py-3 border-b border-gray-800">
            <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Forma de pago</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: 'EFECTIVO', label: '💶 Efectivo' },
                  { key: 'TARJETA', label: '💳 Tarjeta' },
                  { key: 'TICKET_RESTAURANT', label: '🎟 T.Rest.' },
                ] as { key: FormaPago; label: string }[]
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setFormaPago(m.key)}
                  className={`py-2 px-1 rounded-lg text-xs font-semibold transition-colors text-center ${
                    formaPago === m.key
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Efectivo panel */}
          {formaPago === 'EFECTIVO' && (
            <div className="px-4 py-3 border-b border-gray-800 space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium uppercase tracking-wide block mb-1">
                  Entrega
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full bg-gray-800 border border-gray-600 focus:border-emerald-500 rounded-lg px-3 py-2 text-white text-lg font-bold text-right focus:outline-none transition-colors"
                  value={efectivo}
                  onChange={(e) => setEfectivo(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-5 gap-1">
                {[5, 10, 20, 50, 100].map((v) => (
                  <button
                    key={v}
                    onClick={() => setEfectivo(String(v))}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      parseFloat(efectivo) === v
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {v}€
                  </button>
                ))}
              </div>

              {/* Cambio */}
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Cambio</span>
                <span
                  className={`font-bold text-lg ${
                    efectivoNum > 0
                      ? cambio >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                      : 'text-gray-600'
                  }`}
                >
                  {efectivoNum > 0 ? fmt(Math.max(0, cambio)) : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Tarjeta / T.Rest info */}
          {formaPago !== 'EFECTIVO' && (
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <span className="text-3xl">{formaPago === 'TARJETA' ? '💳' : '🎟'}</span>
                <p className="text-gray-400 text-sm mt-1">
                  {formaPago === 'TARJETA' ? 'Pago con tarjeta' : 'Pago con Ticket Restaurant'}
                </p>
                <p className="text-white font-bold text-xl mt-1">{fmt(total)}</p>
              </div>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* COBRAR button */}
          <div className="px-4 pb-4 pt-2">
            {lineas.length > 0 &&
              formaPago === 'EFECTIVO' &&
              efectivoNum > 0 &&
              efectivoNum < total && (
                <p className="text-red-400 text-xs text-center mb-2">
                  Faltan {fmt(total - efectivoNum)}
                </p>
              )}
            <button
              onClick={handleCobrar}
              disabled={
                cobrandoLoading ||
                lineas.length === 0 ||
                (formaPago === 'EFECTIVO' && efectivoNum > 0 && efectivoNum < total)
              }
              className={`w-full py-4 rounded-2xl font-extrabold text-xl transition-all shadow-lg
                ${
                  lineas.length === 0
                    ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                    : cobrandoLoading
                    ? 'bg-emerald-800 text-emerald-300 cursor-wait'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-900/50'
                }
              `}
            >
              {cobrandoLoading ? (
                <span className="animate-pulse">Procesando...</span>
              ) : (
                <>
                  ✓ COBRAR
                  {total > 0 && <span className="ml-2 font-bold">{fmt(total)}</span>}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
