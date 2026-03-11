import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Euro, Users, Package,
  AlertTriangle, Clock, CheckCircle, ArrowRight,
  FileText, Truck, ShoppingCart, CalendarX,
  Settings2, Eye, EyeOff, GripVertical, X, Download,
} from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/format';
import { useExport } from '../../hooks/useExport';
import clsx from 'clsx';

// ── Config key ─────────────────────────────────────────────────────────
const DASH_CONFIG_KEY = 'erp-dashboard-config';

type WidgetId = 'kpis' | 'chart' | 'topClientes' | 'ultimasFacturas' | 'facturasVencidas' | 'stockBajo' | 'entregas';

interface DashConfig {
  order: WidgetId[];
  hidden: WidgetId[];
}

const DEFAULT_ORDER: WidgetId[] = ['kpis', 'chart', 'topClientes', 'ultimasFacturas', 'facturasVencidas', 'stockBajo', 'entregas'];

const WIDGET_LABELS: Record<WidgetId, string> = {
  kpis: 'KPIs principales',
  chart: 'Gráfico de ventas',
  topClientes: 'Top clientes',
  ultimasFacturas: 'Últimas facturas',
  facturasVencidas: 'Facturas vencidas',
  stockBajo: 'Stock bajo mínimos',
  entregas: 'Entregas retrasadas',
};

