// ===== AUTHENTICATION =====

export interface AdminSession {
  type: 'admin';
  email: string;
}

export interface CustomerSession {
  token: string;
  customer: Customer;
}

export interface ServiceIntegratorSession {
  token: string;
  serviceIntegrator: ServiceIntegrator;
}

// ===== CUSTOMER =====

export interface Customer {
  id: number;
  serviceIntegratorId: number;
  name: string;
  contactEmail: string;
  company?: string;
  licenseKey: string;
  theme?: string;
  tier?: string;
  developerSeats?: number;
  stakeholderSeats?: number;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'suspended' | 'churned';
  totalApiCalls: number;
  lastApiCall?: number;
  activeConnections?: number;
  lastActivityAt?: number;
}

export interface CreateCustomerDto {
  serviceIntegratorId: number;
  name: string;
  contactEmail: string;
  company?: string;
  theme?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  contactEmail?: string;
  company?: string;
  theme?: string;
  status?: 'active' | 'suspended' | 'churned';
}

// ===== SERVICE INTEGRATOR =====

export interface ServiceIntegrator {
  id: number;
  companyName: string;
  contactEmail: string;
  billingEmail: string;
  masterLicenseKey: string;
  whiteLabelEnabled: boolean;
  customDomain?: string;
  logoUrl?: string;
  createdAt: number;
  status: 'active' | 'suspended' | 'churned';
}

export interface CreateServiceIntegratorDto {
  companyName: string;
  contactEmail: string;
  billingEmail: string;
  whiteLabelEnabled?: boolean;
  customDomain?: string;
  logoUrl?: string;
}

// ===== CREDENTIALS =====

export interface Credential {
  id: number;
  customerId: number;
  service: 'jira' | 'azdo' | 'confluence';
  username?: string;
  encryptedToken: string;
  metadata?: string;
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
  lastUsed?: number;
}

export interface CredentialDisplay {
  id: number;
  service: 'jira' | 'azdo' | 'confluence';
  username?: string;
  status: 'connected' | 'expired' | 'error';
  expiresAt?: number;
  lastUsed?: number;
  createdAt: number;
}

export interface CreateCredentialDto {
  service: 'jira' | 'azdo' | 'confluence';
  username: string;
  password: string;
  apiToken?: string;
  instanceUrl: string;
  metadata?: Record<string, any>;
}

// ===== THEME =====

export interface Theme {
  name: string;
  displayName: string;
  description?: string;
  primaryColor: string;
  available: boolean;
}

export interface ThemeConfig {
  name: string;
  description?: string;
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
    success?: string;
    warning?: string;
    error?: string;
    info?: string;
  };
  textColors?: {
    primary: string;
    secondary?: string;
    muted?: string;
  };
}

// ===== CUSTOM THEMES (SERVICE INTEGRATOR) =====

export interface CustomTheme {
  id: number;
  serviceIntegratorId: number;
  themeName: string;
  displayName: string;
  description?: string;
  themeConfig: any; // Full SnowCode theme JSON configuration
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCustomThemeDto {
  themeName: string;
  displayName: string;
  description?: string;
  themeConfig: any;
  primaryColor: string;
  secondaryColor?: string;
  accentColor?: string;
  isDefault?: boolean;
}

export interface UpdateCustomThemeDto {
  displayName?: string;
  description?: string;
  themeConfig?: any;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface ThemeUsageStats {
  totalAssignments: number;
  activeCustomers: number;
  recentActivity: Array<{
    customerId: number;
    action: string;
    timestamp: number;
  }>;
}

// ===== USAGE & STATISTICS =====

export interface UsageStats {
  totalCalls?: number;
  callsToday?: number;
  callsThisWeek?: number;
  callsThisMonth?: number;
  apiCallsLast30Days?: number;
  activeInstances: number;
  toolBreakdown?: ToolUsage[];
  timeline?: UsageDataPoint[];
  // Customer portal usage stats
  totalApiCalls?: number;
  avgResponseTime?: number;
  peakUsageDay?: string;
  peakUsageCalls?: number;
  errorRate?: number;
  totalErrors?: number;
  instanceUsage?: Array<{
    instanceUrl: string;
    apiCalls: number;
    errors: number;
    avgResponseTime: number;
    lastActive: string;
  }>;
}

export interface ToolUsage {
  toolName: string;
  category: string;
  count: number;
  percentage: number;
}

export interface UsageDataPoint {
  date: string;
  calls: number;
  errors: number;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  totalApiCalls: number;
  apiCallsToday: number;
  apiCallsThisWeek: number;
  activeInstances: number;
  totalServiceIntegrators: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: number;
  type: 'customer_created' | 'api_call' | 'credential_added' | 'error';
  description: string;
  timestamp: number;
  customerId?: number;
  customerName?: string;
}

// ===== CUSTOMER INSTANCE =====

export interface CustomerInstance {
  id: number;
  customerId: number;
  instanceId: string;
  instanceName?: string;
  hostname?: string;
  ipAddress?: string;
  lastSeen: number;
  version: string;
  validationCount: number;
  createdAt: number;
}

// ===== MCP USAGE =====

export interface McpUsage {
  id: number;
  customerId: number;
  instanceId: number;
  toolName: string;
  toolCategory: 'jira' | 'azdo' | 'confluence' | 'ml' | 'sso';
  timestamp: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

// ===== MONITORING =====

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, any>;
  version: string;
  uptime: number;
  timestamp: number;
  summary?: {
    total: number;
    healthy: number;
    warnings: number;
    critical: number;
  };
  totalCheckTime?: number;
}

export interface SystemMetrics {
  apiCalls: {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  };
  mcpTools: {
    totalCalls: number;
    byCategory: Record<string, number>;
    avgDuration: number;
  };
  customers: {
    total: number;
    active: number;
    suspended: number;
  };
}

// ===== API RESPONSES =====

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== FILTERS & PAGINATION =====

export interface CustomerFilters {
  status?: 'active' | 'suspended' | 'churned';
  serviceIntegratorId?: number;
  search?: string;
  theme?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
