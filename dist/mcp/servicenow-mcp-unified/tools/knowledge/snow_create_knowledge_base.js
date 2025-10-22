"use strict";
/**
 * snow_create_knowledge_base - Create knowledge base
 *
 * Creates a new knowledge base for organizing articles by topic, department, or audience.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_knowledge_base',
    description: 'Creates a new knowledge base for organizing articles by topic, department, or audience.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'knowledge',
    use_cases: ['knowledge', 'create', 'knowledge-base'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Knowledge base title' },
            description: { type: 'string', description: 'Knowledge base description' },
            owner: { type: 'string', description: 'Owner user or group' },
            managers: { type: 'array', items: { type: 'string' }, description: 'Manager users or groups' },
            kb_version: { type: 'string', description: 'Version number' },
            active: { type: 'boolean', description: 'Active status', default: true }
        },
        required: ['title']
    }
};
async function execute(args, context) {
    const { title, description, owner, managers, kb_version = '1.0', active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const kbData = {
            title,
            kb_version,
            active
        };
        if (description)
            kbData.description = description;
        if (owner)
            kbData.owner = owner;
        if (managers)
            kbData.managers = managers.join(',');
        const response = await client.post('/api/now/table/kb_knowledge_base', kbData);
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            knowledge_base: response.data.result,
            sys_id: response.data.result.sys_id
        }, {
            operation: 'create_knowledge_base',
            title,
            version: kb_version
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_knowledge_base.js.map