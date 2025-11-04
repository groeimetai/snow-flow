import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import toast from 'react-hot-toast';

export default function ServiceIntegratorCustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch customer
  const { data: customer, isLoading, refetch } = useQuery({
    queryKey: ['si-customer', id],
    queryFn: async () => {
      const token = localStorage.getItem('service_integrator_token');
      const response = await fetch(`/api/service-integrator/customers/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      return data.customer;
    },
    enabled: !!id,
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    company: '',
    theme: '',
    status: 'active' as 'active' | 'suspended' | 'churned',
    developerSeats: 10,
    stakeholderSeats: 5,
    seatLimitsEnforced: true,
  });

  // Set form data when customer loads
  useState(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        contactEmail: customer.contactEmail,
        company: customer.company || '',
        theme: customer.theme || '',
        status: customer.status,
        developerSeats: customer.developerSeats || 10,
        stakeholderSeats: customer.stakeholderSeats || 5,
        seatLimitsEnforced: customer.seatLimitsEnforced ?? true,
      });
    }
  });

  // Update customer mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('service_integrator_token');
      const response = await fetch(`/api/service-integrator/customers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Customer updated successfully!');
      setIsEditModalOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update customer');
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-gray-600">Loading customer...</span>
        </div>
      </Card>
    );
  }

  if (!customer) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-gray-500">Customer not found</p>
          <Button onClick={() => navigate('/service-integrator/customers')} className="mt-4">
            ← Back to Customers
          </Button>
        </div>
      </Card>
    );
  }

  const devSeatsUsage = customer.developerSeats === -1 ? 0 :
    Math.round(((customer.activeDeveloperSeats || 0) / customer.developerSeats) * 100);
  const stakeholderSeatsUsage = customer.stakeholderSeats === -1 ? 0 :
    Math.round(((customer.activeStakeholderSeats || 0) / customer.stakeholderSeats) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/service-integrator/customers')}
              className="!px-2"
            >
              ←
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-600">{customer.contactEmail}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
            Edit Customer
          </Button>
        </div>
      </div>

      {/* Status & Info */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="md">
          <div className="text-sm text-gray-600 mb-1">Status</div>
          <Badge
            variant={
              customer.status === 'active' ? 'success' :
              customer.status === 'suspended' ? 'warning' :
              'danger'
            }
          >
            {customer.status}
          </Badge>
        </Card>

        <Card padding="md">
          <div className="text-sm text-gray-600 mb-1">License Tier</div>
          <div className="text-lg font-semibold">{customer.tier || 'ENT'}</div>
        </Card>

        <Card padding="md">
          <div className="text-sm text-gray-600 mb-1">Total API Calls</div>
          <div className="text-lg font-semibold">{customer.totalApiCalls?.toLocaleString() || 0}</div>
        </Card>

        <Card padding="md">
          <div className="text-sm text-gray-600 mb-1">Active Connections</div>
          <div className="text-lg font-semibold">{customer.activeConnections || 0}</div>
        </Card>
      </div>

      {/* License Key */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">License Key</h2>
        <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm break-all">
          {customer.licenseKey}
        </div>
        <div className="mt-3 text-sm text-gray-600">
          <p>Created: {new Date(customer.createdAt).toLocaleString()}</p>
          {customer.lastApiCall && (
            <p>Last API Call: {new Date(customer.lastApiCall).toLocaleString()}</p>
          )}
        </div>
      </Card>

      {/* Seat Usage */}
      {(customer.developerSeats || customer.stakeholderSeats) && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Developer Seats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Allocated:</span>
                <span className="font-semibold">
                  {customer.developerSeats === -1 ? 'Unlimited' : customer.developerSeats}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active:</span>
                <span className="font-semibold">{customer.activeDeveloperSeats || 0}</span>
              </div>
              {customer.developerSeats !== -1 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-semibold">
                      {Math.max(0, customer.developerSeats - (customer.activeDeveloperSeats || 0))}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Usage</span>
                      <span className="font-semibold">{devSeatsUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          devSeatsUsage >= 90 ? 'bg-red-600' :
                          devSeatsUsage >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, devSeatsUsage)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Stakeholder Seats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Allocated:</span>
                <span className="font-semibold">
                  {customer.stakeholderSeats === -1 ? 'Unlimited' : customer.stakeholderSeats}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Active:</span>
                <span className="font-semibold">{customer.activeStakeholderSeats || 0}</span>
              </div>
              {customer.stakeholderSeats !== -1 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Available:</span>
                    <span className="font-semibold">
                      {Math.max(0, customer.stakeholderSeats - (customer.activeStakeholderSeats || 0))}
                    </span>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Usage</span>
                      <span className="font-semibold">{stakeholderSeatsUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          stakeholderSeatsUsage >= 90 ? 'bg-red-600' :
                          stakeholderSeatsUsage >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, stakeholderSeatsUsage)}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Company Info */}
      {customer.company && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Information</h2>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Company:</span>
              <span className="font-medium">{customer.company}</span>
            </div>
            {customer.theme && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Theme:</span>
                <span className="font-medium capitalize">{customer.theme}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer"
        size="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Customer Name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <Input
            label="Contact Email"
            type="email"
            required
            value={formData.contactEmail}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
          />

          <Input
            label="Company"
            type="text"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Developer Seats"
              type="number"
              value={formData.developerSeats.toString()}
              onChange={(e) => setFormData({ ...formData, developerSeats: parseInt(e.target.value) || 0 })}
            />

            <Input
              label="Stakeholder Seats"
              type="number"
              value={formData.stakeholderSeats.toString()}
              onChange={(e) => setFormData({ ...formData, stakeholderSeats: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="seatLimitsEnforced"
              checked={formData.seatLimitsEnforced}
              onChange={(e) => setFormData({ ...formData, seatLimitsEnforced: e.target.checked })}
              className="rounded border-gray-300"
            />
            <label htmlFor="seatLimitsEnforced" className="text-sm text-gray-700">
              Enforce seat limits
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
              Update Customer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
