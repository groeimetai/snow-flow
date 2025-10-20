#!/usr/bin/env node
"use strict";
/**
 * ServiceNow ID Generator - Dynamic sys_id and identifier generation
 *
 * Replaces hardcoded sys_ids with proper dynamic generation
 * Ensures consistent ServiceNow-compatible identifiers across the system
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COMMON_NOTIFICATION_TEMPLATES = void 0;
exports.generateServiceNowSysId = generateServiceNowSysId;
exports.generateMultipleSysIds = generateMultipleSysIds;
exports.generateDeterministicSysId = generateDeterministicSysId;
exports.generateMockSysId = generateMockSysId;
exports.generateUpdateSetName = generateUpdateSetName;
exports.generateTestUserName = generateTestUserName;
exports.generateTestGroupName = generateTestGroupName;
exports.generateCatalogItemName = generateCatalogItemName;
exports.generateRequestNumber = generateRequestNumber;
exports.generateIncidentNumber = generateIncidentNumber;
exports.isValidServiceNowSysId = isValidServiceNowSysId;
exports.generateMockRecords = generateMockRecords;
exports.generateFlowIdentifiers = generateFlowIdentifiers;
exports.getNotificationTemplateSysId = getNotificationTemplateSysId;
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a ServiceNow-compatible sys_id (32-character hex string)
 * ServiceNow uses lowercase 32-character hex strings without dashes
 */
function generateServiceNowSysId() {
    return (0, uuid_1.v4)().replace(/-/g, '').toLowerCase();
}
/**
 * Generate multiple unique sys_ids at once
 */
function generateMultipleSysIds(count) {
    return Array.from({ length: count }, () => generateServiceNowSysId());
}
/**
 * Generate a deterministic sys_id based on input string
 * Useful for generating consistent sys_ids for the same input
 */
function generateDeterministicSysId(input) {
    const hash = crypto_1.default.createHash('md5').update(input).digest('hex');
    return hash.toLowerCase();
}
/**
 * Generate a prefixed sys_id for mock/test scenarios
 * Maintains the 32-character requirement while being identifiable
 */
function generateMockSysId(prefix = 'mock') {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2, 10);
    const base = `${prefix}_${timestamp}_${random}`;
    // Ensure it's exactly 32 characters by padding or truncating
    const hash = crypto_1.default.createHash('md5').update(base).digest('hex');
    return hash.toLowerCase();
}
/**
 * Generate dynamic update set names with timestamp
 */
function generateUpdateSetName(prefix = 'Auto') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    return `${prefix}_${timestamp}`;
}
/**
 * Generate dynamic user names for testing
 */
function generateTestUserName(prefix = 'test_user') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}`;
}
/**
 * Generate dynamic group names
 */
function generateTestGroupName(prefix = 'test_group') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${prefix}_${timestamp}_${random}`;
}
/**
 * Generate dynamic catalog item names
 */
function generateCatalogItemName(baseType) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${baseType}_${timestamp}_${random}`;
}
/**
 * Generate dynamic request numbers in ServiceNow format
 */
function generateRequestNumber(prefix = 'REQ') {
    const number = Math.floor(Math.random() * 999999).toString().padStart(7, '0');
    return `${prefix}${number}`;
}
/**
 * Generate dynamic incident numbers in ServiceNow format
 */
function generateIncidentNumber(prefix = 'INC') {
    const number = Math.floor(Math.random() * 999999).toString().padStart(7, '0');
    return `${prefix}${number}`;
}
/**
 * Validate if a string is a valid ServiceNow sys_id format
 */
function isValidServiceNowSysId(sysId) {
    const sysIdPattern = /^[a-f0-9]{32}$/;
    return sysIdPattern.test(sysId);
}
function generateMockRecords(count, type) {
    return Array.from({ length: count }, (_, index) => ({
        sys_id: generateServiceNowSysId(),
        name: `${type}_${index + 1}_${Date.now()}`,
        type
    }));
}
/**
 * Generate workflow/flow-related identifiers
 */
function generateFlowIdentifiers(flowName) {
    const baseSysId = generateDeterministicSysId(flowName);
    return {
        flowSysId: baseSysId,
        triggerSysId: generateDeterministicSysId(`${flowName}_trigger`),
        updateSetSysId: generateServiceNowSysId(),
        updateSetName: generateUpdateSetName(`Flow_${flowName.replace(/\s+/g, '_')}`)
    };
}
/**
 * ServiceNow system notification IDs - for common notification templates
 * These should be looked up dynamically in real implementations
 */
exports.COMMON_NOTIFICATION_TEMPLATES = {
    // Generic notification template - should be replaced with actual lookup
    generic_notification: '3c7d23a4db01030077c9a4d3ca961985',
    // Default fallback - generates a deterministic sys_id for consistent behavior
    default: generateDeterministicSysId('default_notification_template')
};
/**
 * Get a notification template sys_id
 * In production, this should query ServiceNow for actual notification templates
 */
function getNotificationTemplateSysId(templateName = 'default') {
    if (templateName in exports.COMMON_NOTIFICATION_TEMPLATES) {
        return exports.COMMON_NOTIFICATION_TEMPLATES[templateName];
    }
    // Generate a consistent sys_id for unknown templates
    return generateDeterministicSysId(`notification_template_${templateName}`);
}
exports.default = {
    generateServiceNowSysId,
    generateMultipleSysIds,
    generateDeterministicSysId,
    generateMockSysId,
    generateUpdateSetName,
    generateTestUserName,
    generateTestGroupName,
    generateCatalogItemName,
    generateRequestNumber,
    generateIncidentNumber,
    isValidServiceNowSysId,
    generateMockRecords,
    generateFlowIdentifiers,
    getNotificationTemplateSysId,
    COMMON_NOTIFICATION_TEMPLATES: exports.COMMON_NOTIFICATION_TEMPLATES
};
//# sourceMappingURL=servicenow-id-generator.js.map