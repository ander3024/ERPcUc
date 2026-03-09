import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import {
  Search, Plus, Minus, Trash2, ShoppingBag, CreditCard, Banknote, Receipt,
  X, ChevronDown, Tag, RotateCcw
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface LineaCarrito {
  articuloId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tipoIva: number;
  descuento: number;
}

export default function TPVPage() {
  const qc = useQueryClient();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [cajaAbierta, setCajaAbierta] = useState<any>(null);
  const [efectivoEntregado, setEfectivoEntregado] = useState('');
  const [fondoInicial, setFondoInicial] = useState('200');
  const [lineaEditando, setLineaEditando] = useState<number | null>(null);
  const [descuentoLinea, setDescuentoLinea] = useState('');

  const { data: articulosData } = useQuery({
    queryKey: ['tpv-articulos', search],
    queryFn: () => api.get('/tpv/articulos', { params: { search, limit: 48 } }).then(r => r.data),
  });

  const { data: cajaData, refetch: refetchCaja } = useQuery({
    queryKey: ['tpv-caja'],
    queryFn: () => api.get('/tpv/caja/estado').then(r => r.data).catch(() => null),
  });

  useEffect(() => { setCajaAbierta(cajaData?.caja || null); }, [cajaData]);

  const abrirCajaMutation = useMutation({
    mutationFn: (fondo: number) => api.post('/tpv/caja/abrir', { fondoInicial: fondo }),
    onSuccess: () => { refetchCaja(); toast.success('Caja abierta'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al abrir caja'),
  });

  const cobrarMutation = useMutation({
    mutationFn: (d: any) => api.post('/tpv/tickets', d),
    onSuccess: (res) => {
      toast.success(`✓ Ticket ${res.data.ticket?.numeroTicket || ''} emitido`);
      setCarrito([]);
      setEfectivoEntregado('');
      qc.invalidateQueries({ queryKey: ['tpv-caja'] });
      setTimeout(() => searchRef.current?.focus(), 100);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al cobrar'),
  });

  const articulos = articulosData?.data || [];

  const addArt = (art: any) => {
    setCarrito(prev => {
      const idx = prev.findIndex(l => l.articuloId === art.id);
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, cantidad: l.cantidad + 1 } : l);
      return [...prev, {
        articuloId: art.id, descripcion: art.nombre, cantidad: 1,
        precioUnitario: art.precioVenta, tipoIva: art.tipoIva || 21, descuento: 0
      }];
    });
  };

  const setQty = (i: number, qty: number) => {
    if (qty <= 0) setCarrito(prev => prev.filter((_, j) => j !== i));
    else setCarrito(prev => prev.map((l, j) => j === i ? { ...l, cantidad: qty } : l));
  };

  const setDescuento = (i: number, dto: number) => {
    setCarrito(prev => prev.map((l, j) => j === i ? { ...l, descuento: Math.min(100, Math.max(0, dto)) } : l));
    setLineaEditando(null);
  };

  const subtotal = carrito.reduce((acc, l) => acc + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
  const iva = carrito.reduce((acc, l) => acc + l.cantidad * l.precioUnitario * (1 - l.descuento / 100) * l.tipoIva / 100, 0);
  const total = subtotal + iva;
  const efectivo = parseFloat(efectivoEntregado || '0');
  const cambio = efectivo - total;

  // Pantalla abrir caja
  if (!cajaAbierta) return (
    <div className="min-h-[65vh] flex items-center justify-center">
      <div className="text-center max-w-sm w-full">
        <div className="w-20 h-20 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
          <Receipt size={36} className="text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Abrir caja</h2>
        <p className="text-slate-400 mb-8 text-sm">Introduce el fondo inicial de caja para comenzar</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1.5 text-left">Fondo inicial (€)</label>
            <input type="number" value={fondoInicial} onChange={e => setFondoInicial(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[50, 100, 200].map(v => (
              <button key={v} onClick={() => setFondoInicial(String(v))}
                className={clsx('py-2 rounded-lg text-sm border transition-colors', fondoInicial === String(v)
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-400 hover:border-slate-600')}>
                {v}€
              </button>
            ))}
          </div>
          <button onClick={() => abrirCajaMutation.mutate(parseFloat(fondoInicial) || 0)}
            disabled={abrirCajaMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors">
            {abrirCajaMutation.isPending ? 'Abriendo...' : 'Abrir caja'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-108px)]">
      {/* Panel artículos */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar artículo o escanear código de barras..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {articulos.length === 0 && search && (
            <div className="flex items-center justify-center h-32 text-slate-600 text-sm">No se encontraron artículos</div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {articulos.map((art: any) => (
              <button key={art.id} onClick={() => addArt(art)}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/50 rounded-xl p-3 text-left transition-all active:scale-95">
                <div className="w-9 h-9 rounded-xl bg-blue-600/10 flex items-center justify-center mb-2.5">
                  <ShoppingBag size={15} className="text-blue-400" />
                </div>
                <p className="text-xs font-medium text-white leading-tight line-clamp-2 mb-1.5 min-h-[2.5em]">{art.nombre}</p>
                <p className="text-sm font-bold text-blue-400">{formatCurrency(art.precioVenta)}</p>
                {art.controlStock && (
                  <p className={clsx('text-xs mt-0.5', art.stockActual <= (art.stockMinimo || 5) ? 'text-amber-400' : 'text-slate-600')}>
                    Stock: {art.stockActual}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Fondo de caja */}
        <div className="flex items-center justify-between py-2 px-3 bg-slate-900/50 border border-slate-800 rounded-xl text-xs text-slate-500">
          <span>Caja abierta · Fondo: <span className="text-slate-300 font-medium">{formatCurrency(cajaAbierta.fondoInicial)}</span></span>
          <span>Tickets hoy: <span className="text-slate-300 font-medium">{cajaAbierta._count?.tickets || 0}</span></span>
        </div>
      </div>

      {/* Panel cobro */}
      <div className="w-[300px] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2 text-sm">
            <Receipt size={15} className="text-blue-400" />Ticket
          </h2>
          {carrito.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{carrito.length}</span>
              <button onClick={() => setCarrito([])} className="text-slate-600 hover:text-red-400 transition-colors" title="Vaciar">
                <RotateCcw size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Líneas */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {carrito.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-700 gap-2">
              <ShoppingBag size={24} />
              <span className="text-xs">Carrito vacío</span>
            </div>
          ) : carrito.map((l, i) => {
            const importeLinea = l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
            return (
              <div key={i} className="bg-slate-800/50 rounded-xl p-2.5">
                <div className="flex items-start gap-2 mb-1.5">
                  <p className="flex-1 text-xs font-medium text-white leading-tight line-clamp-2">{l.descripcion}</p>
                  <button onClick={() => setQty(i, 0)} className="text-slate-600 hover:text-red-400 shrink-0 mt-0.5"><X size={12} /></button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(i, l.cantidad - 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><Minus size={11} /></button>
                    <span className="text-sm text-white w-7 text-center font-medium">{l.cantidad}</span>
                    <button onClick={() => setQty(i, l.cantidad + 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-white"><Plus size={11} /></button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Descuento */}
                    {lineaEditando === i ? (
                      <div className="flex items-center gap-1">
                        <input type="number" autoFocus value={descuentoLinea}
                          onChange={e => setDescuentoLinea(e.target.value)}
                          onBlur={() => { setDescuento(i, parseFloat(descuentoLinea) || 0); setDescuentoLinea(''); }}
                          onKeyDown={e => e.key === 'Enter' && setDescuento(i, parseFloat(descuentoLinea) || 0)}
                          className="w-12 bg-slate-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none" />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                    ) : (
                      <button onClick={() => { setLineaEditando(i); setDescuentoLinea(String(l.descuento)); }}
                        className={clsx('flex items-center gap-0.5 text-xs rounded px-1.5 py-0.5 transition-colors',
                          l.descuento > 0 ? 'text-amber-400 bg-amber-500/10' : 'text-slate-600 hover:text-slate-400')}>
                        <Tag size={10} />{l.descuento > 0 ? `-${l.descuento}%` : 'dto'}
                      </button>
                    )}
                    <span className="text-sm font-semibold text-white w-16 text-right">{formatCurrency(importeLinea)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totales y cobro */}
        <div className="border-t border-slate-800 p-3 space-y-3">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between text-slate-400"><span>IVA</span><span>{formatCurrency(iva)}</span></div>
            <div className="flex justify-between text-white font-bold text-lg pt-1 border-t border-slate-800">
              <span>Total</span><span className="text-blue-400">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Método de pago */}
          <div className="grid grid-cols-2 gap-1.5">
            {[{ id: 'EFECTIVO', icon: Banknote, label: 'Efectivo' }, { id: 'TARJETA', icon: CreditCard, label: 'Tarjeta' }].map(m => (
              <button key={m.id} onClick={() => setMetodoPago(m.id)}
                className={clsx('flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition-all',
                  metodoPago === m.id ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400')}>
                <m.icon size={14} />{m.label}
              </button>
            ))}
          </div>

          {metodoPago === 'EFECTIVO' && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">Efectivo recibido</label>
              <input type="number" step="0.01" value={efectivoEntregado}
                onChange={e => setEfectivoEntregado(e.target.value)}
                placeholder={formatCurrency(total)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-right focus:outline-none focus:border-blue-500" />
              {efectivo >= total && total > 0 && (
                <p className="text-xs text-green-400 mt-1 text-right font-medium">Cambio: {formatCurrency(cambio)}</p>
              )}
            </div>
          )}

          <button
            onClick={() => cobrarMutation.mutate({
              cajaId: cajaAbierta.id, metodoPago, lineas: carrito,
              efectivoEntregado: metodoPago === 'EFECTIVO' ? (efectivo || total) : undefined
            })}
            disabled={cobrarMutation.isPending || carrito.length === 0 || (metodoPago === 'EFECTIVO' && efectivoEntregado !== '' && efectivo < total)}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-sm">
            {cobrarMutation.isPending ? 'Procesando...' : carrito.length === 0 ? 'Añade artículos' : `COBRAR ${formatCurrency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
