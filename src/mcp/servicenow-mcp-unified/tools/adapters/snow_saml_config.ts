/**
 * snow_saml_config
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_saml_config',
  description: 'Configure SAML SSO',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'SAML config name' },
      issuer_url: { type: 'string', description: 'Identity provider issuer URL' },
      certificate: { type: 'string', description: 'IdP certificate' }
    },
    required: ['name', 'issuer_url']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, issuer_url, certificate } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const samlData: any = {
      name,
      issuer_url,
      active: true
    };
    if (certificate) samlData.certificate = certificate;
    const response = await client.post('/api/now/table/sys_auth_profile_saml2', samlData);
    return createSuccessResult({ configured: true, saml_config: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
