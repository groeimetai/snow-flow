/**
 * snow_assess_change_risk - Risk assessment
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_assess_change_risk',
  description: 'Assess change request risk',
  inputSchema: {
    type: 'object',
    properties: {
      change_sys_id: { type: 'string' },
      assessment_factors: { type: 'object' }
    },
    required: ['change_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_sys_id, assessment_factors = {} } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const changeResponse = await client.get(`/api/now/table/change_request/${change_sys_id}`);
    const change = changeResponse.data.result;
    const riskScore = calculateRisk(change, assessment_factors);
    const response = await client.put(`/api/now/table/change_request/${change_sys_id}`, {
      risk: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low'
    });
    return createSuccessResult({ assessed: true, risk_score: riskScore, change: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

function calculateRisk(change: any, factors: any): number {
  let score = 50;
  if (change.impact === '1') score += 30;
  if (change.urgency === '1') score += 20;
  return Math.min(100, score);
}

export const version = '1.0.0';
