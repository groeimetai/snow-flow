/**
 * Partner License Key Parser
 *
 * Handles parsing and validation of partner license keys for both tracks:
 *
 * Reseller Format: SNOW-RESELLER-[ORG]-[SEATS]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-RESELLER-ACME-100-20261231-ABC123
 *
 * Solution Format: SNOW-SOLUTION-[ORG]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-SOLUTION-ACME-20261231-ABC123
 */

import { PartnerType } from './types.js';

export interface ParsedPartnerLicense {
  // Core
  tier: 'PARTNER';
  partnerType: PartnerType;
  organization: string;

  // Type-specific
  purchasedSeats?: number;      // For RESELLER only
  referralCode?: string;        // For SOLUTION only

  // Common
  expiresAt: Date;
  checksum: string;
  rawKey: string;
}

/**
 * Parse a partner license key
 *
 * Automatically detects type (RESELLER or SOLUTION) and parses accordingly
 *
 * @param licenseKey The license key to parse
 * @returns Parsed partner license object
 * @throws Error if license format is invalid
 */
export function parsePartnerLicenseKey(licenseKey: string): ParsedPartnerLicense {
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new Error('License key is required');
  }

  const parts = licenseKey.split('-');

  // Validate basic format: SNOW-[TYPE]-...
  if (parts.length < 4 || parts[0] !== 'SNOW') {
    throw new Error('Invalid partner license key format: must start with SNOW-');
  }

  const typeStr = parts[1];

  // Route to appropriate parser
  if (typeStr === 'RESELLER') {
    return parseResellerLicense(parts, licenseKey);
  } else if (typeStr === 'SOLUTION') {
    return parseSolutionLicense(parts, licenseKey);
  } else {
    throw new Error(`Invalid partner type: ${typeStr}. Must be RESELLER or SOLUTION`);
  }
}

/**
 * Parse RESELLER license
 * Format: SNOW-RESELLER-ORG-SEATS-EXPIRY-CHECKSUM
 */
function parseResellerLicense(parts: string[], rawKey: string): ParsedPartnerLicense {
  if (parts.length !== 6) {
    throw new Error('Invalid RESELLER license format: expected SNOW-RESELLER-ORG-SEATS-EXPIRY-CHECKSUM');
  }

  const organization = parts[2];
  const seatsStr = parts[3];
  const expiryStr = parts[4];
  const checksum = parts[5];

  // Parse seats
  const purchasedSeats = parseInt(seatsStr, 10);
  if (isNaN(purchasedSeats) || purchasedSeats < 25) {
    throw new Error('Invalid purchased seats: RESELLER license requires minimum 25 seats');
  }

  // Parse expiry date
  const expiresAt = parseExpiryDate(expiryStr);

  return {
    tier: 'PARTNER',
    partnerType: PartnerType.RESELLER,
    organization,
    purchasedSeats,
    expiresAt,
    checksum,
    rawKey
  };
}

/**
 * Parse SOLUTION license
 * Format: SNOW-SOLUTION-ORG-EXPIRY-CHECKSUM
 */
function parseSolutionLicense(parts: string[], rawKey: string): ParsedPartnerLicense {
  if (parts.length !== 5) {
    throw new Error('Invalid SOLUTION license format: expected SNOW-SOLUTION-ORG-EXPIRY-CHECKSUM');
  }

  const organization = parts[2];
  const expiryStr = parts[3];
  const checksum = parts[4];

  // Parse expiry date
  const expiresAt = parseExpiryDate(expiryStr);

  // Generate referral code from organization
  const referralCode = `SOLUTION-${organization.toUpperCase()}`;

  return {
    tier: 'PARTNER',
    partnerType: PartnerType.SOLUTION,
    organization,
    referralCode,
    expiresAt,
    checksum,
    rawKey
  };
}

/**
 * Parse expiry date from YYYYMMDD format
 */
function parseExpiryDate(expiryStr: string): Date {
  if (!/^\d{8}$/.test(expiryStr)) {
    throw new Error('Invalid expiry date format: expected YYYYMMDD');
  }

  const year = parseInt(expiryStr.substring(0, 4), 10);
  const month = parseInt(expiryStr.substring(4, 6), 10);
  const day = parseInt(expiryStr.substring(6, 8), 10);

  if (year < 2020 || year > 2100) {
    throw new Error('Invalid year in expiry date');
  }

  if (month < 1 || month > 12) {
    throw new Error('Invalid month in expiry date');
  }

  if (day < 1 || day > 31) {
    throw new Error('Invalid day in expiry date');
  }

  // Create date at end of day (23:59:59) for expiry
  const date = new Date(year, month - 1, day, 23, 59, 59);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid expiry date');
  }

  return date;
}

