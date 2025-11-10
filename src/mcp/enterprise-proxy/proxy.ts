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

// Configuration from environment variables
const ENTERPRISE_URL = process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY;
const VERSION = process.env.SNOW_FLOW_VERSION || '8.30.34';

// Generate unique machine ID for tracking
let INSTANCE_ID: string;
try {
  INSTANCE_ID = machineIdSync();
} catch {
  // Fallback if machine ID generation fails
  INSTANCE_ID = `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * List available enterprise tools from license server
 * @returns Array of enterprise tools
 */
export async function listEnterpriseTools(): Promise<EnterpriseTool[]> {
  if (!LICENSE_KEY) {
    throw new Error(
      'SNOW_LICENSE_KEY not configured. Run: snow-flow auth login'
    );
  }

  try {
    const response = await axios.get<EnterpriseToolListResponse>(
      `${ENTERPRISE_URL}/mcp/tools/list`,
      {
        headers: {
          Authorization: `Bearer ${LICENSE_KEY}`,
          'X-Instance-ID': INSTANCE_ID,
          'X-Snow-Flow-Version': VERSION,
        },
        timeout: 10000, // 10 seconds for listing
      }
    );

    return response.data.tools || [];
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
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
  if (!LICENSE_KEY) {
    throw new Error(
      'SNOW_LICENSE_KEY not configured. Run: snow-flow auth login'
    );
  }

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
          Authorization: `Bearer ${LICENSE_KEY}`,
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
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Handle specific HTTP errors
      if (axiosError.response?.status === 401) {
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
    const response = await axios.post(
      `${ENTERPRISE_URL}/api/license/validate`,
      {},
      {
        headers: {
          Authorization: `Bearer ${licenseKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return {
      valid: true,
      features: response.data.features || [],
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
    }
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Validation failed',
    };
  }
}
