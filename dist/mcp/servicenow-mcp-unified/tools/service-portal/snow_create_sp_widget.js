"use strict";
/**
 * snow_create_sp_widget - Create Service Portal widget
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_sp_widget',
    description: 'Create Service Portal widget',
    inputSchema: {
        type: 'object',
        properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            template: { type: 'string' },
            client_script: { type: 'string' },
            server_script: { type: 'string' },
            css: { type: 'string' }
        },
        required: ['id', 'name']
    }
};
async function execute(args, context) {
    const { id, name, template, client_script, server_script, css } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const widgetData = { id, name };
        if (template)
            widgetData.template = template;
        if (client_script)
            widgetData.client_script = client_script;
        if (server_script)
            widgetData.script = server_script;
        if (css)
            widgetData.css = css;
        const response = await client.post('/api/now/table/sp_widget', widgetData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, widget: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_sp_widget.js.map