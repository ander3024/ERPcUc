import { useState, useEffect, useCallback } from 'react';
import { Target, Plus, Search, X, Save, Trash2, Phone, Mail, Calendar, CheckCircle, Circle, Megaphone, Activity, ChevronRight, GripVertical } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const H = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';

const ETAPAS = [
  { id: 'NUEVA', label: 'Nueva', color: 'bg-slate-500', border: 'border-slate-500' },
  { id: 'CONTACTO', label: 'Contacto', color: 'bg-blue-500', border: 'border-blue-500' },
  { id: 'PROPUESTA', label: 'Propuesta', color: 'bg-purple-500', border: 'border-purple-500' },
  { id: 'NEGOCIACION', label: 'Negociación', color: 'bg-orange-500', border: 'border-orange-500' },
  { id: 'GANADA', label: 'Ganada', color: 'bg-emerald-500', border: 'border-emerald-500' },
  { id: 'PERDIDA', label: 'Perdida', color: 'bg-red-500', border: 'border-red-500' },
];

const TIPOS_ACTIVIDAD = ['NOTA', 'LLAMADA', 'EMAIL', 'REUNION', 'TAREA', 'SEGUIMIENTO'];

// ---- TAB: KANBAN ----
function TabKanban() {
  const [oportunidades, setOportunidades] = useState<any[]>([]);
  const [resumen, setResumen] = useState<any>({});
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ titulo: '', contactoNombre: '', contactoEmail: '', contactoTelefono: '', importe: 0, probabilidad: 50, etapa: 'NUEVA', origen: '', observaciones: '' });
  const [clientes, setClientes] = useState<any[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteResults, setClienteResults] = useState<any[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState('');

  const cargar = async () => {
    try {
      const [ops, res] = await Promise.all([
        fetch(API + '/crm/oportunidades', { headers: H() }).then(r => r.json()),
        fetch(API + '/crm/oportunidades/resumen', { headers: H() }).then(r => r.json()),
      ]);
      setOportunidades(Array.isArray(ops) ? ops : []);
      setResumen(res);
    } catch {}
  };

  useEffect(() => { cargar(); }, []);

  const searchClientes = async (q: string) => {
    setClienteSearch(q);
    if (q.length < 2) { setClienteResults([]); return; }
    try {
      const r = await fetch(API + '/clientes?search=' + encodeURIComponent(q) + '&limit=8', { headers: H() }).then(r => r.json());
      setClienteResults(r.data || []);
    } catch {}
  };

  const crear = async () => {
    await fetch(API + '/crm/oportunidades', { method: 'POST', headers: H(), body: JSON.stringify({ ...form, clienteId: selectedClienteId || null }) });
    setModal(false); cargar();
    setForm({ titulo: '', contactoNombre: '', contactoEmail: '', contactoTelefono: '', importe: 0, probabilidad: 50, etapa: 'NUEVA', origen: '', observaciones: '' });
    setSelectedClienteId(''); setClienteSearch('');
  };

  const moverEtapa = async (id: string, etapa: string) => {
    await fetch(API + '/crm/oportunidades/' + id + '/etapa', { method: 'PUT', headers: H(), body: JSON.stringify({ etapa }) });
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('Eliminar oportunidad?')) return;
    await fetch(API + '/crm/oportunidades/' + id, { method: 'DELETE', headers: H() });
    cargar();
  };

  const etapasAbiertas = ETAPAS.filter(e => !['GANADA','PERDIDA'].includes(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <span className="text-xs text-slate-500">Abiertas</span>
            <span className="text-white font-bold ml-2">{resumen.totalAbiertas || 0}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <span className="text-xs text-slate-500">Pipeline</span>
            <span className="text-blue-400 font-bold ml-2">{fmt(resumen.totalImporte || 0)}</span>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2">
            <span className="text-xs text-slate-500">Ganado</span>
            <span className="text-emerald-400 font-bold ml-2">{fmt(resumen.totalGanado || 0)}</span>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16}/>Nueva oportunidad
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {etapasAbiertas.map(etapa => {
          const ops = oportunidades.filter(o => o.etapa === etapa.id);
          const totalEtapa = ops.reduce((s: number, o: any) => s + o.importe, 0);
          return (
            <div key={etapa.id} className="min-w-[260px] flex-1">
              <div className={clsx('rounded-t-lg px-3 py-2 flex items-center justify-between', etapa.color)}>
                <span className="text-white text-sm font-semibold">{etapa.label}</span>
                <span className="text-white/80 text-xs">{ops.length} · {fmt(totalEtapa)}</span>
              </div>
              <div className="bg-slate-800/50 border border-t-0 border-slate-700 rounded-b-lg min-h-[200px] p-2 space-y-2">
                {ops.map(op => (
                  <div key={op.id} className={clsx('bg-slate-800 border rounded-lg p-3 group', etapa.border, 'border-l-2')}>
                    <div className="flex items-start justify-between">
                      <div className="text-white text-sm font-medium">{op.titulo}</div>
                      <button onClick={() => eliminar(op.id)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
                    </div>
                    {op.cliente && <div className="text-xs text-blue-400 mt-1">{op.cliente.nombre}</div>}
                    {op.contactoNombre && <div className="text-xs text-slate-400 mt-1">{op.contactoNombre}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-emerald-400 text-sm font-semibold">{fmt(op.importe)}</span>
                      <span className="text-xs text-slate-500">{op.probabilidad}%</span>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {etapasAbiertas.filter(e => e.id !== etapa.id).map(e => (
                        <button key={e.id} onClick={() => moverEtapa(op.id, e.id)}
                          className={clsx('text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity', e.color, 'text-white')}>
                          {e.label.slice(0,3)}
                        </button>
                      ))}
                      <button onClick={() => moverEtapa(op.id, 'GANADA')} className="text-xs px-1.5 py-0.5 rounded bg-emerald-600 text-white opacity-0 group-hover:opacity-100">✓</button>
                      <button onClick={() => moverEtapa(op.id, 'PERDIDA')} className="text-xs px-1.5 py-0.5 rounded bg-red-600 text-white opacity-0 group-hover:opacity-100">✗</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed */}
      <div className="grid grid-cols-2 gap-4">
        {['GANADA','PERDIDA'].map(et => {
          const ops = oportunidades.filter(o => o.etapa === et);
          const etapa = ETAPAS.find(e => e.id === et)!;
          return (
            <div key={et} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={clsx('w-3 h-3 rounded-full', etapa.color)}/>
                <span className="text-white font-semibold">{etapa.label}</span>
                <span className="text-slate-500 text-xs">({ops.length})</span>
              </div>
              {ops.length === 0 ? <div className="text-slate-500 text-sm">Sin oportunidades</div> : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {ops.slice(0, 5).map(op => (
                    <div key={op.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{op.titulo}</span>
                      <span className={et === 'GANADA' ? 'text-emerald-400' : 'text-red-400'}>{fmt(op.importe)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal nueva oportunidad */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)}/>
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Nueva Oportunidad</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Titulo *</label>
                <input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/>
              </div>
              <div className="relative">
                <label className="text-xs text-slate-400 mb-1 block">Cliente (opcional)</label>
                <input value={clienteSearch} onChange={e => searchClientes(e.target.value)} placeholder="Buscar cliente..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/>
                {clienteResults.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-32 overflow-y-auto">
                    {clienteResults.map((c: any) => (
                      <li key={c.id} onMouseDown={() => { setSelectedClienteId(c.id); setClienteSearch(c.nombre); setClienteResults([]); }}
                        className="px-3 py-2 text-sm hover:bg-slate-700 cursor-pointer text-white">{c.codigo} - {c.nombre}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Contacto</label><input value={form.contactoNombre} onChange={e => setForm({...form, contactoNombre: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Email</label><input value={form.contactoEmail} onChange={e => setForm({...form, contactoEmail: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Telefono</label><input value={form.contactoTelefono} onChange={e => setForm({...form, contactoTelefono: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Importe</label><input type="number" value={form.importe} onChange={e => setForm({...form, importe: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-right"/></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Probabilidad %</label><input type="number" min="0" max="100" value={form.probabilidad} onChange={e => setForm({...form, probabilidad: parseInt(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 text-right"/></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Origen</label><input value={form.origen} onChange={e => setForm({...form, origen: e.target.value})} placeholder="Web, referido..." className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={crear} disabled={!form.titulo} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"><Save size={14}/>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- TAB: ACTIVIDADES ----
function TabActividades() {
  const [actividades, setActividades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'NOTA', titulo: '', descripcion: '', fecha: new Date().toISOString().slice(0,10) });

  const cargar = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filtro) params.set('completada', filtro);
      const r = await fetch(API + '/crm/actividades?' + params, { headers: H() }).then(r => r.json());
      setActividades(r.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [filtro]);

  const crear = async () => {
    await fetch(API + '/crm/actividades', { method: 'POST', headers: H(), body: JSON.stringify(form) });
    setModal(false); cargar();
    setForm({ tipo: 'NOTA', titulo: '', descripcion: '', fecha: new Date().toISOString().slice(0,10) });
  };

  const toggleCompletada = async (id: string) => {
    await fetch(API + '/crm/actividades/' + id + '/toggle', { method: 'PUT', headers: H() });
    cargar();
  };

  const eliminar = async (id: string) => {
    await fetch(API + '/crm/actividades/' + id, { method: 'DELETE', headers: H() });
    cargar();
  };

  const iconTipo: Record<string, any> = {
    NOTA: Circle, LLAMADA: Phone, EMAIL: Mail, REUNION: Calendar, TAREA: CheckCircle, SEGUIMIENTO: Activity,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[{v:'',l:'Todas'},{v:'false',l:'Pendientes'},{v:'true',l:'Completadas'}].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className={clsx('px-3 py-1.5 rounded-lg text-sm', filtro === f.v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white')}>
              {f.l}
            </button>
          ))}
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/>Nueva actividad</button>
      </div>

      {loading ? <div className="text-center py-12 text-slate-500">Cargando...</div> :
      actividades.length === 0 ? <div className="text-center py-16 text-slate-500"><Activity size={48} className="mx-auto mb-4 opacity-30"/><p>No hay actividades</p></div> : (
        <div className="space-y-2">
          {actividades.map(a => {
            const Icon = iconTipo[a.tipo] || Circle;
            return (
              <div key={a.id} className={clsx('bg-slate-800 border border-slate-700 rounded-lg p-4 flex items-center gap-4', a.completada && 'opacity-60')}>
                <button onClick={() => toggleCompletada(a.id)} className={clsx('w-6 h-6 rounded-full border-2 flex items-center justify-center', a.completada ? 'border-emerald-500 bg-emerald-500/20' : 'border-slate-600')}>
                  {a.completada && <CheckCircle size={14} className="text-emerald-400"/>}
                </button>
                <Icon size={16} className="text-slate-400 shrink-0"/>
                <div className="flex-1 min-w-0">
                  <div className={clsx('text-sm font-medium', a.completada ? 'text-slate-500 line-through' : 'text-white')}>{a.titulo}</div>
                  {a.descripcion && <div className="text-xs text-slate-500 mt-0.5 truncate">{a.descripcion}</div>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{fmtDate(a.fecha)}</span>
                    {a.cliente && <span className="text-xs text-blue-400">{a.cliente.nombre}</span>}
                    {a.oportunidad && <span className="text-xs text-purple-400">{a.oportunidad.titulo}</span>}
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">{a.tipo}</span>
                  </div>
                </div>
                <button onClick={() => eliminar(a.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)}/>
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Nueva Actividad</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    {TIPOS_ACTIVIDAD.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-slate-400 mb-1 block">Fecha</label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]"/></div>
              </div>
              <div><label className="text-xs text-slate-400 mb-1 block">Titulo *</label><input value={form.titulo} onChange={e => setForm({...form, titulo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Descripcion</label><textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={3} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"/></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={crear} disabled={!form.titulo} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"><Save size={14}/>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- TAB: CAMPANAS ----
function TabCampanas() {
  const [campanas, setCampanas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', tipo: 'EMAIL', presupuesto: 0, objetivo: '', fechaInicio: '', fechaFin: '' });

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(API + '/crm/campanas', { headers: H() }).then(r => r.json());
      setCampanas(Array.isArray(r) ? r : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    await fetch(API + '/crm/campanas', { method: 'POST', headers: H(), body: JSON.stringify(form) });
    setModal(false); cargar();
    setForm({ nombre: '', descripcion: '', tipo: 'EMAIL', presupuesto: 0, objetivo: '', fechaInicio: '', fechaFin: '' });
  };

  const cambiarEstado = async (id: string, estado: string) => {
    await fetch(API + '/crm/campanas/' + id, { method: 'PUT', headers: H(), body: JSON.stringify({ estado }) });
    cargar();
  };

  const eliminar = async (id: string) => {
    if (!confirm('Eliminar campaña?')) return;
    await fetch(API + '/crm/campanas/' + id, { method: 'DELETE', headers: H() });
    cargar();
  };

  const ESTADOS_CAMP = ['BORRADOR', 'ACTIVA', 'PAUSADA', 'FINALIZADA'];
  const TIPOS_CAMP = ['EMAIL', 'TELEFONO', 'REDES_SOCIALES', 'EVENTO', 'PUBLICIDAD', 'OTRO'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm"><Plus size={16}/>Nueva campaña</button>
      </div>

      {loading ? <div className="text-center py-12 text-slate-500">Cargando...</div> :
      campanas.length === 0 ? <div className="text-center py-16 text-slate-500"><Megaphone size={48} className="mx-auto mb-4 opacity-30"/><p>No hay campañas</p></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campanas.map(c => (
            <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-semibold">{c.nombre}</div>
                  {c.descripcion && <div className="text-sm text-slate-400 mt-1">{c.descripcion}</div>}
                </div>
                <button onClick={() => eliminar(c.id)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 size={14}/></button>
              </div>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">{c.tipo}</span>
                <select value={c.estado} onChange={e => cambiarEstado(c.id, e.target.value)}
                  className={clsx('text-xs px-2 py-1 rounded border-0 focus:outline-none',
                    c.estado === 'ACTIVA' ? 'bg-emerald-500/20 text-emerald-400' :
                    c.estado === 'PAUSADA' ? 'bg-orange-500/20 text-orange-400' :
                    c.estado === 'FINALIZADA' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-300')}>
                  {ESTADOS_CAMP.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                <div><span className="text-slate-500">Presupuesto:</span><span className="text-white ml-1">{fmt(c.presupuesto)}</span></div>
                <div><span className="text-slate-500">Inicio:</span><span className="text-slate-300 ml-1">{fmtDate(c.fechaInicio)}</span></div>
                <div><span className="text-slate-500">Oportunidades:</span><span className="text-blue-400 ml-1">{c._count?.oportunidades || 0}</span></div>
              </div>
              {c.objetivo && <div className="text-xs text-slate-500 mt-2">Objetivo: {c.objetivo}</div>}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)}/>
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Nueva Campaña</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-slate-400 mb-1 block">Nombre *</label><input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
              <div><label className="text-xs text-slate-400 mb-1 block">Descripcion</label><textarea value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"/></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                    {TIPOS_CAMP.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-slate-400 mb-1 block">Presupuesto</label><input type="number" value={form.presupuesto} onChange={e => setForm({...form, presupuesto: parseFloat(e.target.value)||0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none text-right"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-slate-400 mb-1 block">Fecha inicio</label><input type="date" value={form.fechaInicio} onChange={e => setForm({...form, fechaInicio: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]"/></div>
                <div><label className="text-xs text-slate-400 mb-1 block">Fecha fin</label><input type="date" value={form.fechaFin} onChange={e => setForm({...form, fechaFin: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]"/></div>
              </div>
              <div><label className="text-xs text-slate-400 mb-1 block">Objetivo</label><input value={form.objetivo} onChange={e => setForm({...form, objetivo: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"/></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={crear} disabled={!form.nombre} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"><Save size={14}/>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- PAGINA PRINCIPAL ----
const TABS = [
  { id: 'kanban', label: 'Oportunidades', icon: Target },
  { id: 'actividades', label: 'Actividades', icon: Activity },
  { id: 'campanas', label: 'Campañas', icon: Megaphone },
];

export default function CRMPage() {
  const [tab, setTab] = useState('kanban');

  return (
    <div className="flex flex-col h-full p-6 gap-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3"><Target size={24} className="text-blue-400"/> CRM</h1>
        <p className="text-slate-400 text-sm mt-1">Oportunidades, actividades y campañas comerciales</p>
      </div>

      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white')}>
            <t.icon size={16}/>{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'kanban' && <TabKanban/>}
        {tab === 'actividades' && <TabActividades/>}
        {tab === 'campanas' && <TabCampanas/>}
      </div>
    </div>
  );
}
