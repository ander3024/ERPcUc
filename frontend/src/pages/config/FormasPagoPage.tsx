import { useState, useEffect, useCallback } from 'react';
import { CreditCard, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_URL || '/api';
const token = () => localStorage.getItem('accessToken') || '';
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

interface FormaPago {
  id: string;
  nombre: string;
  diasVto: number;
  numVtos: number;
  tipo: string;
  codigoEneboo: string | null;
  _count?: { clientes: number; facturas: number };
}

export default function FormasPagoPage() {
  const [items, setItems] = useState<FormaPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', diasVto: 0, numVtos: 1, tipo: 'CONTADO' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/config/formas-pago`, { headers: headers() });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : data.data || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openNew = () => { setEditId(null); setForm({ nombre: '', diasVto: 0, numVtos: 1, tipo: 'CONTADO' }); setModal(true); };
  const openEdit = (fp: FormaPago) => { setEditId(fp.id); setForm({ nombre: fp.nombre, diasVto: fp.diasVto, numVtos: fp.numVtos, tipo: fp.tipo }); setModal(true); };

  const save = async () => {
    const url = editId ? `${API}/config/formas-pago/${editId}` : `${API}/config/formas-pago`;
    const method = editId ? 'PUT' : 'POST';
    await fetch(url, { method, headers: headers(), body: JSON.stringify(form) });
    setModal(false);
    fetchData();
  };

  const deleteFP = async (id: string) => {
    if (!confirm('Eliminar forma de pago?')) return;
    await fetch(`${API}/config/formas-pago/${id}`, { method: 'DELETE', headers: headers() });
    fetchData();
  };

  const TIPOS = ['CONTADO', 'GIRO', 'TRANSFERENCIA', 'RECIBO', 'CONFIRMING', 'PAGARE', 'TARJETA'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3"><CreditCard size={24} /> Formas de Pago</h1>
          <p className="text-slate-400 text-sm mt-1">Configuración de formas y plazos de pago</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Nueva forma de pago
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <CreditCard size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay formas de pago configuradas</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Nombre</th>
                <th className="text-left px-5 py-3 font-medium">Tipo</th>
                <th className="text-center px-5 py-3 font-medium">Días vto.</th>
                <th className="text-center px-5 py-3 font-medium">N° vtos.</th>
                <th className="text-center px-5 py-3 font-medium">Clientes</th>
                <th className="text-right px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map(fp => (
                <tr key={fp.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-white">{fp.nombre}</td>
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">{fp.tipo}</span>
                  </td>
                  <td className="px-5 py-3 text-center text-slate-300">{fp.diasVto}</td>
                  <td className="px-5 py-3 text-center text-slate-300">{fp.numVtos}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{fp._count?.clientes ?? '-'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(fp)} className="p-1.5 text-slate-500 hover:text-blue-400 rounded"><Pencil size={14} /></button>
                    <button onClick={() => deleteFP(fp.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">{editId ? 'Editar' : 'Nueva'} Forma de Pago</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Días vencimiento</label>
                  <input type="number" min="0" value={form.diasVto} onChange={e => setForm(f => ({ ...f, diasVto: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">N° vencimientos</label>
                  <input type="number" min="1" value={form.numVtos} onChange={e => setForm(f => ({ ...f, numVtos: parseInt(e.target.value) || 1 }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
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
