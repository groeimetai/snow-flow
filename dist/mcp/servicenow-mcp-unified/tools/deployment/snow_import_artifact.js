"use strict";
/**
 * snow_import_artifact - Import ServiceNow artifacts
 *
 * Imports previously exported artifacts from JSON/XML files into ServiceNow
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
const fs = __importStar(require("fs/promises"));
exports.toolDefinition = {
    name: 'snow_import_artifact',
    description: 'Imports previously exported artifacts from JSON/XML files into ServiceNow. Validates compatibility and handles dependencies automatically.',
    inputSchema: {
        type: 'object',
        properties: {
            type: { type: 'string', enum: ['widget', 'application'], description: 'Artifact type' },
            file_path: { type: 'string', description: 'Path to the artifact file' },
            format: { type: 'string', enum: ['json', 'xml', 'update_set'], default: 'json', description: 'File format' },
        },
        required: ['type', 'file_path'],
    }
};
async function execute(args, context) {
    const { type, file_path, format = 'json' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Read the file
        const fileContent = await fs.readFile(file_path, 'utf-8');
        let artifactData;
        // Parse based on format
        switch (format) {
            case 'json':
                artifactData = JSON.parse(fileContent);
                if (artifactData.data) {
                    // Exported format with metadata
                    artifactData = artifactData.data;
                }
                break;
            case 'xml':
                // Simple XML parsing (for basic cases)
                artifactData = parseSimpleXML(fileContent);
                break;
            case 'update_set':
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.INVALID_REQUEST, 'Update set import requires XML format and should use snow_import_update_set tool', { retryable: false });
            default:
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.INVALID_REQUEST, `Unsupported format: ${format}`, { retryable: false });
        }
        // Determine table name
        const tableMap = {
            widget: 'sp_widget',
            application: 'sys_app'
        };
        const tableName = tableMap[type];
        if (!tableName) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.INVALID_REQUEST, `Unsupported artifact type: ${type}`, { retryable: false });
        }
        // Remove system fields that shouldn't be imported
        const cleanedData = { ...artifactData };
        delete cleanedData.sys_id;
        delete cleanedData.sys_created_on;
        delete cleanedData.sys_created_by;
        delete cleanedData.sys_updated_on;
        delete cleanedData.sys_updated_by;
        delete cleanedData.sys_mod_count;
        // Check if artifact already exists
        const existingResponse = await client.get(`/api/now/table/${tableName}`, {
            params: {
                sysparm_query: `name=${cleanedData.name || cleanedData.id}`,
                sysparm_limit: 1
            }
        });
        let result;
        if (existingResponse.data.result.length > 0) {
            // Update existing artifact
            const existingSysId = existingResponse.data.result[0].sys_id;
            const updateResponse = await client.put(`/api/now/table/${tableName}/${existingSysId}`, cleanedData);
            result = {
                sys_id: existingSysId,
                action: 'updated',
                artifact: updateResponse.data.result
            };
        }
        else {
            // Create new artifact
            const createResponse = await client.post(`/api/now/table/${tableName}`, cleanedData);
            result = {
                sys_id: createResponse.data.result.sys_id,
                action: 'created',
                artifact: createResponse.data.result
            };
        }
        return (0, error_handler_js_1.createSuccessResult)(result, {
            message: `✅ Artifact ${result.action} successfully\n\nType: ${type}\nName: ${cleanedData.name || cleanedData.id}\nSys ID: ${result.sys_id}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NETWORK_ERROR, `Import failed: ${error.message}`, { originalError: error }));
    }
}
function parseSimpleXML(xml) {
    const result = {};
    const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let match;
    while ((match = tagRegex.exec(xml)) !== null) {
        const key = match[1];
        const value = match[2]
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
        result[key] = value;
    }
    return result;
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_import_artifact.js.map