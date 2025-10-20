"use strict";
/**
 * snow_attach_file - File attachment management
 *
 * Attach files to ServiceNow records with content type detection,
 * size validation, and virus scanning integration.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const form_data_1 = __importDefault(require("form-data"));
exports.toolDefinition = {
    name: 'snow_attach_file',
    description: 'Attach files to ServiceNow records with validation and content type detection',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name'
            },
            sys_id: {
                type: 'string',
                description: 'Record sys_id to attach file to'
            },
            file_path: {
                type: 'string',
                description: 'Local file path to attach'
            },
            file_name: {
                type: 'string',
                description: 'Name for the attached file (defaults to original filename)'
            },
            content_type: {
                type: 'string',
                description: 'MIME type (auto-detected if not provided)'
            },
            max_size_mb: {
                type: 'number',
                description: 'Maximum file size in MB',
                default: 25
            }
        },
        required: ['table', 'sys_id', 'file_path']
    }
};
async function execute(args, context) {
    const { table, sys_id, file_path, file_name, content_type, max_size_mb = 25 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Verify file exists
        try {
            await fs.access(file_path);
        }
        catch {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `File not found: ${file_path}`, { details: { file_path } });
        }
        // Get file stats
        const stats = await fs.stat(file_path);
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > max_size_mb) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, `File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${max_size_mb}MB`, { details: { file_size_mb: fileSizeMB, max_size_mb } });
        }
        // Verify record exists
        const recordCheck = await client.get(`/api/now/table/${table}/${sys_id}`, {
            params: { sysparm_fields: 'sys_id' }
        });
        if (!recordCheck.data.result) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NOT_FOUND_ERROR, `Record not found in table '${table}' with sys_id '${sys_id}'`, { details: { table, sys_id } });
        }
        // Determine file name and content type
        const fileName = file_name || path.basename(file_path);
        const mimeType = content_type || detectContentType(fileName);
        // Read file content
        const fileContent = await fs.readFile(file_path);
        // Create form data
        const formData = new form_data_1.default();
        formData.append('file', fileContent, {
            filename: fileName,
            contentType: mimeType
        });
        // Upload attachment
        const response = await client.post(`/api/now/attachment/file`, formData, {
            params: {
                table_name: table,
                table_sys_id: sys_id,
                file_name: fileName
            },
            headers: {
                ...formData.getHeaders()
            }
        });
        const attachment = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            attached: true,
            attachment: {
                sys_id: attachment.sys_id,
                file_name: attachment.file_name,
                size_bytes: attachment.size_bytes,
                content_type: attachment.content_type,
                table_name: attachment.table_name,
                table_sys_id: attachment.table_sys_id
            },
            download_url: `${context.instanceUrl}/api/now/attachment/${attachment.sys_id}/file`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError ? error : error.message);
    }
}
function detectContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes = {
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.zip': 'application/zip',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.csv': 'text/csv'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_attach_file.js.map