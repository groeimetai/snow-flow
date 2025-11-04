#!/usr/bin/env tsx

/**
 * Second Pass: Classify Edge Case Tools
 *
 * Manually classify the 120 tools that couldn't be auto-classified
 * based on logical categories and functionality.
 */

import * as fs from 'fs';
import * as path from 'path';

const TOOLS_BASE_DIR = path.join(__dirname, '../src/mcp/servicenow-mcp-unified/tools');
const DRY_RUN = process.argv.includes('--dry-run');

// Manual classification of edge cases
const EDGE_CASE_CLASSIFICATIONS: Record<string, { permission: 'read' | 'write'; reason: string }> = {
  // Utility functions - READ (pure functions, no ServiceNow modifications)
  'snow_timestamp': { permission: 'read', reason: 'Utility function - generates timestamp locally' },
  'snow_sleep': { permission: 'read', reason: 'Utility function - delays execution but no data modification' },
  'snow_sanitize_input': { permission: 'read', reason: 'Utility function - sanitizes data locally' },
  'snow_random_string': { permission: 'read', reason: 'Utility function - generates random string locally' },
  'snow_merge_objects': { permission: 'read', reason: 'Utility function - merges objects locally' },
  'snow_generate_guid': { permission: 'read', reason: 'Utility function - generates GUID locally' },
  'snow_format_date': { permission: 'read', reason: 'Utility function - formats date locally' },
  'snow_encode_query': { permission: 'read', reason: 'Utility function - encodes query string locally' },
  'snow_decode_query': { permission: 'read', reason: 'Utility function - decodes query string locally' },
  'snow_parse_json': { permission: 'read', reason: 'Utility function - parses JSON locally' },
  'snow_parse_xml': { permission: 'read', reason: 'Utility function - parses XML locally' },
  'snow_hash_string': { permission: 'read', reason: 'Utility function - hashes string locally' },
  'snow_base64_encode': { permission: 'read', reason: 'Utility function - encodes base64 locally' },
  'snow_base64_decode': { permission: 'read', reason: 'Utility function - decodes base64 locally' },

  // Validation/Testing/Preview - READ (only validate, don't modify)
  'snow_widget_test': { permission: 'read', reason: 'Testing function - validates widget without modifying' },
  'snow_preview_widget': { permission: 'read', reason: 'Preview function - renders widget without saving' },
  'snow_debug_widget_fetch': { permission: 'read', reason: 'Debug function - fetches widget data for debugging' },

  // Discovery/Inspection - READ
  'snow_uib_discover': { permission: 'read', reason: 'Discovery function - reads UI Builder configuration' },

  // Security Assessment/Scanning - READ (analyze but don't modify)
  'snow_vulnerability_risk_assessment': { permission: 'read', reason: 'Assessment function - analyzes vulnerabilities without modifying' },
  'snow_security_risk_assessment': { permission: 'read', reason: 'Assessment function - analyzes security risks without modifying' },
  'snow_security_dashboard': { permission: 'read', reason: 'Dashboard function - displays security metrics without modifying' },
  'snow_scan_vulnerabilities': { permission: 'read', reason: 'Scan function - scans for vulnerabilities without modifying' },
  'snow_run_compliance_scan': { permission: 'read', reason: 'Scan function - scans compliance without modifying' },

  // Data transformation - READ (transforms data in-memory, doesn't modify ServiceNow)
  'snow_transform_data': { permission: 'read', reason: 'Transformation function - transforms data locally without ServiceNow modification' },

  // Virtual Agent - WRITE (sends messages, modifies state)
  'snow_train_va_nlu': { permission: 'write', reason: 'Training function - modifies NLU model in ServiceNow' },
  'snow_send_va_message': { permission: 'write', reason: 'Message function - sends messages and modifies conversation state' },
  'snow_handoff_to_agent': { permission: 'write', reason: 'Handoff function - modifies conversation assignment' },

  // Update Sets - WRITE (modifies update set state)
  'snow_ensure_active_update_set': { permission: 'write', reason: 'Update set function - creates or switches active update set' },

  // Property Management - WRITE (bulk operations modify properties)
  'snow_property_io': { permission: 'write', reason: 'Property I/O - imports properties which modifies ServiceNow' },
  'snow_property_bulk': { permission: 'write', reason: 'Bulk operation - modifies multiple properties' },

  // Security Actions - WRITE (modify permissions, automate responses)
  'snow_escalate_permissions': { permission: 'write', reason: 'Permission escalation - modifies user permissions' },
  'snow_automate_threat_response': { permission: 'write', reason: 'Automation - executes automated threat response actions' },

  // Reporting/KPI - WRITE (defines/creates KPIs)
  'snow_define_kpi': { permission: 'write', reason: 'Definition function - creates KPI definition in ServiceNow' },

  // Predictive Intelligence - WRITE (trains models)
  'snow_train_pi_solution': { permission: 'write', reason: 'Training function - trains predictive intelligence model' },

  // Plugins - WRITE (custom plugins likely modify state)
  'snow_custom_plugin': { permission: 'write', reason: 'Plugin function - executes custom plugin which can modify data' },

  // Record management with actions - WRITE
  'snow_record_manage': { permission: 'write', reason: 'Management function - creates/updates/deletes records based on action' },
  'snow_catalog_item_manager': { permission: 'write', reason: 'Management function - manages catalog items' },
  'snow_property_manager': { permission: 'write', reason: 'Management function - manages properties' },

  // Operations that can be both read and write - classify as WRITE (most restrictive)
  'snow_assign_task': { permission: 'write', reason: 'Assignment function - modifies task assignment' },
  'snow_auto_resolve_incident': { permission: 'write', reason: 'Resolution function - closes incidents automatically' },
  'snow_manage_group_membership': { permission: 'write', reason: 'Management function - modifies group memberships' },
  'snow_cleanup_test_artifacts': { permission: 'write', reason: 'Cleanup function - deletes test artifacts' },

  // Workflow/Process - WRITE
  'snow_execute_workflow': { permission: 'write', reason: 'Execution function - triggers workflow execution' },

  // CI/Asset operations - WRITE
  'snow_reconcile_ci': { permission: 'write', reason: 'Reconciliation function - updates CI records' },
  'snow_track_asset_lifecycle': { permission: 'write', reason: 'Tracking function - updates asset lifecycle state' },
  'snow_optimize_licenses': { permission: 'write', reason: 'Optimization function - modifies license allocations' },
  'snow_asset_discovery': { permission: 'write', reason: 'Discovery function - creates/updates asset records' },

  // Advanced analysis with ML predictions - READ (predictions don't modify source data)
  'snow_ml_predict': { permission: 'read', reason: 'Prediction function - generates predictions without modifying data' },
  'snow_ai_classify': { permission: 'read', reason: 'Classification function - classifies data without modifying' },
  'snow_anomaly_detection': { permission: 'read', reason: 'Detection function - detects anomalies without modifying' },
  'snow_duplicate_detection': { permission: 'read', reason: 'Detection function - finds duplicates without modifying' },
  'snow_fuzzy_search': { permission: 'read', reason: 'Search function - performs fuzzy search without modifying' },
  'snow_autocomplete': { permission: 'read', reason: 'Autocomplete function - suggests completions without modifying' },
  'snow_recommendation_engine': { permission: 'read', reason: 'Recommendation function - generates recommendations without modifying' },
  'snow_sentiment_analysis': { permission: 'read', reason: 'Analysis function - analyzes sentiment without modifying' },

  // Aggregation/Metrics - READ
  'snow_aggregate_metrics': { permission: 'read', reason: 'Aggregation function - aggregates metrics without modifying' },

  // Pattern/Predictive analysis - READ
  'snow_pattern_analysis': { permission: 'read', reason: 'Analysis function - analyzes patterns without modifying' },
  'snow_predictive_analysis': { permission: 'read', reason: 'Analysis function - performs predictive analysis without modifying' },

  // Data quality/optimization analysis - READ
  'snow_analyze_data_quality': { permission: 'read', reason: 'Analysis function - analyzes data quality without modifying' },
  'snow_optimize_queries': { permission: 'read', reason: 'Analysis function - suggests query optimizations without modifying' },

  // CI operations that are primarily read
  'snow_ci_health_check': { permission: 'read', reason: 'Health check - validates CI health without modifying' },
  'snow_get_ci_details': { permission: 'read', reason: 'Get function - retrieves CI details' },
  'snow_get_ci_history': { permission: 'read', reason: 'Get function - retrieves CI history' },
  'snow_get_ci_impact': { permission: 'read', reason: 'Get function - analyzes CI impact' },
  'snow_get_ci_relationships': { permission: 'read', reason: 'Get function - retrieves CI relationships' },
  'snow_get_event_correlation': { permission: 'read', reason: 'Get function - retrieves event correlations' },
  'snow_impact_analysis': { permission: 'read', reason: 'Analysis function - analyzes impact without modifying' },

  // Change operations - READ for query, WRITE for manage
  'snow_change_query': { permission: 'read', reason: 'Query function - retrieves change records' },

  // Calendar/Schedule - READ (gets calendar info)
  'snow_calendar': { permission: 'read', reason: 'Calendar function - retrieves calendar information' },

  // SLA calculations - READ
  'snow_calculate_sla_duration': { permission: 'read', reason: 'Calculation function - calculates SLA duration locally' },

  // Connectors/Batch - depends on action, classify as WRITE (can modify)
  'snow_batch_request': { permission: 'write', reason: 'Batch function - can execute multiple operations including writes' },

  // Operations analysis - READ
  'snow_analyze_incident': { permission: 'read', reason: 'Analysis function - analyzes incident without modifying' },
  'snow_operational_metrics': { permission: 'read', reason: 'Metrics function - retrieves operational metrics' },

  // User operations - depends, but lookup is READ
  'snow_user_lookup': { permission: 'read', reason: 'Lookup function - retrieves user information' },

  // Catalog search - READ
  'snow_catalog_item_search': { permission: 'read', reason: 'Search function - searches catalog items' },
  'snow_comprehensive_search': { permission: 'read', reason: 'Search function - performs comprehensive search' },

  // Incident operations
  'snow_update_incident': { permission: 'write', reason: 'Update function - modifies incident records' },

  // Asset reports/compliance - READ
  'snow_asset_compliance_report': { permission: 'read', reason: 'Report function - generates compliance report' },

  // Test/ATF operations - discovery is READ, execution is WRITE
  'snow_discover_atf_tests': { permission: 'read', reason: 'Discovery function - lists ATF tests' },
  'snow_get_atf_results': { permission: 'read', reason: 'Get function - retrieves test results' },

  // Attachments operations
  'snow_get_attachments': { permission: 'read', reason: 'Get function - retrieves attachments' },

  // Automation operations - discovery is READ, execution is WRITE
  'snow_discover_automation_jobs': { permission: 'read', reason: 'Discovery function - lists automation jobs' },
  'snow_discover_events': { permission: 'read', reason: 'Discovery function - lists events' },
  'snow_discover_schedules': { permission: 'read', reason: 'Discovery function - lists schedules' },
  'snow_get_logs': { permission: 'read', reason: 'Get function - retrieves system logs' },
  'snow_get_script_output': { permission: 'read', reason: 'Get function - retrieves script execution output' },

  // Catalog operations
  'snow_discover_catalogs': { permission: 'read', reason: 'Discovery function - lists catalogs' },
  'snow_get_catalog_item_details': { permission: 'read', reason: 'Get function - retrieves catalog item details' },

  // Approvals - get pending is READ
  'snow_get_pending_approvals': { permission: 'read', reason: 'Get function - retrieves pending approvals' },
};

