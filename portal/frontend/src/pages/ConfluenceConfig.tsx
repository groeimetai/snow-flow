import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader, ExternalLink } from 'lucide-react';

interface ConfluenceCredentials {
  id?: string;
  name: string;
  host: string;
  email: string;
  apiToken: string;
  defaultSpace: string;
  configured?: boolean;
  lastTested?: string;
}

export default function ConfluenceConfig() {
  const [credentials, setCredentials] = useState<ConfluenceCredentials>({
    name: 'Confluence Docs',
    host: '',
    email: '',
    apiToken: '',
    defaultSpace: ''
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadExistingCredentials();
  }, []);

  async function loadExistingCredentials() {
    try {
      const response = await fetch('/api/credentials/confluence', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.configured) {
          setCredentials({
            ...credentials,
            id: data.id,
            name: data.name,
            host: data.host,
            email: data.email,
            defaultSpace: data.defaultSpace,
            configured: data.configured,
            lastTested: data.lastTested
          });
        }
      }
    } catch (err) {
      console.error('Failed to load credentials:', err);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch('/api/credentials/confluence/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          host: credentials.host,
          email: credentials.email,
          apiToken: credentials.apiToken,
          defaultSpace: credentials.defaultSpace
        })
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully! Found space: ${data.spaceName}`
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Connection failed'
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: 'Network error. Please check your connection.'
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/credentials/confluence', {
        method: credentials.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          id: credentials.id,
          name: credentials.name,
          host: credentials.host,
          email: credentials.email,
          apiToken: credentials.apiToken,
          defaultSpace: credentials.defaultSpace
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSaved(true);
        setCredentials({ ...credentials, id: data.id, configured: true });
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save credentials');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Confluence Integration</h1>
        <p className="text-gray-600">
          Connect your Confluence instance to sync documentation with ServiceNow knowledge base.
        </p>
      </div>

      {/* Status Banner */}
      {credentials.configured && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">Confluence Connected</p>
            {credentials.lastTested && (
              <p className="text-xs text-green-700">
                Last tested: {new Date(credentials.lastTested).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>

        <div className="space-y-4">
          {/* Configuration Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Configuration Name
            </label>
            <input
              type="text"
              value={credentials.name}
              onChange={(e) => setCredentials({ ...credentials, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Confluence Docs"
            />
          </div>

          {/* Confluence Host */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confluence Host
            </label>
            <input
              type="text"
              value={credentials.host}
              onChange={(e) => setCredentials({ ...credentials, host: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your-domain.atlassian.net"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your Atlassian Confluence domain (without https://)
            </p>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={credentials.email}
              onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your-email@company.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              Email associated with your Confluence account
            </p>
          </div>

          {/* API Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Token
            </label>
            <input
              type="password"
              value={credentials.apiToken}
              onChange={(e) => setCredentials({ ...credentials, apiToken: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your Confluence API token"
            />
            <div className="mt-1 flex items-center text-xs text-gray-500">
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-600 hover:text-blue-700"
              >
                Generate API token
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>

          {/* Default Space */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Space Key
            </label>
            <input
              type="text"
              value={credentials.defaultSpace}
              onChange={(e) => setCredentials({ ...credentials, defaultSpace: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="DOCS"
            />
            <p className="mt-1 text-xs text-gray-500">
              Default space key for operations (can be overridden)
            </p>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mt-4 p-3 rounded-md flex items-start ${
            testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {testResult.message}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleTestConnection}
            disabled={testing || !credentials.host || !credentials.email || !credentials.apiToken}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {testing ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </button>

          <button
            onClick={handleSave}
            disabled={loading || !credentials.host || !credentials.email || !credentials.apiToken}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              'Save Configuration'
            )}
          </button>
        </div>
      </div>

      {/* Available Tools */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Tools</h2>
        <p className="text-sm text-gray-600 mb-4">
          Once configured, these tools will be available in your Snow-Flow CLI:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { name: 'confluence_sync_pages', desc: 'Sync pages with ServiceNow KB' },
            { name: 'confluence_space_management', desc: 'Create and manage spaces' },
            { name: 'confluence_advanced_search', desc: 'CQL search queries' },
            { name: 'confluence_content_organization', desc: 'Labels and hierarchies' },
            { name: 'confluence_macro_management', desc: 'Insert and configure macros' },
            { name: 'confluence_analytics', desc: 'Page views and engagement' },
            { name: 'confluence_permissions', desc: 'Space/page permissions' },
            { name: 'confluence_attachment_sync', desc: 'Sync attachments' }
          ].map((tool) => (
            <div key={tool.name} className="p-3 border border-gray-200 rounded-md">
              <p className="text-sm font-mono text-gray-900">{tool.name}</p>
              <p className="text-xs text-gray-500 mt-1">{tool.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
