import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import Card from '../../components/common/Card';

export default function ServiceIntegratorWhiteLabel() {
  const [config, setConfig] = useState({
    whiteLabelEnabled: false,
    customDomain: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getServiceIntegratorWhiteLabelConfig();
      setConfig({
        whiteLabelEnabled: data.whiteLabelEnabled,
        customDomain: data.customDomain || '',
        logoUrl: data.logoUrl || ''
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load white-label configuration');
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

      await apiClient.updateServiceIntegratorWhiteLabelConfig({
        whiteLabelEnabled: config.whiteLabelEnabled,
        customDomain: config.customDomain || undefined,
        logoUrl: config.logoUrl || undefined
      });

      setSuccess('White-label configuration saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save white-label configuration');
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
        <h1 className="text-3xl font-bold text-gray-900">White-Label Configuration</h1>
        <p className="mt-2 text-gray-600">
          Customize the portal branding for your customers
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

      <Card>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Enable White-Label</h3>
              <p className="text-sm text-gray-500 mt-1">
                Allow custom branding for your customer portal
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.whiteLabelEnabled}
                onChange={(e) =>
                  setConfig({ ...config, whiteLabelEnabled: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {config.whiteLabelEnabled && (
            <>
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Branding Settings
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Custom Domain
                    </label>
                    <input
                      type="text"
                      value={config.customDomain}
                      onChange={(e) =>
                        setConfig({ ...config, customDomain: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="portal.yourdomain.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your custom domain for the customer portal
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Logo URL
                    </label>
                    <input
                      type="url"
                      value={config.logoUrl}
                      onChange={(e) =>
                        setConfig({ ...config, logoUrl: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="https://yourdomain.com/logo.png"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      URL to your company logo (recommended size: 200x50px)
                    </p>
                  </div>

                  {config.logoUrl && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Logo Preview
                      </label>
                      <div className="border border-gray-300 rounded-lg p-4 bg-white">
                        <img
                          src={config.logoUrl}
                          alt="Logo Preview"
                          className="max-h-16 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-blue-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      DNS Configuration Required
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        To use a custom domain, you'll need to configure your DNS
                        settings. Please contact support for assistance with DNS setup.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-200">
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

      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          White-Label Benefits
        </h3>
        <div className="space-y-3">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Custom Branding</p>
              <p className="text-sm text-gray-600">
                Display your company logo and use your own domain
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Professional Image</p>
              <p className="text-sm text-gray-600">
                Present a unified brand experience to your customers
              </p>
            </div>
          </div>
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-green-500 mt-0.5 mr-3"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-gray-900">Increased Trust</p>
              <p className="text-sm text-gray-600">
                Build customer confidence with your branded portal
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
