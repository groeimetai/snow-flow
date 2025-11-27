/**
 * Permission Validation for Stakeholder Read-Only Enforcement
 *
 * Validates that users have permission to execute tools based on their role.
 * Permission enforcement
 */

import { MCPToolDefinition, JWTPayload, UserRole, ToolPermission } from './types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Cache for auth.json role to avoid repeated file reads
let cachedAuthRole: UserRole | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Load user role from auth.json enterprise section
 */
function loadRoleFromAuthJson(): UserRole | null {
  // Check cache first
  if (cachedAuthRole && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedAuthRole;
  }

  const authPaths = [
    path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json'),
    path.join(os.homedir(), '.snow-flow', 'auth.json'),
  ];

  for (const authPath of authPaths) {
    try {
      if (!fs.existsSync(authPath)) continue;

      const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

      // Check enterprise section for role
      if (authData.enterprise?.role) {
        const role = authData.enterprise.role;
        if (['developer', 'stakeholder', 'admin'].includes(role)) {
          console.log(`[Permission] 🔑 Loaded role '${role}' from ${authPath}`);
          cachedAuthRole = role as UserRole;
          cacheTimestamp = Date.now();
          return cachedAuthRole;
        }
      }
    } catch (error) {
      // Ignore errors, try next path
    }
  }

  return null;
}

/**
 * Extract JWT payload from MCP connection headers
 * Priority: 1. Env var, 2. Headers, 3. auth.json, 4. Default developer
 */
export function extractJWTPayload(headers?: Record<string, string>): JWTPayload | null {
  // Priority 1: Check environment variable (explicit override)
  const devRole = process.env.SNOW_FLOW_USER_ROLE as UserRole | undefined;

  if (devRole && ['developer', 'stakeholder', 'admin'].includes(devRole)) {
    console.log(`[Permission] Using role from env: ${devRole}`);
    return {
      customerId: 0,
      tier: 'community',
      features: [],
      role: devRole,
      sessionId: 'env-session',
      iat: Date.now(),
      exp: Date.now() + 86400000,
    };
  }

  // Priority 2: Extract from headers (enterprise MCP proxy)
  if (headers && headers['x-snow-flow-auth']) {
    try {
      const payload = JSON.parse(Buffer.from(headers['x-snow-flow-auth'], 'base64').toString());
      console.log(`[Permission] Using role from header: ${payload.role}`);
      return payload as JWTPayload;
    } catch (error) {
      console.error('[Permission] Failed to parse JWT from headers:', error);
    }
  }

  // Priority 3: Load from auth.json (snow-code stored role)
  const authJsonRole = loadRoleFromAuthJson();
  if (authJsonRole) {
    return {
      customerId: 0,
      tier: 'enterprise',
      features: [],
      role: authJsonRole,
      sessionId: 'auth-json-session',
      iat: Date.now(),
      exp: Date.now() + 86400000,
    };
  }

  // Priority 4: Default to developer for backward compatibility
  console.log('[Permission] No role found, defaulting to developer');
  return {
    customerId: 0,
    tier: 'community',
    features: [],
    role: 'developer',
    sessionId: 'anonymous',
    iat: Date.now(),
    exp: Date.now() + 86400000,
  };
}

/**
 * Get default permission values for tools without classification
 * (Defaults to most restrictive: write-only for developers)
 */
function getDefaultPermission(tool: MCPToolDefinition): {
  permission: ToolPermission;
  allowedRoles: UserRole[];
} {
  // If tool doesn't have permission fields, default to WRITE (most restrictive)
  return {
    permission: tool.permission || 'write',
    allowedRoles: tool.allowedRoles || ['developer', 'admin'],
  };
}

/**
 * Validate that user has permission to execute a tool
 *
 * @throws McpError if user doesn't have permission
 */
export function validatePermission(
  tool: MCPToolDefinition,
  jwtPayload: JWTPayload | null
): void {
  // Extract user role
  const userRole = jwtPayload?.role || 'developer'; // Default to developer for backward compatibility

  // Get tool permission configuration
  const { permission, allowedRoles } = getDefaultPermission(tool);

  // Check 1: Role-based access control
  if (!allowedRoles.includes(userRole)) {
    const errorMessage =
      `🚫 Permission Denied: Tool '${tool.name}' requires one of these roles: ${allowedRoles.join(', ')}.\n` +
      `Your current role: ${userRole}.\n\n` +
      (userRole === 'stakeholder'
        ? `💡 Stakeholders have read-only access. This tool requires ${permission} permissions.\n` +
          `   To execute write operations, please contact a developer or admin.`
        : `💡 Contact your administrator to upgrade your permissions.`);

    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
  }

  // Check 2: Double-check for stakeholder write/admin protection
  // Even if stakeholder is in allowedRoles (shouldn't happen), never allow write or admin operations
  if (userRole === 'stakeholder' && (permission === 'write' || permission === 'admin')) {
    const permissionType = permission === 'admin' ? 'admin' : 'write';
    const errorMessage =
      `🚫 ${permissionType === 'admin' ? 'Admin' : 'Write'} Access Denied: Tool '${tool.name}' requires ${permissionType} permissions.\n\n` +
      `💡 Stakeholders have read-only access to Snow-Flow tools.\n` +
      `   You can query data, view analytics, and generate reports,\n` +
      `   but cannot create, update, or delete records.\n\n` +
      `   If you need to modify data, please contact a developer or admin.`;

    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
  }

  // Permission granted!
  console.log(
    `[Permission] ✅ User '${userRole}' authorized to execute '${tool.name}' (${permission})`
  );
}

/**
 * Filter tools based on user role (for ListTools handler)
 */
export function filterToolsByRole(
  tools: MCPToolDefinition[],
  jwtPayload: JWTPayload | null
): MCPToolDefinition[] {
  const userRole = jwtPayload?.role || 'developer';

  return tools.filter((tool) => {
    const { allowedRoles } = getDefaultPermission(tool);
    return allowedRoles.includes(userRole);
  });
}

/**
 * Get permission summary for a tool (for debugging/logging)
 */
export function getPermissionSummary(tool: MCPToolDefinition): string {
  const { permission, allowedRoles } = getDefaultPermission(tool);
  return `${tool.name}: ${permission.toUpperCase()} - Roles: [${allowedRoles.join(', ')}]`;
}

/**
 * Validate JWT is not expired
 */
export function validateJWTExpiry(jwtPayload: JWTPayload | null): void {
  if (!jwtPayload) return; // Skip validation if no JWT

  const now = Date.now();
  if (jwtPayload.exp && jwtPayload.exp < now) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      '🚫 Session Expired: Your authentication token has expired. Please re-authenticate.\n\n' +
        '💡 Run: snow-flow auth login'
    );
  }
}
