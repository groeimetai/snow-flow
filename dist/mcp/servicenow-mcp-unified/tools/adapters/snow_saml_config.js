"use strict";
/**
 * snow_saml_config
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_saml_config',
    description: 'Configure SAML SSO',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'SAML config name' },
            issuer_url: { type: 'string', description: 'Identity provider issuer URL' },
            certificate: { type: 'string', description: 'IdP certificate' }
        },
        required: ['name', 'issuer_url']
    }
};
async function execute(args, context) {
    const { name, issuer_url, certificate } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const samlData = {
            name,
            issuer_url,
            active: true
        };
        if (certificate)
            samlData.certificate = certificate;
        const response = await client.post('/api/now/table/sys_auth_profile_saml2', samlData);
        return (0, error_handler_js_1.createSuccessResult)({ configured: true, saml_config: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_saml_config.js.map