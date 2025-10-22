/**
 * License Validator
 *
 * Handles license validation with phone-home mechanism, caching,
 * and grace period support for offline scenarios.
 */

import axios, { AxiosError } from 'axios';
import { createHash, createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  LicenseConfig,
  LicenseError,
  LicenseValidationRequest,
  LicenseValidationResponse,
  ValidationCache,
  ValidationResult
} from './types.js';

export class LicenseValidator {
  private static instance: LicenseValidator | null = null;
  private licenseKey?: string;
  private cache: ValidationCache = {
    validated: false,
    lastCheck: 0
  };
  private instanceId: string;
  private config: Required<LicenseConfig>;
  private retryCount = 0;
  private validationInProgress = false;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<LicenseConfig> = {
    key: process.env.SNOW_LICENSE_KEY || '',
    server: process.env.SNOW_LICENSE_SERVER || 'https://license.snow-flow.dev',
    checkInterval: 24 * 60 * 60 * 1000, // 24 hours
    gracePeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    retryAttempts: 3,
    timeout: 10000 // 10 seconds
  };

  private constructor(config?: Partial<LicenseConfig>) {
    this.config = { ...LicenseValidator.DEFAULT_CONFIG, ...config };
    this.licenseKey = this.config.key;
    this.instanceId = this.loadOrGenerateInstanceId();

    // Load cache from disk if available
    this.loadCache();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<LicenseConfig>): LicenseValidator {
    if (!LicenseValidator.instance) {
      LicenseValidator.instance = new LicenseValidator(config);
    }
    return LicenseValidator.instance;
  }

  /**
   * Reset singleton (useful for testing)
   */
  static resetInstance(): void {
    LicenseValidator.instance = null;
  }

  /**
   * Set license key
   */
  setLicenseKey(key: string): void {
    if (!key || key.trim() === '') {
      throw new LicenseError('License key cannot be empty', 'INVALID_KEY');
    }
    this.licenseKey = key;
    this.cache.validated = false; // Force revalidation
  }

  /**
   * Validate license
   */
  async validate(): Promise<ValidationResult> {
    // Prevent concurrent validation requests
    if (this.validationInProgress) {
      return {
        success: this.cache.validated,
        cached: true,
        response: this.cache.response
      };
    }

    try {
      this.validationInProgress = true;

      // Check if we need to revalidate
      const now = Date.now();
      if (this.shouldUseCachedValidation(now)) {
        return {
          success: true,
          cached: true,
          response: this.cache.response
        };
      }

      // Validate license key is set
      if (!this.licenseKey || this.licenseKey.trim() === '') {
        throw new LicenseError(
          'No license key configured. Set via SNOW_LICENSE_KEY environment variable or LicenseValidator.setLicenseKey()',
          'NO_LICENSE_KEY'
        );
      }

      // Perform validation with retries
      const result = await this.performValidationWithRetry();

      if (result.success) {
        this.cache = {
          validated: true,
          lastCheck: now,
          response: result.response
        };
        this.saveCache();
        this.retryCount = 0;
      }

      return result;
    } finally {
      this.validationInProgress = false;
    }
  }

  /**
   * Validate specific feature access
   */
  async validateFeature(feature: string): Promise<boolean> {
    const result = await this.validate();

    if (!result.success) {
      return false;
    }

    const features = result.response?.features || [];
    return features.includes(feature) || features.includes('*');
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this.instanceId;
  }

  /**
   * Get current license status
   */
  async getStatus(): Promise<LicenseValidationResponse | null> {
    const result = await this.validate();
    return result.response || null;
  }

  /**
   * Check if cached validation can be used
   */
  private shouldUseCachedValidation(now: number): boolean {
    if (!this.cache.validated) {
      return false;
    }

    // Check if within normal check interval
    if ((now - this.cache.lastCheck) < this.config.checkInterval) {
      return true;
    }

    // Check if within grace period (for offline scenarios)
    if ((now - this.cache.lastCheck) < this.config.gracePeriod) {
      console.warn('[License] Using cached validation (grace period active)');
      return true;
    }

    return false;
  }

  /**
   * Perform validation with retry logic
   */
  private async performValidationWithRetry(): Promise<ValidationResult> {
    let lastError: LicenseError | undefined;

    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          console.log(`[License] Retry attempt ${attempt}/${this.config.retryAttempts}`);
        }

