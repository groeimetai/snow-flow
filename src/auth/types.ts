/**
 * Enterprise Authentication Types
 */

export type EnterpriseTier = 'community' | 'professional' | 'team' | 'enterprise';

export interface EnterpriseLicense {
  tier: EnterpriseTier;
  company?: string;
  companyName?: string;
  licenseKey?: string;
  expiresAt?: Date;
  features: string[];
  theme?: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  tier: EnterpriseTier;
  features: string[];
  error?: string;
}
