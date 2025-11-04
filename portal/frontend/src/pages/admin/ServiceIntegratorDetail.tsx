import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import { apiClient } from '../../api/client';
import { ServiceIntegrator, Customer } from '../../types';
import toast from 'react-hot-toast';

export default function ServiceIntegratorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch service integrator
  const { data: si, isLoading, refetch } = useQuery({
    queryKey: ['service-integrator', id],
    queryFn: () => apiClient.getServiceIntegratorById(parseInt(id!)),
    enabled: !!id,
  });

  // Fetch customers for this SI
  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'si', id],
    queryFn: async () => {
      const allCustomers = await apiClient.getCustomers();
      return allCustomers.filter((c: Customer) => c.serviceIntegratorId === parseInt(id!));
    },
    enabled: !!id,
  });

  // Form state
  const [formData, setFormData] = useState({
    companyName: '',
    contactEmail: '',
    billingEmail: '',
    customDomain: '',
    logoUrl: '',
    status: 'active' as 'active' | 'suspended' | 'churned',
    whiteLabelEnabled: false,
  });

  // Set form data when SI loads
  useState(() => {
    if (si) {
      setFormData({
        companyName: si.companyName,
        contactEmail: si.contactEmail,
        billingEmail: si.billingEmail,
        customDomain: si.customDomain || '',
        logoUrl: si.logoUrl || '',
        status: si.status,
        whiteLabelEnabled: si.whiteLabelEnabled,
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateServiceIntegrator(parseInt(id!), data),
    onSuccess: () => {
      toast.success('Service integrator updated successfully!');
      setIsEditModalOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update service integrator');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteServiceIntegrator(parseInt(id!)),
    onSuccess: () => {
      toast.success('Service integrator deleted successfully!');
      navigate('/admin/service-integrators');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete service integrator');
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleDelete = () => {
    if (customers.length > 0) {
      toast.error(`Cannot delete service integrator with ${customers.length} active customers`);
      return;
    }
    deleteMutation.mutate();
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading service integrator...</span>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  if (!si) {
    return (
      <AdminLayout>
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">Service integrator not found</p>
            <Button onClick={() => navigate('/admin/service-integrators')} className="mt-4">
              ← Back to Service Integrators
            </Button>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  const activeCustomers = customers.filter((c: Customer) => c.status === 'active');

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                onClick={() => navigate('/admin/service-integrators')}
                className="!px-2"
              >
                ←
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{si.companyName}</h1>
                <p className="text-sm text-gray-600">{si.contactEmail}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
              Edit Service Integrator
            </Button>
            <Button
              variant="danger"
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={customers.length > 0}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Status & Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="md">
            <div className="text-sm text-gray-600 mb-1">Status</div>
            <Badge
              variant={
                si.status === 'active' ? 'success' :
                si.status === 'suspended' ? 'warning' :
                'danger'
              }
            >
              {si.status}
            </Badge>
          </Card>

          <Card padding="md">
            <div className="text-sm text-gray-600 mb-1">Total Customers</div>
            <div className="text-lg font-semibold">{customers.length}</div>
          </Card>

          <Card padding="md">
            <div className="text-sm text-gray-600 mb-1">Active Customers</div>
            <div className="text-lg font-semibold text-green-600">{activeCustomers.length}</div>
          </Card>

          <Card padding="md">
            <div className="text-sm text-gray-600 mb-1">White Label</div>
            <Badge variant={si.whiteLabelEnabled ? 'info' : 'neutral'}>
              {si.whiteLabelEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </Card>
        </div>

        {/* Master License Key */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Master License Key</h2>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm break-all">
            {si.masterLicenseKey}
          </div>
          <div className="mt-3 text-sm text-gray-600">
            <p>Created: {new Date(si.createdAt).toLocaleString()}</p>
          </div>
        </Card>

        {/* Company Info */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Contact Email</div>
                <div className="text-sm font-medium">{si.contactEmail}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Billing Email</div>
                <div className="text-sm font-medium">{si.billingEmail}</div>
              </div>
            </div>

            {si.customDomain && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Custom Domain</div>
                <div className="text-sm font-medium font-mono">{si.customDomain}</div>
              </div>
            )}

            {si.logoUrl && (
              <div>
                <div className="text-sm text-gray-600 mb-1">Logo URL</div>
                <div className="text-sm font-medium break-all">{si.logoUrl}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Customers */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Customers</h2>
            <div className="text-sm text-gray-600">
              {customers.length} total ({activeCustomers.length} active)
            </div>
          </div>

          {customers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No customers yet
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map((customer: Customer) => (
                <Link
                  key={customer.id}
                  to={`/admin/customers/${customer.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-600">{customer.contactEmail}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-gray-600">
                        {customer.totalApiCalls.toLocaleString()} API calls
                      </div>
                      <Badge
                        variant={
                          customer.status === 'active' ? 'success' :
                          customer.status === 'suspended' ? 'warning' :
                          'danger'
                        }
                      >
                        {customer.status}
                      </Badge>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Service Integrator"
          size="lg"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <Input
              label="Company Name"
              type="text"
              required
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />

            <Input
              label="Contact Email"
              type="email"
              required
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            />

            <Input
              label="Billing Email"
              type="email"
              required
              value={formData.billingEmail}
              onChange={(e) => setFormData({ ...formData, billingEmail: e.target.value })}
            />

            <Input
              label="Custom Domain (Optional)"
              type="text"
              value={formData.customDomain}
              onChange={(e) => setFormData({ ...formData, customDomain: e.target.value })}
              placeholder="portal.partner.com"
            />

            <Input
              label="Logo URL (Optional)"
              type="text"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
            />

            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'churned', label: 'Churned' },
              ]}
            />

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="whiteLabelEnabled"
                checked={formData.whiteLabelEnabled}
                onChange={(e) => setFormData({ ...formData, whiteLabelEnabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="whiteLabelEnabled" className="text-sm text-gray-700">
                Enable white label features
              </label>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={updateMutation.isPending}>
                Update Service Integrator
              </Button>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Service Integrator"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{si.companyName}</strong>?
            </p>

            {customers.length > 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  ⚠️ Cannot delete service integrator with {customers.length} active customers. Please reassign or delete all customers first.
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ This action cannot be undone.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={deleteMutation.isPending}
                disabled={customers.length > 0}
              >
                Delete Service Integrator
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
