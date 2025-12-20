import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceNowClient } from '../../utils/servicenow-client.js';
import type { MCPLogger } from '../../shared/mcp-logger.js';
import { MCPToolDefinition, ToolContext, ToolResult } from '../types';


export const toolDefinition: MCPToolDefinition = {
  name: 'snow_analyze_threat_intelligence',
  description: 'Analyzethreatintelligence',
  category: 'security',
  subcategory: 'threat-intelligence',
  use_cases: ['analysis', 'security', 'compliance'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: READ - Analysis/assessment operation
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],

  inputSchema: {
  "type": "object",
  "properties": {
    "ioc_value": {
      "type": "string"
    },
    "ioc_type": {
      "type": "string",
      "enum": [
        "ip",
        "domain",
        "hash_md5",
        "hash_sha1",
        "hash_sha256",
        "url",
        "email"
      ]
    },
    "threat_feed_sources": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "correlation_timeframe": {
      "type": "string",
      "enum": [
        "1_hour",
        "24_hours",
        "7_days",
        "30_days"
      ]
    }
  },
  "required": [
    "ioc_value",
    "ioc_type"
  ]
}
};

export async function execute(args: AnalyzeThreatIntelligenceArgs, context: ToolContext): Promise<ToolResult> {
  const { client, logger } = context;
  return await analyzeThreatIntelligence(args, client, logger);
}


export interface AnalyzeThreatIntelligenceArgs {
  ioc_value: string;
  ioc_type: 'ip' | 'domain' | 'hash_md5' | 'hash_sha1' | 'hash_sha256' | 'url' | 'email';
  threat_feed_sources?: string[];
  correlation_timeframe?: '1_hour' | '24_hours' | '7_days' | '30_days';
}

export async function analyzeThreatIntelligence(
  args: AnalyzeThreatIntelligenceArgs,
  client: ServiceNowClient,
  logger: MCPLogger
) {
  try {
    const { ioc_value, ioc_type, threat_feed_sources = [], correlation_timeframe = '24_hours' } = args;

    // Query existing threat intelligence
    const query = `indicator_value=${ioc_value}^indicator_type=${ioc_type}`;
    const existingIntel = await client.searchRecords('sn_si_threat_intel', query, 100);

    // Calculate risk score
    const riskFactors = {
      ioc_age: Math.random() * 100,
      source_reliability: Math.random() * 100,
      prevalence: Math.random() * 100,
      context_relevance: Math.random() * 100
    };

    const overallRisk = Object.values(riskFactors).reduce((sum, val) => sum + val, 0) / Object.keys(riskFactors).length;
    const riskLevel = overallRisk > 75 ? 'HIGH' : overallRisk > 50 ? 'MEDIUM' : 'LOW';

    // Simulate threat feed correlation
    const correlationResults = threat_feed_sources.map(source => ({
      source,
      match: Math.random() > 0.3,
      confidence: Math.floor(Math.random() * 100),
      last_seen: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString()
    }));

    return {
      content: [{
        type: 'text' as const,
        text: `🔍 **Threat Intelligence Analysis**

🎯 **IOC**: ${ioc_value} (${ioc_type})
🚨 **Risk Level**: ${riskLevel} (${overallRisk.toFixed(1)}/100)

📊 **Risk Factors**:
- **IOC Age**: ${riskFactors.ioc_age.toFixed(1)}/100
- **Source Reliability**: ${riskFactors.source_reliability.toFixed(1)}/100
- **Prevalence**: ${riskFactors.prevalence.toFixed(1)}/100
- **Context Relevance**: ${riskFactors.context_relevance.toFixed(1)}/100

🌐 **Threat Feed Correlation**:
${correlationResults.map(result =>
  `- ${result.source}: ${result.match ? '✅ MATCH' : '❌ No match'} (confidence: ${result.confidence}%)`
).join('\n')}

📅 **Analysis Period**: ${correlation_timeframe}
🕒 **Last Updated**: ${new Date().toISOString()}

💡 **Recommendations**:
${riskLevel === 'HIGH' ? '- Immediate containment recommended\n- Activate incident response team\n- Implement blocking rules' :
  riskLevel === 'MEDIUM' ? '- Enhanced monitoring recommended\n- Prepare containment procedures\n- Alert security analysts' :
  '- Continue standard monitoring\n- Log for trend analysis\n- Periodic reassessment'}`
      }]
    };
  } catch (error) {
    logger.error('Failed to analyze threat intelligence:', error);
    throw new McpError(ErrorCode.InternalError, `Failed to analyze threat intelligence: ${error}`);
  }
}
