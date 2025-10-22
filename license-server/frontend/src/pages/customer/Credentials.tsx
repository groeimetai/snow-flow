import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import CustomerLayout from '../../components/layout/CustomerLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';
import { CredentialDisplay } from '../../types';
import toast from 'react-hot-toast';

export default function CustomerCredentials() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testingCredentialId, setTestingCredentialId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    service: 'jira' as 'jira' | 'azdo' | 'confluence',
    username: '',
    password: '',
    apiToken: '',
    instanceUrl: '',
  });

  // Fetch credentials
  const { data: credentials = [], isLoading: isLoadingCredentials, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => apiClient.getCredentials(),
  });

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.addCredential({
        service: formData.service,
        username: formData.username,
        password: formData.password,
        apiToken: formData.apiToken || undefined,
        instanceUrl: formData.instanceUrl,
      });

      toast.success('Credential added successfully!');
      setIsAddModalOpen(false);
      setFormData({
        service: 'jira',
        username: '',
        password: '',
        apiToken: '',
        instanceUrl: '',
      });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add credential');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestCredential = async (credentialId: number) => {
    setTestingCredentialId(credentialId);

    try {
      const result = await apiClient.testCredential(credentialId);
      if (result.success) {
        toast.success('Credential test successful!');
      } else {
        toast.error('Credential test failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to test credential');
    } finally {
      setTestingCredentialId(null);
    }
  };

  const handleDeleteCredential = async (credentialId: number) => {
    if (!confirm('Are you sure you want to delete this credential?')) return;

    try {
      await apiClient.deleteCredential(credentialId);
      toast.success('Credential deleted');
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete credential');
    }
  };

  const getServiceIcon = (service: string) => {
    const icons: Record<string, string> = {
      jira: '📋',
      azdo: '🔷',
      confluence: '📚',
    };
    return icons[service] || '🔑';
  };

  const getServiceName = (service: string) => {
    const names: Record<string, string> = {
      jira: 'Jira',
      azdo: 'Azure DevOps',
      confluence: 'Confluence',
    };
    return names[service] || service;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger'> = {
      connected: 'success',
      expired: 'warning',
      error: 'danger',
    };
    return <Badge variant={variants[status] || 'neutral'}>{status}</Badge>;
  };

  return (
    <CustomerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Credentials</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your Jira, Azure DevOps, and Confluence integrations
            </p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            + Add Credential
          </Button>
        </div>

        {/* Credentials Grid */}
        {isLoadingCredentials ? (
          <Card>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading credentials...</span>
            </div>
          </Card>
        ) : credentials.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔑</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No credentials configured</h3>
              <p className="text-gray-600 mb-6">
                Add your first credential to start integrating with Jira, Azure DevOps, or Confluence
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                Add Your First Credential
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {credentials.map((credential: CredentialDisplay) => (
              <Card key={credential.id} padding="md">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">{getServiceIcon(credential.service)}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {getServiceName(credential.service)}
                        </h3>
                        {credential.username && (
                          <p className="text-sm text-gray-600">{credential.username}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(credential.status)}
                  </div>

                  {/* Metadata */}
                  <div className="text-sm text-gray-600 space-y-1">
                    {credential.lastUsed && (
                      <p>
                        Last used: {new Date(credential.lastUsed).toLocaleDateString()}
                      </p>
                    )}
                    {credential.expiresAt && (
                      <p>
                        Expires: {new Date(credential.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestCredential(credential.id)}
                      isLoading={testingCredentialId === credential.id}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteCredential(credential.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add Credential Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Service Credential"
          size="lg"
        >
          <form onSubmit={handleAddCredential} className="space-y-4">
            <Select
              label="Service"
              required
              value={formData.service}
              onChange={(e) => setFormData({ ...formData, service: e.target.value as any })}
              options={[
                { value: 'jira', label: 'Jira' },
                { value: 'azdo', label: 'Azure DevOps' },
                { value: 'confluence', label: 'Confluence' },
              ]}
            />

            <Input
              label="Instance URL"
              type="url"
              required
              value={formData.instanceUrl}
              onChange={(e) => setFormData({ ...formData, instanceUrl: e.target.value })}
              placeholder="https://your-domain.atlassian.net"
              helperText="The URL of your service instance"
            />

            <Input
              label="Username / Email"
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="your.email@company.com"
            />

            <Input
              label="Password / Personal Access Token"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Your password or API token"
              helperText="For better security, use an API token instead of your password"
            />

            {formData.service === 'jira' && (
              <Input
                label="API Token (Optional)"
                type="password"
                value={formData.apiToken}
                onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                placeholder="Atlassian API token"
                helperText="You can generate this from your Atlassian account settings"
              />
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Security Note:</strong> All credentials are encrypted using AES-256-GCM
                before storage. We recommend using API tokens or personal access tokens instead
                of passwords whenever possible.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Add Credential
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </CustomerLayout>
  );
}