function loadConfig(): DashConfig {
  try {
    const raw = localStorage.getItem(DASH_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { order: [...DEFAULT_ORDER], hidden: [] };
}

function saveConfig(c: DashConfig) {
  localStorage.setItem(DASH_CONFIG_KEY, JSON.stringify(c));
}

// ── Estado badge config ────────────────────────────────────────────────
const estadoBadge: Record<string, string> = {
  EMITIDA: 'bg-blue-500/10 text-blue-400',
  COBRADA: 'bg-green-500/10 text-green-400',
  VENCIDA: 'bg-red-500/10 text-red-400',
  PARCIALMENTE_COBRADA: 'bg-yellow-500/10 text-yellow-400',
};

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={clsx(
      'text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full whitespace-nowrap',
      estadoBadge[estado] || 'bg-slate-500/10 text-slate-400',
    )}>
      {estado.replace(/_/g, ' ')}
    </span>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, trend, color = 'blue' }: any) {
  const colors: Record<string, string> = {
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/20',
    red: 'from-red-500/20 to-red-600/10 border-red-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20',
  };
  const iconColors: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    orange: 'bg-orange-500/20 text-orange-400',
    red: 'bg-red-500/20 text-red-400',
    purple: 'bg-purple-500/20 text-purple-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color] || colors.blue} border rounded-xl p-5 backdrop-blur`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-lg ${iconColors[color] || iconColors.blue}`}>
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

// ── Alert Item ─────────────────────────────────────────────────────────
function AlertItem({ tipo, texto }: any) {
  const config: Record<string, any> = {
    danger: { cls: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertTriangle },
    warning: { cls: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: Clock },
    success: { cls: 'text-green-400 bg-green-500/10 border-green-500/20', icon: CheckCircle },
  };
  const c = config[tipo] || config.warning;
  const IconC = c.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${c.cls}`}>
      <IconC size={16} className="shrink-0" />
      <span className="text-sm flex-1">{texto}</span>
    </div>
  );
}

// ── Section card wrapper ───────────────────────────────────────────────
function SectionCard({ title, badge, children, className }: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('bg-slate-900 rounded-xl border border-slate-800 p-5', className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────
function diasRetraso(fechaVenc: string): number {
  const diff = Date.now() - new Date(fechaVenc).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Main page ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [config, setConfig] = useState<DashConfig>(loadConfig);
  const [configOpen, setConfigOpen] = useState(false);
  const [dragItem, setDragItem] = useState<WidgetId | null>(null);
  const { exportCSV, exportPDF, buildTable } = useExport();

  const updateConfig = useCallback((fn: (prev: DashConfig) => DashConfig) => {
    setConfig(prev => {
      const next = fn(prev);
      saveConfig(next);
      return next;
    });
  }, []);

  const toggleWidget = (id: WidgetId) => {
    updateConfig(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id) ? prev.hidden.filter(h => h !== id) : [...prev.hidden, id],
    }));
  };

  const moveWidget = (from: number, to: number) => {
    updateConfig(prev => {
      const order = [...prev.order];
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item);
      return { ...prev, order };
    });
  };

  const isVisible = (id: WidgetId) => !config.hidden.includes(id);

  const { data: kpis, isLoading: loadingKpis } = useQuery({
    queryKey: ['dashboard', 'kpis'],
    queryFn: () => api.get('/dashboard/kpis').then(r => r.data),
    refetchInterval: 60000,
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

  const { data: ultimasFacturas } = useQuery({
    queryKey: ['dashboard', 'ultimas-facturas'],
    queryFn: () => api.get('/dashboard/ultimas-facturas').then(r => r.data),
  });

  const totalAlertas = (alertas?.stockBajo?.length || 0) +
    (alertas?.facturasVencidas?.length || 0) +
    (alertas?.pedidosPendientesEntrega?.length || 0);

  // Export dashboard data
  const handleExportCSV = () => {
    const headers = ['Métrica', 'Valor'];
    const rows: (string | number)[][] = [
      ['Ventas mes', kpis?.ventasMes?.valor || 0],
      ['Cobros pendientes', kpis?.cobros?.pendiente || 0],
      ['Facturas vencidas', kpis?.facturasVencidas?.count || 0],
      ['Importe vencido', kpis?.facturasVencidas?.importe || 0],
      ['Pagos proveedores', kpis?.pagosProveedores?.pendiente || 0],
      ['Clientes activos', kpis?.clientes?.total || 0],
      ['Alertas activas', totalAlertas],
    ];
    exportCSV('dashboard_kpis', headers, rows);
  };

  const handleExportPDF = () => {
    const headers = ['Métrica', 'Valor'];
    const rows: (string | number)[][] = [
      ['Ventas mes', formatCurrency(kpis?.ventasMes?.valor || 0)],
      ['Cobros pendientes', formatCurrency(kpis?.cobros?.pendiente || 0)],
      ['Facturas vencidas', String(kpis?.facturasVencidas?.count || 0)],
      ['Importe vencido', formatCurrency(kpis?.facturasVencidas?.importe || 0)],
      ['Pagos proveedores', formatCurrency(kpis?.pagosProveedores?.pendiente || 0)],
      ['Clientes activos', String(kpis?.clientes?.total || 0)],
      ['Alertas activas', String(totalAlertas)],
    ];
    exportPDF('Dashboard - Resumen', buildTable(headers, rows, [1]));
  };

  // Widget renderers
  const widgets: Record<WidgetId, () => React.ReactNode> = {
    kpis: () => (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KpiCard title="Ventas este mes" value={loadingKpis ? '...' : formatCurrency(kpis?.ventasMes?.valor || 0)}
          subtitle={`vs ${formatCurrency(kpis?.ventasMes?.anterior || 0)} mes anterior`} icon={Euro} trend={kpis?.ventasMes?.variacion} color="blue" />
        <KpiCard title="Cobros pendientes" value={loadingKpis ? '...' : formatCurrency(kpis?.cobros?.pendiente || 0)}
          subtitle={`${kpis?.cobros?.numFacturas || 0} facturas sin cobrar`} icon={Clock} color="orange" />
        <KpiCard title="Facturas vencidas" value={loadingKpis ? '...' : (kpis?.facturasVencidas?.count || 0)}
          subtitle={loadingKpis ? '...' : formatCurrency(kpis?.facturasVencidas?.importe || 0)}
          icon={CalendarX} color={(kpis?.facturasVencidas?.count || 0) > 0 ? 'red' : 'green'} />
        <KpiCard title="Pagos proveedores" value={loadingKpis ? '...' : formatCurrency(kpis?.pagosProveedores?.pendiente || 0)}
          subtitle={`${kpis?.pagosProveedores?.numFacturas || 0} facturas pendientes`} icon={ShoppingCart} color="purple" />
        <KpiCard title="Clientes activos" value={loadingKpis ? '...' : kpis?.clientes?.total?.toLocaleString() || '0'}
          subtitle={`+${kpis?.clientes?.nuevos || 0} nuevos este mes`} icon={Users} color="green" />
        <KpiCard title="Alertas activas" value={loadingKpis ? '...' : totalAlertas}
          subtitle="Stock bajo, vencidas, entregas" icon={AlertTriangle} color={totalAlertas > 0 ? 'red' : 'yellow'} />
      </div>
    ),
    chart: () => (
      <SectionCard title="Evolucion de Ventas"
        badge={<span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{new Date().getFullYear()}</span>}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={ventasMensual || []}>
            <defs>
              <linearGradient id="ventasGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="nombre" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
              labelStyle={{ color: '#f8fafc', fontWeight: 600 }} formatter={(v: any) => [formatCurrency(v), 'Ventas']} />
            <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2} fill="url(#ventasGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
    ),
    topClientes: () => (
      <SectionCard title="Top Clientes (anual)">
        <div className="space-y-3">
          {(topClientes || []).slice(0, 5).map((c: any, i: number) => (
            <div key={c.clienteId} className="flex items-center gap-3">
              <span className={clsx('text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full',
                i === 0 ? 'bg-yellow-500/20 text-yellow-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' :
                i === 2 ? 'bg-orange-500/20 text-orange-400' : 'text-slate-600')}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 truncate">{c.nombre}</p>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
                    style={{ width: `${(c.total / (topClientes?.[0]?.total || 1)) * 100}%` }} />
                </div>
              </div>
              <span className="text-xs font-medium text-slate-400 shrink-0">{formatCurrency(c.total)}</span>
            </div>
          ))}
          {(!topClientes || topClientes.length === 0) && <p className="text-sm text-slate-600 text-center py-6">Sin datos</p>}
        </div>
      </SectionCard>
    ),
    ultimasFacturas: () => (
      <SectionCard title="Ultimas facturas"
        badge={<span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded"><FileText size={12} className="inline mr-1" />Recientes</span>}>
        <div className="space-y-0 divide-y divide-slate-800">
          {(ultimasFacturas || []).slice(0, 5).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-slate-200 truncate">{f.numeroCompleto}</span>
                  <EstadoBadge estado={f.estado} />
                </div>
                <p className="text-xs text-slate-500 truncate">{f.cliente?.nombre} &middot; {formatFecha(f.fecha)}</p>
              </div>
              <span className="text-sm font-semibold text-white ml-3 shrink-0">{formatCurrency(f.total)}</span>
            </div>
          ))}
          {(!ultimasFacturas || ultimasFacturas.length === 0) && <p className="text-sm text-slate-600 text-center py-6">Sin facturas recientes</p>}
        </div>
      </SectionCard>
    ),
    facturasVencidas: () => (
      <SectionCard title="Facturas vencidas"
        badge={alertas?.facturasVencidas?.length > 0 ? (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full font-medium">{alertas.facturasVencidas.length} vencidas</span>
        ) : null}>
        <div className="space-y-0 divide-y divide-slate-800">
          {(alertas?.facturasVencidas || []).slice(0, 5).map((f: any) => {
            const pendiente = (f.total || 0) - (f.totalPagado || 0);
            const dias = f.fechaVencimiento ? diasRetraso(f.fechaVencimiento) : 0;
            return (
              <div key={f.id} className="py-2.5 first:pt-0 last:pb-0 bg-red-500/5 -mx-5 px-5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-red-300 truncate">{f.numeroCompleto}</span>
                  <span className="text-xs font-bold text-red-400 shrink-0 ml-2">{dias}d retraso</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 truncate">{f.cliente?.nombre}</p>
                  <span className="text-sm font-semibold text-red-300 shrink-0">{formatCurrency(pendiente)}</span>
                </div>
              </div>
            );
          })}
          {(!alertas?.facturasVencidas || alertas.facturasVencidas.length === 0) && (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle size={24} className="text-green-500/40 mb-2" />
              <p className="text-sm text-slate-600">Sin facturas vencidas</p>
            </div>
          )}
        </div>
      </SectionCard>
    ),
    stockBajo: () => (
      <SectionCard title="Stock bajo minimos"
        badge={alertas?.stockBajo?.length > 0 ? (
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium">{alertas.stockBajo.length} articulos</span>
        ) : null}>
        <div className="space-y-0 divide-y divide-slate-800">
          {(alertas?.stockBajo || []).slice(0, 6).map((a: any) => {
            const pct = a.stockMinimo > 0 ? Math.min(100, (a.stockActual / a.stockMinimo) * 100) : 0;
            return (
              <div key={a.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300 truncate flex-1">{a.nombre}</span>
                  <span className="text-xs text-slate-500 shrink-0 ml-2">{a.referencia}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                    <div className={clsx('h-1.5 rounded-full', pct < 30 ? 'bg-red-500' : pct < 70 ? 'bg-orange-500' : 'bg-green-500')}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className={clsx('text-xs font-medium shrink-0', a.stockActual <= 0 ? 'text-red-400' : 'text-orange-400')}>
                    {a.stockActual} / {a.stockMinimo}
                  </span>
                </div>
              </div>
            );
          })}
          {(!alertas?.stockBajo || alertas.stockBajo.length === 0) && (
            <div className="flex flex-col items-center py-6 text-center">
              <Package size={24} className="text-green-500/40 mb-2" />
              <p className="text-sm text-slate-600">Stock OK</p>
            </div>
          )}
        </div>
      </SectionCard>
    ),
    entregas: () => (
      alertas?.pedidosPendientesEntrega?.length > 0 ? (
        <SectionCard title="Entregas retrasadas"
          badge={<span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full font-medium flex items-center gap-1">
            <Truck size={12} />{alertas.pedidosPendientesEntrega.length} pedidos</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {alertas.pedidosPendientesEntrega.slice(0, 6).map((p: any) => (
              <AlertItem key={p.id} tipo="warning" texto={`${p.numero} - ${p.cliente?.nombre}`} />
            ))}
          </div>
        </SectionCard>
      ) : null
    ),
  };

  // Layout: group widgets into rows based on order
  const renderWidgets = () => {
    const visibleOrder = config.order.filter(id => isVisible(id));
    // Group: kpis is full-width, chart+topClientes share a row, next 3 share a row, entregas full-width
    const layoutGroups: { ids: WidgetId[]; cols?: string }[] = [];
    let i = 0;
    while (i < visibleOrder.length) {
      const id = visibleOrder[i];
      if (id === 'kpis' || id === 'entregas') {
        layoutGroups.push({ ids: [id] });
        i++;
      } else if (id === 'chart') {
        // chart + next item (topClientes) in a 2/3 + 1/3 grid
        const next = visibleOrder[i + 1];
        if (next && next !== 'kpis' && next !== 'entregas') {
          layoutGroups.push({ ids: [id, next], cols: 'grid grid-cols-1 xl:grid-cols-3 gap-6' });
          i += 2;
        } else {
          layoutGroups.push({ ids: [id] });
          i++;
        }
      } else {
        // Collect up to 3 section cards
        const group: WidgetId[] = [];
        while (i < visibleOrder.length && group.length < 3 && visibleOrder[i] !== 'kpis' && visibleOrder[i] !== 'entregas' && visibleOrder[i] !== 'chart') {
          group.push(visibleOrder[i]);
          i++;
        }
        layoutGroups.push({ ids: group, cols: `grid grid-cols-1 xl:grid-cols-${group.length} gap-6` });
      }
    }

    return layoutGroups.map((group, gi) => {
      if (group.ids.length === 1) {
        const content = widgets[group.ids[0]]();
        if (!content) return null;
        return <div key={gi}>{content}</div>;
      }
      return (
        <div key={gi} className={group.cols}>
          {group.ids.map(id => {
            const content = widgets[id]();
            if (!content) return null;
            return <div key={id} className={id === 'chart' ? 'xl:col-span-2' : ''}>{content}</div>;
          })}
        </div>
      );
    });
  };

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
          <span className="text-xs text-slate-500 mr-3">En tiempo real</span>
          {/* Export buttons */}
          <button onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Exportar CSV">
            <Download size={13} /> CSV
          </button>
          <button onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            title="Exportar PDF">
            <Download size={13} /> PDF
          </button>
          {/* Config button */}
          <button onClick={() => setConfigOpen(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Personalizar dashboard">
            <Settings2 size={17} />
          </button>
        </div>
      </div>

      {/* Widgets in configured order */}
      {renderWidgets()}

      {/* Config Modal */}
      {configOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfigOpen(false)} />
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-slate-400" />
                <span className="text-sm font-semibold text-white">Personalizar Dashboard</span>
              </div>
              <button onClick={() => setConfigOpen(false)} className="p-1 text-slate-500 hover:text-white rounded"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-1 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 mb-3">Arrastra para reordenar. Haz clic en el ojo para mostrar/ocultar.</p>
              {config.order.map((id, idx) => (
                <div
                  key={id}
                  draggable
                  onDragStart={() => setDragItem(id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragItem && dragItem !== id) { moveWidget(config.order.indexOf(dragItem), idx); } setDragItem(null); }}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing',
                    dragItem === id ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700/50 hover:border-slate-600',
                    config.hidden.includes(id) && 'opacity-50'
                  )}
                >
                  <GripVertical size={14} className="text-slate-600 shrink-0" />
                  <span className="text-sm text-slate-300 flex-1">{WIDGET_LABELS[id]}</span>
                  <button onClick={() => toggleWidget(id)} className="p-1 text-slate-500 hover:text-white rounded transition-colors">
                    {config.hidden.includes(id) ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-slate-700/50 flex justify-between">
              <button onClick={() => { updateConfig(() => ({ order: [...DEFAULT_ORDER], hidden: [] })); }}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
                Restaurar por defecto
              </button>
              <button onClick={() => setConfigOpen(false)}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
