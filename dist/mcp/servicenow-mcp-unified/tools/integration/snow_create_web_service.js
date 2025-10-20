"use strict";
/**
 * snow_create_web_service - SOAP Web Service integration
 *
 * Create SOAP web service integrations from WSDL definitions.
 * Configures authentication and namespace settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_web_service',
    description: 'Create SOAP web service integration from WSDL definition',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Web Service name'
            },
            wsdlUrl: {
                type: 'string',
                description: 'WSDL URL or location'
            },
            description: {
                type: 'string',
                description: 'Web Service description'
            },
            authType: {
                type: 'string',
                enum: ['none', 'basic', 'wsse', 'oauth2'],
                description: 'Authentication type',
                default: 'none'
            },
            namespace: {
                type: 'string',
                description: 'Service namespace'
            },
            username: {
                type: 'string',
                description: 'Username for basic/WSSE authentication'
            },
            password: {
                type: 'string',
                description: 'Password for basic/WSSE authentication'
            },
            active: {
                type: 'boolean',
                description: 'Active flag',
                default: true
            }
        },
        required: ['name', 'wsdlUrl']
    }
};
async function execute(args, context) {
    const { name, wsdlUrl, description = '', authType = 'none', namespace = '', username = '', password = '', active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const webServiceData = {
            name,
            wsdl_url: wsdlUrl,
            description,
            authentication_type: authType,
            namespace,
            active
        };
        if (authType === 'basic' || authType === 'wsse') {
            webServiceData.user_name = username;
            webServiceData.password = password;
        }
        const response = await client.post('/api/now/table/sys_web_service', webServiceData);
        const webService = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            web_service: {
                sys_id: webService.sys_id,
                name: webService.name,
                wsdl_url: wsdlUrl,
                authentication_type: authType,
                namespace,
                active
            },
            message: `SOAP Web Service '${name}' created successfully`,
            next_steps: [
                'Import operations from WSDL',
                'Configure authentication credentials',
                'Test web service operations',
                'Create service consumers'
            ]
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_web_service.js.map