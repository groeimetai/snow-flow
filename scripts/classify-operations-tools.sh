#!/bin/bash

# Script to add permission fields to operations tools
# Phase 1.2: Classify Core Operations tools

set -e

TOOLS_DIR="/Users/nielsvanderwerf/snow-flow/src/mcp/servicenow-mcp-unified/tools/operations"

echo "🔧 Classifying Core Operations tools..."
echo ""

# READ tools (query, get, discover, search, analyze, lookup, metrics)
READ_TOOLS=(
  "snow_query_incidents"
  "snow_query_problems"
  "snow_query_requests"
  "snow_get_by_sysid"
  "snow_discover_table_fields"
  "snow_cmdb_search"
  "snow_comprehensive_search"
  "snow_catalog_item_search"
  "snow_user_lookup"
  "snow_operational_metrics"
  "snow_pattern_analysis"
  "snow_predictive_analysis"
  "snow_analyze_incident"
)

# WRITE tools (create, update, assign, attach, manage, cleanup, resolve)
WRITE_TOOLS=(
  "snow_create_incident"
  "snow_create_user_group"
  "snow_update_incident"
  "snow_assign_task"
  "snow_attach_file"
  "snow_auto_resolve_incident"
  "snow_catalog_item_manager"
  "snow_manage_group_membership"
  "snow_record_manage"
  "snow_cleanup_test_artifacts"
)

echo "✅ READ tools: ${#READ_TOOLS[@]}"
echo "❌ WRITE tools: ${#WRITE_TOOLS[@]}"
echo ""

# Function to add permission fields to tool file
add_permissions() {
  local file="$1"
  local permission="$2"
  local roles="$3"

  if [ ! -f "$file" ]; then
    echo "⚠️  File not found: $file"
    return
  fi

  # Check if already has permission field
  if grep -q "permission:" "$file"; then
    echo "  ℹ️  Already classified: $(basename $file)"
    return
  fi

  # Find the line with "frequency:" and add permission fields after it
  # Using perl for in-place editing with backup
  perl -i.bak -pe '
    if (/frequency:.*,?$/) {
      $_ .= "\n\n  // 🆕 Permission enforcement (Q1 2025)\n";
      $_ .= "  // Classification: '"$permission"'\n";
      $_ .= "  permission: '"$permission"',\n";
      $_ .= "  allowedRoles: '"$roles"',\n";
    }
  ' "$file"

  echo "  ✅ Classified: $(basename $file) → $permission"
}

echo "📋 Processing READ tools..."
for tool in "${READ_TOOLS[@]}"; do
  file="$TOOLS_DIR/${tool}.ts"
  add_permissions "$file" "read" "['developer', 'stakeholder', 'admin']"
done

echo ""
echo "📋 Processing WRITE tools..."
for tool in "${WRITE_TOOLS[@]}"; do
  file="$TOOLS_DIR/${tool}.ts"
  add_permissions "$file" "write" "['developer', 'admin']"
done

echo ""
echo "✅ Done! Classified $(( ${#READ_TOOLS[@]} + ${#WRITE_TOOLS[@]} )) operations tools"
echo ""
echo "📝 To verify changes:"
echo "   git diff $TOOLS_DIR"
