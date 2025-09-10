/**
 * Unified Script Executor
 * Single reliable tool to replace all script execution methods
 * Captures COMPLETE output from ServiceNow scripts
 */

import { ServiceNowClient } from './servicenow-client.js';
import { Logger } from './logger.js';

export interface UnifiedScriptResult {
  success: boolean;
  output: string[];
  scriptResult: any;
  executionId: string;
  executionTime: number;
  logs: {
    print: string[];
    info: string[];
    warn: string[];
    error: string[];
  };
  summary: string;
  error?: string;
}

export class UnifiedScriptExecutor {
  private client: ServiceNowClient;
  private logger: Logger;

  constructor(client: ServiceNowClient) {
    this.client = client;
    this.logger = new Logger('UnifiedScriptExecutor');
  }

  /**
   * Execute script with complete output capture
   * Replaces: snow_execute_script_with_output, snow_execute_script_sync, snow_execute_background_script
   */
  async executeScript(script: string, description?: string): Promise<UnifiedScriptResult> {
    const startTime = Date.now();
    const executionId = `unified_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.logger.info(`Executing script with unified capture - ID: ${executionId}`);
    
    try {
      // Enhanced script that captures EVERYTHING
      const captureScript = `
        // Snow-Flow Enhanced Output Capture System
        var snowFlowCapture = {
          print: [],
          info: [],
          warn: [],
          error: [],
          output: [],
          scriptResult: null,
          executionId: '${executionId}',
          success: true,
          startTime: new GlideDateTime().getDisplayValue()
        };
        
        // Store original gs methods
        var origPrint = gs.print;
        var origInfo = gs.info; 
        var origWarn = gs.warn;
        var origError = gs.error;
        
        // Enhanced capture functions
        gs.print = function(msg) {
          var message = String(msg);
          snowFlowCapture.print.push(message);
          snowFlowCapture.output.push('[PRINT] ' + message);
          return origPrint(msg);
        };
        
        gs.info = function(msg) {
          var message = String(msg);
          snowFlowCapture.info.push(message);
          snowFlowCapture.output.push('[INFO] ' + message);
          return origInfo(msg);
        };
        
        gs.warn = function(msg) {
          var message = String(msg);
          snowFlowCapture.warn.push(message);
          snowFlowCapture.output.push('[WARN] ' + message);
          return origWarn(msg);
        };
        
        gs.error = function(msg) {
          var message = String(msg);
          snowFlowCapture.error.push(message);
          snowFlowCapture.output.push('[ERROR] ' + message);
          return origError(msg);
        };
        
        // Execute user script
        try {
          gs.info('=== SNOW-FLOW UNIFIED EXECUTION START ===');
          
          var result = (function() {
            ${script}
          })();
          
          snowFlowCapture.scriptResult = result;
          gs.info('=== SNOW-FLOW EXECUTION SUCCESS ===');
          gs.info('Script Result: ' + (typeof result === 'object' ? JSON.stringify(result) : String(result)));
          
        } catch(scriptError) {
          snowFlowCapture.success = false;
          gs.error('=== SNOW-FLOW EXECUTION ERROR ===');
          gs.error('Error: ' + scriptError.toString());
          snowFlowCapture.scriptResult = { error: scriptError.toString() };
        }
        
        // Restore original functions
        gs.print = origPrint;
        gs.info = origInfo;
        gs.warn = origWarn;
        gs.error = origError;
        
        // Store result in temporary property
        gs.setProperty('snow_flow.unified_output.' + snowFlowCapture.executionId, JSON.stringify(snowFlowCapture));
        
        gs.info('Snow-Flow: Unified execution complete, ID = ' + snowFlowCapture.executionId);
      `;

      // Execute the script
      const executeResponse = await this.client.executeScript(captureScript);
      
      if (!executeResponse.success) {
        throw new Error(`Script execution failed: ${executeResponse.error}`);
      }
      
      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Retrieve captured output
      const outputProperty = `snow_flow.unified_output.${executionId}`;
      const outputResponse = await this.client.getProperty(outputProperty);
      
      let capturedData: any = {
        print: [],
        info: [],
        warn: [],
        error: [],
        output: [],
        scriptResult: null,
        success: false
      };
      
      if (outputResponse.success && outputResponse.value) {
        try {
          capturedData = JSON.parse(outputResponse.value);
          // Clean up
          await this.client.deleteProperty(outputProperty);
        } catch (parseError) {
          this.logger.warn('Parse error:', parseError);
        }
      }
      
      const executionTime = Date.now() - startTime;
      
      return {
        success: capturedData.success,
        output: capturedData.output || [],
        scriptResult: capturedData.scriptResult,
        executionId,
        executionTime,
        logs: {
          print: capturedData.print || [],
          info: capturedData.info || [],
          warn: capturedData.warn || [],
          error: capturedData.error || []
        },
        summary: `✅ Execution complete: ${capturedData.output?.length || 0} output lines, ${capturedData.error?.length || 0} errors`,
        error: capturedData.success ? undefined : 'Script execution failed'
      };
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        output: [],
        scriptResult: null,
        executionId,
        executionTime,
        logs: { print: [], info: [], warn: [], error: [error.message] },
        summary: `❌ Execution failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

// Export as MCP tool helper
export function createUnifiedScriptTool() {
  return {
    name: 'snow_execute_script_unified',
    description: '🚀 UNIFIED: Execute script with complete output capture (replaces all other script tools). ⚠️ ES5 ONLY!',
    inputSchema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '🚨 ES5 ONLY! JavaScript code (var, function(){}, string concatenation)' },
        description: { type: 'string', description: 'What this script does' }
      },
      required: ['script']
    }
  };
}