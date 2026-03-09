import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';

import { AuthProvider } from './hooks/useAuth';
import { PrivateRoute } from './components/layout/PrivateRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingScreen } from './components/ui/LoadingScreen';

// Pages - lazy loaded
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/clientes/ClientesPage'));
const ClienteDetallePage = lazy(() => import('./pages/clientes/ClienteDetallePage'));
const ArticulosPage = lazy(() => import('./pages/almacen/ArticulosPage'));
const ArticuloDetallePage = lazy(() => import('./pages/almacen/ArticuloDetallePage'));
const AlmacenPage = lazy(() => import('./pages/almacen/AlmacenPage'));
const VentasPage = lazy(() => import('./pages/ventas/VentasPage'));
import NuevoDocumentoVentaPage from './pages/ventas/NuevoDocumentoVentaPage'
const PresupuestosPage = lazy(() => import('./pages/ventas/PresupuestosPage'));
const PedidosVentaPage = lazy(() => import('./pages/ventas/PedidosVentaPage'));
const AlbaranesPage = lazy(() => import('./pages/ventas/AlbaranesPage'));
const FacturasPage = lazy(() => import('./pages/facturas/FacturasPage'));
const FacturaDetallePage = lazy(() => import('./pages/facturas/FacturaDetallePage'));
const ComprasPage = lazy(() => import('./pages/compras/ComprasPage'));
const PedidosCompraPage = lazy(() => import('./pages/compras/PedidosCompraPage'));
const FacturasCompraPage = lazy(() => import('./pages/compras/FacturasCompraPage'));
const ContabilidadPage = lazy(() => import('./pages/contabilidad/ContabilidadPage'));
const TPVPage = lazy(() => import('./pages/tpv/TPVPage'));
const RRHHPage = lazy(() => import('./pages/rrhh/RRHHPage'));
const EmpleadosPage = lazy(() => import('./pages/rrhh/EmpleadosPage'));
const ConfigPage = lazy(() => import('./pages/config/ConfigPage'));
const UsuariosPage = lazy(() => import('./pages/config/UsuariosPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutos
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* Pública */}
              <Route path="/login" element={<LoginPage />} />

              {/* Privadas */}
              <Route element={<PrivateRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />

                  {/* CRM */}
                  <Route path="/clientes" element={<ClientesPage />} />
                  <Route path="/clientes/:id" element={<ClienteDetallePage />} />

                  {/* Almacén */}
                  <Route path="/almacen" element={<AlmacenPage />} />
                  <Route path="/almacen/articulos" element={<ArticulosPage />} />
                  <Route path="/almacen/articulos/:id" element={<ArticuloDetallePage />} />

                  {/* Ventas */}
                  <Route path="/ventas" element={<VentasPage />} />
          <Route path="/ventas/nuevo/:tipo" element={<NuevoDocumentoVentaPage />} />
                  <Route path="/ventas/presupuestos" element={<PresupuestosPage />} />
                  <Route path="/ventas/pedidos" element={<PedidosVentaPage />} />
                  <Route path="/ventas/albaranes" element={<AlbaranesPage />} />

                  {/* Facturación */}
                  <Route path="/facturas" element={<FacturasPage />} />
                  <Route path="/facturas/:id" element={<FacturaDetallePage />} />

                  {/* Compras */}
                  <Route path="/compras" element={<ComprasPage />} />
                  <Route path="/compras/pedidos" element={<PedidosCompraPage />} />
                  <Route path="/compras/facturas" element={<FacturasCompraPage />} />

                  {/* Contabilidad */}
                  <Route path="/contabilidad" element={<ContabilidadPage />} />

                  {/* TPV */}
                  <Route path="/tpv" element={<TPVPage />} />

                  {/* RRHH */}
                  <Route path="/rrhh" element={<RRHHPage />} />
                  <Route path="/rrhh/empleados" element={<EmpleadosPage />} />

                  {/* Config */}
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="/config/usuarios" element={<UsuariosPage />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              borderRadius: '8px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#f8fafc' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#f8fafc' } },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
