"use strict";
/**
 * snow_import_flow_from_xml - Import flows from XML
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_import_flow_from_xml',
    description: 'Import Flow Designer flows from XML update set',
    inputSchema: {
        type: 'object',
        properties: {
            xml_content: {
                type: 'string',
                description: 'XML content containing flow definition'
            },
            update_set_name: {
                type: 'string',
                description: 'Name for the update set (if creating new)'
            }
        },
        required: ['xml_content']
    }
};
async function execute(args, context) {
    const { xml_content, update_set_name = 'Flow Import' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create or get update set
        let updateSetSysId;
        if (update_set_name) {
            const updateSetResponse = await client.post('/api/now/table/sys_update_set', {
                name: update_set_name,
                description: 'Flow imported from XML',
                state: 'in progress'
            });
            updateSetSysId = updateSetResponse.data.result.sys_id;
        }
        // Import XML (this typically requires the Import Set API or Update Set Preview API)
        const importResponse = await client.post('/api/now/import/sys_remote_update_set', {
            attachment: xml_content,
            type: 'xml'
        });
        return (0, error_handler_js_1.createSuccessResult)({
            imported: true,
            update_set: updateSetSysId || 'current',
            import_result: importResponse.data.result
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_import_flow_from_xml.js.map