import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import CustomerLayout from '../../components/layout/CustomerLayout';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'developer' | 'stakeholder' | 'admin';
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: number | null;
  createdAt: number;
  currentlyConnected?: boolean;
  machineId?: string;
}

export default function CustomerUsers() {
  const { customerSession } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    username: '',
    email: '',
    role: 'developer' as 'developer' | 'stakeholder' | 'admin'
  });

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('customer_token');
      const url = filter === 'all'
        ? '/api/users/with-connections'
        : `/api/users/with-connections?status=${filter}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setEditFormData({
      username: user.username,
      email: user.email,
      role: user.role
    });
    setShowEditModal(true);
    setError('');
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setError('');
      const token = localStorage.getItem('customer_token');
      const response = await fetch(`/api/users/${selectedUser.id}`, {
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
        setSelectedUser(null);
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setError('Failed to update user');
    }
  };

  const handleToggleStatus = async (user: User, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      setError('');
      const token = localStorage.getItem('customer_token');
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.success) {
        fetchUsers();
      } else {
        setError(data.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger'> = {
      active: 'success',
      inactive: 'warning',
      suspended: 'danger'
    };
    return <Badge variant={variants[status] || 'success'}>{status}</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      developer: 'bg-blue-100 text-blue-800',
      stakeholder: 'bg-purple-100 text-purple-800',
      admin: 'bg-red-100 text-red-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[role] || 'bg-gray-100 text-gray-800'}`}>
        {role}
      </span>
    );
  };

  return (
    <CustomerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-2 text-gray-600">
            Manage users and their access to Snow-Flow Enterprise
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Filters */}
        <Card>
          <div className="flex space-x-2">
            {(['all', 'active', 'inactive', 'suspended'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </Card>

        {/* Users List */}
        {loading ? (
          <Card>
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-3 text-gray-600">Loading users...</span>
            </div>
          </Card>
        ) : users.length === 0 ? (
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
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No users</h3>
              <p className="mt-1 text-sm text-gray-500">
                Users will appear here when they authenticate with Snow-Flow.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {users.map((user) => (
              <Card key={user.id}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {user.username}
                      </h3>
                      {getStatusBadge(user.status)}
                      {getRoleBadge(user.role)}
                      {user.currentlyConnected && (
                        <Badge variant="success">
                          <span className="flex items-center">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            Connected
                          </span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">Email</p>
                        <p className="text-sm text-gray-900">{user.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">Last Login</p>
                        <p className="text-sm text-gray-900">
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                        </p>
                      </div>
                      {user.machineId && (
                        <div>
                          <p className="text-sm font-medium text-gray-500">Machine ID</p>
                          <p className="text-sm text-gray-900 font-mono">{user.machineId.slice(0, 16)}...</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-500">Created</p>
                        <p className="text-sm text-gray-900">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Edit
                    </button>
                    {user.status === 'active' ? (
                      <button
                        onClick={() => handleToggleStatus(user, 'inactive')}
                        className="text-sm text-yellow-600 hover:text-yellow-700 font-medium"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleStatus(user, 'active')}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Activate
                      </button>
                    )}
                    {user.status !== 'suspended' && (
                      <button
                        onClick={() => handleToggleStatus(user, 'suspended')}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Edit User Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            setError('');
          }}
          title="Edit User"
        >
          <form onSubmit={handleEditUser} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Input
              label="Username"
              value={editFormData.username}
              onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
            <Select
              label="Role"
              value={editFormData.role}
              onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
              options={[
                { value: 'developer', label: 'Developer - Full MCP access' },
                { value: 'stakeholder', label: 'Stakeholder - Portal-only access' },
                { value: 'admin', label: 'Admin - Full administrative access' }
              ]}
            />
            <div className="flex justify-end space-x-3 mt-6">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedUser(null);
                  setError('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Modal>
      </div>
    </CustomerLayout>
  );
}
