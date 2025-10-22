"use strict";
/**
 * snow_create_change - Create change request
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_change',
    description: 'Create change request',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'change',
    use_cases: ['creation', 'change-management', 'itsm'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            short_description: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['standard', 'normal', 'emergency'] },
            risk: { type: 'string', enum: ['high', 'medium', 'low'] },
            impact: { type: 'number', enum: [1, 2, 3] }
        },
        required: ['short_description', 'type']
    }
};
async function execute(args, context) {
    const { short_description, description, type, risk, impact } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const changeData = { short_description, type };
        if (description)
            changeData.description = description;
        if (risk)
            changeData.risk = risk;
        if (impact)
            changeData.impact = impact;
        const response = await client.post('/api/now/table/change_request', changeData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, change: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_change.js.map