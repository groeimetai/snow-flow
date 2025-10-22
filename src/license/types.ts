/**
 * License Management Types
 *
 * Defines all types for license validation, management, and enforcement.
 */

export type LicenseTier = 'Team' | 'Professional' | 'Enterprise';
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'invalid';

export interface LicenseKey {
  key: string;
  company: string;
  tier: LicenseTier;
  features: string[];
  maxInstances: number;
  maxUsers?: number;
  expiryDate: Date;
  status: LicenseStatus;
  metadata?: Record<string, unknown>;
}

export interface LicenseValidationRequest {
  key: string;
  version: string;
  instanceId: string;
  timestamp: number;
  signature?: string; // HMAC signature for request verification
}

export interface LicenseValidationResponse {
  valid: boolean;
  company?: string;
  tier?: LicenseTier;
  features?: string[];
  expiryDate?: string;
  instancesActive?: number;
  maxInstances?: number;
  daysUntilExpiry?: number;
  error?: string;
  warnings?: string[];
}

export interface LicenseConfig {
  key?: string;
  server?: string;
  checkInterval?: number;
  gracePeriod?: number;
  retryAttempts?: number;
  timeout?: number;
}

export interface ValidationCache {
  validated: boolean;
  lastCheck: number;
  response?: LicenseValidationResponse;
}

/**
 * Custom error class for license-related errors
 */
export class LicenseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public recoverable: boolean = false
  ) {
    super(message);
    this.name = 'LicenseError';
    Object.setPrototypeOf(this, LicenseError.prototype);
  }
}

/**
 * License validation result with detailed status
 */
export interface ValidationResult {
  success: boolean;
  cached: boolean;
  error?: LicenseError;
  response?: LicenseValidationResponse;
}
