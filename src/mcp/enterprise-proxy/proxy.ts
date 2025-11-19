/**
 * Enterprise MCP Proxy
 * Handles HTTPS communication with enterprise license server
 */

import axios, { AxiosError } from 'axios';
import { machineIdSync } from 'node-machine-id';
import { gatherCredentials, getMissingCredentials } from './credentials.js';
import {
  EnterpriseToolCallRequest,
  EnterpriseToolCallResponse,
  EnterpriseToolListResponse,
  EnterpriseTool,
} from './types.js';
import { proxyLogger } from './logger.js';

// Configuration from environment variables
const ENTERPRISE_URL = process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';
const PORTAL_URL = process.env.SNOW_PORTAL_URL || 'https://portal.snow-flow.dev';
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY;
const TRIMMED_LICENSE_KEY = LICENSE_KEY ? LICENSE_KEY.trim() : undefined; // Remove newlines/whitespace
const VERSION = process.env.SNOW_FLOW_VERSION || '8.30.31';

// Generate unique machine ID for tracking
let INSTANCE_ID: string;
try {
  INSTANCE_ID = machineIdSync();
} catch {
  // Fallback if machine ID generation fails
  INSTANCE_ID = `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

// JWT token cache
let cachedJwtToken: string | null = null;
let jwtTokenExpiry: number = 0;

/**
 * Exchange license key for JWT token
 * Caches the JWT token until it expires
 */
async function getJwtToken(): Promise<string> {
  // Return cached token if still valid (with 5 minute buffer)
  const now = Date.now();
  if (cachedJwtToken && jwtTokenExpiry > now + 5 * 60 * 1000) {
    proxyLogger.log('debug', 'Using cached JWT token', {
      expiresIn: Math.floor((jwtTokenExpiry - now) / 1000 / 60) + ' minutes'
    });
    return cachedJwtToken;
  }

  if (!TRIMMED_LICENSE_KEY) {
    throw new Error('SNOW_LICENSE_KEY or SNOW_ENTERPRISE_LICENSE_KEY not configured. Run: snow-flow auth login');
  }

  proxyLogger.log('info', 'Exchanging license key for JWT token', {
    licenseKeyLength: TRIMMED_LICENSE_KEY.length,
    licenseKeyPreview: TRIMMED_LICENSE_KEY.substring(0, 20) + '...',
    portalUrl: PORTAL_URL,
    enterpriseUrl: ENTERPRISE_URL
  });

  try {
    const response = await axios.post(
      `${PORTAL_URL}/api/auth/mcp/login`,
      {
        licenseKey: TRIMMED_LICENSE_KEY,
        machineId: INSTANCE_ID,
        role: 'developer' // Default role for MCP connections
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Instance-ID': INSTANCE_ID,
          'X-Snow-Flow-Version': VERSION,
        },
        timeout: 10000,
      }
    );

    if (!response.data.success || !response.data.token) {
      throw new Error('Failed to obtain JWT token from enterprise server');
    }

    const jwtToken = response.data.token;

    // Cache the JWT token (expires in 7 days according to backend, but we'll refresh earlier)
    cachedJwtToken = jwtToken;
    jwtTokenExpiry = now + 7 * 24 * 60 * 60 * 1000; // 7 days

    proxyLogger.log('info', 'Successfully obtained JWT token', {
      tokenLength: jwtToken.length,
      customer: response.data.customer?.name,
      role: response.data.customer?.role
    });

    return jwtToken;
  } catch (error) {
    cachedJwtToken = null;
    jwtTokenExpiry = 0;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      proxyLogger.log('error', 'Failed to obtain JWT token', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        responseData: axiosError.response?.data,
        code: axiosError.code,
        message: axiosError.message
      });

      if (axiosError.response?.status === 401) {
        throw new Error(
          'License key invalid or expired.\n\n' +
          'Fix this by running: snow-flow auth login'
        );
      }

      if (axiosError.response?.status === 429) {
        const responseData = axiosError.response?.data as any;
        throw new Error(
          `Seat limit reached: ${responseData.message || 'All seats are currently in use'}\n\n` +
          'Please wait for an available seat or contact support to purchase additional seats.'
        );
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to enterprise server at ${ENTERPRISE_URL}`
        );
      }
    }

    throw new Error(
      `Failed to obtain JWT token: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * List available enterprise tools from license server
 * @returns Array of enterprise tools
 */
export async function listEnterpriseTools(): Promise<EnterpriseTool[]> {
  if (!TRIMMED_LICENSE_KEY) {
    proxyLogger.log('error', 'SNOW_LICENSE_KEY not configured');
    throw new Error(
      'SNOW_LICENSE_KEY or SNOW_ENTERPRISE_LICENSE_KEY not configured. Run: snow-flow auth login'
    );
  }

  try {
    // Get JWT token (cached or fetch new one)
    const jwtToken = await getJwtToken();

    // Log request info for debugging
    proxyLogger.log('debug', 'Fetching enterprise tools', {
      jwtTokenLength: jwtToken.length,
      enterpriseUrl: ENTERPRISE_URL,
      instanceId: INSTANCE_ID.substring(0, 16) + '...',
      version: VERSION
    });

    proxyLogger.log('info', 'Sending request to enterprise server', {
      url: `${ENTERPRISE_URL}/mcp/tools/list`,
      authHeaderLength: `Bearer ${jwtToken}`.length
    });

    const response = await axios.get<EnterpriseToolListResponse>(
      `${ENTERPRISE_URL}/mcp/tools/list`,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'X-Instance-ID': INSTANCE_ID,
          'X-Snow-Flow-Version': VERSION,
        },
        timeout: 10000, // 10 seconds for listing
      }
    );

    proxyLogger.log('info', `Successfully fetched ${response.data.tools?.length || 0} enterprise tools`);
    return response.data.tools || [];
  } catch (error) {
    // If JWT token exchange failed, the error is already logged and thrown
    if (error instanceof Error && error.message.includes('JWT token')) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Log detailed error info
      proxyLogger.log('error', 'Enterprise tools list request failed', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        responseData: axiosError.response?.data,
        code: axiosError.code,
        message: axiosError.message
      });

      if (axiosError.response?.status === 401) {
        // Clear cached JWT token on 401
        cachedJwtToken = null;
        jwtTokenExpiry = 0;

        // Check if the error is due to JWT malformation (common after KMS secret updates)
        const responseData = axiosError.response?.data as any;
        if (responseData?.error && responseData.error.toLowerCase().includes('jwt')) {
          proxyLogger.log('error', 'JWT token rejected by server - clearing cache', {
            serverError: responseData.error
          });
          throw new Error(
            'JWT token is invalid or expired.\n\n' +
            '🔧 This usually happens after server configuration updates (e.g., KMS secrets).\n\n' +
            'Fix this by running: snow-flow auth login\n\n' +
            'The JWT will be regenerated with the latest server configuration.'
          );
        }
        throw new Error(
          'License key invalid or expired. Run: snow-flow auth login'
        );
      }
      if (axiosError.response?.status === 403) {
        throw new Error('Access denied. Please check your enterprise license.');
      }
      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to enterprise server at ${ENTERPRISE_URL}`
        );
      }
    }

    proxyLogger.log('error', 'Unexpected error listing tools', {
      error: error instanceof Error ? error.message : String(error)
    });

    throw new Error(
      `Failed to list enterprise tools: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Execute an enterprise tool via the license server
 * @param toolName - Name of the tool to execute
 * @param args - Arguments for the tool
 * @returns Tool execution result
 */
export async function proxyToolCall(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  if (!TRIMMED_LICENSE_KEY) {
    throw new Error(
      'SNOW_LICENSE_KEY or SNOW_ENTERPRISE_LICENSE_KEY not configured. Run: snow-flow auth login'
    );
  }

  // Get JWT token (cached or fetch new one)
  const jwtToken = await getJwtToken();

  // Gather credentials from environment
  const credentials = gatherCredentials(toolName);

  // Check for missing credentials (warn but don't fail - server might have them)
  const missing = getMissingCredentials(toolName);
  if (missing.length > 0) {
    console.error(
      `Warning: Missing local credentials: ${missing.join(', ')}. Using server-side credentials if available.`
    );
  }

  // Prepare request
  const request: EnterpriseToolCallRequest = {
    tool: toolName,
    arguments: args,
    credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
  };

  try {
    const response = await axios.post<EnterpriseToolCallResponse>(
      `${ENTERPRISE_URL}/mcp/tools/call`,
      request,
      {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
          'X-Instance-ID': INSTANCE_ID,
          'X-Snow-Flow-Version': VERSION,
        },
        timeout: 120000, // 2 minutes for tool execution
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'Tool execution failed');
    }

    return response.data.result;
  } catch (error) {
    // If JWT token exchange failed, the error is already logged and thrown
    if (error instanceof Error && error.message.includes('JWT token')) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Handle specific HTTP errors
      if (axiosError.response?.status === 401) {
        // Clear cached JWT token on 401
        cachedJwtToken = null;
        jwtTokenExpiry = 0;

        throw new Error(
          'License key invalid or expired. Run: snow-flow auth login'
        );
      }

      if (axiosError.response?.status === 403) {
        throw new Error('Access denied. Please check your enterprise license.');
      }

      if (axiosError.response?.status === 429) {
        const retryAfter = axiosError.response.headers['retry-after'] || '300';
        throw new Error(
          `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        );
      }

      if (axiosError.response?.status === 404) {
        throw new Error(`Tool '${toolName}' not found in enterprise catalog.`);
      }

      if (axiosError.response?.data) {
        const errorData = axiosError.response.data as any;
        if (errorData.error) {
          throw new Error(`Enterprise server error: ${errorData.error}`);
        }
      }

      if (axiosError.code === 'ECONNREFUSED') {
        throw new Error(
          `Cannot connect to enterprise server at ${ENTERPRISE_URL}`
        );
      }

      if (axiosError.code === 'ETIMEDOUT') {
        throw new Error(
          'Request to enterprise server timed out. Tool execution may still be in progress.'
        );
      }
    }

    throw new Error(
      `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate license key with enterprise server
 * @param licenseKey - License key to validate
 * @returns Validation response
 */
export async function validateLicenseKey(
  licenseKey: string
): Promise<{
  valid: boolean;
  error?: string;
  features?: string[];
  serverUrl?: string;
}> {
  try {
    // Use /api/auth/mcp/login to validate and get JWT token
    const response = await axios.post(
      `${PORTAL_URL}/api/auth/mcp/login`,
      {
        licenseKey: licenseKey.trim(),
        machineId: INSTANCE_ID,
        role: 'developer'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Instance-ID': INSTANCE_ID,
          'X-Snow-Flow-Version': VERSION,
        },
        timeout: 10000,
      }
    );

    if (!response.data.success || !response.data.token) {
      return {
        valid: false,
        error: 'Invalid license key - no token returned'
      };
    }

    return {
      valid: true,
      features: ['jira', 'azdo', 'confluence'], // All features for enterprise
      serverUrl: ENTERPRISE_URL,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        return { valid: false, error: 'Invalid license key' };
      }
      if (axiosError.response?.status === 403) {
        return { valid: false, error: 'License key expired or inactive' };
      }
      if (axiosError.response?.status === 429) {
        return { valid: false, error: 'Seat limit reached' };
      }
      const errorData = axiosError.response?.data as any;
      if (errorData?.error) {
        return { valid: false, error: errorData.error };
      }
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}
