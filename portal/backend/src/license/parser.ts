/**
 * License Parser for Snow-Flow Enterprise
 * Version: 2.0.0
 *
 * Supports two license formats:
 * 1. NEW (v2.0.0): SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]
 *    Example: SNOW-ENT-CAPGEMINI-5/1-20261231-A3F2E9C1
 *    - 5 developer seats, 1 stakeholder seat
 *
 * 2. LEGACY: SNOW-[TIER]-[ORG]-[EXPIRY]-[CHECKSUM]
 *    Example: SNOW-ENT-ACME-20261231-ABC123
 *    - Unlimited seats (backward compatibility)
 */

import { createHash } from 'crypto';

export interface ParsedLicense {
  tier: string;                    // ENT, TEAM, PROFESSIONAL
  organization: string;            // Customer organization name
  developerSeats: number;          // Number of developer seats (-1 = unlimited)
  stakeholderSeats: number;        // Number of stakeholder seats (-1 = unlimited)
  expiresAt: Date;                 // Expiration date
  checksum: string;                // License checksum
  isLegacyFormat: boolean;         // True if old format (no seats)
  originalKey: string;             // Original license key (for reference)
}

/**
 * Custom error class for license parsing errors
 */
export class LicenseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LicenseParseError';
    Object.setPrototypeOf(this, LicenseParseError.prototype);
  }
}

/**
 * Parse a Snow-Flow license key
 *
 * @param licenseKey The license key to parse
 * @returns Parsed license object
 * @throws LicenseParseError if the license key is invalid
 */
export function parseLicenseKey(licenseKey: string): ParsedLicense {
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new LicenseParseError('License key is required');
  }

  // Trim whitespace
  const cleanKey = licenseKey.trim();

  // Split by dash
  const parts = cleanKey.split('-');

  // Validate basic format: SNOW-TIER-ORG-...
  if (parts.length < 4 || parts[0] !== 'SNOW') {
    throw new LicenseParseError('Invalid license key format: must start with SNOW-');
  }

  const tier = parts[1];
  const organization = parts[2];

  // Validate tier
  const validTiers = ['TEAM', 'PRO', 'PROFESSIONAL', 'ENT', 'ENTERPRISE'];
  if (!validTiers.includes(tier.toUpperCase())) {
    throw new LicenseParseError(`Invalid tier: ${tier}. Must be one of: ${validTiers.join(', ')}`);
  }

  // Determine format by checking if part[3] contains a slash (seats format)
  const hasSeats = parts[3].includes('/');

  if (hasSeats) {
    // New format: SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM
    return parseNewFormat(cleanKey, parts, tier, organization);
  } else {
    // Legacy format: SNOW-TIER-ORG-EXPIRY-CHECKSUM
    return parseLegacyFormat(cleanKey, parts, tier, organization);
  }
}

/**
 * Parse new seat-based format
 * Format: SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM
 */
function parseNewFormat(
  originalKey: string,
  parts: string[],
  tier: string,
  organization: string
): ParsedLicense {
  if (parts.length !== 6) {
    throw new LicenseParseError(
      `Invalid new format: expected 6 parts (SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM), got ${parts.length}`
    );
  }

  const seatsStr = parts[3];
  const expiryStr = parts[4];
  const checksum = parts[5];

  // Parse seats (e.g., "10/5")
  const seatsParts = seatsStr.split('/');
  if (seatsParts.length !== 2) {
    throw new LicenseParseError('Invalid seats format: expected DEV/STAKEHOLDER (e.g., 10/5)');
  }

  const developerSeats = parseInt(seatsParts[0], 10);
  const stakeholderSeats = parseInt(seatsParts[1], 10);

  if (isNaN(developerSeats) || isNaN(stakeholderSeats)) {
    throw new LicenseParseError('Invalid seats: must be numbers');
  }

  if (developerSeats < 0 || stakeholderSeats < 0) {
    throw new LicenseParseError('Invalid seats: must be non-negative');
  }

  // Special case: 0 means unlimited (represented as -1 internally)
  const finalDevSeats = developerSeats === 0 ? -1 : developerSeats;
  const finalStakeholderSeats = stakeholderSeats === 0 ? -1 : stakeholderSeats;

  // Parse expiry date (YYYYMMDD)
  const expiresAt = parseExpiryDate(expiryStr);

  // Validate checksum
  if (!validateChecksum(originalKey, checksum)) {
    throw new LicenseParseError('Invalid checksum: license key may be tampered with');
  }

  return {
    tier,
    organization,
    developerSeats: finalDevSeats,
    stakeholderSeats: finalStakeholderSeats,
    expiresAt,
    checksum,
    isLegacyFormat: false,
    originalKey
  };
}

/**
 * Parse legacy unlimited format
 * Format: SNOW-TIER-ORG-EXPIRY-CHECKSUM
 */
