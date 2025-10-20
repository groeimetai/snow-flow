#!/usr/bin/env node
/**
 * ServiceNow ID Generator - Dynamic sys_id and identifier generation
 *
 * Replaces hardcoded sys_ids with proper dynamic generation
 * Ensures consistent ServiceNow-compatible identifiers across the system
 */
/**
 * Generate a ServiceNow-compatible sys_id (32-character hex string)
 * ServiceNow uses lowercase 32-character hex strings without dashes
 */
export declare function generateServiceNowSysId(): string;
/**
 * Generate multiple unique sys_ids at once
 */
export declare function generateMultipleSysIds(count: number): string[];
/**
 * Generate a deterministic sys_id based on input string
 * Useful for generating consistent sys_ids for the same input
 */
export declare function generateDeterministicSysId(input: string): string;
/**
 * Generate a prefixed sys_id for mock/test scenarios
 * Maintains the 32-character requirement while being identifiable
 */
export declare function generateMockSysId(prefix?: string): string;
/**
 * Generate dynamic update set names with timestamp
 */
export declare function generateUpdateSetName(prefix?: string): string;
/**
 * Generate dynamic user names for testing
 */
export declare function generateTestUserName(prefix?: string): string;
/**
 * Generate dynamic group names
 */
export declare function generateTestGroupName(prefix?: string): string;
/**
 * Generate dynamic catalog item names
 */
export declare function generateCatalogItemName(baseType: string): string;
/**
 * Generate dynamic request numbers in ServiceNow format
 */
export declare function generateRequestNumber(prefix?: string): string;
/**
 * Generate dynamic incident numbers in ServiceNow format
 */
export declare function generateIncidentNumber(prefix?: string): string;
/**
 * Validate if a string is a valid ServiceNow sys_id format
 */
export declare function isValidServiceNowSysId(sysId: string): boolean;
/**
 * Generate a batch of ServiceNow records with sys_ids for testing
 */
export interface MockRecord {
    sys_id: string;
    name: string;
    type: string;
}
export declare function generateMockRecords(count: number, type: string): MockRecord[];
/**
 * Generate workflow/flow-related identifiers
 */
export declare function generateFlowIdentifiers(flowName: string): {
    flowSysId: string;
    triggerSysId: string;
    updateSetSysId: string;
    updateSetName: string;
};
/**
 * ServiceNow system notification IDs - for common notification templates
 * These should be looked up dynamically in real implementations
 */
export declare const COMMON_NOTIFICATION_TEMPLATES: {
    generic_notification: string;
    default: string;
};
/**
 * Get a notification template sys_id
 * In production, this should query ServiceNow for actual notification templates
 */
export declare function getNotificationTemplateSysId(templateName?: string): string;
declare const _default: {
    generateServiceNowSysId: typeof generateServiceNowSysId;
    generateMultipleSysIds: typeof generateMultipleSysIds;
    generateDeterministicSysId: typeof generateDeterministicSysId;
    generateMockSysId: typeof generateMockSysId;
    generateUpdateSetName: typeof generateUpdateSetName;
    generateTestUserName: typeof generateTestUserName;
    generateTestGroupName: typeof generateTestGroupName;
    generateCatalogItemName: typeof generateCatalogItemName;
    generateRequestNumber: typeof generateRequestNumber;
    generateIncidentNumber: typeof generateIncidentNumber;
    isValidServiceNowSysId: typeof isValidServiceNowSysId;
    generateMockRecords: typeof generateMockRecords;
    generateFlowIdentifiers: typeof generateFlowIdentifiers;
    getNotificationTemplateSysId: typeof getNotificationTemplateSysId;
    COMMON_NOTIFICATION_TEMPLATES: {
        generic_notification: string;
        default: string;
    };
};
export default _default;
//# sourceMappingURL=servicenow-id-generator.d.ts.map