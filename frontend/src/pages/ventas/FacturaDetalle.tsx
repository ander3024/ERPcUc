import { useState, useEffect } from 'react';
import { imprimirDocumento } from './printUtils';

const API = '/api/ventas';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const ESTADOS: Record<string, { label: string; cls: string }> = {
  BORRADOR:             { label: 'Borrador',  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  EMITIDA:              { label: 'Emitida',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PARCIALMENTE_COBRADA: { label: 'Parcial',   cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  COBRADA:              { label: 'Cobrada',   cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  VENCIDA:              { label: 'Vencida',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ANULADA:              { label: 'Anulada',   cls: 'bg-slate-600/10 text-slate-500 border-slate-600/20' },
};

interface Props {
  facturaId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function FacturaDetalle({ facturaId, onClose, onUpdated }: Props) {
  const [doc, setDoc]               = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [working, setWorking]       = useState('');
  const [toast, setToast]           = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [showCobro, setShowCobro]   = useState(false);
  const [cobro, setCobro] = useState({
    importe: '', fecha: new Date().toISOString().split('T')[0], formaPago: 'CONTADO', texto: '',
  });

  const token   = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const cargar = async () => {
    if (!facturaId) return;
    setLoading(true);
    try { setDoc(await fetch(`${API}/facturas/${facturaId}`, { headers }).then(r => r.json())); }
    catch { showToast('Error al cargar'); } finally { setLoading(false); }
  };

  useEffect(() => { if (facturaId) { setDoc(null); setConfirmDel(false); cargar(); } }, [facturaId]);

  const cambiarEstado = async (s: string) => {
    setWorking('e');
    const res = await fetch(`${API}/facturas/${facturaId}`, { method: 'PUT', headers, body: JSON.stringify({ estado: s }) });
    if (res.ok) { showToast(`✅ ${ESTADOS[s]?.label}`); await cargar(); onUpdated(); }
    else { const d = await res.json(); showToast(d.error || 'Error'); }
    setWorking('');
  };

  const eliminar = async () => {
    setWorking('del');
    const res = await fetch(`${API}/facturas/${facturaId}`, { method: 'DELETE', headers });
    if (res.ok) { showToast('✅ Eliminada'); onUpdated(); onClose(); }
    else { const d = await res.json(); showToast(d.error || 'No se puede eliminar'); }
    setWorking(''); setConfirmDel(false);
  };

  const añadirCobro = async () => {
    const imp = parseFloat(cobro.importe);
    if (!imp || imp <= 0) { showToast('Importe inválido'); return; }
    setWorking('cobro');
    const res = await fetch('/api/ventas/cobros', {
      method: 'POST', headers,
      body: JSON.stringify({ facturaId, clienteId: doc.clienteId, importe: imp, fecha: cobro.fecha, formaPago: cobro.formaPago, texto: cobro.texto || null, estado: 'PAGADO' }),
    });
    if (res.ok) {
      showToast('✅ Cobro registrado'); setShowCobro(false);
      setCobro({ importe: '', fecha: new Date().toISOString().split('T')[0], formaPago: 'CONTADO', texto: '' });
      await cargar(); onUpdated();
    } else { const d = await res.json(); showToast(d.error || 'Error'); }
    setWorking('');
  };

  const eliminarCobro = async (id: string) => {
    setWorking('dc' + id);
    const res = await fetch(`/api/ventas/cobros/${id}`, { method: 'DELETE', headers });
    if (res.ok) { showToast('✅ Cobro eliminado'); await cargar(); onUpdated(); }
    else showToast('Error');
    setWorking('');
  };

  if (!facturaId) return null;
  const est     = doc ? (ESTADOS[doc.estado] || ESTADOS.EMITIDA) : null;
  const lineas  = doc?.lineas || [];
  const cobros  = doc?.cobros || [];
  const pagado  = cobros.filter((c: any) => c.estado === 'PAGADO').reduce((s: any, c: any) => s + Number(c.importe), 0);
  const pendiente = Math.max(0, Number(doc?.total || 0) - pagado);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-slate-950 border-l border-slate-800 z-50 flex flex-col shadow-2xl" style={{ animation: 'slideIn .22s ease-out' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl whitespace-nowrap pointer-events-none">{toast}</div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div>
              <h2 className="text-white font-bold font-mono">{doc?.numeroCompleto || doc?.numero || '...'}</h2>
              <p className="text-slate-500 text-xs">Factura de venta</p>
            </div>
          </div>
          {est && <span className={`text-xs px-3 py-1 rounded-full border font-medium ${est.cls}`}>{est.label}</span>}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : doc ? (
          <div className="flex-1 overflow-y-auto">

            {/* Info bloque */}
            <div className="grid grid-cols-2 gap-3 p-5 border-b border-slate-800">
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cliente</p>
                <p className="text-white font-semibold text-sm">{doc.cliente?.nombre || '—'}</p>
                {doc.cliente?.cifNif    && <p className="text-slate-400 text-xs mt-0.5">{doc.cliente.cifNif}</p>}
                {doc.cliente?.direccion && <p className="text-slate-500 text-xs mt-1">{doc.cliente.direccion}</p>}
                {doc.cliente?.telefono  && <p className="text-slate-500 text-xs">📞 {doc.cliente.telefono}</p>}
                {doc.cliente?.email     && <p className="text-slate-500 text-xs">✉ {doc.cliente.email}</p>}
              </div>
              <div className="bg-slate-900 rounded-xl p-4 space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Detalles</p>
                {([['Fecha', fmtDate(doc.fecha)], doc.fechaVencimiento && ['Vencimiento', fmtDate(doc.fechaVencimiento)], doc.formaPago?.nombre && ['Forma pago', doc.formaPago.nombre]] as any[]).filter(Boolean).map(([k,v]: any) => (
                  <div key={k} className="flex justify-between text-sm"><span className="text-slate-400">{k}</span><span className="text-white">{v}</span></div>
                ))}
                <div className="border-t border-slate-800 pt-1.5 space-y-1 mt-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Base imponible</span><span className="text-slate-300">{fmt(Number(doc.baseImponible))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">IVA</span><span className="text-slate-300">{fmt(Number(doc.totalIva))}</span></div>
                  <div className="flex justify-between font-bold border-t border-slate-700 pt-1">
                    <span className="text-slate-200 text-sm">TOTAL</span><span className="text-white text-base">{fmt(Number(doc.total))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Líneas */}
            <div className="p-5 border-b border-slate-800">
              <h3 className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Líneas <span className="text-slate-600">({lineas.length})</span></h3>
              {lineas.length === 0 ? <p className="text-slate-600 text-sm italic">Sin líneas</p> : (
                <div className="space-y-1">
                  {lineas.map((l: any, i: number) => (
                    <div key={l.id || i} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800/60 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{l.descripcion || l.articulo?.nombre || '—'}</p>
                        {(l.articulo?.referencia) && <p className="text-slate-500 text-xs font-mono">{l.articulo.referencia}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 text-xs text-slate-400">
                        <p>{Number(l.cantidad).toLocaleString('es-ES')} × {fmt(Number(l.precioUnitario))}</p>
                        <p>IVA {l.tipoIva}%{l.descuento > 0 ? ` · Dto ${l.descuento}%` : ''}</p>
                      </div>
                      <div className="w-20 text-right flex-shrink-0">
                        <p className="text-white font-semibold text-sm">{fmt(Number(l.totalLinea))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cobros */}
            <div className="p-5 border-b border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-slate-500 uppercase tracking-wider">
                  Cobros · <span className={pendiente > 0.01 ? 'text-amber-400' : 'text-green-400'}>{pendiente > 0.01 ? `Pendiente ${fmt(pendiente)}` : '✓ Cobrada'}</span>
                </h3>
                {!['COBRADA','ANULADA'].includes(doc.estado) && (
                  <button onClick={() => setShowCobro(true)} className="px-2.5 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors font-medium">
                    + Añadir cobro
                  </button>
                )}
              </div>
              {cobros.length === 0 ? <p className="text-slate-600 text-sm italic">Sin cobros registrados</p> : (
                <div className="space-y-1">
                  {cobros.map((c: any) => (
                    <div key={c.id} className="flex items-center gap-3 py-2 px-3 bg-slate-900 rounded-lg">
                      <div className="flex-1">
                        <p className="text-white text-sm font-semibold">{fmt(Number(c.importe))}</p>
                        <p className="text-slate-500 text-xs">{fmtDate(c.fecha)} · {c.formaPago}{c.texto ? ` · ${c.texto}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${c.estado === 'PAGADO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{c.estado}</span>
                      <button onClick={() => eliminarCobro(c.id)} disabled={!!working} className="p-1 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {doc.observaciones && (
              <div className="p-5">
                <h3 className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Observaciones</h3>
                <p className="text-slate-300 text-sm">{doc.observaciones}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Footer */}
        {doc && (
          <div className="border-t border-slate-800 px-5 py-4 flex items-center gap-2 flex-shrink-0 flex-wrap bg-slate-950">
            {doc.estado === 'BORRADOR'  && <button onClick={() => cambiarEstado('EMITIDA')} disabled={!!working} className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 font-medium">Emitir</button>}
            {doc.estado === 'EMITIDA'   && <button onClick={() => cambiarEstado('COBRADA')} disabled={!!working} className="px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 font-medium">✓ Cobrada</button>}
            {doc.estado === 'EMITIDA'   && <button onClick={() => cambiarEstado('VENCIDA')} disabled={!!working} className="px-3 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Vencida</button>}
            {!['ANULADA','COBRADA'].includes(doc.estado) && <button onClick={() => cambiarEstado('ANULADA')} disabled={!!working} className="px-3 py-2 text-xs bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors">Anular</button>}
            <div className="flex-1" />
            <button onClick={() => imprimirDocumento(doc, 'FACTURA')} className="px-3 py-2 text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">🖨 Imprimir</button>
            {!confirmDel ? (
              <button onClick={() => setConfirmDel(true)} className="px-3 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">🗑 Eliminar</button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">¿Eliminar?</span>
                <button onClick={eliminar} disabled={working === 'del'} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 font-medium">{working === 'del' ? '...' : 'Sí'}</button>
                <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">No</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal cobro */}
      {showCobro && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCobro(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-bold mb-1">Registrar cobro</h3>
            <p className="text-slate-500 text-xs mb-4">Pendiente: <span className="text-amber-400 font-semibold">{fmt(pendiente)}</span></p>
            <div className="space-y-3">
              {[
                { label: 'Importe *', type: 'number', placeholder: '0.00', val: cobro.importe, set: (v: string) => setCobro(p => ({ ...p, importe: v })) },
                { label: 'Fecha', type: 'date', placeholder: '', val: cobro.fecha, set: (v: string) => setCobro(p => ({ ...p, fecha: v })) },
                { label: 'Notas (opcional)', type: 'text', placeholder: 'Referencia...', val: cobro.texto, set: (v: string) => setCobro(p => ({ ...p, texto: v })) },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs text-slate-400 mb-1 block">{f.label}</label>
                  <input type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} step={f.type === 'number' ? '0.01' : undefined}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              ))}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Forma de pago</label>
                <select value={cobro.formaPago} onChange={e => setCobro(p => ({ ...p, formaPago: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-slate-300 text-sm focus:outline-none focus:border-blue-500">
                  {['CONTADO','TRANSFERENCIA','TARJETA','RECIBO','CHEQUE','EFECTIVO'].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCobro(false)} className="flex-1 px-4 py-2.5 text-sm bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors">Cancelar</button>
              <button onClick={añadirCobro} disabled={working === 'cobro'} className="flex-1 px-4 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40 font-medium">
                {working === 'cobro' ? '...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
