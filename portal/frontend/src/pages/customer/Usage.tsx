import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';
import Card from '../../components/common/Card';
import type { UsageStats } from '../../types';

export default function CustomerUsage() {
  const { customerSession } = useAuth();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    fetchUsageStats();
  }, [timeRange]);

  const fetchUsageStats = async () => {
    try {
      setLoading(true);
      const stats = await apiClient.getUsageStats(timeRange);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Usage Statistics</h1>
          <p className="mt-2 text-gray-600">
            Track your API usage and monitor your consumption
          </p>
        </div>
      </div>

      {/* Time Range Selector */}
      <Card>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Time Range:</span>
          {([7, 30, 90] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === days
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total API Calls */}
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {usageStats?.totalApiCalls?.toLocaleString() || 0}
              </h3>
              <p className="text-sm text-gray-600">Total API Calls</p>
            </div>
          </div>
        </Card>

        {/* Active Instances */}
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {usageStats?.activeInstances || 0}
              </h3>
              <p className="text-sm text-gray-600">Active Instances</p>
            </div>
          </div>
        </Card>

        {/* Average Response Time */}
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {usageStats?.avgResponseTime ? `${usageStats.avgResponseTime.toFixed(0)}ms` : 'N/A'}
              </h3>
              <p className="text-sm text-gray-600">Avg Response Time</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Stats */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Usage Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* API Calls by Day */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Daily Average</h3>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats?.totalApiCalls && timeRange
                  ? Math.round(usageStats.totalApiCalls / timeRange).toLocaleString()
                  : 0}
              </p>
              <p className="text-sm text-gray-600 mt-1">API calls per day</p>
            </div>

            {/* Peak Usage */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Peak Usage Day</h3>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats?.peakUsageDay || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {usageStats?.peakUsageCalls?.toLocaleString() || 0} calls
              </p>
            </div>

            {/* Error Rate */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Error Rate</h3>
              <p className="text-2xl font-bold text-gray-900">
                {usageStats?.errorRate ? `${(usageStats.errorRate * 100).toFixed(2)}%` : '0%'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {usageStats?.totalErrors?.toLocaleString() || 0} errors
              </p>
            </div>

            {/* Success Rate */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Success Rate</h3>
              <p className="text-2xl font-bold text-green-600">
                {usageStats?.errorRate ? `${((1 - usageStats.errorRate) * 100).toFixed(2)}%` : '100%'}
              </p>
              <p className="text-sm text-gray-600 mt-1">Successful requests</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Usage by Instance */}
      {usageStats?.instanceUsage && usageStats.instanceUsage.length > 0 && (
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Usage by Instance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Instance URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Response Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usageStats.instanceUsage.map((instance: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {instance.instanceUrl}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance.apiCalls?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance.errors?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {instance.avgResponseTime ? `${instance.avgResponseTime.toFixed(0)}ms` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {instance.lastActive ? new Date(instance.lastActive).toLocaleString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Usage Tips */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage Tips</h2>
        <div className="space-y-3">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-700">
              Monitor your API usage regularly to ensure you stay within your plan limits.
            </p>
          </div>
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-700">
              High error rates may indicate issues with your ServiceNow instance configuration or credentials.
            </p>
          </div>
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-700">
              Contact support if you need to increase your API call limits or discuss custom pricing.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
