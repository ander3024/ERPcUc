import { useState, useEffect } from 'react';
import { imprimirDocumento } from './printUtils';

const API = '/api/ventas';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');

const ESTADOS: Record<string, { label: string; cls: string }> = {
  BORRADOR:  { label: 'Borrador',  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  ENVIADO:   { label: 'Enviado',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ACEPTADO:  { label: 'Aceptado',  cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  RECHAZADO: { label: 'Rechazado', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  CADUCADO:  { label: 'Caducado',  cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

interface Props {
  presupuestoId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}

export default function PresupuestoDetalle({ presupuestoId, onClose, onUpdated }: Props) {
  const [doc, setDoc]               = useState<any>(null);
  const [loading, setLoading]       = useState(false);
  const [working, setWorking]       = useState('');
  const [toast, setToast]           = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const token   = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const cargar = async () => {
    if (!presupuestoId) return;
    setLoading(true);
    try { setDoc(await fetch(`${API}/presupuestos/${presupuestoId}`, { headers }).then(r => r.json())); }
    catch { showToast('Error al cargar'); } finally { setLoading(false); }
  };

  useEffect(() => { if (presupuestoId) { setDoc(null); setConfirmDel(false); cargar(); } }, [presupuestoId]);

  const cambiarEstado = async (s: string) => {
    setWorking('e');
    const res = await fetch(`${API}/presupuestos/${presupuestoId}`, { method: 'PUT', headers, body: JSON.stringify({ estado: s }) });
    if (res.ok) { showToast(`✅ ${ESTADOS[s]?.label}`); await cargar(); onUpdated(); }
    else { const d = await res.json(); showToast(d.error || 'Error'); }
    setWorking('');
  };

  const convertirPedido = async () => {
    setWorking('conv');
    const res = await fetch(`${API}/presupuestos/${presupuestoId}/convertir-pedido`, { method: 'POST', headers, body: '{}' });
    const d = await res.json();
    if (res.ok) { showToast('✅ Pedido creado'); await cargar(); onUpdated(); }
    else showToast(d.error || 'Error al convertir');
    setWorking('');
  };

  const eliminar = async () => {
    setWorking('del');
    const res = await fetch(`${API}/presupuestos/${presupuestoId}`, { method: 'DELETE', headers });
    if (res.ok) { showToast('✅ Eliminado'); onUpdated(); onClose(); }
    else { const d = await res.json(); showToast(d.error || 'No se puede eliminar'); }
    setWorking(''); setConfirmDel(false);
  };

  if (!presupuestoId) return null;
  const est    = doc ? (ESTADOS[doc.estado] || ESTADOS.BORRADOR) : null;
  const lineas = doc?.lineas || [];

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
              <h2 className="text-white font-bold font-mono">{doc?.numero || '...'}</h2>
              <p className="text-slate-500 text-xs">Presupuesto</p>
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

            {/* Info */}
            <div className="grid grid-cols-2 gap-3 p-5 border-b border-slate-800">
              <div className="bg-slate-900 rounded-xl p-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Cliente</p>
                <p className="text-white font-semibold text-sm">{doc.cliente?.nombre || doc.nombreCliente || '—'}</p>
                {doc.cliente?.cifNif    && <p className="text-slate-400 text-xs mt-0.5">{doc.cliente.cifNif}</p>}
                {doc.cliente?.direccion && <p className="text-slate-500 text-xs mt-1">{doc.cliente.direccion}</p>}
                {doc.cliente?.telefono  && <p className="text-slate-500 text-xs">📞 {doc.cliente.telefono}</p>}
                {doc.cliente?.email     && <p className="text-slate-500 text-xs">✉ {doc.cliente.email}</p>}
              </div>
              <div className="bg-slate-900 rounded-xl p-4 space-y-1.5">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Detalles</p>
                {([['Fecha', fmtDate(doc.fecha)], doc.fechaValidez && ['Válido hasta', fmtDate(doc.fechaValidez)], doc.formaPago?.nombre && ['Forma pago', doc.formaPago.nombre]] as any[]).filter(Boolean).map(([k,v]: any) => (
                  <div key={k} className="flex justify-between text-sm"><span className="text-slate-400">{k}</span><span className="text-white">{v}</span></div>
                ))}
                <div className="border-t border-slate-800 pt-1.5 space-y-1 mt-1">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Base</span><span className="text-slate-300">{fmt(Number(doc.baseImponible))}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">IVA</span><span className="text-slate-300">{fmt(Number(doc.totalIva))}</span></div>
                  <div className="flex justify-between font-bold border-t border-slate-700 pt-1">
                    <span className="text-slate-200 text-sm">TOTAL</span>
                    <span className="text-white text-base">{fmt(Number(doc.total))}</span>
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
                        {l.articulo?.referencia && <p className="text-slate-500 text-xs font-mono">{l.articulo.referencia}</p>}
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
            {doc.estado === 'BORRADOR'  && <button onClick={() => cambiarEstado('ENVIADO')} disabled={!!working} className="px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-40 font-medium">Enviar</button>}
            {doc.estado === 'ENVIADO'   && <button onClick={() => cambiarEstado('ACEPTADO')} disabled={!!working} className="px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40 font-medium">Aceptar</button>}
            {doc.estado === 'ENVIADO'   && <button onClick={() => cambiarEstado('RECHAZADO')} disabled={!!working} className="px-3 py-2 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors">Rechazar</button>}
            {doc.estado === 'ACEPTADO'  && (
              <button onClick={convertirPedido} disabled={!!working} className="px-3 py-2 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 font-medium">
                {working === 'conv' ? '...' : '→ Convertir a pedido'}
              </button>
            )}
            {!['RECHAZADO','CADUCADO'].includes(doc.estado) && (
              <button onClick={() => cambiarEstado('CADUCADO')} disabled={!!working} className="px-3 py-2 text-xs bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition-colors">Caducar</button>
            )}
            <div className="flex-1" />
            <button onClick={() => imprimirDocumento(doc, 'PRESUPUESTO')} className="px-3 py-2 text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">🖨 Imprimir</button>
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
    </>
  );
}
