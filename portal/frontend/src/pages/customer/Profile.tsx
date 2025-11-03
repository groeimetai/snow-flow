import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';

export default function CustomerProfile() {
  const { customerSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const [profileData, setProfileData] = useState({
    name: customerSession?.customer.name || '',
    contactEmail: customerSession?.customer.contactEmail || '',
    company: customerSession?.customer.company || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (customerSession) {
      setProfileData({
        name: customerSession.customer.name,
        contactEmail: customerSession.customer.contactEmail,
        company: customerSession.customer.company
      });
    }
  }, [customerSession]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      const token = localStorage.getItem('customer_token');
      const response = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Profile updated successfully');
        setIsEditing(false);
        // Refresh auth context if needed
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('customer_token');
      const response = await fetch('/api/customer/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Password changed successfully');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (!customerSession) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const { customer } = customerSession;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account information and settings
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Account Overview */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Account Overview</h2>
            <Badge variant={customer.status === 'active' ? 'success' : 'warning'}>
              {customer.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">License Key</p>
              <p className="text-sm text-gray-900 font-mono">{customer.licenseKey}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Account Type</p>
              <p className="text-sm text-gray-900">{customer.tier || 'Standard'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Developer Seats</p>
              <p className="text-sm text-gray-900">{customer.developerSeats || 0} seats</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Stakeholder Seats</p>
              <p className="text-sm text-gray-900">{customer.stakeholderSeats || 0} seats</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Theme</p>
              <p className="text-sm text-gray-900">{customer.theme || 'Default'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Member Since</p>
              <p className="text-sm text-gray-900">
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
            {!isEditing && (
              <Button
                variant="secondary"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <Input
                label="Full Name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                required
              />
              <Input
                label="Contact Email"
                type="email"
                value={profileData.contactEmail}
                onChange={(e) => setProfileData({ ...profileData, contactEmail: e.target.value })}
                required
              />
              <Input
                label="Company Name"
                value={profileData.company}
                onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                required
              />

              <div className="flex space-x-3">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsEditing(false);
                    setProfileData({
                      name: customer.name,
                      contactEmail: customer.contactEmail,
                      company: customer.company
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Full Name</p>
                <p className="text-sm text-gray-900">{customer.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Contact Email</p>
                <p className="text-sm text-gray-900">{customer.contactEmail}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Company Name</p>
                <p className="text-sm text-gray-900">{customer.company}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Change Password */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              placeholder="At least 8 characters"
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              required
            />

            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Change Password'}
            </Button>
          </form>
        </div>
      </Card>

      {/* API Usage */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">API Usage</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Total API Calls</p>
              <p className="text-2xl font-bold text-gray-900">
                {customer.totalApiCalls?.toLocaleString() || '0'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Connections</p>
              <p className="text-2xl font-bold text-gray-900">
                {customer.activeConnections ?? 0}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Last Activity</p>
              <p className="text-2xl font-bold text-gray-900">
                {customer.lastActivityAt
                  ? new Date(customer.lastActivityAt).toLocaleDateString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Danger Zone</h2>
          <p className="text-sm text-gray-600">
            These actions are permanent and cannot be undone.
          </p>

          <div className="pt-4 border-t border-gray-200">
            <Button variant="secondary" className="text-red-600 hover:text-red-700">
              Request Account Deletion
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
