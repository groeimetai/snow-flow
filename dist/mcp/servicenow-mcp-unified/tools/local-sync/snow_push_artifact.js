"use strict";
/**
 * snow_push_artifact - Push local changes back to ServiceNow
 *
 * Push locally edited artifact files back to ServiceNow with
 * validation and coherence checking.
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
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.toolDefinition = {
    name: 'snow_push_artifact',
    description: 'Push locally edited artifact files back to ServiceNow with validation',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'local-sync',
    use_cases: ['local-development', 'artifact-sync', 'deployment'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: {
                type: 'string',
                description: 'sys_id of artifact to update'
            },
            directory: {
                type: 'string',
                description: 'Directory containing edited artifact files'
            },
            validate: {
                type: 'boolean',
                description: 'Validate before pushing (ES5, coherence)',
                default: true
            },
            force: {
                type: 'boolean',
                description: 'Force push despite validation warnings',
                default: false
            }
        },
        required: ['sys_id', 'directory']
    }
};
async function execute(args, context) {
    const { sys_id, directory, validate = true, force = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Detect artifact type from directory structure
        const { table, artifact } = await loadArtifactFromDirectory(directory);
        // Validate if requested
        if (validate && !force) {
            if (table === 'sp_widget') {
                // ES5 validation
                if (artifact.script) {
                    const es5Check = validateES5(artifact.script);
                    if (!es5Check.valid) {
                        throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.ES5_SYNTAX_ERROR, 'Server script contains non-ES5 syntax', { details: { violations: es5Check.violations } });
                    }
                }
                // Coherence validation
                const coherenceCheck = validateCoherence(artifact);
                if (!coherenceCheck.coherent) {
                    const critical = coherenceCheck.issues.filter((i) => i.severity === 'critical');
                    if (critical.length > 0) {
                        throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.WIDGET_COHERENCE_ERROR, 'Widget coherence validation failed', { details: { issues: critical } });
                    }
                }
            }
        }
        // Push to ServiceNow
        const updateResponse = await client.put(`/api/now/table/${table}/${sys_id}`, artifact);
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            sys_id,
            table,
            artifact: updateResponse.data.result,
            validation: validate ? 'passed' : 'skipped'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
async function loadArtifactFromDirectory(directory) {
    const files = await fs.readdir(directory);
    // Detect artifact type
    const hasWidget = files.some(f => f.endsWith('.server.js') || f.endsWith('.client.js'));
    if (hasWidget) {
        // Widget artifact
        const artifact = {};
        for (const file of files) {
            const filePath = path.join(directory, file);
            const content = await fs.readFile(filePath, 'utf-8');
            if (file.endsWith('.html')) {
                artifact.template = content;
            }
            else if (file.endsWith('.server.js')) {
                artifact.script = content;
            }
            else if (file.endsWith('.client.js')) {
                artifact.client_script = content;
            }
            else if (file.endsWith('.css')) {
                artifact.css = content;
            }
            else if (file.endsWith('.options.json')) {
                artifact.option_schema = content;
            }
        }
        return { table: 'sp_widget', artifact };
    }
    // Default to script include
    const scriptFile = files.find(f => f.endsWith('.js'));
    if (scriptFile) {
        const script = await fs.readFile(path.join(directory, scriptFile), 'utf-8');
        return { table: 'sys_script_include', artifact: { script } };
    }
    throw new Error('Could not determine artifact type from directory');
}
function validateES5(code) {
    const violations = [];
    const patterns = [
        { regex: /\b(const|let)\s+/g, type: 'const/let' },
        { regex: /\([^)]*\)\s*=>/g, type: 'arrow_function' },
        { regex: /`[^`]*`/g, type: 'template_literal' }
    ];
    patterns.forEach(({ regex, type }) => {
        let match;
        while ((match = regex.exec(code)) !== null) {
            violations.push({ type, code: match[0] });
        }
    });
    return { valid: violations.length === 0, violations };
}
function validateCoherence(artifact) {
    const issues = [];
    // Check if HTML references exist in server
    if (artifact.template && artifact.script) {
        const dataRefs = [...artifact.template.matchAll(/\{\{data\.(\w+)\}\}/g)].map(m => m[1]);
        const serverData = [...artifact.script.matchAll(/data\.(\w+)\s*=/g)].map(m => m[1]);
        dataRefs.forEach(ref => {
            if (!serverData.includes(ref)) {
                issues.push({
                    type: 'missing_data',
                    severity: 'critical',
                    description: `HTML references data.${ref} but server doesn't initialize it`
                });
            }
        });
    }
    return {
        coherent: issues.filter(i => i.severity === 'critical').length === 0,
        issues
    };
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_push_artifact.js.map