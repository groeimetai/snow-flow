#!/usr/bin/env node
/**
 * ServiceNow ID Generator - Dynamic sys_id and identifier generation
 * 
 * Replaces hardcoded sys_ids with proper dynamic generation
 * Ensures consistent ServiceNow-compatible identifiers across the system
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Generate a ServiceNow-compatible sys_id (32-character hex string)
 * ServiceNow uses lowercase 32-character hex strings without dashes
 */
export function generateServiceNowSysId(): string {
  return uuidv4().replace(/-/g, '').toLowerCase();
}

/**
 * Generate multiple unique sys_ids at once
 */
export function generateMultipleSysIds(count: number): string[] {
  return Array.from({ length: count }, () => generateServiceNowSysId());
}

/**
 * Generate a deterministic sys_id based on input string
 * Useful for generating consistent sys_ids for the same input
 */
export function generateDeterministicSysId(input: string): string {
  const hash = crypto.createHash('md5').update(input).digest('hex');
  return hash.toLowerCase();
}

/**
 * Generate a prefixed sys_id for mock/test scenarios
 * Maintains the 32-character requirement while being identifiable
 */
export function generateMockSysId(prefix: string = 'mock'): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).substring(2, 10);
  const base = `${prefix}_${timestamp}_${random}`;
  
  // Ensure it's exactly 32 characters by padding or truncating
  const hash = crypto.createHash('md5').update(base).digest('hex');
  return hash.toLowerCase();
}

/**
 * Generate dynamic update set names with timestamp
 */
export function generateUpdateSetName(prefix: string = 'Auto'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
  return `${prefix}_${timestamp}`;
}

/**
 * Generate dynamic user names for testing
 */
export function generateTestUserName(prefix: string = 'test_user'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate dynamic group names
 */
export function generateTestGroupName(prefix: string = 'test_group'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate dynamic catalog item names
 */
export function generateCatalogItemName(baseType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${baseType}_${timestamp}_${random}`;
}

/**
 * Generate dynamic request numbers in ServiceNow format
 */
export function generateRequestNumber(prefix: string = 'REQ'): string {
  const number = Math.floor(Math.random() * 999999).toString().padStart(7, '0');
  return `${prefix}${number}`;
}

/**
 * Generate dynamic incident numbers in ServiceNow format
 */
export function generateIncidentNumber(prefix: string = 'INC'): string {
  const number = Math.floor(Math.random() * 999999).toString().padStart(7, '0');
  return `${prefix}${number}`;
}

/**
 * Validate if a string is a valid ServiceNow sys_id format
 */
export function isValidServiceNowSysId(sysId: string): boolean {
  const sysIdPattern = /^[a-f0-9]{32}$/;
  return sysIdPattern.test(sysId);
}

/**
 * Generate a batch of ServiceNow records with sys_ids for testing
 */
export interface MockRecord {
  sys_id: string;
  name: string;
  type: string;
}

export function generateMockRecords(count: number, type: string): MockRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    sys_id: generateServiceNowSysId(),
    name: `${type}_${index + 1}_${Date.now()}`,
    type
  }));
}

/**
 * Generate workflow/flow-related identifiers
 */
export function generateFlowIdentifiers(flowName: string) {
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
export const COMMON_NOTIFICATION_TEMPLATES = {
  // Generic notification template - should be replaced with actual lookup
  generic_notification: '3c7d23a4db01030077c9a4d3ca961985',
  
  // Default fallback - generates a deterministic sys_id for consistent behavior
  default: generateDeterministicSysId('default_notification_template')
};

/**
 * Get a notification template sys_id
 * In production, this should query ServiceNow for actual notification templates
 */
export function getNotificationTemplateSysId(templateName: string = 'default'): string {
  if (templateName in COMMON_NOTIFICATION_TEMPLATES) {
    return COMMON_NOTIFICATION_TEMPLATES[templateName as keyof typeof COMMON_NOTIFICATION_TEMPLATES];
  }
  
  // Generate a consistent sys_id for unknown templates
  return generateDeterministicSysId(`notification_template_${templateName}`);
}

export default {
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
  COMMON_NOTIFICATION_TEMPLATES
};