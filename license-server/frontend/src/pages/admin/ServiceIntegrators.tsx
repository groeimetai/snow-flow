import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../components/layout/AdminLayout';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import { apiClient } from '../../api/client';
import { ServiceIntegrator } from '../../types';

export default function AdminServiceIntegrators() {
  const { data: serviceIntegrators = [], isLoading } = useQuery({
    queryKey: ['service-integrators'],
    queryFn: () => apiClient.getServiceIntegrators(),
  });

  const columns = [
    {
      key: 'companyName',
      header: 'Company',
    },
    {
      key: 'contactEmail',
      header: 'Contact Email',
    },
    {
      key: 'masterLicenseKey',
      header: 'Master License Key',
      render: (si: ServiceIntegrator) => (
        <code className="text-xs bg-gray-100 px-2 py-1 rounded">{si.masterLicenseKey}</code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (si: ServiceIntegrator) => (
        <Badge variant={si.status === 'active' ? 'success' : 'danger'}>
          {si.status}
        </Badge>
      ),
    },
    {
      key: 'whiteLabelEnabled',
      header: 'White Label',
      render: (si: ServiceIntegrator) => (
        <Badge variant={si.whiteLabelEnabled ? 'info' : 'neutral'}>
          {si.whiteLabelEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Integrators</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage service integrator partners and their settings
          </p>
        </div>

        <Table
          data={serviceIntegrators}
          columns={columns}
          keyExtractor={(si: ServiceIntegrator) => si.id}
          isLoading={isLoading}
          emptyMessage="No service integrators found"
        />
      </div>
    </AdminLayout>
  );
}
