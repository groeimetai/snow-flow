#!/usr/bin/env tsx

/**
 * Bulk Tool Classification Script
 *
 * Automatically classifies ALL 410+ tools in the unified MCP server
 * as READ or WRITE based on intelligent name pattern analysis.
 *
 * Usage:
 *   npm install -g tsx  # If not installed
 *   tsx scripts/classify-all-tools.ts
 *   tsx scripts/classify-all-tools.ts --dry-run  # Preview without changes
 *   tsx scripts/classify-all-tools.ts --review-only  # Only show tools needing manual review
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Configuration
const TOOLS_BASE_DIR = path.join(__dirname, '../src/mcp/servicenow-mcp-unified/tools');
const DRY_RUN = process.argv.includes('--dry-run');
const REVIEW_ONLY = process.argv.includes('--review-only');

// Classification patterns
const READ_PATTERNS = [
  /^snow_query_/,
  /^snow_get_/,
  /^snow_search_/,
  /^snow_discover_/,
  /^snow_find_/,
  /^snow_list_/,
  /^snow_view_/,
  /^snow_show_/,
  /^snow_analyze_/,
  /^snow_check_/,
  /^snow_test_/,
  /^snow_validate_/,
  /^snow_export_(?!.*import)/,  // export is READ unless it's import_export
  /^snow_fetch_/,
  /^snow_lookup_/,
  /^snow_inspect_/,
  /^snow_monitor_/,
  /_lookup$/,
  /_search$/,
  /_query$/,
  /_details$/,
  /_status$/,
  /_metrics$/,
  /_report$/,
  /_analysis$/,
];

const WRITE_PATTERNS = [
  /^snow_create_/,
  /^snow_update_/,
  /^snow_delete_/,
  /^snow_remove_/,
  /^snow_execute_/,
  /^snow_deploy_/,
  /^snow_manage_/,
  /^snow_add_/,
  /^snow_set_/,
  /^snow_configure_/,
  /^snow_trigger_/,
  /^snow_schedule_/,
  /^snow_enable_/,
  /^snow_disable_/,
  /^snow_activate_/,
  /^snow_deactivate_/,
  /^snow_install_/,
  /^snow_uninstall_/,
  /^snow_import_/,
  /^snow_sync_/,
  /^snow_push_/,
  /^snow_pull_/,  // pull modifies local state
  /^snow_apply_/,
  /^snow_assign_/,
  /^snow_approve_/,
  /^snow_reject_/,
  /^snow_close_/,
  /^snow_resolve_/,
  /^snow_reopen_/,
  /^snow_cancel_/,
  /^snow_rollback_/,
  /^snow_clone_/,
  /^snow_backup_/,
  /^snow_restore_/,
  /^snow_migrate_/,
  /^snow_transfer_/,
  /^snow_retire_/,
  /^snow_attach_/,
  /^snow_upload_/,
  /^snow_order_/,
  /^snow_request_/,
  /^snow_confirm_/,
  /^snow_cleanup_/,
  /_manage$/,
  /_manager$/,
];

// Edge cases that need manual review
const AMBIGUOUS_PATTERNS = [
  /^snow_record_manage$/,  // Can be both READ and WRITE depending on action
  /^snow_property_manager$/,  // Can be both
  /^snow_catalog_item_manager$/,  // Can be both
];

interface ToolClassification {
  filePath: string;
  toolName: string;
  currentPermission: string | null;
  suggestedPermission: 'read' | 'write' | 'NEEDS_REVIEW';
  suggestedRoles: string[];
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  alreadyClassified: boolean;
}

interface ClassificationStats {
  total: number;
  alreadyClassified: number;
  read: number;
  write: number;
  needsReview: number;
  updated: number;
  errors: number;
}

/**
 * Classify a tool based on its name
 */
function classifyTool(toolName: string): ToolClassification['suggestedPermission'] {
  // Check ambiguous patterns first
  for (const pattern of AMBIGUOUS_PATTERNS) {
    if (pattern.test(toolName)) {
      return 'NEEDS_REVIEW';
    }
  }

  // Check READ patterns
  let readMatches = 0;
  for (const pattern of READ_PATTERNS) {
    if (pattern.test(toolName)) {
      readMatches++;
    }
  }

  // Check WRITE patterns
  let writeMatches = 0;
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(toolName)) {
      writeMatches++;
    }
  }

  // If matches both, prefer WRITE (most restrictive)
  if (writeMatches > 0) return 'write';
  if (readMatches > 0) return 'read';

  // No pattern matches - needs manual review
  return 'NEEDS_REVIEW';
}

