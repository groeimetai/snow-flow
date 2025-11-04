/**
 * Shared TypeScript types for Unified MCP Server
 */

import { z } from 'zod';

/**
 * Enterprise tier levels
 */
export type EnterpriseTier = 'community' | 'professional' | 'team' | 'enterprise';

/**
 * Enterprise license information
 */
export interface EnterpriseLicense {
  tier: EnterpriseTier;
  company?: string; // Company identifier (e.g., 'acme', 'example')
  companyName?: string; // Display name (e.g., 'ACME Corp', 'Example Inc')
  licenseKey?: string; // Format: SNOW-[TIER]-[ORG-ID]-[EXPIRY]-[CHECKSUM]
  expiresAt?: Date;
  features: string[]; // Enabled enterprise features
  theme?: string; // Company-branded theme name
}

/**
 * ServiceNow instance authentication context
 */
export interface ServiceNowContext {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
  username?: string;
  password?: string;
  // Enterprise features
  enterprise?: EnterpriseLicense;
}

/**
 * User role for permission validation
 */
export type UserRole = 'developer' | 'stakeholder' | 'admin';

/**
 * Tool permission level
 */
export type ToolPermission = 'read' | 'write';

/**
 * MCP Tool Definition (compliant with Model Context Protocol)
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  // Metadata for tool discovery (not sent to LLM)
  category?: string;
  subcategory?: string;
  use_cases?: string[];
  complexity?: 'beginner' | 'intermediate' | 'advanced';
  frequency?: 'low' | 'medium' | 'high';

  // 🆕 Permission enforcement
  // Optional for backward compatibility during migration
  permission?: ToolPermission; // 'read' or 'write' - defaults to 'write' (most restrictive)
  allowedRoles?: UserRole[]; // Roles permitted to execute this tool - defaults to ['developer', 'admin']

  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Tool execution function signature
 */
export type ToolExecutor = (
  args: Record<string, any>,
  context: ServiceNowContext
) => Promise<ToolResult>;

/**
 * Tool result structure
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTime?: number;
    apiCalls?: number;
    updateSetId?: string;
    [key: string]: any;
  };
}

/**
 * Registered tool (definition + executor)
 */
export interface RegisteredTool {
  definition: MCPToolDefinition;
  executor: ToolExecutor;
  domain: string; // 'deployment', 'operations', 'ui-builder', etc.
  filePath: string;
  metadata: {
    addedAt: Date;
    version: string;
    author?: string;
  };
}

/**
 * Tool registry configuration
 */
export interface ToolRegistryConfig {
  toolsDirectory: string;
  autoDiscovery: boolean;
  enableCaching: boolean;
  cacheMaxAge: number;
  validateOnRegister: boolean;
}

/**
 * Error handling configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

/**
 * OAuth token response from ServiceNow
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}

/**
 * JWT Payload (for enterprise MCP authentication)
 */
export interface JWTPayload {
  customerId: number;
  company?: string;
  tier: EnterpriseTier;
  features: string[];
  role: UserRole; // 'developer', 'stakeholder', or 'admin'
  userId?: number; // NULL for MCP proxy connections
  sessionId: string; // Unique session identifier
  instanceId?: string; // Machine fingerprint
  iat: number; // Issued at
  exp: number; // Expires at
}

/**
 * ServiceNow API error structure
 */
export interface ServiceNowError {
  error: {
    message: string;
    detail: string;
  };
  status: string;
}

/**
 * Tool discovery result
 */
export interface ToolDiscoveryResult {
  toolsFound: number;
  toolsRegistered: number;
  toolsFailed: number;
  domains: string[];
  errors: Array<{
    filePath: string;
    error: string;
  }>;
  duration: number;
}

/**
 * Validation result for tool definitions
 */
export interface ToolValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Tool metadata (for tool-definitions.json)
 */
export interface ToolMetadata {
  name: string;
  domain: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  examples?: Array<{
    description: string;
    input: Record<string, any>;
    expectedOutput?: any;
  }>;
}

/**
 * Server statistics
 */
export interface ServerStats {
  uptime: number;
  totalToolCalls: number;
  successfulCalls: number;
  failedCalls: number;
  averageExecutionTime: number;
  toolUsage: Record<string, number>;
  errorsByType: Record<string, number>;
}

/**
 * Widget coherence validation result (Snow-Flow specific)
 */
export interface WidgetCoherenceResult {
  coherent: boolean;
  issues: Array<{
    type: 'missing_data' | 'orphaned_method' | 'action_mismatch' | 'invalid_reference';
    severity: 'critical' | 'warning';
    description: string;
    location?: string;
    fix?: string;
  }>;
  analysis: {
    serverInitializedData: string[];
    clientMethods: string[];
    htmlReferences: string[];
    inputActions: string[];
  };
}

/**
 * ES5 validation result (Snow-Flow specific)
 */
export interface ES5ValidationResult {
  valid: boolean;
  violations: Array<{
    type: 'const' | 'let' | 'arrow_function' | 'template_literal' | 'destructuring' | 'for_of' | 'default_param' | 'class';
    line: number;
    column: number;
    code: string;
    fix: string;
  }>;
}

/**
 * Update Set context (Snow-Flow specific)
 */
export interface UpdateSetContext {
  sys_id: string;
  name: string;
  state: 'in progress' | 'complete' | 'committed';
  description?: string;
  isCurrent: boolean;
}
