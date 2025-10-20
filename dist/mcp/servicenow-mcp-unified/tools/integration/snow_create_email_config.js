"use strict";
/**
 * snow_create_email_config - Email server configuration
 *
 * Create email server configurations for SMTP, POP3, or IMAP.
 * Configures ports, encryption, and authentication.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_email_config',
    description: 'Create email server configuration for SMTP, POP3, or IMAP',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Email configuration name'
            },
            serverType: {
                type: 'string',
                enum: ['SMTP', 'POP3', 'IMAP', 'SMTPS', 'POP3S', 'IMAPS'],
                description: 'Email server type'
            },
            serverName: {
                type: 'string',
                description: 'Email server hostname or IP'
            },
            port: {
                type: 'number',
                description: 'Server port (default: auto-detect by type)'
            },
            encryption: {
                type: 'string',
                enum: ['SSL', 'TLS', 'None'],
                description: 'Encryption type',
                default: 'None'
            },
            username: {
                type: 'string',
                description: 'Authentication username'
            },
            password: {
                type: 'string',
                description: 'Authentication password'
            },
            description: {
                type: 'string',
                description: 'Configuration description'
            },
            active: {
                type: 'boolean',
                description: 'Active flag',
                default: true
            }
        },
        required: ['name', 'serverType', 'serverName']
    }
};
const DEFAULT_PORTS = {
    'SMTP': 587,
    'SMTPS': 465,
    'POP3': 110,
    'POP3S': 995,
    'IMAP': 143,
    'IMAPS': 993
};
async function execute(args, context) {
    const { name, serverType, serverName, port, encryption = 'None', username = '', password = '', description = '', active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Auto-detect port if not specified
        const finalPort = port || DEFAULT_PORTS[serverType] || 25;
        const emailConfigData = {
            name,
            type: serverType,
            server: serverName,
            port: finalPort,
            encryption,
            user_name: username,
            password,
            description,
            active
        };
        const response = await client.post('/api/now/table/sys_email_account', emailConfigData);
        const emailConfig = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            email_config: {
                sys_id: emailConfig.sys_id,
                name: emailConfig.name,
                type: serverType,
                server: serverName,
                port: finalPort,
                encryption,
                active
            },
            message: `Email configuration '${name}' created successfully for ${serverType} on ${serverName}:${finalPort}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_email_config.js.map