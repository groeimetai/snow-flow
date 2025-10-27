import { useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import type { Customer } from '../../types';
import Card from '../../components/common/Card';

export default function ServiceIntegratorCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    contactEmail: '',
    company: '',
    theme: ''
  });

  useEffect(() => {
    loadCustomers();
  }, [selectedStatus]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = selectedStatus === 'all' ? undefined : selectedStatus;
      const data = await apiClient.getServiceIntegratorCustomers(status);
      setCustomers(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createServiceIntegratorCustomer(newCustomer);
      setShowCreateModal(false);
      setNewCustomer({ name: '', contactEmail: '', company: '', theme: '' });
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create customer');
    }
  };

  const handleDeleteCustomer = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete customer "${name}"?`)) {
      return;
    }

    try {
      await apiClient.deleteServiceIntegratorCustomer(id);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete customer');
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await apiClient.updateServiceIntegratorCustomer(id, { status: newStatus });
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update customer status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800';
      case 'churned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="mt-2 text-gray-600">
            Manage your end-customer licenses
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          + Create Customer
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setSelectedStatus('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'all'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({customers.length})
        </button>
        <button
          onClick={() => setSelectedStatus('active')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'active'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setSelectedStatus('suspended')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'suspended'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Suspended
        </button>
        <button
          onClick={() => setSelectedStatus('churned')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            selectedStatus === 'churned'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Churned
        </button>
      </div>

      <Card>
        {customers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No customers found</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-purple-600 hover:text-purple-700"
            >
              Create your first customer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    License Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    API Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {customer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {customer.contactEmail}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-sm font-mono text-gray-900">
                        {customer.licenseKey}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={customer.status}
                        onChange={(e) => handleStatusChange(customer.id, e.target.value)}
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          customer.status
                        )}`}
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="churned">Churned</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {customer.totalApiCalls?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteCustomer(customer.id, customer.name)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Create New Customer
            </h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCustomer.name}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={newCustomer.contactEmail}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, contactEmail: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="contact@acme.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  value={newCustomer.company}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, company: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Acme Corporation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Theme (Optional)
                </label>
                <select
                  value={newCustomer.theme}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, theme: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Default</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="blue">Blue</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
