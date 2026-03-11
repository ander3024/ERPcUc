import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ShoppingBag, Truck, Receipt, CreditCard, TrendingUp, Euro, AlertCircle, ArrowRight, Plus } from 'lucide-react';

const API = '/api';
const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function VentasPage() {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('accessToken');
  const headers = { Authorization: 'Bearer ' + token };

  useEffect(() => {
    (async () => {
      try {
        const [pres, ped, alb, fact, cob] = await Promise.all([
          fetch(API + '/ventas/presupuestos?limit=1', { headers }).then(r => r.json()),
          fetch(API + '/ventas/pedidos?limit=1', { headers }).then(r => r.json()),
          fetch(API + '/ventas/albaranes?limit=1', { headers }).then(r => r.json()),
          fetch(API + '/ventas/facturas?limit=1', { headers }).then(r => r.json()),
          fetch(API + '/ventas/cobros?limit=1', { headers }).then(r => r.json()),
        ]);
        const factStats = await fetch(API + '/ventas/facturas/stats', { headers }).then(r => r.json()).catch(() => ({}));
        setStats({
          presupuestos: pres.pagination?.total || 0,
          pedidos: ped.pagination?.total || 0,
          albaranes: alb.pagination?.total || 0,
          facturas: fact.pagination?.total || 0,
          cobros: cob.pagination?.total || cob.length || 0,
          totalPendiente: factStats.totalPendiente || 0,
          totalCobrado: factStats.totalCobrado || 0,
          vencidas: factStats.vencidas || 0,
        });
      } catch {}
      setLoading(false);
    })();
  }, []);

  const modulos = [
    {
      title: 'Presupuestos',
      desc: 'Ofertas y propuestas a clientes',
      icon: FileText,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      hover: 'hover:border-blue-500/50',
      path: '/ventas/presupuestos',
      count: stats.presupuestos,
      badge: 'presupuestos',
      action: { label: 'Nuevo presupuesto', path: '/ventas/nuevo/presupuesto' },
    },
    {
      title: 'Pedidos de venta',
      desc: 'Gestion de pedidos confirmados',
      icon: ShoppingBag,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      hover: 'hover:border-emerald-500/50',
      path: '/ventas/pedidos',
      count: stats.pedidos,
      badge: 'pedidos',
      action: { label: 'Nuevo pedido', path: '/ventas/nuevo/pedido' },
    },
    {
      title: 'Albaranes',
      desc: 'Notas de entrega y envios',
      icon: Truck,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
      hover: 'hover:border-cyan-500/50',
      path: '/ventas/albaranes',
      count: stats.albaranes,
      badge: 'albaranes',
    },
    {
      title: 'Facturas',
      desc: 'Facturacion y seguimiento',
      icon: Receipt,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      hover: 'hover:border-indigo-500/50',
      path: '/ventas/facturas',
      count: stats.facturas,
      badge: 'facturas',
      alert: stats.vencidas > 0 ? stats.vencidas + ' vencidas' : null,
    },
    {
      title: 'Cobros',
      desc: 'Pagos recibidos de clientes',
      icon: CreditCard,
      color: 'text-teal-400',
      bg: 'bg-teal-500/10 border-teal-500/20',
      hover: 'hover:border-teal-500/50',
      path: '/ventas/cobros',
      count: stats.cobros,
      badge: 'cobros',
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-400" />Ventas
        </h1>
        <p className="text-slate-400 text-sm mt-1">Gestion completa del ciclo de venta</p>
      </div>

      {/* KPIs resumen */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Euro className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-slate-400 text-sm">Pendiente de cobro</span>
          </div>
          <div className="text-2xl font-bold text-orange-400">{loading ? '...' : fmt(stats.totalPendiente)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-slate-400 text-sm">Total cobrado</span>
          </div>
          <div className="text-2xl font-bold text-green-400">{loading ? '...' : fmt(stats.totalCobrado)}</div>
        </div>
        <div className={"bg-slate-800 rounded-xl p-5 border " + (stats.vencidas > 0 ? 'border-red-500/40' : 'border-slate-700')}>
          <div className="flex items-center gap-3 mb-3">
            <div className={"w-10 h-10 rounded-lg flex items-center justify-center " + (stats.vencidas > 0 ? 'bg-red-500/10' : 'bg-slate-700')}>
              <AlertCircle className={"w-5 h-5 " + (stats.vencidas > 0 ? 'text-red-400' : 'text-slate-500')} />
            </div>
            <span className="text-slate-400 text-sm">Facturas vencidas</span>
          </div>
          <div className={"text-2xl font-bold " + (stats.vencidas > 0 ? 'text-red-400' : 'text-slate-400')}>{loading ? '...' : stats.vencidas}</div>
        </div>
      </div>

      {/* Modulos */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modulos.map((m, i) => (
          <div key={i} className={"bg-slate-800 rounded-xl border " + m.bg + " " + m.hover + " transition-all cursor-pointer group"}
            onClick={() => navigate(m.path)}>
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={"w-12 h-12 rounded-xl flex items-center justify-center " + m.bg}>
                  <m.icon className={"w-6 h-6 " + m.color} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">{loading ? '...' : (m.count ?? '-')}</div>
                  <div className="text-xs text-slate-500">{m.badge}</div>
                </div>
              </div>
              <h3 className="text-white font-semibold mb-1">{m.title}</h3>
              <p className="text-slate-400 text-sm mb-4">{m.desc}</p>
              {m.alert && (
                <div className="flex items-center gap-1.5 mb-3 text-xs text-red-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />{m.alert}
                </div>
              )}
              <div className="flex items-center justify-between">
                <button onClick={e => { e.stopPropagation(); navigate(m.path); }}
                  className={"flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all " + m.color}>
                  Ver todos <ArrowRight className="w-4 h-4" />
                </button>
                {m.action && (
                  <button onClick={e => { e.stopPropagation(); navigate(m.action!.path); }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" />{m.action.label}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}