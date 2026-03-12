import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, FileText, Euro, AlertCircle, CheckCircle, ChevronRight, X, Edit2, Trash2, Save, AlertTriangle, Plus, CreditCard, Copy, Send, Mail, Loader2, Download, ArrowUpDown, ArrowUp, ArrowDown, Printer, CheckSquare, Square, MinusSquare, Clock, CalendarClock } from 'lucide-react';
import { imprimirDocumento, getEmailDefaults } from '../../utils/printUtils';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const ESTADO: Record<string, { label: string; color: string }> = {
  BORRADOR:             { label: 'Borrador',       color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  EMITIDA:              { label: 'Emitida',        color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  PARCIALMENTE_COBRADA: { label: 'Parc. cobrada',  color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  COBRADA:              { label: 'Cobrada',        color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  VENCIDA:              { label: 'Vencida',        color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  ANULADA:              { label: 'Anulada',        color: 'bg-slate-600/20 text-slate-400 border-slate-600/30' },
};

const METODOS = ['TRANSFERENCIA','EFECTIVO','CHEQUE','DOMICILIACION','TARJETA','PAGARE'];

const ESTADO_VTO: Record<string, { label: string; color: string }> = {
  PENDIENTE:      { label: 'Pendiente',      color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' },
  VENCIDO:        { label: 'Vencido',         color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  PAGADO_PARCIAL: { label: 'Parc. pagado',    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  PAGADO:         { label: 'Pagado',           color: 'bg-green-500/20 text-green-300 border-green-500/30' },
};

function PanelDetalle({ id, onClose, onRefresh }: { id: string; onClose: () => void; onRefresh: () => void }) {
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCobro, setShowCobro] = useState(false);
  const [cobroForm, setCobroForm] = useState({ importe: '', formaPago: 'TRANSFERENCIA', referencia: '', fecha: new Date().toISOString().slice(0,10) });
  const [msg, setMsg] = useState<{type: string; text: string} | null>(null);
  const [showCopiar, setShowCopiar] = useState(false);
  const [copiarQuery, setCopiarQuery] = useState('');
  const [copiarSugerencias, setCopiarSugerencias] = useState<any[]>([]);
  const [copiando, setCopiando] = useState(false);
  const [showEnviar, setShowEnviar] = useState(false);
  const [enviarEmail, setEnviarEmail] = useState('');
  const [enviarAsunto, setEnviarAsunto] = useState('');
  const [enviarMensaje, setEnviarMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recordatorios, setRecordatorios] = useState<any[]>([]);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/ventas/facturas/' + id, { headers: headers() });
      if (!r.ok) throw new Error('Error ' + r.status);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      setDoc(d);
      setCobroForm(prev => ({ ...prev, importe: String(d.pendiente || d.total || '') }));
      // Fetch recordatorios
      fetch(API + '/ventas/recordatorios?facturaId=' + id, { headers: headers() })
        .then(r => r.json())
        .then(data => setRecordatorios(Array.isArray(data) ? data : []))
        .catch(() => {});
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Error al cargar factura' });
    } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, [id]);

  const cambiarEstado = async (s: string) => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/facturas/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify({ estado: s }) });
      setMsg({type:'ok', text:'Estado: ' + ESTADO[s]?.label}); cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); }
    setSaving(false);
  };

  const registrarCobro = async () => {
    setSaving(true);
    try {
      const body = { facturaId: id, clienteId: doc.clienteId, importe: parseFloat(cobroForm.importe), formaPago: cobroForm.formaPago, referencia: cobroForm.referencia || undefined, fecha: cobroForm.fecha };
      const r = await fetch(API + '/ventas/cobros', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      setMsg({type:'ok', text:'Cobro registrado: ' + fmt(body.importe)}); setShowCobro(false); cargar(); onRefresh();
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); }
    setSaving(false);
  };

  const eliminar = async () => {
    setSaving(true);
    try {
      await fetch(API + '/ventas/facturas/' + id, { method: 'DELETE', headers: headers() });
      onRefresh(); onClose();
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); setSaving(false); }
  };

  const abrirEnviar = () => {
    const defaults = getEmailDefaults('factura', doc);
    setEnviarEmail(doc.cliente?.email || '');
    setEnviarAsunto(defaults.subject);
    setEnviarMensaje(defaults.body);
    setShowEnviar(true);
  };

  const enviarFactura = async () => {
    if (!enviarEmail) { setMsg({ type: 'error', text: 'Escribe un email destino' }); return; }
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch(API + '/config/facturas/' + id + '/enviar', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ to: enviarEmail, subject: enviarAsunto, body: enviarMensaje }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al enviar');
      setMsg({ type: 'ok', text: d.message || 'Factura enviada por email' });
      setShowEnviar(false);
      setTimeout(() => setMsg(null), 5000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setEnviando(false);
  };

  const enviarRecordatorio = async () => {
    const vencido = doc.vencimientos?.find((v: any) => v.estado === 'VENCIDO');
    if (!vencido) return;
    setSaving(true);
    try {
      await fetch(API + '/ventas/recordatorios/enviar/' + vencido.id, { method: 'POST', headers: headers() });
      setMsg({type:'ok', text:'Recordatorio creado'});
      // Refresh recordatorios
      const r = await fetch(API + '/ventas/recordatorios?facturaId=' + id, { headers: headers() });
      const data = await r.json();
      setRecordatorios(Array.isArray(data) ? data : []);
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) { setMsg({type:'error', text: String(e.message)}); }
    setSaving(false);
  };

  useEffect(() => {
    if (copiarQuery.length < 2) { setCopiarSugerencias([]); return; }
    const t = setTimeout(() => {
      fetch(API + '/clientes?search=' + encodeURIComponent(copiarQuery) + '&limit=10', { headers: headers() })
        .then(r => r.json())
        .then(d => setCopiarSugerencias(Array.isArray(d) ? d : (d.data || [])))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [copiarQuery]);

  const copiarFactura = async (clienteId: string) => {
    setCopiando(true);
    try {
      const lineas = (doc.lineas || []).map((l: any) => ({
        articuloId: l.articuloId || undefined,
        referencia: l.referencia || undefined,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitario: l.precioUnitario,
        descuento: l.descuento || 0,
        iva: l.tipoIva || 21,
      }));
      const body = { clienteId, lineas, observaciones: 'Copia de ' + (doc.numeroCompleto || '') };
      const r = await fetch(API + '/ventas/facturas', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Error al copiar'); }
      const nueva = await r.json();
      setShowCopiar(false); setCopiarQuery(''); setCopiarSugerencias([]);
      setMsg({ type: 'ok', text: 'Factura copiada: ' + (nueva.numeroCompleto || nueva.numero || '') });
      onRefresh();
      setTimeout(() => { setMsg(null); navigate('/ventas/facturas'); }, 2000);
    } catch (e: any) { setMsg({ type: 'error', text: e.message }); }
    setCopiando(false);
  };

  const isVencida = doc && doc.fechaVencimiento && new Date(doc.fechaVencimiento) < new Date() && doc.estado !== 'COBRADA' && doc.estado !== 'ANULADA';

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/></div>;
  if (!doc) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between p-5 border-b border-slate-700 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg font-bold text-white font-mono">{doc.numeroCompleto || doc.serie + doc.numero}</span>
            <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[doc.estado]?.color || '')}>{ESTADO[doc.estado]?.label}</span>
            {isVencida && <span className="text-xs px-2 py-1 rounded-full bg-red-600/30 text-red-300 border border-red-600/40 font-medium">Vencida</span>}
          </div>
          <div className="text-sm text-slate-400">{doc.cliente?.nombre || doc.nombreCliente}</div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400"><X className="w-5 h-5"/></button>
      </div>

      {msg && <div className={"mx-5 mt-3 px-3 py-2 rounded-lg text-sm font-medium " + (msg.type==='ok' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>{msg.text}</div>}

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Fecha</div><div className="text-sm text-white">{fmtDate(doc.fecha)}</div></div>
          <div className={"rounded-lg p-3 " + (isVencida ? 'bg-red-900/30' : 'bg-slate-700/50')}>
            <div className="text-xs text-slate-500 mb-1">Vencimiento</div>
            <div className={"text-sm font-medium " + (isVencida ? 'text-red-400' : 'text-white')}>{fmtDate(doc.fechaVencimiento)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">CIF/NIF</div><div className="text-sm text-white">{doc.cliente?.cifNif || doc.cifNif || '-'}</div></div>
          <div className="bg-slate-700/50 rounded-lg p-3"><div className="text-xs text-slate-500 mb-1">Forma de pago</div><div className="text-sm text-white">{doc.formaPago?.nombre || '-'}</div></div>
        </div>

        <div className="bg-slate-700/30 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-400">Total factura</span>
            <span className="text-white font-semibold">{fmt(doc.total)}</span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-400">Cobrado</span>
            <span className="text-green-400 font-semibold">{fmt(doc.totalPagado || doc.cobrado || 0)}</span>
          </div>
          {(doc.pendiente > 0) && (
            <div className="flex justify-between items-center pt-2 border-t border-slate-600">
              <span className="text-sm font-medium text-orange-400">Pendiente</span>
              <span className="text-orange-400 font-bold">{fmt(doc.pendiente)}</span>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Cambiar estado</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ESTADO).map(([k, v]) => (
              <button key={k} onClick={() => cambiarEstado(k)} disabled={saving || doc.estado === k}
                className={"text-xs px-3 py-1.5 rounded-full border font-medium transition-all " + (doc.estado === k ? v.color + ' opacity-50' : 'border-slate-600 text-slate-400 hover:border-slate-400 hover:text-white')}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {doc.lineas?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Lineas ({doc.lineas.length})</div>
            <div className="space-y-2">
              {doc.lineas.map((l: any, i: number) => (
                <div key={l.id} className="bg-slate-700/50 rounded-lg p-3 flex justify-between gap-2">
                  <div className="text-sm text-white flex-1 min-w-0 truncate">{l.descripcion || 'Linea ' + (i+1)}</div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-white">{fmt(l.totalLinea)}</div>
                    <div className="text-xs text-slate-500">{l.cantidad} x {fmt(l.precioUnitario)} · {l.tipoIva}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {doc.cobros?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Cobros registrados</div>
            <div className="space-y-2">
              {doc.cobros.map((c: any) => (
                <div key={c.id} className="bg-slate-700/50 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-white">{c.formaPago}</div>
                    <div className="text-xs text-slate-500">{fmtDate(c.fecha)} {c.referencia ? '· ' + c.referencia : ''}</div>
                  </div>
                  <span className="text-green-400 font-semibold text-sm">{fmt(c.importe)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {doc.vencimientos?.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />Vencimientos ({doc.vencimientos.length})
            </div>
            {doc.vencimientos.some((v: any) => v.estado === 'VENCIDO') && (
              <div className="mb-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded-lg text-xs text-red-300 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />Factura con vencimientos vencidos sin pagar
              </div>
            )}
            <div className="space-y-2">
              {doc.vencimientos.map((v: any) => {
                const est = ESTADO_VTO[v.estado] || ESTADO_VTO.PENDIENTE;
                return (
                  <div key={v.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-mono">#{v.numero}</span>
                        <span className={"text-xs px-2 py-0.5 rounded-full border font-medium " + est.color}>{est.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{fmt(v.importe)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />{fmtDate(v.fechaVencimiento)}
                      </div>
                      {v.importePagado > 0 && (
                        <span className="text-xs text-green-400">Pagado: {fmt(v.importePagado)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recordatorios section */}
        {doc.vencimientos?.some((v: any) => v.estado === 'VENCIDO') && (
          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase">Recordatorios</h4>
              <button
                onClick={enviarRecordatorio}
                disabled={saving}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-600 hover:bg-orange-500 text-white rounded transition-colors disabled:opacity-50"
              >
                <Mail size={12} /> Enviar recordatorio
              </button>
            </div>
            {recordatorios.length > 0 ? (
              <div className="space-y-1">
                {recordatorios.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-700/30 last:border-0">
                    <span className="text-slate-300">Nivel {r.nivel} - {fmtDate(r.createdAt)}</span>
                    <span className={r.enviado ? "text-green-400" : "text-slate-500"}>{r.enviado ? "Enviado" : "Pendiente"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Sin recordatorios enviados</p>
            )}
          </div>
        )}

        {showCobro && (
          <div className="bg-slate-700/50 rounded-xl p-4 space-y-3 border border-indigo-500/30">
            <div className="text-xs font-medium text-indigo-400 uppercase tracking-wide">Registrar cobro</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Importe</label>
                <input type="number" step="0.01" value={cobroForm.importe} onChange={e => setCobroForm({...cobroForm, importe: e.target.value})}
                  className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Fecha</label>
                <input type="date" value={cobroForm.fecha} onChange={e => setCobroForm({...cobroForm, fecha: e.target.value})}
                  className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"/>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Metodo de pago</label>
              <select value={cobroForm.formaPago} onChange={e => setCobroForm({...cobroForm, formaPago: e.target.value})}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none">
                {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Referencia (opcional)</label>
              <input type="text" value={cobroForm.referencia} onChange={e => setCobroForm({...cobroForm, referencia: e.target.value})}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none"
                placeholder="N. transferencia, cheque..."/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowCobro(false)} className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancelar</button>
              <button onClick={registrarCobro} disabled={saving || !cobroForm.importe}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded text-sm font-medium">
                <Save className="w-4 h-4"/>Guardar cobro
              </button>
            </div>
          </div>
        )}

        {showEnviar && (
          <div className="bg-slate-700/50 rounded-xl p-4 space-y-3 border border-emerald-500/30">
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />Enviar factura por email
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Para</label>
              <input type="email" value={enviarEmail} onChange={e => setEnviarEmail(e.target.value)}
                placeholder="cliente@ejemplo.com"
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Asunto</label>
              <input type="text" value={enviarAsunto} onChange={e => setEnviarAsunto(e.target.value)}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Mensaje</label>
              <textarea value={enviarMensaje} onChange={e => setEnviarMensaje(e.target.value)} rows={4}
                className="w-full bg-slate-600 border border-slate-500 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowEnviar(false)} className="flex-1 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancelar</button>
              <button onClick={enviarFactura} disabled={enviando || !enviarEmail}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded text-sm font-medium">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-slate-700 mt-4 pt-4 space-y-2">
          {!showCobro && doc.estado !== 'COBRADA' && doc.estado !== 'ANULADA' && (
            <button onClick={() => setShowCobro(true)}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <CreditCard className="w-4 h-4"/>Registrar cobro
            </button>
          )}

          {!showEnviar && doc.estado !== 'ANULADA' && (
            <button onClick={abrirEnviar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
              <Mail className="w-4 h-4"/>Enviar por email
            </button>
          )}

          <button onClick={() => imprimirDocumento(doc, 'Factura')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors">
            <FileText className="w-4 h-4"/>Imprimir
          </button>

          {/* Editar factura - reglas por estado */}
          {doc.estado !== 'ANULADA' && (() => {
            const hasCobros = (doc.cobros?.length || 0) > 0;
            const esEditable = doc.estado === 'BORRADOR' || doc.estado === 'EMITIDA' || doc.estado === 'VENCIDA';
            const esCobrada = doc.estado === 'COBRADA' || doc.estado === 'PARCIALMENTE_COBRADA';

            if (esCobrada || (esEditable && hasCobros)) {
              return (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg text-xs text-orange-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
                  <span>Para editar esta factura primero elimina los cobros registrados ({doc.cobros?.length || 0}).</span>
                </div>
              );
            }

            if (esEditable && !hasCobros) {
              return (
                <button
                  onClick={() => navigate('/ventas/nuevo/factura?edit=' + id)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4"/>Editar factura
                </button>
              );
            }

            return null;
          })()}

          <button onClick={() => { setShowCopiar(true); setCopiarQuery(''); setCopiarSugerencias([]); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Copy className="w-4 h-4" />Copiar factura
          </button>

          {showCopiar && (
            <div className="bg-slate-700/50 rounded-xl p-4 space-y-3 border border-violet-500/30">
              <div className="text-xs font-medium text-violet-400 uppercase tracking-wide">Copiar a otro cliente</div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Buscar cliente destino</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input type="text" value={copiarQuery} onChange={e => setCopiarQuery(e.target.value)}
                    className="w-full bg-slate-600 border border-slate-500 rounded pl-7 pr-2 py-1.5 text-sm text-white focus:outline-none focus:border-violet-500"
                    placeholder="Nombre o CIF..." autoFocus />
                </div>
                {copiarSugerencias.length > 0 && (
                  <div className="mt-1 max-h-40 overflow-y-auto bg-slate-600 border border-slate-500 rounded">
                    {copiarSugerencias.map((c: any) => (
                      <button key={c.id} onClick={() => copiarFactura(c.id)} disabled={copiando}
                        className="w-full text-left px-3 py-2 hover:bg-violet-500/20 border-b border-slate-500/50 last:border-0 disabled:opacity-50">
                        <div className="text-sm text-white font-medium">{c.nombre}</div>
                        <div className="text-xs text-slate-400">{c.cifNif || c.nif || ''} {c.email ? '· ' + c.email : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-xs text-slate-500">Se copiaran {doc.lineas?.length || 0} lineas con fecha actual</div>
              <button onClick={() => setShowCopiar(false)} className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">Cancelar</button>
            </div>
          )}

          <div className="flex gap-2">
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm">
                <Trash2 className="w-4 h-4"/>Eliminar
              </button>
            ) : (
              <button onClick={eliminar} disabled={saving} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium">
                <AlertTriangle className="w-4 h-4"/>Confirmar borrado
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FacturasVentaPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [sortBy, setSortBy] = useState('fecha');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [limit, setLimit] = useState(() => {
    const saved = localStorage.getItem('erp_page_limit');
    return saved ? parseInt(saved) : 20;
  });
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkEstado, setBulkEstado] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search });
      if (estadoFilter) params.set('estado', estadoFilter);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);
      const [dr, sr] = await Promise.all([
        fetch(API + '/ventas/facturas?' + params, { headers: headers() }).then(r => { if (!r.ok) throw new Error('Error ' + r.status); return r.json(); }),
        fetch(API + '/ventas/facturas/stats', { headers: headers() }).then(r => r.ok ? r.json() : {}).catch(() => ({})),
      ]);
      setData(Array.isArray(dr.data) ? dr.data : []);
      setPagination(dr.pagination || { page: 1, total: 0, pages: 0 });
      setStats(sr);
      setCheckedIds(new Set());
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, estadoFilter, desde, hasta, limit]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir(col === 'fecha' ? 'desc' : 'asc'); }
  };

  const sortedData = [...data].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const va = a[sortBy], vb = b[sortBy];
    if (typeof va === 'number') return (va - vb) * dir;
    if (sortBy === 'fecha' || sortBy === 'fechaVencimiento') return (new Date(va || 0).getTime() - new Date(vb || 0).getTime()) * dir;
    return String(va || '').localeCompare(String(vb || '')) * dir;
  });

  const exportCSV = () => {
    const rows = data.map(f => [
      f.numeroCompleto || '', f.cliente?.nombre || f.nombreCliente || '', fmtDate(f.fecha),
      fmtDate(f.fechaVencimiento), f.baseImponible?.toFixed(2) || '0', f.totalIva?.toFixed(2) || '0',
      f.total?.toFixed(2) || '0', f.totalPagado?.toFixed(2) || '0', ESTADO[f.estado]?.label || f.estado,
    ]);
    const csv = ['Numero;Cliente;Fecha;Vencimiento;Base;IVA;Total;Pagado;Estado', ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `facturas_venta_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <ArrowUpDown className="w-3 h-3 text-slate-600" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  };

  const isVencida = (f: any) => f.estado === 'VENCIDA' || (f.fechaVencimiento && new Date(f.fechaVencimiento) < new Date() && f.estado !== 'COBRADA' && f.estado !== 'ANULADA');

  // Bulk selection
  const toggleCheck = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allChecked = sortedData.length > 0 && sortedData.every(f => checkedIds.has(f.id));
  const someChecked = sortedData.some(f => checkedIds.has(f.id));
  const toggleAll = () => {
    if (allChecked) setCheckedIds(new Set());
    else setCheckedIds(new Set(sortedData.map(f => f.id)));
  };

  const bulkCambiarEstado = async () => {
    if (!bulkEstado || checkedIds.size === 0) return;
    setBulkLoading(true);
    try {
      await fetch(API + '/ventas/facturas/bulk/estado', { method: 'PUT', headers: headers(), body: JSON.stringify({ ids: Array.from(checkedIds), estado: bulkEstado }) });
      setBulkEstado('');
      cargar(pagination.page);
    } catch {} finally { setBulkLoading(false); }
  };

  const bulkImprimir = async () => {
    const selected = sortedData.filter(f => checkedIds.has(f.id));
    for (const f of selected) {
      try {
        const doc = await fetch(API + '/ventas/facturas/' + f.id, { headers: headers() }).then(r => r.json());
        imprimirDocumento(doc, 'Factura');
      } catch {}
    }
  };

  const bulkMarcarCobrada = async () => {
    setBulkLoading(true);
    try {
      await fetch(API + '/ventas/facturas/bulk/estado', { method: 'PUT', headers: headers(), body: JSON.stringify({ ids: Array.from(checkedIds), estado: 'COBRADA' }) });
      cargar(pagination.page);
    } catch {} finally { setBulkLoading(false); }
  };

  const kpis = [
    { label: 'Total facturas', value: pagination.total, icon: FileText, color: 'text-indigo-400' },
    { label: 'Pendiente cobro', value: fmt(stats.totalPendiente || 0), icon: Euro, color: 'text-orange-400', isText: true },
    { label: 'Cobrado', value: fmt(stats.totalCobrado || 0), icon: CheckCircle, color: 'text-green-400', isText: true },
    { label: 'Vencidas', value: stats.vencidas || 0, icon: AlertCircle, color: 'text-red-400' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate("/ventas/nuevo/factura")}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuevo
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400"/>Facturas de venta
            </h1>
            <p className="text-slate-400 text-sm mt-1">{pagination.total} facturas</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k, i) => (
            <div key={i} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{k.label}</span>
                <k.icon className={"w-5 h-5 " + k.color}/>
              </div>
              <div className={"font-bold " + (k.isText ? 'text-white text-lg' : 'text-white text-2xl')}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="p-4 border-b border-slate-700 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
              <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Buscar cliente o numero..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
            </div>
            <select className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" title="Desde" />
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" title="Hasta" />
            <select value={limit} onChange={e => setLimit(parseInt(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white focus:outline-none w-16" title="Filas">
              <option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <button onClick={exportCSV} className="p-2 text-slate-400 hover:text-green-400 hover:bg-slate-700 rounded-lg" title="Exportar CSV"><Download className="w-4 h-4"/></button>
            <button onClick={() => cargar(1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
          </div>

          {/* Bulk actions toolbar */}
          {checkedIds.size > 0 && (
            <div className="px-4 py-3 bg-indigo-500/10 border-b border-indigo-500/30 flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-indigo-300">{checkedIds.size} seleccionadas</span>
              <div className="h-4 w-px bg-slate-600" />
              <div className="flex items-center gap-2">
                <select value={bulkEstado} onChange={e => setBulkEstado(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white focus:outline-none">
                  <option value="">Cambiar estado...</option>
                  {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {bulkEstado && (
                  <button onClick={bulkCambiarEstado} disabled={bulkLoading}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-xs font-medium">
                    Aplicar
                  </button>
                )}
              </div>
              <button onClick={bulkMarcarCobrada} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/80 hover:bg-green-600 disabled:opacity-50 text-white rounded text-xs font-medium">
                <CheckCircle className="w-3.5 h-3.5" />Marcar cobradas
              </button>
              <button onClick={bulkImprimir}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs font-medium">
                <Printer className="w-3.5 h-3.5" />Imprimir
              </button>
              <button onClick={() => setCheckedIds(new Set())} className="ml-auto text-xs text-slate-400 hover:text-white">
                Deseleccionar
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-slate-400"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>Cargando...</div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay facturas</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-700">
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-white">
                      {allChecked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : someChecked ? <MinusSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  {[
                    { key: 'numeroCompleto', label: 'Numero' },
                    { key: 'nombreCliente', label: 'Cliente' },
                    { key: 'fecha', label: 'Fecha' },
                    { key: 'fechaVencimiento', label: 'Vencimiento' },
                    { key: 'baseImponible', label: 'Base' },
                    { key: 'totalIva', label: 'IVA' },
                    { key: 'total', label: 'Total' },
                    { key: 'estado', label: 'Estado' },
                    { key: '', label: '' },
                  ].map(h => (
                    <th key={h.label || '_'} onClick={() => h.key && toggleSort(h.key)}
                      className={"text-left text-slate-400 text-xs font-medium px-4 py-3 uppercase tracking-wide " + (h.key ? 'cursor-pointer hover:text-white select-none' : '')}>
                      <span className="flex items-center gap-1">{h.label}{h.key && <SortIcon col={h.key} />}</span>
                    </th>
                  ))}
                </tr></thead>
                <tbody>{sortedData.map(f => (
                  <tr key={f.id}
                    className={"border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors group " + (checkedIds.has(f.id) ? 'bg-indigo-500/10' : f.id === selectedId ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : isVencida(f) ? 'bg-red-900/10' : '')}>
                    <td className="px-3 py-3 w-10" onClick={e => { e.stopPropagation(); toggleCheck(f.id); }}>
                      {checkedIds.has(f.id) ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-indigo-400 font-medium" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{f.numeroCompleto || (f.serie + f.numero)}</td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>
                      <div className="text-sm text-white font-medium truncate max-w-32">{f.cliente?.nombre || f.nombreCliente || '-'}</div>
                      {f.cliente?.cifNif && <div className="text-xs text-slate-500">{f.cliente.cifNif}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{fmtDate(f.fecha)}</td>
                    <td className={"px-4 py-3 text-sm " + (isVencida(f) ? 'text-red-400 font-medium' : 'text-slate-400')} onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{fmtDate(f.fechaVencimiento)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{fmt(f.baseImponible)}</td>
                    <td className="px-4 py-3 text-sm text-slate-400" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{fmt(f.totalIva)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-white" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>{fmt(f.total)}</td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}>
                      <span className={"text-xs px-2 py-1 rounded-full border font-medium " + (ESTADO[f.estado]?.color || 'bg-slate-600 text-slate-300')}>{ESTADO[f.estado]?.label || f.estado}</span>
                    </td>
                    <td className="px-4 py-3" onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}><ChevronRight className={"w-4 h-4 transition-transform " + (f.id===selectedId ? 'rotate-90 text-indigo-400' : 'text-slate-500 group-hover:text-slate-300')}/></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          <div className="p-4 flex items-center justify-between border-t border-slate-700">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">Mostrando {Math.min((pagination.page - 1) * limit + 1, pagination.total)}-{Math.min(pagination.page * limit, pagination.total)} de {pagination.total}</span>
              <select value={limit} onChange={e => { const v = parseInt(e.target.value); setLimit(v); localStorage.setItem('erp_page_limit', String(v)); }} className="bg-slate-700 border border-slate-600 text-slate-300 text-xs rounded-lg px-2 py-1">
                <option value={20}>20/pag</option>
                <option value={50}>50/pag</option>
                <option value={100}>100/pag</option>
              </select>
            </div>
            {pagination.pages > 1 && (
              <div className="flex gap-1">
                <button onClick={() => cargar(1)} disabled={pagination.page<=1} className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg">1</button>
                <button onClick={() => cargar(pagination.page-1)} disabled={pagination.page<=1} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Ant</button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const start = Math.max(1, Math.min(pagination.page - 2, pagination.pages - 4));
                  const p = start + i;
                  if (p > pagination.pages) return null;
                  return <button key={p} onClick={() => cargar(p)} className={"px-2.5 py-1.5 text-xs rounded-lg " + (p === pagination.page ? 'bg-indigo-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300')}>{p}</button>;
                })}
                <button onClick={() => cargar(pagination.page+1)} disabled={pagination.page>=pagination.pages} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg">Sig</button>
                <button onClick={() => cargar(pagination.pages)} disabled={pagination.page>=pagination.pages} className="px-2 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-xs rounded-lg">{pagination.pages}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedId && (
        <div className="w-96 shrink-0 border-l border-slate-700 bg-slate-800 overflow-hidden flex flex-col">
          <PanelDetalle id={selectedId} onClose={() => setSelectedId(null)} onRefresh={() => cargar(pagination.page)} />
        </div>
      )}
    </div>
  );
}
