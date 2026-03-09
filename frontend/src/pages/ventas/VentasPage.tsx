import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const API = '/api/ventas';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('es-ES') : '—';

const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: 'bg-yellow-100 text-yellow-800',
  PARCIAL: 'bg-orange-100 text-orange-800',
  ACEPTADO: 'bg-green-100 text-green-800',
  RECHAZADO: 'bg-red-100 text-red-800',
  CONVERTIDO: 'bg-gray-100 text-gray-500',
  SERVIDO: 'bg-blue-100 text-blue-800',
  FACTURADO: 'bg-purple-100 text-purple-800',
  EMITIDA: 'bg-yellow-100 text-yellow-800',
  COBRADA: 'bg-green-100 text-green-800',
  VENCIDA: 'bg-red-100 text-red-800',
  CANCELADA: 'bg-gray-100 text-gray-500',
};

const tabs = ['Presupuestos', 'Pedidos', 'Albaranes', 'Facturas', 'Cobros pendientes'];

export default function VentasPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Pedidos');
  const [data, setData] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');

  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const endpoint = {
    'Presupuestos': 'presupuestos',
    'Pedidos': 'pedidos',
    'Albaranes': 'albaranes',
    'Facturas': 'facturas',
    'Cobros pendientes': 'cobros/pendientes',
  }[activeTab];

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      if (activeTab === 'Cobros pendientes') {
        const res = await fetch(`${API}/cobros/pendientes`, { headers });
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
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, estado]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleConvertir = async (id: string, accion: string) => {
    const urls: Record<string, string> = {
      'pedido': `${API}/presupuestos/${id}/convertir-pedido`,
      'albaran': `${API}/pedidos/${id}/convertir-albaran`,
      'factura-pedido': `${API}/pedidos/${id}/convertir-factura`,
      'factura-albaran': `${API}/albaranes/${id}/convertir-factura`,
    };
    const res = await fetch(urls[accion], { method: 'POST', headers, body: JSON.stringify({}) });
    const data = await res.json();
    if (res.ok) {
      alert(data.message);
      fetchData(pagination.page);
    } else {
      alert(data.error);
    }
  };

  const handleRegistrarCobro = async (facturaId: string, total: number, pendiente: number) => {
    const importe = prompt(`Registrar cobro — Pendiente: ${fmt(pendiente)}\nImporte a cobrar:`, String(pendiente.toFixed(2)));
    if (!importe) return;
    const formaPago = prompt('Forma de cobro (Transferencia, Efectivo, Tarjeta, etc):', 'Transferencia');
    const res = await fetch(`${API}/cobros`, {
      method: 'POST', headers,
      body: JSON.stringify({ facturaId, importe: parseFloat(importe), formaPago, fecha: new Date().toISOString() })
    });
    const data = await res.json();
    if (res.ok) { alert('Cobro registrado'); fetchData(pagination.page); }
    else alert(data.error);
  };

  const statsCards = stats ? {
    'Presupuestos': [
      { label: 'Total', value: stats.total, color: 'gray' },
      { label: 'Pendientes', value: stats.pendientes, color: 'yellow' },
      { label: 'Aceptados', value: stats.aceptados, color: 'green' },
      { label: 'Importe pendiente', value: fmt(stats.importePendiente), color: 'blue' },
    ],
    'Pedidos': [
      { label: 'Total', value: stats.total, color: 'gray' },
      { label: 'Pendientes', value: stats.pendientes, color: 'yellow' },
      { label: 'Parciales', value: stats.parciales, color: 'orange' },
      { label: 'Importe pendiente', value: fmt(stats.importePendiente), color: 'blue' },
    ],
    'Albaranes': [
      { label: 'Total', value: stats.total, color: 'gray' },
      { label: 'Sin facturar', value: stats.pendientes, color: 'yellow' },
      { label: 'Facturados', value: stats.facturados, color: 'green' },
      { label: 'Por facturar', value: fmt(stats.importePendiente), color: 'blue' },
    ],
    'Facturas': [
      { label: 'Emitidas', value: stats.emitidas, color: 'yellow' },
      { label: 'Cobradas', value: stats.cobradas, color: 'green' },
      { label: 'Vencidas', value: stats.vencidas, color: 'red' },
      { label: 'Pendiente cobro', value: fmt(stats.pendienteTotal), color: 'orange' },
    ],
  }[activeTab] || [] : [];

  const estadosOpciones: Record<string, string[]> = {
    'Presupuestos': ['PENDIENTE', 'ACEPTADO', 'RECHAZADO', 'CONVERTIDO'],
    'Pedidos': ['PENDIENTE', 'PARCIAL', 'SERVIDO', 'FACTURADO', 'CANCELADO'],
    'Albaranes': ['PENDIENTE', 'FACTURADO'],
    'Facturas': ['EMITIDA', 'COBRADA', 'VENCIDA', 'CANCELADA'],
    'Cobros pendientes': [],
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-sm text-gray-500 mt-1">Presupuestos · Pedidos · Albaranes · Facturas · Cobros</p>
        </div>
        <button
          onClick={() => navigate(`/ventas/nuevo/${endpoint?.replace('/stats', '')}`)}
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          + Nuevo {activeTab === 'Cobros pendientes' ? '' : activeTab.slice(0, -1)}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
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
      {activeTab !== 'Cobros pendientes' && (
        <div className="flex gap-3">
          <input
            placeholder={`🔍 Buscar ${activeTab.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={estado} onChange={e => setEstado(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            {estadosOpciones[activeTab]?.map(e => <option key={e} value={e}>{e}</option>)}
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
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  {activeTab === 'Cobros pendientes' ? 'Factura' : 'Cliente'}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                {activeTab === 'Pedidos' && <th className="text-left px-4 py-3 font-semibold text-gray-600">F. Entrega</th>}
                {activeTab === 'Facturas' && <th className="text-left px-4 py-3 font-semibold text-gray-600">Vencimiento</th>}
                {activeTab === 'Albaranes' && <th className="text-left px-4 py-3 font-semibold text-gray-600">Pedido</th>}
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Base imp.</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                {(activeTab === 'Facturas' || activeTab === 'Cobros pendientes') && (
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Pendiente</th>
                )}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>{Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">No hay {activeTab.toLowerCase()}</td></tr>
              ) : data.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-blue-600 cursor-pointer hover:underline"
                    onClick={() => navigate(`/ventas/${endpoint}/${row.id}`)}>
                    {row.numero}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {activeTab === 'Cobros pendientes' ? row.numero : row.cliente?.nombre || '—'}
                    </div>
                    {activeTab === 'Cobros pendientes' && <div className="text-xs text-gray-400">{row.cliente?.nombre}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(row.fecha)}</td>
                  {activeTab === 'Pedidos' && <td className="px-4 py-3 text-gray-500">{fmtDate(row.fechaEntrega)}</td>}
                  {activeTab === 'Facturas' && (
                    <td className={`px-4 py-3 font-medium ${row.estado === 'VENCIDA' ? 'text-red-600' : 'text-gray-500'}`}>
                      {fmtDate(row.fechaVencimiento)}
                    </td>
                  )}
                  {activeTab === 'Albaranes' && <td className="px-4 py-3 text-xs font-mono text-gray-400">{row.pedido?.numero || '—'}</td>}
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(Number(row.baseImponible))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(Number(row.total))}</td>
                  {(activeTab === 'Facturas' || activeTab === 'Cobros pendientes') && (
                    <td className={`px-4 py-3 text-right font-semibold ${Number(row.pendiente) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(Number(row.pendiente))}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[row.estado] || 'bg-gray-100 text-gray-600'}`}>
                      {row.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {activeTab === 'Presupuestos' && row.estado === 'PENDIENTE' && (
                        <button onClick={() => handleConvertir(row.id, 'pedido')}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                          → Pedido
                        </button>
                      )}
                      {activeTab === 'Pedidos' && row.estado !== 'SERVIDO' && row.estado !== 'FACTURADO' && (
                        <>
                          <button onClick={() => handleConvertir(row.id, 'albaran')}
                            className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                            → Albarán
                          </button>
                          <button onClick={() => handleConvertir(row.id, 'factura-pedido')}
                            className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
                            → Factura
                          </button>
                        </>
                      )}
                      {activeTab === 'Albaranes' && row.estado === 'PENDIENTE' && (
                        <button onClick={() => handleConvertir(row.id, 'factura-albaran')}
                          className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100">
                          → Factura
                        </button>
                      )}
                      {(activeTab === 'Facturas' && (row.estado === 'EMITIDA' || row.estado === 'VENCIDA')) && (
                        <button onClick={() => handleRegistrarCobro(row.id, Number(row.total), Number(row.pendiente))}
                          className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
                          💰 Cobrar
                        </button>
                      )}
                      {activeTab === 'Cobros pendientes' && (
                        <button onClick={() => handleRegistrarCobro(row.id, Number(row.total), Number(row.pendiente))}
                          className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
                          💰 Cobrar
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
