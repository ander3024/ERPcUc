import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, ShoppingCart, FileText,
  TruckIcon, BookOpen, Monitor, UserCircle, Settings,
  ChevronDown, ChevronRight, LogOut, Bell, Menu, X,
  BarChart3, Warehouse, Receipt, Building2, UserCheck,
  AlertTriangle, Search
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAlerts } from '../../hooks/useAlerts';
import clsx from 'clsx';

interface NavItem {
  label: string;
  icon: any;
  path?: string;
  children?: { label: string; path: string }[];
  badge?: number;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  {
    label: 'Clientes', icon: Users, path: '/clientes',
  },
  {
    label: 'Ventas', icon: BarChart3,
    children: [
      { label: 'Presupuestos', path: '/ventas/presupuestos' },
      { label: 'Pedidos', path: '/ventas/pedidos' },
      { label: 'Albaranes', path: '/ventas/albaranes' },
    ],
  },
  {
    label: 'Facturación', icon: FileText, path: '/facturas',
  },
  {
    label: 'Almacén', icon: Warehouse,
    children: [
      { label: 'Artículos', path: '/almacen/articulos' },
      { label: 'Movimientos', path: '/almacen' },
    ],
  },
  {
    label: 'Compras', icon: ShoppingCart,
    children: [
      { label: 'Pedidos', path: '/compras/pedidos' },
      { label: 'Facturas', path: '/compras/facturas' },
    ],
  },
  {
    label: 'Contabilidad', icon: BookOpen, path: '/contabilidad',
    roles: ['SUPERADMIN', 'ADMIN', 'CONTABLE'],
  },
  { label: 'TPV', icon: Monitor, path: '/tpv' },
  {
    label: 'RRHH', icon: UserCheck,
    children: [
      { label: 'Empleados', path: '/rrhh/empleados' },
      { label: 'Ausencias', path: '/rrhh' },
    ],
    roles: ['SUPERADMIN', 'ADMIN'],
  },
  {
    label: 'Configuración', icon: Settings,
    children: [
      { label: 'Empresa', path: '/config' },
      { label: 'Usuarios', path: '/config/usuarios' },
    ],
    roles: ['SUPERADMIN', 'ADMIN'],
  },
];

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const { alertCount } = useAlerts();
  const location = useLocation();

  // Auto-expandir el menú activo
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.children?.some(c => location.pathname.startsWith(c.path))) {
        setExpandedItems(prev => prev.includes(item.label) ? prev : [...prev, item.label]);
      }
    });
  }, [location.pathname]);

  const toggleExpand = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const filteredItems = NAV_ITEMS.filter(item =>
    !item.roles || (user && item.roles.includes(user.rol))
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
          <Building2 size={18} className="text-white" />
        </div>
        {sidebarOpen && (
          <div>
            <p className="text-sm font-bold text-white leading-none">ERP Web</p>
            <p className="text-xs text-slate-400 mt-0.5">Sistema de Gestión</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto scrollbar-thin">
        {filteredItems.map(item => (
          <div key={item.label}>
            {item.path && !item.children ? (
              <NavLink
                to={item.path}
                className={({ isActive }) => clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <item.icon size={18} className="shrink-0" />
                {sidebarOpen && <span className="flex-1 font-medium">{item.label}</span>}
                {item.badge && sidebarOpen && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ) : (
              <div>
                <button
                  onClick={() => sidebarOpen && toggleExpand(item.label)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all',
                    'text-slate-400 hover:bg-slate-700 hover:text-white',
                    item.children?.some(c => location.pathname.startsWith(c.path)) && 'text-white'
                  )}
                >
                  <item.icon size={18} className="shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 font-medium text-left">{item.label}</span>
                      {expandedItems.includes(item.label)
                        ? <ChevronDown size={15} />
                        : <ChevronRight size={15} />
                      }
                    </>
                  )}
                </button>
                {sidebarOpen && expandedItems.includes(item.label) && (
                  <div className="ml-4 pl-3 border-l border-slate-700 mb-1">
                    {item.children!.map(child => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) => clsx(
                          'flex items-center px-3 py-2 rounded-lg mb-0.5 text-sm transition-all',
                          isActive
                            ? 'text-blue-400 bg-blue-500/10 font-medium'
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-slate-700 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
              <p className="text-xs text-slate-500 truncate">{user?.rol}</p>
            </div>
          )}
          {sidebarOpen && (
            <button
              onClick={logout}
              className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className={clsx(
        'hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        <SidebarContent />
      </aside>

      {/* Sidebar Mobile */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-slate-900 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSidebarOpen(p => !p); setMobileOpen(p => !p); }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu size={18} />
            </button>
            {/* Búsqueda global */}
            <div className="hidden md:flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 w-64">
              <Search size={15} className="text-slate-500" />
              <input
                type="text"
                placeholder="Buscar... (Ctrl+K)"
                className="bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none w-full"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Alertas */}
            <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <Bell size={18} />
              {alertCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
