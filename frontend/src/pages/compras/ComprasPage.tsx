import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const API = '/api/compras';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const ESTADO_COLORS: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-600',
  ENVIADO: 'bg-blue-100 text-blue-800',
  PARCIALMENTE_RECIBIDO: 'bg-orange-100 text-orange-800',
  RECIBIDO: 'bg-green-100 text-green-800',
  FACTURADO: 'bg-purple-100 text-purple-800',
  CANCELADO: 'bg-gray-100 text-gray-500',
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  EMITIDA: 'bg-yellow-100 text-yellow-800',
  COBRADA: 'bg-green-100 text-green-800',
  VENCIDA: 'bg-red-100 text-red-800',
  ANULADA: 'bg-gray-100 text-gray-500',
};

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  PARCIALMENTE_RECIBIDO: 'Parcial',
  RECIBIDO: 'Recibido',
  FACTURADO: 'Facturado',
  CANCELADO: 'Cancelado',
  PENDIENTE: 'Pendiente',
  EMITIDA: 'Pendiente pago',
  COBRADA: 'Pagada',
  VENCIDA: 'Vencida',
  ANULADA: 'Anulada',
};

const tabs = ['Pedidos compra', 'Albaranes compra', 'Facturas compra', 'Pagos pendientes'];

export default function ComprasPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>((location.state as any)?.tab || 'Pedidos compra');
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');

  const token = localStorage.getItem('accessToken');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const endpoint = {
    'Pedidos compra': 'pedidos',
    'Albaranes compra': 'albaranes',
    'Facturas compra': 'facturas',
    'Pagos pendientes': 'pagos/pendientes',
  }[activeTab];

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      if (activeTab === 'Pagos pendientes') {
        const res = await fetch(`${API}/pagos/pendientes`, { headers });
        const d = await res.json();
        setData(Array.isArray(d) ? d : []);
        setStats(null);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: '20', search, estado });
        const [dRes, sRes] = await Promise.all([
          fetch(`${API}/${endpoint}?${params}`, { headers }),
          fetch(`${API}/${endpoint}/stats`, { headers }),
        ]);
        const dData = await dRes.json();
        const sData = await sRes.json();
        setData(Array.isArray(dData.data) ? dData.data : []);
        setPagination(dData.pagination || {});
        setStats(sData);
      }
    } catch {
      setData([]);
    } finally { setLoading(false); }
  }, [activeTab, search, estado]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleConvertirAlbaran = async (id: string) => {
    try {
      const res = await fetch(`${API}/pedidos/${id}/convertir-albaran`, { method: 'POST', headers, body: JSON.stringify({}) });
      const d = await res.json();
      if (res.ok) { alert(d.message || 'Albarán creado'); fetchData(pagination.page); }
      else alert(d.error || 'Error');
    } catch { alert('Error de conexión'); }
  };

  const handleConvertirFactura = async (id: string) => {
    const numFactura = prompt('Número de factura del proveedor:');
    if (!numFactura) return;
    try {
      const res = await fetch(`${API}/albaranes/${id}/convertir-factura`, {
        method: 'POST', headers, body: JSON.stringify({ numeroFacturaProveedor: numFactura })
      });
      const d = await res.json();
      if (res.ok) { alert(d.message || 'Factura creada'); fetchData(pagination.page); }
      else alert(d.error || 'Error');
    } catch { alert('Error de conexión'); }
  };

  const handlePagar = async (facturaId: string, pendiente: number) => {
    const importe = prompt(`Registrar pago — Pendiente: ${fmt(pendiente)}\nImporte:`, String(pendiente.toFixed(2)));
    if (!importe) return;
    const formaPago = prompt('Forma de pago:', 'Transferencia');
    if (!formaPago) return;
    try {
      const res = await fetch(`${API}/pagos`, {
        method: 'POST', headers,
        body: JSON.stringify({ facturaId, importe: parseFloat(importe), formaPago, fecha: new Date().toISOString() })
      });
      const d = await res.json();
      if (res.ok) { alert('Pago registrado'); fetchData(pagination.page); }
      else alert(d.error || 'Error');
    } catch { alert('Error de conexión'); }
  };

  const statsCards = (stats ? ({
    'Pedidos compra': [
      { label: 'Total', value: stats.total },
      { label: 'Pendientes', value: stats.pendientes },
      { label: 'Parciales', value: stats.parciales },
      { label: 'Importe pendiente', value: fmt(stats.importePendiente) },
    ],
    'Albaranes compra': [
      { label: 'Total', value: stats.total },
      { label: 'Sin facturar', value: stats.pendientes },
      { label: 'Facturados', value: stats.facturados },
      { label: 'Por facturar', value: fmt(stats.importePendiente) },
    ],
    'Facturas compra': [
      { label: 'Total', value: stats.total },
      { label: 'Pendientes pago', value: stats.pendientes },
      { label: 'Pagadas', value: stats.pagadas },
      { label: 'Por pagar', value: fmt(stats.pendienteTotal) },
    ],
  } as Record<string, any[]>)[activeTab] : null) || [];

  const estadosOpciones: Record<string, { value: string, label: string }[]> = {
    'Pedidos compra': [
      { value: 'BORRADOR', label: 'Borrador' },
      { value: 'ENVIADO', label: 'Enviado' },
      { value: 'PARCIALMENTE_RECIBIDO', label: 'Parcialmente recibido' },
      { value: 'RECIBIDO', label: 'Recibido' },
      { value: 'FACTURADO', label: 'Facturado' },
      { value: 'CANCELADO', label: 'Cancelado' },
    ],
    'Albaranes compra': [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'FACTURADO', label: 'Facturado' },
    ],
    'Facturas compra': [
      { value: 'EMITIDA', label: 'Pendiente pago' },
      { value: 'COBRADA', label: 'Pagada' },
      { value: 'VENCIDA', label: 'Vencida' },
    ],
    'Pagos pendientes': [],
  };

  // Número visible: facturas compra usan numeroProveedor
  const getNumero = (row: any) => row.numero || row.numeroProveedor || '—';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
          <p className="text-sm text-gray-500 mt-1">Pedidos · Albaranes · Facturas · Pagos a proveedores</p>
        </div>
        {activeTab === 'Pedidos compra' && (
          <button onClick={() => alert('Formulario de nuevo pedido de compra — próximamente')}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            + Nuevo Pedido
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); setEstado(''); }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === tab
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Stats */}
      {statsCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statsCards.map((s: any) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      {activeTab !== 'Pagos pendientes' && (
        <div className="flex gap-3 flex-wrap">
          <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <select value={estado} onChange={e => setEstado(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            {estadosOpciones[activeTab]?.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Número</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Proveedor</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                {activeTab === 'Pedidos compra' && <th className="text-left px-4 py-3 font-semibold text-gray-600">F. Entrega</th>}
                {activeTab === 'Facturas compra' && <th className="text-left px-4 py-3 font-semibold text-gray-600">Vencimiento</th>}
                {activeTab === 'Albaranes compra' && <th className="text-left px-4 py-3 font-semibold text-gray-600">Pedido</th>}
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                {(activeTab === 'Facturas compra' || activeTab === 'Pagos pendientes') && (
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Pendiente</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  No hay {activeTab.toLowerCase()}
                </td></tr>
              ) : data.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-blue-600">{getNumero(row)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{row.proveedor?.nombre || '—'}</div>
                    <div className="text-xs text-gray-400">{row.proveedor?.cifNif || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(row.fecha)}</td>
                  {activeTab === 'Pedidos compra' && (
                    <td className="px-4 py-3 text-gray-500">{fmtDate(row.fechaEntrega)}</td>
                  )}
                  {activeTab === 'Facturas compra' && (
                    <td className={`px-4 py-3 font-medium ${row.estado === 'VENCIDA' ? 'text-red-600' : 'text-gray-500'}`}>
                      {fmtDate(row.fechaVencimiento)}
                    </td>
                  )}
                  {activeTab === 'Albaranes compra' && (
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{row.pedido?.numero || '—'}</td>
                  )}
                  <td className="px-4 py-3 text-right font-semibold">{fmt(Number(row.total))}</td>
                  {(activeTab === 'Facturas compra' || activeTab === 'Pagos pendientes') && (
                    <td className={`px-4 py-3 text-right font-semibold ${Number(row.pendiente) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(Number(row.pendiente))}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[row.estado] || 'bg-gray-100 text-gray-600'}`}>
                      {ESTADO_LABELS[row.estado] || row.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {activeTab === 'Pedidos compra' && !['RECIBIDO', 'FACTURADO', 'CANCELADO'].includes(row.estado) && (
                        <button onClick={() => handleConvertirAlbaran(row.id)}
                          className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                          → Albarán
                        </button>
                      )}
                      {activeTab === 'Albaranes compra' && row.estado === 'PENDIENTE' && (
                        <button onClick={() => handleConvertirFactura(row.id)}
                          className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
                          → Factura
                        </button>
                      )}
                      {(activeTab === 'Facturas compra' || activeTab === 'Pagos pendientes') && Number(row.pendiente) > 0 && (
                        <button onClick={() => handlePagar(row.id, Number(row.pendiente))}
                          className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
                          💳 Pagar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-sm text-gray-500">{pagination.total} registros — Pág. {pagination.page} de {pagination.pages}</span>
            <div className="flex gap-2">
              <button onClick={() => fetchData(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-40">← Ant.</button>
              <button onClick={() => fetchData(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="px-3 py-1 text-sm border rounded hover:bg-white disabled:opacity-40">Sig. →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
