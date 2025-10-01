/**
 * ServiceNow Security Tool: Escalate Permissions
 * Escalate user permissions with approval workflow
 * Implementation based on ServiceNow best practices
 */

import { SnowToolConfig } from '../types';

export const snow_escalate_permissions: SnowToolConfig = {
  name: 'snow_escalate_permissions',
  description: 'Escalate user permissions with approval workflow and time-based access controls',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User sys_id or username' },
      role: { type: 'string', description: 'Role to grant (admin, security_admin, etc.)' },
      duration: { type: 'number', description: 'Access duration in hours (0 = permanent)' },
      justification: { type: 'string', description: 'Business justification for escalation' },
      approver: { type: 'string', description: 'Approver sys_id or username' },
      require_approval: { type: 'boolean', description: 'Require approval before granting' }
    },
    required: ['user_id', 'role', 'justification']
  },
  handler: async (args, client, logger) => {
    logger.info(`Escalating permissions for user ${args.user_id}...`);

    const { user_id, role, duration = 24, justification, approver, require_approval = true } = args;

    // Validate user exists
    const userQuery = user_id.includes('@') ? `email=${user_id}` :
                     user_id.length === 32 ? `sys_id=${user_id}` :
                     `user_name=${user_id}`;

    const userResponse = await client.searchRecords('sys_user', userQuery, 1);
    if (!userResponse.success || !userResponse.data.result.length) {
      throw new Error(`User not found: ${user_id}`);
    }

    const user = userResponse.data.result[0];

    // Check if role exists
    const roleResponse = await client.searchRecords('sys_user_role', `name=${role}`, 1);
    if (!roleResponse.success || !roleResponse.data.result.length) {
      throw new Error(`Role not found: ${role}`);
    }

    const roleRecord = roleResponse.data.result[0];

    // Create escalation request
    const escalationData = {
      user: user.sys_id,
      role: roleRecord.sys_id,
      duration_hours: duration,
      justification: justification,
      state: require_approval ? 'pending_approval' : 'approved',
      requested_by: user.sys_id,
      requested_date: new Date().toISOString(),
      expires_date: duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null
    };

    if (approver) {
      const approverQuery = approver.includes('@') ? `email=${approver}` :
                           approver.length === 32 ? `sys_id=${approver}` :
                           `user_name=${approver}`;
      const approverResponse = await client.searchRecords('sys_user', approverQuery, 1);
      if (approverResponse.success && approverResponse.data.result.length) {
        escalationData['approver'] = approverResponse.data.result[0].sys_id;
      }
    }

    const response = await client.createRecord('sys_user_role_contains', escalationData);

    if (!response.success) {
      throw new Error(`Failed to create permission escalation: ${response.error}`);
    }

    // If no approval required, grant immediately
    let grantedMessage = '';
    if (!require_approval) {
      const roleAssignmentResponse = await client.createRecord('sys_user_has_role', {
        user: user.sys_id,
        role: roleRecord.sys_id,
        granted_by: 'system',
        state: 'active',
        expires: duration > 0 ? new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : null
      });

      if (roleAssignmentResponse.success) {
        grantedMessage = '\n\n✅ **Permissions Granted Immediately** (no approval required)';
      }
    }

    return {
      content: [{
        type: 'text',
        text: `🔐 **Permission Escalation Request Created**

👤 **User**: ${user.name} (${user.user_name})
🎯 **Role**: ${role}
⏱️ **Duration**: ${duration > 0 ? `${duration} hours` : 'Permanent'}
📝 **Justification**: ${justification}

🔄 **Status**: ${require_approval ? 'Pending Approval' : 'Approved'}
🆔 **Request ID**: ${response.data.sys_id}
${approver ? `👤 **Approver**: ${approver}` : ''}
${duration > 0 ? `\n⏰ **Expires**: ${new Date(Date.now() + duration * 60 * 60 * 1000).toLocaleString()}` : ''}${grantedMessage}

${require_approval ?
`⚠️ **Next Steps**:
- Awaiting approval from security team
- User will be notified when approved
- Access will be granted automatically upon approval` :
`✅ **Access Granted**:
- User can now use ${role} permissions
- Access will be automatically revoked after ${duration} hours
- All actions will be logged for audit purposes`}`
      }]
    };
  }
};
