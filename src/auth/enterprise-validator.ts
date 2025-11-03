/**
 * Enterprise License Validator
 *
 * Validates enterprise license keys and extracts tier/company information.
 * License key format: SNOW-[TIER]-[ORG-ID]-[EXPIRY]-[CHECKSUM]
 *
 * Examples:
 * - SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1
 * - SNOW-TEAM-EY-20251231-B4E1F3D2
 * - SNOW-PRO-ACME-20250630-C5F2G4E3
 *
 * @version 1.0.0
 * @author Snow-Flow Team
 */

import * as crypto from 'crypto';
import { EnterpriseLicense, EnterpriseTier } from './types';

/**
 * Company configuration for branded themes
 */
interface CompanyConfig {
  id: string;
  name: string;
  theme: string;
  features?: string[];
}

/**
 * Predefined company configurations
 */
const COMPANY_CONFIGS: Record<string, CompanyConfig> = {
  'capgemini': {
    id: 'capgemini',
    name: 'Capgemini',
    theme: 'capgemini', // Blue theme
    features: ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging']
  },
  'ey': {
    id: 'ey',
    name: 'EY',
    theme: 'ey', // Yellow theme
    features: ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging']
  },
  'deloitte': {
    id: 'deloitte',
    name: 'Deloitte',
    theme: 'deloitte', // Green theme
    features: ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging']
  },
  'pwc': {
    id: 'pwc',
    name: 'PwC',
    theme: 'pwc', // Orange theme
    features: ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging']
  },
  'kpmg': {
    id: 'kpmg',
    name: 'KPMG',
    theme: 'kpmg', // Blue theme
    features: ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging']
  }
};

/**
 * Tier code mapping
 */
const TIER_CODES: Record<string, EnterpriseTier> = {
  'PRO': 'professional',
  'TEAM': 'team',
  'ENT': 'enterprise',
  'SI': 'enterprise'  // Service Integrator - enterprise tier
};

/**
 * Features by tier
 */
const TIER_FEATURES: Record<EnterpriseTier, string[]> = {
  'community': [],
  'professional': ['jira-integration', 'azure-devops', 'confluence'],
  'team': ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging'],
  'enterprise': ['jira-integration', 'azure-devops', 'confluence', 'sso', 'audit-logging', 'advanced-ml', 'custom-integrations', 'priority-support']
};

/**
 * Validate enterprise license key
 */
export function validateLicenseKey(licenseKey: string): EnterpriseLicense | null {
  try {
    // Parse license key format: SNOW-[TIER]-[ORG-ID]-[EXPIRY]-[CHECKSUM]
    const parts = licenseKey.split('-');

    if (parts.length !== 5 || parts[0] !== 'SNOW') {
      console.warn('[Enterprise] Invalid license key format');
      return null;
    }

    const [, tierCode, orgId, expiryDate, checksum] = parts;

    // Validate tier code
    const tier = TIER_CODES[tierCode.toUpperCase()];
    if (!tier) {
      console.warn('[Enterprise] Invalid tier code:', tierCode);
      return null;
    }

    // Parse expiry date (YYYYMMDD)
    const year = parseInt(expiryDate.substring(0, 4));
    const month = parseInt(expiryDate.substring(4, 6)) - 1;
    const day = parseInt(expiryDate.substring(6, 8));
    const expiresAt = new Date(year, month, day);

    // Check if expired
    if (expiresAt < new Date()) {
      console.warn('[Enterprise] License expired:', expiresAt.toISOString());
      return null;
    }

    // Validate checksum (simplified - in production use proper HMAC)
    const expectedChecksum = generateChecksum(tierCode, orgId, expiryDate);
    if (checksum !== expectedChecksum) {
      console.warn('[Enterprise] Invalid license checksum');
      // In development, allow invalid checksums with warning
      if (process.env.NODE_ENV === 'production') {
        return null;
      }
    }

    // Get company config if available
    const companyId = orgId.toLowerCase();
    const companyConfig = COMPANY_CONFIGS[companyId];

    // Build enterprise license
    const license: EnterpriseLicense = {
      tier,
      company: companyConfig?.id || orgId.toLowerCase(),
      companyName: companyConfig?.name || orgId,
      licenseKey,
      expiresAt,
      features: [
        ...TIER_FEATURES[tier],
        ...(companyConfig?.features || [])
      ],
      theme: companyConfig?.theme || 'servicenow' // Default to ServiceNow theme
    };

    console.log('[Enterprise] Valid license:', {
      tier: license.tier,
      company: license.companyName,
      expiresAt: license.expiresAt,
      features: license.features.length
    });

    return license;

  } catch (error: any) {
    console.error('[Enterprise] License validation error:', error.message);
    return null;
  }
}

/**
 * Generate checksum for license validation
 * (Simplified version - production should use HMAC-SHA256 with secret key)
 */
function generateChecksum(tierCode: string, orgId: string, expiryDate: string): string {
  const data = `${tierCode}${orgId}${expiryDate}`;
  const hash = crypto.createHash('md5').update(data).digest('hex');
  return hash.substring(0, 8).toUpperCase();
}

/**
 * Get community (free) license
 */
export function getCommunityLicense(): EnterpriseLicense {
  return {
    tier: 'community',
    features: [],
    theme: 'servicenow'
  };
}

/**
 * Load license from environment variable
 */
export function loadLicenseFromEnv(): EnterpriseLicense {
  const licenseKey = process.env.SNOW_FLOW_LICENSE_KEY;

  if (!licenseKey) {
    console.log('[Enterprise] No license key found, using community tier');
    return getCommunityLicense();
  }

  const license = validateLicenseKey(licenseKey);

  if (!license) {
    console.warn('[Enterprise] Invalid license key, falling back to community tier');
    return getCommunityLicense();
  }

  return license;
}

/**
 * Check if feature is available for license
 */
export function hasFeature(license: EnterpriseLicense, feature: string): boolean {
  return license.features.includes(feature);
}

/**
 * Get theme name for license
 */
export function getThemeName(license: EnterpriseLicense): string {
  return license.theme || 'servicenow';
}

/**
 * Generate sample license keys for testing
 */
export function generateSampleLicenseKey(tier: 'PRO' | 'TEAM' | 'ENT', company: string, daysValid: number = 365): string {
  const tierCode = tier;
  const orgId = company.toUpperCase();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysValid);
  const expiryStr = expiryDate.toISOString().split('T')[0].replace(/-/g, '');
  const checksum = generateChecksum(tierCode, orgId, expiryStr);

  return `SNOW-${tierCode}-${orgId}-${expiryStr}-${checksum}`;
}

/**
 * Get company list with themes
 */
export function getCompanyList(): CompanyConfig[] {
  return Object.values(COMPANY_CONFIGS);
}
