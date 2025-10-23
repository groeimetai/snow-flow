import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { apiClient } from '../../api/client';
import { ServiceIntegrator } from '../../types';
import toast from 'react-hot-toast';

export default function AdminServiceIntegrators() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    billingEmail: '',
  });

  const { data: serviceIntegrators = [], isLoading: isLoadingData, refetch } = useQuery({
    queryKey: ['service-integrators'],
    queryFn: () => apiClient.getServiceIntegrators(),
  });

  const handleCreateSI = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.createServiceIntegrator({
        companyName: formData.companyName,
        contactEmail: formData.contactEmail,
        billingEmail: formData.billingEmail,
      });

      toast.success('Service Integrator created successfully!');
      setIsCreateModalOpen(false);
      setFormData({ companyName: '', contactEmail: '', billingEmail: '' });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create service integrator');
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    {
      key: 'companyName',
      header: 'Company',
    },
    {
      key: 'contactEmail',
      header: 'Contact Email',
    },
    {
      key: 'masterLicenseKey',
      header: 'Master License Key',
      render: (si: ServiceIntegrator) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{si.masterLicenseKey}</code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (si: ServiceIntegrator) => (
        <Badge variant={si.status === 'active' ? 'success' : 'danger'}>
          {si.status}
        </Badge>
      ),
    },
    {
      key: 'whiteLabelEnabled',
      header: 'White Label',
      render: (si: ServiceIntegrator) => (
        <Badge variant={si.whiteLabelEnabled ? 'info' : 'neutral'}>
          {si.whiteLabelEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Integrators</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage service integrator partners and their settings
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            + Create Service Integrator
          </Button>
        </div>

        {/* Table */}
        <Table
          data={serviceIntegrators}
          columns={columns}
          keyExtractor={(si: ServiceIntegrator) => si.id}
          isLoading={isLoadingData}
          emptyMessage="No service integrators found"
        />

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Service Integrator"
          size="lg"
        >
          <form onSubmit={handleCreateSI} className="space-y-4">
            <Input
              label="Company Name"
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              placeholder="Acme Consulting BV"
              helperText="The name of the service integrator company"
            />

            <Input
              label="Contact Email"
              type="email"
              required
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="contact@acme-consulting.com"
              helperText="Primary contact email for this partner"
            />

            <Input
              label="Billing Email"
              type="email"
              required
              value={formData.billingEmail}
              onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
              placeholder="billing@acme-consulting.com"
              helperText="Email for invoicing and billing matters"
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="text-blue-600 text-lg">ℹ️</div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Master License Key</p>
                  <p>A unique master license key will be automatically generated for this service integrator.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Create Service Integrator
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
