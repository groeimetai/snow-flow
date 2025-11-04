/**
 * Permission Validation for Stakeholder Read-Only Enforcement
 *
 * Validates that users have permission to execute tools based on their role.
 * Phase 2: Permission Enforcement (v2.0.0)
 */

import { MCPToolDefinition, JWTPayload, UserRole } from './types.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Extract JWT payload from MCP connection headers
 * (In production, this is set by the enterprise MCP proxy)
 */
export function extractJWTPayload(headers?: Record<string, string>): JWTPayload | null {
  // For now, check if role is passed via environment variable (development mode)
  // In production, this comes from JWT in X-Snow-Flow-Auth header
  const devRole = process.env.SNOW_FLOW_USER_ROLE as UserRole | undefined;

  if (devRole && ['developer', 'stakeholder', 'admin'].includes(devRole)) {
    // Development mode: create mock JWT payload
    return {
      customerId: 0,
      tier: 'community',
      features: [],
      role: devRole,
      sessionId: 'dev-session',
      iat: Date.now(),
      exp: Date.now() + 86400000, // 24 hours
    };
  }

  // Production mode: extract from headers
  if (headers && headers['x-snow-flow-auth']) {
    try {
      // In production, the enterprise MCP proxy sets this header with JWT
      const payload = JSON.parse(Buffer.from(headers['x-snow-flow-auth'], 'base64').toString());
      return payload as JWTPayload;
    } catch (error) {
      console.error('[Permission] Failed to parse JWT from headers:', error);
      return null;
    }
  }

  // No JWT found - default to developer for backward compatibility
  // TODO: In future, require JWT for all enterprise connections
  return {
    customerId: 0,
    tier: 'community',
    features: [],
    role: 'developer', // Default to most permissive for backward compatibility
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
  permission: 'read' | 'write';
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

  // Check 2: Double-check for stakeholder write protection
  // Even if stakeholder is in allowedRoles (shouldn't happen), never allow write operations
  if (userRole === 'stakeholder' && permission === 'write') {
    const errorMessage =
      `🚫 Write Access Denied: Tool '${tool.name}' requires write permissions.\n\n` +
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