function parseLegacyFormat(
  originalKey: string,
  parts: string[],
  tier: string,
  organization: string
): ParsedLicense {
  if (parts.length !== 5) {
    throw new LicenseParseError(
      `Invalid legacy format: expected 5 parts (SNOW-TIER-ORG-EXPIRY-CHECKSUM), got ${parts.length}`
    );
  }

  const expiryStr = parts[3];
  const checksum = parts[4];

  // Parse expiry date (YYYYMMDD)
  const expiresAt = parseExpiryDate(expiryStr);

  // Validate checksum
  if (!validateChecksum(originalKey, checksum)) {
    throw new LicenseParseError('Invalid checksum: license key may be tampered with');
  }

  // Legacy licenses have unlimited seats (represented as -1)
  return {
    tier,
    organization,
    developerSeats: -1,
    stakeholderSeats: -1,
    expiresAt,
    checksum,
    isLegacyFormat: true,
    originalKey
  };
}

/**
 * Parse expiry date from YYYYMMDD format
 *
 * @param expiryStr Date string in YYYYMMDD format
 * @returns Date object set to end of day (23:59:59)
 */
function parseExpiryDate(expiryStr: string): Date {
  if (!/^\d{8}$/.test(expiryStr)) {
    throw new LicenseParseError('Invalid expiry date format: expected YYYYMMDD (e.g., 20261231)');
  }

  const year = parseInt(expiryStr.substring(0, 4), 10);
  const month = parseInt(expiryStr.substring(4, 6), 10);
  const day = parseInt(expiryStr.substring(6, 8), 10);

  // Validate ranges
  if (year < 2020 || year > 2100) {
    throw new LicenseParseError(`Invalid year in expiry date: ${year} (must be 2020-2100)`);
  }

  if (month < 1 || month > 12) {
    throw new LicenseParseError(`Invalid month in expiry date: ${month} (must be 1-12)`);
  }

  if (day < 1 || day > 31) {
    throw new LicenseParseError(`Invalid day in expiry date: ${day} (must be 1-31)`);
  }

  // Create date at end of day (23:59:59) for expiry
  // Note: month is 0-indexed in JavaScript Date constructor
  const date = new Date(year, month - 1, day, 23, 59, 59);

  if (isNaN(date.getTime())) {
    throw new LicenseParseError(`Invalid expiry date: ${expiryStr} (not a valid calendar date)`);
  }

  return date;
}

/**
 * Check if license is expired
 *
 * @param parsedLicense Parsed license object
 * @returns True if the license has expired
 */
export function isLicenseExpired(parsedLicense: ParsedLicense): boolean {
  return parsedLicense.expiresAt < new Date();
}

/**
 * Get days until expiry (negative if expired)
 *
 * @param parsedLicense Parsed license object
 * @returns Number of days until expiry (negative if already expired)
 */
export function getDaysUntilExpiry(parsedLicense: ParsedLicense): number {
  const now = new Date();
  const diff = parsedLicense.expiresAt.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format seats for display
 *
 * @param seats Number of seats or -1 for unlimited
 * @returns Formatted string ("Unlimited" or number)
 */
export function formatSeats(seats: number): string {
  if (seats === -1) {
    return 'Unlimited';
  }
  return seats.toString();
}

/**
 * Get seat availability status
 *
 * @param total Total seats available (-1 = unlimited)
 * @param active Currently active seats
 * @returns Object with availability info
 */
export function getSeatAvailability(total: number, active: number): {
  total: number;
  active: number;
  available: number;
  usagePercent: number;
  isUnlimited: boolean;
  isAtCapacity: boolean;
} {
  const isUnlimited = total === -1;

  if (isUnlimited) {
    return {
      total: -1,
      active,
      available: -1,
      usagePercent: 0,
      isUnlimited: true,
      isAtCapacity: false
    };
  }

  const available = Math.max(0, total - active);
  const usagePercent = total > 0 ? Math.round((active / total) * 100) : 0;
  const isAtCapacity = active >= total;

  return {
    total,
    active,
    available,
    usagePercent,
    isUnlimited: false,
    isAtCapacity
  };
}

/**
 * Validate checksum against license key
 *
 * @param licenseKey Full license key including checksum
 * @param providedChecksum Checksum from license
 * @returns True if checksum is valid
 */
export function validateChecksum(licenseKey: string, providedChecksum: string): boolean {
  if (!providedChecksum || providedChecksum.length !== 8) {
    return false;
  }

  // Extract base key (everything before the last dash)
  const lastDashIndex = licenseKey.lastIndexOf('-');
  if (lastDashIndex === -1) {
    return false;
  }

  const baseKey = licenseKey.substring(0, lastDashIndex);

  // Calculate expected checksum
  const hash = createHash('sha256');
  hash.update(baseKey);
  hash.update(process.env.LICENSE_SECRET || 'snow-flow-enterprise-2025');
  const expectedChecksum = hash.digest('hex').substring(0, 8).toUpperCase();

  return providedChecksum.toUpperCase() === expectedChecksum;
}
