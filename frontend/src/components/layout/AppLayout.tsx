import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingCart, FileText,
  BookOpen, Monitor, UserCheck, Settings, Target,
  ChevronDown, ChevronRight, LogOut, Bell, Menu,
  BarChart3, FileBarChart, Warehouse, Building2, Search, TruckIcon,
  Package, X, AlertTriangle, Info, Sun, Moon, Star, Keyboard, Plug, Calendar
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAlerts } from '../../hooks/useAlerts';
import { useTheme } from '../../hooks/useTheme';
import { useFavoritos } from '../../hooks/useFavoritos';
import { useEjercicio } from '../../hooks/useEjercicio';
import { api } from '../../services/api';
import clsx from 'clsx';

// ============================================
// Types
// ============================================
interface NavItem {
  label: string;
  icon: any;
  path?: string;
  children?: { label: string; path: string }[];
  roles?: string[];
}

interface Notificacion {
  id: string;
  tipo: string;
  severity: 'alta' | 'media' | 'info';
  mensaje: string;
  link: string;
}

interface NotificacionesResponse {
  notificaciones: Notificacion[];
  resumen: { total: number; alta: number; media: number; info: number };
}

interface SearchResult {
  id: string;
  nombre?: string;
  cifNif?: string;
  referencia?: string;
  numero?: string;
  clienteNombre?: string;
  total?: number;
  tipo: string;
  link: string;
}

interface SearchResponse {
  clientes: SearchResult[];
  articulos: SearchResult[];
  facturas: SearchResult[];
  proveedores: SearchResult[];
  total: number;
}

// ============================================
// NAV_ITEMS - Exact same structure
// ============================================
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Clientes', icon: Users, path: '/clientes' },
  {
    label: 'Ventas', icon: BarChart3,
    children: [
      { label: 'Presupuestos', path: '/ventas/presupuestos' },
      { label: 'Pedidos', path: '/ventas/pedidos' },
      { label: 'Albaranes', path: '/ventas/albaranes' },
      { label: 'Facturas', path: '/ventas/facturas' },
      { label: 'Cobros', path: '/ventas/cobros' },
    ],
  },
  { label: 'Facturacion', icon: FileText, path: '/facturas' },
  {
    label: 'Almacen', icon: Warehouse,
    children: [
      { label: 'Articulos', path: '/almacen' },
      { label: 'Tarifas', path: '/almacen/tarifas' },
      { label: 'Inventario', path: '/almacen/inventario' },
      { label: 'Reposicion', path: '/almacen/reposicion' },
      { label: 'Lotes/Series', path: '/almacen/lotes' },
      { label: 'Familias', path: '/almacen?tab=familias' },
      { label: 'Movimientos', path: '/almacen?tab=movimientos' },
    ],
  },
  {
    label: 'Compras', icon: TruckIcon,
    children: [
      { label: 'Proveedores', path: '/compras/proveedores' },
      { label: 'Pedidos', path: '/compras/pedidos' },
      { label: 'Albaranes', path: '/compras/albaranes' },
      { label: 'Facturas', path: '/compras/facturas' },
      { label: 'Pagos', path: '/compras/pagos' },
    ],
  },
  {
    label: 'Informes', icon: FileBarChart,
    children: [
      { label: 'Ventas', path: '/informes?tab=ventas' },
      { label: 'Cobros y Pagos', path: '/informes?tab=cobros' },
      { label: 'Stock', path: '/informes?tab=stock' },
      { label: 'IVA Trimestral', path: '/informes?tab=iva' },
    ],
  },
  {
    label: 'Contabilidad', icon: BookOpen, path: '/contabilidad',
    roles: ['SUPERADMIN', 'ADMIN', 'CONTABLE'],
  },
  { label: 'CRM', icon: Target, path: '/crm' },
  { label: 'TPV', icon: Monitor, path: '/tpv' },
  {
    label: 'RRHH', icon: UserCheck, path: '/rrhh',
    roles: ['SUPERADMIN', 'ADMIN'],
  },
  {
    label: 'Configuracion', icon: Settings,
    children: [
      { label: 'Empresa', path: '/config' },
      { label: 'Usuarios', path: '/config/usuarios' },
      { label: 'Agentes', path: '/config/agentes' },
      { label: 'Formas de Pago', path: '/config/formas-pago' },
      { label: 'Email / SMTP', path: '/config/email' },
      { label: 'Plantillas', path: '/config/plantillas' },
    ],
    roles: ['SUPERADMIN', 'ADMIN'],
  },
  {
    label: 'Integraciones', icon: Plug, path: '/integraciones',
    roles: ['SUPERADMIN', 'ADMIN'],
  },
];

