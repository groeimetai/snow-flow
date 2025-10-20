"use strict";
/**
 * snow_preview_widget - Preview widget before deployment
 *
 * Renders widget preview with test data for validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_preview_widget',
    description: 'Renders widget preview with test data for validation before deployment. Simulates Service Portal environment, checks dependencies, and validates data binding.',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Widget sys_id to preview (optional if providing code)' },
            template: { type: 'string', description: 'HTML template code (optional if using sys_id)' },
            css: { type: 'string', description: 'CSS styles (optional)' },
            client_script: { type: 'string', description: 'Client controller script (optional)' },
            server_script: { type: 'string', description: 'Server script (optional)' },
            test_data: { type: 'string', description: 'JSON test data for server script' },
            option_schema: { type: 'string', description: 'Widget options schema JSON' },
            render_mode: {
                type: 'string',
                enum: ['full', 'template_only', 'data_only'],
                description: 'Preview mode: full (render everything), template_only (no JS), data_only (server data)',
                default: 'full'
            },
        },
    }
};
async function execute(args, context) {
    const { sys_id, template, css, client_script, server_script, test_data, option_schema, render_mode = 'full' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let widgetData = {};
        // Fetch widget if sys_id provided
        if (sys_id) {
            const response = await client.get(`/api/now/table/sp_widget/${sys_id}`);
            if (!response.data.result) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.RESOURCE_NOT_FOUND, `Widget not found: ${sys_id}`, { retryable: false });
            }
            widgetData = response.data.result;
        }
        else {
            // Use provided code
            widgetData = {
                template: template || '',
                css: css || '',
                client_script: client_script || '',
                script: server_script || '',
                option_schema: option_schema || ''
            };
        }
        const preview = {
            widget_name: widgetData.name || widgetData.id || 'Preview',
            render_mode,
            components: {}
        };
        // Preview template
        if (render_mode === 'full' || render_mode === 'template_only') {
            preview.components.template = {
                html: widgetData.template,
                line_count: widgetData.template?.split('\n').length || 0,
                data_bindings: extractDataBindings(widgetData.template || ''),
                ng_directives: extractNgDirectives(widgetData.template || '')
            };
        }
        // Preview CSS
        if (widgetData.css) {
            preview.components.css = {
                styles: widgetData.css,
                line_count: widgetData.css.split('\n').length,
                classes: extractCssClasses(widgetData.css)
            };
        }
        // Preview server script data
        if (render_mode === 'full' || render_mode === 'data_only') {
            if (widgetData.script) {
                preview.components.server_script = {
                    code: widgetData.script,
                    line_count: widgetData.script.split('\n').length,
                    data_properties: extractDataProperties(widgetData.script),
                    input_actions: extractInputActions(widgetData.script)
                };
            }
        }
        // Preview client script
        if (render_mode === 'full' && widgetData.client_script) {
            preview.components.client_script = {
                code: widgetData.client_script,
                line_count: widgetData.client_script.split('\n').length,
                methods: extractClientMethods(widgetData.client_script),
                server_calls: extractServerCalls(widgetData.client_script)
            };
        }
        // Validate coherence
        const coherence = validateWidgetCoherence(preview.components);
        preview.coherence = coherence;
        const message = `🔍 Widget Preview\n\n` +
            `Name: ${preview.widget_name}\n` +
            `Render Mode: ${render_mode}\n\n` +
            `Components:\n` +
            (preview.components.template ? `- Template: ${preview.components.template.line_count} lines, ${preview.components.template.data_bindings.length} data bindings\n` : '') +
            (preview.components.css ? `- CSS: ${preview.components.css.line_count} lines, ${preview.components.css.classes.length} classes\n` : '') +
            (preview.components.server_script ? `- Server: ${preview.components.server_script.line_count} lines, ${preview.components.server_script.data_properties.length} data properties\n` : '') +
            (preview.components.client_script ? `- Client: ${preview.components.client_script.line_count} lines, ${preview.components.client_script.methods.length} methods\n` : '') +
            `\nCoherence: ${coherence.coherent ? '✅ Valid' : '⚠️ Issues Found'}`;
        return (0, error_handler_js_1.createSuccessResult)(preview, { message });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NETWORK_ERROR, `Preview failed: ${error.message}`, { originalError: error }));
    }
}
function extractDataBindings(html) {
    const bindings = [];
    const pattern = /\{\{data\.(\w+)\}\}/g;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        if (!bindings.includes(match[1])) {
            bindings.push(match[1]);
        }
    }
    return bindings;
}
function extractNgDirectives(html) {
    const directives = [];
    const pattern = /ng-(\w+)=/g;
    let match;
    while ((match = pattern.exec(html)) !== null) {
        if (!directives.includes(`ng-${match[1]}`)) {
            directives.push(`ng-${match[1]}`);
        }
    }
    return directives;
}
function extractCssClasses(css) {
    const classes = [];
    const pattern = /\.([a-zA-Z][a-zA-Z0-9_-]*)/g;
    let match;
    while ((match = pattern.exec(css)) !== null) {
        if (!classes.includes(match[1])) {
            classes.push(match[1]);
        }
    }
    return classes;
}
function extractDataProperties(script) {
    const properties = [];
    const pattern = /data\.(\w+)\s*=/g;
    let match;
    while ((match = pattern.exec(script)) !== null) {
        if (!properties.includes(match[1])) {
            properties.push(match[1]);
        }
    }
    return properties;
}
function extractInputActions(script) {
    const actions = [];
    const pattern = /input\.action\s*===?\s*['"](\w+)['"]/g;
    let match;
    while ((match = pattern.exec(script)) !== null) {
        if (!actions.includes(match[1])) {
            actions.push(match[1]);
        }
    }
    return actions;
}
function extractClientMethods(script) {
    const methods = [];
    const pattern = /(?:c|$scope)\.(\w+)\s*=\s*function/g;
    let match;
    while ((match = pattern.exec(script)) !== null) {
        if (!methods.includes(match[1])) {
            methods.push(match[1]);
        }
    }
    return methods;
}
function extractServerCalls(script) {
    const calls = [];
    const pattern = /c\.server\.get\(\s*\{\s*action:\s*['"](\w+)['"]/g;
    let match;
    while ((match = pattern.exec(script)) !== null) {
        if (!calls.includes(match[1])) {
            calls.push(match[1]);
        }
    }
    return calls;
}
function validateWidgetCoherence(components) {
    const issues = [];
    // Check if template data bindings exist in server
    if (components.template && components.server_script) {
        const templateBindings = components.template.data_bindings || [];
        const serverProperties = components.server_script.data_properties || [];
        for (const binding of templateBindings) {
            if (!serverProperties.includes(binding)) {
                issues.push(`Template references data.${binding} but server doesn't initialize it`);
            }
        }
    }
    // Check if client server calls have handlers
    if (components.client_script && components.server_script) {
        const serverCalls = components.client_script.server_calls || [];
        const inputActions = components.server_script.input_actions || [];
        for (const call of serverCalls) {
            if (!inputActions.includes(call)) {
                issues.push(`Client calls action '${call}' but server doesn't handle it`);
            }
        }
    }
    return {
        coherent: issues.length === 0,
        issues
    };
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_preview_widget.js.map