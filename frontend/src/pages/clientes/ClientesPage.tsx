import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

const IVA_TIPOS = [
  { label: 'General 21%', value: 21 },
  { label: 'Reducido 10%', value: 10 },
  { label: 'Superreducido 4%', value: 4 },
  { label: 'Exento 0%', value: 0 },
];

const TIPO_CLIENTE = ['EMPRESA', 'AUTONOMO', 'PARTICULAR'];

const EMPTY_FORM = {
  nombre: '', nombreComercial: '', cifNif: '', tipoCliente: 'EMPRESA',
  email: '', telefono: '', movil: '', web: '',
  direccion: '', codigoPostal: '', ciudad: '', provincia: '', pais: 'España',
  formaPagoId: '', tipoIva: 21, descuento: '', limiteCredito: '',
  grupoClienteId: '', cuentaContable: '', observaciones: '',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors";
const sel = "w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors";

export default function ClientesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<any>(EMPTY_FORM);

  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20', search, ...(filtroActivo && { activo: filtroActivo }) });
      const [cRes, sRes] = await Promise.all([
        fetch(`${API}/clientes?${params}`, { headers }),
        fetch(`${API}/clientes/stats`, { headers }),
      ]);
      const cData = await cRes.json();
      const sData = await sRes.json();
      setData(cData.data || []);
      setPagination(cData.pagination || { page: 1, total: 0, pages: 0 });
      setStats(sData);
    } catch { setData([]); } finally { setLoading(false); }
  }, [search, filtroActivo]);

  const fetchMeta = async () => {
    try {
      const [gRes, fpRes] = await Promise.all([
        fetch(`${API}/clientes/grupos/list`, { headers }),
        fetch(`${API}/clientes/formas-pago/list`, { headers }),
      ]);
      const gData = await gRes.json(); setGrupos(Array.isArray(gData) ? gData : []);
      const fpData = await fpRes.json(); setFormasPago(Array.isArray(fpData) ? fpData : []);
    } catch { setGrupos([]); setFormasPago([]); }
  };

  useEffect(() => { fetchData(1); }, [fetchData]);
  useEffect(() => { fetchMeta(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const handleGuardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        tipoIva: parseFloat(form.tipoIva) || 21,
        descuento: form.descuento !== '' ? parseFloat(form.descuento) : 0,
        limiteCredito: form.limiteCredito !== '' ? parseFloat(form.limiteCredito) : null,
        formaPagoId: form.formaPagoId || null,
        grupoClienteId: form.grupoClienteId || null,
        movil: form.movil || undefined,
        web: form.web || undefined,
        cuentaContable: form.cuentaContable || undefined,
      };
      const res = await fetch(`${API}/clientes`, { method: 'POST', headers, body: JSON.stringify(payload) });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Error al guardar'); return; }
      setModal(false);
      fetchData(1);
    } catch { setError('Error de conexión'); } finally { setSaving(false); }
  };

  const openModal = () => { setForm({ ...EMPTY_FORM }); setError(''); setModal(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{pagination.total} clientes registrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(`${API}/clientes/export?token=${token}`, '_blank')}
            className="px-3 py-2 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 hover:text-white transition-colors">
            ⬇ CSV
          </button>
          <button onClick={openModal}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total clientes', value: stats.total, cls: 'text-white' },
            { label: 'Activos', value: stats.activos, cls: 'text-green-400' },
            { label: 'Inactivos', value: stats.inactivos, cls: 'text-slate-400' },
            { label: 'Pendiente cobro', value: fmt(stats.pendienteTotal), cls: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar por nombre, CIF, email..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <select value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              {['Código', 'Cliente', 'CIF/NIF', 'Teléfono', 'Ciudad', 'IVA', 'F. Pago', 'Facturas', 'Estado'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-800/50">
                {Array.from({ length: 9 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                ))}
              </tr>
            )) : data.length === 0 ? (
              <tr><td colSpan={9} className="py-16 text-center">
                <p className="text-slate-500">No hay clientes{search ? ' con ese criterio' : ''}</p>
                {!search && <button onClick={openModal} className="mt-3 text-sm text-blue-400 hover:text-blue-300">+ Crear el primer cliente</button>}
              </td></tr>
            ) : data.map(c => (
              <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-blue-400">{c.codigo || '—'}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{c.nombre}</p>
                  {c.nombreComercial && c.nombreComercial !== c.nombre && <p className="text-xs text-slate-500">{c.nombreComercial}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{c.cifNif || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{c.telefono || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{c.ciudad || '—'}</td>
                <td className="px-4 py-3 text-sm text-slate-400">{c.tipoIva != null ? `${c.tipoIva}%` : '—'}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{c.formaPago?.nombre || '—'}</td>
                <td className="px-4 py-3 text-sm text-center text-slate-400">{c._count?.facturas ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-500/10 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                    {c.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <span className="text-xs text-slate-500">Pág. {pagination.page} de {pagination.pages} · {pagination.total} clientes</span>
            <div className="flex gap-2">
              <button onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">← Anterior</button>
              <button onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 text-xs text-slate-400 disabled:text-slate-700 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:cursor-not-allowed">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo cliente */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Nuevo cliente</h2>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white transition-colors text-xl leading-none">✕</button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

              {/* Datos básicos */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Datos básicos</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Nombre / Razón social *">
                      <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Razón social" className={inp} />
                    </Field>
                  </div>
                  <Field label="Nombre comercial">
                    <input value={form.nombreComercial} onChange={e => set('nombreComercial', e.target.value)} placeholder="Nombre comercial" className={inp} />
                  </Field>
                  <Field label="CIF / NIF">
                    <input value={form.cifNif} onChange={e => set('cifNif', e.target.value)} placeholder="B12345678" className={inp} />
                  </Field>
                  <Field label="Tipo de cliente">
                    <select value={form.tipoCliente} onChange={e => set('tipoCliente', e.target.value)} className={sel}>
                      {TIPO_CLIENTE.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Grupo">
                    <select value={form.grupoClienteId} onChange={e => set('grupoClienteId', e.target.value)} className={sel}>
                      <option value="">Sin grupo</option>
                      {grupos.map((g: any) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Contacto */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contacto</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email">
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@empresa.com" className={inp} />
                  </Field>
                  <Field label="Teléfono">
                    <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="944 000 000" className={inp} />
                  </Field>
                  <Field label="Móvil">
                    <input value={form.movil} onChange={e => set('movil', e.target.value)} placeholder="600 000 000" className={inp} />
                  </Field>
                  <Field label="Web">
                    <input value={form.web} onChange={e => set('web', e.target.value)} placeholder="https://empresa.com" className={inp} />
                  </Field>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dirección fiscal</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Dirección">
                      <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle, número, piso..." className={inp} />
                    </Field>
                  </div>
                  <Field label="Código postal">
                    <input value={form.codigoPostal} onChange={e => set('codigoPostal', e.target.value)} placeholder="28001" className={inp} />
                  </Field>
                  <Field label="Ciudad">
                    <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} placeholder="Madrid" className={inp} />
                  </Field>
                  <Field label="Provincia">
                    <input value={form.provincia} onChange={e => set('provincia', e.target.value)} placeholder="Madrid" className={inp} />
                  </Field>
                  <Field label="País">
                    <input value={form.pais} onChange={e => set('pais', e.target.value)} placeholder="España" className={inp} />
                  </Field>
                </div>
              </div>

              {/* Fiscal y comercial */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Fiscal y comercial</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="IVA">
                    <select value={form.tipoIva} onChange={e => set('tipoIva', e.target.value)} className={sel}>
                      {IVA_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Forma de pago">
                    <select value={form.formaPagoId} onChange={e => set('formaPagoId', e.target.value)} className={sel}>
                      <option value="">Sin definir</option>
                      {formasPago.map((fp: any) => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Descuento %">
                    <input type="number" min="0" max="100" step="0.01" value={form.descuento}
                      onChange={e => set('descuento', e.target.value)} placeholder="0.00" className={inp} />
                  </Field>
                  <Field label="Límite de crédito €">
                    <input type="number" min="0" step="0.01" value={form.limiteCredito}
                      onChange={e => set('limiteCredito', e.target.value)} placeholder="Sin límite" className={inp} />
                  </Field>
                  <Field label="Cuenta contable">
                    <input value={form.cuentaContable} onChange={e => set('cuentaContable', e.target.value)} placeholder="4300000001" className={inp} />
                  </Field>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <Field label="Observaciones">
                  <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
                    rows={3} placeholder="Observaciones internas..."
                    className={`${inp} resize-none`} />
                </Field>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Crear cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
