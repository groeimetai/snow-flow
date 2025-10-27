import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface ServiceIntegratorLayoutProps {
  children: ReactNode;
}

export default function ServiceIntegratorLayout({ children }: ServiceIntegratorLayoutProps) {
  const { serviceIntegratorSession, serviceIntegratorLogout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', path: '/service-integrator/dashboard', icon: '🏠' },
    { name: 'Customers', path: '/service-integrator/customers', icon: '👥' },
    { name: 'White-Label', path: '/service-integrator/white-label', icon: '🎨' },
    { name: 'Settings', path: '/service-integrator/settings', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await serviceIntegratorLogout();
    navigate('/service-integrator/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Service Integrator Portal</h1>
              {serviceIntegratorSession?.serviceIntegrator.whiteLabelEnabled && (
                <span className="ml-4 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                  White-Label Enabled
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {serviceIntegratorSession?.serviceIntegrator.companyName}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-4rem)]">
          <nav className="mt-5 px-2">
            <div className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      isActive
                        ? 'bg-purple-50 text-purple-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    )}
                  >
                    <span className="mr-3 text-lg">{item.icon}</span>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