/**
 * Get classification reason
 */
function getClassificationReason(toolName: string, permission: ToolClassification['suggestedPermission']): string {
  if (permission === 'NEEDS_REVIEW') {
    return 'No clear pattern match - manual review required';
  }

  if (permission === 'read') {
    if (toolName.includes('query')) return 'Query operation - only reads data';
    if (toolName.includes('get')) return 'Get operation - retrieves data';
    if (toolName.includes('search')) return 'Search operation - reads data';
    if (toolName.includes('discover')) return 'Discovery operation - reads metadata';
    if (toolName.includes('analyze')) return 'Analysis operation - reads data';
    if (toolName.includes('export')) return 'Export operation - reads data';
    return 'Read-only operation based on name pattern';
  }

  if (permission === 'write') {
    if (toolName.includes('create')) return 'Create operation - modifies data';
    if (toolName.includes('update')) return 'Update operation - modifies data';
    if (toolName.includes('delete')) return 'Delete operation - modifies data';
    if (toolName.includes('execute')) return 'Execution operation - can have side effects';
    if (toolName.includes('deploy')) return 'Deployment operation - modifies state';
    if (toolName.includes('manage')) return 'Management operation - modifies data';
    return 'Write operation based on name pattern';
  }

  return 'Unknown';
}

/**
 * Get confidence level
 */
function getConfidence(toolName: string, permission: ToolClassification['suggestedPermission']): 'high' | 'medium' | 'low' {
  if (permission === 'NEEDS_REVIEW') return 'low';

  // High confidence patterns
  const highConfidencePatterns = [
    /^snow_query_/,
    /^snow_create_/,
    /^snow_update_/,
    /^snow_delete_/,
    /^snow_execute_/,
  ];

  for (const pattern of highConfidencePatterns) {
    if (pattern.test(toolName)) return 'high';
  }

  // Medium confidence for other clear patterns
  if (permission === 'read' && (toolName.includes('get') || toolName.includes('search'))) return 'high';
  if (permission === 'write' && (toolName.includes('deploy') || toolName.includes('configure'))) return 'high';

  return 'medium';
}

/**
 * Check if tool is already classified
 */
function isAlreadyClassified(fileContent: string): boolean {
  return fileContent.includes('permission:') && fileContent.includes('allowedRoles:');
}

/**
 * Get current permission from file
 */
