import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Snow-Flow Enterprise
          </h1>
          <p className="text-xl text-gray-600">
            License Server & Management Dashboard
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="text-center hover:shadow-md transition-shadow">
            <div className="mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Admin Portal</h2>
              <p className="text-gray-600 mb-6">
                Manage customers, service integrators, and system monitoring
              </p>
            </div>
            <Link to="/admin/login">
              <Button variant="primary" className="w-full">
                Admin Login
              </Button>
            </Link>
          </Card>

          <Card className="text-center hover:shadow-md transition-shadow">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Customer Portal</h2>
              <p className="text-gray-600 mb-6">
                Manage credentials, view usage stats, and configure settings
              </p>
            </div>
            <Link to="/portal/login">
              <Button variant="primary" className="w-full">
                Customer Login
              </Button>
            </Link>
          </Card>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Powered by Snow-Flow Enterprise License Server</p>
        </div>
      </div>
    </div>
  );
}