function addPermissionFields(filePath: string, permission: 'read' | 'write', reason: string): boolean {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Check if already classified
    if (content.includes('permission:') && content.includes('allowedRoles:')) {
      return false;
    }

    // Find insertion point
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

async function classifyEdgeCases(): Promise<void> {
  console.log('🔧 Classifying Edge Case Tools (Second Pass)...\n');

  let updated = 0;
  let alreadyClassified = 0;
  let notFound = 0;

  for (const [toolName, classification] of Object.entries(EDGE_CASE_CLASSIFICATIONS)) {
    // Find the tool file
    const possiblePath = path.join(TOOLS_BASE_DIR, `**/${toolName}.ts`);

    // Simple glob implementation - search in all subdirectories
    let filePath: string | null = null;
    const searchDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          searchDir(fullPath);
        } else if (entry.isFile() && entry.name === `${toolName}.ts`) {
          filePath = fullPath;
        }
      }
    };

    searchDir(TOOLS_BASE_DIR);

    if (!filePath) {
      console.log(`  ⚠️  ${toolName} - File not found`);
      notFound++;
      continue;
    }

    const success = addPermissionFields(filePath, classification.permission, classification.reason);

    if (success) {
      updated++;
      console.log(`  ✅ ${toolName} → ${classification.permission.toUpperCase()}`);
    } else {
      alreadyClassified++;
      console.log(`  ℹ️  ${toolName} - Already classified`);
    }
  }

  console.log(`\n✅ Second pass complete!\n`);
  console.log(`  ✅ Classified: ${updated}`);
  console.log(`  ℹ️  Already done: ${alreadyClassified}`);
  console.log(`  ⚠️  Not found: ${notFound}`);
  console.log(`\n📊 Total edge cases in dictionary: ${Object.keys(EDGE_CASE_CLASSIFICATIONS).length}\n`);

  if (DRY_RUN) {
    console.log('🏃 DRY RUN MODE - No files were modified\n');
  }
}

classifyEdgeCases().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