/**
 * Generate a RESELLER partner license key
 */
export function generateResellerLicenseKey(
  organization: string,
  seats: number,
  expiryDate: Date
): string {
  if (seats < 25) {
    throw new Error('RESELLER license requires minimum 25 seats');
  }

  const expiry = formatExpiryDate(expiryDate);
  const checksum = generateChecksum(organization, expiry, seats.toString());

  return `SNOW-RESELLER-${organization.toUpperCase()}-${seats}-${expiry}-${checksum}`;
}

/**
 * Generate a SOLUTION partner license key
 */
export function generateSolutionLicenseKey(
  organization: string,
  expiryDate: Date
): string {
  const expiry = formatExpiryDate(expiryDate);
  const checksum = generateChecksum(organization, expiry);

  return `SNOW-SOLUTION-${organization.toUpperCase()}-${expiry}-${checksum}`;
}

/**
 * Format date to YYYYMMDD
 */
function formatExpiryDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Generate checksum (simple implementation - should be cryptographically secure in production)
 */
function generateChecksum(organization: string, expiry: string, seats?: string): string {
  // Simple checksum for now - in production, use HMAC-SHA256 or similar
  const input = `${organization}-${expiry}${seats ? '-' + seats : ''}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).toUpperCase().substring(0, 6);
}

/**
 * Validate partner license key
 */
export function validatePartnerLicense(parsedLicense: ParsedPartnerLicense): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check expiry
  if (parsedLicense.expiresAt < new Date()) {
    errors.push('License has expired');
  }

  // Type-specific validation
  if (parsedLicense.partnerType === PartnerType.RESELLER) {
    if (!parsedLicense.purchasedSeats || parsedLicense.purchasedSeats < 25) {
      errors.push('RESELLER license must have at least 25 purchased seats');
    }
  }

  if (parsedLicense.partnerType === PartnerType.SOLUTION) {
    if (!parsedLicense.referralCode) {
      errors.push('SOLUTION license must have a referral code');
    }
  }

  // Organization name validation
  if (!parsedLicense.organization || parsedLicense.organization.length < 2) {
    errors.push('Invalid organization name');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get human-readable partner license info
 */
export function formatPartnerLicenseInfo(parsedLicense: ParsedPartnerLicense): string {
  const lines: string[] = [];

  if (parsedLicense.partnerType === PartnerType.RESELLER) {
    lines.push(`Partner Type: RESELLER`);
    lines.push(`Organization: ${parsedLicense.organization}`);
    lines.push(`Purchased Seats: ${parsedLicense.purchasedSeats}`);

    // Calculate wholesale cost with volume discount
    const seats = parsedLicense.purchasedSeats!;
    let pricePerSeat = 69;
    if (seats >= 500) pricePerSeat = 49;
    else if (seats >= 100) pricePerSeat = 59;

    lines.push(`Wholesale Price: $${pricePerSeat}/seat ($${pricePerSeat * seats}/year total)`);
    lines.push(`Suggested Retail: $99/seat ($${99 * seats}/year total)`);
    lines.push(`Potential Margin: $${(99 - pricePerSeat) * seats}/year (${Math.round(((99 - pricePerSeat) / 99) * 100)}%)`);
  } else {
    lines.push(`Partner Type: SOLUTION`);
    lines.push(`Organization: ${parsedLicense.organization}`);
    lines.push(`Referral Code: ${parsedLicense.referralCode}`);
    lines.push(`Commission: 15% Year 1, 10% Year 2+`);
  }

  lines.push(`Expires: ${parsedLicense.expiresAt.toLocaleDateString()}`);

  const daysUntilExpiry = Math.floor(
    (parsedLicense.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  if (daysUntilExpiry < 0) {
    lines.push(`Status: EXPIRED (${Math.abs(daysUntilExpiry)} days ago)`);
  } else if (daysUntilExpiry < 30) {
    lines.push(`Status: ACTIVE (expires in ${daysUntilExpiry} days) ⚠️`);
  } else {
    lines.push(`Status: ACTIVE (${daysUntilExpiry} days remaining)`);
  }

  return lines.join('\n');
}
