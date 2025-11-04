/**
 * License Generator for Snow-Flow Enterprise
 * Version: 2.0.0
 *
 * Generates license keys in the new seat-based format:
 * SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]
 *
 * Example: SNOW-ENT-ACME-10/5-20261231-A3F2E9C1
 */

import { createHash } from 'crypto';

export interface LicenseGeneratorOptions {
  tier: 'TEAM' | 'PRO' | 'PROFESSIONAL' | 'ENT' | 'ENTERPRISE';
  organization: string;
  developerSeats: number;
  stakeholderSeats: number;
  expiresAt: Date;
}

/**
 * Generate a Snow-Flow license key
 *
 * @param options License generation options
 * @returns Formatted license key
 */
export function generateLicenseKey(options: LicenseGeneratorOptions): string {
  const {
    tier,
    organization,
    developerSeats,
    stakeholderSeats,
    expiresAt
  } = options;

  // Validate inputs
  validateGeneratorOptions(options);

  // Normalize organization name (uppercase, remove spaces and special chars)
  const normalizedOrg = normalizeOrganizationName(organization);

  // Format expiry date as YYYYMMDD
  const expiryStr = formatExpiryDate(expiresAt);

  // Format seats (use actual numbers, not -1 for unlimited)
  const devSeats = developerSeats === -1 ? 0 : developerSeats;
  const stakeholderSeats_ = stakeholderSeats === -1 ? 0 : stakeholderSeats;
  const seatsStr = `${devSeats}/${stakeholderSeats_}`;

  // Generate checksum
  const baseKey = `SNOW-${tier}-${normalizedOrg}-${seatsStr}-${expiryStr}`;
  const checksum = generateChecksum(baseKey);

  // Assemble final license key
  return `${baseKey}-${checksum}`;
}

/**
 * Generate a legacy format license key (unlimited seats)
 *
 * @param tier License tier
 * @param organization Organization name
 * @param expiresAt Expiration date
 * @returns Formatted legacy license key
 */
export function generateLegacyLicenseKey(
  tier: 'TEAM' | 'PRO' | 'PROFESSIONAL' | 'ENT' | 'ENTERPRISE',
  organization: string,
  expiresAt: Date
): string {
  const normalizedOrg = normalizeOrganizationName(organization);
  const expiryStr = formatExpiryDate(expiresAt);
  const baseKey = `SNOW-${tier}-${normalizedOrg}-${expiryStr}`;
  const checksum = generateChecksum(baseKey);

  return `${baseKey}-${checksum}`;
}

/**
 * Validate license generator options
 */
function validateGeneratorOptions(options: LicenseGeneratorOptions): void {
  const { tier, organization, developerSeats, stakeholderSeats, expiresAt } = options;

  // Validate tier
  const validTiers = ['TEAM', 'PRO', 'PROFESSIONAL', 'ENT', 'ENTERPRISE'];
  if (!validTiers.includes(tier)) {
    throw new Error(`Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}`);
  }

  // Validate organization
  if (!organization || typeof organization !== 'string' || organization.trim().length === 0) {
    throw new Error('Organization name is required');
  }

  if (organization.length > 50) {
    throw new Error('Organization name too long (max 50 characters)');
  }

  // Validate seats
  if (typeof developerSeats !== 'number' || (developerSeats < -1)) {
    throw new Error('Developer seats must be a non-negative number or -1 for unlimited');
  }

  if (typeof stakeholderSeats !== 'number' || (stakeholderSeats < -1)) {
    throw new Error('Stakeholder seats must be a non-negative number or -1 for unlimited');
  }

  // Validate expiry date
  if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime())) {
    throw new Error('Invalid expiry date');
  }

  // Check that expiry is in the future
  if (expiresAt < new Date()) {
    throw new Error('Expiry date must be in the future');
  }

  // Check reasonable expiry range
  const maxYears = 10;
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + maxYears);
  if (expiresAt > maxDate) {
    throw new Error(`Expiry date cannot be more than ${maxYears} years in the future`);
  }
}

/**
 * Normalize organization name for license key
 * - Convert to uppercase
 * - Remove spaces, special characters
 * - Limit to alphanumeric only
 */
function normalizeOrganizationName(organization: string): string {
  return organization
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 20); // Max 20 characters for readability
}

/**
 * Format date as YYYYMMDD
 */
function formatExpiryDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generate checksum for license key using SHA-256
 * Takes first 8 characters of hash in uppercase hex
 */
function generateChecksum(baseKey: string): string {
  const hash = createHash('sha256');
  hash.update(baseKey);
  hash.update(process.env.LICENSE_SECRET || 'snow-flow-enterprise-2025'); // Salt with secret
  return hash.digest('hex').substring(0, 8).toUpperCase();
}

/**
 * Helper: Create expiry date from YYYYMMDD string
 */
export function createExpiryDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 23, 59, 59);
}

/**
 * Helper: Create expiry date N years from now
 */
export function createExpiryDateFromNow(years: number): Date {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Helper: Create expiry date N months from now
 */
export function createExpiryDateMonthsFromNow(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Example usage:
 *
 * // Generate a 1-year license for Acme Corp with 10 dev seats and 5 stakeholder seats
 * const licenseKey = generateLicenseKey({
 *   tier: 'ENT',
 *   organization: 'Acme Corporation',
 *   developerSeats: 10,
 *   stakeholderSeats: 5,
 *   expiresAt: createExpiryDateFromNow(1)
 * });
 * // Result: SNOW-ENT-ACMECORPORATION-10/5-20261231-A3F2E9C1
 *
 * // Generate unlimited legacy license
 * const legacyKey = generateLegacyLicenseKey(
 *   'ENT',
 *   'Acme Corporation',
 *   createExpiryDateFromNow(1)
 * );
 * // Result: SNOW-ENT-ACMECORPORATION-20261231-B4A1C3D2
 */
