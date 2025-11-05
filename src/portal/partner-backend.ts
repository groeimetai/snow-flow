/**
 * Partner Portal Backend
 *
 * Handles partner authentication, authorization, and data access for the Snow-Flow Partner Portal
 * Supports both Reseller and Solution partner tracks
 */

import { parsePartnerLicenseKey, validatePartnerLicense, type ParsedPartnerLicense } from '../partners/license-parser.js';
import { PartnerType, PARTNER_PRICING } from '../partners/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PARTNER_SESSION_DIR = path.join(os.homedir(), '.snow-flow', 'partner-sessions');

export interface PartnerSession {
  partnerId: string;
  partnerName: string;
  partnerType: PartnerType;
  licenseKey: string;
  parsedLicense: ParsedPartnerLicense;
  authenticatedAt: Date;
  expiresAt: Date;
  sessionToken: string;
}

export interface PartnerDashboardData {
  partnerInfo: {
    name: string;
    type: PartnerType;
    tier: string;
    status: 'active' | 'expired' | 'expiring_soon';
    expiresAt: Date;
    daysUntilExpiry: number;
  };
  resellerData?: {
    purchasedSeats: number;
    allocatedSeats: number;
    availableSeats: number;
    wholesalePrice: number;
    totalCost: number;
    suggestedRetail: number;
    potentialMargin: number;
    whitelabelEnabled: boolean;
  };
  solutionData?: {
    referralCode: string;
    commissionRates: {
      year1: number;
      year2Plus: number;
    };
    totalReferrals: number;
    activeReferrals: number;
    monthlyRecurringCommission: number;
    lifetimeCommissions: number;
  };
}

export class PartnerPortalBackend {

