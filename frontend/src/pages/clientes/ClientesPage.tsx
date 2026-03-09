import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api';

const TIPOS_IVA = [
  { value: 'GENERAL', label: 'General 21%', color: 'bg-blue-100 text-blue-800' },
  { value: 'REDUCIDO', label: 'Reducido 10%', color: 'bg-green-100 text-green-800' },
  { value: 'SUPERREDUCIDO', label: 'Superreducido 4%', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'EXENTO', label: 'Exento 0%', color: 'bg-gray-100 text-gray-700' },
  { value: 'INTRACOMUNITARIO', label: 'Intracomunitario', color: 'bg-purple-100 text-purple-800' },
  { value: 'EXPORTACION', label: 'Exportación', color: 'bg-orange-100 text-orange-800' },
];

const ivaInfo = (tipo: string) =>
  TIPOS_IVA.find(t => t.value === tipo) || { label: tipo, color: 'bg-gray-100 text-gray-700' };

const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

export default function ClientesPage() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  const [filters, setFilters] = useState({
    search: '', grupo: '', tipoIva: '', activo: '', orderBy: 'nombre', order: 'asc'
  });

  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    nombre: '', nombreComercial: '', cifNif: '', email: '', telefono: '',
    direccion: '', codigoPostal: '', ciudad: '', provincia: '', pais: 'España',
    tipoIva: 'GENERAL', recargoEquivalencia: false, exentoIva: false,
    limiteCredito: '', diasPago: '30', descuento: '', grupoId: '', formaPagoId: '',
    observaciones: '', activo: true
  });
  const [formError, setFormError] = useState('');

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ ...filters, page: String(page), limit: '20' });
      const [cRes, sRes] = await Promise.all([
        fetch(`${API}/clientes?${params}`, { headers }),
        fetch(`${API}/clientes/stats`, { headers }),
      ]);
      const cData = await cRes.json();
      const sData = await sRes.json();
      setClientes(cData.data || []);
      setPagination(cData.pagination || {});
      setStats(sData);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchMeta = async () => {
    try {
      const [gRes, fpRes] = await Promise.all([
        fetch(`${API}/clientes/grupos/list`, { headers }),
        fetch(`${API}/clientes/formas-pago/list`, { headers }),
      ]);
      const gData = await gRes.json();
      const fpData = await fpRes.json();
      setGrupos(Array.isArray(gData) ? gData : []);
      setFormasPago(Array.isArray(fpData) ? fpData : []);
    } catch {
      setGrupos([]);
      setFormasPago([]);
    }
  };

  useEffect(() => { fetchAll(1); }, [filters]);
  useEffect(() => { fetchMeta(); }, []);

  const handleSave = async () => {
    if (!form.nombre.trim()) { setFormError('El nombre es obligatorio'); return; }
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`${API}/clientes`, {
        method: 'POST', headers, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Error al guardar'); return; }
      setModal(false);
      fetchAll(1);
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const exportar = () => {
    window.open(`${API}/clientes/export?token=${token}`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de cartera de clientes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportar}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            ⬇ Exportar CSV
          </button>
          <button onClick={() => { setModal(true); setFormError(''); setForm({ nombre: '', nombreComercial: '', cifNif: '', email: '', telefono: '', direccion: '', codigoPostal: '', ciudad: '', provincia: '', pais: 'España', tipoIva: 'GENERAL', recargoEquivalencia: false, exentoIva: false, limiteCredito: '', diasPago: '30', descuento: '', grupoId: '', formaPagoId: '', observaciones: '', activo: true }); }}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            + Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Clientes', value: stats.total, icon: '👥', color: 'blue' },
            { label: 'Activos', value: stats.activos, icon: '✅', color: 'green' },
            { label: 'Nuevos este mes', value: stats.nuevosMes, icon: '🆕', color: 'indigo' },
            { label: 'Con límite crédito', value: stats.conRiesgo, icon: '💳', color: 'yellow' },
            { label: 'Facturación total', value: fmt(stats.facturacionTotal), icon: '💰', color: 'emerald' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            placeholder="🔍 Buscar por nombre, CIF, email..."
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            className="md:col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={filters.tipoIva} onChange={e => setFilters(f => ({ ...f, tipoIva: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los IVA</option>
            {TIPOS_IVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filters.grupo} onChange={e => setFilters(f => ({ ...f, grupo: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los grupos</option>
            {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <select value={filters.activo} onChange={e => setFilters(f => ({ ...f, activo: e.target.value }))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">CIF/NIF</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Teléfono</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ciudad</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo IVA</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Cuenta Cont.</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">F. Pago</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Facturas</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clientes.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                  No se encontraron clientes
                </td></tr>
              ) : clientes.map(c => (
                <tr key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.codigoCliente || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.nombre}</div>
                    {c.nombreComercial && c.nombreComercial !== c.nombre &&
                      <div className="text-xs text-gray-400">{c.nombreComercial}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.cifNif || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.telefono || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.ciudad || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ivaInfo(c.tipoIva).color}`}>
                      {ivaInfo(c.tipoIva).label}
                    </span>
                    {c.recargoEquivalencia && (
                      <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-red-100 text-red-700">+RE</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.cuentaContable || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{c.formaPago?.nombre || '—'}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{c._count?.facturas ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">
              {pagination.total} clientes — Página {pagination.page} de {pagination.pages}
            </span>
            <div className="flex gap-2">
              <button onClick={() => fetchAll(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-white disabled:opacity-40">← Anterior</button>
              <button onClick={() => fetchAll(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-white disabled:opacity-40">Siguiente →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuevo Cliente */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Cliente</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 space-y-6">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{formError}</div>
              )}

              {/* Datos básicos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Datos básicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                    <input value={form.nombre} onChange={e => setForm((f: any) => ({ ...f, nombre: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Razón social" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                    <input value={form.nombreComercial} onChange={e => setForm((f: any) => ({ ...f, nombreComercial: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Nombre comercial" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CIF / NIF</label>
                    <input value={form.cifNif} onChange={e => setForm((f: any) => ({ ...f, cifNif: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="B12345678" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))}
                      type="email"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="cliente@empresa.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input value={form.telefono} onChange={e => setForm((f: any) => ({ ...f, telefono: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="944 000 000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
                    <select value={form.grupoId} onChange={e => setForm((f: any) => ({ ...f, grupoId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Sin grupo</option>
                      {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dirección */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dirección fiscal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <input value={form.direccion} onChange={e => setForm((f: any) => ({ ...f, direccion: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Dirección completa" />
                  </div>
                  <div>
                    <input value={form.codigoPostal} onChange={e => setForm((f: any) => ({ ...f, codigoPostal: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Código Postal" />
                  </div>
                  <div>
                    <input value={form.ciudad} onChange={e => setForm((f: any) => ({ ...f, ciudad: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ciudad" />
                  </div>
                  <div>
                    <input value={form.provincia} onChange={e => setForm((f: any) => ({ ...f, provincia: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Provincia" />
                  </div>
                  <div>
                    <input value={form.pais} onChange={e => setForm((f: any) => ({ ...f, pais: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="País" />
                  </div>
                </div>
              </div>

              {/* Fiscal */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Configuración fiscal y contable</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de IVA</label>
                    <select value={form.tipoIva} onChange={e => setForm((f: any) => ({ ...f, tipoIva: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      {TIPOS_IVA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-4 pb-1">
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form.recargoEquivalencia}
                        onChange={e => setForm((f: any) => ({ ...f, recargoEquivalencia: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600" />
                      Recargo de equivalencia
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={form.exentoIva}
                        onChange={e => setForm((f: any) => ({ ...f, exentoIva: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600" />
                      Exento de IVA
                    </label>
                  </div>
                </div>
              </div>

              {/* Condiciones comerciales */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Condiciones comerciales</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pago</label>
                    <select value={form.formaPagoId} onChange={e => setForm((f: any) => ({ ...f, formaPagoId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Sin definir</option>
                      {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Días de pago</label>
                    <input value={form.diasPago} onChange={e => setForm((f: any) => ({ ...f, diasPago: e.target.value }))}
                      type="number" min="0"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="30" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descuento %</label>
                    <input value={form.descuento} onChange={e => setForm((f: any) => ({ ...f, descuento: e.target.value }))}
                      type="number" min="0" max="100" step="0.01"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Límite crédito €</label>
                    <input value={form.limiteCredito} onChange={e => setForm((f: any) => ({ ...f, limiteCredito: e.target.value }))}
                      type="number" min="0" step="0.01"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00" />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                <textarea value={form.observaciones} onChange={e => setForm((f: any) => ({ ...f, observaciones: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Observaciones internas..." />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Guardando...' : 'Crear Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
