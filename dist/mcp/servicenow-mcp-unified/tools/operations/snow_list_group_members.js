"use strict";
/**
 * snow_list_group_members - List group members
 *
 * Lists all members of a ServiceNow group.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_list_group_members',
    description: 'Lists all members of a ServiceNow group',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'general',
    use_cases: ["operations"],
    complexity: 'beginner',
    frequency: 'very-high',
    inputSchema: {
        type: 'object',
        properties: {
            group_identifier: {
                type: 'string',
                description: 'Group sys_id or name'
            },
            include_details: {
                type: 'boolean',
                description: 'Include detailed user information',
                default: true
            }
        },
        required: ['group_identifier']
    }
};
async function execute(args, context) {
    const { group_identifier, include_details = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
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
        // Get group memberships
        const membershipsResponse = await client.get('/api/now/table/sys_user_grmember', {
            params: {
                sysparm_query: `group=${group.sys_id}`,
                sysparm_limit: 500
            }
        });
        const memberships = membershipsResponse.data.result || [];
        let members = [];
        if (include_details && memberships.length > 0) {
            // Get detailed user information for each member
            const userSysIds = memberships.map((m) => m.user?.value || m.user);
            const userQuery = `sys_idIN${userSysIds.join(',')}`;
            const usersResponse = await client.get('/api/now/table/sys_user', {
                params: {
                    sysparm_query: userQuery,
                    sysparm_limit: 500
                }
            });
            const users = usersResponse.data.result || [];
            // Create a map of user details
            const userMap = new Map();
            users.forEach((user) => {
                userMap.set(user.sys_id, user);
            });
            // Combine membership with user details
            members = memberships.map((membership) => {
                const userId = membership.user?.value || membership.user;
                const user = userMap.get(userId);
                return {
                    membership_sys_id: membership.sys_id,
                    user_sys_id: userId,
                    user_name: user?.user_name || 'Unknown',
                    name: user?.name || 'Unknown',
                    email: user?.email,
                    title: user?.title,
                    department: user?.department,
                    active: user?.active
                };
            });
        }
        else {
            // Just return basic membership info
            members = memberships.map((membership) => ({
                membership_sys_id: membership.sys_id,
                user_sys_id: membership.user?.value || membership.user
            }));
        }
        return (0, error_handler_js_1.createSuccessResult)({
            group: {
                sys_id: group.sys_id,
                name: group.name,
                description: group.description,
                type: group.type
            },
            member_count: members.length,
            members
        }, { group_name: group.name, member_count: members.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_list_group_members.js.map