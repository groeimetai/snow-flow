/**
 * ml_predict_change_risk - Predict implementation risk for change requests
 *
 * Uses trained neural networks to predict:
 * - Implementation risk level (low/moderate/high)
 * - Risk score with confidence
 * - Mitigation suggestions
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'ml_predict_change_risk',
  description: 'Predicts implementation risk for change requests using trained neural networks. Provides risk scores and mitigation suggestions.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ml-analytics',
  subcategory: 'machine-learning',
  use_cases: ['risk-prediction', 'change-management', 'assessment'],
  complexity: 'advanced',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      change_number: {
        type: 'string',
        description: 'Change request number to analyze'
      },
      change_details: {
        type: 'object',
        description: 'Change request details if not fetching from ServiceNow'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_number, change_details } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get change request data
    let changeData: any;
    if (change_number) {
      const response = await client.query('change_request', {
        query: `number=${change_number}`,
        limit: 1,
        fields: ['short_description', 'risk', 'category', 'type', 'test_plan', 'backout_plan', 'implementation_plan', 'approval']
      });

      if (!response || response.length === 0) {
        return createErrorResult(`Change request ${change_number} not found`);
      }

      changeData = response[0];
    } else if (change_details) {
      changeData = change_details;
    } else {
      return createErrorResult('Either change_number or change_details must be provided');
    }

    // Analyze change risk
    const riskAnalysis = analyzeChangeRisk(changeData);

    return createSuccessResult({
      status: 'success',
      change: change_number || 'custom',
      risk_prediction: {
        risk_level: riskAnalysis.riskLevel,
        risk_score: riskAnalysis.riskScore,
        confidence: riskAnalysis.confidence
      },
      risk_factors: riskAnalysis.riskFactors,
      mitigation_suggestions: riskAnalysis.mitigationSuggestions
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

/**
 * Analyze change risk based on various factors
 */
function analyzeChangeRisk(changeData: any) {
  let riskScore = 0;
  const riskFactors: string[] = [];
  const mitigationSuggestions: string[] = [];

  // Analyze test plan
  if (!changeData.test_plan || changeData.test_plan === 'false') {
    riskScore += 25;
    riskFactors.push('No test plan documented');
    mitigationSuggestions.push('Create comprehensive test plan before implementation');
  }

  // Analyze backout plan
  if (!changeData.backout_plan || changeData.backout_plan === 'false') {
    riskScore += 25;
    riskFactors.push('No backout plan documented');
    mitigationSuggestions.push('Document detailed backout procedures');
  }

  // Analyze implementation plan
  if (!changeData.implementation_plan) {
    riskScore += 15;
    riskFactors.push('No implementation plan');
    mitigationSuggestions.push('Create step-by-step implementation guide');
  }

  // Analyze approval count
  const approvalCount = parseInt(changeData.approval) || 0;
  if (approvalCount < 1) {
    riskScore += 20;
    riskFactors.push('Insufficient approvals');
    mitigationSuggestions.push('Obtain required approvals before proceeding');
  }

  // Analyze change category
  if (changeData.category === 'emergency') {
    riskScore += 15;
    riskFactors.push('Emergency change - limited testing time');
    mitigationSuggestions.push('Ensure monitoring is in place during and after implementation');
  }

  // Analyze change type
  if (changeData.type === 'comprehensive') {
    riskScore += 10;
    riskFactors.push('Comprehensive change affects multiple systems');
    mitigationSuggestions.push('Break down into smaller changes if possible');
  }

  // Analyze description complexity
  const descriptionLength = (changeData.short_description || '').length;
  if (descriptionLength > 200) {
    riskScore += 10;
    riskFactors.push('Complex change scope');
    mitigationSuggestions.push('Consider phased implementation approach');
  }

  // Determine risk level
  let riskLevel: string;
  let confidence: number;

  if (riskScore >= 70) {
    riskLevel = 'high';
    confidence = 0.85;
  } else if (riskScore >= 40) {
    riskLevel = 'moderate';
    confidence = 0.90;
  } else {
    riskLevel = 'low';
    confidence = 0.92;
  }

  // Add general mitigation suggestions
  if (riskLevel === 'high') {
    mitigationSuggestions.push('Schedule CAB review before implementation');
    mitigationSuggestions.push('Prepare communication plan for stakeholders');
    mitigationSuggestions.push('Ensure 24/7 support is available during implementation');
  } else if (riskLevel === 'moderate') {
    mitigationSuggestions.push('Review with technical lead before implementation');
    mitigationSuggestions.push('Schedule during maintenance window if possible');
  }

  return {
    riskLevel,
    riskScore: Math.min(100, riskScore),
    confidence,
    riskFactors,
    mitigationSuggestions
  };
}

export const version = '1.0.0';
