import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages
import HomePage from './pages/Home';

// Admin pages (created)
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminCustomers from './pages/admin/Customers';
import AdminServiceIntegrators from './pages/admin/ServiceIntegrators';
import AdminMonitoring from './pages/admin/Monitoring';
import AdminThemes from './pages/admin/Themes';
import AdminCustomerDetail from './pages/admin/CustomerDetail';
import AdminServiceIntegratorDetail from './pages/admin/ServiceIntegratorDetail';

// Customer pages (created)
import CustomerLogin from './pages/customer/Login';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerCredentials from './pages/customer/Credentials';
import CustomerUsage from './pages/customer/Usage';
import CustomerUsers from './pages/customer/Users';
import CustomerProfile from './pages/customer/Profile';

// Service Integrator pages (created)
import ServiceIntegratorLogin from './pages/service-integrator/Login';
import ServiceIntegratorDashboard from './pages/service-integrator/Dashboard';
import ServiceIntegratorCustomers from './pages/service-integrator/Customers';
import ServiceIntegratorCustomerDetail from './pages/service-integrator/CustomerDetail';
import ServiceIntegratorWhiteLabel from './pages/service-integrator/WhiteLabel';
import ServiceIntegratorSettings from './pages/service-integrator/Settings';
import ServiceIntegratorThemes from './pages/service-integrator/Themes';
import ServiceIntegratorUsers from './pages/service-integrator/Users';

// Layouts
import ServiceIntegratorLayout from './components/layout/ServiceIntegratorLayout';

// Protected route wrapper
function ProtectedRoute({
  children,
  requireAdmin,
  requireServiceIntegrator,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireServiceIntegrator?: boolean;
}) {
  const { isAdminAuthenticated, isCustomerAuthenticated, isServiceIntegratorAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (requireAdmin && !isAdminAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireServiceIntegrator && !isServiceIntegratorAuthenticated) {
    return <Navigate to="/service-integrator/login" replace />;
  }

  if (!requireAdmin && !requireServiceIntegrator && !isCustomerAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Home / Landing */}
      <Route path="/" element={<HomePage />} />

      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute requireAdmin>
            <AdminCustomers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/service-integrators"
        element={
          <ProtectedRoute requireAdmin>
            <AdminServiceIntegrators />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/monitoring"
        element={
          <ProtectedRoute requireAdmin>
            <AdminMonitoring />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/themes"
        element={
          <ProtectedRoute requireAdmin>
            <AdminThemes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/customers/:id"
        element={
          <ProtectedRoute requireAdmin>
            <AdminCustomerDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/service-integrators/:id"
        element={
          <ProtectedRoute requireAdmin>
            <AdminServiceIntegratorDetail />
          </ProtectedRoute>
        }
      />

      {/* Customer Portal Routes */}
      <Route path="/portal/login" element={<CustomerLogin />} />
      <Route
        path="/portal"
        element={
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/dashboard"
        element={
          <ProtectedRoute>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/credentials"
        element={
          <ProtectedRoute>
            <CustomerCredentials />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/usage"
        element={
          <ProtectedRoute>
            <CustomerUsage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/users"
        element={
          <ProtectedRoute>
            <CustomerUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/profile"
        element={
          <ProtectedRoute>
            <CustomerProfile />
          </ProtectedRoute>
        }
      />

      {/* Service Integrator Portal Routes */}
      <Route path="/service-integrator/login" element={<ServiceIntegratorLogin />} />
      <Route
        path="/service-integrator"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorDashboard />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/dashboard"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorDashboard />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/customers"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorCustomers />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/customers/:id"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorCustomerDetail />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/white-label"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorWhiteLabel />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/settings"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorSettings />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/themes"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorThemes />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-integrator/users"
        element={
          <ProtectedRoute requireServiceIntegrator>
            <ServiceIntegratorLayout>
              <ServiceIntegratorUsers />
            </ServiceIntegratorLayout>
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
