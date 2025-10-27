import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';

export default function ServiceIntegratorSettings() {
  const { serviceIntegratorSession } = useAuth();
  const [profile, setProfile] = useState({
    companyName: '',
    contactEmail: '',
    billingEmail: ''
  });
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    suspendedCustomers: 0,
    totalApiCalls: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileData, statsData] = await Promise.all([
        apiClient.getServiceIntegratorProfile(),
        apiClient.getServiceIntegratorStats()
      ]);

      setProfile({
        companyName: profileData.serviceIntegrator.companyName,
        contactEmail: profileData.serviceIntegrator.contactEmail,
        billingEmail: profileData.serviceIntegrator.billingEmail || ''
      });

      setStats(statsData);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await apiClient.updateServiceIntegratorProfile({
        companyName: profile.companyName,
        contactEmail: profile.contactEmail,
        billingEmail: profile.billingEmail || undefined
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your Service Integrator account settings
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* Account Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.totalCustomers}
              </h3>
              <p className="text-sm text-gray-600">Total Customers</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.activeCustomers}
              </h3>
              <p className="text-sm text-gray-600">Active</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.suspendedCustomers}
              </h3>
              <p className="text-sm text-gray-600">Suspended</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.totalApiCalls.toLocaleString()}
              </h3>
              <p className="text-sm text-gray-600">API Calls</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Profile Settings */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Profile Information
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company Name
            </label>
            <input
              type="text"
              required
              value={profile.companyName}
              onChange={(e) =>
                setProfile({ ...profile, companyName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              required
              value={profile.contactEmail}
              onChange={(e) =>
                setProfile({ ...profile, contactEmail: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Billing Email
            </label>
            <input
              type="email"
              value={profile.billingEmail}
              onChange={(e) =>
                setProfile({ ...profile, billingEmail: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Card>

      {/* Account Information */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Account Information
        </h2>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Master License Key</p>
            <p className="mt-1 text-sm text-gray-900 font-mono">
              {serviceIntegratorSession?.serviceIntegrator.masterLicenseKey}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Account Status</p>
            <p className="mt-1">
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {serviceIntegratorSession?.serviceIntegrator.status || 'Active'}
              </span>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">White-Label Status</p>
            <p className="mt-1">
              <span
                className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  serviceIntegratorSession?.serviceIntegrator.whiteLabelEnabled
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {serviceIntegratorSession?.serviceIntegrator.whiteLabelEnabled
                  ? 'Enabled'
                  : 'Disabled'}
              </span>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Account Created</p>
            <p className="mt-1 text-sm text-gray-900">
              {serviceIntegratorSession?.serviceIntegrator.createdAt
                ? new Date(
                    serviceIntegratorSession.serviceIntegrator.createdAt
                  ).toLocaleDateString()
                : 'N/A'}
            </p>
          </div>
        </div>
      </Card>

      {/* Support Information */}
      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Support</h2>
        <p className="text-sm text-gray-600 mb-4">
          Need help? Contact our support team for assistance.
        </p>
        <div className="space-y-2">
          <p className="text-sm">
            <span className="font-medium text-gray-900">Email:</span>{' '}
            <a
              href="mailto:support@snow-flow.com"
              className="text-purple-600 hover:text-purple-700"
            >
              support@snow-flow.com
            </a>
          </p>
          <p className="text-sm">
            <span className="font-medium text-gray-900">Documentation:</span>{' '}
            <a
              href="https://docs.snow-flow.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:text-purple-700"
            >
              docs.snow-flow.com
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
