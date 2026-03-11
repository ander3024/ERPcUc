import { useState, useEffect } from 'react';
import { imprimirDocumento } from './printUtils';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const ESTADOS: Record<string, { label: string; cls: string }> = {
  PENDIENTE:  { label: 'Pendiente',  cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  FACTURADO:  { label: 'Facturado',  cls: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
};

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors';

interface Props {
  id: string;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AlbaranDetalle({ id, onClose, onRefresh }: Props) {
  const [albaran,  setAlbaran]  = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [working,  setWorking]  = useState('');
  const [toast,    setToast]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [editMode, setEditMode] = useState(false);
  const [obs,      setObs]      = useState('');

  const token   = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/ventas/albaranes/${id}`, { headers });
      const d = await r.json();
      setAlbaran(d);
      setObs(d.observaciones || '');
    } catch { showToast('Error al cargar'); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  // Cerrar con Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const cambiarEstado = async (estado: string) => {
    setWorking(estado);
    try {
      const r = await fetch(`${API}/ventas/albaranes/${id}`, {
        method: 'PUT', headers, body: JSON.stringify({ estado }),
      });
      if (r.ok) { showToast(`Estado → ${ESTADOS[estado]?.label}`); cargar(); onRefresh(); }
      else { const d = await r.json(); showToast(d.error || 'Error'); }
    } catch { showToast('Error de conexión'); }
    finally { setWorking(''); }
  };

  const guardarObs = async () => {
    setWorking('obs');
    try {
      const r = await fetch(`${API}/ventas/albaranes/${id}`, {
        method: 'PUT', headers, body: JSON.stringify({ observaciones: obs }),
      });
      if (r.ok) { showToast('Guardado'); setEditMode(false); cargar(); onRefresh(); }
      else { const d = await r.json(); showToast(d.error || 'Error'); }
    } catch { showToast('Error de conexión'); }
    finally { setWorking(''); }
  };

  const convertirFactura = async () => {
    setWorking('factura');
    try {
      const r = await fetch(`${API}/ventas/albaranes/${id}/convertir-factura`, {
        method: 'POST', headers, body: JSON.stringify({}),
      });
      const d = await r.json();
      if (r.ok) { showToast('Factura creada'); cargar(); onRefresh(); }
      else showToast(d.error || 'Error al convertir');
    } catch { showToast('Error de conexión'); }
    finally { setWorking(''); setConfirm(''); }
  };

  const eliminar = async () => {
    setWorking('del');
    try {
      const r = await fetch(`${API}/ventas/albaranes/${id}`, { method: 'DELETE', headers });
      if (r.ok) { onRefresh(); onClose(); }
      else { const d = await r.json(); showToast(d.error || 'No se puede eliminar'); }
    } catch { showToast('Error de conexión'); }
    finally { setWorking(''); setConfirm(''); }
  };

  const est = albaran ? (ESTADOS[albaran.estado] || ESTADOS.PENDIENTE) : ESTADOS.PENDIENTE;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col"
        style={{ animation: 'slideIn .22s ease-out' }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Toast */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl whitespace-nowrap">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            {albaran && (
              <>
                <span className="font-mono text-lg font-bold text-white">{albaran.numero}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${est.cls}`}>{est.label}</span>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : albaran ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Datos principales */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Datos del albarán</h3>
              <Row label="Cliente"      value={albaran.cliente?.nombre || albaran.nombreCliente} />
              <Row label="CIF/NIF"      value={albaran.cliente?.cifNif || albaran.cifNif} mono />
              <Row label="Fecha"        value={fmtDate(albaran.fecha)} />
              {albaran.pedido && <Row label="Pedido origen" value={albaran.pedido.numero} mono />}
              {albaran.facturado && <Row label="Facturado" value="Sí ✓" />}
            </div>

            {/* Líneas */}
            {albaran.lineas?.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Líneas ({albaran.lineas.length})
                  </h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-2 text-xs text-slate-500">Descripción</th>
                      <th className="text-right px-4 py-2 text-xs text-slate-500">Cant.</th>
                      <th className="text-right px-4 py-2 text-xs text-slate-500">Precio</th>
                      <th className="text-right px-4 py-2 text-xs text-slate-500">IVA</th>
                      <th className="text-right px-4 py-2 text-xs text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {albaran.lineas.map((l: any) => (
                      <tr key={l.id} className="border-b border-slate-800/50">
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-white">{l.descripcion}</p>
                          {l.referencia && <p className="text-xs text-slate-500 font-mono">{l.referencia}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-300">{l.cantidad}</td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-300">{fmt(Number(l.precioUnitario))}</td>
                        <td className="px-4 py-2.5 text-right text-sm text-slate-400">{l.tipoIva}%</td>
                        <td className="px-4 py-2.5 text-right text-sm font-semibold text-white">{fmt(Number(l.totalLinea))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Totales */}
                <div className="px-4 py-3 border-t border-slate-800 space-y-1 bg-slate-900/50">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Base imponible</span><span>{fmt(Number(albaran.baseImponible))}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>IVA</span><span>{fmt(Number(albaran.totalIva))}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-700 mt-1">
                    <span>Total</span><span>{fmt(Number(albaran.total))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Observaciones */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Observaciones</h3>
                {!editMode
                  ? <button onClick={() => setEditMode(true)} className="text-xs text-blue-400 hover:text-blue-300">Editar</button>
                  : <div className="flex gap-2">
                      <button onClick={() => { setEditMode(false); setObs(albaran.observaciones || ''); }} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                      <button onClick={guardarObs} disabled={working === 'obs'} className="text-xs text-green-400 hover:text-green-300 font-medium">
                        {working === 'obs' ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                }
              </div>
              {editMode
                ? <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} className={`${inp} resize-none`} placeholder="Observaciones..." />
                : <p className="text-sm text-slate-400 italic">{albaran.observaciones || 'Sin observaciones'}</p>
              }
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">No encontrado</div>
        )}

        {/* Footer acciones */}
        {albaran && (
          <div className="flex-shrink-0 border-t border-slate-800 px-6 py-4 space-y-3">

            {/* Cambio de estado */}
            <div className="flex gap-2 flex-wrap">
              {albaran.estado === 'PENDIENTE' && (
                <>
                  {confirm === 'factura' ? (
                    <div className="flex items-center gap-2 bg-slate-900 border border-purple-500/30 rounded-xl px-3 py-2 flex-1">
                      <span className="text-xs text-purple-300 flex-1">¿Crear factura desde este albarán?</span>
                      <button onClick={convertirFactura} disabled={working === 'factura'}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                        {working === 'factura' ? '...' : 'Sí, facturar'}
                      </button>
                      <button onClick={() => setConfirm('')} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-lg">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm('factura')}
                      className="flex-1 py-2 text-xs font-medium text-purple-400 border border-purple-500/20 rounded-xl hover:bg-purple-500/10 transition-colors">
                      Convertir a factura
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Acciones principales */}
            <div className="flex gap-2">
              <button onClick={() => imprimirDocumento(albaran, 'Albarán')}
                className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-500 hover:text-white transition-colors">
                Imprimir
              </button>

              {confirm === 'del' ? (
                <div className="flex items-center gap-2 bg-slate-900 border border-red-500/30 rounded-xl px-3 py-2 flex-1">
                  <span className="text-xs text-red-400 flex-1">¿Eliminar albarán?</span>
                  <button onClick={eliminar} disabled={working === 'del'}
                    className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">
                    {working === 'del' ? '...' : 'Eliminar'}
                  </button>
                  <button onClick={() => setConfirm('')} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-lg">No</button>
                </div>
              ) : (
                <button onClick={() => setConfirm('del')}
                  className="px-4 py-2.5 text-sm text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors">
                  Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Row({ label, value, mono = false }: { label: string; value?: any; mono?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
