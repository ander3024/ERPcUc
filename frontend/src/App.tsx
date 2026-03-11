import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { EjercicioProvider } from './hooks/useEjercicio';
import { PrivateRoute } from './components/layout/PrivateRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { Onboarding } from './components/ui/Onboarding';

const LoginPage            = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage        = lazy(() => import('./pages/dashboard/DashboardPage'));
const ClientesPage         = lazy(() => import('./pages/clientes/ClientesPage'));
const ClienteDetallePage   = lazy(() => import('./pages/clientes/ClienteDetallePage'));
const AlmacenPage          = lazy(() => import('./pages/almacen/AlmacenPage'));
const ArticuloDetallePage  = lazy(() => import('./pages/almacen/ArticuloDetallePage'));
const TarifasPage          = lazy(() => import('./pages/almacen/TarifasPage'));
const InventarioPage       = lazy(() => import('./pages/almacen/InventarioPage'));
const ReposicionPage       = lazy(() => import('./pages/almacen/ReposicionPage'));
const LotesPage            = lazy(() => import('./pages/almacen/LotesPage'));
const NuevoDocumentoVentaPage = lazy(() => import('./pages/ventas/NuevoDocumentoVentaPage'));
const PresupuestosPage     = lazy(() => import('./pages/ventas/PresupuestosPage'));
const PedidosVentaPage     = lazy(() => import('./pages/ventas/PedidosVentaPage'));
const AlbaranesPage        = lazy(() => import('./pages/ventas/AlbaranesPage'));
const FacturasVentaPage    = lazy(() => import('./pages/ventas/FacturasVentaPage'));
const CobrosPage           = lazy(() => import('./pages/ventas/CobrosPage'));
const FacturasPage         = lazy(() => import('./pages/facturas/FacturasPage'));
const FacturaDetalleLegacy = lazy(() => import('./pages/facturas/FacturaDetallePage'));
const ProveedoresPage      = lazy(() => import('./pages/compras/ProveedoresPage'));
const PedidosCompraPage    = lazy(() => import('./pages/compras/PedidosCompraPage'));
const AlbaranesCompraPage  = lazy(() => import('./pages/compras/AlbaranesCompraPage'));
const FacturasCompraPage   = lazy(() => import('./pages/compras/FacturasCompraPage'));
const PagosCompraPage      = lazy(() => import('./pages/compras/PagosCompraPage'));
const NuevoDocumentoCompraPage = lazy(() => import('./pages/compras/NuevoDocumentoCompraPage'));
const InformesPage         = lazy(() => import('./pages/informes/InformesPage'));
const ContabilidadPage     = lazy(() => import('./pages/contabilidad/ContabilidadPage'));
const TPVPage              = lazy(() => import('./pages/tpv/TPVPage'));
const RRHHPage             = lazy(() => import('./pages/rrhh/RRHHPage'));
const ConfigPage           = lazy(() => import('./pages/config/ConfigPage'));
const UsuariosPage         = lazy(() => import('./pages/config/UsuariosPage'));
const EmailConfigPage      = lazy(() => import('./pages/config/EmailConfigPage'));
const PlantillasPage       = lazy(() => import('./pages/config/PlantillasPage'));
const AgentesPage          = lazy(() => import('./pages/config/AgentesPage'));
const FormasPagoPage       = lazy(() => import('./pages/config/FormasPagoPage'));
const CRMPage              = lazy(() => import('./pages/crm/CRMPage'));
const IntegracionesPage    = lazy(() => import('./pages/integraciones/IntegracionesPage'));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<PrivateRoute />}>
                <Route element={<EjercicioProvider><AppLayout /></EjercicioProvider>}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/clientes" element={<ClientesPage />} />
                  <Route path="/clientes/:id" element={<ClienteDetallePage />} />
                  <Route path="/almacen" element={<AlmacenPage />} />
                  <Route path="/almacen/articulos/:id" element={<ArticuloDetallePage />} />
                  <Route path="/almacen/tarifas" element={<TarifasPage />} />
                  <Route path="/almacen/inventario" element={<InventarioPage />} />
                  <Route path="/almacen/reposicion" element={<ReposicionPage />} />
                  <Route path="/almacen/lotes" element={<LotesPage />} />
                  <Route path="/ventas" element={<Navigate to="/ventas/presupuestos" replace />} />
                  <Route path="/ventas/nuevo/:tipo" element={<NuevoDocumentoVentaPage />} />
                  <Route path="/ventas/presupuestos" element={<PresupuestosPage />} />
                  <Route path="/ventas/pedidos" element={<PedidosVentaPage />} />
                  <Route path="/ventas/albaranes" element={<AlbaranesPage />} />
                  <Route path="/ventas/facturas" element={<FacturasVentaPage />} />
                  <Route path="/ventas/cobros" element={<CobrosPage />} />
                  <Route path="/facturas" element={<FacturasPage />} />
                  <Route path="/facturas/:id" element={<FacturaDetalleLegacy />} />
                  <Route path="/compras" element={<Navigate to="/compras/pedidos" replace />} />
                  <Route path="/compras/nuevo/:tipo" element={<NuevoDocumentoCompraPage />} />
                  <Route path="/compras/proveedores" element={<ProveedoresPage />} />
                  <Route path="/compras/pedidos" element={<PedidosCompraPage />} />
                  <Route path="/compras/albaranes" element={<AlbaranesCompraPage />} />
                  <Route path="/compras/facturas" element={<FacturasCompraPage />} />
                  <Route path="/compras/pagos" element={<PagosCompraPage />} />
                  <Route path="/informes" element={<InformesPage />} />
                  <Route path="/contabilidad" element={<ContabilidadPage />} />
                  <Route path="/tpv" element={<TPVPage />} />
                  <Route path="/crm" element={<CRMPage />} />
                  <Route path="/rrhh" element={<RRHHPage />} />
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="/config/usuarios" element={<UsuariosPage />} />
                  <Route path="/config/email" element={<EmailConfigPage />} />
                  <Route path="/config/plantillas" element={<PlantillasPage />} />
                  <Route path="/config/agentes" element={<AgentesPage />} />
                  <Route path="/config/formas-pago" element={<FormasPagoPage />} />
                  <Route path="/integraciones" element={<IntegracionesPage />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
          <Onboarding />
          <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' } }} />
        </AuthProvider>
      </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
