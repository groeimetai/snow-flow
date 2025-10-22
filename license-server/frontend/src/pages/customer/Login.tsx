import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import toast from 'react-hot-toast';

export default function CustomerLogin() {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { customerLogin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!licenseKey) {
      toast.error('Please enter license key');
      return;
    }

    setIsLoading(true);
    try {
      await customerLogin(licenseKey);
      toast.success('Login successful!');
      navigate('/portal/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Portal</h1>
          <p className="text-gray-600">Sign in with your license key</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="text"
              label="License Key"
              placeholder="SNOW-ENT-XXXX-XXXXX"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
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
            <p>Your license key was provided by your service integrator.</p>
          </div>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-4">
          <a href="/" className="hover:text-gray-700">← Back to home</a>
        </p>
      </div>
    </div>
  );
}