function getCurrentPermission(fileContent: string): string | null {
  const match = fileContent.match(/permission:\s*['"](\w+)['"]/);
  return match ? match[1] : null;
}

/**
 * Add permission fields to tool file
 */
function addPermissionFields(
  filePath: string,
  permission: 'read' | 'write',
  reason: string
): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if already has permission
    if (isAlreadyClassified(content)) {
      return false; // Already classified
    }

    // Find the insertion point (after frequency field)
    const frequencyMatch = content.match(/frequency:\s*['"][\w-]+['"],?/);

    if (!frequencyMatch) {
      console.error(`  ⚠️  Could not find frequency field in ${path.basename(filePath)}`);
      return false;
    }

    const roles = permission === 'read'
      ? "['developer', 'stakeholder', 'admin']"
      : "['developer', 'admin']";

    const permissionBlock = `\n\n  // 🆕 Permission enforcement (Q1 2025)\n` +
      `  // Classification: ${permission.toUpperCase()} - ${reason}\n` +
      `  permission: '${permission}',\n` +
      `  allowedRoles: ${roles},`;

    // Insert after frequency field
    const insertIndex = frequencyMatch.index! + frequencyMatch[0].length;
    content = content.slice(0, insertIndex) + permissionBlock + content.slice(insertIndex);

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }

    return true;
  } catch (error) {
    console.error(`  ❌ Error updating ${path.basename(filePath)}:`, error);
    return false;
  }
}

/**
 * Scan and classify all tools
 */
async function classifyAllTools(): Promise<void> {
  console.log('🔍 Scanning for tools in unified MCP server...\n');

  // Find all tool files (excluding index.ts)
  const toolFiles = await glob(`${TOOLS_BASE_DIR}/**/*.ts`, {
    ignore: ['**/index.ts', '**/*.test.ts', '**/*.spec.ts']
  });

  console.log(`📦 Found ${toolFiles.length} tool files\n`);

  const classifications: ToolClassification[] = [];
  const stats: ClassificationStats = {
    total: toolFiles.length,
    alreadyClassified: 0,
    read: 0,
    write: 0,
    needsReview: 0,
    updated: 0,
    errors: 0
  };

  // Classify each tool
  for (const filePath of toolFiles) {
    const toolName = path.basename(filePath, '.ts');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    const alreadyClassified = isAlreadyClassified(fileContent);
    const currentPermission = getCurrentPermission(fileContent);
    const suggestedPermission = classifyTool(toolName);
    const confidence = getConfidence(toolName, suggestedPermission);
    const reason = getClassificationReason(toolName, suggestedPermission);

    const roles = suggestedPermission === 'read'
      ? ['developer', 'stakeholder', 'admin']
      : suggestedPermission === 'write'
      ? ['developer', 'admin']
      : [];

    classifications.push({
      filePath,
      toolName,
      currentPermission,
      suggestedPermission,
      suggestedRoles: roles,
      confidence,
      reason,
      alreadyClassified
    });

    if (alreadyClassified) {
      stats.alreadyClassified++;
    } else {
      if (suggestedPermission === 'read') stats.read++;
      else if (suggestedPermission === 'write') stats.write++;
      else stats.needsReview++;
    }
  }

  // Sort by category
  const needsReview = classifications.filter(c => !c.alreadyClassified && c.suggestedPermission === 'NEEDS_REVIEW');
  const readTools = classifications.filter(c => !c.alreadyClassified && c.suggestedPermission === 'read');
  const writeTools = classifications.filter(c => !c.alreadyClassified && c.suggestedPermission === 'write');
  const alreadyDone = classifications.filter(c => c.alreadyClassified);

  // Display results
  if (REVIEW_ONLY) {
    console.log('🔍 Tools Needing Manual Review:\n');
    for (const tool of needsReview) {
      console.log(`  ⚠️  ${tool.toolName}`);
      console.log(`      Reason: ${tool.reason}`);
      console.log(`      File: ${path.relative(TOOLS_BASE_DIR, tool.filePath)}\n`);
    }
    console.log(`\n📊 ${needsReview.length} tools need manual review\n`);
    return;
  }

  console.log('📋 Classification Summary:\n');
  console.log(`  ✅ Already classified: ${stats.alreadyClassified}`);
  console.log(`  📖 READ tools to classify: ${stats.read}`);
  console.log(`  ✏️  WRITE tools to classify: ${stats.write}`);
  console.log(`  ⚠️  Need manual review: ${stats.needsReview}`);
  console.log(`\n  📦 Total: ${stats.total} tools\n`);

  if (needsReview.length > 0) {
    console.log('⚠️  Tools Needing Manual Review:\n');
    for (const tool of needsReview.slice(0, 10)) {
      console.log(`  • ${tool.toolName} - ${tool.reason}`);
    }
    if (needsReview.length > 10) {
      console.log(`  ... and ${needsReview.length - 10} more\n`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('🏃 DRY RUN MODE - No files will be modified\n');
    console.log('📖 Sample READ tools that would be classified:\n');
    for (const tool of readTools.slice(0, 5)) {
      console.log(`  ✅ ${tool.toolName} (${tool.confidence} confidence)`);
      console.log(`      ${tool.reason}\n`);
    }

    console.log('✏️  Sample WRITE tools that would be classified:\n');
    for (const tool of writeTools.slice(0, 5)) {
      console.log(`  ✅ ${tool.toolName} (${tool.confidence} confidence)`);
      console.log(`      ${tool.reason}\n`);
    }

    console.log('💡 Run without --dry-run to apply changes\n');
    return;
  }

  // Apply classifications
  console.log('🚀 Applying classifications...\n');

  for (const tool of [...readTools, ...writeTools]) {
    if (tool.suggestedPermission === 'NEEDS_REVIEW') continue;

    const updated = addPermissionFields(
      tool.filePath,
      tool.suggestedPermission,
      tool.reason
    );

    if (updated) {
      stats.updated++;
      console.log(`  ✅ ${tool.toolName} → ${tool.suggestedPermission.toUpperCase()}`);
    }
  }

  console.log(`\n✅ Successfully classified ${stats.updated} tools!\n`);

  if (needsReview.length > 0) {
    console.log(`⚠️  ${needsReview.length} tools need manual review - see above\n`);
  }

  // Generate summary report
  const reportPath = path.join(__dirname, '../.snow-flow/classification-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    stats,
    needsReview: needsReview.map(t => ({
      name: t.toolName,
      file: path.relative(TOOLS_BASE_DIR, t.filePath),
      reason: t.reason
    }))
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📄 Full report saved to: ${reportPath}\n`);
}

// Run the script
classifyAllTools().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
