import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';

export default function AdminMonitoring() {
  const { data: health, isLoading: isLoadingHealth } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.getHealth(),
  });

  const { data: metrics, isLoading: isLoadingMetrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiClient.getMetrics(),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="mt-1 text-sm text-gray-600">
            Monitor system health, performance, and metrics
          </p>
        </div>

        {/* Health Status */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health</h2>
          {isLoadingHealth ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : health ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                <Badge variant={health.status === 'healthy' ? 'success' : 'danger'}>
                  {health.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Version:</span>
                <span className="text-sm font-mono">{health.version}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Uptime:</span>
                <span className="text-sm">
                  {typeof health.uptime === 'number'
                    ? `${Math.floor(health.uptime / 60)} minutes`
                    : typeof health.uptime === 'object' && health.uptime !== null && 'server' in health.uptime
                    ? `${Math.floor((health.uptime as any).server / 60)} minutes`
                    : 'N/A'}
                </span>
              </div>
              {health.checks && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">Component Checks:</p>
                  <div className="space-y-2">
                    {Object.entries(health.checks).map(([key, value]) => {
                      const checkValue: any = typeof value === 'object' && value !== null ? value : { status: value };
                      const status = checkValue.status || String(value);
                      const message = checkValue.message;

                      return (
                        <div key={key} className="bg-gray-50 p-2 rounded">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{key}</span>
                            <Badge variant={status === 'healthy' || status === 'ok' ? 'success' : 'danger'}>
                              {status}
                            </Badge>
                          </div>
                          {message && (
                            <p className="text-xs text-gray-600">{message}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No health data available</p>
          )}
        </Card>

        {/* Metrics */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Metrics</h2>
          {isLoadingMetrics ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : metrics ? (
            <div className="grid md:grid-cols-2 gap-4">
              {/* API Calls */}
              {metrics.apiCalls && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">API Calls</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{metrics.apiCalls.total?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Successful:</span>
                      <span className="text-green-600">{metrics.apiCalls.successful?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Failed:</span>
                      <span className="text-red-600">{metrics.apiCalls.failed?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg Duration:</span>
                      <span>{metrics.apiCalls.avgDuration}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Customers */}
              {metrics.customers && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Customers</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total:</span>
                      <span className="font-semibold">{metrics.customers.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Active:</span>
                      <span className="text-green-600">{metrics.customers.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Suspended:</span>
                      <span className="text-yellow-600">{metrics.customers.suspended}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No metrics data available</p>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
