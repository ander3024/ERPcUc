import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Euro, Users, Package,
  AlertTriangle, Clock, CheckCircle, ArrowRight
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import clsx from 'clsx';

function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: any) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20',
  };
  const iconColors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-5 backdrop-blur`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${iconColors[color]}`}>
          <Icon size={20} />
        </div>
        {trend !== undefined && (
          <div className={clsx(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            trend >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          )}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function AlertItem({ tipo, texto, link }: any) {
  const config: Record<string, any> = {
    danger: { cls: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertTriangle },
    warning: { cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: Clock },
    success: { cls: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
  };
  const c = config[tipo] || config.warning;
  const Icon = c.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${c.cls}`}>
      <Icon size={16} className="shrink-0" />
      <span className="text-sm flex-1">{texto}</span>
      {link && <ArrowRight size={14} className="shrink-0 opacity-60" />}
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get('/dashboard/kpis').then(r => r.data),
    refetchInterval: 60000, // actualizar cada minuto
  });

  const { data: ventasMensual } = useQuery({
    queryKey: ['dashboard', 'ventas-mensual'],
    queryFn: () => api.get('/dashboard/ventas-mensual').then(r => r.data),
  });

  const { data: topClientes } = useQuery({
    queryKey: ['dashboard', 'top-clientes'],
    queryFn: () => api.get('/dashboard/top-clientes').then(r => r.data),
  });

  const { data: alertas } = useQuery({
    queryKey: ['dashboard', 'alertas'],
    queryFn: () => api.get('/dashboard/alertas').then(r => r.data),
    refetchInterval: 120000,
  });

  const totalAlertas = (alertas?.stockBajo?.length || 0) +
    (alertas?.facturasVencidas?.length || 0) +
    (alertas?.pedidosPendientesEntrega?.length || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500">En tiempo real</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Ventas este mes"
          value={loadingKpis ? '...' : formatCurrency(kpis?.ventasMes?.valor || 0)}
          subtitle={`vs ${formatCurrency(kpis?.ventasMes?.anterior || 0)} mes anterior`}
          icon={Euro}
          trend={kpis?.ventasMes?.variacion}
          color="blue"
        />
        <KpiCard
          title="Cobros pendientes"
          value={loadingKpis ? '...' : formatCurrency(kpis?.cobros?.pendiente || 0)}
          subtitle={`${kpis?.cobros?.numFacturas || 0} facturas sin cobrar`}
          icon={Clock}
          color="orange"
        />
        <KpiCard
          title="Clientes activos"
          value={loadingKpis ? '...' : kpis?.clientes?.total?.toLocaleString() || '0'}
          subtitle={`+${kpis?.clientes?.nuevos || 0} nuevos este mes`}
          icon={Users}
          color="green"
        />
        <KpiCard
          title="Alertas activas"
          value={loadingKpis ? '...' : totalAlertas}
          subtitle="Stock bajo, facturas vencidas..."
          icon={AlertTriangle}
          color={totalAlertas > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ventas mensuales */}
        <div className="xl:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Evolución de Ventas</h2>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
              {new Date().getFullYear()}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={ventasMensual || []}>
              <defs>
                <linearGradient id="ventas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                labelStyle={{ color: '#f8fafc', fontWeight: 600 }}
                formatter={(v: any) => [formatCurrency(v), 'Ventas']}
              />
              <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} fill="url(#ventas)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top clientes */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <h2 className="text-base font-semibold text-white mb-5">Top Clientes (año)</h2>
          <div className="space-y-3">
            {(topClientes || []).slice(0, 7).map((c: any, i: number) => (
              <div key={c.clienteId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{c.nombre}</p>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                      style={{ width: `${(c.total / (topClientes?.[0]?.total || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-slate-400 shrink-0">
                  {formatCurrency(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" />
              Alertas que requieren atención
            </h2>
            <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
              {totalAlertas} alertas
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stock bajo */}
            {alertas?.stockBajo?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Stock bajo ({alertas.stockBajo.length})
                </p>
                <div className="space-y-2">
                  {alertas.stockBajo.slice(0, 4).map((a: any) => (
                    <AlertItem
                      key={a.id}
                      tipo="warning"
                      texto={`${a.nombre}: ${a.stockActual} uds (mín. ${a.stockMinimo})`}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Facturas vencidas */}
            {alertas?.facturasVencidas?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Facturas vencidas ({alertas.facturasVencidas.length})
                </p>
                <div className="space-y-2">
                  {alertas.facturasVencidas.slice(0, 4).map((f: any) => (
                    <AlertItem
                      key={f.id}
                      tipo="danger"
                      texto={`${f.cliente.nombre}: ${formatCurrency(f.total - f.totalPagado)}`}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* Pedidos con entrega retrasada */}
            {alertas?.pedidosPendientesEntrega?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                  Entregas retrasadas ({alertas.pedidosPendientesEntrega.length})
                </p>
                <div className="space-y-2">
                  {alertas.pedidosPendientesEntrega.slice(0, 4).map((p: any) => (
                    <AlertItem
                      key={p.id}
                      tipo="warning"
                      texto={`${p.numero} - ${p.cliente.nombre}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
