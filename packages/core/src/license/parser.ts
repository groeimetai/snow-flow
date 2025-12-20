/**
 * License Parser for Snow-Flow Enterprise
 * Supports both legacy and new seat-based license formats
 */

export interface ParsedLicense {
  tier: string;                    // ENT, TEAM, etc.
  organization: string;            // Customer organization name
  developerSeats: number;          // Number of developer seats (or Infinity for legacy)
  stakeholderSeats: number;        // Number of stakeholder seats (or Infinity for legacy)
  expiresAt: Date;                 // Expiration date
  checksum: string;                // License checksum
  isLegacyFormat: boolean;         // True if old format (no seats)
}

/**
 * Parse a Snow-Flow license key
 *
 * Formats supported:
 * - New: SNOW-[TIER]-[ORG]-[DEV_SEATS]/[STAKEHOLDER_SEATS]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-ENT-COMPANY-10/5-20261231-ABC123DEF
 *
 * - Legacy: SNOW-[TIER]-[ORG]-[EXPIRY]-[CHECKSUM]
 *   Example: SNOW-ENT-ACME-20261231-ABC123
 *
 * @param licenseKey The license key to parse
 * @returns Parsed license object
 * @throws Error if license format is invalid
 */
export function parseLicenseKey(licenseKey: string): ParsedLicense {
  if (!licenseKey || typeof licenseKey !== 'string') {
    throw new Error('License key is required');
  }

  const parts = licenseKey.split('-');

  // Validate basic format: SNOW-TIER-ORG-...
  if (parts.length < 4 || parts[0] !== 'SNOW') {
    throw new Error('Invalid license key format: must start with SNOW-');
  }

  const tier = parts[1];
  const organization = parts[2];

  // Determine format by checking if part[3] contains a slash (seats format)
  const hasSeats = parts[3].includes('/');

  if (hasSeats) {
    // New format: SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM
    if (parts.length !== 6) {
      throw new Error('Invalid license key format: expected SNOW-TIER-ORG-DEV/STAKEHOLDER-EXPIRY-CHECKSUM');
    }

    const seatsStr = parts[3];
    const expiryStr = parts[4];
    const checksum = parts[5];

    // Parse seats (e.g., "10/5")
    const seatsParts = seatsStr.split('/');
    if (seatsParts.length !== 2) {
      throw new Error('Invalid seats format: expected DEV/STAKEHOLDER');
    }

    const developerSeats = parseInt(seatsParts[0], 10);
    const stakeholderSeats = parseInt(seatsParts[1], 10);

    if (isNaN(developerSeats) || isNaN(stakeholderSeats)) {
      throw new Error('Invalid seats: must be numbers');
    }

    if (developerSeats < 0 || stakeholderSeats < 0) {
      throw new Error('Invalid seats: must be non-negative');
    }

    // Parse expiry date (YYYYMMDD)
    const expiresAt = parseExpiryDate(expiryStr);

    return {
      tier,
      organization,
      developerSeats,
      stakeholderSeats,
      expiresAt,
      checksum,
      isLegacyFormat: false
    };
  } else {
    // Legacy format: SNOW-TIER-ORG-EXPIRY-CHECKSUM
    if (parts.length !== 5) {
      throw new Error('Invalid license key format: expected SNOW-TIER-ORG-EXPIRY-CHECKSUM');
    }

    const expiryStr = parts[3];
    const checksum = parts[4];

    // Parse expiry date (YYYYMMDD)
    const expiresAt = parseExpiryDate(expiryStr);

    // Legacy licenses have unlimited seats
    return {
      tier,
      organization,
      developerSeats: Infinity,
      stakeholderSeats: Infinity,
      expiresAt,
      checksum,
      isLegacyFormat: true
    };
  }
}

/**
 * Parse expiry date from YYYYMMDD format
 * @param expiryStr Date string in YYYYMMDD format
 * @returns Date object
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
 * Format seats for display
 * @param seats Number of seats or Infinity
 * @returns Formatted string
 */
export function formatSeats(seats: number): string {
  if (!isFinite(seats)) {
    return 'Unlimited';
  }
  return seats.toString();
}

/**
 * Check if license is expired
 * @param parsedLicense Parsed license object
 * @returns True if expired
 */
export function isLicenseExpired(parsedLicense: ParsedLicense): boolean {
  return parsedLicense.expiresAt < new Date();
}

/**
 * Get days until expiry
 * @param parsedLicense Parsed license object
 * @returns Number of days until expiry (negative if expired)
 */
export function getDaysUntilExpiry(parsedLicense: ParsedLicense): number {
  const now = new Date();
  const diff = parsedLicense.expiresAt.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
