"use strict";
/**
 * snow_manage_software_license - Manage software licenses with compliance tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_manage_software_license',
    description: 'Manage software licenses with compliance tracking and optimization',
    inputSchema: {
        type: 'object',
        properties: {
            license_name: { type: 'string', description: 'Software license name' },
            publisher: { type: 'string', description: 'Software publisher/vendor' },
            licensed_installs: { type: 'number', description: 'Number of licensed installations' },
            license_type: {
                type: 'string',
                description: 'Type of license',
                enum: ['named_user', 'concurrent_user', 'server', 'enterprise']
            },
            cost_per_license: { type: 'number', description: 'Cost per license' },
            expiration_date: { type: 'string', description: 'License expiration (YYYY-MM-DD)' },
            auto_renew: { type: 'boolean', description: 'Automatic renewal enabled' }
        },
        required: ['license_name', 'publisher', 'licensed_installs']
    }
};
async function execute(args, context) {
    const { license_name, publisher, licensed_installs, license_type = 'named_user', cost_per_license = 0, expiration_date, auto_renew = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Check if license already exists
        const existingLicense = await client.get(`/api/now/table/alm_license?sysparm_query=display_name=${license_name}^publisher=${publisher}&sysparm_limit=1`);
        if (existingLicense.data.result.length > 0) {
            // Update existing license
            const licenseId = existingLicense.data.result[0].sys_id;
            const response = await client.patch(`/api/now/table/alm_license/${licenseId}`, {
                license_count: licensed_installs,
                license_type,
                cost: cost_per_license,
                expiration_date,
                auto_renew
            });
            return (0, error_handler_js_1.createSuccessResult)({
                action: 'updated',
                license: response.data.result,
                annual_cost: cost_per_license * licensed_installs
            });
        }
        else {
            // Create new license
            const response = await client.post('/api/now/table/alm_license', {
                display_name: license_name,
                publisher,
                license_count: licensed_installs,
                license_type,
                cost: cost_per_license,
                expiration_date,
                auto_renew
            });
            return (0, error_handler_js_1.createSuccessResult)({
                action: 'created',
                license: response.data.result,
                annual_cost: cost_per_license * licensed_installs
            });
        }
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_manage_software_license.js.map