"use strict";
/**
 * snow_analyze_artifact - Analyze artifact structure and dependencies
 *
 * Performs comprehensive analysis including dependencies, usage patterns, and optimization opportunities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_analyze_artifact',
    description: 'Performs comprehensive analysis of artifacts including dependencies, usage patterns, and optimization opportunities. Caches results for improved performance.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'analysis',
    use_cases: ['analysis', 'dependencies', 'optimization'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: {
                type: 'string',
                description: 'System ID of the artifact'
            },
            table: {
                type: 'string',
                description: 'ServiceNow table name'
            }
        },
        required: ['sys_id', 'table']
    }
};
async function execute(args, context) {
    const { sys_id, table } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Fetch artifact
        const response = await client.getRecord(table, sys_id);
        if (!response.data?.result) {
            throw new Error('Artifact not found');
        }
        const artifact = response.data.result;
        // Analyze structure
        const analysis = {
            meta: {
                sys_id: artifact.sys_id,
                name: artifact.name || artifact.title,
                type: table,
                active: artifact.active,
                last_updated: artifact.sys_updated_on
            },
            structure: {
                fields: Object.keys(artifact).filter(k => !k.startsWith('sys_')),
                hasScript: !!(artifact.script || artifact.server_script),
                hasClientScript: !!artifact.client_script,
                hasTemplate: !!artifact.template,
                hasCSS: !!artifact.css
            },
            dependencies: [],
            modificationPoints: []
        };
        // Detect dependencies (basic)
        if (artifact.script || artifact.server_script) {
            const scriptContent = artifact.script || artifact.server_script;
            // Detect GlideRecord references
            const tableMatches = scriptContent.match(/new GlideRecord\(['"]([^'"]+)['"]\)/g);
            if (tableMatches) {
                analysis.dependencies.push({
                    type: 'table',
                    references: [...new Set(tableMatches.map((m) => m.match(/['"]([^'"]+)['"]/)?.[1]))]
                });
            }
            // Detect Script Include references
            const scriptIncludeMatches = scriptContent.match(/new ([A-Z][a-zA-Z0-9_]+)\(/g);
            if (scriptIncludeMatches) {
                analysis.dependencies.push({
                    type: 'script_include',
                    references: [...new Set(scriptIncludeMatches.map((m) => m.match(/new ([A-Z][a-zA-Z0-9_]+)/)?.[1]))]
                });
            }
        }
        // Identify modification points
        if (table === 'sp_widget') {
            analysis.modificationPoints.push({ field: 'template', description: 'HTML template structure' }, { field: 'script', description: 'Server-side data processing' }, { field: 'client_script', description: 'Client-side behavior' }, { field: 'css', description: 'Widget styling' });
        }
        return (0, error_handler_js_1.createSuccessResult)({
            analysis,
            summary: `${artifact.name || 'Artifact'} analyzed successfully`,
            recommendations: []
        }, {
            sys_id,
            table
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error, { sys_id, table });
    }
}
//# sourceMappingURL=snow_analyze_artifact.js.map