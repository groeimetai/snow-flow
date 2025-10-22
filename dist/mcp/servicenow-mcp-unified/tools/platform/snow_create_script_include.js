"use strict";
/**
 * snow_create_script_include - Create Script Includes
 *
 * Create reusable server-side script libraries with client-callable
 * support, access control, and API management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_script_include',
    description: 'Create reusable Script Include with client-callable support',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'platform',
    use_cases: ['script-includes', 'code-reuse', 'api'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Script Include name (CamelCase recommended)'
            },
            script: {
                type: 'string',
                description: 'Script code (ES5 only, function constructor pattern)'
            },
            description: {
                type: 'string',
                description: 'Script Include description'
            },
            client_callable: {
                type: 'boolean',
                description: 'Allow client-side scripts to call this Script Include',
                default: false
            },
            access: {
                type: 'string',
                enum: ['public', 'package_private'],
                description: 'Access level',
                default: 'package_private'
            },
            active: {
                type: 'boolean',
                description: 'Activate immediately',
                default: true
            },
            api_name: {
                type: 'string',
                description: 'API name for client-callable (defaults to name)'
            },
            validate_es5: {
                type: 'boolean',
                description: 'Validate ES5 compliance before creation',
                default: true
            }
        },
        required: ['name', 'script']
    }
};
async function execute(args, context) {
    const { name, script, description = '', client_callable = false, access = 'package_private', active = true, api_name, validate_es5 = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Validate ES5 compliance if requested
        if (validate_es5) {
            const es5Violations = detectES5Violations(script);
            if (es5Violations.length > 0) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.ES5_SYNTAX_ERROR, 'Script contains ES6+ syntax not supported in ServiceNow', {
                    details: {
                        violations: es5Violations,
                        message: 'Convert to ES5 before creating Script Include'
                    }
                });
            }
        }
        // Validate client-callable pattern
        if (client_callable) {
            if (!script.includes('type:') || !script.includes('function')) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, 'Client-callable Script Includes must use typed function pattern', {
                    details: {
                        example: `var ${name} = Class.create();\n${name}.prototype = {\n  type: '${name}',\n  methodName: function() { /* code */ }\n};`
                    }
                });
            }
        }
        // Create Script Include
        const scriptIncludeData = {
            name,
            script,
            description,
            client_callable,
            access,
            active,
            api_name: api_name || name
        };
        const response = await client.post('/api/now/table/sys_script_include', scriptIncludeData);
        const scriptInclude = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            script_include: {
                sys_id: scriptInclude.sys_id,
                name: scriptInclude.name,
                api_name: scriptInclude.api_name,
                client_callable: scriptInclude.client_callable === 'true',
                access: scriptInclude.access,
                active: scriptInclude.active === 'true'
            },
            usage: client_callable
                ? {
                    server: `var helper = new ${name}();\nvar result = helper.methodName();`,
                    client: `var ga = new GlideAjax('${api_name || name}');\nga.addParam('sysparm_name', 'methodName');\nga.getXMLAnswer(function(answer) { /* handle response */ });`
                }
                : {
                    server: `var helper = new ${name}();\nvar result = helper.methodName();`
                }
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
function detectES5Violations(code) {
    const violations = [];
    const patterns = [
        { regex: /\bconst\s+/g, type: 'const' },
        { regex: /\blet\s+/g, type: 'let' },
        { regex: /=>\s*{|=>\s*\(/g, type: 'arrow_function' },
        { regex: /`[^`]*`/g, type: 'template_literal' },
        { regex: /\.\.\./g, type: 'spread' },
        { regex: /class\s+\w+/g, type: 'class' }
    ];
    patterns.forEach(({ regex, type }) => {
        const matches = code.match(regex);
        if (matches) {
            violations.push({ type, count: matches.length });
        }
    });
    return violations;
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_script_include.js.map