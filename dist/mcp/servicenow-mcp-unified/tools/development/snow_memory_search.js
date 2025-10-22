"use strict";
/**
 * snow_memory_search - Search development memory
 *
 * Searches cached ServiceNow artifacts in local memory for instant results without API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
const fs_1 = require("fs");
const path_1 = require("path");
exports.toolDefinition = {
    name: 'snow_memory_search',
    description: 'Searches cached ServiceNow artifacts in local memory for instant results without API calls.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'search',
    use_cases: ['search', 'cache', 'offline'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query'
            },
            type: {
                type: 'string',
                enum: ['widget', 'flow', 'script', 'application'],
                description: 'Artifact type'
            }
        },
        required: ['query']
    }
};
async function execute(args, context) {
    const { query, type } = args;
    try {
        // Memory path (configurable)
        const memoryPath = process.env.SNOW_MEMORY_PATH || (0, path_1.join)(process.cwd(), '.snow-flow', 'memory');
        // Try to read memory cache
        let memoryData = [];
        try {
            const memoryFile = (0, path_1.join)(memoryPath, 'artifact-cache.json');
            const content = await fs_1.promises.readFile(memoryFile, 'utf-8');
            memoryData = JSON.parse(content);
        }
        catch (error) {
            // No cache available - return empty results
            return (0, error_handler_js_1.createSuccessResult)({
                found: false,
                count: 0,
                results: [],
                source: 'memory',
                note: 'No cached artifacts found. Memory cache may not be initialized.'
            }, {
                query,
                type
            });
        }
        // Filter by type if specified
        if (type) {
            memoryData = memoryData.filter(item => item.type === type);
        }
        // Search in memory
        const lowerQuery = query.toLowerCase();
        const results = memoryData.filter(item => {
            const name = (item.name || '').toLowerCase();
            const description = (item.description || '').toLowerCase();
            return name.includes(lowerQuery) || description.includes(lowerQuery);
        });
        return (0, error_handler_js_1.createSuccessResult)({
            found: results.length > 0,
            count: results.length,
            results: results.slice(0, 20), // Limit to 20 results
            source: 'memory',
            total_cached: memoryData.length
        }, {
            query,
            type
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error, { query, type });
    }
}
//# sourceMappingURL=snow_memory_search.js.map