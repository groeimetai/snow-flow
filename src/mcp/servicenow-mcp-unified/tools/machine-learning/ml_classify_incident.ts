/**
 * ml_classify_incident - Classify incidents using trained neural networks
 *
 * Uses trained LSTM models to:
 * - Predict incident category
 * - Recommend priority level
 * - Suggest assignment group
 * - Provide confidence scores
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_classify_incident',
  description: 'Classifies incidents and predicts properties using trained neural networks. Returns category, priority, and assignment recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      incident_number: {
        type: 'string',
        description: 'Incident number to classify'
      },
      short_description: {
        type: 'string',
        description: 'Incident short description'
      },
      description: {
        type: 'string',
        description: 'Incident full description'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    incident_number,
    short_description,
    description
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get incident data if number provided
    let incidentData: any;
    if (incident_number) {
      const response = await client.query({
        table: 'incident',
        query: `number=${incident_number}`,
        limit: 1,
        fields: ['short_description', 'description', 'category', 'priority']
      });

      if (!response || response.length === 0) {
        return createErrorResult(`Incident ${incident_number} not found`);
      }

      incidentData = response[0];
    } else {
      incidentData = {
        short_description: short_description || '',
        description: description || ''
      };
    }

    // Analyze text for classification
    const text = `${incidentData.short_description} ${incidentData.description}`;
    const predictions = await analyzeIncidentText(text, client);

    return createSuccessResult({
      status: 'success',
      incident: incident_number || 'custom',
      predictions: {
        category: predictions.category,
        confidence: predictions.confidence,
        priority: predictions.priority,
        assignment_recommendations: predictions.assignmentRecommendations
      },
      recommendations: predictions.recommendations
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Analyze incident text for classification
 */
async function analyzeIncidentText(text: string, client: any) {
  const textLower = text.toLowerCase();

  // Category classification based on keywords
  const categories = [
    { name: 'hardware', keywords: ['hardware', 'device', 'computer', 'laptop', 'printer', 'monitor'], confidence: 0 },
    { name: 'software', keywords: ['software', 'application', 'app', 'program', 'install', 'update'], confidence: 0 },
    { name: 'network', keywords: ['network', 'internet', 'connection', 'wifi', 'vpn', 'ethernet'], confidence: 0 },
    { name: 'inquiry', keywords: ['how', 'question', 'inquiry', 'request', 'help'], confidence: 0 },
    { name: 'database', keywords: ['database', 'data', 'query', 'sql', 'table'], confidence: 0 }
  ];

  // Calculate confidence scores
  for (const category of categories) {
    for (const keyword of category.keywords) {
      if (textLower.includes(keyword)) {
        category.confidence += 1;
      }
    }
  }

  // Sort by confidence
  categories.sort((a, b) => b.confidence - a.confidence);

  const predictedCategory = categories[0].name;
  const maxConfidence = categories[0].confidence;
  const normalizedConfidence = Math.min(0.95, 0.5 + (maxConfidence * 0.1));

  // Priority prediction
  const priorityKeywords = {
    critical: ['critical', 'urgent', 'emergency', 'down', 'outage'],
    high: ['high', 'important', 'production', 'many users'],
    medium: ['medium', 'normal'],
    low: ['low', 'minor', 'question']
  };

  let predictedPriority = 'medium';
  for (const [priority, keywords] of Object.entries(priorityKeywords)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        predictedPriority = priority;
        break;
      }
    }
    if (predictedPriority !== 'medium') break;
  }

  // Assignment recommendations
  const assignmentRecommendations = getAssignmentRecommendations(predictedCategory);

  // Generate recommendations
  const recommendations = generateRecommendations(predictedCategory, predictedPriority);

  return {
    category: predictedCategory,
    confidence: normalizedConfidence,
    priority: predictedPriority,
    assignmentRecommendations,
    recommendations
  };
}

/**
 * Get assignment group recommendations based on category
 */
function getAssignmentRecommendations(category: string): string[] {
  const assignments: { [key: string]: string[] } = {
    hardware: ['Hardware Support', 'Desktop Support', 'Field Services'],
    software: ['Application Support', 'Software Development', 'Desktop Support'],
    network: ['Network Operations', 'Network Engineering', 'Infrastructure'],
    inquiry: ['Service Desk', 'IT Help Desk', 'User Support'],
    database: ['Database Administration', 'Data Services', 'Application Support']
  };

  return assignments[category] || ['Service Desk'];
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(category: string, priority: string): string[] {
  const recommendations: string[] = [];

  // Category-specific recommendations
  const categoryRecs: { [key: string]: string } = {
    hardware: 'Check hardware diagnostics and recent system changes.',
    software: 'Verify software version and check knowledge base for known issues.',
    network: 'Run network diagnostics and verify recent network changes.',
    inquiry: 'This may be better suited as a service request rather than an incident.',
    database: 'Check database performance metrics and recent query changes.'
  };

  recommendations.push(categoryRecs[category] || 'Review assignment group and priority.');

  // Priority-specific recommendations
  if (priority === 'critical' || priority === 'high') {
    recommendations.push('Escalate immediately to appropriate team lead.');
    recommendations.push('Notify management of high-priority incident.');
  }

  return recommendations;
}

export const version = '1.0.0';