        const response = await this.performValidation();
        return {
          success: true,
          cached: false,
          response
        };
      } catch (error) {
        lastError = error instanceof LicenseError
          ? error
          : new LicenseError(
              `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
              'VALIDATION_ERROR',
              true
            );

        // Don't retry for certain errors
        if (!lastError.recoverable) {
          break;
        }
      }
    }

    // All retries failed, check grace period
    if (this.cache.validated && this.isWithinGracePeriod()) {
      console.warn('[License] Validation failed, using grace period');
      return {
        success: true,
        cached: true,
        response: this.cache.response,
        error: lastError
      };
    }

    throw lastError || new LicenseError('Validation failed after retries', 'VALIDATION_FAILED');
  }

  /**
   * Perform single validation request
   */
  private async performValidation(): Promise<LicenseValidationResponse> {
    if (!this.licenseKey) {
      throw new LicenseError('No license key set', 'NO_LICENSE_KEY');
    }

    const request: LicenseValidationRequest = {
      key: this.licenseKey,
      version: this.getVersion(),
      instanceId: this.instanceId,
      timestamp: Date.now()
    };

    // Add HMAC signature for request verification
    request.signature = this.signRequest(request);

    try {
      const response = await axios.post<LicenseValidationResponse>(
        `${this.config.server}/validate`,
        request,
        {
          timeout: this.config.timeout,
          headers: {
            'User-Agent': `Snow-Flow-Enterprise/${this.getVersion()}`,
            'Content-Type': 'application/json'
          },
          validateStatus: (status) => status < 500 // Don't throw on 4xx
        }
      );

      if (response.status !== 200) {
        const errorMsg = response.data?.error || `Server returned ${response.status}`;
        throw new LicenseError(
          errorMsg,
          'SERVER_ERROR',
          response.status >= 500 // Retry on 5xx errors
        );
      }

      if (!response.data.valid) {
        throw new LicenseError(
          response.data.error || 'License validation failed',
          'INVALID_LICENSE',
          false
        );
      }

      // Check for warnings
      if (response.data.warnings && response.data.warnings.length > 0) {
        response.data.warnings.forEach(warning => {
          console.warn(`[License] ${warning}`);
        });
      }

      return response.data;
    } catch (error) {
      if (error instanceof LicenseError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
          throw new LicenseError(
            'License server timeout',
            'TIMEOUT',
            true
          );
        }

        if (!axiosError.response) {
          throw new LicenseError(
            'License server unreachable',
            'UNREACHABLE',
            true
          );
        }
      }

      throw new LicenseError(
        `Validation request failed: ${error instanceof Error ? error.message : String(error)}`,
        'REQUEST_FAILED',
        true
      );
    }
  }

  /**
   * Sign request for verification
   */
  private signRequest(request: LicenseValidationRequest): string {
    const data = `${request.key}:${request.version}:${request.instanceId}:${request.timestamp}`;
    return createHmac('sha256', this.licenseKey || '')
      .update(data)
      .digest('hex');
  }

  /**
   * Check if within grace period
   */
  private isWithinGracePeriod(): boolean {
    const now = Date.now();
    return (now - this.cache.lastCheck) < this.config.gracePeriod;
  }

  /**
   * Load or generate instance ID
   */
  private loadOrGenerateInstanceId(): string {
    const idFile = this.getInstanceIdPath();

    try {
      if (fs.existsSync(idFile)) {
        const id = fs.readFileSync(idFile, 'utf-8').trim();
        if (id && id.length > 0) {
          return id;
        }
      }
    } catch (error) {
      console.warn('[License] Could not load instance ID:', error);
    }

    // Generate new instance ID
    const id = this.generateInstanceId();

    try {
      const dir = path.dirname(idFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(idFile, id, 'utf-8');
    } catch (error) {
      console.warn('[License] Could not save instance ID:', error);
    }

    return id;
  }

  /**
   * Generate unique instance ID based on machine characteristics
   */
  private generateInstanceId(): string {
    try {
      // Get first valid MAC address from any network interface (cross-platform)
      const interfaces = os.networkInterfaces();
      const macs = Object.values(interfaces)
        .flat()
        .filter(i => i && i.mac && i.mac !== '00:00:00:00:00:00')
        .map(i => i!.mac);
      const macAddress = macs[0] || '';

      const machineId = createHash('sha256')
        .update([
          os.hostname(),
          os.platform(),
          os.arch(),
          os.cpus()[0]?.model || '',
          macAddress
        ].join('|'))
        .digest('hex')
        .substring(0, 32);

      return machineId;
    } catch {
      // Fallback to UUID if machine ID generation fails
      return uuidv4();
    }
  }

  /**
   * Get instance ID file path
   */
  private getInstanceIdPath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.snow-flow', 'instance.id');
  }

  /**
   * Get cache file path
   */
  private getCachePath(): string {
    const homeDir = os.homedir();
    return path.join(homeDir, '.snow-flow', 'license.cache');
  }

  /**
   * Load cache from disk
   */
  private loadCache(): void {
    try {
      const cachePath = this.getCachePath();
      if (fs.existsSync(cachePath)) {
        const data = fs.readFileSync(cachePath, 'utf-8');
        const cache = JSON.parse(data) as ValidationCache;

        // Only use cache if not too old
        const now = Date.now();
        if ((now - cache.lastCheck) < this.config.gracePeriod) {
          this.cache = cache;
        }
      }
    } catch (error) {
      console.warn('[License] Could not load cache:', error);
    }
  }

  /**
   * Save cache to disk
   */
  private saveCache(): void {
    try {
      const cachePath = this.getCachePath();
      const dir = path.dirname(cachePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(cachePath, JSON.stringify(this.cache), 'utf-8');
    } catch (error) {
      console.warn('[License] Could not save cache:', error);
    }
  }

  /**
   * Get current version
   */
  private getVersion(): string {
    try {
      // Try to load from package.json
      const packagePath = path.join(__dirname, '../../package.json');
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        return pkg.version || '1.0.0';
      }
    } catch {
      // Ignore errors
    }
    return '1.0.0';
  }
}

/**
 * Export singleton instance
 */
export const licenseValidator = LicenseValidator.getInstance();

/**
 * Helper function for requiring license in features
 */
export async function requireLicense(feature?: string): Promise<void> {
  const validator = LicenseValidator.getInstance();

  if (feature) {
    const hasFeature = await validator.validateFeature(feature);
    if (!hasFeature) {
      throw new LicenseError(
        `Feature '${feature}' not included in your license`,
        'FEATURE_NOT_LICENSED'
      );
    }
  } else {
    const result = await validator.validate();
    if (!result.success) {
      throw result.error || new LicenseError(
        'License validation failed',
        'VALIDATION_FAILED'
      );
    }
  }
}
