import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';

export default function ServiceIntegratorDashboard() {
  const { serviceIntegratorSession } = useAuth();
  const si = serviceIntegratorSession?.serviceIntegrator;

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['si-customers'],
    queryFn: async () => {
      const token = localStorage.getItem('service_integrator_token');
      const response = await fetch('/api/service-integrator/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      return data.customers || [];
    },
  });

  // Fetch themes
  const { data: themes = [] } = useQuery({
    queryKey: ['si-themes'],
    queryFn: () => apiClient.getSIThemes(),
  });

  const activeCustomers = customers.filter((c: any) => c.status === 'active');
  const totalApiCalls = customers.reduce((sum: number, c: any) => sum + (c.totalApiCalls || 0), 0);

  const statCards = [
    {
      title: 'Total Customers',
      value: customers.length,
      icon: '👥',
      color: 'purple',
    },
    {
      title: 'Active Customers',
      value: activeCustomers.length,
      icon: '✅',
      color: 'green',
    },
    {
      title: 'Total API Calls',
      value: totalApiCalls.toLocaleString(),
      icon: '📊',
      color: 'blue',
    },
    {
      title: 'Custom Themes',
      value: themes.length,
      icon: '🎨',
      color: 'orange',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {si?.companyName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} padding="md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-4xl">{stat.icon}</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Account Info */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Master License Key</div>
            <div className="text-sm font-mono bg-gray-50 p-2 rounded">{si?.masterLicenseKey}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <Badge variant={si?.status === 'active' ? 'success' : 'danger'}>
              {si?.status}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Contact Email</div>
            <div className="text-sm font-medium">{si?.contactEmail}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Billing Email</div>
            <div className="text-sm font-medium">{si?.billingEmail}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">White Label</div>
            <Badge variant={si?.whiteLabelEnabled ? 'info' : 'neutral'}>
              {si?.whiteLabelEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Account Created</div>
            <div className="text-sm font-medium">
              {si?.createdAt ? new Date(si.createdAt).toLocaleDateString() : 'N/A'}
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/service-integrator/customers">
            <Button variant="secondary" className="w-full">
              👥 Manage Customers
            </Button>
          </Link>
          <Link to="/service-integrator/themes">
            <Button variant="secondary" className="w-full">
              🎨 Custom Themes
            </Button>
          </Link>
          <Link to="/service-integrator/white-label">
            <Button variant="secondary" className="w-full">
              ⚙️ White Label Settings
            </Button>
          </Link>
        </div>
      </Card>

      {/* Recent Customers */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
          <Link to="/service-integrator/customers">
            <Button variant="ghost" size="sm">
              View All →
            </Button>
          </Link>
        </div>

        {customers.length === 0 ? (
          <p className="text-center text-gray-500 py-4">No customers yet</p>
        ) : (
          <div className="space-y-3">
            {customers.slice(0, 5).map((customer: any) => (
              <div
                key={customer.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.contactEmail}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600">
                    {customer.totalApiCalls?.toLocaleString() || 0} API calls
                  </div>
                  <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                    {customer.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
