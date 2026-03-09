import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Save, Building2, CreditCard, Users } from 'lucide-react';
import toast from 'react-hot-toast';

const SECTIONS = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'facturacion', label: 'Facturación', icon: CreditCard },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
];

const FIELDS: Record<string, { k: string; label: string; type?: string; full?: boolean }[]> = {
  empresa: [
    { k: 'nombreEmpresa', label: 'Nombre empresa' },
    { k: 'cifNif', label: 'CIF/NIF' },
    { k: 'direccion', label: 'Dirección', full: true },
    { k: 'codigoPostal', label: 'Código Postal' },
    { k: 'ciudad', label: 'Ciudad' },
    { k: 'provincia', label: 'Provincia' },
    { k: 'telefono', label: 'Teléfono' },
    { k: 'email', label: 'Email', type: 'email' },
    { k: 'web', label: 'Web' },
  ],
  facturacion: [
    { k: 'serieFactura', label: 'Serie factura' },
    { k: 'proximoNumeroFactura', label: 'Próximo número', type: 'number' },
    { k: 'diasVencimiento', label: 'Días vencimiento', type: 'number' },
    { k: 'textoPiePagina', label: 'Pie de página', full: true },
  ],
};

export default function ConfigPage() {
  const [section, setSection] = useState('empresa');
  const [form, setForm] = useState<any>({});

  useQuery({
    queryKey: ['config'],
    queryFn: () => api.get('/config').then(r => r.data),
    onSuccess: (d: any) => setForm(d || {}),
  } as any);

  const mutation = useMutation({
    mutationFn: (d: any) => api.put('/config', d),
    onSuccess: () => toast.success('Configuración guardada'),
    onError: () => toast.error('Error al guardar'),
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-slate-500 text-sm mt-0.5">Ajustes del sistema y empresa</p>
      </div>

      <div className="flex gap-5">
        <div className="w-48 space-y-1 shrink-0">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                section === s.id
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}>
              <s.icon size={15} />{s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6">
          {section === 'usuarios' ? (
            <div className="text-center py-10">
              <Users size={32} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">Gestión de usuarios próximamente</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {FIELDS[section]?.map(f => (
                  <div key={f.k} className={f.full ? 'col-span-2' : ''}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      value={form[f.k] || ''}
                      onChange={e => set(f.k, e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                ))}
              </div>
              <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                <Save size={15} />
                {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
