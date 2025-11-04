import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

interface CustomerLayoutProps {
  children: ReactNode;
}

export default function CustomerLayout({ children }: CustomerLayoutProps) {
  const { customerSession, customerLogout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', path: '/portal/dashboard', icon: '🏠' },
    { name: 'Credentials', path: '/portal/credentials', icon: '🔑' },
    { name: 'Usage', path: '/portal/usage', icon: '📊' },
    { name: 'Users', path: '/portal/users', icon: '👥' },
    { name: 'Profile', path: '/portal/profile', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    await customerLogout();
    navigate('/portal/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-3">
              {/* Snow-Flow Logo */}
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="customer-mountain" x1="16" y1="9" x2="16" y2="23" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#3B82F6"/>
                    <stop offset="100%" stopColor="#1D4ED8"/>
                  </linearGradient>
                </defs>
                <path d="M4 23 L10 9 L16 15 L22 9 L28 23 Z"
                      fill="url(#customer-mountain)"
                      stroke="#1D4ED8"
                      strokeWidth="1.2"
                      strokeLinejoin="round"/>
              </svg>
              <h1 className="text-xl font-bold text-gray-900">
                <span className="text-gray-900">SNOW</span>
                <span className="text-blue-600">FLOW</span>
                <span className="ml-2 text-sm font-normal text-gray-500">Portal</span>
              </h1>
              {customerSession?.customer.theme && (
                <span className="ml-4 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {customerSession.customer.theme}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {customerSession?.customer.name}
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
                        ? 'bg-green-50 text-green-700'
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
