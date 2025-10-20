"use strict";
/**
 * snow_create_business_rule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_business_rule',
    description: 'Create server-side business rule (ES5 only!)',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Business rule name' },
            table: { type: 'string', description: 'Table name' },
            when: { type: 'string', enum: ['before', 'after', 'async', 'display'], default: 'before' },
            insert: { type: 'boolean', default: false },
            update: { type: 'boolean', default: false },
            delete: { type: 'boolean', default: false },
            query: { type: 'boolean', default: false },
            condition: { type: 'string', description: 'When to run (ES5 only!)' },
            script: { type: 'string', description: 'Script to execute (ES5 only!)' },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'table', 'script']
    }
};
async function execute(args, context) {
    const { name, table, when = 'before', insert = false, update = false, delete: del = false, query = false, condition, script, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const brData = {
            name,
            collection: table,
            when,
            insert,
            update,
            delete: del,
            query,
            script,
            active
        };
        if (condition)
            brData.condition = condition;
        const response = await client.post('/api/now/table/sys_script', brData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, business_rule: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_business_rule.js.map