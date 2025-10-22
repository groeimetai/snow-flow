/**
 * Snow-Flow Enterprise
 *
 * Premium features for enterprise ServiceNow development.
 * Requires valid commercial license.
 *
 * @license Commercial - See LICENSE-COMMERCIAL.md
 * @copyright 2025 Snow-Flow
 */

// License validation
export * from './license/index.js';
export { LicenseValidator, requireLicense } from './license/validator.js';

// Jira integration
export * from './integrations/jira/index.js';

// MCP tools
export { enterpriseMcpTools, registerEnterpriseTools } from './tools/mcp-tools.js';

// Version information
export const ENTERPRISE_VERSION = '1.0.0';

/**
 * Initialize enterprise features
 *
 * @param licenseKey - Enterprise license key
 * @returns Promise<void>
 */
export async function initializeEnterprise(licenseKey?: string): Promise<void> {
  const { LicenseValidator } = await import('./license/validator.js');
  const validator = LicenseValidator.getInstance();

  if (licenseKey) {
    validator.setLicenseKey(licenseKey);
  }

  // Validate license
  const result = await validator.validate();

  if (!result.success) {
    throw new Error(
      'Enterprise license validation failed. Please check your license key and connection to the license server.'
    );
  }

  console.log('[Snow-Flow Enterprise] Initialized successfully');
  if (result.response?.tier) {
    console.log(`[Snow-Flow Enterprise] License tier: ${result.response.tier}`);
  }
  if (result.response?.features) {
    console.log(`[Snow-Flow Enterprise] Features: ${result.response.features.join(', ')}`);
  }
}
