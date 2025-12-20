/**
 * Migration utility to move from .snow-flow to .snow-flow directories
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger.js';

export class ClaudeFlowMigration {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('Migration');
  }

  /**
   * Check if migration is needed
   */
  async checkMigrationNeeded(): Promise<boolean> {
    const oldDir = path.join(process.cwd(), '.snow-flow');
    const newDir = path.join(process.cwd(), '.snow-flow');
    
    return fs.existsSync(oldDir) && !fs.existsSync(newDir);
  }

  /**
   * Perform migration from .snow-flow to .snow-flow
   */
  async migrate(): Promise<void> {
    const oldDir = path.join(process.cwd(), '.snow-flow');
    const newDir = path.join(process.cwd(), '.snow-flow');
    
    if (!fs.existsSync(oldDir)) {
      this.logger.debug('No .snow-flow directory found, skipping migration');
      return;
    }

    if (fs.existsSync(newDir)) {
      this.logger.warn('.snow-flow directory already exists, skipping migration');
      return;
    }

    this.logger.info('🔄 Migrating from .snow-flow to .snow-flow...');

    try {
      // Create new directory structure
      await this.copyDirectory(oldDir, newDir);
      
      this.logger.info('✅ Migration completed successfully!');
      this.logger.info('💡 Old .snow-flow directory preserved for safety');
      this.logger.info('🔍 You can manually delete .snow-flow after verifying everything works');
    } catch (error) {
      this.logger.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Recursively copy directory
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    // Create destination directory
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy subdirectory
        await this.copyDirectory(srcPath, destPath);
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
        this.logger.debug(`Copied: ${entry.name}`);
      }
    }
  }

  /**
   * Clean up old .snow-flow directory (only after user confirmation)
   */
  async cleanup(): Promise<void> {
    const oldDir = path.join(process.cwd(), '.snow-flow');
    
    if (fs.existsSync(oldDir)) {
      this.logger.warn('⚠️  Removing old .snow-flow directory...');
      fs.rmSync(oldDir, { recursive: true, force: true });
      this.logger.info('✅ Cleanup completed');
    }
  }
}

export const migrationUtil = new ClaudeFlowMigration();