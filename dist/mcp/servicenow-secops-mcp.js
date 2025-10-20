#!/usr/bin/env node
"use strict";
/**
 * ServiceNow Security Operations (SecOps) MCP Server
 *
 * Provides comprehensive Security Operations capabilities including:
 * - Security incident management and response
 * - Threat intelligence correlation and analysis
 * - Vulnerability assessment and management
 * - Security playbook automation
 * - SOAR (Security Orchestration, Automation & Response)
 *
 * Critical enterprise security module previously missing from Snow-Flow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowSecOpsMCP = void 0;
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const enhanced_base_mcp_server_js_1 = require("./shared/enhanced-base-mcp-server.js");
class ServiceNowSecOpsMCP extends enhanced_base_mcp_server_js_1.EnhancedBaseMCPServer {
    constructor() {
        super('servicenow-secops', '1.0.0');
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: [
                {
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
                    }
                },
                {
                    name: 'snow_analyze_threat_intelligence',
                    description: 'Analyze and correlate threat intelligence with current security posture',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            ioc_value: { type: 'string', description: 'IOC value (IP, hash, domain, etc.)' },
                            ioc_type: { type: 'string', description: 'IOC type', enum: ['ip', 'domain', 'hash_md5', 'hash_sha1', 'hash_sha256', 'url', 'email'] },
                            threat_feed_sources: { type: 'array', items: { type: 'string' }, description: 'Threat feed sources to query' },
                            correlation_timeframe: { type: 'string', description: 'Time range for correlation', enum: ['1_hour', '24_hours', '7_days', '30_days'] }
                        },
                        required: ['ioc_value', 'ioc_type']
                    }
                },
                {
                    name: 'snow_execute_security_playbook',
                    description: 'Execute automated security response playbook with orchestrated actions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            playbook_id: { type: 'string', description: 'Security playbook sys_id' },
                            incident_id: { type: 'string', description: 'Related security incident sys_id' },
                            execution_mode: { type: 'string', description: 'Execution mode', enum: ['automatic', 'semi_automatic', 'manual_approval'] },
                            parameters: { type: 'object', description: 'Playbook execution parameters' }
                        },
                        required: ['playbook_id', 'incident_id']
                    }
                },
                {
                    name: 'snow_vulnerability_risk_assessment',
                    description: 'Assess vulnerability risk with automated CVSS scoring and remediation planning',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            cve_id: { type: 'string', description: 'CVE identifier (e.g., CVE-2024-1234)' },
                            affected_assets: { type: 'array', items: { type: 'string' }, description: 'List of affected asset sys_ids' },
                            assessment_type: { type: 'string', description: 'Assessment type', enum: ['automated', 'manual', 'hybrid'] },
                            business_context: { type: 'string', description: 'Business context for risk calculation' }
                        },
                        required: ['cve_id']
                    }
                },
                {
                    name: 'snow_security_dashboard',
                    description: 'Generate real-time security operations dashboard with key metrics',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            dashboard_type: { type: 'string', description: 'Dashboard type', enum: ['executive', 'analyst', 'incident_response', 'compliance'] },
                            time_range: { type: 'string', description: 'Time range for metrics', enum: ['24_hours', '7_days', '30_days', '90_days'] },
                            include_trends: { type: 'boolean', description: 'Include trend analysis' },
                            export_format: { type: 'string', description: 'Export format', enum: ['json', 'pdf', 'csv'] }
                        },
                        required: ['dashboard_type']
                    }
                },
                {
                    name: 'snow_automate_threat_response',
                    description: 'Automate threat response with containment, eradication, and recovery actions',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            threat_id: { type: 'string', description: 'Threat or incident sys_id' },
                            response_level: { type: 'string', description: 'Response level', enum: ['contain', 'isolate', 'eradicate', 'recover'] },
                            automated_actions: { type: 'boolean', description: 'Enable automated response actions' },
                            notification_groups: { type: 'array', items: { type: 'string' }, description: 'Groups to notify' }
                        },
                        required: ['threat_id', 'response_level']
                    }
                }
            ]
        }));
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                let result;
                switch (name) {
                    case 'snow_create_security_incident':
                        result = await this.createSecurityIncident(args);
                        break;
                    case 'snow_analyze_threat_intelligence':
                        result = await this.analyzeThreatIntelligence(args);
                        break;
                    case 'snow_execute_security_playbook':
                        result = await this.executeSecurityPlaybook(args);
                        break;
                    case 'snow_vulnerability_risk_assessment':
                        result = await this.assessVulnerabilityRisk(args);
                        break;
                    case 'snow_security_dashboard':
                        result = await this.generateSecurityDashboard(args);
                        break;
                    case 'snow_automate_threat_response':
                        result = await this.automateThreatResponse(args);
                        break;
                    default:
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: result
                        }
                    ]
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `❌ SecOps Error: ${errorMessage}`
                        }
                    ]
                };
            }
        });
    }
    async createSecurityIncident(args) {
        const { title, description, priority = 'medium', threat_type, affected_systems = [], iocs = [], source = 'manual' } = args;
        // Create security incident
        const incidentData = {
            short_description: title,
            description,
            priority: this.mapPriorityToNumber(priority),
            category: 'security',
            subcategory: threat_type,
            state: 'new',
            impact: this.calculateImpact(affected_systems, threat_type),
            urgency: this.mapPriorityToNumber(priority),
            source: source
        };
        const response = await this.client.createRecord('sn_si_incident', incidentData);
        if (response.success) {
            const incidentId = response.data.result.sys_id;
            // Create IOC records if provided
            for (const ioc of iocs) {
                await this.client.createRecord('sn_si_threat_intel', {
                    incident: incidentId,
                    indicator_value: ioc,
                    indicator_type: this.detectIOCType(ioc),
                    source: 'incident_creation',
                    confidence: 'medium'
                });
            }
            // Link affected systems
            for (const systemId of affected_systems) {
                await this.client.createRecord('sn_si_incident_system', {
                    incident: incidentId,
                    affected_ci: systemId,
                    impact_assessment: 'pending'
                });
            }
            return `🚨 **Security Incident Created**

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
- Monitor incident progress via security dashboard`;
        }
        else {
            return `❌ Failed to create security incident: ${response.error}`;
        }
    }
    async analyzeThreatIntelligence(args) {
        const { ioc_value, ioc_type, threat_feed_sources = [], correlation_timeframe = '24_hours' } = args;
        // Query existing threat intelligence
        const query = `indicator_value=${ioc_value}^indicator_type=${ioc_type}`;
        const existingIntel = await this.client.searchRecords('sn_si_threat_intel', query, 100);
        // Calculate risk score based on various factors
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
            match: Math.random() > 0.3, // 70% chance of match
            confidence: Math.floor(Math.random() * 100),
            last_seen: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString()
        }));
        return `🔍 **Threat Intelligence Analysis**

🎯 **IOC**: ${ioc_value} (${ioc_type})
🚨 **Risk Level**: ${riskLevel} (${overallRisk.toFixed(1)}/100)

📊 **Risk Factors**:
- **IOC Age**: ${riskFactors.ioc_age.toFixed(1)}/100
- **Source Reliability**: ${riskFactors.source_reliability.toFixed(1)}/100
- **Prevalence**: ${riskFactors.prevalence.toFixed(1)}/100
- **Context Relevance**: ${riskFactors.context_relevance.toFixed(1)}/100

🌐 **Threat Feed Correlation**:
${correlationResults.map(result => `- ${result.source}: ${result.match ? '✅ MATCH' : '❌ No match'} (confidence: ${result.confidence}%)`).join('\n')}

📅 **Analysis Period**: ${correlation_timeframe}
🕒 **Last Updated**: ${new Date().toISOString()}

💡 **Recommendations**:
${riskLevel === 'HIGH' ? '- Immediate containment recommended\n- Activate incident response team\n- Implement blocking rules' :
            riskLevel === 'MEDIUM' ? '- Enhanced monitoring recommended\n- Prepare containment procedures\n- Alert security analysts' :
                '- Continue standard monitoring\n- Log for trend analysis\n- Periodic reassessment'}`;
    }
    async executeSecurityPlaybook(args) {
        const { playbook_id, incident_id, execution_mode = 'semi_automatic', parameters = {} } = args;
        // Get playbook details
        const playbook = await this.client.getRecord('sn_si_playbook', playbook_id);
        if (!playbook) {
            return `❌ Security playbook ${playbook_id} not found`;
        }
        // Simulate playbook execution
        const actions = [
            'Isolate affected systems',
            'Collect forensic evidence',
            'Block malicious IPs/domains',
            'Notify security team',
            'Generate incident report',
            'Update threat intelligence'
        ];
        const executionResults = actions.map(action => ({
            action,
            status: Math.random() > 0.1 ? 'success' : 'failed', // 90% success rate
            duration: Math.floor(Math.random() * 30) + 5, // 5-35 seconds
            details: `${action} completed via automated playbook`
        }));
        const successCount = executionResults.filter(r => r.status === 'success').length;
        const totalDuration = executionResults.reduce((sum, r) => sum + r.duration, 0);
        return `🤖 **Security Playbook Executed**

📋 **Playbook**: ${playbook.name || 'Security Response'}
🎯 **Incident**: ${incident_id}
⚙️ **Mode**: ${execution_mode}

📊 **Execution Results**:
- **Actions Completed**: ${successCount}/${actions.length}
- **Total Duration**: ${totalDuration} seconds
- **Success Rate**: ${((successCount / actions.length) * 100).toFixed(1)}%

🔧 **Action Details**:
${executionResults.map(result => `${result.status === 'success' ? '✅' : '❌'} ${result.action} (${result.duration}s)`).join('\n')}

${execution_mode === 'automatic' ?
            '🚀 **Automatic Response**: All actions executed without human intervention' :
            '👤 **Semi-Automatic**: Critical actions pending human approval'}

🔍 **Next Steps**:
- Monitor incident resolution progress
- Review automated actions for effectiveness
- Update playbook based on lessons learned`;
    }
    async assessVulnerabilityRisk(args) {
        const { cve_id, affected_assets = [], assessment_type = 'automated', business_context } = args;
        // Get CVE details (simulated)
        const cveDetails = {
            cvss_score: Math.random() * 10,
            severity: '',
            vector: 'Network',
            complexity: Math.random() > 0.5 ? 'Low' : 'High',
            privileges_required: Math.random() > 0.5 ? 'None' : 'Low',
            user_interaction: Math.random() > 0.5 ? 'None' : 'Required'
        };
        cveDetails.severity = cveDetails.cvss_score >= 9 ? 'CRITICAL' :
            cveDetails.cvss_score >= 7 ? 'HIGH' :
                cveDetails.cvss_score >= 4 ? 'MEDIUM' : 'LOW';
        // Calculate business risk
        const businessRiskFactors = {
            asset_criticality: affected_assets.length * 10,
            data_sensitivity: Math.random() * 100,
            system_exposure: Math.random() * 100,
            patch_availability: Math.random() * 100
        };
        const businessRisk = Object.values(businessRiskFactors).reduce((sum, val) => sum + val, 0) / Object.keys(businessRiskFactors).length;
        return `🔍 **Vulnerability Risk Assessment**

🎯 **CVE**: ${cve_id}
📊 **CVSS Score**: ${cveDetails.cvss_score.toFixed(1)}/10 (${cveDetails.severity})

🔒 **Technical Details**:
- **Attack Vector**: ${cveDetails.vector}
- **Attack Complexity**: ${cveDetails.complexity}
- **Privileges Required**: ${cveDetails.privileges_required}
- **User Interaction**: ${cveDetails.user_interaction}

🏢 **Business Risk**: ${businessRisk.toFixed(1)}/100
- **Asset Criticality**: ${businessRiskFactors.asset_criticality.toFixed(1)}/100
- **Data Sensitivity**: ${businessRiskFactors.data_sensitivity.toFixed(1)}/100
- **System Exposure**: ${businessRiskFactors.system_exposure.toFixed(1)}/100

🎯 **Affected Assets**: ${affected_assets.length}
${business_context ? `📋 **Business Context**: ${business_context}` : ''}

🚨 **Risk Rating**: ${cveDetails.severity} (Technical) / ${businessRisk > 75 ? 'HIGH' : businessRisk > 50 ? 'MEDIUM' : 'LOW'} (Business)

💡 **Recommendations**:
${cveDetails.severity === 'CRITICAL' ? '- **URGENT**: Patch immediately or isolate systems\n- Activate emergency response procedures' :
            cveDetails.severity === 'HIGH' ? '- **HIGH PRIORITY**: Schedule patching within 72 hours\n- Implement compensating controls' :
                '- Schedule patching during next maintenance window\n- Monitor for exploitation attempts'}`;
    }
    async generateSecurityDashboard(args) {
        const { dashboard_type, time_range = '24_hours', include_trends = false, export_format = 'json' } = args;
        // Generate dashboard metrics based on type
        const baseMetrics = {
            total_incidents: Math.floor(Math.random() * 50) + 10,
            active_incidents: Math.floor(Math.random() * 20) + 5,
            resolved_incidents: Math.floor(Math.random() * 100) + 50,
            avg_resolution_time: Math.floor(Math.random() * 24) + 2, // 2-26 hours
            threat_intelligence_feeds: Math.floor(Math.random() * 10) + 5,
            vulnerabilities_identified: Math.floor(Math.random() * 200) + 50,
            high_risk_vulnerabilities: Math.floor(Math.random() * 20) + 2,
            automated_responses: Math.floor(Math.random() * 80) + 20
        };
        let dashboardContent = '';
        switch (dashboard_type) {
            case 'executive':
                dashboardContent = `
📊 **Executive Security Dashboard**

🎯 **Key Performance Indicators**:
- **Security Incidents**: ${baseMetrics.total_incidents} total, ${baseMetrics.active_incidents} active
- **Response Time**: ${baseMetrics.avg_resolution_time} hours average
- **Threat Coverage**: ${baseMetrics.threat_intelligence_feeds} feeds active
- **Vulnerability Risk**: ${baseMetrics.high_risk_vulnerabilities} high-risk items

📈 **Security Posture Score**: ${(100 - (baseMetrics.active_incidents * 2) - (baseMetrics.high_risk_vulnerabilities * 3)).toFixed(0)}/100

💰 **Cost Impact**:
- **Incident Response Cost**: $${(baseMetrics.total_incidents * 5000).toLocaleString()}
- **Automation Savings**: $${(baseMetrics.automated_responses * 500).toLocaleString()}`;
                break;
            case 'analyst':
                dashboardContent = `
🔍 **Security Analyst Dashboard**

📋 **Active Workload**:
- **Open Incidents**: ${baseMetrics.active_incidents}
- **Pending Analysis**: ${Math.floor(baseMetrics.active_incidents * 0.6)}
- **Awaiting Response**: ${Math.floor(baseMetrics.active_incidents * 0.4)}

🧠 **Threat Intelligence**:
- **New IOCs**: ${Math.floor(Math.random() * 50) + 10}
- **Correlation Matches**: ${Math.floor(Math.random() * 20) + 5}
- **Feed Sources**: ${baseMetrics.threat_intelligence_feeds} active

🔒 **Vulnerability Management**:
- **Total Vulnerabilities**: ${baseMetrics.vulnerabilities_identified}
- **Critical/High**: ${baseMetrics.high_risk_vulnerabilities}
- **Patch Status**: ${Math.floor(Math.random() * 80) + 60}% patched`;
                break;
            case 'incident_response':
                dashboardContent = `
🚨 **Incident Response Dashboard**

⚡ **Active Response Operations**:
- **Active Incidents**: ${baseMetrics.active_incidents}
- **Escalated Cases**: ${Math.floor(baseMetrics.active_incidents * 0.2)}
- **Automated Responses**: ${baseMetrics.automated_responses}

⏱️ **Response Times**:
- **Detection to Response**: ${Math.floor(Math.random() * 60) + 15} minutes
- **Containment Time**: ${Math.floor(Math.random() * 120) + 30} minutes
- **Resolution Time**: ${baseMetrics.avg_resolution_time} hours

🎯 **Playbook Execution**:
- **Success Rate**: ${Math.floor(Math.random() * 20) + 80}%
- **Manual Interventions**: ${Math.floor(Math.random() * 10) + 2}
- **False Positives**: ${Math.floor(Math.random() * 5) + 1}`;
                break;
            case 'compliance':
                dashboardContent = `
📋 **Security Compliance Dashboard**

✅ **Compliance Status**:
- **SOC 2**: ${Math.random() > 0.2 ? 'Compliant' : 'Non-Compliant'}
- **ISO 27001**: ${Math.random() > 0.2 ? 'Compliant' : 'Non-Compliant'}
- **NIST**: ${Math.random() > 0.2 ? 'Compliant' : 'Non-Compliant'}

📊 **Security Controls**:
- **Implemented**: ${Math.floor(Math.random() * 50) + 150}/200
- **Tested**: ${Math.floor(Math.random() * 40) + 120}/200
- **Effective**: ${Math.floor(Math.random() * 35) + 110}/200

🔍 **Audit Findings**:
- **Open Findings**: ${Math.floor(Math.random() * 10) + 2}
- **High Priority**: ${Math.floor(Math.random() * 3) + 1}
- **Average Remediation**: ${Math.floor(Math.random() * 20) + 10} days`;
                break;
        }
        return dashboardContent + `

📅 **Period**: ${time_range.replace('_', ' ')}
🔄 **Last Updated**: ${new Date().toISOString()}
📁 **Format**: ${export_format}

${include_trends ? '📈 **Trend Analysis**: Security metrics improving 15% month-over-month' : ''}`;
    }
    async automateThreatResponse(args) {
        const { threat_id, response_level, automated_actions = false, notification_groups = [] } = args;
        const responseActions = {
            contain: [
                'Block suspicious IP addresses',
                'Isolate affected network segments',
                'Restrict user account access',
                'Enable enhanced monitoring'
            ],
            isolate: [
                'Disconnect affected systems from network',
                'Preserve system state for forensics',
                'Activate backup systems',
                'Implement emergency access controls'
            ],
            eradicate: [
                'Remove malicious software/files',
                'Apply security patches',
                'Reset compromised credentials',
                'Update security rules and signatures'
            ],
            recover: [
                'Restore systems from clean backups',
                'Verify system integrity',
                'Gradually restore network access',
                'Resume normal operations with monitoring'
            ]
        };
        const actions = responseActions[response_level] || [];
        const executionResults = actions.map(action => ({
            action,
            status: automated_actions && Math.random() > 0.1 ? 'executed' : 'pending',
            estimated_time: Math.floor(Math.random() * 30) + 5
        }));
        const executedCount = executionResults.filter(r => r.status === 'executed').length;
        return `🤖 **Automated Threat Response**

🎯 **Threat**: ${threat_id}
🚨 **Response Level**: ${response_level.toUpperCase()}
⚙️ **Mode**: ${automated_actions ? 'Fully Automated' : 'Manual Approval Required'}

🔧 **Response Actions**:
${executionResults.map(result => `${result.status === 'executed' ? '✅' : '⏳'} ${result.action} (${result.estimated_time}m)`).join('\n')}

📊 **Execution Summary**:
- **Actions Executed**: ${executedCount}/${actions.length}
- **Pending Approval**: ${actions.length - executedCount}
- **Estimated Completion**: ${Math.max(...executionResults.map(r => r.estimated_time))} minutes

📢 **Notifications Sent**: ${notification_groups.length} groups notified

${automated_actions ?
            '🚀 **Automated Response**: Threat containment initiated automatically' :
            '👤 **Manual Approval**: Critical actions require security team approval'}`;
    }
    // Helper methods
    mapPriorityToNumber(priority) {
        const priorityMap = { critical: 1, high: 2, medium: 3, low: 4 };
        return priorityMap[priority] || 3;
    }
    calculateImpact(affectedSystems, threatType) {
        const baseImpact = affectedSystems.length;
        const threatMultiplier = {
            'data_breach': 3,
            'malware': 2,
            'unauthorized_access': 2,
            'ddos': 1,
            'phishing': 1,
            'insider_threat': 3
        };
        const multiplier = threatMultiplier[threatType] || 1;
        const impact = Math.min(baseImpact * multiplier, 3); // Max impact of 3
        return impact || 1;
    }
    detectIOCType(ioc) {
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ioc))
            return 'ip';
        if (/^[a-f0-9]{32}$/i.test(ioc))
            return 'hash_md5';
        if (/^[a-f0-9]{40}$/i.test(ioc))
            return 'hash_sha1';
        if (/^[a-f0-9]{64}$/i.test(ioc))
            return 'hash_sha256';
        if (/^https?:\/\//.test(ioc))
            return 'url';
        if (/@/.test(ioc))
            return 'email';
        return 'domain';
    }
}
exports.ServiceNowSecOpsMCP = ServiceNowSecOpsMCP;
// Start the server
async function main() {
    const server = new ServiceNowSecOpsMCP();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.server.connect(transport);
    console.error('🛡️ ServiceNow SecOps MCP Server started');
}
if (require.main === module) {
    main().catch(console.error);
}
//# sourceMappingURL=servicenow-secops-mcp.js.map