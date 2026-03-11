import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

// ─── Style constants ───────────────────────────────────────────────────────────
const inp =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors';
const sel =
  'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Proveedor {
  id: number;
  nombre: string;
  cif: string;
  contacto?: string;
  email?: string;
  telefono?: string;
}

interface Articulo {
  id: number;
  referencia: string;
  nombre: string;
  precioCoste: number;
  tipoIva: number;
}

interface Linea {
  id: string; // local uuid
  articuloId: number | null;
  articuloBusqueda: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  descuento2: number;
  descuento3: number;
  tipoIva: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const authHeader = (): Record<string, string> => {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const calcLinea = (l: Linea) => {
  const base = l.cantidad * l.precioUnitario * (1 - l.descuento / 100) * (1 - l.descuento2 / 100) * (1 - l.descuento3 / 100);
  const iva = base * (l.tipoIva / 100);
  return { baseLinea: base, ivaLinea: iva, totalLinea: base + iva };
};

const uid = () => Math.random().toString(36).slice(2, 10);

const emptyLinea = (): Linea => ({
  id: uid(),
  articuloId: null,
  articuloBusqueda: '',
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  descuento: 0,
  descuento2: 0,
  descuento3: 0,
  tipoIva: 21,
});

// ─── Per-tipo config ───────────────────────────────────────────────────────────
type TipoCompra = 'pedido' | 'albaran' | 'factura';

const tipoConfig: Record<TipoCompra, { title: string; editTitle: string; backPath: string; endpoint: string; saveLabel: string }> = {
  pedido: {
    title: 'Nuevo Pedido de Compra',
    editTitle: 'Editar Pedido de Compra',
    backPath: '/compras/pedidos',
    endpoint: '/api/compras/pedidos',
    saveLabel: 'Guardar pedido',
  },
  albaran: {
    title: 'Nuevo Albarán de Compra',
    editTitle: 'Editar Albarán de Compra',
    backPath: '/compras/albaranes',
    endpoint: '/api/compras/albaranes',
    saveLabel: 'Guardar albarán',
  },
  factura: {
    title: 'Nueva Factura de Compra',
    editTitle: 'Editar Factura de Compra',
    backPath: '/compras/facturas',
    endpoint: '/api/compras/facturas',
    saveLabel: 'Guardar factura',
  },
};

const defaultConfig = tipoConfig.pedido;

// ─── Articulo search dropdown (per-line) ──────────────────────────────────────
interface ArticuloDropdownProps {
  value: string;
  onSelect: (art: Articulo) => void;
}

function ArticuloDropdown({ value, onSelect }: ArticuloDropdownProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Articulo[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q: string) => {
    if (q.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`/api/articulos?search=${encodeURIComponent(q)}&page=1&limit=10`, {
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((json) => {
        setResults(json.data ?? []);
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 300);
  };

  const handleSelect = (art: Articulo) => {
    setQuery(`${art.referencia} – ${art.nombre}`);
    setOpen(false);
    onSelect(art);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Buscar artículo..."
        className={inp}
      />
      {loading && (
        <span className="absolute right-2 top-2.5 text-slate-500 text-xs">...</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {results.map((art) => (
            <li
              key={art.id}
              onMouseDown={() => handleSelect(art)}
              className="px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 cursor-pointer"
            >
              <span className="font-medium text-white">{art.referencia}</span>
              <span className="text-slate-400 ml-2">{art.nombre}</span>
              <span className="float-right text-blue-400">
                {art.precioCoste.toFixed(2)} € · IVA {art.tipoIva}%
              </span>
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-500">
          Sin resultados
        </div>
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function NuevoDocumentoCompraPage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // Resolve config for current tipo
  const config =
    tipo && tipo in tipoConfig
      ? tipoConfig[tipo as TipoCompra]
      : defaultConfig;

  const { title, editTitle, backPath, endpoint, saveLabel } = config;

  // Proveedor
  const [proveedorQuery, setProveedorQuery] = useState('');
  const [proveedorResults, setProveedorResults] = useState<Proveedor[]>([]);
  const [proveedorDropOpen, setProveedorDropOpen] = useState(false);
  const [proveedorLoading, setProveedorLoading] = useState(false);
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(null);
  const proveedorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const proveedorWrapperRef = useRef<HTMLDivElement>(null);

  // Lines
  const [lineas, setLineas] = useState<Linea[]>([emptyLinea()]);

  // Extra fields – pedido
  const [fechaEntrega, setFechaEntrega] = useState('');

  // Extra fields – factura
  const [numeroProveedor, setNumeroProveedor] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  // Shared
  const [observaciones, setObservaciones] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load existing document for edit mode ────────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    fetch(endpoint + '/' + editId, {
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((doc: any) => {
        if (doc.proveedor) {
          setSelectedProveedor(doc.proveedor);
          setProveedorQuery(doc.proveedor.nombre);
        }
        if (doc.observaciones) setObservaciones(doc.observaciones);
        if (tipo === 'pedido' && doc.fechaEntrega) {
          setFechaEntrega(doc.fechaEntrega.split('T')[0]);
        }
        if (tipo === 'factura') {
          if (doc.numeroProveedor) setNumeroProveedor(doc.numeroProveedor);
          if (doc.fechaVencimiento) setFechaVencimiento(doc.fechaVencimiento.split('T')[0]);
        }
        if (doc.lineas && Array.isArray(doc.lineas)) {
          setLineas(
            doc.lineas.map((l: any) => ({
              id: uid(),
              articuloId: l.articuloId ?? null,
              articuloBusqueda: l.articulo
                ? `${l.articulo.referencia} – ${l.articulo.nombre}`
                : l.descripcion || '',
              descripcion: l.descripcion || '',
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              descuento: l.descuento || 0,
              descuento2: l.descuento2 || 0,
              descuento3: l.descuento3 || 0,
              tipoIva: Number(l.tipoIva) || 21,
            }))
          );
        }
      })
      .catch(() => setError('Error al cargar el documento para edición.'));
  }, [editId]);

  // ── Proveedor search ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        proveedorWrapperRef.current &&
        !proveedorWrapperRef.current.contains(e.target as Node)
      ) {
        setProveedorDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchProveedores = useCallback((q: string) => {
    if (q.trim().length < 1) {
      setProveedorResults([]);
      setProveedorDropOpen(false);
      return;
    }
    setProveedorLoading(true);
    fetch(`/api/compras/proveedores?search=${encodeURIComponent(q)}`, {
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
    })
      .then((r) => r.json())
      .then((json) => {
        setProveedorResults(json.data ?? []);
        setProveedorDropOpen(true);
      })
      .catch(() => setProveedorResults([]))
      .finally(() => setProveedorLoading(false));
  }, []);

  const handleProveedorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setProveedorQuery(q);
    setSelectedProveedor(null);
    if (proveedorTimer.current) clearTimeout(proveedorTimer.current);
    proveedorTimer.current = setTimeout(() => searchProveedores(q), 300);
  };

  const handleSelectProveedor = (p: Proveedor) => {
    setSelectedProveedor(p);
    setProveedorQuery(p.nombre);
    setProveedorDropOpen(false);
  };

  // ── Line helpers ───────────────────────────────────────────────────────────
  const addLinea = () => setLineas((prev) => [...prev, emptyLinea()]);

  const removeLinea = (id: string) =>
    setLineas((prev) => prev.filter((l) => l.id !== id));

  const updateLinea = (id: string, patch: Partial<Linea>) =>
    setLineas((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  const handleArticuloSelect = (id: string, art: Articulo) => {
    updateLinea(id, {
      articuloId: art.id,
      articuloBusqueda: `${art.referencia} – ${art.nombre}`,
      descripcion: art.nombre,
      precioUnitario: art.precioCoste,
      tipoIva: art.tipoIva,
    });
  };

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totals = lineas.reduce(
    (acc, l) => {
      const { baseLinea, ivaLinea, totalLinea } = calcLinea(l);
      return {
        base: acc.base + baseLinea,
        iva: acc.iva + ivaLinea,
        total: acc.total + totalLinea,
      };
    },
    { base: 0, iva: 0, total: 0 }
  );

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);

    if (!selectedProveedor) {
      setError('Debes seleccionar un proveedor.');
      return;
    }
    if (lineas.length === 0) {
      setError('Añade al menos una línea.');
      return;
    }
    for (const l of lineas) {
      if (!l.articuloId) {
        setError('Todas las líneas deben tener un artículo seleccionado.');
        return;
      }
      if (l.cantidad <= 0) {
        setError('La cantidad de todas las líneas debe ser mayor que 0.');
        return;
      }
    }

    // Factura-specific validation
    if (tipo === 'factura' && !numeroProveedor.trim()) {
      setError('El número de factura del proveedor es obligatorio.');
      return;
    }

    const lineasPayload = lineas.map((l) => ({
      articuloId: l.articuloId,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      descuento: l.descuento,
      descuento2: l.descuento2,
      descuento3: l.descuento3,
      tipoIva: l.tipoIva,
    }));

    // Build payload based on tipo
    let payload: Record<string, unknown> = {
      proveedorId: selectedProveedor.id,
      observaciones: observaciones || undefined,
      lineas: lineasPayload,
    };

    if (tipo === 'pedido') {
      payload = { ...payload, fechaEntrega: fechaEntrega || undefined };
    } else if (tipo === 'factura') {
      payload = {
        ...payload,
        numeroProveedor: numeroProveedor.trim(),
        fechaVencimiento: fechaVencimiento || undefined,
      };
    }
    // albaran: no extra fields

    try {
      setSubmitting(true);
      const url = editId ? endpoint + '/' + editId : endpoint;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          ...authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? `Error ${res.status}`);
      }

      navigate(backPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el documento.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Lines section heading ───────────────────────────────────────────────────
  const lineasHeading =
    tipo === 'pedido'
      ? 'Líneas del pedido'
      : tipo === 'albaran'
      ? 'Líneas del albarán'
      : 'Líneas de la factura';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ── Header ── */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
        >
          {/* Arrow left */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Volver
        </button>
        <div className="h-5 w-px bg-slate-700" />
        <h1 className="text-lg font-semibold text-white">{editId ? editTitle : title}</h1>
      </header>

      {/* ── Body ── */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ── Proveedor card ── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
            Proveedor
          </h2>

          {!selectedProveedor ? (
            <div ref={proveedorWrapperRef} className="relative max-w-md">
              <input
                type="text"
                value={proveedorQuery}
                onChange={handleProveedorChange}
                placeholder="Buscar proveedor por nombre o CIF..."
                className={inp}
              />
              {proveedorLoading && (
                <span className="absolute right-3 top-2.5 text-slate-500 text-xs">
                  Buscando...
                </span>
              )}
              {proveedorDropOpen && proveedorResults.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {proveedorResults.map((p) => (
                    <li
                      key={p.id}
                      onMouseDown={() => handleSelectProveedor(p)}
                      className="px-4 py-3 text-sm hover:bg-slate-700 cursor-pointer"
                    >
                      <p className="font-medium text-white">{p.nombre}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        CIF: {p.cif}
                        {p.email && ` · ${p.email}`}
                        {p.telefono && ` · ${p.telefono}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {proveedorDropOpen && proveedorResults.length === 0 && !proveedorLoading && (
                <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-500">
                  Sin resultados
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between bg-slate-800 rounded-lg px-4 py-3">
              <div>
                <p className="font-semibold text-white">{selectedProveedor.nombre}</p>
                <p className="text-slate-400 text-sm mt-0.5">CIF: {selectedProveedor.cif}</p>
                {(selectedProveedor.contacto || selectedProveedor.email || selectedProveedor.telefono) && (
                  <p className="text-slate-400 text-sm">
                    {[selectedProveedor.contacto, selectedProveedor.email, selectedProveedor.telefono]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedProveedor(null);
                  setProveedorQuery('');
                }}
                className="text-slate-500 hover:text-red-400 transition-colors ml-4 mt-0.5"
                title="Cambiar proveedor"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          )}
        </section>

        {/* ── Lines editor ── */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              {lineasHeading}
            </h2>
            <button
              onClick={addLinea}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              Añadir línea
            </button>
          </div>

          {lineas.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">
              No hay líneas. Pulsa "Añadir línea" para empezar.
            </p>
          )}

          {/* Column headers */}
          {lineas.length > 0 && (
            <div className="hidden lg:grid grid-cols-[2fr_2fr_1fr_1.2fr_0.8fr_0.8fr_0.8fr_1fr_1fr_1fr_auto] gap-2 px-1 text-xs text-slate-500 uppercase tracking-wide">
              <span>Artículo</span>
              <span>Descripción</span>
              <span>Cant.</span>
              <span>P. Unitario</span>
              <span>Dto1%</span>
              <span>Dto2%</span>
              <span>Dto3%</span>
              <span>IVA %</span>
              <span>Base</span>
              <span>Total</span>
              <span />
            </div>
          )}

          <div className="space-y-3">
            {lineas.map((linea) => {
              const { baseLinea, ivaLinea, totalLinea } = calcLinea(linea);
              return (
                <div
                  key={linea.id}
                  className="bg-slate-800/60 border border-slate-700 rounded-lg p-3"
                >
                  {/* Mobile: stacked; Desktop: grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-[2fr_2fr_1fr_1.2fr_0.8fr_0.8fr_0.8fr_1fr_1fr_1fr_auto] gap-2 items-start">
                    {/* Artículo */}
                    <ArticuloDropdown
                      value={linea.articuloBusqueda}
                      onSelect={(art) => handleArticuloSelect(linea.id, art)}
                    />

                    {/* Descripción */}
                    <input
                      type="text"
                      value={linea.descripcion}
                      onChange={(e) =>
                        updateLinea(linea.id, { descripcion: e.target.value })
                      }
                      placeholder="Descripción"
                      className={inp}
                    />

                    {/* Cantidad */}
                    <input
                      type="number"
                      value={linea.cantidad}
                      min={0}
                      step="0.001"
                      onChange={(e) =>
                        updateLinea(linea.id, { cantidad: parseFloat(e.target.value) || 0 })
                      }
                      className={inp}
                    />

                    {/* Precio unitario */}
                    <input
                      type="number"
                      value={linea.precioUnitario}
                      min={0}
                      step="0.01"
                      onChange={(e) =>
                        updateLinea(linea.id, {
                          precioUnitario: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={inp}
                    />

                    {/* Descuento 1 */}
                    <input
                      type="number"
                      value={linea.descuento}
                      min={0}
                      max={100}
                      step="0.01"
                      onChange={(e) =>
                        updateLinea(linea.id, { descuento: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Dto1"
                      className={inp}
                    />

                    {/* Descuento 2 */}
                    <input
                      type="number"
                      value={linea.descuento2}
                      min={0}
                      max={100}
                      step="0.01"
                      onChange={(e) =>
                        updateLinea(linea.id, { descuento2: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Dto2"
                      className={inp}
                    />

                    {/* Descuento 3 */}
                    <input
                      type="number"
                      value={linea.descuento3}
                      min={0}
                      max={100}
                      step="0.01"
                      onChange={(e) =>
                        updateLinea(linea.id, { descuento3: parseFloat(e.target.value) || 0 })
                      }
                      placeholder="Dto3"
                      className={inp}
                    />

                    {/* Tipo IVA */}
                    <select
                      value={linea.tipoIva}
                      onChange={(e) =>
                        updateLinea(linea.id, { tipoIva: parseFloat(e.target.value) })
                      }
                      className={sel}
                    >
                      <option value={0}>0%</option>
                      <option value={4}>4%</option>
                      <option value={10}>10%</option>
                      <option value={21}>21%</option>
                    </select>

                    {/* Base */}
                    <div className="flex items-center px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300">
                      {baseLinea.toFixed(2)} €
                    </div>

                    {/* Total */}
                    <div className="flex items-center px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-medium text-white">
                      {totalLinea.toFixed(2)} €
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => removeLinea(linea.id)}
                      className="flex items-center justify-center h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors mt-0.5"
                      title="Eliminar línea"
                    >
                      {/* Trash icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Per-line IVA detail (small) */}
                  <div className="mt-1.5 text-xs text-slate-500 text-right pr-11">
                    IVA ({linea.tipoIva}%): {ivaLinea.toFixed(2)} €
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Bottom row: Totals + Additional fields ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Additional fields */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Datos adicionales
            </h2>

            {/* pedido: fecha de entrega */}
            {tipo === 'pedido' && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Fecha de entrega</label>
                <input
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className={inp + ' [color-scheme:dark]'}
                />
              </div>
            )}

            {/* factura: numero proveedor + fecha vencimiento */}
            {tipo === 'factura' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">
                    N&ordm; factura del proveedor <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={numeroProveedor}
                    onChange={(e) => setNumeroProveedor(e.target.value)}
                    placeholder="Ej. FAC-2024-001"
                    className={inp}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-400">Fecha de vencimiento</label>
                  <input
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    className={inp + ' [color-scheme:dark]'}
                  />
                </div>
              </>
            )}

            {/* albaran: no extra fields — only observaciones below */}

            <div className="space-y-1">
              <label className="text-xs text-slate-400">Observaciones</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={4}
                placeholder="Notas internas, condiciones especiales..."
                className={inp + ' resize-none'}
              />
            </div>
          </section>

          {/* Totals panel */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">
              Resumen
            </h2>

            <div className="space-y-3 flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Base imponible</span>
                <span className="text-white font-medium">{totals.base.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">IVA</span>
                <span className="text-white font-medium">{totals.iva.toFixed(2)} €</span>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-slate-200 font-semibold">Total</span>
                <span className="text-blue-400 text-lg font-bold">
                  {totals.total.toFixed(2)} €
                </span>
              </div>
            </div>

            {/* Submit */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {saveLabel}
                  </>
                )}
              </button>
              <button
                onClick={() => navigate(backPath)}
                disabled={submitting}
                className="w-full text-slate-400 hover:text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
