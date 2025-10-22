"use strict";
/**
 * snow_sync_status - Get local sync status
 *
 * Returns status of locally synced artifacts including last sync time, changes, and coherence validation.
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
    name: 'snow_sync_status',
    description: 'Get status of locally synced artifacts including changes and validation',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'local-sync',
    use_cases: ['status', 'monitoring', 'local-development'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Specific artifact sys_id to check' },
            check_all: { type: 'boolean', description: 'Check all synced artifacts', default: false },
            include_file_details: { type: 'boolean', description: 'Include file-level details', default: false },
            validate_coherence: { type: 'boolean', description: 'Run coherence validation', default: false }
        }
    }
};
async function execute(args, context) {
    const { sys_id, check_all = false, include_file_details = false, validate_coherence = false } = args;
    try {
        const syncDir = path.join('/tmp', 'snow-flow-artifacts');
        // Verify sync directory exists
        try {
            await fs.access(syncDir);
        }
        catch {
            return (0, error_handler_js_1.createSuccessResult)({
                message: 'No synced artifacts found',
                artifacts: []
            });
        }
        let artifacts = [];
        if (check_all) {
            artifacts = await getAllArtifactStatus(syncDir, include_file_details, validate_coherence);
        }
        else if (sys_id) {
            const artifact = await getArtifactStatus(syncDir, sys_id, include_file_details, validate_coherence);
            if (artifact) {
                artifacts = [artifact];
            }
        }
        else {
            return (0, error_handler_js_1.createErrorResult)('Either sys_id or check_all must be specified');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            total_artifacts: artifacts.length,
            artifacts,
            sync_directory: syncDir
        }, { sys_id, check_all });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
async function getArtifactStatus(syncDir, sysId, includeFileDetails, validateCoherence) {
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
                    return await buildArtifactStatus(artifactPath, metadata, includeFileDetails, validateCoherence);
                }
            }
            catch {
                // Skip if metadata doesn't exist or is invalid
            }
        }
    }
    return null;
}
async function getAllArtifactStatus(syncDir, includeFileDetails, validateCoherence) {
    const artifacts = [];
    const categories = await fs.readdir(syncDir);
    for (const category of categories) {
        const categoryPath = path.join(syncDir, category);
        const stat = await fs.stat(categoryPath);
        if (!stat.isDirectory())
            continue;
        const categoryArtifacts = await fs.readdir(categoryPath);
        for (const artifact of categoryArtifacts) {
            const artifactPath = path.join(categoryPath, artifact);
            const metaPath = path.join(artifactPath, '.metadata.json');
            try {
                const metadata = JSON.parse(await fs.readFile(metaPath, 'utf-8'));
                const status = await buildArtifactStatus(artifactPath, metadata, includeFileDetails, validateCoherence);
                artifacts.push(status);
            }
            catch {
                // Skip if metadata doesn't exist or is invalid
            }
        }
    }
    return artifacts;
}
async function buildArtifactStatus(artifactPath, metadata, includeFileDetails, validateCoherence) {
    const status = {
        sys_id: metadata.sys_id,
        table: metadata.table,
        name: metadata.name,
        synced_at: metadata.synced_at,
        local_path: artifactPath
    };
    // Get file information
    const files = await fs.readdir(artifactPath);
    const artifactFiles = files.filter(f => !f.startsWith('.'));
    status.file_count = artifactFiles.length;
    status.files = artifactFiles;
    // Calculate time since sync
    const syncTime = new Date(metadata.synced_at).getTime();
    const now = Date.now();
    const hoursSinceSync = Math.round((now - syncTime) / (1000 * 60 * 60));
    status.hours_since_sync = hoursSinceSync;
    // Check if files have been modified since sync
    let hasChanges = false;
    const fileDetails = [];
    for (const file of artifactFiles) {
        const filePath = path.join(artifactPath, file);
        const fileStat = await fs.stat(filePath);
        if (fileStat.mtimeMs > syncTime) {
            hasChanges = true;
        }
        if (includeFileDetails) {
            fileDetails.push({
                name: file,
                size: fileStat.size,
                modified: fileStat.mtime.toISOString(),
                modified_since_sync: fileStat.mtimeMs > syncTime
            });
        }
    }
    status.has_local_changes = hasChanges;
    if (includeFileDetails) {
        status.file_details = fileDetails;
    }
    // Validate coherence if requested (for widgets)
    if (validateCoherence && metadata.table === 'sp_widget') {
        status.coherence = await validateWidgetCoherence(artifactPath, artifactFiles);
    }
    return status;
}
async function validateWidgetCoherence(artifactPath, files) {
    const coherence = {
        valid: true,
        issues: []
    };
    try {
        // Check for required widget files
        const requiredFiles = ['template.html', 'script.js'];
        const missingFiles = requiredFiles.filter(f => !files.includes(f));
        if (missingFiles.length > 0) {
            coherence.valid = false;
            coherence.issues.push({
                type: 'missing_files',
                files: missingFiles
            });
        }
        // Basic content validation
        if (files.includes('template.html')) {
            const template = await fs.readFile(path.join(artifactPath, 'template.html'), 'utf-8');
            // Check for ng-click methods
            const ngClickMatches = template.match(/ng-click="(\w+)\(/g);
            if (ngClickMatches) {
                const methods = ngClickMatches.map(m => m.match(/ng-click="(\w+)\(/)?.[1]).filter(Boolean);
                coherence.required_client_methods = methods;
            }
            // Check for data references
            const dataMatches = template.match(/data\.(\w+)/g);
            if (dataMatches) {
                const properties = dataMatches.map(m => m.match(/data\.(\w+)/)?.[1]).filter(Boolean);
                const uniqueProperties = new Set(properties);
                coherence.required_data_properties = Array.from(uniqueProperties);
            }
        }
        if (files.includes('client_script.js')) {
            const clientScript = await fs.readFile(path.join(artifactPath, 'client_script.js'), 'utf-8');
            // Check for server.get calls
            const serverCallMatches = clientScript.match(/c\.server\.get\(\{[^}]*action:\s*['"](\w+)['"]/g);
            if (serverCallMatches) {
                const actions = serverCallMatches.map(m => m.match(/action:\s*['"](\w+)['"]/)?.[1]).filter(Boolean);
                coherence.required_server_actions = actions;
            }
        }
    }
    catch (error) {
        coherence.valid = false;
        coherence.issues.push({
            type: 'validation_error',
            message: String(error)
        });
    }
    return coherence;
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_sync_status.js.map