  /**
   * Authenticate partner with license key
   */
  static async authenticatePartner(licenseKey: string): Promise<{
    success: boolean;
    session?: PartnerSession;
    error?: string;
  }> {
    try {
      // Parse license key
      const parsedLicense = parsePartnerLicenseKey(licenseKey);

      // Validate license
      const validation = validatePartnerLicense(parsedLicense);
      if (!validation.isValid) {
        return {
          success: false,
          error: `License validation failed: ${validation.errors.join(', ')}`
        };
      }

      // Generate partner ID
      const partnerId = `${parsedLicense.partnerType}_${parsedLicense.organization.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Create session
      const session: PartnerSession = {
        partnerId,
        partnerName: parsedLicense.organization,
        partnerType: parsedLicense.partnerType,
        licenseKey,
        parsedLicense,
        authenticatedAt: new Date(),
        expiresAt: parsedLicense.expiresAt,
        sessionToken: this.generateSessionToken()
      };

      // Store session
      await this.storeSession(session);

      return {
        success: true,
        session
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  /**
   * Get partner dashboard data
   */
  static async getDashboardData(sessionToken: string): Promise<{
    success: boolean;
    data?: PartnerDashboardData;
    error?: string;
  }> {
    try {
      // Retrieve session
      const session = await this.getSession(sessionToken);
      if (!session) {
        return {
          success: false,
          error: 'Invalid or expired session'
        };
      }

      // Re-validate license
      const validation = validatePartnerLicense(session.parsedLicense);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Partner license has expired or is invalid'
        };
      }

      // Calculate days until expiry
      const daysUntilExpiry = Math.floor(
        (session.parsedLicense.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Determine status
      let status: 'active' | 'expired' | 'expiring_soon' = 'active';
      if (daysUntilExpiry < 0) {
        status = 'expired';
      } else if (daysUntilExpiry < 30) {
        status = 'expiring_soon';
      }

      // Build dashboard data
      const dashboardData: PartnerDashboardData = {
        partnerInfo: {
          name: session.partnerName,
          type: session.partnerType,
          tier: this.calculateTier(session.partnerType),
          status,
          expiresAt: session.parsedLicense.expiresAt,
          daysUntilExpiry
        }
      };

      // Add type-specific data
      if (session.partnerType === PartnerType.RESELLER) {
        dashboardData.resellerData = this.getResellerData(session.parsedLicense);
      } else if (session.partnerType === PartnerType.SOLUTION) {
        dashboardData.solutionData = this.getSolutionData(session.parsedLicense);
      }

      return {
        success: true,
        data: dashboardData
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve dashboard data'
      };
    }
  }

  /**
   * Get Reseller partner-specific data
   */
  private static getResellerData(license: ParsedPartnerLicense): PartnerDashboardData['resellerData'] {
    const seats = license.purchasedSeats || 0;

    // Calculate wholesale price based on volume tiers
    let wholesalePrice = 69;
    if (seats >= 500) wholesalePrice = 49;
    else if (seats >= 100) wholesalePrice = 59;

    const totalCost = wholesalePrice * seats;
    const suggestedRetail = 99;
    const potentialMargin = (suggestedRetail - wholesalePrice) * seats;

    return {
      purchasedSeats: seats,
      allocatedSeats: 0, // TODO: Track actual allocation
      availableSeats: seats, // TODO: Calculate from allocation
      wholesalePrice,
      totalCost,
      suggestedRetail,
      potentialMargin,
      whitelabelEnabled: false // TODO: Track white-label subscription
    };
  }

  /**
   * Get Solution partner-specific data
   */
  private static getSolutionData(license: ParsedPartnerLicense): PartnerDashboardData['solutionData'] {
    return {
      referralCode: license.referralCode || `SOLUTION-${license.organization.toUpperCase()}`,
      commissionRates: {
        year1: PARTNER_PRICING.solution.year1Commission,
        year2Plus: PARTNER_PRICING.solution.year2PlusCommission
      },
      totalReferrals: 0, // TODO: Fetch from database
      activeReferrals: 0, // TODO: Fetch from database
      monthlyRecurringCommission: 0, // TODO: Calculate from referrals
      lifetimeCommissions: 0 // TODO: Fetch from payment records
    };
  }

  /**
   * Calculate partner tier (placeholder - should be based on actual metrics)
   */
  private static calculateTier(partnerType: PartnerType): string {
    // TODO: Calculate based on actual customer count
    return 'Certified'; // Default tier
  }

  /**
   * Generate secure session token
   */
  private static generateSessionToken(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `PARTNER_SESSION_${timestamp}_${randomPart}${randomPart2}`;
  }

  /**
   * Store partner session
   */
  private static async storeSession(session: PartnerSession): Promise<void> {
    // Ensure session directory exists
    if (!fs.existsSync(PARTNER_SESSION_DIR)) {
      fs.mkdirSync(PARTNER_SESSION_DIR, { recursive: true });
    }

    // Write session file
    const sessionFile = path.join(PARTNER_SESSION_DIR, `${session.sessionToken}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify({
      ...session,
      authenticatedAt: session.authenticatedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString()
    }, null, 2));
  }

  /**
   * Retrieve partner session
   */
  private static async getSession(sessionToken: string): Promise<PartnerSession | null> {
    try {
      const sessionFile = path.join(PARTNER_SESSION_DIR, `${sessionToken}.json`);

      if (!fs.existsSync(sessionFile)) {
        return null;
      }

      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));

      // Parse dates back from ISO strings
      return {
        ...sessionData,
        authenticatedAt: new Date(sessionData.authenticatedAt),
        expiresAt: new Date(sessionData.expiresAt),
        parsedLicense: {
          ...sessionData.parsedLicense,
          expiresAt: new Date(sessionData.parsedLicense.expiresAt)
        }
      };

    } catch (error) {
      return null;
    }
  }

  /**
   * Logout partner (delete session)
   */
  static async logoutPartner(sessionToken: string): Promise<{ success: boolean }> {
    try {
      const sessionFile = path.join(PARTNER_SESSION_DIR, `${sessionToken}.json`);

      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  /**
   * Validate session token
   */
  static async validateSession(sessionToken: string): Promise<{
    valid: boolean;
    partnerId?: string;
    partnerType?: PartnerType;
  }> {
    const session = await this.getSession(sessionToken);

    if (!session) {
      return { valid: false };
    }

    // Check if license is still valid
    const validation = validatePartnerLicense(session.parsedLicense);

    return {
      valid: validation.isValid,
      partnerId: session.partnerId,
      partnerType: session.partnerType
    };
  }
}
