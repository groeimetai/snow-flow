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

        {/* Overall Health Summary */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Health Overview</h2>
          {isLoadingHealth ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : health ? (
            <div className="space-y-4">
              {/* Status Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Overall Status</div>
                  <Badge
                    variant={
                      health.status === 'healthy' ? 'success' :
                      health.status === 'degraded' ? 'warning' :
                      'danger'
                    }
                  >
                    {health.status}
                  </Badge>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Uptime</div>
                  <div className="text-sm font-semibold">
                    {typeof health.uptime === 'number'
                      ? health.uptime > 3600
                        ? `${(health.uptime / 3600).toFixed(1)}h`
                        : `${Math.floor(health.uptime / 60)}m`
                      : 'N/A'}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Version</div>
                  <div className="text-sm font-mono">{health.version || 'N/A'}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">Health Checks</div>
                  <div className="text-sm">
                    {health.summary ? (
                      <span>
                        <span className="text-green-600 font-semibold">{health.summary.healthy}</span>
                        {health.summary.warnings > 0 && (
                          <span className="text-yellow-600"> / {health.summary.warnings}⚠</span>
                        )}
                        {health.summary.critical > 0 && (
                          <span className="text-red-600"> / {health.summary.critical}❌</span>
                        )}
                      </span>
                    ) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Detailed Component Checks */}
              {health.checks && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Component Health</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {Object.entries(health.checks).map(([key, value]) => {
                      const checkValue: any = typeof value === 'object' && value !== null ? value : { status: value };
                      const status = checkValue.status || String(value);
                      const message = checkValue.message;
                      const details = checkValue.details;

                      const getStatusVariant = (s: string) => {
                        if (s === 'healthy' || s === 'ok') return 'success';
                        if (s === 'warning') return 'warning';
                        if (s === 'critical' || s === 'unhealthy') return 'danger';
                        return 'neutral';
                      };

                      const formatKey = (k: string) => {
                        return k
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim();
                      };

                      return (
                        <div key={key} className="border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{formatKey(key)}</h4>
                              {message && (
                                <p className="text-xs text-gray-600 mt-1">{message}</p>
                              )}
                            </div>
                            <div className="ml-2">
                              <Badge variant={getStatusVariant(status)}>
                                {status}
                              </Badge>
                            </div>
                          </div>

                          {/* Show details if available */}
                          {details && typeof details === 'object' && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                {Object.entries(details).map(([detailKey, detailValue]) => (
                                  <div key={detailKey} className="flex justify-between">
                                    <span className="text-gray-500">{formatKey(detailKey)}:</span>
                                    <span className="text-gray-900 font-medium">
                                      {String(detailValue)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Show response time if available */}
                          {checkValue.responseTime && (
                            <div className="mt-2 text-xs text-gray-500">
                              Response: {checkValue.responseTime}ms
                            </div>
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
