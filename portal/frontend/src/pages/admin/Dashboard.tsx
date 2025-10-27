import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/layout/AdminLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';

export default function AdminDashboard() {
  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.getDashboardStats(),
  });

  // Fetch recent customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient.getCustomers(),
  });

  const statCards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: '👥',
      color: 'blue',
    },
    {
      title: 'Active Customers',
      value: stats?.activeCustomers || 0,
      icon: '✅',
      color: 'green',
    },
    {
      title: 'Total API Calls',
      value: stats?.totalApiCalls?.toLocaleString() || '0',
      icon: '📊',
      color: 'purple',
    },
    {
      title: 'Service Integrators',
      value: stats?.totalServiceIntegrators || 0,
      icon: '🔗',
      color: 'orange',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of your Snow-Flow Enterprise License Server
          </p>
        </div>

        {/* Stats Grid */}
        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading dashboard...</span>
            </div>
          </Card>
        ) : (
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
        )}

        {/* Quick Actions */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link to="/admin/customers">
              <Button variant="secondary" className="w-full">
                👥 Manage Customers
              </Button>
            </Link>
            <Link to="/admin/service-integrators">
              <Button variant="secondary" className="w-full">
                🔗 Service Integrators
              </Button>
            </Link>
            <Link to="/admin/themes">
              <Button variant="secondary" className="w-full">
                🎨 Manage Themes
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent Customers */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Customers</h2>
            <Link to="/admin/customers">
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
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-600">{customer.contactEmail}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={customer.status === 'active' ? 'success' : 'neutral'}>
                      {customer.status}
                    </Badge>
                    <Link to={`/admin/customers/${customer.id}`}>
                      <Button variant="ghost" size="sm">
                        View →
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
