import { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, DollarSign, Building2, Briefcase, Search, Plus, X, Save,
  Check, XCircle, RefreshCw, ChevronRight, FileText, TrendingUp, Clock,
  Filter, BarChart3, UserPlus, Trash2, Edit3, LogIn, LogOut, Network,
} from 'lucide-react';

const API = '/api/rrhh';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';
const fmtNum = (n: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';
const btnPrimary = 'px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700';
const btnSecondary = 'px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 border border-slate-700';

const TIPOS: Record<string, string> = { VACACIONES: 'Vacaciones', BAJA_MEDICA: 'Baja médica', PERMISO: 'Permiso', FORMACION: 'Formación', OTROS: 'Otros' };
const ESTADO_AUS: Record<string, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  APROBADA: { label: 'Aprobada', cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
  RECHAZADA: { label: 'Rechazada', cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
};
const ESTADO_NOM: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: 'Borrador', cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' },
  APROBADA: { label: 'Aprobada', cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
  PAGADA: { label: 'Pagada', cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
};
const CONTRATOS: Record<string, string> = { INDEFINIDO: 'Indefinido', TEMPORAL: 'Temporal', PRACTICAS: 'Prácticas', OBRA_SERVICIO: 'Obra y servicio' };

type Overlay = null | 'modalEmpleado' | 'modalAusencia' | 'modalNomina' | 'panelEmpleado' | 'panelNomina';

// ---- PRESENCIA ----
function TabPresencia() {
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [fichajes, setFichajes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    try {
      const [emps, fichs] = await Promise.all([
        fetch('/api/rrhh/empleados?limit=100', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || ''), 'Content-Type': 'application/json' } }).then(r => r.json()),
        fetch('/api/rrhh/fichajes?limit=50', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || ''), 'Content-Type': 'application/json' } }).then(r => r.json()),
      ]);
      setEmpleados(emps.data || []);
      setFichajes(fichs.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const ficharEntrada = async (empleadoId: string) => {
    await fetch('/api/rrhh/fichajes/entrada', { method: 'POST', headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ empleadoId }) });
    cargar();
  };

  const ficharSalida = async (empleadoId: string) => {
    await fetch('/api/rrhh/fichajes/salida', { method: 'POST', headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ empleadoId }) });
    cargar();
  };

  if (loading) return <div className="text-center py-12 text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-white font-semibold text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-blue-400"/>Control de presencia</h3>

      {/* Quick clock buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {empleados.filter((e: any) => e.activo !== false).slice(0, 8).map((emp: any) => {
          const fichajeHoy = fichajes.find((f: any) => f.empleadoId === emp.id && !f.horaSalida);
          return (
            <div key={emp.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="text-white font-medium text-sm">{emp.nombre} {emp.apellidos}</div>
              <div className="text-xs text-slate-500">{emp.numeroEmpleado}</div>
              <div className="flex gap-2 mt-3">
                {fichajeHoy ? (
                  <button onClick={() => ficharSalida(emp.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs"><LogOut className="w-3 h-3"/>Salida</button>
                ) : (
                  <button onClick={() => ficharEntrada(emp.id)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"><LogIn className="w-3 h-3"/>Entrada</button>
                )}
              </div>
              {fichajeHoy && fichajeHoy.horaEntrada && (
                <div className="text-xs text-emerald-400 mt-1">Entrada: {new Date(fichajeHoy.horaEntrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent fichajes */}
      <h3 className="text-white font-semibold">Fichajes recientes</h3>
      {fichajes.length === 0 ? (
        <div className="text-center py-8 text-slate-500">No hay fichajes</div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="text-left px-4 py-3">Empleado</th>
              <th className="text-center px-4 py-3">Fecha</th>
              <th className="text-center px-4 py-3">Entrada</th>
              <th className="text-center px-4 py-3">Salida</th>
              <th className="text-center px-4 py-3">Horas</th>
              <th className="text-center px-4 py-3">Estado</th>
            </tr></thead>
            <tbody>{fichajes.map((f: any) => (
              <tr key={f.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-2.5 text-white">{f.empleado?.nombre} {f.empleado?.apellidos}</td>
                <td className="px-4 py-2.5 text-center text-slate-400 text-xs">{fmtDate(f.fecha)}</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 text-xs">{f.horaEntrada ? new Date(f.horaEntrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-4 py-2.5 text-center text-red-400 text-xs">{f.horaSalida ? new Date(f.horaSalida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-4 py-2.5 text-center text-white font-semibold">{f.totalHoras ? f.totalHoras.toFixed(2) + 'h' : '-'}</td>
                <td className="px-4 py-2.5 text-center">
                  {f.horaSalida
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">Completado</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">En curso</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- ORGANIGRAMA ----
function TabOrganigrama() {
  const [data, setData] = useState<any>({ departamentos: [], sinDepartamento: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rrhh/organigrama', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('accessToken') || ''), 'Content-Type': 'application/json' } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-500">Cargando...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-white font-semibold text-lg flex items-center gap-2"><Network className="w-5 h-5 text-purple-400"/>Organigrama</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.departamentos?.map((dept: any) => (
          <div key={dept.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-purple-600/20 border-b border-purple-500/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400"/>
                <span className="text-white font-semibold">{dept.nombre}</span>
                <span className="text-xs text-purple-300 ml-auto">{dept.empleados?.length || 0} personas</span>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {dept.empleados?.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-2">Sin empleados</div>
              ) : (
                dept.empleados?.map((emp: any) => (
                  <div key={emp.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-700/30">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-semibold">
                      {emp.nombre[0]}{emp.apellidos[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white">{emp.nombre} {emp.apellidos}</div>
                      <div className="text-xs text-slate-500">{emp.puesto?.nombre || 'Sin puesto'} · {emp.numeroEmpleado}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}

        {data.sinDepartamento?.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-700/50 border-b border-slate-600 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400"/>
                <span className="text-slate-300 font-semibold">Sin departamento</span>
                <span className="text-xs text-slate-500 ml-auto">{data.sinDepartamento.length}</span>
              </div>
            </div>
            <div className="p-3 space-y-2">
              {data.sinDepartamento.map((emp: any) => (
                <div key={emp.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-slate-700/30">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-white font-semibold">
                    {emp.nombre[0]}{emp.apellidos[0]}
                  </div>
                  <div>
                    <div className="text-sm text-white">{emp.nombre} {emp.apellidos}</div>
                    <div className="text-xs text-slate-500">{emp.puesto?.nombre || 'Sin puesto'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RRHHPage() {
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const token = localStorage.getItem('accessToken');
  const headers: any = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // ===== Shared data =====
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [puestos, setPuestos] = useState<any[]>([]);
  const [empleadosList, setEmpleadosList] = useState<any[]>([]);

  const fetchDepartamentos = useCallback(async () => {
    try { const r = await fetch(`${API}/departamentos`, { headers }); const d = await r.json(); setDepartamentos(Array.isArray(d) ? d : []); } catch { /* */ }
  }, []);
  const fetchPuestos = useCallback(async () => {
    try { const r = await fetch(`${API}/puestos`, { headers }); const d = await r.json(); setPuestos(Array.isArray(d) ? d : []); } catch { /* */ }
  }, []);
  const fetchEmpleadosList = useCallback(async () => {
    try { const r = await fetch(`${API}/empleados?limit=200`, { headers }); const d = await r.json(); setEmpleadosList(d.data || []); } catch { /* */ }
  }, []);

  // ===== Dashboard =====
  const [stats, setStats] = useState<any>({ total: 0, ausenciasPendientes: 0, departamentos: [] });
  const [nominasStats, setNominasStats] = useState<any>({ pendientes: 0, costeMensual: 0 });
  const [recentAusencias, setRecentAusencias] = useState<any[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsR, ausR, nomR] = await Promise.all([
        fetch(`${API}/empleados/stats`, { headers }).then(r => r.json()).catch(() => ({ total: 0, ausenciasPendientes: 0, departamentos: [] })),
        fetch(`${API}/ausencias?limit=5`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        fetch(`${API}/nominas?limit=1&estado=BORRADOR`, { headers }).then(r => r.json()).catch(() => ({ total: 0 })),
      ]);
      setStats(statsR);
      setRecentAusencias(ausR.data || []);
      setNominasStats({ pendientes: nomR.total || 0, costeMensual: 0 });
    } catch { /* */ }
  }, []);

  // ===== Empleados =====
  const [empData, setEmpData] = useState<any[]>([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empSearchDebounced, setEmpSearchDebounced] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  const [empPage, setEmpPage] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  const [empEditMode, setEmpEditMode] = useState(false);
  const [empEditForm, setEmpEditForm] = useState<any>({});
  const [empNewForm, setEmpNewForm] = useState({ nombre: '', apellidos: '', nif: '', email: '', telefono: '', direccion: '', fechaNacimiento: '', fechaAlta: '', departamentoId: '', puestoId: '', tipoContrato: 'INDEFINIDO', jornadaHoras: 40, salarioBruto: 0, nSS: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { const t = setTimeout(() => setEmpSearchDebounced(empSearch), 400); return () => clearTimeout(t); }, [empSearch]);

  const fetchEmpleados = useCallback(async (page = 1) => {
    setEmpLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(empSearchDebounced && { search: empSearchDebounced }), ...(empDeptFilter && { departamentoId: empDeptFilter }) });
      const r = await fetch(`${API}/empleados?${params}`, { headers });
      const d = await r.json();
      setEmpData(d.data || []);
      setEmpPage({ page: d.page || 1, total: d.total || 0, totalPages: d.totalPages || 0 });
    } catch { setEmpData([]); } finally { setEmpLoading(false); }
  }, [empSearchDebounced, empDeptFilter]);

  const fetchEmpleadoDetail = async (id: string) => {
    try {
      const r = await fetch(`${API}/empleados/${id}`, { headers });
      const d = await r.json();
      setSelectedEmp(d);
      setEmpEditForm({ ...d });
      setEmpEditMode(false);
      setOverlay('panelEmpleado');
    } catch { showToast('Error al cargar empleado'); }
  };

  const crearEmpleado = async () => {
    if (!empNewForm.nombre || !empNewForm.apellidos || !empNewForm.nif) { showToast('Nombre, apellidos y NIF son obligatorios'); return; }
    setSaving(true);
    try {
      const body = { ...empNewForm, jornadaHoras: Number(empNewForm.jornadaHoras), salarioBruto: Number(empNewForm.salarioBruto) };
      const r = await fetch(`${API}/empleados`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (r.ok) { showToast('Empleado creado'); setOverlay(null); fetchEmpleados(); fetchEmpleadosList(); resetEmpNew(); }
      else { const e = await r.json(); showToast('Error: ' + (e.error || 'No se pudo crear')); }
    } catch { showToast('Error de conexión'); } finally { setSaving(false); }
  };
  const resetEmpNew = () => setEmpNewForm({ nombre: '', apellidos: '', nif: '', email: '', telefono: '', direccion: '', fechaNacimiento: '', fechaAlta: '', departamentoId: '', puestoId: '', tipoContrato: 'INDEFINIDO', jornadaHoras: 40, salarioBruto: 0, nSS: '' });

  const guardarEmpleado = async () => {
    if (!selectedEmp) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/empleados/${selectedEmp.id}`, { method: 'PUT', headers, body: JSON.stringify(empEditForm) });
      if (r.ok) { showToast('Guardado'); setEmpEditMode(false); fetchEmpleados(); }
      else showToast('Error al guardar');
    } catch { showToast('Error de conexión'); } finally { setSaving(false); }
  };

  // ===== Ausencias =====
  const [ausData, setAusData] = useState<any[]>([]);
  const [ausLoading, setAusLoading] = useState(false);
  const [ausEstado, setAusEstado] = useState('');
  const [ausTipo, setAusTipo] = useState('');
  const [ausSearch, setAusSearch] = useState('');
  const [ausPage, setAusPage] = useState({ page: 1, total: 0, totalPages: 0 });
  const [ausNewForm, setAusNewForm] = useState({ empleadoId: '', tipo: 'VACACIONES', desde: '', hasta: '', motivo: '' });
  const [ausDias, setAusDias] = useState(0);

  const fetchAusencias = useCallback(async (page = 1) => {
    setAusLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(ausEstado && { estado: ausEstado }), ...(ausTipo && { tipo: ausTipo }) });
      const r = await fetch(`${API}/ausencias?${params}`, { headers });
      const d = await r.json();
      setAusData(d.data || []);
      setAusPage({ page: d.page || 1, total: d.total || 0, totalPages: d.totalPages || 0 });
    } catch { setAusData([]); } finally { setAusLoading(false); }
  }, [ausEstado, ausTipo]);

  const aprobarAusencia = async (id: string) => {
    try { const r = await fetch(`${API}/ausencias/${id}/aprobar`, { method: 'PATCH', headers }); if (r.ok) { showToast('Ausencia aprobada'); fetchAusencias(ausPage.page); } else { const d = await r.json(); showToast(d.error || 'Error'); } } catch { showToast('Error'); }
  };
  const rechazarAusencia = async (id: string) => {
    try { const r = await fetch(`${API}/ausencias/${id}/rechazar`, { method: 'PATCH', headers }); if (r.ok) { showToast('Ausencia rechazada'); fetchAusencias(ausPage.page); } else { const d = await r.json(); showToast(d.error || 'Error'); } } catch { showToast('Error'); }
  };
  const crearAusencia = async () => {
    if (!ausNewForm.empleadoId || !ausNewForm.desde || !ausNewForm.hasta) { showToast('Empleado, desde y hasta son obligatorios'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/ausencias`, { method: 'POST', headers, body: JSON.stringify(ausNewForm) });
      if (r.ok) { showToast('Ausencia creada'); setOverlay(null); fetchAusencias(); setAusNewForm({ empleadoId: '', tipo: 'VACACIONES', desde: '', hasta: '', motivo: '' }); }
      else { const e = await r.json(); showToast('Error: ' + (e.error || 'No se pudo crear')); }
    } catch { showToast('Error de conexión'); } finally { setSaving(false); }
  };

  useEffect(() => {
    if (ausNewForm.desde && ausNewForm.hasta) {
      const d = new Date(ausNewForm.desde), h = new Date(ausNewForm.hasta);
      const diff = Math.ceil((h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      setAusDias(diff > 0 ? diff : 0);
    } else { setAusDias(0); }
  }, [ausNewForm.desde, ausNewForm.hasta]);

  // ===== Nominas =====
  const [nomData, setNomData] = useState<any[]>([]);
  const [nomLoading, setNomLoading] = useState(false);
  const [nomPeriodo, setNomPeriodo] = useState('');
  const [nomEstado, setNomEstado] = useState('');
  const [nomPage, setNomPage] = useState({ page: 1, total: 0, totalPages: 0 });
  const [nomTotals, setNomTotals] = useState({ bruto: 0, deducciones: 0, neto: 0, pendientes: 0 });
  const [selectedNom, setSelectedNom] = useState<any>(null);
  const [nomGenPeriodo, setNomGenPeriodo] = useState('');

  const fetchNominas = useCallback(async (page = 1) => {
    setNomLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', ...(nomPeriodo && { periodo: nomPeriodo }), ...(nomEstado && { estado: nomEstado }) });
      const r = await fetch(`${API}/nominas?${params}`, { headers });
      const d = await r.json();
      const items = d.data || [];
      setNomData(items);
      setNomPage({ page: d.page || 1, total: d.total || 0, totalPages: d.totalPages || 0 });
      const bruto = items.reduce((s: number, n: any) => s + (n.salarioBruto || 0), 0);
      const ded = items.reduce((s: number, n: any) => s + (n.totalDeducciones || 0), 0);
      const neto = items.reduce((s: number, n: any) => s + (n.salarioNeto || 0), 0);
      const pend = items.filter((n: any) => n.estado === 'BORRADOR').length;
      setNomTotals({ bruto, deducciones: ded, neto, pendientes: pend });
    } catch { setNomData([]); } finally { setNomLoading(false); }
  }, [nomPeriodo, nomEstado]);

  const generarNominas = async () => {
    if (!nomGenPeriodo) { showToast('Seleccione un periodo'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/nominas/generar`, { method: 'POST', headers, body: JSON.stringify({ periodo: nomGenPeriodo }) });
      if (r.ok) { const d = await r.json(); showToast(`${d.count || 'Nóminas'} generadas`); setOverlay(null); fetchNominas(); }
      else { const e = await r.json(); showToast('Error: ' + (e.error || 'No se pudo generar')); }
    } catch { showToast('Error de conexión'); } finally { setSaving(false); }
  };

  const aprobarNomina = async (id: string) => {
    try { const r = await fetch(`${API}/nominas/${id}/aprobar`, { method: 'PATCH', headers }); if (r.ok) { showToast('Nómina aprobada'); fetchNominas(nomPage.page); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const pagarNomina = async (id: string) => {
    try { const r = await fetch(`${API}/nominas/${id}/pagar`, { method: 'PATCH', headers }); if (r.ok) { showToast('Nómina marcada como pagada'); fetchNominas(nomPage.page); } else showToast('Error'); } catch { showToast('Error'); }
  };

  // ===== Departamentos & Puestos =====
  const [deptNewName, setDeptNewName] = useState('');
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [deptEditName, setDeptEditName] = useState('');
  const [puestoNewName, setPuestoNewName] = useState('');
  const [puestoEditId, setPuestoEditId] = useState<string | null>(null);
  const [puestoEditName, setPuestoEditName] = useState('');

  const crearDept = async () => {
    if (!deptNewName.trim()) return;
    try { const r = await fetch(`${API}/departamentos`, { method: 'POST', headers, body: JSON.stringify({ nombre: deptNewName }) }); if (r.ok) { showToast('Departamento creado'); setDeptNewName(''); fetchDepartamentos(); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const editarDept = async (id: string) => {
    try { const r = await fetch(`${API}/departamentos/${id}`, { method: 'PUT', headers, body: JSON.stringify({ nombre: deptEditName }) }); if (r.ok) { showToast('Actualizado'); setDeptEditId(null); fetchDepartamentos(); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const borrarDept = async (id: string) => {
    if (!confirm('¿Eliminar este departamento?')) return;
    try { const r = await fetch(`${API}/departamentos/${id}`, { method: 'DELETE', headers }); if (r.ok) { showToast('Eliminado'); fetchDepartamentos(); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const crearPuesto = async () => {
    if (!puestoNewName.trim()) return;
    try { const r = await fetch(`${API}/puestos`, { method: 'POST', headers, body: JSON.stringify({ nombre: puestoNewName }) }); if (r.ok) { showToast('Puesto creado'); setPuestoNewName(''); fetchPuestos(); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const editarPuesto = async (id: string) => {
    try { const r = await fetch(`${API}/puestos/${id}`, { method: 'PUT', headers, body: JSON.stringify({ nombre: puestoEditName }) }); if (r.ok) { showToast('Actualizado'); setPuestoEditId(null); fetchPuestos(); } else showToast('Error'); } catch { showToast('Error'); }
  };
  const borrarPuesto = async (id: string) => {
    if (!confirm('¿Eliminar este puesto?')) return;
    try { const r = await fetch(`${API}/puestos/${id}`, { method: 'DELETE', headers }); if (r.ok) { showToast('Eliminado'); fetchPuestos(); } else showToast('Error'); } catch { showToast('Error'); }
  };

  // ===== Effects =====
  useEffect(() => {
    fetchDepartamentos();
    fetchPuestos();
    fetchEmpleadosList();
  }, []);

  useEffect(() => {
    if (tab === 'dashboard') fetchDashboard();
    if (tab === 'empleados') fetchEmpleados();
    if (tab === 'ausencias') fetchAusencias();
    if (tab === 'nominas') fetchNominas();
    if (tab === 'departamentos') { fetchDepartamentos(); fetchPuestos(); }
  }, [tab, fetchEmpleados, fetchAusencias, fetchNominas, fetchDashboard]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOverlay(null); setEmpEditMode(false); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // ===== Tab definitions =====
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'empleados', label: 'Empleados', icon: Users },
    { id: 'ausencias', label: 'Ausencias', icon: Calendar },
    { id: 'nominas', label: 'Nóminas', icon: DollarSign },
    { id: 'departamentos', label: 'Departamentos', icon: Building2 },
    { id: 'presencia', label: 'Presencia', icon: Clock },
    { id: 'organigrama', label: 'Organigrama', icon: Network },
  ];

  // ===== RENDER HELPERS =====
  const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-xs text-slate-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  const Badge = ({ estado, map }: { estado: string; map: Record<string, { label: string; cls: string }> }) => {
    const e = map[estado] || { label: estado, cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${e.cls}`}>{e.label}</span>;
  };

  const Pagination = ({ pg, onPage }: { pg: { page: number; total: number; totalPages: number }; onPage: (p: number) => void }) => (
    pg.totalPages > 1 ? (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
        <span className="text-xs text-slate-500">Pág. {pg.page} de {pg.totalPages} · {pg.total} registros</span>
        <div className="flex gap-2">
          <button onClick={() => onPage(pg.page - 1)} disabled={pg.page <= 1} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">\u2190 Anterior</button>
          <button onClick={() => onPage(pg.page + 1)} disabled={pg.page >= pg.totalPages} className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">Siguiente \u2192</button>
        </div>
      </div>
    ) : null
  );

  const SkeletonRows = ({ cols, rows = 5 }: { cols: number; rows?: number }) => (
    <>{Array.from({ length: rows }).map((_, i) => (
      <tr key={i} className="border-b border-slate-800/50">
        {Array.from({ length: cols }).map((_, j) => (
          <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
        ))}
      </tr>
    ))}</>
  );

  // ===== TABS CONTENT =====

  const renderDashboard = () => {
    const maxEmps = Math.max(...(stats.departamentos || []).map((d: any) => d._count?.empleados || 0), 1);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total empleados" value={stats.total} color="bg-blue-500/10 text-blue-400" />
          <StatCard icon={Clock} label="Ausencias pendientes" value={stats.ausenciasPendientes} color="bg-yellow-500/10 text-yellow-400" />
          <StatCard icon={FileText} label="Nóminas pendientes" value={nominasStats.pendientes} color="bg-orange-500/10 text-orange-400" />
          <StatCard icon={TrendingUp} label="Coste mensual" value={fmtNum(nominasStats.costeMensual) + ' \u20ac'} color="bg-green-500/10 text-green-400" />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Department distribution */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" />Distribución por departamento</h3>
            {(stats.departamentos || []).length === 0 ? <p className="text-sm text-slate-500">Sin datos</p> : (
              <div className="space-y-3">
                {(stats.departamentos || []).map((d: any) => {
                  const count = d._count?.empleados || 0;
                  const pct = (count / maxEmps) * 100;
                  return (
                    <div key={d.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">{d.nombre}</span>
                        <span className="text-slate-400">{count}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: pct + '%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent ausencias */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-400" />Últimas ausencias</h3>
            {recentAusencias.length === 0 ? <p className="text-sm text-slate-500">Sin ausencias recientes</p> : (
              <div className="space-y-2">
                {recentAusencias.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm text-white">{a.empleado?.nombre} {a.empleado?.apellidos}</p>
                      <p className="text-xs text-slate-500">{TIPOS[a.tipo] || a.tipo} · {fmtDate(a.desde)} - {fmtDate(a.hasta)}</p>
                    </div>
                    <Badge estado={a.estado} map={ESTADO_AUS} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Acciones rápidas</h3>
          <div className="flex gap-3">
            <button onClick={() => { setTab('empleados'); setTimeout(() => setOverlay('modalEmpleado'), 100); }} className={btnPrimary + ' flex items-center gap-2'}><UserPlus className="w-4 h-4" />Nuevo empleado</button>
            <button onClick={() => { setTab('ausencias'); setTimeout(() => setOverlay('modalAusencia'), 100); }} className={btnSecondary + ' flex items-center gap-2'}><Calendar className="w-4 h-4" />Nueva ausencia</button>
            <button onClick={() => { setTab('nominas'); setTimeout(() => setOverlay('modalNomina'), 100); }} className={btnSecondary + ' flex items-center gap-2'}><DollarSign className="w-4 h-4" />Generar nóminas</button>
          </div>
        </div>
      </div>
    );
  };

  const renderEmpleados = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{empPage.total} empleados</p>
        <button onClick={() => { resetEmpNew(); setOverlay('modalEmpleado'); }} className={btnPrimary + ' flex items-center gap-2'}><Plus className="w-4 h-4" />Nuevo empleado</button>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input className={inp + ' pl-9'} placeholder="Buscar empleado..." value={empSearch} onChange={e => setEmpSearch(e.target.value)} />
        </div>
        <select value={empDeptFilter} onChange={e => setEmpDeptFilter(e.target.value)} className={inp + ' w-48'}>
          <option value="">Todos los departamentos</option>
          {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <button onClick={() => fetchEmpleados()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-800">
            {['Nº', 'Nombre', 'NIF', 'Departamento', 'Puesto', 'Contrato', 'Estado', ''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {empLoading ? <SkeletonRows cols={8} /> : empData.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-slate-500">No hay empleados</td></tr>
            ) : empData.map(e => (
              <tr key={e.id} onClick={() => fetchEmpleadoDetail(e.id)} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{e.numeroEmpleado}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{e.nombre} {e.apellidos}</p>
                  <p className="text-xs text-slate-500">{e.email || ''}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{e.nif}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{e.departamento?.nombre || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{e.puesto?.nombre || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{CONTRATOS[e.tipoContrato] || e.tipoContrato || '—'}</td>
                <td className="px-4 py-3">
                  {e.activo !== false
                    ? <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-500/10 text-green-400 border border-green-500/20">Activo</span>
                    : <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-500/10 text-red-400 border border-red-500/20">Inactivo</span>}
                </td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-500" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pg={empPage} onPage={p => fetchEmpleados(p)} />
      </div>
    </div>
  );

  const renderAusencias = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{ausPage.total} ausencias</p>
        <button onClick={() => { setAusNewForm({ empleadoId: '', tipo: 'VACACIONES', desde: '', hasta: '', motivo: '' }); setOverlay('modalAusencia'); }} className={btnPrimary + ' flex items-center gap-2'}><Plus className="w-4 h-4" />Nueva ausencia</button>
      </div>
      <div className="flex gap-3">
        <select value={ausEstado} onChange={e => setAusEstado(e.target.value)} className={inp + ' w-44'}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_AUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={ausTipo} onChange={e => setAusTipo(e.target.value)} className={inp + ' w-44'}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => fetchAusencias()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-800">
            {['Empleado', 'Tipo', 'Desde', 'Hasta', 'Días', 'Motivo', 'Estado', 'Acciones'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {ausLoading ? <SkeletonRows cols={8} /> : ausData.length === 0 ? (
              <tr><td colSpan={8} className="py-16 text-center text-slate-500">No hay ausencias</td></tr>
            ) : ausData.map(a => (
              <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{a.empleado?.nombre} {a.empleado?.apellidos}</p>
                  <p className="text-xs text-slate-500">{a.empleado?.numeroEmpleado}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">{TIPOS[a.tipo] || a.tipo}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(a.desde)}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(a.hasta)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-white">{a.dias}</td>
                <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{a.motivo || '—'}</td>
                <td className="px-4 py-3"><Badge estado={a.estado} map={ESTADO_AUS} /></td>
                <td className="px-4 py-3">
                  {a.estado === 'PENDIENTE' && (
                    <div className="flex gap-1">
                      <button onClick={() => aprobarAusencia(a.id)} className="px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 flex items-center gap-1"><Check className="w-3 h-3" />Aprobar</button>
                      <button onClick={() => rechazarAusencia(a.id)} className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 flex items-center gap-1"><XCircle className="w-3 h-3" />Rechazar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pg={ausPage} onPage={p => fetchAusencias(p)} />
      </div>
    </div>
  );

  const renderNominas = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{nomPage.total} nóminas</p>
        <button onClick={() => { setNomGenPeriodo(''); setOverlay('modalNomina'); }} className={btnPrimary + ' flex items-center gap-2'}><Plus className="w-4 h-4" />Generar nóminas</button>
      </div>
      <div className="flex gap-3">
        <input type="month" value={nomPeriodo} onChange={e => setNomPeriodo(e.target.value)} className={inp + ' w-44'} />
        <select value={nomEstado} onChange={e => setNomEstado(e.target.value)} className={inp + ' w-44'}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_NOM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => fetchNominas()} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"><RefreshCw className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total bruto" value={fmtNum(nomTotals.bruto) + ' \u20ac'} color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={TrendingUp} label="Deducciones" value={fmtNum(nomTotals.deducciones) + ' \u20ac'} color="bg-red-500/10 text-red-400" />
        <StatCard icon={DollarSign} label="Total neto" value={fmtNum(nomTotals.neto) + ' \u20ac'} color="bg-green-500/10 text-green-400" />
        <StatCard icon={Clock} label="Pendientes" value={nomTotals.pendientes} color="bg-yellow-500/10 text-yellow-400" />
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-800">
            {['Empleado', 'Periodo', 'Bruto', 'Deducciones', 'IRPF', 'SS', 'Neto', 'Estado', 'Acciones'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {nomLoading ? <SkeletonRows cols={9} /> : nomData.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center text-slate-500">No hay nóminas</td></tr>
            ) : nomData.map(n => (
              <tr key={n.id} onClick={() => { setSelectedNom(n); setOverlay('panelNomina'); }} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{n.empleado?.nombre} {n.empleado?.apellidos}</p>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{n.periodo}</td>
                <td className="px-4 py-3 text-sm text-white font-mono">{fmtNum(n.salarioBruto)}</td>
                <td className="px-4 py-3 text-sm text-red-400 font-mono">{fmtNum(n.totalDeducciones)}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{fmtNum(n.irpf)}</td>
                <td className="px-4 py-3 text-sm text-slate-400 font-mono">{fmtNum(n.seguridadSocial)}</td>
                <td className="px-4 py-3 text-sm text-green-400 font-bold font-mono">{fmtNum(n.salarioNeto)}</td>
                <td className="px-4 py-3"><Badge estado={n.estado} map={ESTADO_NOM} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    {n.estado === 'BORRADOR' && <button onClick={() => aprobarNomina(n.id)} className="px-2 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 flex items-center gap-1"><Check className="w-3 h-3" />Aprobar</button>}
                    {n.estado === 'APROBADA' && <button onClick={() => pagarNomina(n.id)} className="px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 flex items-center gap-1"><DollarSign className="w-3 h-3" />Pagar</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination pg={nomPage} onPage={p => fetchNominas(p)} />
      </div>
    </div>
  );

  const renderDepartamentos = () => (
    <div className="grid grid-cols-2 gap-6">
      {/* Departamentos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" />Departamentos</h3>
        <div className="flex gap-2 mb-4">
          <input value={deptNewName} onChange={e => setDeptNewName(e.target.value)} placeholder="Nuevo departamento..." className={inp + ' flex-1'} onKeyDown={e => e.key === 'Enter' && crearDept()} />
          <button onClick={crearDept} className={btnPrimary + ' flex items-center gap-1'}><Plus className="w-4 h-4" />Añadir</button>
        </div>
        <div className="space-y-2">
          {departamentos.length === 0 ? <p className="text-sm text-slate-500">Sin departamentos</p> : departamentos.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
              {deptEditId === d.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input value={deptEditName} onChange={e => setDeptEditName(e.target.value)} className={inp + ' flex-1'} onKeyDown={e => e.key === 'Enter' && editarDept(d.id)} />
                  <button onClick={() => editarDept(d.id)} className="p-1 text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setDeptEditId(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-white">{d.nombre}</p>
                    <p className="text-xs text-slate-500">{d._count?.empleados || 0} empleados</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setDeptEditId(d.id); setDeptEditName(d.nombre); }} className="p-1 text-slate-400 hover:text-white"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => borrarDept(d.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Puestos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-green-400" />Puestos de trabajo</h3>
        <div className="flex gap-2 mb-4">
          <input value={puestoNewName} onChange={e => setPuestoNewName(e.target.value)} placeholder="Nuevo puesto..." className={inp + ' flex-1'} onKeyDown={e => e.key === 'Enter' && crearPuesto()} />
          <button onClick={crearPuesto} className={btnPrimary + ' flex items-center gap-1'}><Plus className="w-4 h-4" />Añadir</button>
        </div>
        <div className="space-y-2">
          {puestos.length === 0 ? <p className="text-sm text-slate-500">Sin puestos</p> : puestos.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
              {puestoEditId === p.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input value={puestoEditName} onChange={e => setPuestoEditName(e.target.value)} className={inp + ' flex-1'} onKeyDown={e => e.key === 'Enter' && editarPuesto(p.id)} />
                  <button onClick={() => editarPuesto(p.id)} className="p-1 text-green-400 hover:text-green-300"><Save className="w-4 h-4" /></button>
                  <button onClick={() => setPuestoEditId(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-white">{p.nombre}</p>
                    <p className="text-xs text-slate-500">{p._count?.empleados || 0} empleados</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setPuestoEditId(p.id); setPuestoEditName(p.nombre); }} className="p-1 text-slate-400 hover:text-white"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => borrarPuesto(p.id)} className="p-1 text-slate-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ===== OVERLAYS =====

  const renderModalEmpleado = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOverlay(null)} />
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><UserPlus className="w-5 h-5 text-blue-400" />Nuevo empleado</h3>
          <button onClick={() => setOverlay(null)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Nombre *</label><input className={inp} value={empNewForm.nombre} onChange={e => setEmpNewForm(f => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Apellidos *</label><input className={inp} value={empNewForm.apellidos} onChange={e => setEmpNewForm(f => ({ ...f, apellidos: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">NIF *</label><input className={inp} value={empNewForm.nif} onChange={e => setEmpNewForm(f => ({ ...f, nif: e.target.value }))} placeholder="12345678A" /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Email</label><input className={inp} type="email" value={empNewForm.email} onChange={e => setEmpNewForm(f => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Teléfono</label><input className={inp} value={empNewForm.telefono} onChange={e => setEmpNewForm(f => ({ ...f, telefono: e.target.value }))} /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Nº Seg. Social</label><input className={inp} value={empNewForm.nSS} onChange={e => setEmpNewForm(f => ({ ...f, nSS: e.target.value }))} /></div>
          </div>
          <div><label className="text-slate-400 text-xs mb-1 block">Dirección</label><input className={inp} value={empNewForm.direccion} onChange={e => setEmpNewForm(f => ({ ...f, direccion: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Fecha nacimiento</label><input className={inp} type="date" value={empNewForm.fechaNacimiento} onChange={e => setEmpNewForm(f => ({ ...f, fechaNacimiento: e.target.value }))} /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Fecha alta</label><input className={inp} type="date" value={empNewForm.fechaAlta} onChange={e => setEmpNewForm(f => ({ ...f, fechaAlta: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Departamento</label>
              <select className={inp} value={empNewForm.departamentoId} onChange={e => setEmpNewForm(f => ({ ...f, departamentoId: e.target.value }))}>
                <option value="">Sin departamento</option>
                {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div><label className="text-slate-400 text-xs mb-1 block">Puesto</label>
              <select className={inp} value={empNewForm.puestoId} onChange={e => setEmpNewForm(f => ({ ...f, puestoId: e.target.value }))}>
                <option value="">Sin puesto</option>
                {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Tipo contrato</label>
              <select className={inp} value={empNewForm.tipoContrato} onChange={e => setEmpNewForm(f => ({ ...f, tipoContrato: e.target.value }))}>
                {Object.entries(CONTRATOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label className="text-slate-400 text-xs mb-1 block">Jornada (h/sem)</label><input className={inp} type="number" value={empNewForm.jornadaHoras} onChange={e => setEmpNewForm(f => ({ ...f, jornadaHoras: Number(e.target.value) }))} /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Salario bruto</label><input className={inp} type="number" step="0.01" value={empNewForm.salarioBruto} onChange={e => setEmpNewForm(f => ({ ...f, salarioBruto: Number(e.target.value) }))} /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={crearEmpleado} disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>{saving ? 'Creando...' : 'Crear empleado'}</button>
          <button onClick={() => setOverlay(null)} className={btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  const renderModalAusencia = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOverlay(null)} />
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-yellow-400" />Nueva ausencia</h3>
          <button onClick={() => setOverlay(null)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Empleado *</label>
            <select className={inp} value={ausNewForm.empleadoId} onChange={e => setAusNewForm(f => ({ ...f, empleadoId: e.target.value }))}>
              <option value="">Seleccionar empleado...</option>
              {empleadosList.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellidos} ({e.numeroEmpleado})</option>)}
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Tipo</label>
            <select className={inp} value={ausNewForm.tipo} onChange={e => setAusNewForm(f => ({ ...f, tipo: e.target.value }))}>
              {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-slate-400 text-xs mb-1 block">Desde *</label><input className={inp} type="date" value={ausNewForm.desde} onChange={e => setAusNewForm(f => ({ ...f, desde: e.target.value }))} /></div>
            <div><label className="text-slate-400 text-xs mb-1 block">Hasta *</label><input className={inp} type="date" value={ausNewForm.hasta} onChange={e => setAusNewForm(f => ({ ...f, hasta: e.target.value }))} /></div>
          </div>
          {ausDias > 0 && <p className="text-sm text-blue-400">{ausDias} día{ausDias !== 1 ? 's' : ''} de ausencia</p>}
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Motivo</label>
            <textarea className={inp + ' min-h-[80px]'} value={ausNewForm.motivo} onChange={e => setAusNewForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Descripción del motivo..." />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={crearAusencia} disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>{saving ? 'Creando...' : 'Crear ausencia'}</button>
          <button onClick={() => setOverlay(null)} className={btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  const renderModalNomina = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOverlay(null)} />
      <div className="relative bg-slate-900 rounded-2xl border border-slate-800 p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><DollarSign className="w-5 h-5 text-green-400" />Generar nóminas</h3>
          <button onClick={() => setOverlay(null)}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Periodo *</label>
            <input type="month" className={inp} value={nomGenPeriodo} onChange={e => setNomGenPeriodo(e.target.value)} />
          </div>
          <p className="text-xs text-slate-500">Se generarán nóminas para todos los empleados activos del periodo seleccionado.</p>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={generarNominas} disabled={saving} className={btnPrimary + ' flex-1 disabled:opacity-50'}>{saving ? 'Generando...' : 'Generar'}</button>
          <button onClick={() => setOverlay(null)} className={btnSecondary}>Cancelar</button>
        </div>
      </div>
    </div>
  );

  const renderPanelEmpleado = () => {
    if (!selectedEmp) return null;
    const e = selectedEmp;
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/40" onClick={() => { setOverlay(null); setEmpEditMode(false); }} />
        <div className="w-[480px] bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {e.nombre?.charAt(0)}{e.apellidos?.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold">{e.nombre} {e.apellidos}</p>
                <p className="text-xs text-slate-400">{e.numeroEmpleado}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!empEditMode && <button onClick={() => { setEmpEditMode(true); setEmpEditForm({ ...e }); }} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg flex items-center gap-1"><Edit3 className="w-3 h-3" />Editar</button>}
              <button onClick={() => { setOverlay(null); setEmpEditMode(false); }} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {empEditMode ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-slate-400 text-xs mb-1 block">Nombre</label><input className={inp} value={empEditForm.nombre || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, nombre: ev.target.value }))} /></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Apellidos</label><input className={inp} value={empEditForm.apellidos || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, apellidos: ev.target.value }))} /></div>
                </div>
                <div><label className="text-slate-400 text-xs mb-1 block">NIF</label><input className={inp} value={empEditForm.nif || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, nif: ev.target.value }))} /></div>
                <div><label className="text-slate-400 text-xs mb-1 block">Email</label><input className={inp} value={empEditForm.email || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, email: ev.target.value }))} /></div>
                <div><label className="text-slate-400 text-xs mb-1 block">Teléfono</label><input className={inp} value={empEditForm.telefono || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, telefono: ev.target.value }))} /></div>
                <div><label className="text-slate-400 text-xs mb-1 block">Dirección</label><input className={inp} value={empEditForm.direccion || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, direccion: ev.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-slate-400 text-xs mb-1 block">Departamento</label>
                    <select className={inp} value={empEditForm.departamentoId || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, departamentoId: ev.target.value }))}>
                      <option value="">Sin departamento</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                    </select>
                  </div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Puesto</label>
                    <select className={inp} value={empEditForm.puestoId || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, puestoId: ev.target.value }))}>
                      <option value="">Sin puesto</option>
                      {puestos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-slate-400 text-xs mb-1 block">Contrato</label>
                    <select className={inp} value={empEditForm.tipoContrato || ''} onChange={ev => setEmpEditForm((f: any) => ({ ...f, tipoContrato: ev.target.value }))}>
                      {Object.entries(CONTRATOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Jornada</label><input className={inp} type="number" value={empEditForm.jornadaHoras || 40} onChange={ev => setEmpEditForm((f: any) => ({ ...f, jornadaHoras: Number(ev.target.value) }))} /></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Salario</label><input className={inp} type="number" step="0.01" value={empEditForm.salarioBruto || 0} onChange={ev => setEmpEditForm((f: any) => ({ ...f, salarioBruto: Number(ev.target.value) }))} /></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={guardarEmpleado} disabled={saving} className={btnPrimary + ' flex-1 flex items-center justify-center gap-2 disabled:opacity-50'}><Save className="w-4 h-4" />{saving ? 'Guardando...' : 'Guardar'}</button>
                  <button onClick={() => setEmpEditMode(false)} className={btnSecondary}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                {/* Personal info */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Información personal</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'NIF', value: e.nif },
                      { label: 'Email', value: e.email || '—' },
                      { label: 'Teléfono', value: e.telefono || '—' },
                      { label: 'Dirección', value: e.direccion || '—' },
                      { label: 'F. nacimiento', value: fmtDate(e.fechaNacimiento) },
                      { label: 'Nº SS', value: e.nSS || '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Employment info */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Información laboral</h4>
                  <div className="space-y-2">
                    {[
                      { label: 'Departamento', value: e.departamento?.nombre || '—' },
                      { label: 'Puesto', value: e.puesto?.nombre || '—' },
                      { label: 'Contrato', value: CONTRATOS[e.tipoContrato] || e.tipoContrato || '—' },
                      { label: 'Jornada', value: (e.jornadaHoras || 40) + ' h/semana' },
                      { label: 'Salario bruto', value: fmtNum(e.salarioBruto || 0) + ' \u20ac/año' },
                      { label: 'Fecha alta', value: fmtDate(e.fechaAlta) },
                      { label: 'Fecha baja', value: e.fechaBaja ? fmtDate(e.fechaBaja) : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex justify-between text-sm">
                        <span className="text-slate-400">{label}</span>
                        <span className="text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className={'w-2 h-2 rounded-full ' + (e.activo !== false ? 'bg-green-400' : 'bg-red-400')} />
                    <span className="text-sm text-slate-300">{e.activo !== false ? 'Activo' : 'Inactivo'}</span>
                  </div>
                </div>
                {/* Recent ausencias */}
                {e.ausencias && e.ausencias.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Últimas ausencias</h4>
                    <div className="space-y-2">
                      {e.ausencias.slice(0, 5).map((a: any) => (
                        <div key={a.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm text-white">{TIPOS[a.tipo] || a.tipo}</p>
                            <p className="text-xs text-slate-500">{fmtDate(a.desde)} - {fmtDate(a.hasta)} · {a.dias}d</p>
                          </div>
                          <Badge estado={a.estado} map={ESTADO_AUS} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Recent nominas */}
                {e.nominas && e.nominas.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Últimas nóminas</h4>
                    <div className="space-y-2">
                      {e.nominas.slice(0, 5).map((n: any) => (
                        <div key={n.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm text-white">{n.periodo}</p>
                            <p className="text-xs text-slate-500">Neto: {fmtNum(n.salarioNeto)} \u20ac</p>
                          </div>
                          <Badge estado={n.estado} map={ESTADO_NOM} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderPanelNomina = () => {
    if (!selectedNom) return null;
    const n = selectedNom;
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-black/40" onClick={() => setOverlay(null)} />
        <div className="w-[480px] bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold">Nómina {n.periodo}</p>
              <p className="text-xs text-slate-400">{n.empleado?.nombre} {n.empleado?.apellidos}</p>
            </div>
            <button onClick={() => setOverlay(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              {[
                { label: 'Salario bruto', value: fmtNum(n.salarioBruto) + ' \u20ac', cls: 'text-white' },
                { label: 'IRPF', value: '-' + fmtNum(n.irpf) + ' \u20ac', cls: 'text-red-400' },
                { label: 'Seguridad Social', value: '-' + fmtNum(n.seguridadSocial) + ' \u20ac', cls: 'text-red-400' },
                { label: 'Total deducciones', value: '-' + fmtNum(n.totalDeducciones) + ' \u20ac', cls: 'text-red-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className={cls}>{value}</span>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-2 flex justify-between text-sm font-bold">
                <span className="text-slate-300">Salario neto</span>
                <span className="text-green-400">{fmtNum(n.salarioNeto)} \u20ac</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Estado:</span>
              <Badge estado={n.estado} map={ESTADO_NOM} />
            </div>
            <div className="flex gap-2 pt-2">
              {n.estado === 'BORRADOR' && <button onClick={() => { aprobarNomina(n.id); setOverlay(null); }} className={btnPrimary + ' flex items-center gap-2'}><Check className="w-4 h-4" />Aprobar</button>}
              {n.estado === 'APROBADA' && <button onClick={() => { pagarNomina(n.id); setOverlay(null); }} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2"><DollarSign className="w-4 h-4" />Marcar como pagada</button>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===== MAIN RENDER =====
  return (
    <div className="space-y-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-lg text-sm">{toast}</div>}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-blue-400" />Recursos Humanos</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gestión de empleados, ausencias, nóminas y departamentos</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setOverlay(null); setEmpEditMode(false); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === 'dashboard' && renderDashboard()}
      {tab === 'empleados' && renderEmpleados()}
      {tab === 'ausencias' && renderAusencias()}
      {tab === 'nominas' && renderNominas()}
      {tab === 'departamentos' && renderDepartamentos()}
      {tab === 'presencia' && <TabPresencia />}
      {tab === 'organigrama' && <TabOrganigrama />}

      {/* Overlays - only one at a time */}
      {overlay === 'modalEmpleado' && renderModalEmpleado()}
      {overlay === 'modalAusencia' && renderModalAusencia()}
      {overlay === 'modalNomina' && renderModalNomina()}
      {overlay === 'panelEmpleado' && renderPanelEmpleado()}
      {overlay === 'panelNomina' && renderPanelNomina()}
    </div>
  );
}
