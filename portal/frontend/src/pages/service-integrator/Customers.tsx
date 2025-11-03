import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../api/client';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import { CustomTheme } from '../../types';

interface Customer {
  id: number;
  name: string;
  contactEmail: string;
  company: string;
  licenseKey: string;
  theme: string | null;
  customThemeId?: number;
  status: 'active' | 'suspended' | 'churned';
  totalApiCalls: number;
  createdAt: number;
  updatedAt: number;
}

export default function ServiceIntegratorCustomers() {
  const { serviceIntegratorSession } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignThemeModal, setShowAssignThemeModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended' | 'churned'>('all');
  const [error, setError] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactEmail: '',
    company: '',
    theme: ''
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    contactEmail: '',
    company: '',
    theme: '',
    status: 'active' as 'active' | 'suspended' | 'churned'
  });

  // Theme assignment state
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);

  useEffect(() => {
    fetchCustomers();
    fetchThemes();
  }, [filter]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('service_integrator_token');
      const url = filter === 'all'
        ? '/api/service-integrator/customers'
        : `/api/service-integrator/customers?status=${filter}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const fetchThemes = async () => {
    try {
      const themesData = await apiClient.getSIThemes(true); // Get active themes only
      setThemes(themesData);
    } catch (error) {
      console.error('Error fetching themes:', error);
    }
  };

  const handleAssignTheme = async () => {
    if (!selectedCustomer || !selectedThemeId) return;

    setError('');

    try {
      await apiClient.assignSIThemeToCustomer(selectedThemeId, selectedCustomer.id);
      setShowAssignThemeModal(false);
      setSelectedCustomer(null);
      setSelectedThemeId(null);
      fetchCustomers();
    } catch (err: any) {
      console.error('Error assigning theme:', err);
      setError(err.response?.data?.error || 'Failed to assign theme');
    }
  };

  const openAssignThemeModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSelectedThemeId(null);
    setShowAssignThemeModal(true);
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditFormData({
      name: customer.name,
      contactEmail: customer.contactEmail,
      company: customer.company,
      theme: customer.theme || '',
      status: customer.status
    });
    setShowEditModal(true);
    setError('');
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      setError('');
      const token = localStorage.getItem('service_integrator_token');
      const response = await fetch(`/api/service-integrator/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editFormData)
      });

      const data = await response.json();
      if (data.success) {
        setShowEditModal(false);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        setError(data.error || 'Failed to update customer');
      }
    } catch (error) {
      console.error('Error updating customer:', error);
      setError('Failed to update customer');
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('service_integrator_token');
      const response = await fetch('/api/service-integrator/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateModal(false);
        setFormData({ name: '', contactEmail: '', company: '', theme: '' });
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger'> = {
      active: 'success',
      suspended: 'warning',
      churned: 'danger'
    };
    return <Badge variant={variants[status] || 'success'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">
            Manage your end-customers and their licenses
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          Create Customer
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex space-x-2">
          {(['all', 'active', 'suspended', 'churned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {/* Customers List */}
      {customers.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No customers</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new customer.
            </p>
            <div className="mt-6">
              <Button onClick={() => setShowCreateModal(true)}>
                Create Customer
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {customers.map((customer) => (
            <Card key={customer.id}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {customer.name}
                    </h3>
                    {getStatusBadge(customer.status)}
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Company</p>
                      <p className="text-sm text-gray-900">{customer.company}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Contact Email</p>
                      <p className="text-sm text-gray-900">{customer.contactEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">License Key</p>
                      <p className="text-sm text-gray-900 font-mono">{customer.licenseKey}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">API Calls</p>
                      <p className="text-sm text-gray-900">{customer.totalApiCalls.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Theme</p>
                      <p className="text-sm text-gray-900">{customer.theme || 'Default'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500">Created</p>
                      <p className="text-sm text-gray-900">
                        {new Date(customer.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="ml-4 flex flex-col space-y-2">
                  <button
                    onClick={() => openAssignThemeModal(customer)}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium whitespace-nowrap"
                  >
                    Assign Theme
                  </button>
                  <button
                    onClick={() => openEditModal(customer)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                  <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                    Suspend
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Customer Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Customer"
      >
        <form onSubmit={handleCreateCustomer} className="space-y-4">
          <Input
            label="Customer Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Input
            label="Contact Email"
            type="email"
            value={formData.contactEmail}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            required
          />
          <Input
            label="Company Name"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            required
          />
          <Input
            label="Theme (optional)"
            value={formData.theme}
            onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
            placeholder="e.g., capgemini, ey"
          />
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Customer</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCustomer(null);
          setError('');
        }}
        title="Edit Customer"
      >
        <form onSubmit={handleEditCustomer} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <Input
            label="Customer Name"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />
          <Input
            label="Contact Email"
            type="email"
            value={editFormData.contactEmail}
            onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
            required
          />
          <Input
            label="Company Name"
            value={editFormData.company}
            onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
            required
          />
          <Input
            label="Theme (optional)"
            value={editFormData.theme}
            onChange={(e) => setEditFormData({ ...editFormData, theme: e.target.value })}
            placeholder="e.g., capgemini, ey"
          />
          <Select
            label="Status"
            value={editFormData.status}
            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'churned', label: 'Churned' }
            ]}
          />
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowEditModal(false);
                setSelectedCustomer(null);
                setError('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Theme Modal */}
      <Modal
        isOpen={showAssignThemeModal}
        onClose={() => {
          setShowAssignThemeModal(false);
          setSelectedCustomer(null);
          setSelectedThemeId(null);
        }}
        title="Assign Custom Theme"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <p className="text-sm text-gray-600">
            Assign a custom branded theme to{' '}
            <span className="font-semibold">{selectedCustomer?.name}</span>
          </p>

          {themes.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                No custom themes available. Please create a theme first in the Themes page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Theme
              </label>
              <div className="space-y-2">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedThemeId(theme.id)}
                    className={`w-full text-left p-4 border-2 rounded-lg transition-colors ${
                      selectedThemeId === theme.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-semibold text-gray-900">
                            {theme.displayName}
                          </h4>
                          {theme.isDefault && (
                            <Badge variant="success">Default</Badge>
                          )}
                        </div>
                        {theme.description && (
                          <p className="text-sm text-gray-600 mt-1">
                            {theme.description}
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <div
                          className="w-6 h-6 rounded border border-gray-300"
                          style={{ backgroundColor: theme.primaryColor }}
                          title={`Primary: ${theme.primaryColor}`}
                        />
                        {theme.secondaryColor && (
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: theme.secondaryColor }}
                            title={`Secondary: ${theme.secondaryColor}`}
                          />
                        )}
                        {theme.accentColor && (
                          <div
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: theme.accentColor }}
                            title={`Accent: ${theme.accentColor}`}
                          />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAssignThemeModal(false);
                setSelectedCustomer(null);
                setSelectedThemeId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleAssignTheme}
              disabled={!selectedThemeId}
            >
              Assign Theme
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
