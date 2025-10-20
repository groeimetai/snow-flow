"use strict";
/**
 * snow_analyze_query - Query optimization and analysis
 *
 * Analyze ServiceNow queries for performance bottlenecks, suggest
 * optimizations, and provide index recommendations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_analyze_query',
    description: 'Analyze and optimize ServiceNow queries for performance',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name to query'
            },
            query: {
                type: 'string',
                description: 'Encoded query string to analyze'
            },
            analyze_indexes: {
                type: 'boolean',
                description: 'Check for index usage and recommendations',
                default: true
            },
            suggest_optimizations: {
                type: 'boolean',
                description: 'Provide query optimization suggestions',
                default: true
            }
        },
        required: ['table', 'query']
    }
};
async function execute(args, context) {
    const { table, query, analyze_indexes = true, suggest_optimizations = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const analysis = {
            query,
            table,
            issues: [],
            suggestions: [],
            index_analysis: null,
            estimated_performance: 'unknown'
        };
        // Parse query conditions
        const conditions = query.split('^').filter((c) => c.length > 0);
        analysis.condition_count = conditions.length;
        // Check for common anti-patterns
        const antiPatterns = [];
        // 1. Check for LIKE queries (slow)
        if (query.includes('LIKE')) {
            antiPatterns.push({
                type: 'LIKE_QUERY',
                severity: 'medium',
                description: 'LIKE queries can be slow on large tables',
                suggestion: 'Consider using indexed text search or exact matches where possible'
            });
        }
        // 2. Check for OR conditions (can prevent index usage)
        const orCount = (query.match(/\^OR/g) || []).length;
        if (orCount > 2) {
            antiPatterns.push({
                type: 'EXCESSIVE_OR',
                severity: 'high',
                description: `Query contains ${orCount} OR conditions, which may prevent index usage`,
                suggestion: 'Consider breaking into multiple queries or restructuring conditions'
            });
        }
        // 3. Check for inequality conditions on multiple fields
        const inequalities = conditions.filter((c) => c.includes('!=') || c.includes('>') || c.includes('<'));
        if (inequalities.length > 3) {
            antiPatterns.push({
                type: 'MULTIPLE_INEQUALITIES',
                severity: 'medium',
                description: 'Multiple inequality conditions can be inefficient',
                suggestion: 'Consider using equality conditions or range queries where possible'
            });
        }
        // 4. Check for query on reference fields without joins
        const refFields = conditions.filter((c) => c.includes('.'));
        if (refFields.length > 0) {
            analysis.uses_dot_walking = true;
            antiPatterns.push({
                type: 'DOT_WALKING',
                severity: 'high',
                description: 'Query uses dot-walking which requires table joins',
                suggestion: 'Minimize dot-walking or ensure reference fields are indexed',
                affected_conditions: refFields
            });
        }
        analysis.anti_patterns = antiPatterns;
        // Get table record count for performance estimation
        const countResponse = await client.get(`/api/now/stats/${table}`, {
            params: {
                sysparm_count: 'true',
                sysparm_query: query
            }
        });
        const totalRecords = parseInt(countResponse.data.result?.stats?.count || '0');
        analysis.matching_records = totalRecords;
        // Analyze indexes if requested
        if (analyze_indexes) {
            const indexResponse = await client.get('/api/now/table/sys_db_index', {
                params: {
                    sysparm_query: `table=${table}^active=true`,
                    sysparm_fields: 'name,indexed_column,unique',
                    sysparm_limit: 100
                }
            });
            const indexes = indexResponse.data.result || [];
            const indexedFields = indexes.map((idx) => idx.indexed_column?.value || idx.indexed_column);
            // Check which query fields are indexed
            const queryFields = conditions.map((c) => c.split(/[!=<>]/)[0]);
            const indexedQueryFields = queryFields.filter((f) => indexedFields.includes(f));
            const unindexedQueryFields = queryFields.filter((f) => !indexedFields.includes(f));
            analysis.index_analysis = {
                total_indexes: indexes.length,
                indexed_query_fields: indexedQueryFields,
                unindexed_query_fields: unindexedQueryFields,
                index_coverage: indexedQueryFields.length / queryFields.length
            };
            if (unindexedQueryFields.length > 0) {
                analysis.suggestions.push({
                    type: 'INDEX_RECOMMENDATION',
                    priority: 'high',
                    description: `Consider adding indexes for: ${unindexedQueryFields.join(', ')}`,
                    estimated_improvement: totalRecords > 10000 ? 'significant' : 'moderate'
                });
            }
        }
        // Estimate performance
        if (totalRecords < 1000 && antiPatterns.length === 0) {
            analysis.estimated_performance = 'excellent';
        }
        else if (totalRecords < 10000 && antiPatterns.length <= 1) {
            analysis.estimated_performance = 'good';
        }
        else if (totalRecords < 100000 && antiPatterns.length <= 2) {
            analysis.estimated_performance = 'moderate';
        }
        else {
            analysis.estimated_performance = 'poor';
        }
        // Optimization suggestions
        if (suggest_optimizations) {
            if (analysis.estimated_performance === 'poor') {
                analysis.suggestions.push({
                    type: 'QUERY_RESTRUCTURE',
                    priority: 'critical',
                    description: 'Query may perform poorly on large datasets',
                    actions: [
                        'Add appropriate indexes',
                        'Reduce number of OR conditions',
                        'Minimize dot-walking',
                        'Consider query caching'
                    ]
                });
            }
            if (conditions.length > 10) {
                analysis.suggestions.push({
                    type: 'COMPLEXITY_REDUCTION',
                    priority: 'medium',
                    description: 'Query has many conditions which may be simplified',
                    suggestion: 'Review if all conditions are necessary'
                });
            }
        }
        return (0, error_handler_js_1.createSuccessResult)({
            analysis,
            performance_rating: analysis.estimated_performance,
            issues_found: antiPatterns.length + (analysis.index_analysis?.unindexed_query_fields.length || 0),
            optimization_potential: analysis.suggestions.length > 0,
            recommendations: analysis.suggestions
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_analyze_query.js.map