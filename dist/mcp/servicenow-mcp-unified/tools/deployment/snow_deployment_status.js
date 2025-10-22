"use strict";
/**
 * snow_deployment_status - Get comprehensive deployment status
 *
 * Retrieves deployment history, active deployments, and success rates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_deployment_status',
    description: 'Retrieves comprehensive deployment status including active deployments, recent history, success rates, and performance metrics.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'deployment',
    use_cases: ['deployment', 'monitoring', 'history'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            limit: { type: 'number', description: 'Number of recent deployments to show', default: 10 },
        },
    }
};
async function execute(args, context) {
    const { limit = 10 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get recent Update Sets as deployment history
        const updateSetsResponse = await client.get('/api/now/table/sys_update_set', {
            params: {
                sysparm_query: 'sys_created_on>=javascript:gs.daysAgoStart(7)^ORDERBYDESCsys_created_on',
                sysparm_limit: limit,
                sysparm_fields: 'name,description,state,sys_created_on,sys_updated_on,sys_created_by,sys_updated_by'
            }
        });
        // Get deployment-related Service Portal widgets
        const widgetsResponse = await client.get('/api/now/table/sp_widget', {
            params: {
                sysparm_query: 'sys_created_on>=javascript:gs.daysAgoStart(7)^ORDERBYDESCsys_created_on',
                sysparm_limit: 5,
                sysparm_fields: 'name,title,sys_created_on,sys_created_by'
            }
        });
        // Process deployment history
        const deployments = [];
        // Add update sets
        if (updateSetsResponse.data.result) {
            for (const updateSet of updateSetsResponse.data.result) {
                const status = updateSet.state === 'complete' ? '✅' :
                    updateSet.state === 'ignore' ? '❌' : '⏳';
                const timeAgo = formatTimeAgo(updateSet.sys_created_on);
                deployments.push({
                    type: 'Update Set',
                    name: updateSet.name,
                    status: status,
                    time: timeAgo,
                    details: `State: ${updateSet.state}${updateSet.description ? ` - ${updateSet.description}` : ''}`
                });
            }
        }
        // Add recent widgets
        if (widgetsResponse.data.result) {
            for (const widget of widgetsResponse.data.result) {
                const timeAgo = formatTimeAgo(widget.sys_created_on);
                deployments.push({
                    type: 'Widget',
                    name: widget.name,
                    status: '✅',
                    time: timeAgo,
                    details: widget.title || 'Service Portal Widget'
                });
            }
        }
        // Sort by creation time (most recent first)
        deployments.sort((a, b) => {
            const timeA = new Date(a.time.includes('ago') ? Date.now() : a.time);
            const timeB = new Date(b.time.includes('ago') ? Date.now() : b.time);
            return timeB.getTime() - timeA.getTime();
        });
        const topDeployments = deployments.slice(0, limit);
        // Calculate statistics
        const totalToday = deployments.filter(d => d.time.includes('hour') || d.time.includes('minute')).length;
        const successful = deployments.filter(d => d.status === '✅').length;
        const total = deployments.length;
        const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
        // Format deployment list
        const deploymentList = topDeployments.map((deployment, index) => `${index + 1}. ${deployment.status} ${deployment.type}: ${deployment.name} - ${deployment.time}\n   ${deployment.details}`).join('\n');
        // Get active/pending update sets
        const activeResponse = await client.get('/api/now/table/sys_update_set', {
            params: {
                sysparm_query: 'state!=complete^state!=ignore',
                sysparm_fields: 'name,state',
                sysparm_limit: 5
            }
        });
        let activeStatus = '';
        if (activeResponse.data.result?.length > 0) {
            activeStatus = '\n🔄 Active Update Sets:\n' +
                activeResponse.data.result.map((us) => `   - ${us.name} (${us.state})`).join('\n');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            deployments: topDeployments,
            statistics: {
                successRate,
                successful,
                total,
                totalToday
            },
            activeUpdateSets: activeResponse.data.result || []
        }, {
            message: `📊 Recent Deployment History (Last ${limit}):\n\n${deploymentList || 'No recent deployments found in the last 7 days'}\n\n📈 Deployment Statistics:\n- Success Rate: ${successRate}% (${successful}/${total} deployments)\n- Total Deployments Today: ${totalToday}\n- Total Deployments (7 days): ${total}${activeStatus}\n\n🔗 View complete history in ServiceNow: System Update Sets > Local Update Sets`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NETWORK_ERROR, `Failed to get deployment status: ${error.message}`, { originalError: error }));
    }
}
function formatTimeAgo(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffMinutes < 60) {
            return `${diffMinutes} minutes ago`;
        }
        else if (diffHours < 24) {
            return `${diffHours} hours ago`;
        }
        else {
            return `${diffDays} days ago`;
        }
    }
    catch (error) {
        return dateString;
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_deployment_status.js.map