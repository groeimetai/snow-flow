import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Card from '../../components/common/Card';
import { apiClient } from '../../api/client';

export default function AdminThemes() {
  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['themes'],
    queryFn: () => apiClient.getThemes(),
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enterprise Themes</h1>
          <p className="mt-1 text-sm text-gray-600">
            Available themes for customer branding
          </p>
        </div>

        {isLoading ? (
          <Card>
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading themes...</span>
            </div>
          </Card>
        ) : themes.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-8">No themes available</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {themes.map((theme: any) => (
              <Card key={theme.name} padding="md">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{theme.displayName}</h3>
                    {theme.description && (
                      <p className="text-sm text-gray-600 mt-1">{theme.description}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div
                      className="w-8 h-8 rounded border border-gray-200"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <span className="text-xs text-gray-500 font-mono">
                      {theme.primaryColor}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <span className={`text-xs ${theme.available ? 'text-green-600' : 'text-gray-400'}`}>
                      {theme.available ? '✓ Available' : 'Not available'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
