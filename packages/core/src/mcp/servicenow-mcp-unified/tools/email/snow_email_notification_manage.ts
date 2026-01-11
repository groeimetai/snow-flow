/**
 * snow_email_notification_manage - Comprehensive email notification management
 *
 * Manage ServiceNow email notifications (sysevent_email_action) with full CRUD operations.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_email_notification_manage',
  description: 'Manage email notifications: list, get, create, update, delete, enable/disable',
  category: 'automation',
  subcategory: 'notifications',
  use_cases: ['notifications', 'email', 'automation'],
  complexity: 'intermediate',
  frequency: 'high',
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'create', 'update', 'delete', 'enable', 'disable', 'test'],
        description: 'Action to perform'
      },
      notification_id: {
        type: 'string',
        description: 'Notification sys_id or name (required for get, update, delete, enable, disable, test)'
      },
      table: {
        type: 'string',
        description: 'Table name (collection) for notification - filter for list, required for create'
      },
      name: {
        type: 'string',
        description: 'Notification name'
      },
      subject: {
        type: 'string',
        description: 'Email subject (supports ${field} substitution)'
      },
      message_html: {
        type: 'string',
        description: 'Email body HTML (supports ${field} substitution)'
      },
      condition: {
        type: 'string',
        description: 'Condition script for when to send'
      },
      send_self: {
        type: 'boolean',
        description: 'Send to user who triggered the notification',
        default: false
      },
      recipient_fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Field names that contain recipients (e.g., ["assigned_to", "caller_id"])'
      },
      recipient_groups: {
        type: 'array',
        items: { type: 'string' },
        description: 'Group sys_ids to receive notification'
      },
      recipient_users: {
        type: 'array',
        items: { type: 'string' },
        description: 'User sys_ids to receive notification'
      },
      event_name: {
        type: 'string',
        description: 'Event to trigger on (insert, update, display, etc.)'
      },
      weight: {
        type: 'number',
        description: 'Priority weight (higher = more important)',
        default: 0
      },
      active: {
        type: 'boolean',
        description: 'Whether notification is active',
        default: true
      },
      active_only: {
        type: 'boolean',
        description: 'Only list active notifications',
        default: false
      },
      limit: {
        type: 'number',
        description: 'Max results for list',
        default: 50
      },
      template: {
        type: 'string',
        description: 'Email template sys_id or name (from sysevent_email_template) - when set, uses template instead of inline message'
      }
    },
    required: ['action']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    action,
    notification_id,
    table,
    name,
    subject,
    message_html,
    condition,
    send_self = false,
    recipient_fields,
    recipient_groups,
    recipient_users,
    event_name,
    weight = 0,
    active = true,
    active_only = false,
    limit = 50,
    template
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Helper to resolve notification name to sys_id
    async function resolveNotificationId(notifId: string): Promise<string> {
      if (notifId.length === 32 && !/\s/.test(notifId)) return notifId;
      const lookup = await client.get('/api/now/table/sysevent_email_action', {
        params: {
          sysparm_query: 'name=' + notifId,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        }
      });
      if (!lookup.data.result?.[0]) {
        throw new SnowFlowError(ErrorType.NOT_FOUND, 'Notification not found: ' + notifId);
      }
      return lookup.data.result[0].sys_id;
    }

    // Helper to resolve email template name to sys_id
    async function resolveTemplateId(templateId: string): Promise<string> {
      if (templateId.length === 32 && !/\s/.test(templateId)) return templateId;
      var lookup = await client.get('/api/now/table/sysevent_email_template', {
        params: {
          sysparm_query: 'name=' + templateId,
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        }
      });
      if (!lookup.data.result?.[0]) {
        throw new SnowFlowError(ErrorType.NOT_FOUND, 'Email template not found: ' + templateId);
      }
      return lookup.data.result[0].sys_id;
    }

    switch (action) {
      case 'list': {
        var query = '';
        if (table) {
          query = 'collection=' + table;
        }
        if (active_only) {
          query += (query ? '^' : '') + 'active=true';
        }

        const response = await client.get('/api/now/table/sysevent_email_action', {
          params: {
            sysparm_query: query || undefined,
            sysparm_fields: 'sys_id,name,collection,event_name,active,subject,condition,template,sys_created_on,sys_updated_on',
            sysparm_display_value: 'all',
            sysparm_limit: limit
          }
        });

        var notifications = (response.data.result || []).map(function(n: any) {
          return {
            sys_id: n.sys_id?.value || n.sys_id,
            name: n.name?.value || n.name,
            table: n.collection?.value || n.collection,
            event: n.event_name?.value || n.event_name,
            active: (n.active?.value || n.active) === 'true',
            subject: n.subject?.value || n.subject,
            has_condition: Boolean(n.condition?.value || n.condition),
            template: n.template?.value || n.template || null,
            template_display: n.template?.display_value || null,
            created: n.sys_created_on?.value || n.sys_created_on,
            updated: n.sys_updated_on?.value || n.sys_updated_on
          };
        });

        return createSuccessResult({
          action: 'list',
          count: notifications.length,
          notifications: notifications
        });
      }

      case 'get': {
        if (!notification_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'notification_id is required for get action');
        }

        var sysId = await resolveNotificationId(notification_id);

        const response = await client.get('/api/now/table/sysevent_email_action/' + sysId, {
          params: {
            sysparm_display_value: 'all'
          }
        });
        var notif = response.data.result;

        return createSuccessResult({
          action: 'get',
          notification: {
            sys_id: notif.sys_id?.value || notif.sys_id,
            name: notif.name?.value || notif.name,
            table: notif.collection?.value || notif.collection,
            event: notif.event_name?.value || notif.event_name,
            active: (notif.active?.value || notif.active) === 'true',
            subject: notif.subject?.value || notif.subject,
            message_html: notif.message_html?.value || notif.message_html,
            condition: notif.condition?.value || notif.condition,
            send_self: (notif.send_self?.value || notif.send_self) === 'true',
            recipient_fields: notif.recipient_fields?.value || notif.recipient_fields,
            recipient_groups: notif.recipient_groups?.value || notif.recipient_groups,
            recipient_users: notif.recipient_users?.value || notif.recipient_users,
            template: notif.template?.value || notif.template || null,
            template_display: notif.template?.display_value || null,
            weight: notif.weight?.value || notif.weight,
            created: notif.sys_created_on?.value || notif.sys_created_on,
            updated: notif.sys_updated_on?.value || notif.sys_updated_on
          }
        });
      }

      case 'create': {
        if (!name) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'name is required for create action');
        }
        if (!table) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'table is required for create action');
        }

        var createData: any = {
          name: name,
          collection: table,
          active: active
        };

        if (subject) createData.subject = subject;
        if (message_html) createData.message_html = message_html;
        if (condition) createData.condition = condition;
        if (event_name) createData.event_name = event_name;
        if (send_self !== undefined) createData.send_self = send_self;
        if (recipient_fields) createData.recipient_fields = recipient_fields.join(',');
        if (recipient_groups) createData.recipient_groups = recipient_groups.join(',');
        if (recipient_users) createData.recipient_users = recipient_users.join(',');
        if (weight !== undefined) createData.weight = weight;
        if (template) {
          var resolvedTemplateId = await resolveTemplateId(template);
          createData.template = resolvedTemplateId;
        }

        const createResponse = await client.post('/api/now/table/sysevent_email_action', createData);

        return createSuccessResult({
          action: 'create',
          created: true,
          notification: {
            sys_id: createResponse.data.result.sys_id,
            name: createResponse.data.result.name,
            table: createResponse.data.result.collection
          }
        });
      }

      case 'update': {
        if (!notification_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'notification_id is required for update action');
        }

        var updateSysId = await resolveNotificationId(notification_id);

        var updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (table !== undefined) updateData.collection = table;
        if (subject !== undefined) updateData.subject = subject;
        if (message_html !== undefined) updateData.message_html = message_html;
        if (condition !== undefined) updateData.condition = condition;
        if (event_name !== undefined) updateData.event_name = event_name;
        if (send_self !== undefined) updateData.send_self = send_self;
        if (recipient_fields !== undefined) updateData.recipient_fields = recipient_fields.join(',');
        if (recipient_groups !== undefined) updateData.recipient_groups = recipient_groups.join(',');
        if (recipient_users !== undefined) updateData.recipient_users = recipient_users.join(',');
        if (weight !== undefined) updateData.weight = weight;
        if (active !== undefined) updateData.active = active;
        if (template !== undefined) {
          if (template === '' || template === null) {
            updateData.template = '';  // Clear template
          } else {
            var resolvedUpdateTemplateId = await resolveTemplateId(template);
            updateData.template = resolvedUpdateTemplateId;
          }
        }

        if (Object.keys(updateData).length === 0) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'No fields to update');
        }

        await client.patch('/api/now/table/sysevent_email_action/' + updateSysId, updateData);

        return createSuccessResult({
          action: 'update',
          updated: true,
          notification_id: updateSysId,
          fields_updated: Object.keys(updateData)
        });
      }

      case 'delete': {
        if (!notification_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'notification_id is required for delete action');
        }

        var deleteSysId = await resolveNotificationId(notification_id);
        await client.delete('/api/now/table/sysevent_email_action/' + deleteSysId);

        return createSuccessResult({
          action: 'delete',
          deleted: true,
          notification_id: deleteSysId
        });
      }

      case 'enable':
      case 'disable': {
        if (!notification_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'notification_id is required for ' + action + ' action');
        }

        var toggleSysId = await resolveNotificationId(notification_id);
        await client.patch('/api/now/table/sysevent_email_action/' + toggleSysId, {
          active: action === 'enable'
        });

        return createSuccessResult({
          action: action,
          notification_id: toggleSysId,
          active: action === 'enable',
          message: 'Notification ' + (action === 'enable' ? 'enabled' : 'disabled')
        });
      }

      case 'test': {
        if (!notification_id) {
          throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'notification_id is required for test action');
        }

        var testSysId = await resolveNotificationId(notification_id);

        // Get notification details for test info
        const testNotif = await client.get('/api/now/table/sysevent_email_action/' + testSysId, {
          params: {
            sysparm_fields: 'name,collection,event_name,subject'
          }
        });

        return createSuccessResult({
          action: 'test',
          notification_id: testSysId,
          notification_name: testNotif.data.result.name,
          message: 'To test this notification, trigger the event or condition on the ' + testNotif.data.result.collection + ' table',
          test_tip: 'Check System Logs > Email for sent emails, or use snow_get_email_logs tool'
        });
      }

      default:
        throw new SnowFlowError(ErrorType.VALIDATION_ERROR, 'Unknown action: ' + action);
    }

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow';
