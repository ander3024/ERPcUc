import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');
const token = () => localStorage.getItem('accessToken') || '';
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() });

const IVA_TIPOS = [
  { value: 21, label: 'General 21%' },
  { value: 10, label: 'Reducido 10%' },
  { value: 4,  label: 'Superreducido 4%' },
  { value: 0,  label: 'Exento 0%' },
];

const REGIMEN_IVA = ['General', 'Simplificado', 'Recargo de equivalencia', 'Exento', 'Intracomunitario'];

const TABS = [
  { key: 'general',    label: 'Datos generales' },
  { key: 'contable',   label: 'Datos contables' },
  { key: 'actividad',  label: 'Actividad comercial' },
  { key: 'documentos', label: 'Documentos' },
];

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors';
const sel = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  );
}

const ESTADOS_FACTURA: Record<string, { label: string; cls: string }> = {
  BORRADOR:             { label: 'Borrador',  cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  EMITIDA:              { label: 'Emitida',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PARCIALMENTE_COBRADA: { label: 'Parcial',   cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  COBRADA:              { label: 'Cobrada',   cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  VENCIDA:              { label: 'Vencida',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  ANULADA:              { label: 'Anulada',   cls: 'bg-slate-600/10 text-slate-500 border-slate-600/20' },
};

const ESTADOS_PEDIDO: Record<string, { label: string; cls: string }> = {
  PENDIENTE:            { label: 'Pendiente',  cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  EN_PROCESO:           { label: 'En proceso', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PARCIALMENTE_SERVIDO: { label: 'Parcial',    cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  SERVIDO:              { label: 'Servido',    cls: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  FACTURADO:            { label: 'Facturado',  cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  CANCELADO:            { label: 'Cancelado',  cls: 'bg-slate-600/10 text-slate-500 border-slate-600/20' },
};

const ESTADOS_PRESUPUESTO: Record<string, { label: string; cls: string }> = {
  BORRADOR:   { label: 'Borrador',   cls: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  ENVIADO:    { label: 'Enviado',    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ACEPTADO:   { label: 'Aceptado',   cls: 'bg-green-500/10 text-green-400 border-green-500/20' },
  RECHAZADO:  { label: 'Rechazado',  cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  CONVERTIDO: { label: 'Convertido', cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

const ESTADOS_ALBARAN: Record<string, { label: string; cls: string }> = {
  PENDIENTE:  { label: 'Pendiente',  cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  FACTURADO:  { label: 'Facturado',  cls: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

function Badge({ estado, map }: { estado: string; map: Record<string, { label: string; cls: string }> }) {
  const e = map[estado] || { label: estado, cls: 'bg-slate-600/10 text-slate-500 border-slate-600/20' };
  return <span className={`text-xs px-2 py-1 rounded-full border font-medium ${e.cls}`}>{e.label}</span>;
}

function BarChart({ data }: { data: { mes: string; total: number }[] }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map(d => {
        const h = Math.max((d.total / max) * 100, 2);
        const label = d.mes.split('-')[1] + '/' + d.mes.split('-')[0].slice(2);
        return (
          <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative group" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-700 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                {fmt(d.total)}
              </div>
              <div className="w-full bg-blue-500/80 rounded-t transition-all hover:bg-blue-400" style={{ height: `${h}%`, minHeight: '2px' }} />
            </div>
            <span className="text-[9px] text-slate-500 whitespace-nowrap">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ClienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<any>(null);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('general');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const [riesgo, setRiesgo] = useState<any>(null);
  const [actividad, setActividad] = useState<any>(null);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [albaranes, setAlbaranes] = useState<any[]>([]);
  const [docTab, setDocTab] = useState('facturas');

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const cargar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [cRes, fpRes, gRes] = await Promise.all([
        fetch(`${API}/clientes/${id}`, { headers: hdrs() }),
        fetch(`${API}/clientes/formas-pago/list`, { headers: hdrs() }),
        fetch(`${API}/clientes/grupos/list`, { headers: hdrs() }),
      ]);
      const c = await cRes.json();
      setCliente(c);
      setForm({
        nombre: c.nombre || '', nombreComercial: c.nombreComercial || '',
        cifNif: c.cifNif || '', tipoCliente: c.tipoCliente || 'EMPRESA',
        email: c.email || '', telefono: c.telefono || '', movil: c.movil || '',
        fax: c.fax || '', web: c.web || '',
        direccion: c.direccion || '', codigoPostal: c.codigoPostal || '',
        ciudad: c.ciudad || '', provincia: c.provincia || '', pais: c.pais || 'ES',
        dirEnvio: c.dirEnvio || '', cpEnvio: c.cpEnvio || '',
        ciudadEnvio: c.ciudadEnvio || '', provinciaEnvio: c.provinciaEnvio || '', paisEnvio: c.paisEnvio || '',
        tipoIva: c.tipoIva ?? 21, regimenIva: c.regimenIva || 'General',
        descuento: c.descuento ?? 0, limiteCredito: c.limiteCredito ?? '',
        formaPagoId: c.formaPago?.id || '', grupoClienteId: c.grupo?.id || '',
        cuentaContable: c.cuentaContable || '', iban: c.iban || '',
        diasVencimiento: c.diasVencimiento ?? 30,
        observaciones: c.observaciones || '', agente: c.agente || '',
      });
      const fp = await fpRes.json(); setFormasPago(Array.isArray(fp) ? fp : []);
      const g = await gRes.json(); setGrupos(Array.isArray(g) ? g : []);
    } catch { showToast('Error al cargar'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const cargarTabData = useCallback(async (tab: string) => {
    if (!id) return;
    if (tab === 'contable' && !riesgo) {
      fetch(`${API}/clientes/${id}/riesgo`, { headers: hdrs() }).then(r => r.json()).then(setRiesgo).catch(() => {});
    }
    if (tab === 'actividad' && !actividad) {
      fetch(`${API}/clientes/${id}/actividad`, { headers: hdrs() }).then(r => r.json()).then(setActividad).catch(() => {});
    }
    if (tab === 'documentos' && facturas.length === 0) {
      Promise.all([
        fetch(`${API}/clientes/${id}/facturas`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/clientes/${id}/pedidos`, { headers: hdrs() }).then(r => r.json()),
        fetch(`${API}/clientes/${id}/presupuestos`, { headers: hdrs() }).then(r => r.json()).catch(() => []),
        fetch(`${API}/clientes/${id}/albaranes`, { headers: hdrs() }).then(r => r.json()).catch(() => []),
      ]).then(([f, p, pr, a]) => {
        setFacturas(Array.isArray(f) ? f : (f.data || []));
        setPedidos(Array.isArray(p) ? p : (p.data || []));
        setPresupuestos(Array.isArray(pr) ? pr : (pr.data || []));
        setAlbaranes(Array.isArray(a) ? a : (a.data || []));
      });
    }
  }, [id, riesgo, actividad, facturas.length]);

  const handleTabClick = (key: string) => { setActiveTab(key); cargarTabData(key); };
  const setF = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const guardar = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form };
      payload.tipoIva = parseFloat(form.tipoIva) || 21;
      payload.descuento = form.descuento !== '' ? parseFloat(form.descuento) : 0;
      payload.limiteCredito = form.limiteCredito !== '' ? parseFloat(form.limiteCredito) : null;
      payload.diasVencimiento = form.diasVencimiento !== '' ? parseInt(form.diasVencimiento) : null;
      const res = await fetch(`${API}/clientes/${id}`, { method: 'PUT', headers: hdrs(), body: JSON.stringify(payload) });
      if (res.ok) {
        showToast('Cliente actualizado');
        setEditMode(false);
        setRiesgo(null); setActividad(null);
        await cargar();
      } else {
        const d = await res.json();
        showToast(d.error || 'Error al guardar');
      }
    } catch { showToast('Error de conexion'); }
    finally { setSaving(false); }
  };

  const eliminar = async () => {
    const res = await fetch(`${API}/clientes/${id}`, { method: 'DELETE', headers: hdrs() });
    if (res.ok) navigate('/clientes');
    else { const d = await res.json(); showToast(d.error || 'No se puede eliminar'); }
    setConfirmDel(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!cliente) return (
    <div className="text-center py-20">
      <p className="text-slate-400">Cliente no encontrado</p>
      <button onClick={() => navigate('/clientes')} className="mt-4 text-blue-400 text-sm hover:underline">Volver a clientes</button>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">{toast}</div>}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/clientes')} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{cliente.nombre}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cliente.activo ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {cliente.codigo && <span className="font-mono text-xs text-blue-400">{cliente.codigo}</span>}
              {cliente.cifNif && <span className="text-xs text-slate-500">{cliente.cifNif}</span>}
              {cliente.tipoCliente && <span className="text-xs text-slate-600">{cliente.tipoCliente}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!editMode ? (
            <>
              <button onClick={() => setEditMode(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">Editar</button>
              {!confirmDel ? (
                <button onClick={() => setConfirmDel(true)} className="px-4 py-2 text-sm text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors">Eliminar</button>
              ) : (
                <div className="flex items-center gap-2 bg-slate-900 border border-red-500/30 rounded-xl px-3 py-2">
                  <span className="text-xs text-red-400">Eliminar?</span>
                  <button onClick={eliminar} className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Si</button>
                  <button onClick={() => setConfirmDel(false)} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600">No</button>
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setEditMode(false); cargar(); }} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => handleTabClick(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === tab.key ? 'text-white border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ TAB 1: DATOS GENERALES ═══ */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Section title="Datos basicos">
              {editMode ? (
                <div className="space-y-3">
                  <Field label="Razon social / Nombre *"><input value={form.nombre} onChange={e => setF('nombre', e.target.value)} className={inp} /></Field>
                  <Field label="Nombre comercial"><input value={form.nombreComercial} onChange={e => setF('nombreComercial', e.target.value)} className={inp} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="CIF / NIF"><input value={form.cifNif} onChange={e => setF('cifNif', e.target.value)} className={inp} /></Field>
                    <Field label="Tipo">
                      <select value={form.tipoCliente} onChange={e => setF('tipoCliente', e.target.value)} className={sel}>
                        {['EMPRESA', 'AUTONOMO', 'PARTICULAR'].map(t => <option key={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Grupo">
                    <select value={form.grupoClienteId} onChange={e => setF('grupoClienteId', e.target.value)} className={sel}>
                      <option value="">Sin grupo</option>
                      {grupos.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Agente comercial"><input value={form.agente} onChange={e => setF('agente', e.target.value)} className={inp} placeholder="Nombre del agente" /></Field>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Row label="Razon social" value={cliente.nombre} />
                  {cliente.nombreComercial && cliente.nombreComercial !== cliente.nombre && <Row label="Nombre comercial" value={cliente.nombreComercial} />}
                  <Row label="CIF/NIF" value={cliente.cifNif} mono />
                  <Row label="Tipo" value={cliente.tipoCliente} />
                  {cliente.grupo && <Row label="Grupo" value={cliente.grupo.nombre} />}
                  {cliente.agente && <Row label="Agente" value={cliente.agente} />}
                </div>
              )}
            </Section>

            <Section title="Contacto">
              {editMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><input type="email" value={form.email} onChange={e => setF('email', e.target.value)} className={inp} /></Field>
                  <Field label="Telefono"><input value={form.telefono} onChange={e => setF('telefono', e.target.value)} className={inp} /></Field>
                  <Field label="Movil"><input value={form.movil} onChange={e => setF('movil', e.target.value)} className={inp} /></Field>
                  <Field label="Fax"><input value={form.fax} onChange={e => setF('fax', e.target.value)} className={inp} /></Field>
                  <div className="col-span-2"><Field label="Web"><input value={form.web} onChange={e => setF('web', e.target.value)} className={inp} /></Field></div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cliente.email && <Row label="Email" value={cliente.email} />}
                  {cliente.telefono && <Row label="Telefono" value={cliente.telefono} />}
                  {cliente.movil && <Row label="Movil" value={cliente.movil} />}
                  {cliente.fax && <Row label="Fax" value={cliente.fax} />}
                  {cliente.web && <Row label="Web" value={cliente.web} />}
                  {!cliente.email && !cliente.telefono && !cliente.movil && !cliente.web && <p className="text-slate-600 text-sm italic">Sin datos de contacto</p>}
                </div>
              )}
            </Section>

            <Section title="Notas internas">
              {editMode ? (
                <Field label="Observaciones"><textarea value={form.observaciones} onChange={e => setF('observaciones', e.target.value)} rows={4} className={`${inp} resize-none`} placeholder="Notas internas..." /></Field>
              ) : (
                cliente.observaciones ? <p className="text-sm text-slate-300 whitespace-pre-wrap">{cliente.observaciones}</p> : <p className="text-slate-600 text-sm italic">Sin observaciones</p>
              )}
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Direccion fiscal">
              {editMode ? (
                <div className="space-y-3">
                  <Field label="Direccion"><input value={form.direccion} onChange={e => setF('direccion', e.target.value)} className={inp} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Codigo postal"><input value={form.codigoPostal} onChange={e => setF('codigoPostal', e.target.value)} className={inp} /></Field>
                    <Field label="Ciudad"><input value={form.ciudad} onChange={e => setF('ciudad', e.target.value)} className={inp} /></Field>
                    <Field label="Provincia"><input value={form.provincia} onChange={e => setF('provincia', e.target.value)} className={inp} /></Field>
                    <Field label="Pais"><input value={form.pais} onChange={e => setF('pais', e.target.value)} className={inp} /></Field>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cliente.direccion && <Row label="Direccion" value={cliente.direccion} />}
                  {(cliente.codigoPostal || cliente.ciudad) && <Row label="Ciudad" value={`${cliente.codigoPostal || ''} ${cliente.ciudad || ''}`.trim()} />}
                  {cliente.provincia && <Row label="Provincia" value={cliente.provincia} />}
                  {cliente.pais && <Row label="Pais" value={cliente.pais} />}
                  {!cliente.direccion && !cliente.ciudad && <p className="text-slate-600 text-sm italic">Sin direccion</p>}
                </div>
              )}
            </Section>

            <Section title="Direccion de entrega">
              {editMode ? (
                <div className="space-y-3">
                  <Field label="Direccion envio"><input value={form.dirEnvio} onChange={e => setF('dirEnvio', e.target.value)} className={inp} placeholder="Dejar vacio si es igual a fiscal" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Codigo postal"><input value={form.cpEnvio} onChange={e => setF('cpEnvio', e.target.value)} className={inp} /></Field>
                    <Field label="Ciudad"><input value={form.ciudadEnvio} onChange={e => setF('ciudadEnvio', e.target.value)} className={inp} /></Field>
                    <Field label="Provincia"><input value={form.provinciaEnvio} onChange={e => setF('provinciaEnvio', e.target.value)} className={inp} /></Field>
                    <Field label="Pais"><input value={form.paisEnvio} onChange={e => setF('paisEnvio', e.target.value)} className={inp} /></Field>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cliente.dirEnvio ? (
                    <>
                      <Row label="Direccion" value={cliente.dirEnvio} />
                      {(cliente.cpEnvio || cliente.ciudadEnvio) && <Row label="Ciudad" value={`${cliente.cpEnvio || ''} ${cliente.ciudadEnvio || ''}`.trim()} />}
                      {cliente.provinciaEnvio && <Row label="Provincia" value={cliente.provinciaEnvio} />}
                      {cliente.paisEnvio && <Row label="Pais" value={cliente.paisEnvio} />}
                    </>
                  ) : <p className="text-slate-600 text-sm italic">Misma que la direccion fiscal</p>}
                </div>
              )}
            </Section>

            {cliente.contactos?.length > 0 && (
              <Section title="Personas de contacto">
                <div className="space-y-3">
                  {cliente.contactos.map((c: any) => (
                    <div key={c.id} className="flex items-start justify-between p-3 bg-slate-800/50 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">{c.nombre}</span>
                          {c.principal && <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">Principal</span>}
                        </div>
                        {c.cargo && <div className="text-xs text-slate-500 mt-0.5">{c.cargo}</div>}
                        <div className="flex gap-3 mt-1">
                          {c.email && <span className="text-xs text-slate-400">{c.email}</span>}
                          {c.telefono && <span className="text-xs text-slate-400">{c.telefono}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB 2: DATOS CONTABLES ═══ */}
      {activeTab === 'contable' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Section title="Condiciones comerciales">
              {editMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Forma de pago">
                    <select value={form.formaPagoId} onChange={e => setF('formaPagoId', e.target.value)} className={sel}>
                      <option value="">Sin definir</option>
                      {formasPago.map((fp: any) => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Dias de vencimiento"><input type="number" min="0" value={form.diasVencimiento} onChange={e => setF('diasVencimiento', e.target.value)} className={inp} /></Field>
                  <Field label="Descuento %"><input type="number" min="0" max="100" step="0.01" value={form.descuento} onChange={e => setF('descuento', e.target.value)} className={inp} /></Field>
                  <Field label="Limite de credito"><input type="number" min="0" step="0.01" value={form.limiteCredito} onChange={e => setF('limiteCredito', e.target.value)} placeholder="Sin limite" className={inp} /></Field>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Row label="Forma de pago" value={cliente.formaPago?.nombre || 'Sin definir'} />
                  <Row label="Dias vencimiento" value={cliente.diasVencimiento != null ? `${cliente.diasVencimiento} dias` : '30 dias'} />
                  <Row label="Descuento" value={cliente.descuento > 0 ? `${cliente.descuento}%` : 'Sin descuento'} />
                  <Row label="Limite credito" value={cliente.limiteCredito ? fmt(cliente.limiteCredito) : 'Sin limite'} />
                </div>
              )}
            </Section>

            <Section title="Datos fiscales">
              {editMode ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Tipo de IVA">
                    <select value={form.tipoIva} onChange={e => setF('tipoIva', e.target.value)} className={sel}>
                      {IVA_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Regimen de IVA">
                    <select value={form.regimenIva} onChange={e => setF('regimenIva', e.target.value)} className={sel}>
                      {REGIMEN_IVA.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <div className="col-span-2"><Field label="Cuenta contable"><input value={form.cuentaContable} onChange={e => setF('cuentaContable', e.target.value)} className={inp} placeholder="430XXXXX" /></Field></div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <Row label="Tipo IVA" value={cliente.tipoIva != null ? `${cliente.tipoIva}%` : '21%'} />
                  <Row label="Regimen IVA" value={cliente.regimenIva || 'General'} />
                  <Row label="Cuenta contable" value={cliente.cuentaContable} mono />
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Datos bancarios">
              {editMode ? (
                <Field label="IBAN / Cuenta bancaria"><input value={form.iban} onChange={e => setF('iban', e.target.value)} className={inp} placeholder="ES00 0000 0000 0000 0000 0000" /></Field>
              ) : (
                cliente.iban ? <Row label="IBAN" value={cliente.iban} mono /> : <p className="text-slate-600 text-sm italic">Sin cuenta bancaria</p>
              )}
            </Section>

            <Section title="Riesgo acumulado">
              {riesgo ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Riesgo actual</span>
                    <span className={`text-lg font-bold ${riesgo.alerta ? 'text-red-400' : 'text-white'}`}>{fmt(riesgo.riesgoActual)}</span>
                  </div>
                  {riesgo.limiteCredito && (
                    <>
                      <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Limite credito</span><span className="text-sm text-white">{fmt(riesgo.limiteCredito)}</span></div>
                      <div className="flex justify-between items-center"><span className="text-sm text-slate-400">Disponible</span><span className={`text-sm font-semibold ${riesgo.disponible < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmt(riesgo.disponible)}</span></div>
                      <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${riesgo.porcentaje > 90 ? 'bg-red-500' : riesgo.porcentaje > 70 ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${Math.min(riesgo.porcentaje || 0, 100)}%` }} />
                      </div>
                      <div className="text-xs text-slate-500 text-right">{(riesgo.porcentaje || 0).toFixed(1)}% utilizado</div>
                    </>
                  )}
                  {!riesgo.limiteCredito && <p className="text-xs text-slate-500">Sin limite de credito configurado</p>}
                </div>
              ) : (
                <div className="flex justify-center py-4"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
              )}
            </Section>
          </div>
        </div>
      )}

      {/* ═══ TAB 3: ACTIVIDAD COMERCIAL ═══ */}
      {activeTab === 'actividad' && (
        <div className="space-y-6">
          {actividad ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total facturado', value: fmt(actividad.totalFacturado), cls: 'text-white' },
                  { label: 'Cobrado', value: fmt(actividad.totalCobrado), cls: 'text-green-400' },
                  { label: 'Pendiente cobro', value: fmt(actividad.pendienteCobro), cls: actividad.pendienteCobro > 0 ? 'text-orange-400' : 'text-slate-400' },
                  { label: 'Ultima factura', value: actividad.ultimaFactura ? fmtDate(actividad.ultimaFactura.fecha) : '—', cls: 'text-slate-300' },
                ].map(k => (
                  <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                    <p className={`text-xl font-bold ${k.cls}`}>{k.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{k.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: 'Facturas', value: actividad.numFacturas ?? actividad.nFacturas ?? 0, color: 'text-indigo-400' },
                  { label: 'Pedidos', value: actividad.numPedidos ?? actividad.nPedidos ?? 0, color: 'text-blue-400' },
                  { label: 'Albaranes', value: actividad.numAlbaranes ?? actividad.nAlbaranes ?? 0, color: 'text-cyan-400' },
                  { label: 'Presupuestos', value: actividad.numPresupuestos ?? actividad.nPresupuestos ?? 0, color: 'text-slate-300' },
                ].map(c => (
                  <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                    <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{c.label}</p>
                  </div>
                ))}
              </div>

              {actividad.facturacionMensual && Object.keys(actividad.facturacionMensual).length > 0 && (
                <Section title="Facturacion mensual (ultimos 12 meses)">
                  <BarChart data={
                    Array.isArray(actividad.facturacionMensual)
                      ? actividad.facturacionMensual
                      : Object.entries(actividad.facturacionMensual).map(([mes, total]) => ({ mes, total: total as number }))
                  } />
                </Section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Section title="Ultimas 5 facturas">
                  {actividad.ultimas5Facturas?.length > 0 ? (
                    <div className="space-y-2">
                      {actividad.ultimas5Facturas.map((f: any) => (
                        <div key={f.id} onClick={() => navigate('/ventas/facturas')} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                          <div><span className="text-sm font-mono text-indigo-400">{f.numeroCompleto}</span><span className="text-xs text-slate-500 ml-2">{fmtDate(f.fecha)}</span></div>
                          <div className="flex items-center gap-2"><Badge estado={f.estado} map={ESTADOS_FACTURA} /><span className="text-sm font-semibold text-white">{fmt(f.total)}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-600 text-sm italic">Sin facturas</p>}
                </Section>

                <Section title="Ultimos 5 pedidos">
                  {actividad.ultimos5Pedidos?.length > 0 ? (
                    <div className="space-y-2">
                      {actividad.ultimos5Pedidos.map((p: any) => (
                        <div key={p.id} onClick={() => navigate('/ventas/pedidos')} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                          <div><span className="text-sm font-mono text-blue-400">{p.numero}</span><span className="text-xs text-slate-500 ml-2">{fmtDate(p.fecha)}</span></div>
                          <div className="flex items-center gap-2"><Badge estado={p.estado} map={ESTADOS_PEDIDO} /><span className="text-sm font-semibold text-white">{fmt(p.total)}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-slate-600 text-sm italic">Sin pedidos</p>}
                </Section>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
          )}
        </div>
      )}

      {/* ═══ TAB 4: DOCUMENTOS ═══ */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[
              { key: 'facturas', label: 'Facturas', count: facturas.length },
              { key: 'pedidos', label: 'Pedidos', count: pedidos.length },
              { key: 'albaranes', label: 'Albaranes', count: albaranes.length },
              { key: 'presupuestos', label: 'Presupuestos', count: presupuestos.length },
            ].map(st => (
              <button key={st.key} onClick={() => setDocTab(st.key)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${docTab === st.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                {st.label} <span className="ml-1 text-xs opacity-60">({st.count})</span>
              </button>
            ))}
          </div>

          {docTab === 'facturas' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Numero', 'Fecha', 'Vencimiento', 'Base', 'Total', 'Estado'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}
                </tr></thead>
                <tbody>
                  {facturas.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-slate-500 italic">Sin facturas</td></tr> : facturas.map((f: any) => (
                    <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate('/ventas/facturas')}>
                      <td className="px-4 py-3 font-mono text-sm text-indigo-400">{f.numeroCompleto || f.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(f.fecha)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(f.fechaVencimiento)}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fmt(f.baseImponible)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(f.total)}</td>
                      <td className="px-4 py-3"><Badge estado={f.estado} map={ESTADOS_FACTURA} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {docTab === 'pedidos' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Numero', 'Fecha', 'Total', 'Estado'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}
                </tr></thead>
                <tbody>
                  {pedidos.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-slate-500 italic">Sin pedidos</td></tr> : pedidos.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate('/ventas/pedidos')}>
                      <td className="px-4 py-3 font-mono text-sm text-blue-400">{p.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(p.fecha)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(p.total)}</td>
                      <td className="px-4 py-3"><Badge estado={p.estado} map={ESTADOS_PEDIDO} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {docTab === 'albaranes' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Numero', 'Fecha', 'Total', 'Estado'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}
                </tr></thead>
                <tbody>
                  {albaranes.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-slate-500 italic">Sin albaranes</td></tr> : albaranes.map((a: any) => (
                    <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate('/ventas/albaranes')}>
                      <td className="px-4 py-3 font-mono text-sm text-cyan-400">{a.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(a.fecha)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(a.total)}</td>
                      <td className="px-4 py-3"><Badge estado={a.estado} map={ESTADOS_ALBARAN} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {docTab === 'presupuestos' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead><tr className="border-b border-slate-800">
                  {['Numero', 'Fecha', 'Validez', 'Total', 'Estado'].map(h => <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>)}
                </tr></thead>
                <tbody>
                  {presupuestos.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-slate-500 italic">Sin presupuestos</td></tr> : presupuestos.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate('/ventas/presupuestos')}>
                      <td className="px-4 py-3 font-mono text-sm text-slate-300">{p.numero}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(p.fecha)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(p.validezHasta || p.fechaValidez)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(p.total)}</td>
                      <td className="px-4 py-3"><Badge estado={p.estado} map={ESTADOS_PRESUPUESTO} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
