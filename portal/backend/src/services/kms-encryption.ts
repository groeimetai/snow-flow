/**
 * Google Cloud KMS Encryption Service
 *
 * Implements envelope encryption for customer credentials:
 * 1. Generate random DEK (Data Encryption Key) for each credential
 * 2. Encrypt credential data with DEK using AES-256-GCM
 * 3. Encrypt DEK with Google Cloud KMS key
 * 4. Store: encrypted_dek:iv:authTag:encrypted_data
 *
 * Benefits:
 * - KMS key never leaves Google's HSM
 * - Each credential has unique DEK
 * - Fast: only DEK encrypt/decrypt uses KMS API
 * - Audit: all KMS operations are logged
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';
import crypto from 'crypto';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export class KMSEncryptionService {
  private kmsClient: KeyManagementServiceClient;
  private keyName: string;

  constructor() {
    this.kmsClient = new KeyManagementServiceClient();

    // KMS key path format: projects/PROJECT_ID/locations/LOCATION/keyRings/KEY_RING/cryptoKeys/KEY_NAME
    const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.KMS_LOCATION || 'europe-west4';
    const keyRing = process.env.KMS_KEY_RING || 'credentials-keyring';
    const keyName = process.env.KMS_KEY_NAME || 'credentials-key';

    if (!projectId) {
      throw new Error('GCP_PROJECT_ID or GOOGLE_CLOUD_PROJECT environment variable required for KMS');
    }

    this.keyName = `projects/${projectId}/locations/${location}/keyRings/${keyRing}/cryptoKeys/${keyName}`;

    logger.info('✅ KMS Encryption Service initialized', {
      keyPath: this.keyName
    });
  }

  /**
   * Encrypt plaintext using envelope encryption
   *
   * @param plaintext - Data to encrypt
   * @returns Format: encrypted_dek:iv:authTag:encrypted_data (all hex-encoded)
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      // Step 1: Generate random 32-byte DEK (Data Encryption Key)
      const dek = crypto.randomBytes(32);

      // Step 2: Encrypt plaintext with DEK using AES-256-GCM
      const iv = crypto.randomBytes(16); // 128-bit IV for GCM
      const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);

      let encryptedData = cipher.update(plaintext, 'utf8', 'hex');
      encryptedData += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Step 3: Encrypt DEK with Google Cloud KMS
      const [encryptResponse] = await this.kmsClient.encrypt({
        name: this.keyName,
        plaintext: dek
      });

      if (!encryptResponse.ciphertext) {
        throw new Error('KMS encryption failed: no ciphertext returned');
      }

      // Step 4: Return: encrypted_dek:iv:authTag:encrypted_data
      const encryptedDek = Buffer.from(encryptResponse.ciphertext as Uint8Array).toString('hex');
      const result = `${encryptedDek}:${iv.toString('hex')}:${authTag.toString('hex')}:${encryptedData}`;

      logger.debug('🔒 Encrypted data with KMS envelope encryption', {
        dekLength: dek.length,
        encryptedDekLength: encryptedDek.length,
        dataLength: plaintext.length
      });

      return result;
    } catch (error) {
      logger.error('❌ KMS encryption error:', {
        error: error instanceof Error ? error.message : String(error),
        keyName: this.keyName
      });
      throw error;
    }
  }

  /**
   * Decrypt ciphertext using envelope encryption
   *
   * @param ciphertext - Format: encrypted_dek:iv:authTag:encrypted_data
   * @returns Decrypted plaintext
   */
  async decrypt(ciphertext: string): Promise<string> {
    try {
      // Parse: encrypted_dek:iv:authTag:encrypted_data
      const parts = ciphertext.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid ciphertext format (expected: encrypted_dek:iv:authTag:encrypted_data)');
      }

      const [encryptedDekHex, ivHex, authTagHex, encryptedDataHex] = parts;

      // Step 1: Decrypt DEK with Google Cloud KMS
      const encryptedDek = Buffer.from(encryptedDekHex, 'hex');
      const [decryptResponse] = await this.kmsClient.decrypt({
        name: this.keyName,
        ciphertext: encryptedDek
      });

      if (!decryptResponse.plaintext) {
        throw new Error('KMS decryption failed: no plaintext returned');
      }

      const dek = Buffer.from(decryptResponse.plaintext as Uint8Array);

      // Step 2: Decrypt data with DEK using AES-256-GCM
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      logger.debug('🔓 Decrypted data with KMS envelope encryption', {
        dekLength: dek.length,
        dataLength: decrypted.length
      });

      return decrypted;
    } catch (error) {
      logger.error('❌ KMS decryption error:', {
        error: error instanceof Error ? error.message : String(error),
        keyName: this.keyName
      });
      throw error;
    }
  }

  /**
   * Test KMS connectivity and permissions
   */
  async testConnection(): Promise<boolean> {
    try {
      const testData = 'test-connection-' + Date.now();
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);

      if (decrypted !== testData) {
        throw new Error('Encryption round-trip test failed');
      }

      logger.info('✅ KMS connection test successful', {
        keyName: this.keyName
      });

      return true;
    } catch (error) {
      logger.error('❌ KMS connection test failed:', {
        error: error instanceof Error ? error.message : String(error),
        keyName: this.keyName
      });
      return false;
    }
  }
}