// ============================================
// Severity helpers
// ============================================
const severityBorderColor: Record<string, string> = {
  alta: 'border-l-red-500',
  media: 'border-l-orange-400',
  info: 'border-l-blue-400',
};

const severityBgHover: Record<string, string> = {
  alta: 'hover:bg-red-500/5',
  media: 'hover:bg-orange-400/5',
  info: 'hover:bg-blue-400/5',
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any }> = {
  clientes: { label: 'Clientes', icon: Users },
  articulos: { label: 'Artículos', icon: Package },
  facturas: { label: 'Facturas', icon: FileText },
  proveedores: { label: 'Proveedores', icon: TruckIcon },
};

// ============================================
// AppLayout
// ============================================
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { user, logout } = useAuth();
  const { alertCount } = useAlerts();
  const { theme, toggle: toggleTheme } = useTheme();
  const { favoritos, toggle: toggleFav, isFav } = useFavoritos();
  const { ejercicioActivo, setEjercicio, esSoloLectura, ejercicios } = useEjercicio();
  const location = useLocation();
  const navigate = useNavigate();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [ejercicioOpen, setEjercicioOpen] = useState(false);
  const ejercicioRef = useRef<HTMLDivElement>(null);

  // Notification panel state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState<NotificacionesResponse | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Search modal state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Sidebar auto-expand ----
  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      if (item.children?.some(c => location.pathname.startsWith(c.path.split('?')[0]))) {
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

  // ---- Notification panel ----
  const fetchNotificaciones = useCallback(async () => {
    setNotifLoading(true);
    try {
      const { data } = await api.get('/notificaciones');
      setNotifData(data);
    } catch (err) {
      console.error('Error fetching notificaciones:', err);
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotifPanel = useCallback(() => {
    setNotifOpen(prev => {
      const next = !prev;
      if (next) fetchNotificaciones();
      return next;
    });
  }, [fetchNotificaciones]);

  // Close notification panel on click outside
  useEffect(() => {
    if (!notifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notifOpen]);

  // Close ejercicio dropdown on outside click
  useEffect(() => {
    if (!ejercicioOpen) return;
    const h = (e: MouseEvent) => { if (ejercicioRef.current && !ejercicioRef.current.contains(e.target as Node)) setEjercicioOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ejercicioOpen]);

  // ---- Global search (Ctrl+K) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
      setSearchResults(null);
    }
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (searchQuery.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/notificaciones/busqueda?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data);
      } catch (err) {
        console.error('Error en búsqueda:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const handleSearchNavigate = (link: string) => {
    navigate(link);
    setSearchOpen(false);
  };

  const handleNotifNavigate = (link: string) => {
    navigate(link);
    setNotifOpen(false);
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!e.altKey) return;
      const map: Record<string, string> = {
        d: '/dashboard', c: '/clientes', v: '/ventas/presupuestos', a: '/almacen',
        f: '/facturas', p: '/compras/pedidos', i: '/informes', t: '/tpv',
        r: '/crm', h: '/rrhh', s: '/config',
      };
      const path = map[e.key.toLowerCase()];
      if (path) { e.preventDefault(); navigate(path); }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); }
    };
    document.addEventListener('keydown', handleShortcut);
    return () => document.removeEventListener('keydown', handleShortcut);
  }, [navigate]);

  // ---- SidebarContent ----
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
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

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {/* Favoritos */}
        {sidebarOpen && favoritos.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-700/30">
            <p className="px-3 py-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">Favoritos</p>
            {favoritos.map(fav => {
              const item = NAV_ITEMS.find(n => n.path === fav);
              if (!item) return null;
              return (
                <NavLink key={fav} to={fav}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-1.5 rounded-lg mb-0.5 text-sm transition-all',
                    isActive ? 'bg-yellow-500/10 text-yellow-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <Star size={13} className="text-yellow-400 fill-yellow-400 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}
        {filteredItems.map(item => (
          <div key={item.label}>
            {item.path && !item.children ? (
              <div className="flex items-center group">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => clsx(
                    'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon size={17} className="shrink-0" />
                  {sidebarOpen && <span className="font-medium">{item.label}</span>}
                </NavLink>
                {sidebarOpen && (
                  <button onClick={() => toggleFav(item.path!)} className="p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Favorito">
                    <Star size={12} className={isFav(item.path!) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button
                  onClick={() => sidebarOpen && toggleExpand(item.label)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all',
                    item.children?.some(c => location.pathname.startsWith(c.path.split('?')[0]))
                      ? 'text-white bg-slate-800'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <item.icon size={17} className="shrink-0" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 font-medium text-left">{item.label}</span>
                      {expandedItems.includes(item.label)
                        ? <ChevronDown size={14} className="text-slate-500" />
                        : <ChevronRight size={14} className="text-slate-500" />
                      }
                    </>
                  )}
                </button>
                {sidebarOpen && expandedItems.includes(item.label) && (
                  <div className="ml-3 pl-3 border-l border-slate-700/50 mb-1 mt-0.5">
                    {item.children!.map(child => {
                      const [childPath, childQuery] = child.path.split('?');
                      const childActive = childQuery
                        ? location.pathname === childPath && location.search === `?${childQuery}`
                        : location.pathname === childPath && !location.search;
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={clsx(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg mb-0.5 text-sm transition-all',
                            childActive
                              ? 'text-blue-400 bg-blue-500/10 font-medium'
                              : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'
                          )}
                          onClick={() => setMobileOpen(false)}
                        >
                          <span className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                          {child.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-700/50 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          {sidebarOpen && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.nombre}</p>
                <p className="text-xs text-slate-500 truncate">{user?.rol}</p>
              </div>
              <button onClick={logout}
                className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                title="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Render ----
  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className={clsx(
        'hidden lg:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-56' : 'w-14'
      )}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-slate-900 flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-13 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0" style={{height: '52px'}}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSidebarOpen(p => !p); setMobileOpen(p => !p); }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <Menu size={17} />
            </button>
            {/* Search bar - opens search modal on click */}
            <div
              className="hidden md:flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 w-60 cursor-pointer"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={14} className="text-slate-500" />
              <span className="text-sm text-slate-600 select-none">Buscar... (Ctrl+K)</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ejercicio fiscal selector */}
            <div className="relative" ref={ejercicioRef}>
              <button onClick={() => setEjercicioOpen(p => !p)}
                className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                  esSoloLectura ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600')}>
                <Calendar size={14} />
                <span>{ejercicioActivo}</span>
                <ChevronDown size={12} />
              </button>
              {ejercicioOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-700/50">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Ejercicio fiscal</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {ejercicios.map(ej => (
                      <button key={ej.anio} onClick={() => { setEjercicio(ej.anio); setEjercicioOpen(false); }}
                        className={clsx('w-full text-left px-3 py-2 flex items-center justify-between text-sm transition-colors',
                          ej.anio === ejercicioActivo ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800')}>
                        <span className="font-medium">{ej.anio}</span>
                        <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-medium',
                          ej.estado === 'ABIERTO' ? 'bg-green-500/20 text-green-400' :
                          ej.estado === 'EN_CIERRE' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-slate-600/20 text-slate-400')}>
                          {ej.estado === 'ABIERTO' ? 'Abierto' : ej.estado === 'EN_CIERRE' ? 'En cierre' : 'Cerrado'}
                        </span>
                      </button>
                    ))}
                    {ejercicios.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Sin ejercicios</p>}
                  </div>
                </div>
              )}
            </div>
            {/* Theme toggle */}
            <button onClick={toggleTheme} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              {theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}
            </button>
            {/* Keyboard shortcuts */}
            <button onClick={() => setShowShortcuts(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Atajos de teclado">
              <Keyboard size={17}/>
            </button>
            {/* Bell / Notifications button */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={toggleNotifPanel}
                className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Bell size={17} />
                {alertCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {alertCount > 9 ? '9+' : alertCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown panel */}
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                    <div className="flex items-center gap-2">
                      <Bell size={15} className="text-slate-400" />
                      <span className="text-sm font-semibold text-white">Notificaciones</span>
                      {notifData && notifData.resumen.total > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-red-500/20 text-red-400">
                          {notifData.resumen.total}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="p-1 text-slate-500 hover:text-white rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="max-h-96 overflow-y-auto">
                    {notifLoading && (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="ml-2 text-sm text-slate-400">Cargando...</span>
                      </div>
                    )}

                    {!notifLoading && notifData && notifData.notificaciones.length === 0 && (
                      <div className="flex flex-col items-center py-8 text-slate-500">
                        <Bell size={24} className="mb-2 opacity-50" />
                        <span className="text-sm">Sin notificaciones</span>
                      </div>
                    )}

                    {!notifLoading && notifData && notifData.notificaciones.map(notif => (
                      <button
                        key={`${notif.tipo}-${notif.id}`}
                        onClick={() => handleNotifNavigate(notif.link)}
                        className={clsx(
                          'w-full text-left px-4 py-3 border-l-4 border-b border-b-slate-800/50 transition-colors',
                          severityBorderColor[notif.severity],
                          severityBgHover[notif.severity]
                        )}
                      >
                        <p className="text-sm text-slate-300 leading-snug">{notif.mensaje}</p>
                        <p className="text-xs text-slate-600 mt-1 capitalize">{notif.tipo.replace(/_/g, ' ')}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Read-only banner for closed ejercicios */}
        {esSoloLectura && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-400" />
              <span className="text-sm text-amber-300">Modo solo lectura — Ejercicio {ejercicioActivo} (cerrado)</span>
            </div>
            <button onClick={() => { const abierto = ejercicios.find(e => e.estado === 'ABIERTO'); if (abierto) setEjercicio(abierto.anio); }}
              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-lg transition-colors">
              Ver ejercicio actual
            </button>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6">
          <Outlet />
        </main>
      </div>

      {/* ============================================
          Global Search Modal (Ctrl+K)
          ============================================ */}
      {searchOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/50">
              <Search size={18} className="text-slate-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); }}
                placeholder="Buscar clientes, artículos, facturas, proveedores..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
                autoComplete="off"
              />
              {searchLoading && (
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
              )}
              <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs text-slate-500 bg-slate-800 rounded border border-slate-700">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {/* Empty state */}
              {searchQuery.length < 2 && (
                <div className="flex flex-col items-center py-12 text-slate-500">
                  <Search size={28} className="mb-3 opacity-40" />
                  <span className="text-sm">Escribe para buscar...</span>
                  <span className="text-xs text-slate-600 mt-1">Mínimo 2 caracteres</span>
                </div>
              )}

              {/* No results */}
              {searchQuery.length >= 2 && !searchLoading && searchResults && searchResults.total === 0 && (
                <div className="flex flex-col items-center py-12 text-slate-500">
                  <Search size={28} className="mb-3 opacity-40" />
                  <span className="text-sm">Sin resultados para "{searchQuery}"</span>
                </div>
              )}

              {/* Results by category */}
              {searchResults && searchResults.total > 0 && (
                <div className="py-2">
                  {(['clientes', 'articulos', 'facturas', 'proveedores'] as const).map(category => {
                    const items = searchResults[category];
                    if (!items || items.length === 0) return null;
                    const config = CATEGORY_CONFIG[category];
                    const CategoryIcon = config.icon;

                    return (
                      <div key={category} className="mb-1">
                        {/* Category header */}
                        <div className="flex items-center gap-2 px-4 py-2">
                          <CategoryIcon size={13} className="text-slate-500" />
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            {config.label}
                          </span>
                          <span className="text-xs text-slate-600">({items.length})</span>
                        </div>

                        {/* Category items */}
                        {items.map(item => (
                          <button
                            key={`${category}-${item.id}`}
                            onClick={() => handleSearchNavigate(item.link)}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                              <CategoryIcon size={14} className="text-slate-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-300 truncate">
                                {item.nombre || item.numero}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {category === 'clientes' && item.cifNif && `CIF/NIF: ${item.cifNif}`}
                                {category === 'articulos' && item.referencia && `Ref: ${item.referencia}`}
                                {category === 'facturas' && (
                                  <>
                                    {item.clienteNombre}
                                    {item.total !== undefined && ` - ${item.total.toFixed(2)}\u20AC`}
                                  </>
                                )}
                                {category === 'proveedores' && 'Proveedor'}
                              </p>
                            </div>
                            <ChevronRight size={14} className="text-slate-600 shrink-0" />
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50 bg-slate-800/30">
              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">
                    &uarr;&darr;
                  </kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">
                    Enter
                  </kbd>
                  abrir
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-500">
                    Esc
                  </kbd>
                  cerrar
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
          <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Keyboard size={16} className="text-slate-400" />
                <span className="text-sm font-semibold text-white">Atajos de teclado</span>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="p-1 text-slate-500 hover:text-white rounded"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {[
                { section: 'General', shortcuts: [
                  { keys: 'Ctrl + K', desc: 'Búsqueda global' },
                  { keys: 'Alt + ?', desc: 'Mostrar atajos' },
                ]},
                { section: 'Navegación', shortcuts: [
                  { keys: 'Alt + D', desc: 'Dashboard' },
                  { keys: 'Alt + C', desc: 'Clientes' },
                  { keys: 'Alt + V', desc: 'Ventas' },
                  { keys: 'Alt + A', desc: 'Almacén' },
                  { keys: 'Alt + F', desc: 'Facturación' },
                  { keys: 'Alt + P', desc: 'Compras' },
                  { keys: 'Alt + I', desc: 'Informes' },
                  { keys: 'Alt + T', desc: 'TPV' },
                  { keys: 'Alt + R', desc: 'CRM' },
                  { keys: 'Alt + H', desc: 'RRHH' },
                  { keys: 'Alt + S', desc: 'Configuración' },
                ]},
              ].map(group => (
                <div key={group.section}>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group.section}</p>
                  <div className="space-y-1">
                    {group.shortcuts.map(s => (
                      <div key={s.keys} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-800/50">
                        <span className="text-sm text-slate-300">{s.desc}</span>
                        <kbd className="px-2 py-0.5 text-xs text-slate-400 bg-slate-800 rounded border border-slate-700">{s.keys}</kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
