import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';

export default function ServiceIntegratorWhiteLabel() {
  const { serviceIntegratorSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    whiteLabelEnabled: false,
    customDomain: '',
    logoUrl: ''
  });

  useEffect(() => {
    if (serviceIntegratorSession?.serviceIntegrator) {
      const si = serviceIntegratorSession.serviceIntegrator;
      setFormData({
        whiteLabelEnabled: si.whiteLabelEnabled || false,
        customDomain: si.customDomain || '',
        logoUrl: si.logoUrl || ''
      });
    }
  }, [serviceIntegratorSession]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const token = localStorage.getItem('serviceIntegratorToken');

      const response = await fetch('/api/service-integrator/white-label', {
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

        // Refresh session to update white-label status
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving white-label settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">White-Label Settings</h1>
        <p className="mt-2 text-gray-600">
          Customize the portal with your own branding
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Branding Configuration</h2>

          <div className="space-y-6">
            {/* Enable White-Label */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Enable White-Label</h3>
                <p className="text-sm text-gray-500">
                  Show your branding instead of Snow-Flow branding
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, whiteLabelEnabled: !formData.whiteLabelEnabled })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  formData.whiteLabelEnabled ? 'bg-purple-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    formData.whiteLabelEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Custom Domain */}
            <div>
              <Input
                label="Custom Domain"
                value={formData.customDomain}
                onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
                placeholder="portal.yourcompany.com"
                disabled={!formData.whiteLabelEnabled}
                helpText="Your custom domain for the portal (optional)"
              />
            </div>

            {/* Logo URL */}
            <div>
              <Input
                label="Logo URL"
                value={formData.logoUrl}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="https://yourcompany.com/logo.png"
                disabled={!formData.whiteLabelEnabled}
                helpText="URL to your company logo (PNG, SVG, or JPG)"
              />

              {formData.logoUrl && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Logo Preview:</p>
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Features Info */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">White-Label Features</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Custom Branding</h3>
                <p className="text-sm text-gray-500">Replace Snow-Flow branding with your own logo and colors</p>
              </div>
            </div>

            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Custom Domain</h3>
                <p className="text-sm text-gray-500">Host the portal on your own domain (CNAME configuration required)</p>
              </div>
            </div>

            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Seamless Experience</h3>
                <p className="text-sm text-gray-500">Your end-customers see only your brand throughout the portal</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Setup Instructions */}
        {formData.whiteLabelEnabled && formData.customDomain && (
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">DNS Setup Instructions</h2>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                To use your custom domain, add the following DNS record:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <table className="min-w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="font-medium text-gray-700 pr-4">Type:</td>
                      <td className="font-mono text-gray-900">CNAME</td>
                    </tr>
                    <tr>
                      <td className="font-medium text-gray-700 pr-4">Name:</td>
                      <td className="font-mono text-gray-900">{formData.customDomain}</td>
                    </tr>
                    <tr>
                      <td className="font-medium text-gray-700 pr-4">Value:</td>
                      <td className="font-mono text-gray-900">portal.snow-flow.dev</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-gray-500">
                DNS propagation can take up to 48 hours. Contact support if you need assistance.
              </p>
            </div>
          </Card>
        )}

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
