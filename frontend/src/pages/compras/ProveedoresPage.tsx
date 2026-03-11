import { useState, useEffect, useCallback } from 'react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';
const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors';

export default function ProveedoresPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [selected, setSelected] = useState<any | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState<any>({ nombre: '', cifNif: '', email: '', telefono: '', direccion: '', observaciones: '' });
  const [confirm, setConfirm] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search });
      const r = await fetch(`${API}/compras/proveedores?${params}`, { headers });
      const d = await r.json();
      setData(Array.isArray(d.data) ? d.data : []);
      setPagination(d.pagination || { page: 1, total: 0, pages: 0 });
    } catch { setData([]); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { cargar(1); }, [cargar]);
  useEffect(() => { const t = setTimeout(() => setSearch(searchInput), 400); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSelected(null); setShowNew(false); } };
    document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h);
  }, []);

  const cargarDetalle = async (id: string) => {
    const r = await fetch(`${API}/compras/proveedores/${id}`, { headers });
    const d = await r.json();
    setSelected(d); setForm({ ...d }); setEditMode(false);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/compras/proveedores/${selected.id}`, { method: 'PUT', headers, body: JSON.stringify(form) });
      const d = await r.json();
      if (r.ok) { showToast('✅ Guardado'); setSelected(d); setForm(d); setEditMode(false); cargar(pagination.page); }
      else showToast(d.error || 'Error');
    } catch { showToast('Error'); } finally { setSaving(false); }
  };

  const crear = async () => {
    if (!newForm.nombre) { showToast('Nombre requerido'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${API}/compras/proveedores`, { method: 'POST', headers, body: JSON.stringify(newForm) });
      const d = await r.json();
      if (r.ok) { showToast('✅ Proveedor creado'); setShowNew(false); setNewForm({ nombre: '', cifNif: '', email: '', telefono: '', direccion: '', observaciones: '' }); cargar(1); }
      else showToast(d.error || 'Error');
    } catch { showToast('Error'); } finally { setSaving(false); }
  };

  const eliminar = async () => {
    try {
      const r = await fetch(`${API}/compras/proveedores/${selected.id}`, { method: 'DELETE', headers });
      if (r.ok) { showToast('Eliminado'); setSelected(null); setData(prev => prev.filter(p => p.id !== selected.id)); cargar(1); }
      else { const d = await r.json(); showToast(d.error || 'No se puede eliminar'); }
    } catch { showToast('Error'); } finally { setConfirm(''); }
  };

  return (
    <div className="p-6 space-y-6">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl whitespace-nowrap">{toast}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Proveedores</h1>
          <p className="text-slate-500 text-sm mt-0.5">{pagination.total} proveedores</p>
        </div>
        <button onClick={() => setShowNew(true)} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">+ Nuevo proveedor</button>
      </div>

      <input type="text" placeholder="Buscar por nombre o CIF/NIF..." value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
        : data.length === 0 ? <div className="text-center py-16 text-slate-500">No hay proveedores{search ? ' con ese criterio' : ''}</div>
        : <>
          <table className="w-full">
            <thead><tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">CIF/NIF</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Teléfono</th>
              <th className="text-center px-4 py-3 text-xs text-slate-500 font-medium">Estado</th>
            </tr></thead>
            <tbody>
              {data.map((p: any) => (
                <tr key={p.id} onClick={() => cargarDetalle(p.id)} className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-medium text-white text-sm">{p.nombre}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">{p.cifNif || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{p.telefono || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.activo ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-500'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">Página {pagination.page} de {pagination.pages}</span>
              <div className="flex gap-2">
                <button onClick={() => cargar(pagination.page - 1)} disabled={pagination.page <= 1} className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg disabled:opacity-30 hover:bg-slate-700">← Anterior</button>
                <button onClick={() => cargar(pagination.page + 1)} disabled={pagination.page >= pagination.pages} className="px-3 py-1.5 text-xs bg-slate-800 text-slate-400 rounded-lg disabled:opacity-30 hover:bg-slate-700">Siguiente →</button>
              </div>
            </div>
          )}
        </>}
      </div>

      {showNew && <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setShowNew(false)} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold text-white">Nuevo proveedor</h2>
            {(['nombre', 'Nombre *'] as const) && [['nombre','Nombre *'],['cifNif','CIF/NIF'],['email','Email'],['telefono','Teléfono'],['direccion','Dirección']].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs text-slate-500 block mb-1">{label}</label>
                <input type="text" value={newForm[field] || ''} onChange={e => setNewForm((p: any) => ({ ...p, [field]: e.target.value }))} className={inp} />
              </div>
            ))}
            <div>
              <label className="text-xs text-slate-500 block mb-1">Observaciones</label>
              <textarea value={newForm.observaciones || ''} rows={2} onChange={e => setNewForm((p: any) => ({ ...p, observaciones: e.target.value }))} className={`${inp} resize-none`} />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-500">Cancelar</button>
              <button onClick={crear} disabled={saving} className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Crear proveedor'}</button>
            </div>
          </div>
        </div>
      </>}

      {selected && <>
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
        <div className="fixed right-0 top-0 h-full w-full max-w-lg z-50 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col" style={{ animation: 'slideIn .22s ease-out' }}>
          <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg text-white">{selected.nombre}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${selected.activo ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700 text-slate-500'}`}>{selected.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Datos generales</h3>
                {!editMode
                  ? <button onClick={() => setEditMode(true)} className="text-xs text-blue-400 hover:text-blue-300">Editar</button>
                  : <div className="flex gap-2">
                      <button onClick={() => { setEditMode(false); setForm({ ...selected }); }} className="text-xs text-slate-500 hover:text-white">Cancelar</button>
                      <button onClick={guardar} disabled={saving} className="text-xs text-green-400 hover:text-green-300 font-medium">{saving ? 'Guardando...' : 'Guardar'}</button>
                    </div>
                }
              </div>
              {editMode ? (
                <div className="space-y-3">
                  {[['nombre','Nombre'],['cifNif','CIF/NIF'],['email','Email'],['telefono','Teléfono'],['movil','Móvil'],['contacto','Contacto'],['direccion','Dirección'],['ciudad','Ciudad'],['provincia','Provincia'],['codigoPostal','C. Postal']].map(([field, label]) => (
                    <div key={field}>
                      <label className="text-xs text-slate-500 block mb-1">{label}</label>
                      <input type="text" value={form[field] || ''} onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))} className={inp} />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-slate-500 block mb-1">Observaciones</label>
                    <textarea value={form.observaciones || ''} rows={3} onChange={e => setForm((p: any) => ({ ...p, observaciones: e.target.value }))} className={`${inp} resize-none`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="activo" checked={form.activo ?? true} onChange={e => setForm((p: any) => ({ ...p, activo: e.target.checked }))} />
                    <label htmlFor="activo" className="text-sm text-slate-300">Activo</label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[['CIF/NIF', selected.cifNif, true],['Email', selected.email, false],['Teléfono', selected.telefono, false],['Móvil', selected.movil, false],['Contacto', selected.contacto, false],['Dirección', selected.direccion, false],['Ciudad', selected.ciudad, false],['Provincia', selected.provincia, false]].map(([label, value, mono]: any) =>
                    value ? <div key={label} className="flex justify-between items-baseline gap-4">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className={`text-sm text-slate-200 text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
                    </div> : null
                  )}
                  {selected.observaciones && <div className="pt-2 border-t border-slate-800"><p className="text-xs text-slate-500 mb-1">Observaciones</p><p className="text-sm text-slate-400 italic">{selected.observaciones}</p></div>}
                </div>
              )}
            </div>
            {selected.pedidos?.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Últimos pedidos</h3>
                <div className="space-y-2">
                  {selected.pedidos.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center text-sm">
                      <span className="font-mono text-slate-300">{p.numero}</span>
                      <span className="text-slate-500">{fmtDate(p.fecha)}</span>
                      <span className="text-white">{fmt(Number(p.total))}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 border-t border-slate-800 px-6 py-4">
            {confirm === 'del'
              ? <div className="flex items-center gap-2 bg-slate-900 border border-red-500/30 rounded-xl px-3 py-2">
                  <span className="text-xs text-red-400 flex-1">¿Eliminar proveedor?</span>
                  <button onClick={eliminar} className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg">Eliminar</button>
                  <button onClick={() => setConfirm('')} className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded-lg">No</button>
                </div>
              : <button onClick={() => setConfirm('del')} className="w-full py-2.5 text-sm text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors">🗑 Eliminar proveedor</button>
            }
          </div>
        </div>
      </>}
    </div>
  );
}
