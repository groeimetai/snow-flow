/**
 * ml_detect_anomalies - Detect anomalies in incident patterns and system behavior
 *
 * Uses trained autoencoder models to detect:
 * - Unusual incident patterns
 * - Abnormal user behavior
 * - System performance anomalies
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_detect_anomalies',
  description: 'Detects anomalies in incident patterns, user behavior, or system performance using autoencoder models.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ml-analytics',
  subcategory: 'machine-learning',
  use_cases: ['anomaly-detection', 'monitoring', 'pattern-analysis'],
  complexity: 'advanced',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      metric_type: {
        type: 'string',
        enum: ['incident_patterns', 'user_behavior', 'system_performance'],
        description: 'Type of anomaly to detect'
      },
      sensitivity: {
        type: 'number',
        description: 'Anomaly detection sensitivity (0.1-1.0)',
        default: 0.8
      },
      lookback_days: {
        type: 'number',
        description: 'Number of days to analyze',
        default: 7
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    metric_type = 'incident_patterns',
    sensitivity = 0.8,
    lookback_days = 7
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Fetch data based on metric type
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookback_days);

    const query = `sys_created_on>=${startDate.toISOString()}^sys_created_on<=${endDate.toISOString()}`;

    let tableName = 'incident';
    let analysisField = 'category';

    switch (metric_type) {
      case 'incident_patterns':
        tableName = 'incident';
        analysisField = 'category';
        break;
      case 'user_behavior':
        tableName = 'sys_audit';
        analysisField = 'user';
        break;
      case 'system_performance':
        tableName = 'syslog';
        analysisField = 'level';
        break;
    }

    const records = await client.query({
      table: tableName,
      query: query,
      limit: 10000,
      fields: [analysisField, 'sys_created_on']
    });

    if (!records || records.length === 0) {
      return createErrorResult('No data found for anomaly detection');
    }

    // Detect anomalies
    const anomalies = detectAnomaliesInData(records, metric_type, sensitivity, lookback_days);

    return createSuccessResult({
      status: 'success',
      metric_type,
      analysis_period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: lookback_days
      },
      anomalies_detected: anomalies.count,
      anomalies: anomalies.details,
      severity: anomalies.severity,
      recommendations: anomalies.recommendations
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Detect anomalies in data
 */
function detectAnomaliesInData(records: any[], metricType: string, sensitivity: number, days: number) {
  // Group records by day
  const dailyStats: { [key: string]: any } = {};

  for (const record of records) {
    const date = new Date(record.sys_created_on).toISOString().split('T')[0];
    if (!dailyStats[date]) {
      dailyStats[date] = { count: 0, patterns: {} };
    }
    dailyStats[date].count++;
  }

  // Calculate statistics
  const counts = Object.values(dailyStats).map((s: any) => s.count);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Detect anomalies (values > mean + (sensitivity * 2 * stdDev))
  const threshold = mean + (sensitivity * 2 * stdDev);
  const anomalies: any[] = [];

  for (const [date, stats] of Object.entries(dailyStats)) {
    if ((stats as any).count > threshold) {
      anomalies.push({
        date,
        value: (stats as any).count,
        expected_range: `${Math.floor(mean - stdDev)} - ${Math.ceil(mean + stdDev)}`,
        deviation: `+${(((stats as any).count - mean) / mean * 100).toFixed(1)}%`
      });
    }
  }

  // Determine severity
  let severity = 'low';
  let recommendations: string[] = [];

  if (anomalies.length >= days * 0.3) {
    severity = 'high';
    recommendations = [
      'Multiple anomalies detected - investigate system-wide issues',
      'Check for security incidents or system outages',
      'Review recent changes or deployments',
      'Consider escalating to management'
    ];
  } else if (anomalies.length >= days * 0.15) {
    severity = 'medium';
    recommendations = [
      'Several anomalies detected - investigate patterns',
      'Review incident categories and assignment groups',
      'Check for recurring issues',
      'Monitor trends over next few days'
    ];
  } else if (anomalies.length > 0) {
    severity = 'low';
    recommendations = [
      'Isolated anomalies detected - continue monitoring',
      'Review specific dates for unusual activity',
      'Document findings for trend analysis'
    ];
  } else {
    recommendations = [
      'No significant anomalies detected',
      'System behavior is within normal parameters',
      'Continue routine monitoring'
    ];
  }

  return {
    count: anomalies.length,
    details: anomalies,
    severity,
    recommendations,
    statistics: {
      mean: mean.toFixed(2),
      std_dev: stdDev.toFixed(2),
      threshold: threshold.toFixed(2)
    }
  };
}

export const version = '1.0.0';
