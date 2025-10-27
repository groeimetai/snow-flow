import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function ServiceIntegratorSettings() {
  const { serviceIntegratorSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    billingEmail: ''
  });

  useEffect(() => {
    if (serviceIntegratorSession?.serviceIntegrator) {
      const si = serviceIntegratorSession.serviceIntegrator;
      setFormData({
        companyName: si.companyName || '',
        contactEmail: si.contactEmail || '',
        billingEmail: si.billingEmail || ''
      });
    }
  }, [serviceIntegratorSession]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const token = localStorage.getItem('serviceIntegratorToken');

      const response = await fetch('/api/service-integrator/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);

        // Optionally refresh session
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your service integrator account information
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Information */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Information</h2>
          <div className="space-y-4">
            <Input
              label="Company Name"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
            <Input
              label="Contact Email"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              required
              helpText="Primary contact for technical issues"
            />
            <Input
              label="Billing Email"
              type="email"
              value={formData.billingEmail}
              onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
              required
              helpText="Email for invoices and billing-related communication"
            />
          </div>
        </Card>

        {/* License Information (Read-only) */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">License Information</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Master License Key</p>
              <p className="mt-1 text-sm text-gray-900 font-mono">
                {serviceIntegratorSession?.serviceIntegrator.masterLicenseKey}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Status</p>
              <div className="mt-1 flex items-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {serviceIntegratorSession?.serviceIntegrator.status}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Created</p>
              <p className="mt-1 text-sm text-gray-900">
                {serviceIntegratorSession?.serviceIntegrator.createdAt
                  ? new Date(serviceIntegratorSession.serviceIntegrator.createdAt).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </Card>

        {/* API Integration */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Integration</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use your master license key to authenticate with the Snow-Flow API
          </p>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Example API Call:</h3>
            <pre className="text-xs text-gray-800 overflow-x-auto">
{`curl -X POST https://portal.snow-flow.dev/api/auth/si/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "masterLicenseKey": "${serviceIntegratorSession?.serviceIntegrator.masterLicenseKey}"
  }'`}
            </pre>
          </div>

          <div className="mt-4">
            <a
              href="https://docs.snow-flow.dev/service-integrators/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              View API Documentation →
            </a>
          </div>
        </Card>

        {/* Support */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Support & Resources</h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Email Support</p>
                <a href="mailto:support@snow-flow.com" className="text-sm text-purple-600 hover:text-purple-700">
                  support@snow-flow.com
                </a>
              </div>
            </div>

            <div className="flex items-center">
              <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Documentation</p>
                <a
                  href="https://docs.snow-flow.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  docs.snow-flow.dev
                </a>
              </div>
            </div>

            <div className="flex items-center">
              <svg className="w-5 h-5 text-purple-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Community Slack</p>
                <a
                  href="https://snow-flow.slack.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  Join our community
                </a>
              </div>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
