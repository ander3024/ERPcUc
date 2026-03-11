import { useState, useEffect, useCallback } from 'react';
import { UserCheck, Plus, Pencil, Trash2, Search, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface Agente {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  comision: number;
  activo: boolean;
  _count?: { clientes: number; facturas: number };
}

export default function AgentesPage() {
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', comision: 0, activo: true });

  const fetchAgentes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/config/agentes?search=${encodeURIComponent(search)}`, { headers: headers() });
      const data = await res.json();
      setAgentes(Array.isArray(data) ? data : data.data || []);
    } catch { /* */ }
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchAgentes(); }, [fetchAgentes]);

  const openNew = () => { setEditId(null); setForm({ nombre: '', email: '', telefono: '', comision: 0, activo: true }); setModal(true); };
  const openEdit = (a: Agente) => { setEditId(a.id); setForm({ nombre: a.nombre, email: a.email || '', telefono: a.telefono || '', comision: a.comision, activo: a.activo }); setModal(true); };

  const save = async () => {
    const url = editId ? `${API}/config/agentes/${editId}` : `${API}/config/agentes`;
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
    setModal(false);
    fetchAgentes();
  };

  const toggleActivo = async (a: Agente) => {
    await fetch(`${API}/config/agentes/${a.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ ...a, activo: !a.activo }) });
    fetchAgentes();
  };

  const deleteAgente = async (id: string) => {
    if (!confirm('Eliminar agente?')) return;
    await fetch(`${API}/config/agentes/${id}`, { method: 'DELETE', headers: headers() });
    fetchAgentes();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><UserCheck size={24} /> Agentes Comerciales</h1>
          <p className="text-slate-400 text-sm mt-1">Gestión de agentes/comerciales y comisiones</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nuevo agente
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar agentes..."
          className="w-full pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Grid agentes */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : agentes.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <UserCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay agentes comerciales</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentes.map(a => (
            <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
                    a.activo ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-500')}>
                    {a.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{a.nombre}</h3>
                    {a.email && <p className="text-xs text-slate-400">{a.email}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActivo(a)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded" title={a.activo ? 'Desactivar' : 'Activar'}>
                    {a.activo ? <ToggleRight size={16} className="text-emerald-400" /> : <ToggleLeft size={16} />}
                  </button>
                  <button onClick={() => openEdit(a)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded"><Pencil size={14} /></button>
                  <button onClick={() => deleteAgente(a.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Comisión</p>
                  <p className="text-lg font-bold text-blue-400">{a.comision}%</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Clientes</p>
                  <p className="text-lg font-bold text-white">{a._count?.clientes ?? 0}</p>
                </div>
              </div>
              {a.telefono && <p className="text-xs text-slate-500 mt-3">Tel: {a.telefono}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar' : 'Nuevo'} Agente</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Teléfono</label>
                <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Comisión (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={form.comision} onChange={e => setForm(f => ({ ...f, comision: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
                Activo
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={save} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                <Save size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
