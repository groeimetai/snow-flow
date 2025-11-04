import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Table from '../../components/common/Table';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';
import { Customer } from '../../types';
import toast from 'react-hot-toast';

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    company: '',
    serviceIntegratorId: '',
    theme: '',
    developerSeats: 10,
    stakeholderSeats: 5,
    seatLimitsEnforced: true,
  });

  // Fetch customers
  const { data: customers = [], isLoading: isLoadingCustomers, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => apiClient.getCustomers(),
  });

  // Fetch service integrators for dropdown
  const { data: serviceIntegrators = [] } = useQuery({
    queryKey: ['service-integrators'],
    queryFn: () => apiClient.getServiceIntegrators(),
  });

  // Filter customers by search query
  const filteredCustomers = customers.filter((customer: Customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await apiClient.createCustomer({
        name: formData.name,
        contactEmail: formData.contactEmail,
        company: formData.company || undefined,
        serviceIntegratorId: parseInt(formData.serviceIntegratorId),
        theme: formData.theme || undefined,
        developerSeats: formData.developerSeats,
        stakeholderSeats: formData.stakeholderSeats,
        seatLimitsEnforced: formData.seatLimitsEnforced,
      });

      toast.success('Customer created successfully! License key generated automatically.');
      setIsCreateModalOpen(false);
      setFormData({
        name: '',
        contactEmail: '',
        company: '',
        serviceIntegratorId: '',
        theme: '',
        developerSeats: 10,
        stakeholderSeats: 5,
        seatLimitsEnforced: true,
      });
      refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create customer');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger'> = {
      active: 'success',
      suspended: 'warning',
      churned: 'danger',
    };
    return <Badge variant={variants[status] || 'neutral'}>{status}</Badge>;
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
    },
    {
      key: 'company',
      header: 'Company',
      render: (customer: Customer) => customer.company || '-',
    },
    {
      key: 'contactEmail',
      header: 'Email',
    },
    {
      key: 'licenseKey',
      header: 'License Key',
      render: (customer: Customer) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{customer.licenseKey}</code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (customer: Customer) => getStatusBadge(customer.status),
    },
    {
      key: 'developerSeats',
      header: 'Dev Seats',
      render: (customer: Customer) => {
        const total = customer.developerSeats;
        const active = customer.activeDeveloperSeats || 0;
        const isUnlimited = total === -1;
        const usage = isUnlimited ? 0 : Math.round((active / total) * 100);
        const variant = usage >= 90 ? 'danger' : usage >= 70 ? 'warning' : 'success';

        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">{isUnlimited ? 'Unlimited' : `${active}/${total}`}</span>
            {!isUnlimited && <Badge variant={variant} size="sm">{usage}%</Badge>}
          </div>
        );
      },
    },
    {
      key: 'stakeholderSeats',
      header: 'Stakeholder Seats',
      render: (customer: Customer) => {
        const total = customer.stakeholderSeats;
        const active = customer.activeStakeholderSeats || 0;
        const isUnlimited = total === -1;
        const usage = isUnlimited ? 0 : Math.round((active / total) * 100);
        const variant = usage >= 90 ? 'danger' : usage >= 70 ? 'warning' : 'success';

        return (
          <div className="flex items-center gap-2">
            <span className="text-sm">{isUnlimited ? 'Unlimited' : `${active}/${total}`}</span>
            {!isUnlimited && <Badge variant={variant} size="sm">{usage}%</Badge>}
          </div>
        );
      },
    },
    {
      key: 'totalApiCalls',
      header: 'API Calls',
      render: (customer: Customer) => customer.totalApiCalls.toLocaleString(),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage customer accounts and licenses
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            + Create Customer
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <Table
          data={filteredCustomers}
          columns={columns}
          keyExtractor={(customer: Customer) => customer.id}
          onRowClick={(customer: Customer) => navigate(`/admin/customers/${customer.id}`)}
          isLoading={isLoadingCustomers}
          emptyMessage="No customers found"
        />

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create New Customer"
          size="lg"
        >
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <Input
              label="Customer Name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Acme Corporation"
            />

            <Input
              label="Contact Email"
              type="email"
              required
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="contact@acme.com"
            />

            <Input
              label="Company (Optional)"
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Acme Inc."
            />

            <Select
              label="Service Integrator"
              required
              value={formData.serviceIntegratorId}
              onChange={(e) => setFormData({ ...formData, serviceIntegratorId: e.target.value })}
              options={[
                { value: '', label: 'Select Service Integrator' },
                ...serviceIntegrators.map((si: any) => ({
                  value: si.id.toString(),
                  label: si.companyName || si.name,
                })),
              ]}
            />

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>License Key:</strong> Will be auto-generated based on organization name and seat allocation
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Developer Seats (-1 = Unlimited)"
                type="number"
                required
                value={formData.developerSeats.toString()}
                onChange={(e) => setFormData({ ...formData, developerSeats: parseInt(e.target.value) || 0 })}
              />

              <Input
                label="Stakeholder Seats (-1 = Unlimited)"
                type="number"
                required
                value={formData.stakeholderSeats.toString()}
                onChange={(e) => setFormData({ ...formData, stakeholderSeats: parseInt(e.target.value) || 0 })}
              />
            </div>

            <Select
              label="Theme (Optional)"
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              options={[
                { value: '', label: 'No Theme' },
                { value: 'capgemini', label: 'Capgemini' },
                { value: 'ey', label: 'Ernst & Young' },
                { value: 'servicenow', label: 'ServiceNow' },
              ]}
            />

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
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isLoading}>
                Create Customer
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
