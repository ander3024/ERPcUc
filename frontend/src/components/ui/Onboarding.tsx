import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Rocket, Users, BarChart3, Warehouse, BookOpen, Monitor,
  Settings, ArrowRight, CheckCircle, X
} from 'lucide-react';
import clsx from 'clsx';

const ONBOARDING_KEY = 'erp-onboarding-done';

const STEPS = [
  {
    icon: Settings, color: 'blue',
    title: 'Configura tu empresa',
    desc: 'Define los datos de tu empresa, logotipo, CIF, dirección y series de documentos.',
    link: '/config',
  },
  {
    icon: Users, color: 'green',
    title: 'Añade tus clientes',
    desc: 'Importa o crea tu cartera de clientes con sus datos fiscales y comerciales.',
    link: '/clientes',
  },
  {
    icon: Warehouse, color: 'orange',
    title: 'Carga tu catálogo',
    desc: 'Da de alta tus artículos, tarifas de precios, familias y stock inicial.',
    link: '/almacen',
  },
  {
    icon: BarChart3, color: 'purple',
    title: 'Emite tu primera factura',
    desc: 'Crea presupuestos, pedidos, albaranes y facturas en el módulo de ventas.',
    link: '/ventas/presupuestos',
  },
  {
    icon: BookOpen, color: 'yellow',
    title: 'Configura contabilidad',
    desc: 'Conecta cuentas bancarias, define presupuestos y prepara modelos fiscales.',
    link: '/contabilidad',
  },
  {
    icon: Monitor, color: 'red',
    title: 'Activa el TPV',
    desc: 'Configura el terminal punto de venta para cobros rápidos en mostrador.',
    link: '/tpv',
  },
];

const colorMap: Record<string, { bg: string; icon: string; ring: string }> = {
  blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400', ring: 'ring-blue-500/30' },
  green: { bg: 'bg-green-500/10', icon: 'text-green-400', ring: 'ring-green-500/30' },
  orange: { bg: 'bg-orange-500/10', icon: 'text-orange-400', ring: 'ring-orange-500/30' },
  purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', ring: 'ring-purple-500/30' },
  yellow: { bg: 'bg-yellow-500/10', icon: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  red: { bg: 'bg-red-500/10', icon: 'text-red-400', ring: 'ring-red-500/30' },
};

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      setVisible(true);
    }
  }, []);

  const close = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  };

  const goTo = (link: string) => {
    close();
    navigate(link);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const c = colorMap[current.color];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-2">
            <Rocket size={18} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">Bienvenido a ERP Web</span>
          </div>
          <button onClick={close} className="p-1 text-slate-500 hover:text-white rounded"><X size={16} /></button>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1.5 px-6 pt-4">
          {STEPS.map((_, i) => (
            <div key={i} className={clsx('h-1 flex-1 rounded-full transition-all', i <= step ? 'bg-blue-500' : 'bg-slate-700')} />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-8 text-center">
          <div className={clsx('w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ring-2', c.bg, c.ring)}>
            <Icon size={28} className={c.icon} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{current.title}</h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">{current.desc}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="text-xs text-slate-500">{step + 1} de {STEPS.length}</div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                Anterior
              </button>
            )}
            <button
              onClick={() => goTo(current.link)}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Ir ahora <ArrowRight size={14} />
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                Siguiente <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={close}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
              >
                <CheckCircle size={14} /> Empezar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
