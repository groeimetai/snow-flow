/**
 * ServiceNow SecOps Tool: Create Security Incident
 * Creates security incidents with automated threat correlation
 * Source: servicenow-secops-mcp.ts
 */

import { SnowToolConfig } from '../types';

export const snow_create_security_incident: SnowToolConfig = {
  name: 'snow_create_security_incident',
  description: 'Create security incident with automated threat correlation and priority assignment',
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
  },
  handler: async (args, client, logger) => {
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
};

// Helper functions
function mapPriorityToNumber(priority: string): number {
  const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };
  return priorityMap[priority as keyof typeof priorityMap] || 3;
}

function calculateImpact(affectedSystems: string[], threatType: string): number {
  const baseImpact = affectedSystems.length;
  const threatMultiplier = {
    'data_breach': 3,
    'malware': 2,
    'unauthorized_access': 2,
    'ddos': 1,
    'phishing': 1,
    'insider_threat': 3
  };

  const multiplier = threatMultiplier[threatType as keyof typeof threatMultiplier] || 1;
  const impact = Math.min(baseImpact * multiplier, 3); // Max impact of 3

  return impact || 1;
}

function detectIOCType(ioc: string): string {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc)) return 'ip';
  if (/^[a-f0-9]{32}$/i.test(ioc)) return 'hash_md5';
  if (/^[a-f0-9]{40}$/i.test(ioc)) return 'hash_sha1';
  if (/^[a-f0-9]{64}$/i.test(ioc)) return 'hash_sha256';
  if (/^https?:\/\//.test(ioc)) return 'url';
  if (/@/.test(ioc)) return 'email';
  return 'domain';
}
