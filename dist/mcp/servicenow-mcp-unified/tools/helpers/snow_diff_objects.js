"use strict";
/**
 * snow_diff_objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_diff_objects',
    description: 'Compare two objects and get differences',
    inputSchema: {
        type: 'object',
        properties: {
            object1: { type: 'object', description: 'First object' },
            object2: { type: 'object', description: 'Second object' }
        },
        required: ['object1', 'object2']
    }
};
async function execute(args, context) {
    const { object1, object2 } = args;
    try {
        const keys1 = Object.keys(object1);
        const keys2 = Object.keys(object2);
        const allKeys = [...new Set([...keys1, ...keys2])];
        const differences = {};
        let changeCount = 0;
        allKeys.forEach(key => {
            if (object1[key] !== object2[key]) {
                differences[key] = {
                    old: object1[key],
                    new: object2[key]
                };
                changeCount++;
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            has_differences: changeCount > 0,
            change_count: changeCount,
            differences
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_diff_objects.js.map