/**
 * snow_execute_background_script - Execute background scripts with user confirmation
 *
 * Executes JavaScript background scripts in ServiceNow with security analysis
 * and user confirmation (unless autoConfirm=true).
 *
 * ⚠️ CRITICAL: ALL SCRIPTS MUST BE ES5 ONLY!
 * ServiceNow runs on Rhino engine - no const/let/arrow functions/template literals.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_background_script',
  description: '🚨 REQUIRES USER CONFIRMATION (unless autoConfirm=true): Execute background script with security analysis (ES5 only)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'script-execution',
  use_cases: ['automation', 'scripts', 'execution'],
  complexity: 'advanced',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Execution operation - can have side effects
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: '🚨 ES5 ONLY! JavaScript code (no const/let/arrows/templates - Rhino engine)'
      },
      description: {
        type: 'string',
        description: 'Clear description of what the script does (shown to user for approval)'
      },
      runAsUser: {
        type: 'string',
        description: 'User to execute script as (optional, defaults to current user)'
      },
      allowDataModification: {
        type: 'boolean',
        description: 'Whether script is allowed to modify data',
        default: false
      },
      autoConfirm: {
        type: 'boolean',
        description: '⚠️ DANGEROUS: Skip user confirmation and execute immediately',
        default: false
      }
    },
    required: ['script', 'description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { script, description, runAsUser, allowDataModification = false, autoConfirm = false } = args;

  try {
    // ES5 validation
    const es5Validation = validateES5(script);
    if (!es5Validation.valid) {
      throw new SnowFlowError(
        ErrorType.ES5_SYNTAX_ERROR,
        'Script contains non-ES5 syntax',
        {
          retryable: false,
          details: {
            violations: es5Validation.violations,
            message: 'ServiceNow uses Rhino engine - ES6+ syntax will fail'
          }
        }
      );
    }

    // Security analysis
    const securityAnalysis = analyzeScriptSecurity(script);

    // Auto-confirm mode - execute immediately
    if (autoConfirm === true) {
      const executionId = `snow_flow_exec_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const client = await getAuthenticatedClient(context);

      // Create background script record
      const scriptData = {
        name: `Snow-Flow Background Script - ${executionId}`,
        script: script,
        active: true,
        description: `Auto-confirmed: ${description}`
      };

      const response = await client.post('/api/now/table/sys_script', scriptData);
      const scriptRecord = response.data.result;

      return createSuccessResult({
        executed: true,
        execution_id: executionId,
        script_sys_id: scriptRecord.sys_id,
        auto_confirmed: true,
        security_analysis: securityAnalysis,
        message: 'Script saved for execution - run manually from Background Scripts module'
      });
    }

    // Standard mode - return confirmation request
    const confirmationPrompt = generateConfirmationPrompt({
      script,
      description,
      runAsUser,
      allowDataModification,
      securityAnalysis
    });

    return createSuccessResult({
      requires_confirmation: true,
      confirmation_prompt: confirmationPrompt,
      script_to_execute: script,
      execution_context: {
        runAsUser: runAsUser || 'current',
        allowDataModification,
        securityLevel: securityAnalysis.riskLevel
      }
    }, {
      action_required: 'User must approve script execution via snow_confirm_script_execution'
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

function validateES5(code: string): { valid: boolean; violations: any[] } {
  const violations: any[] = [];

  const patterns = [
    { regex: /\b(const|let)\s+/g, type: 'const/let', fix: "Use 'var'" },
    { regex: /\([^)]*\)\s*=>/g, type: 'arrow_function', fix: 'Use function() {}' },
    { regex: /`[^`]*`/g, type: 'template_literal', fix: 'Use string concatenation' },
    { regex: /\{[^}]+\}\s*=\s*/g, type: 'destructuring', fix: 'Use explicit properties' },
    { regex: /for\s*\([^)]*\s+of\s+/g, type: 'for_of', fix: 'Use traditional for loop' },
    { regex: /class\s+\w+/g, type: 'class', fix: 'Use function constructor' }
  ];

  patterns.forEach(({ regex, type, fix }) => {
    let match;
    while ((match = regex.exec(code)) !== null) {
      violations.push({
        type,
        line: code.substring(0, match.index).split('\n').length,
        code: match[0],
        fix
      });
    }
  });

  return { valid: violations.length === 0, violations };
}

function analyzeScriptSecurity(script: string): any {
  const analysis = {
    riskLevel: 'LOW',
    warnings: [] as string[],
    dataOperations: [] as string[],
    systemAccess: [] as string[]
  };

  const dataModificationPatterns = [
    /\.insert\(\)/gi,
    /\.update\(\)/gi,
    /\.deleteRecord\(\)/gi,
    /\.setValue\(/gi
  ];

  const systemAccessPatterns = [
    /gs\.getUser\(\)/gi,
    /gs\.getUserID\(\)/gi,
    /gs\.hasRole\(/gi,
    /gs\.executeNow\(/gi
  ];

  const dangerousPatterns = [
    /eval\(/gi,
    /new Function\(/gi,
    /\.setWorkflow\(/gi
  ];

  dataModificationPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.dataOperations.push(...matches);
      if (analysis.riskLevel === 'LOW') analysis.riskLevel = 'MEDIUM';
    }
  });

  systemAccessPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.systemAccess.push(...matches);
    }
  });

  dangerousPatterns.forEach(pattern => {
    const matches = script.match(pattern);
    if (matches) {
      analysis.warnings.push(`Potentially dangerous operation detected: ${matches[0]}`);
      analysis.riskLevel = 'HIGH';
    }
  });

  if (script.includes('while') && (script.includes('.next()') || script.includes('.hasNext()'))) {
    analysis.warnings.push('Script contains loops that may process many records');
    if (analysis.riskLevel === 'LOW') analysis.riskLevel = 'MEDIUM';
  }

  return analysis;
}

function generateConfirmationPrompt(context: any): string {
  const { script, description, runAsUser, allowDataModification, securityAnalysis } = context;

  const riskEmoji = {
    'LOW': '🟢',
    'MEDIUM': '🟡',
    'HIGH': '🔴'
  }[securityAnalysis.riskLevel] || '⚪';

  return `
🚨 BACKGROUND SCRIPT EXECUTION REQUEST

📋 **Description:** ${description}

${riskEmoji} **Security Risk Level:** ${securityAnalysis.riskLevel}

👤 **Run as User:** ${runAsUser || 'Current User'}
📝 **Data Modification:** ${allowDataModification ? '✅ ALLOWED' : '❌ READ-ONLY'}

🔍 **Script Analysis:**
${securityAnalysis.dataOperations.length > 0 ?
  `📊 Data Operations Detected: ${securityAnalysis.dataOperations.join(', ')}` : ''}
${securityAnalysis.systemAccess.length > 0 ?
  `🔧 System Access: ${securityAnalysis.systemAccess.join(', ')}` : ''}
${securityAnalysis.warnings.length > 0 ?
  `⚠️ Warnings: ${securityAnalysis.warnings.join(', ')}` : ''}

📜 **Script to Execute:**
\`\`\`javascript
${script}
\`\`\`

⚡ **Impact:** This script will run in ServiceNow's server-side JavaScript context with full API access.

❓ **Do you want to proceed with executing this script?**

Reply with:
- ✅ **YES** - Execute the script
- ❌ **NO** - Cancel execution
- 📝 **MODIFY** - Make changes before execution

⚠️ Only proceed if you understand what this script does and trust its source!
`.trim();
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
