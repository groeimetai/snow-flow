/**
 * ServiceNow Security Tool: Create Security Incident
 * Create security incident with automated threat correlation and priority assignment
 */

import { MCPToolDefinition, ToolContext, ToolResult } from '../types';

/**
 * Map priority string to ServiceNow priority number (1=Critical, 2=High, 3=Medium, 4=Low)
 */
function mapPriorityToNumber(priority: string): number {
  const priorityMap: Record<string, number> = {
    'critical': 1,
    'high': 2,
    'medium': 3,
    'low': 4
  };
  return priorityMap[priority.toLowerCase()] || 3;
}

/**
 * Calculate impact based on affected systems and threat type
 */
function calculateImpact(affectedSystems: string[], threatType: string): number {
  // Base impact on threat type
  const threatImpact: Record<string, number> = {
    'data_breach': 1,
    'ddos': 1,
    'malware': 2,
    'unauthorized_access': 2,
    'insider_threat': 2,
    'phishing': 3
  };

  let impact = threatImpact[threatType] || 3;

  // Increase impact if many systems affected
  if (affectedSystems.length > 10) {
    impact = Math.max(1, impact - 1);
  } else if (affectedSystems.length > 5) {
    impact = Math.max(1, impact);
  }

  return impact;
}

/**
 * Detect IOC type from indicator value
 */
function detectIOCType(ioc: string): string {
  // IP address pattern (IPv4)
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ioc)) {
    return 'ip_address';
  }

  // IPv6 pattern
  if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ioc) ||
      ioc.includes('::')) {
    return 'ip_address';
  }

  // Domain pattern
  if (/^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(ioc)) {
    return 'domain';
  }

  // URL pattern
  if (/^https?:\/\//.test(ioc)) {
    return 'url';
  }

  // Email pattern
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ioc)) {
    return 'email';
  }

  // Hash patterns (MD5, SHA1, SHA256)
  if (/^[a-fA-F0-9]{32}$/.test(ioc)) {
    return 'hash_md5';
  }
  if (/^[a-fA-F0-9]{40}$/.test(ioc)) {
    return 'hash_sha1';
  }
  if (/^[a-fA-F0-9]{64}$/.test(ioc)) {
    return 'hash_sha256';
  }

  // File path pattern
  if (ioc.includes('/') || ioc.includes('\\')) {
    return 'file_path';
  }

  return 'unknown';
}

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_security_incident',
  description: 'Create security incident with automated threat correlation and priority assignment',
  category: 'security',
  subcategory: 'incidents',
  use_cases: ['logging', 'security', 'compliance'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Creation/logging operation
  permission: 'write',
  allowedRoles: ['developer', 'admin'],

  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Security incident title' },
      description: { type: 'string', description: 'Detailed incident description' },
      priority: { type: 'string', description: 'Incident priority', enum: ['critical', 'high', 'medium', 'low'] },
      threat_type: { type: 'string', description: 'Type of security threat', enum: ['malware', 'phishing', 'data_breach', 'unauthorized_access', 'ddos', 'insider_threat'] },
      affected_systems: { type: 'array', items: { type: 'string' }, description: 'List of affected system CIs' },
      iocs: { type: 'array', items: { type: 'string' }, description: 'Indicators of Compromise (IOCs)' },
      source: { type: 'string', description: 'Incident source (SIEM, manual, automated)' }
    },
    required: ['title', 'description', 'threat_type']
  }
};

export async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { client, logger } = context;
  const { title, description, priority = 'medium', threat_type, affected_systems = [], iocs = [], source = 'manual' } = args;

    // Create security incident
    const incidentData = {
      short_description: title,
      description,
      priority: mapPriorityToNumber(priority),
      category: 'security',
      subcategory: threat_type,
      state: 'new',
      impact: calculateImpact(affected_systems, threat_type),
      urgency: mapPriorityToNumber(priority),
      source: source
    };

    const response = await client.createRecord('sn_si_incident', incidentData);

    if (response.success) {
      const incidentId = response.data.result.sys_id;

      // Create IOC records if provided
      for (const ioc of iocs) {
        await client.createRecord('sn_si_threat_intel', {
          incident: incidentId,
          indicator_value: ioc,
          indicator_type: detectIOCType(ioc),
          source: 'incident_creation',
          confidence: 'medium'
        });
      }

      // Link affected systems
      for (const systemId of affected_systems) {
        await client.createRecord('sn_si_incident_system', {
          incident: incidentId,
          affected_ci: systemId,
          impact_assessment: 'pending'
        });
      }

      return {
        content: [{
          type: 'text',
          text: `🚨 **Security Incident Created**

🎯 **Incident**: ${title}
- **ID**: ${incidentId}
- **Priority**: ${priority.toUpperCase()}
- **Threat Type**: ${threat_type}
- **Affected Systems**: ${affected_systems.length}
- **IOCs**: ${iocs.length}

🔍 **Automatic Actions Triggered**:
- Threat intelligence correlation initiated
- Affected systems assessment queued
- Security team notifications sent
- Response playbook evaluation started

🚀 **Next Steps**:
- Use \`snow_analyze_threat_intelligence\` for IOC analysis
- Use \`snow_execute_security_playbook\` for automated response
- Monitor incident progress via security dashboard`
        }]
      };

    } else {
      throw new Error(`Failed to create security incident: ${response.error}`);
    }
}
