"use strict";
/**
 * snow_pull_artifact - Pull artifact to local files
 *
 * Pull ServiceNow artifacts to local files for editing with Claude Code
 * native tools. Enables powerful multi-file editing and search.
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
const os = __importStar(require("os"));
exports.toolDefinition = {
    name: 'snow_pull_artifact',
    description: 'Pull ServiceNow artifact to local files for editing with native tools',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'local-sync',
    use_cases: ['local-development', 'artifact-sync', 'editing'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: {
                type: 'string',
                description: 'sys_id of artifact to pull'
            },
            table: {
                type: 'string',
                description: 'Table name (optional, will auto-detect if not provided)',
                enum: ['sp_widget', 'sys_ux_page', 'sys_hub_flow', 'sys_script_include']
            },
            output_dir: {
                type: 'string',
                description: 'Local directory to save files (default: /tmp/snow-flow-artifacts)'
            }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, table, output_dir = path.join(os.tmpdir(), 'snow-flow-artifacts') } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Auto-detect table if not provided
        let artifactTable = table;
        if (!artifactTable) {
            artifactTable = await detectArtifactTable(client, sys_id);
        }
        // Get artifact data
        const response = await client.get(`/api/now/table/${artifactTable}/${sys_id}`);
        if (!response.data || !response.data.result) {
            return (0, error_handler_js_1.createErrorResult)(`Artifact not found: ${sys_id}`);
        }
        const artifact = response.data.result;
        // Create output directory
        const artifactName = artifact.name || artifact.id || sys_id;
        const artifactDir = path.join(output_dir, artifactTable, artifactName);
        await fs.mkdir(artifactDir, { recursive: true });
        const files = [];
        // Extract files based on artifact type
        if (artifactTable === 'sp_widget') {
            // Widget files
            if (artifact.template) {
                const templateFile = path.join(artifactDir, `${artifactName}.html`);
                await fs.writeFile(templateFile, artifact.template, 'utf-8');
                files.push(templateFile);
            }
            if (artifact.script) {
                const scriptFile = path.join(artifactDir, `${artifactName}.server.js`);
                await fs.writeFile(scriptFile, artifact.script, 'utf-8');
                files.push(scriptFile);
            }
            if (artifact.client_script) {
                const clientFile = path.join(artifactDir, `${artifactName}.client.js`);
                await fs.writeFile(clientFile, artifact.client_script, 'utf-8');
                files.push(clientFile);
            }
            if (artifact.css) {
                const cssFile = path.join(artifactDir, `${artifactName}.css`);
                await fs.writeFile(cssFile, artifact.css, 'utf-8');
                files.push(cssFile);
            }
            if (artifact.option_schema) {
                const optionsFile = path.join(artifactDir, `${artifactName}.options.json`);
                await fs.writeFile(optionsFile, artifact.option_schema, 'utf-8');
                files.push(optionsFile);
            }
        }
        else if (artifactTable === 'sys_script_include') {
            // Script Include
            const scriptFile = path.join(artifactDir, `${artifactName}.js`);
            await fs.writeFile(scriptFile, artifact.script || '', 'utf-8');
            files.push(scriptFile);
        }
        // Create README with context
        const readmeFile = path.join(artifactDir, 'README.md');
        const readme = `# ${artifactName}

**Type:** ${artifactTable}
**sys_id:** ${sys_id}
**Description:** ${artifact.description || 'No description'}

## Files

${files.map(f => `- ${path.basename(f)}`).join('\n')}

## Instructions

1. Edit files using Claude Code native tools
2. Use multi-file search and refactoring
3. Validate changes with snow_validate_artifact_coherence
4. Push changes back with snow_push_artifact

## Original Data

\`\`\`json
${JSON.stringify(artifact, null, 2)}
\`\`\`
`;
        await fs.writeFile(readmeFile, readme, 'utf-8');
        files.push(readmeFile);
        return (0, error_handler_js_1.createSuccessResult)({
            directory: artifactDir,
            files,
            artifact: {
                sys_id,
                table: artifactTable,
                name: artifactName
            }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
async function detectArtifactTable(client, sys_id) {
    const tables = ['sp_widget', 'sys_ux_page', 'sys_hub_flow', 'sys_script_include'];
    for (const table of tables) {
        try {
            const response = await client.get(`/api/now/table/${table}/${sys_id}`, {
                params: { sysparm_fields: 'sys_id' }
            });
            if (response.data && response.data.result) {
                return table;
            }
        }
        catch (e) {
            continue;
        }
    }
    throw new Error(`Could not detect table for sys_id: ${sys_id}`);
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_pull_artifact.js.map