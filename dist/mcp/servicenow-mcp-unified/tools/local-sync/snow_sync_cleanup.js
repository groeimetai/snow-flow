"use strict";
/**
 * snow_sync_cleanup - Clean up local sync files
 *
 * Removes local artifact files after successful sync, with optional retention policies.
 */
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
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.toolDefinition = {
    name: 'snow_sync_cleanup',
    description: 'Clean up local artifact files after sync with retention policies',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'local-sync',
    use_cases: ['cleanup', 'maintenance', 'local-development'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Artifact sys_id to clean up' },
            cleanup_all: { type: 'boolean', description: 'Clean up all synced artifacts', default: false },
            keep_backup: { type: 'boolean', description: 'Keep backup before deletion', default: true },
            max_age_days: { type: 'number', description: 'Clean files older than N days (0 = all)', default: 0 }
        }
    }
};
async function execute(args, context) {
    const { sys_id, cleanup_all = false, keep_backup = true, max_age_days = 0 } = args;
    try {
        const syncDir = path.join('/tmp', 'snow-flow-artifacts');
        // Verify sync directory exists
        try {
            await fs.access(syncDir);
        }
        catch {
            return (0, error_handler_js_1.createSuccessResult)({ message: 'No artifacts to clean up', cleaned: 0 });
        }
        let cleanedCount = 0;
        let backupPaths = [];
        if (cleanup_all) {
            // Clean all artifacts
            const cleaned = await cleanupAllArtifacts(syncDir, keep_backup, max_age_days);
            cleanedCount = cleaned.count;
            backupPaths = cleaned.backups;
        }
        else if (sys_id) {
            // Clean specific artifact
            const cleaned = await cleanupArtifact(syncDir, sys_id, keep_backup);
            cleanedCount = cleaned.count;
            backupPaths = cleaned.backups;
        }
        else {
            return (0, error_handler_js_1.createErrorResult)('Either sys_id or cleanup_all must be specified');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            cleaned: true,
            artifacts_cleaned: cleanedCount,
            backup_created: keep_backup,
            backup_paths: backupPaths
        }, { sys_id, cleanup_all });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
async function cleanupArtifact(syncDir, sysId, keepBackup) {
    let count = 0;
    const backups = [];
    // Find artifact directory
    const categories = await fs.readdir(syncDir);
    for (const category of categories) {
        const categoryPath = path.join(syncDir, category);
        const stat = await fs.stat(categoryPath);
        if (!stat.isDirectory())
            continue;
        const artifacts = await fs.readdir(categoryPath);
        for (const artifact of artifacts) {
            const artifactPath = path.join(categoryPath, artifact);
            const metaPath = path.join(artifactPath, '.metadata.json');
            try {
                const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                if (metadata.sys_id === sysId) {
                    if (keepBackup) {
                        const backupPath = await createBackup(artifactPath, sysId);
                        backups.push(backupPath);
                    }
                    await fs.rm(artifactPath, { recursive: true, force: true });
                    count++;
                }
            }
            catch {
                // Skip if metadata doesn't exist or is invalid
            }
        }
    }
    return { count, backups };
}
async function cleanupAllArtifacts(syncDir, keepBackup, maxAgeDays) {
    let count = 0;
    const backups = [];
    const cutoffTime = maxAgeDays > 0 ? Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000) : 0;
    const categories = await fs.readdir(syncDir);
    for (const category of categories) {
        const categoryPath = path.join(syncDir, category);
        const stat = await fs.stat(categoryPath);
        if (!stat.isDirectory())
            continue;
        const artifacts = await fs.readdir(categoryPath);
        for (const artifact of artifacts) {
            const artifactPath = path.join(categoryPath, artifact);
            const artifactStat = await fs.stat(artifactPath);
            // Check age if maxAgeDays specified
            if (maxAgeDays > 0 && artifactStat.mtimeMs > cutoffTime) {
                continue;
            }
            try {
                const metaPath = path.join(artifactPath, '.metadata.json');
                const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                if (keepBackup) {
                    const backupPath = await createBackup(artifactPath, metadata.sys_id);
                    backups.push(backupPath);
                }
                await fs.rm(artifactPath, { recursive: true, force: true });
                count++;
            }
            catch {
                // Skip if metadata doesn't exist or is invalid
            }
        }
    }
    return { count, backups };
}
async function createBackup(artifactPath, sysId) {
    const backupDir = path.join('/tmp', 'snow-flow-backups');
    await fs.mkdir(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${sysId}_${timestamp}`);
    // Copy directory recursively
    await copyDir(artifactPath, backupPath);
    return backupPath;
}
async function copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await copyDir(srcPath, destPath);
        }
        else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_sync_cleanup.js.map