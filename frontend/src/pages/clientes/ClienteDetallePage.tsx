import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const API = '/api';

const TIPOS_IVA = [
  { value: 'GENERAL', label: 'General 21%', pct: 21 },
  { value: 'REDUCIDO', label: 'Reducido 10%', pct: 10 },
  { value: 'SUPERREDUCIDO', label: 'Superreducido 4%', pct: 4 },
  { value: 'EXENTO', label: 'Exento 0%', pct: 0 },
  { value: 'INTRACOMUNITARIO', label: 'Intracomunitario', pct: 0 },
  { value: 'EXPORTACION', label: 'Exportación', pct: 0 },
];

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const TABS = ['General', 'Contactos', 'Facturas', 'Pedidos', 'Cuenta corriente', 'Riesgo'];

export default function ClienteDetallePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<any>(null);
  const [riesgo, setRiesgo] = useState<any>(null);
  const [cuentaCorriente, setCuentaCorriente] = useState<any>(null);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('General');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [modalContacto, setModalContacto] = useState(false);
  const [contactoForm, setContactoForm] = useState<any>({ nombre: '', cargo: '', email: '', telefono: '', movil: '', principal: false });

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchCliente = async () => {
    setLoading(true);
    try {
      const [cRes, rRes, ccRes, fpRes, gRes] = await Promise.all([
        fetch(`${API}/clientes/${id}`, { headers }),
        fetch(`${API}/clientes/${id}/riesgo`, { headers }),
        fetch(`${API}/clientes/${id}/cuenta-corriente`, { headers }),
        fetch(`${API}/clientes/formas-pago/list`, { headers }),
        fetch(`${API}/clientes/grupos/list`, { headers }),
      ]);
      const c = await cRes.json();
      setCliente(c);
      setForm(c);
      setRiesgo(await rRes.json());
      setCuentaCorriente(await ccRes.json());
      const fpData = await fpRes.json();
      const gData = await gRes.json();
      setFormasPago(Array.isArray(fpData) ? fpData : []);
      setGrupos(Array.isArray(gData) ? gData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCliente(); }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${API}/clientes/${id}`, {
        method: 'PUT', headers, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setCliente(data);
        setEditMode(false);
        setSaveMsg('✅ Guardado correctamente');
        setTimeout(() => setSaveMsg(''), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar cliente "${cliente.nombre}"? Esta acción no se puede deshacer.`)) return;
    const res = await fetch(`${API}/clientes/${id}`, { method: 'DELETE', headers });
    const data = await res.json();
    if (res.ok) navigate('/clientes');
    else alert(data.error);
  };

  const handleAddContacto = async () => {
    await fetch(`${API}/clientes/${id}/contactos`, {
      method: 'POST', headers, body: JSON.stringify(contactoForm)
    });
    setModalContacto(false);
    fetchCliente();
  };

  const handleDeleteContacto = async (cid: string) => {
    if (!confirm('¿Eliminar contacto?')) return;
    await fetch(`${API}/clientes/${id}/contactos/${cid}`, { method: 'DELETE', headers });
    fetchCliente();
  };

  if (loading) return (
    <div className="p-6">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  if (!cliente) return <div className="p-6 text-red-500">Cliente no encontrado</div>;

  const tipoIvaInfo = TIPOS_IVA.find(t => t.value === cliente.tipoIva) || TIPOS_IVA[0];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/clientes')}
            className="text-gray-400 hover:text-gray-700 text-xl">←</button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cliente.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {cliente.activo ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {cliente.codigoCliente && <span className="text-sm font-mono text-gray-500">{cliente.codigoCliente}</span>}
              {cliente.cifNif && <span className="text-sm text-gray-500">CIF: {cliente.cifNif}</span>}
              {cliente.nombreComercial && cliente.nombreComercial !== cliente.nombre &&
                <span className="text-sm text-gray-400">({cliente.nombreComercial})</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {saveMsg && <span className="text-sm text-green-600 self-center">{saveMsg}</span>}
          {editMode ? (
            <>
              <button onClick={() => { setEditMode(false); setForm(cliente); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Guardando...' : '💾 Guardar'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                ✏️ Editar
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50">
                🗑️ Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Tipo IVA</div>
          <div className="font-semibold text-gray-900">{tipoIvaInfo.label}</div>
          {cliente.recargoEquivalencia && <div className="text-xs text-red-600 mt-0.5">+ Recargo equivalencia</div>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Cuenta contable</div>
          <div className="font-mono font-semibold text-gray-900">{cliente.cuentaContable || '—'}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">Forma de pago</div>
          <div className="font-semibold text-gray-900">{cliente.formaPago?.nombre || '—'}</div>
          <div className="text-xs text-gray-400">{cliente.diasPago ? `${cliente.diasPago} días` : ''}</div>
        </div>
        {riesgo && (
          <>
            <div className={`rounded-xl border p-4 ${riesgo.alerta ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className="text-xs text-gray-500 mb-1">Riesgo vivo</div>
              <div className={`font-bold text-lg ${riesgo.alerta ? 'text-red-600' : 'text-gray-900'}`}>{fmt(riesgo.riesgoVivo)}</div>
              {riesgo.limiteCredito > 0 && (
                <div className="text-xs text-gray-400">Límite: {fmt(riesgo.limiteCredito)}</div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xs text-gray-500 mb-1">Facturas</div>
              <div className="font-bold text-lg text-gray-900">{cliente._count?.facturas || 0}</div>
              <div className="text-xs text-gray-400">{cliente._count?.pedidosVenta || 0} pedidos</div>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TAB: GENERAL */}
          {activeTab === 'General' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Datos básicos */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Datos de contacto</h3>
                {[
                  { label: 'Nombre', key: 'nombre' },
                  { label: 'Nombre Comercial', key: 'nombreComercial' },
                  { label: 'CIF / NIF', key: 'cifNif' },
                  { label: 'Email', key: 'email', type: 'email' },
                  { label: 'Teléfono', key: 'telefono' },
                  { label: 'Móvil', key: 'telefonoMovil' },
                  { label: 'Fax', key: 'fax' },
                  { label: 'Web', key: 'web' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="w-36 text-sm text-gray-500 shrink-0">{label}</label>
                    {editMode
                      ? <input value={form[key] || ''} type={type || 'text'}
                          onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      : <span className="text-sm text-gray-900 font-medium">{cliente[key] || '—'}</span>
                    }
                  </div>
                ))}
              </div>

              {/* Dirección + Fiscal */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">Dirección fiscal</h3>
                  {[
                    { label: 'Dirección', key: 'direccion' },
                    { label: 'C.P.', key: 'codigoPostal' },
                    { label: 'Ciudad', key: 'ciudad' },
                    { label: 'Provincia', key: 'provincia' },
                    { label: 'País', key: 'pais' },
                  ].map(({ label, key }) => (
                    <div key={key} className="flex items-center gap-3">
                      <label className="w-24 text-sm text-gray-500 shrink-0">{label}</label>
                      {editMode
                        ? <input value={form[key] || ''} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        : <span className="text-sm text-gray-900 font-medium">{cliente[key] || '—'}</span>
                      }
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">Configuración fiscal</h3>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-sm text-gray-500 shrink-0">Tipo IVA</label>
                    {editMode
                      ? <select value={form.tipoIva || 'GENERAL'} onChange={e => setForm((f: any) => ({ ...f, tipoIva: e.target.value }))}
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {TIPOS_IVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      : <span className="text-sm font-medium text-gray-900">{tipoIvaInfo.label}</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-sm text-gray-500 shrink-0">Rec. Equiv.</label>
                    {editMode
                      ? <input type="checkbox" checked={form.recargoEquivalencia}
                          onChange={e => setForm((f: any) => ({ ...f, recargoEquivalencia: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600" />
                      : <span className="text-sm font-medium">{cliente.recargoEquivalencia ? '✅ Sí' : 'No'}</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-sm text-gray-500 shrink-0">Exento IVA</label>
                    {editMode
                      ? <input type="checkbox" checked={form.exentoIva}
                          onChange={e => setForm((f: any) => ({ ...f, exentoIva: e.target.checked }))}
                          className="rounded border-gray-300 text-blue-600" />
                      : <span className="text-sm font-medium">{cliente.exentoIva ? '✅ Sí' : 'No'}</span>
                    }
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="w-24 text-sm text-gray-500 shrink-0">Cuenta cont.</label>
                    {editMode
                      ? <input value={form.cuentaContable || ''} onChange={e => setForm((f: any) => ({ ...f, cuentaContable: e.target.value }))}
                          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      : <span className="text-sm font-mono font-medium text-gray-900">{cliente.cuentaContable || '—'}</span>
                    }
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">Condiciones comerciales</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Forma pago', key: 'formaPagoId', type: 'select', options: formasPago },
                      { label: 'Días pago', key: 'diasPago', type: 'number' },
                      { label: 'Descuento %', key: 'descuento', type: 'number' },
                      { label: 'Límite crédito', key: 'limiteCredito', type: 'number' },
                    ].map(({ label, key, type, options }) => (
                      <div key={key}>
                        <label className="block text-xs text-gray-500 mb-1">{label}</label>
                        {editMode ? (
                          type === 'select' && options
                            ? <select value={form[key] || ''} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                <option value="">Sin definir</option>
                                {options.map((o: any) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                              </select>
                            : <input value={form[key] || ''} type={type || 'text'}
                                onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">
                            {key === 'formaPagoId' ? cliente.formaPago?.nombre || '—' :
                             key === 'limiteCredito' ? fmt(cliente[key] || 0) :
                             key === 'descuento' ? `${cliente[key] || 0}%` :
                             key === 'diasPago' ? `${cliente[key] || 0} días` : cliente[key] || '—'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              {(cliente.observaciones || editMode) && (
                <div className="md:col-span-2">
                  <h3 className="font-semibold text-gray-700 mb-2">Observaciones</h3>
                  {editMode
                    ? <textarea value={form.observaciones || ''} onChange={e => setForm((f: any) => ({ ...f, observaciones: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    : <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{cliente.observaciones}</p>
                  }
                </div>
              )}
            </div>
          )}

          {/* TAB: CONTACTOS */}
          {activeTab === 'Contactos' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Personas de contacto</h3>
                <button onClick={() => { setModalContacto(true); setContactoForm({ nombre: '', cargo: '', email: '', telefono: '', movil: '', principal: false }); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  + Añadir contacto
                </button>
              </div>
              {cliente.contactos?.length === 0
                ? <p className="text-gray-400 text-sm">No hay contactos registrados</p>
                : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cliente.contactos?.map((c: any) => (
                      <div key={c.id} className="border border-gray-200 rounded-xl p-4 relative">
                        {c.principal && <span className="absolute top-3 right-3 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Principal</span>}
                        <div className="font-semibold text-gray-900">{c.nombre}</div>
                        {c.cargo && <div className="text-sm text-gray-500">{c.cargo}</div>}
                        <div className="mt-2 space-y-1 text-sm text-gray-600">
                          {c.email && <div>✉️ {c.email}</div>}
                          {c.telefono && <div>📞 {c.telefono}</div>}
                          {c.movil && <div>📱 {c.movil}</div>}
                        </div>
                        <button onClick={() => handleDeleteContacto(c.id)}
                          className="mt-2 text-xs text-red-500 hover:text-red-700">Eliminar</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* TAB: FACTURAS */}
          {activeTab === 'Facturas' && (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Número</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Cobrado</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Pendiente</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cliente.facturas?.map((f: any) => {
                    const cobrado = f.cobros?.reduce((s: number, c: any) => s + Number(c.importe), 0) || 0;
                    const pendiente = Number(f.total) - cobrado;
                    return (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono font-medium">{f.numero}</td>
                        <td className="px-3 py-2 text-gray-600">{fmtDate(f.fecha)}</td>
                        <td className="px-3 py-2 text-right font-medium">{fmt(Number(f.total))}</td>
                        <td className="px-3 py-2 text-right text-green-600">{fmt(cobrado)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${pendiente > 0 ? 'text-red-600' : 'text-gray-400'}`}>{fmt(pendiente)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            f.estado === 'COBRADA' ? 'bg-green-100 text-green-700' :
                            f.estado === 'VENCIDA' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'}`}>{f.estado}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: PEDIDOS */}
          {activeTab === 'Pedidos' && (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Número</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Total</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cliente.pedidosVenta?.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-medium">{p.numero}</td>
                      <td className="px-3 py-2 text-gray-600">{fmtDate(p.fecha)}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(Number(p.total))}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">{p.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: CUENTA CORRIENTE */}
          {activeTab === 'Cuenta corriente' && cuentaCorriente && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">Cuenta corriente</h3>
                <div className={`text-lg font-bold ${cuentaCorriente.saldoActual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Saldo: {fmt(cuentaCorriente.saldoActual)}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Fecha</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Concepto</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Debe</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Haber</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cuentaCorriente.movimientos?.map((m: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600">{fmtDate(m.fecha)}</td>
                      <td className="px-3 py-2">{m.concepto}</td>
                      <td className="px-3 py-2 text-right text-red-600">{fmt(m.debe)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{fmt(m.haber)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${m.saldo > 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(m.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: RIESGO */}
          {activeTab === 'Riesgo' && riesgo && (
            <div className="max-w-lg space-y-4">
              <h3 className="font-semibold text-gray-700">Análisis de riesgo</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Riesgo vivo (facturas pendientes)</div>
                  <div className={`text-2xl font-bold ${riesgo.alerta ? 'text-red-600' : 'text-gray-900'}`}>{fmt(riesgo.riesgoVivo)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Límite de crédito</div>
                  <div className="text-2xl font-bold text-gray-900">{riesgo.limiteCredito > 0 ? fmt(riesgo.limiteCredito) : 'Sin límite'}</div>
                </div>
                {riesgo.limiteCredito > 0 && (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">Crédito disponible</div>
                      <div className={`text-2xl font-bold ${riesgo.disponible < 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(riesgo.disponible)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="text-xs text-gray-500 mb-1">% utilizado</div>
                      <div className={`text-2xl font-bold ${riesgo.porcentajeUsado > 90 ? 'text-red-600' : riesgo.porcentajeUsado > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {riesgo.porcentajeUsado}%
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div className={`h-4 rounded-full transition-all ${riesgo.porcentajeUsado > 90 ? 'bg-red-500' : riesgo.porcentajeUsado > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(100, riesgo.porcentajeUsado)}%` }} />
                      </div>
                      {riesgo.alerta && (
                        <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                          ⚠️ Este cliente ha superado el 90% de su límite de crédito
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nuevo Contacto */}
      {modalContacto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Nuevo Contacto</h2>
            {[
              { label: 'Nombre *', key: 'nombre' },
              { label: 'Cargo', key: 'cargo' },
              { label: 'Email', key: 'email' },
              { label: 'Teléfono', key: 'telefono' },
              { label: 'Móvil', key: 'movil' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-sm text-gray-600 mb-1">{label}</label>
                <input value={contactoForm[key]} onChange={e => setContactoForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={contactoForm.principal}
                onChange={e => setContactoForm((f: any) => ({ ...f, principal: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600" />
              Contacto principal
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setModalContacto(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleAddContacto}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
