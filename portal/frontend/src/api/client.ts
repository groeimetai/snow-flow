import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  ServiceIntegrator,
  CreateServiceIntegratorDto,
  Credential,
  CredentialDisplay,
  CreateCredentialDto,
  Theme,
  ThemeConfig,
  UsageStats,
  DashboardStats,
  CustomerInstance,
  HealthStatus,
  SystemMetrics,
  AdminSession,
  CustomerSession,
  ServiceIntegratorSession,
} from '../types';

class ApiClient {
  private client: AxiosInstance;
  private customerToken?: string;
  private serviceIntegratorToken?: string;

  constructor(baseURL: string = '') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // For cookies (admin sessions)
    });

    // Request interceptor - add auth tokens
    this.client.interceptors.request.use(
      (config) => {
        // Admin token (session cookie handled automatically)
        // Customer token (JWT in localStorage)
        if (this.customerToken && config.url?.startsWith('/api/')) {
          config.headers.Authorization = `Bearer ${this.customerToken}`;
        }
        // Service Integrator token (JWT in localStorage)
        if (this.serviceIntegratorToken && config.url?.startsWith('/api/')) {
          config.headers.Authorization = `Bearer ${this.serviceIntegratorToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<{ error?: string; message?: string }>) => {
        if (error.response?.status === 401) {
          // Only redirect if we're not already on a login page
          const isLoginPage = window.location.pathname.endsWith('/login');

          if (!isLoginPage) {
            // Unauthorized - clear tokens and redirect to login
            this.clearAuth();
            if (window.location.pathname.startsWith('/admin')) {
              window.location.href = '/admin/login';
            } else if (window.location.pathname.startsWith('/portal')) {
              window.location.href = '/portal/login';
            } else if (window.location.pathname.startsWith('/service-integrator')) {
              window.location.href = '/service-integrator/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ===== AUTH MANAGEMENT =====

  setCustomerToken(token: string) {
    this.customerToken = token;
    localStorage.setItem('customer_token', token);
  }

  setServiceIntegratorToken(token: string) {
    this.serviceIntegratorToken = token;
    localStorage.setItem('service_integrator_token', token);
  }

  clearAuth() {
    this.customerToken = undefined;
    this.serviceIntegratorToken = undefined;
    localStorage.removeItem('customer_token');
    localStorage.removeItem('service_integrator_token');
  }

  loadCustomerToken(): boolean {
    const token = localStorage.getItem('customer_token');
    if (token) {
      this.customerToken = token;
      return true;
    }
    return false;
  }

  loadServiceIntegratorToken(): boolean {
    const token = localStorage.getItem('service_integrator_token');
    if (token) {
      this.serviceIntegratorToken = token;
      return true;
    }
    return false;
  }

  // ===== ADMIN AUTHENTICATION =====

  async adminLogin(adminKey: string): Promise<AdminSession> {
    const { data } = await this.client.post('/api/auth/admin/login', {
      adminKey,
    });
    return data.session;
  }

  async adminLogout(): Promise<void> {
    await this.client.post('/api/auth/admin/logout');
    this.clearAuth();
  }

  async getAdminSession(): Promise<AdminSession> {
    const { data } = await this.client.get('/api/auth/admin/session');
    return data.session;
  }

  // ===== CUSTOMER AUTHENTICATION =====

  async customerLogin(licenseKey: string): Promise<CustomerSession> {
    const { data } = await this.client.post('/api/auth/customer/login', {
      licenseKey,
    });
    this.setCustomerToken(data.token);
    return { token: data.token, customer: data.customer };
  }

  async customerLogout(): Promise<void> {
    await this.client.post('/api/auth/customer/logout');
    this.clearAuth();
  }

  async getCustomerSession(): Promise<CustomerSession> {
    const { data } = await this.client.get('/api/auth/customer/session');
    return { token: this.customerToken!, customer: data.customer };
  }

  // ===== SERVICE INTEGRATOR AUTHENTICATION =====

  async serviceIntegratorLogin(masterLicenseKey: string): Promise<ServiceIntegratorSession> {
    const { data } = await this.client.post('/api/auth/service-integrator/login', {
      masterLicenseKey,
    });
    this.setServiceIntegratorToken(data.token);
    return { token: data.token, serviceIntegrator: data.serviceIntegrator };
  }

  async serviceIntegratorLogout(): Promise<void> {
    await this.client.post('/api/auth/service-integrator/logout');
    this.clearAuth();
  }

  async getServiceIntegratorSession(): Promise<ServiceIntegratorSession> {
    const { data } = await this.client.get('/api/auth/service-integrator/session');
    return { token: this.serviceIntegratorToken!, serviceIntegrator: data.serviceIntegrator };
  }

  // ===== CUSTOMERS (ADMIN) =====

  async getCustomers(filters?: {
    status?: string;
    si_id?: number;
    search?: string;
  }): Promise<Customer[]> {
    const { data } = await this.client.get<{ customers: Customer[] }>(
      '/api/admin/customers',
      { params: filters }
    );
    return data.customers;
  }

  async getCustomer(id: number): Promise<Customer> {
    const { data } = await this.client.get<{ customer: Customer }>(
      `/api/admin/customers/${id}`
    );
    return data.customer;
  }

  async createCustomer(customerData: CreateCustomerDto): Promise<Customer> {
    const { data } = await this.client.post<{ customer: Customer }>(
      '/api/admin/customers',
      customerData
    );
    return data.customer;
  }

  async updateCustomer(id: number, updates: UpdateCustomerDto): Promise<Customer> {
    const { data } = await this.client.put<{ customer: Customer }>(
      `/api/admin/customers/${id}`,
      updates
    );
    return data.customer;
  }

  async deleteCustomer(id: number): Promise<void> {
    await this.client.delete(`/api/admin/customers/${id}`);
  }

  async getCustomerUsage(id: number, days: number = 30): Promise<UsageStats> {
    const { data } = await this.client.get<UsageStats>(
      `/api/admin/customers/${id}/usage`,
      { params: { days } }
    );
    return data;
  }

  async getCustomerInstances(id: number): Promise<CustomerInstance[]> {
    const { data } = await this.client.get<{ instances: CustomerInstance[] }>(
      `/api/admin/customers/${id}/instances`
    );
    return data.instances;
  }

  // ===== SERVICE INTEGRATORS (ADMIN) =====

  async getServiceIntegrators(): Promise<ServiceIntegrator[]> {
    const { data } = await this.client.get<{ service_integrators: ServiceIntegrator[] }>(
      '/api/admin/service-integrators'
    );
    return data.service_integrators;
  }

  async getServiceIntegrator(id: number): Promise<ServiceIntegrator> {
    const { data } = await this.client.get<{ service_integrator: ServiceIntegrator }>(
      `/api/admin/service-integrators/${id}`
    );
    return data.service_integrator;
  }

  async createServiceIntegrator(
    siData: CreateServiceIntegratorDto
  ): Promise<ServiceIntegrator> {
    const { data } = await this.client.post<{ service_integrator: ServiceIntegrator }>(
      '/api/admin/service-integrators',
      siData
    );
    return data.service_integrator;
  }

  async updateServiceIntegrator(
    id: number,
    updates: Partial<CreateServiceIntegratorDto>
  ): Promise<ServiceIntegrator> {
    const { data } = await this.client.put<{ service_integrator: ServiceIntegrator }>(
      `/api/admin/service-integrators/${id}`,
      updates
    );
    return data.service_integrator;
  }

  async deleteServiceIntegrator(id: number): Promise<void> {
    await this.client.delete(`/api/admin/service-integrators/${id}`);
  }

  // ===== DASHBOARD STATS (ADMIN) =====

  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await this.client.get<DashboardStats>('/api/admin/stats/dashboard');
    return data;
  }

  // ===== THEMES =====

  async getThemes(): Promise<Theme[]> {
    const { data } = await this.client.get<{ themes: Theme[] }>('/api/themes/list');
    return data.themes;
  }

  async getTheme(themeName: string): Promise<ThemeConfig> {
    const { data } = await this.client.get<{ theme: ThemeConfig }>(
      `/api/themes/${themeName}`
    );
    return data.theme;
  }

  async getCustomerTheme(): Promise<{ theme: string; themeConfig: ThemeConfig }> {
    const { data } = await this.client.get<{
      theme: string;
      themeConfig: ThemeConfig;
    }>('/api/themes/customer/current');
    return data;
  }

  async assignTheme(customerId: number, theme: string): Promise<void> {
    await this.client.post(`/api/themes/customer/${customerId}/assign`, { theme });
  }

  async removeTheme(customerId: number): Promise<void> {
    await this.client.delete(`/api/themes/customer/${customerId}/theme`);
  }

  // ===== CUSTOM THEMES (SERVICE INTEGRATOR) =====

  async getSIThemes(activeOnly: boolean = false): Promise<CustomTheme[]> {
    const { data } = await this.client.get<{ themes: CustomTheme[] }>(
      '/api/service-integrator/themes',
      { params: { active: activeOnly } }
    );
    return data.themes;
  }

  async getSITheme(id: number): Promise<{ theme: CustomTheme; usage: ThemeUsageStats }> {
    const { data } = await this.client.get<{ theme: CustomTheme; usage: ThemeUsageStats }>(
      `/api/service-integrator/themes/${id}`
    );
    return data;
  }

  async createSITheme(themeData: CreateCustomThemeDto): Promise<CustomTheme> {
    const { data } = await this.client.post<{ theme: CustomTheme }>(
      '/api/service-integrator/themes',
      themeData
    );
    return data.theme;
  }

  async updateSITheme(id: number, updates: UpdateCustomThemeDto): Promise<CustomTheme> {
    const { data } = await this.client.put<{ theme: CustomTheme }>(
      `/api/service-integrator/themes/${id}`,
      updates
    );
    return data.theme;
  }

  async deleteSITheme(id: number): Promise<void> {
    await this.client.delete(`/api/service-integrator/themes/${id}`);
  }

  async setSIDefaultTheme(id: number): Promise<void> {
    await this.client.post(`/api/service-integrator/themes/${id}/set-default`);
  }

  async assignSIThemeToCustomer(themeId: number, customerId: number): Promise<void> {
    await this.client.post(`/api/service-integrator/themes/${themeId}/assign-customer`, {
      customerId
    });
  }

  async getSIThemeUsage(id: number, days: number = 30): Promise<ThemeUsageStats> {
    const { data } = await this.client.get<{ stats: ThemeUsageStats }>(
      `/api/service-integrator/themes/${id}/usage`,
      { params: { days } }
    );
    return data.stats;
  }

  // ===== CREDENTIALS (CUSTOMER) =====

  async getCredentials(): Promise<CredentialDisplay[]> {
    const { data } = await this.client.get<{ credentials: CredentialDisplay[] }>(
      '/api/credentials/list'
    );
    return data.credentials;
  }

  async addCredential(credentialData: CreateCredentialDto): Promise<Credential> {
    const { data } = await this.client.post<{ credential: Credential }>(
      '/api/credentials/store',
      credentialData
    );
    return data.credential;
  }

  async updateCredential(
    id: number,
    updates: Partial<CreateCredentialDto>
  ): Promise<Credential> {
    const { data } = await this.client.put<{ credential: Credential }>(
      `/api/credentials/${id}`,
      updates
    );
    return data.credential;
  }

  async deleteCredential(id: number): Promise<void> {
    await this.client.delete(`/api/credentials/${id}`);
  }

  async testCredential(id: number): Promise<{ success: boolean; message: string }> {
    const { data } = await this.client.post<{ success: boolean; message: string }>(
      `/api/credentials/${id}/test`
    );
    return data;
  }

  // ===== CUSTOMER PROFILE =====

  async getProfile(): Promise<{
    customer: Customer;
    usage: UsageStats;
    instances: CustomerInstance[];
  }> {
    const { data } = await this.client.get('/api/customer/profile');
    return data;
  }

  async getUsageStats(days: number = 30): Promise<UsageStats> {
    const { data } = await this.client.get<UsageStats>('/api/customer/usage', {
      params: { days },
    });
    return data;
  }

  // ===== MONITORING =====

  async getHealth(): Promise<HealthStatus> {
    const { data } = await this.client.get<HealthStatus>('/monitoring/health/detailed');
    return data;
  }

  async getMetrics(): Promise<SystemMetrics> {
    const { data } = await this.client.get<SystemMetrics>('/monitoring/metrics');
    return data;
  }
}

// Singleton instance
export const apiClient = new ApiClient();

export default apiClient;
