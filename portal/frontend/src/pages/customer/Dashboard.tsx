import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import CustomerLayout from '../../components/layout/CustomerLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomerDashboard() {
  const { customerSession } = useAuth();

  // Fetch usage stats
  const { data: usageStats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['usage-stats'],
    queryFn: () => apiClient.getUsageStats(),
  });

  // Fetch credentials
  const { data: credentials = [] } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => apiClient.getCredentials(),
  });

  const connectedServices = credentials.filter((c: any) => c.status === 'connected').length;
  const totalServices = credentials.length;

  return (
    <CustomerLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {customerSession?.customer.name}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Here's an overview of your Snow-Flow integration
          </p>
        </div>

        {/* Stats Grid */}
        {isLoadingStats ? (
          <Card>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-600">Loading dashboard...</span>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            <Card padding="md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-4xl">🔑</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Connected Services</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {connectedServices}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">No limits</p>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-4xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">API Calls (30d)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {usageStats?.apiCallsLast30Days?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </Card>

            <Card padding="md">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-4xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Account Status</p>
                  <Badge variant="success" size="md">
                    {customerSession?.customer.status || 'Active'}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link to="/portal/credentials">
              <Button variant="secondary" className="w-full">
                🔑 Manage Credentials
              </Button>
            </Link>
            <Link to="/portal/usage">
              <Button variant="secondary" className="w-full">
                📊 View Usage Stats
              </Button>
            </Link>
            <Link to="/portal/profile">
              <Button variant="secondary" className="w-full">
                ⚙️ Profile Settings
              </Button>
            </Link>
          </div>
        </Card>

        {/* Service Status */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Connections</h2>
          {credentials.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🔑</div>
              <p className="text-gray-600 mb-4">No service connections configured</p>
              <Link to="/portal/credentials">
                <Button>Add Your First Credential</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {credentials.map((credential: any, idx: number) => (
                <div
                  key={`${credential.service}-${idx}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">
                      {credential.service === 'jira' ? '📋' :
                       credential.service === 'azdo' ? '🔷' : '📚'}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {credential.service === 'jira' ? 'Jira' :
                         credential.service === 'azdo' ? 'Azure DevOps' : 'Confluence'}
                      </p>
                      {credential.username && (
                        <p className="text-sm text-gray-600">{credential.username}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      credential.status === 'connected' ? 'success' :
                      credential.status === 'expired' ? 'warning' : 'danger'
                    }
                  >
                    {credential.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* License Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">License Information</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">License Key:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {customerSession?.customer.licenseKey}
              </code>
            </div>
            {customerSession?.customer.company && (
              <div className="flex justify-between">
                <span className="text-gray-600">Company:</span>
                <span className="font-medium">{customerSession.customer.company}</span>
              </div>
            )}
            {customerSession?.customer.theme && (
              <div className="flex justify-between">
                <span className="text-gray-600">Theme:</span>
                <span className="font-medium capitalize">{customerSession.customer.theme}</span>
              </div>
            )}
          </div>
        </Card>
      </div>
    </CustomerLayout>
  );
}
