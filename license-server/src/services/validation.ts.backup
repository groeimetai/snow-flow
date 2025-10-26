/**
 * License Validation Service
 *
 * Handles license key validation, HMAC verification, and instance tracking.
 */

import { createHmac } from 'crypto';
import { LicenseDatabase, License } from '../database/schema.js';

export interface ValidationRequest {
  key: string;
  version: string;
  instanceId: string;
  timestamp: number;
  signature?: string;
}

export interface ValidationResponse {
  valid: boolean;
  tier?: 'Team' | 'Professional' | 'Enterprise';
  features?: string[];
  expiresAt?: number;
  maxInstances?: number;
  currentInstances?: number;
  error?: string;
  warnings?: string[];
}

export class ValidationService {
  constructor(private db: LicenseDatabase) {}

  /**
   * Validate license request
   */
  async validate(
    request: ValidationRequest,
    ipAddress?: string,
    hostname?: string
  ): Promise<ValidationResponse> {
    try {
      // Step 1: Validate request structure
      if (!request.key || !request.version || !request.instanceId) {
        return this.errorResponse('INVALID_REQUEST', 'Missing required fields');
      }

      // Step 2: Check timestamp (reject old requests to prevent replay attacks)
      const now = Date.now();
      const age = now - request.timestamp;
      if (age > 5 * 60 * 1000) {
        // 5 minutes
        return this.errorResponse('REQUEST_TOO_OLD', 'Request timestamp too old (max 5 minutes)');
      }
      if (age < -60 * 1000) {
        // 1 minute future tolerance
        return this.errorResponse('INVALID_TIMESTAMP', 'Request timestamp in the future');
      }

      // Step 3: Get license from database
      const license = this.db.getLicense(request.key);
      if (!license) {
        this.db.logValidation(0, request.instanceId, request.version, false, 'LICENSE_NOT_FOUND', ipAddress);
        return this.errorResponse('LICENSE_NOT_FOUND', 'License key not found');
      }

      // Step 4: Verify HMAC signature
      if (!this.verifySignature(request, license.key)) {
        this.db.logValidation(license.id, request.instanceId, request.version, false, 'INVALID_SIGNATURE', ipAddress);
        return this.errorResponse('INVALID_SIGNATURE', 'Invalid request signature');
      }

      // Step 5: Check license status
      if (license.status !== 'active') {
        this.db.logValidation(license.id, request.instanceId, request.version, false, `LICENSE_${license.status.toUpperCase()}`, ipAddress);
        return this.errorResponse(`LICENSE_${license.status.toUpperCase()}`, `License is ${license.status}`);
      }

      // Step 6: Check expiration
      if (license.expiresAt && license.expiresAt < now) {
        // Auto-expire license
        this.db.updateLicense(license.key, { status: 'expired' });
        this.db.logValidation(license.id, request.instanceId, request.version, false, 'LICENSE_EXPIRED', ipAddress);
        return this.errorResponse('LICENSE_EXPIRED', 'License has expired');
      }

      // Step 7: Check instance limit
      const instanceCount = this.db.getInstanceCount(license.id);
      const warnings: string[] = [];

      // If this is a new instance and we're at the limit
      const existingInstance = this.db.upsertInstance(
        license.id,
        request.instanceId,
        request.version,
        ipAddress,
        hostname
      );

      if (instanceCount >= license.maxInstances && existingInstance.createdAt === existingInstance.lastSeen) {
        // New instance exceeds limit
        this.db.logValidation(license.id, request.instanceId, request.version, false, 'INSTANCE_LIMIT_EXCEEDED', ipAddress);
        return this.errorResponse(
          'INSTANCE_LIMIT_EXCEEDED',
          `Maximum instance limit (${license.maxInstances}) exceeded`
        );
      }

      // Add warning if approaching limit
      if (instanceCount >= license.maxInstances * 0.8) {
        warnings.push(
          `Approaching instance limit: ${instanceCount}/${license.maxInstances} instances active`
        );
      }

      // Add expiration warning
      if (license.expiresAt) {
        const daysUntilExpiry = Math.floor((license.expiresAt - now) / (24 * 60 * 60 * 1000));
        if (daysUntilExpiry <= 30) {
          warnings.push(`License expires in ${daysUntilExpiry} days`);
        }
      }

      // Step 8: Parse features
      const features = JSON.parse(license.features) as string[];

      // Step 9: Log successful validation
      this.db.logValidation(license.id, request.instanceId, request.version, true, undefined, ipAddress);

      // Step 10: Return success response
      return {
        valid: true,
        tier: license.tier,
        features,
        expiresAt: license.expiresAt,
        maxInstances: license.maxInstances,
        currentInstances: instanceCount,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('Validation error:', error);
      return this.errorResponse('INTERNAL_ERROR', 'Internal validation error');
    }
  }

  /**
   * Verify HMAC signature
   */
  private verifySignature(request: ValidationRequest, licenseKey: string): boolean {
    if (!request.signature) {
      return false;
    }

    const data = `${request.key}:${request.version}:${request.instanceId}:${request.timestamp}`;
    const expectedSignature = createHmac('sha256', licenseKey)
      .update(data)
      .digest('hex');

    return request.signature === expectedSignature;
  }

  /**
   * Create error response
   */
  private errorResponse(code: string, message: string): ValidationResponse {
    return {
      valid: false,
      error: message
    };
  }

  /**
   * Get license statistics
   */
  async getStats(licenseKey: string): Promise<{
    license: License;
    instances: number;
    validations: { total: number; successful: number; failed: number };
  } | null> {
    const license = this.db.getLicense(licenseKey);
    if (!license) {
      return null;
    }

    const instances = this.db.getInstanceCount(license.id);
    const validations = this.db.getValidationStats(license.id, 30);

    return {
      license,
      instances,
      validations
    };
  }
}
