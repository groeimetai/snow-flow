"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrationUtil = exports.ClaudeFlowMigration = void 0;
/**
 * Migration utility to move from .snow-flow to .snow-flow directories
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_js_1 = require("./logger.js");
class ClaudeFlowMigration {
    constructor() {
        this.logger = new logger_js_1.Logger('Migration');
    }
    /**
     * Check if migration is needed
     */
    async checkMigrationNeeded() {
        const oldDir = path.join(process.cwd(), '.snow-flow');
        const newDir = path.join(process.cwd(), '.snow-flow');
        return fs.existsSync(oldDir) && !fs.existsSync(newDir);
    }
    /**
     * Perform migration from .snow-flow to .snow-flow
     */
    async migrate() {
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
        }
        catch (error) {
            this.logger.error('❌ Migration failed:', error);
            throw error;
        }
    }
    /**
     * Recursively copy directory
     */
    async copyDirectory(src, dest) {
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
            }
            else {
                // Copy file
                fs.copyFileSync(srcPath, destPath);
                this.logger.debug(`Copied: ${entry.name}`);
            }
        }
    }
    /**
     * Clean up old .snow-flow directory (only after user confirmation)
     */
    async cleanup() {
        const oldDir = path.join(process.cwd(), '.snow-flow');
        if (fs.existsSync(oldDir)) {
            this.logger.warn('⚠️  Removing old .snow-flow directory...');
            fs.rmSync(oldDir, { recursive: true, force: true });
            this.logger.info('✅ Cleanup completed');
        }
    }
}
exports.ClaudeFlowMigration = ClaudeFlowMigration;
exports.migrationUtil = new ClaudeFlowMigration();
//# sourceMappingURL=migrate-snow-flow.js.map