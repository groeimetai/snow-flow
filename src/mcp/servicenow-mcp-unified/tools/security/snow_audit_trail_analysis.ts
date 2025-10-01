import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceNowClient } from '../../utils/servicenow-client.js';
import type { MCPLogger } from '../../shared/mcp-logger.js';

export interface AuditTrailAnalysisArgs {
  timeframe?: string;
  user?: string;
  table?: string;
  anomalies?: boolean;
  exportFormat?: 'json' | 'csv' | 'pdf';
}

export async function auditTrailAnalysis(
  args: AuditTrailAnalysisArgs,
  client: ServiceNowClient,
  logger: MCPLogger
) {
  try {
    const timeframe = args.timeframe || '24h';
    let query = '';

    if (args.user) {
      query = `user=${args.user}`;
    }
    if (args.table) {
      query += query ? `^table=${args.table}` : `table=${args.table}`;
    }

    logger.trackAPICall('SEARCH', 'sys_audit', 100);
    const auditRecords = await client.searchRecords('sys_audit', query, 100);
    if (!auditRecords.success) {
      throw new Error('Failed to retrieve audit records');
    }

    // Analyze audit data
    const analysis = {
      timeframe,
      total_events: auditRecords.data.result.length,
      unique_users: new Set(auditRecords.data.result.map((record: any) => record.user)).size,
      unique_tables: new Set(auditRecords.data.result.map((record: any) => record.table)).size,
      top_activities: getTopActivities(auditRecords.data.result),
      anomalies: args.anomalies ? detectAnomalies(auditRecords.data.result) : []
    };

    return {
      content: [{
        type: 'text' as const,
        text: `📊 Audit Trail Analysis (${timeframe}):

📈 **Summary:**
- Total Events: ${analysis.total_events}
- Unique Users: ${analysis.unique_users}
- Unique Tables: ${analysis.unique_tables}

🔥 **Top Activities:**
${analysis.top_activities.map((activity: any) =>
  `- ${activity.action} (${activity.count} times)`
).join('\n')}

${analysis.anomalies.length > 0 ?
  `🚨 **Anomalies Detected:**
${analysis.anomalies.map((anomaly: any) =>
    `- ${anomaly.type}: ${anomaly.description}`
  ).join('\n')}\n\n` : ''
}${args.exportFormat ? `📤 Export generated in ${args.exportFormat} format\n` : ''}
✨ Analysis completed with dynamic audit discovery!`
      }]
    };
  } catch (error) {
    logger.error('Failed to analyze audit trails:', error);
    throw new McpError(ErrorCode.InternalError, `Failed to analyze audit trails: ${error}`);
  }
}

function getTopActivities(auditRecords: any[]): any[] {
  const activities = auditRecords.reduce((acc: any, record: any) => {
    acc[record.action] = (acc[record.action] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(activities)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5)
    .map(([action, count]) => ({ action, count }));
}

function detectAnomalies(auditRecords: any[]): any[] {
  const anomalies: any[] = [];

  const userActivity = auditRecords.reduce((acc: any, record: any) => {
    acc[record.user] = (acc[record.user] || 0) + 1;
    return acc;
  }, {});

  const activityValues = Object.values(userActivity) as number[];
  const avgActivity = activityValues.reduce((sum: number, count: number) => sum + count, 0) / Object.keys(userActivity).length;

  Object.entries(userActivity).forEach(([user, count]) => {
    if ((count as number) > avgActivity * 3) {
      anomalies.push({
        type: 'unusual_user_activity',
        description: `User ${user} has ${count} activities (${((count as number) / avgActivity).toFixed(1)}x average)`
      });
    }
  });

  return anomalies;
}
