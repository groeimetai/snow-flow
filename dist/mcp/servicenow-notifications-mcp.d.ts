#!/usr/bin/env node
/**
 * ServiceNow Notifications Framework MCP Server
 *
 * Provides comprehensive notification capabilities including:
 * - Multi-channel notifications (Email, SMS, Push, Slack, Teams)
 * - Template management and personalization
 * - Delivery tracking and analytics
 * - Notification preferences and routing
 * - Emergency notification broadcasting
 *
 * Enhanced notification capabilities previously missing from Snow-Flow
 */
import { EnhancedBaseMCPServer } from './shared/enhanced-base-mcp-server.js';
export declare class ServiceNowNotificationsMCP extends EnhancedBaseMCPServer {
    constructor();
    private setupHandlers;
    private sendNotification;
    private sendEmailNotification;
    private sendSMSNotification;
    private sendPushNotification;
    private personalizeMessage;
}
//# sourceMappingURL=servicenow-notifications-mcp.d.ts.map