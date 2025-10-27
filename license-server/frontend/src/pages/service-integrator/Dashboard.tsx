import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/common/Card';

export default function ServiceIntegratorDashboard() {
  const { serviceIntegratorSession } = useAuth();
  const navigate = useNavigate();
  const si = serviceIntegratorSession?.serviceIntegrator;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome to your Service Integrator portal
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{si?.companyName}</h3>
              <p className="text-sm text-gray-600">Your Company</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">Active</h3>
              <p className="text-sm text-gray-600">Status</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-900">{si?.contactEmail}</h3>
              <p className="text-sm text-gray-600">Contact Email</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Master License Key</p>
              <p className="mt-1 text-sm text-gray-900 font-mono">{si?.masterLicenseKey}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">White-Label Enabled</p>
              <p className="mt-1 text-sm text-gray-900">
                {si?.whiteLabelEnabled ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Billing Email</p>
              <p className="mt-1 text-sm text-gray-900">{si?.billingEmail}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Created</p>
              <p className="mt-1 text-sm text-gray-900">
                {si?.createdAt ? new Date(si.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/service-integrator/customers')}
            className="p-4 border border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
          >
            <div className="flex items-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="ml-3 font-medium text-gray-900">Create End-Customer License</span>
            </div>
          </button>
          <button
            onClick={() => navigate('/service-integrator/white-label')}
            className="p-4 border border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left"
          >
            <div className="flex items-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span className="ml-3 font-medium text-gray-900">Configure White-Label Settings</span>
            </div>
          </button>
        </div>
      </Card>
    </div>
  );
}
