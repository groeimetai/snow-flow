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

          <Card className="text-center hover:shadow-md transition-shadow">
            <div className="mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Service Integrator Portal</h2>
              <p className="text-gray-600 mb-6">
                Manage end-customer licenses and white-label configurations
              </p>
            </div>
            <Link to="/service-integrator/login">
              <Button variant="primary" className="w-full">
                Service Integrator Login
              </Button>
            </Link>
          </Card>
        </div>

        <div className="mt-12 text-center">
          <Link to="/admin/login" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Administrator Access
          </Link>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Powered by Snow-Flow Enterprise License Server</p>
        </div>
      </div>
    </div>
  );
}
