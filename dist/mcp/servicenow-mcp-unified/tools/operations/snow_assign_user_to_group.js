"use strict";
/**
 * snow_assign_user_to_group - Assign user to group
 *
 * Assigns a user to a ServiceNow group.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_assign_user_to_group',
    description: 'Assigns a user to a ServiceNow group',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'general',
    use_cases: ["operations"],
    complexity: 'beginner',
    frequency: 'very-high',
    inputSchema: {
        type: 'object',
        properties: {
            user_identifier: {
                type: 'string',
                description: 'User sys_id, user_name, or email'
            },
            group_identifier: {
                type: 'string',
                description: 'Group sys_id or name'
            }
        },
        required: ['user_identifier', 'group_identifier']
    }
};
async function execute(args, context) {
    const { user_identifier, group_identifier } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve user
        const userQuery = user_identifier.includes('@')
            ? `email=${user_identifier}`
            : user_identifier.length === 32
                ? `sys_id=${user_identifier}`
                : `user_name=${user_identifier}`;
        const userResponse = await client.get('/api/now/table/sys_user', {
            params: { sysparm_query: userQuery, sysparm_limit: 1 }
        });
        if (!userResponse.data.result || userResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)(`User "${user_identifier}" not found`);
        }
        const user = userResponse.data.result[0];
        // Resolve group
        const groupQuery = group_identifier.length === 32
            ? `sys_id=${group_identifier}`
            : `name=${group_identifier}`;
        const groupResponse = await client.get('/api/now/table/sys_user_group', {
            params: { sysparm_query: groupQuery, sysparm_limit: 1 }
        });
        if (!groupResponse.data.result || groupResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)(`Group "${group_identifier}" not found`);
        }
        const group = groupResponse.data.result[0];
        // Check if membership already exists
        const existingMembership = await client.get('/api/now/table/sys_user_grmember', {
            params: {
                sysparm_query: `user=${user.sys_id}^group=${group.sys_id}`,
                sysparm_limit: 1
            }
        });
        if (existingMembership.data.result && existingMembership.data.result.length > 0) {
            return (0, error_handler_js_1.createSuccessResult)({
                message: `User "${user.user_name}" is already a member of group "${group.name}"`,
                membership_sys_id: existingMembership.data.result[0].sys_id
            }, { user_name: user.user_name, group_name: group.name });
        }
        // Create membership
        const membershipData = {
            user: user.sys_id,
            group: group.sys_id
        };
        const response = await client.post('/api/now/table/sys_user_grmember', membershipData);
        const membership = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            message: `User "${user.user_name}" assigned to group "${group.name}" successfully`,
            membership: {
                sys_id: membership.sys_id,
                user: {
                    sys_id: user.sys_id,
                    user_name: user.user_name,
                    name: user.name
                },
                group: {
                    sys_id: group.sys_id,
                    name: group.name
                }
            }
        }, { user_name: user.user_name, group_name: group.name });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_assign_user_to_group.js.map