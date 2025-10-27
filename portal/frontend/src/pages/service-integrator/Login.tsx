import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import toast from 'react-hot-toast';

export default function ServiceIntegratorLogin() {
  const [masterLicenseKey, setMasterLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { serviceIntegratorLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!masterLicenseKey) {
      toast.error('Please enter master license key');
      return;
    }

    setIsLoading(true);
    try {
      await serviceIntegratorLogin(masterLicenseKey);
      toast.success('Login successful!');
      navigate('/service-integrator/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Service Integrator Portal</h1>
          <p className="text-gray-600">Sign in with your master license key</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="text"
              label="Master License Key"
              placeholder="SNOW-SI-XXXX-XXXXX"
              value={masterLicenseKey}
              onChange={(e) => setMasterLicenseKey(e.target.value.toUpperCase())}
              autoFocus
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-sm text-gray-600">
            <p>Manage your end-customer licenses and white-label configurations.</p>
          </div>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-4">
          <a href="/" className="hover:text-gray-700">← Back to home</a>
        </p>
      </div>
    </div>
  );
}
