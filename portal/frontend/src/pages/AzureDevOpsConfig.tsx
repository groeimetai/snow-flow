import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader, ExternalLink } from 'lucide-react';

interface AzureCredentials {
  id?: string;
  name: string;
  organization: string;
  personalAccessToken: string;
  defaultProject: string;
  configured?: boolean;
  lastTested?: string;
}

export default function AzureDevOpsConfig() {
  const [credentials, setCredentials] = useState<AzureCredentials>({
    name: 'Azure DevOps Main',
    organization: '',
    personalAccessToken: '',
    defaultProject: ''
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
      const response = await fetch('/api/credentials/azure', {
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
            organization: data.organization,
            defaultProject: data.defaultProject,
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
      const response = await fetch('/api/credentials/azure/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          organization: credentials.organization,
          personalAccessToken: credentials.personalAccessToken,
          defaultProject: credentials.defaultProject
        })
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({
          success: true,
          message: `Connected successfully! Found project: ${data.projectName}`
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
      const response = await fetch('/api/credentials/azure', {
        method: credentials.id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwt_token')}`
        },
        body: JSON.stringify({
          id: credentials.id,
          name: credentials.name,
          organization: credentials.organization,
          personalAccessToken: credentials.personalAccessToken,
          defaultProject: credentials.defaultProject
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Azure DevOps Integration</h1>
        <p className="text-gray-600">
          Connect your Azure DevOps organization to sync work items, pipelines, and boards.
        </p>
      </div>

      {/* Status Banner */}
      {credentials.configured && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-900">Azure DevOps Connected</p>
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
              placeholder="e.g., Azure DevOps Main"
            />
          </div>

          {/* Organization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={credentials.organization}
              onChange={(e) => setCredentials({ ...credentials, organization: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your-organization"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your Azure DevOps organization name (from dev.azure.com/your-organization)
            </p>
          </div>

          {/* Personal Access Token */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={credentials.personalAccessToken}
              onChange={(e) => setCredentials({ ...credentials, personalAccessToken: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your Azure DevOps PAT"
            />
            <div className="mt-1 flex items-center text-xs text-gray-500">
              <span className="mr-2">Required scopes: Work Items (Read & Write), Code (Read), Build (Read)</span>
              <a
                href="https://dev.azure.com/_usersSettings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-blue-600 hover:text-blue-700"
              >
                Generate PAT
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>

          {/* Default Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Default Project Name
            </label>
            <input
              type="text"
              value={credentials.defaultProject}
              onChange={(e) => setCredentials({ ...credentials, defaultProject: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="MainProject"
            />
            <p className="mt-1 text-xs text-gray-500">
              Default project for operations (can be overridden)
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
            disabled={testing || !credentials.organization || !credentials.personalAccessToken}
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
            disabled={loading || !credentials.organization || !credentials.personalAccessToken}
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
            { name: 'azure_sync_work_items', desc: 'Bidirectional work item sync' },
            { name: 'azure_pipeline_integration', desc: 'Trigger and monitor pipelines' },
            { name: 'azure_board_automation', desc: 'Automate board movements' },
            { name: 'azure_git_integration', desc: 'PR management and branch policies' },
            { name: 'azure_test_management', desc: 'Test plans and execution' },
            { name: 'azure_release_orchestration', desc: 'Multi-stage releases' },
            { name: 'azure_analytics', desc: 'Velocity and deployment metrics' },
            { name: 'azure_work_item_templates', desc: 'Create work item templates' }
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
