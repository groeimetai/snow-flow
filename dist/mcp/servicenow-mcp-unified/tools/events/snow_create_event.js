"use strict";
/**
 * snow_create_event
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_event',
    description: 'Create system event for event management',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Event name' },
            table: { type: 'string', description: 'Source table' },
            parm1: { type: 'string', description: 'Event parameter 1' },
            parm2: { type: 'string', description: 'Event parameter 2' },
            instance: { type: 'string', description: 'Instance name' }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, table, parm1, parm2, instance } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const eventData = { name };
        if (table)
            eventData.table = table;
        if (parm1)
            eventData.parm1 = parm1;
        if (parm2)
            eventData.parm2 = parm2;
        if (instance)
            eventData.instance = instance;
        const response = await client.post('/api/now/table/sysevent', eventData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, event: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_event.js.map