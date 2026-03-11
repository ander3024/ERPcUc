import { useState, useEffect, useCallback } from 'react';

const API = '/api/config';
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const ROLES = ['SUPERADMIN', 'ADMIN', 'CONTABLE', 'COMERCIAL', 'ALMACENERO', 'EMPLEADO'];
const ROL_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  ADMIN:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  CONTABLE:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  COMERCIAL:  'bg-green-500/10 text-green-400 border-green-500/20',
  ALMACENERO: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  EMPLEADO:   'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function Modal({ title, onClose, children }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'nuevo' | 'editar' | null>(null);
  const [editando, setEditando] = useState<any>(null);
  const [form, setForm] = useState({ email: '', password: '', nombre: '', apellidos: '', rol: 'EMPLEADO', telefono: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/usuarios`, { headers });
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } catch { setData([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNuevo = () => {
    setForm({ email: '', password: '', nombre: '', apellidos: '', rol: 'EMPLEADO', telefono: '' });
    setError('');
    setModal('nuevo');
  };

  const openEditar = (u: any) => {
    setEditando(u);
    setForm({ email: u.email, password: '', nombre: u.nombre, apellidos: u.apellidos || '', rol: u.rol, telefono: u.telefono || '' });
    setError('');
    setModal('editar');
  };

  const handleGuardar = async () => {
    if (!form.nombre || !form.email) { setError('Nombre y email son obligatorios'); return; }
    if (modal === 'nuevo' && form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setSaving(true); setError('');
    try {
      const url = modal === 'nuevo' ? `${API}/usuarios` : `${API}/usuarios/${editando.id}`;
      const method = modal === 'nuevo' ? 'POST' : 'PUT';
      const body = modal === 'nuevo' ? form : { ...form, ...(form.password ? {} : { password: undefined }) };
      const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Error'); return; }
      setModal(null);
      fetchData();
    } catch { setError('Error de conexión'); } finally { setSaving(false); }
  };

  const handleToggle = async (id: string, nombre: string, activo: boolean) => {
    if (!confirm(`¿${activo ? 'Desactivar' : 'Activar'} al usuario ${nombre}?`)) return;
    try {
      const res = await fetch(`${API}/usuarios/${id}/toggle`, { method: 'PATCH', headers });
      if (res.ok) fetchData();
      else { const d = await res.json(); alert(d.error || 'Error'); }
    } catch { alert('Error de conexión'); }
  };

  const activos = data.filter(u => u.activo).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <p className="text-slate-500 text-sm mt-0.5">{data.length} usuarios · {activos} activos</p>
        </div>
        <button onClick={openNuevo}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Usuario', 'Rol', 'Teléfono', 'Último acceso', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="py-16 text-center text-slate-500">No hay usuarios</td></tr>
            ) : data.map(u => {
              const rolCls = ROL_COLORS[u.rol] || ROL_COLORS.EMPLEADO;
              const iniciales = `${u.nombre?.[0] || ''}${u.apellidos?.[0] || ''}`.toUpperCase();
              return (
                <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-white">{iniciales}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{u.nombre} {u.apellidos}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${rolCls}`}>{u.rol}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{u.telefono || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtDate(u.ultimoAcceso)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${u.activo
                      ? 'bg-green-500/10 text-green-400 border-green-500/20'
                      : 'bg-slate-500/10 text-slate-500 border-slate-600/20'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditar(u)}
                        className="px-2 py-1 text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded-lg hover:border-slate-600 hover:text-white transition-colors">
                        ✏️ Editar
                      </button>
                      <button onClick={() => handleToggle(u.id, u.nombre, u.activo)}
                        className={`px-2 py-1 text-xs rounded-lg border transition-colors ${u.activo
                          ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'}`}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo usuario' : 'Editar usuario'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Apellidos</label>
                <input value={form.apellidos} onChange={e => setForm(p => ({ ...p, apellidos: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                disabled={modal === 'editar'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">
                Contraseña {modal === 'editar' && <span className="text-slate-600">(dejar vacío para no cambiar)</span>}
              </label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={modal === 'editar' ? '••••••' : 'Mínimo 6 caracteres'}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Rol</label>
                <select value={form.rol} onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Teléfono</label>
                <input value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => setModal(null)}
                className="flex-1 px-4 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
