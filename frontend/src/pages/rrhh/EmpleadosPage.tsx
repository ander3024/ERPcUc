import { useState, useEffect, useCallback } from 'react';
import { Search, Plus, RefreshCw, Users, Phone, Mail, Calendar, ChevronRight, X, Save } from 'lucide-react';

const API = '/api';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '-';
const inp = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500';

const ROL_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-red-500/20 text-red-300 border-red-500/30',
  ADMIN: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  CONTABLE: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  COMERCIAL: 'bg-green-500/20 text-green-300 border-green-500/30',
  ALMACENERO: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  EMPLEADO: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export default function EmpleadosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ nombre: '', email: '', password: '', rol: 'EMPLEADO', telefono: '', cargo: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search });
      const r = await fetch(API + '/config/usuarios?' + params, { headers }).then(r => r.json());
      setData(Array.isArray(r) ? r : (r.data || []));
    } catch { setData([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setShowNew(false); setEditMode(false); } };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);

  const crearUsuario = async () => {
    if (!newForm.nombre || !newForm.email || !newForm.password) { showToast('Nombre, email y password son obligatorios'); return; }
    setSaving(true);
    try {
      const r = await fetch(API + '/config/usuarios', { method: 'POST', headers, body: JSON.stringify(newForm) });
      if (r.ok) { showToast('Usuario creado correctamente'); setShowNew(false); setNewForm({ nombre: '', email: '', password: '', rol: 'EMPLEADO', telefono: '', cargo: '' }); cargar(); }
      else { const e = await r.json(); showToast('Error: ' + (e.error || 'No se pudo crear')); }
    } finally { setSaving(false); }
  };

  const guardarEdicion = async () => {
    setSaving(true);
    try {
      const r = await fetch(API + '/config/usuarios/' + selected.id, { method: 'PUT', headers, body: JSON.stringify(editForm) });
      if (r.ok) { showToast('Guardado correctamente'); setEditMode(false); cargar(); }
      else showToast('Error al guardar');
    } finally { setSaving(false); }
  };

  const totalPorRol = (rol: string) => data.filter(u => u.rol === rol).length;

  return (
    <div className="p-6">
      {toast && <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-600 text-white px-4 py-3 rounded-xl shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-6 h-6 text-blue-400"/>Empleados</h1>
          <p className="text-slate-400 text-sm mt-1">{data.length} usuarios en el sistema</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4"/>Nuevo usuario
        </button>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-6">
        {['SUPERADMIN','ADMIN','CONTABLE','COMERCIAL','ALMACENERO','EMPLEADO'].map(rol => (
          <div key={rol} className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-center">
            <div className="text-2xl font-bold text-white">{totalPorRol(rol)}</div>
            <div className="text-xs text-slate-400 mt-1">{rol}</div>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700">
        <div className="p-4 border-b border-slate-700 flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"/>
            <input className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Buscar empleado..." value={searchInput} onChange={e => setSearchInput(e.target.value)}/>
          </div>
          <button onClick={cargar} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg"><RefreshCw className="w-4 h-4"/></button>
        </div>

        {loading ? <div className="p-8 text-center text-slate-400">Cargando...</div>
        : data.length === 0 ? (
          <div className="p-8 text-center text-slate-400"><Users className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>No hay empleados</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-700">
              {['Nombre','Email','Rol','Cargo','Ultimo acceso',''].map(h => (
                <th key={h} className="text-left text-slate-400 text-xs font-medium px-4 py-3">{h}</th>
              ))}
            </tr></thead>
            <tbody>{data.map(u => (
              <tr key={u.id} onClick={() => { setSelected(u); setEditForm({...u}); setEditMode(false); }}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 cursor-pointer transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
                      {u.nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="text-sm text-white font-medium">{u.nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={"text-xs px-2 py-1 rounded-full border " + (ROL_COLORS[u.rol] || 'bg-slate-600 text-slate-300')}>{u.rol}</span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.cargo || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{u.ultimoAcceso ? fmtDate(u.ultimoAcceso) : 'Nunca'}</td>
                <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-slate-500"/></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>

      {/* Panel detalle empleado */}
      {selected && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/40" onClick={() => { setSelected(null); setEditMode(false); }}/>
          <div className="w-96 bg-slate-900 border-l border-slate-700 flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                  {selected.nombre?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-semibold">{selected.nombre}</div>
                  <span className={"text-xs px-2 py-0.5 rounded-full border " + (ROL_COLORS[selected.rol] || '')}>{selected.rol}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {!editMode && <button onClick={() => setEditMode(true)} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg">Editar</button>}
                <button onClick={() => { setSelected(null); setEditMode(false); }} className="p-1 text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
              </div>
            </div>
            <div className="p-4 flex-1 space-y-4">
              {editMode ? (
                <div className="space-y-3">
                  <div><label className="text-slate-400 text-xs mb-1 block">Nombre</label><input className={inp} value={editForm.nombre||''} onChange={e => setEditForm((f:any)=>({...f,nombre:e.target.value}))}/></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Email</label><input className={inp} value={editForm.email||''} onChange={e => setEditForm((f:any)=>({...f,email:e.target.value}))}/></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Cargo</label><input className={inp} value={editForm.cargo||''} onChange={e => setEditForm((f:any)=>({...f,cargo:e.target.value}))}/></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Telefono</label><input className={inp} value={editForm.telefono||''} onChange={e => setEditForm((f:any)=>({...f,telefono:e.target.value}))}/></div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Rol</label>
                    <select className={inp} value={editForm.rol||'EMPLEADO'} onChange={e => setEditForm((f:any)=>({...f,rol:e.target.value}))}>
                      {['SUPERADMIN','ADMIN','CONTABLE','COMERCIAL','ALMACENERO','EMPLEADO'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div><label className="text-slate-400 text-xs mb-1 block">Nueva password (dejar vacio para no cambiar)</label><input className={inp} type="password" value={editForm.newPassword||''} onChange={e => setEditForm((f:any)=>({...f,newPassword:e.target.value}))}/></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={guardarEdicion} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium">
                      <Save className="w-4 h-4"/>{saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditMode(false)} className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { icon: Mail, label: 'Email', value: selected.email },
                    { icon: Phone, label: 'Telefono', value: selected.telefono || '-' },
                    { icon: Users, label: 'Cargo', value: selected.cargo || '-' },
                    { icon: Calendar, label: 'Creado', value: fmtDate(selected.createdAt) },
                    { icon: Calendar, label: 'Ultimo acceso', value: selected.ultimoAcceso ? fmtDate(selected.ultimoAcceso) : 'Nunca' },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 text-sm">
                      <Icon className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                      <div><span className="text-slate-400">{label}: </span><span className="text-white">{value}</span></div>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center gap-2">
                    <div className={"w-2 h-2 rounded-full " + (selected.activo !== false ? 'bg-green-400' : 'bg-red-400')}/>
                    <span className="text-sm text-slate-300">{selected.activo !== false ? 'Usuario activo' : 'Usuario inactivo'}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo usuario */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowNew(false)}/>
          <div className="relative bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Nuevo usuario</h3>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="space-y-3">
              <div><label className="text-slate-400 text-xs mb-1 block">Nombre completo *</label><input className={inp} value={newForm.nombre} onChange={e => setNewForm(f=>({...f,nombre:e.target.value}))} placeholder="Juan Garcia"/></div>
              <div><label className="text-slate-400 text-xs mb-1 block">Email *</label><input className={inp} type="email" value={newForm.email} onChange={e => setNewForm(f=>({...f,email:e.target.value}))} placeholder="juan@empresa.com"/></div>
              <div><label className="text-slate-400 text-xs mb-1 block">Password *</label><input className={inp} type="password" value={newForm.password} onChange={e => setNewForm(f=>({...f,password:e.target.value}))}/></div>
              <div><label className="text-slate-400 text-xs mb-1 block">Cargo</label><input className={inp} value={newForm.cargo} onChange={e => setNewForm(f=>({...f,cargo:e.target.value}))} placeholder="Comercial, Contable..."/></div>
              <div><label className="text-slate-400 text-xs mb-1 block">Rol</label>
                <select className={inp} value={newForm.rol} onChange={e => setNewForm(f=>({...f,rol:e.target.value}))}>
                  {['SUPERADMIN','ADMIN','CONTABLE','COMERCIAL','ALMACENERO','EMPLEADO'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={crearUsuario} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium">
                {saving ? 'Creando...' : 'Crear usuario'}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}