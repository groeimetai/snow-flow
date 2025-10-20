"use strict";
/**
 * snow_execute_script_with_output - Execute background scripts
 *
 * Execute server-side JavaScript in ServiceNow background scripts with
 * full output capture (gs.print, gs.info, gs.warn, gs.error).
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_script_with_output',
    description: 'Execute server-side JavaScript with output capture (ES5 only - no const/let/arrow functions)',
    inputSchema: {
        type: 'object',
        properties: {
            script: {
                type: 'string',
                description: 'JavaScript code to execute (MUST be ES5 - no const/let/arrow functions/template literals)'
            },
            scope: {
                type: 'string',
                description: 'Scope to execute in (global or application scope)',
                default: 'global',
                enum: ['global', 'rhino']
            },
            validate_es5: {
                type: 'boolean',
                description: 'Validate ES5 syntax before execution',
                default: true
            }
        },
        required: ['script']
    }
};
async function execute(args, context) {
    const { script, scope = 'global', validate_es5 = true } = args;
    try {
        // ES5 validation
        if (validate_es5) {
            const es5Validation = validateES5(script);
            if (!es5Validation.valid) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.ES5_SYNTAX_ERROR, 'Script contains non-ES5 syntax', {
                    retryable: false,
                    details: {
                        violations: es5Validation.violations,
                        message: 'ServiceNow uses Rhino engine - ES6+ syntax will fail'
                    }
                });
            }
        }
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Wrap script to capture all output
        const wrappedScript = `
var __output = [];
var __originalPrint = gs.print;
var __originalInfo = gs.info;
var __originalWarn = gs.warn;
var __originalError = gs.error;

gs.print = function(msg) { __output.push({level: 'print', message: String(msg)}); };
gs.info = function(msg) { __output.push({level: 'info', message: String(msg)}); __originalInfo(msg); };
gs.warn = function(msg) { __output.push({level: 'warn', message: String(msg)}); __originalWarn(msg); };
gs.error = function(msg) { __output.push({level: 'error', message: String(msg)}); __originalError(msg); };

try {
  ${script}
  __output.push({level: 'success', message: 'Script executed successfully'});
} catch (e) {
  __output.push({level: 'error', message: 'ERROR: ' + e.message});
  __output.push({level: 'error', message: 'Stack: ' + e.stack});
}

gs.print = __originalPrint;
gs.info = __originalInfo;
gs.warn = __originalWarn;
gs.error = __originalError;

JSON.stringify(__output);
`;
        // Execute via background script API
        const response = await client.post('/api/now/table/sys_script_execution', {
            script: wrappedScript,
            scope: scope === 'rhino' ? 'rhino.global' : 'global'
        });
        // Parse output
        let output = [];
        let executionResult = response.data.result;
        try {
            // The result might be in different formats depending on ServiceNow version
            if (executionResult.output) {
                output = JSON.parse(executionResult.output);
            }
            else if (typeof executionResult === 'string') {
                output = JSON.parse(executionResult);
            }
        }
        catch (e) {
            output = [{ level: 'info', message: executionResult.toString() }];
        }
        // Organize output by level
        const organized = {
            print: output.filter(o => o.level === 'print').map(o => o.message),
            info: output.filter(o => o.level === 'info').map(o => o.message),
            warn: output.filter(o => o.level === 'warn').map(o => o.message),
            error: output.filter(o => o.level === 'error').map(o => o.message),
            success: output.some(o => o.level === 'success')
        };
        return (0, error_handler_js_1.createSuccessResult)({
            success: organized.error.length === 0,
            output: organized,
            raw_output: output
        }, {
            script_length: script.length,
            scope,
            es5_validated: validate_es5
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
function validateES5(code) {
    const violations = [];
    const patterns = [
        { regex: /\b(const|let)\s+/g, type: 'const/let', fix: "Use 'var'" },
        { regex: /\([^)]*\)\s*=>/g, type: 'arrow_function', fix: 'Use function() {}' },
        { regex: /`[^`]*`/g, type: 'template_literal', fix: 'Use string concatenation' },
        { regex: /\{[^}]+\}\s*=\s*/g, type: 'destructuring', fix: 'Use explicit properties' },
        { regex: /for\s*\([^)]*\s+of\s+/g, type: 'for_of', fix: 'Use traditional for loop' },
        { regex: /class\s+\w+/g, type: 'class', fix: 'Use function constructor' }
    ];
    patterns.forEach(({ regex, type, fix }) => {
        let match;
        while ((match = regex.exec(code)) !== null) {
            violations.push({
                type,
                line: code.substring(0, match.index).split('\n').length,
                code: match[0],
                fix
            });
        }
    });
    return { valid: violations.length === 0, violations };
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_execute_script_with_output.js.map