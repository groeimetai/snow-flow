/**
 * Enhanced Script Executor
 * Captures ALL output from ServiceNow background scripts
 * Consolidates multiple execution methods into one reliable tool
 */

import { ServiceNowClient } from './servicenow-client.js';
import { Logger } from './logger.js';

interface ScriptExecutionResult {
  success: boolean;
  output: string[];
  errors: string[];
  logs: {
    print: string[];
    info: string[];
    warn: string[];
    error: string[];
    debug: string[];
  };
  executionTime: number;
  executionId: string;
  scriptResult?: any;
  error?: string;
}

export class EnhancedScriptExecutor {
  private client: ServiceNowClient;
  private logger: Logger;

  constructor(client: ServiceNowClient) {
    this.client = client;
    this.logger = new Logger('EnhancedScriptExecutor');
  }

  /**
   * Execute script and capture ALL output including gs.print, gs.info, etc.
   */
  async executeWithFullOutput(script: string, description?: string): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const executionId = `snow_exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    this.logger.info(`Executing script with full output capture - ID: ${executionId}`);
    
    try {
      // Create enhanced wrapper script that captures EVERYTHING
      const enhancedScript = `
        // Enhanced output capture system
        var snowFlowOutput = {
          print: [],
          info: [],
          warn: [],
          error: [],
          debug: [],
          general: [],
          scriptResult: null,
          executionId: '${executionId}',
          startTime: new GlideDateTime().getValue()
        };
        
        // Store original functions
        var origPrint = gs.print;
        var origInfo = gs.info;
        var origWarn = gs.warn;
        var origError = gs.error;
        var origDebug = gs.debug;
        
        // Override gs functions to capture output
        gs.print = function(message) {
          snowFlowOutput.print.push(String(message));
          snowFlowOutput.general.push('[PRINT] ' + String(message));
          return origPrint.call(this, message);
        };
        
        gs.info = function(message) {
          snowFlowOutput.info.push(String(message));
          snowFlowOutput.general.push('[INFO] ' + String(message));
          return origInfo.call(this, message);
        };
        
        gs.warn = function(message) {
          snowFlowOutput.warn.push(String(message));
          snowFlowOutput.general.push('[WARN] ' + String(message));
          return origWarn.call(this, message);
        };
        
        gs.error = function(message) {
          snowFlowOutput.error.push(String(message));
          snowFlowOutput.general.push('[ERROR] ' + String(message));
          return origError.call(this, message);
        };
        
        gs.debug = function(message) {
          snowFlowOutput.debug.push(String(message));
          snowFlowOutput.general.push('[DEBUG] ' + String(message));
          return origDebug.call(this, message);
        };
        
        // Execute user script and capture result
        try {
          gs.info('=== SCRIPT EXECUTION START ===');
          
          // User's script executed here
          var userScriptResult = (function() {
            ${script}
          })();
          
          snowFlowOutput.scriptResult = userScriptResult;
          gs.info('=== SCRIPT EXECUTION SUCCESS ===');
          
        } catch(userError) {
          gs.error('=== SCRIPT EXECUTION ERROR ===');
          gs.error('Error: ' + userError.toString());
          if (userError.stack) {
            gs.error('Stack: ' + userError.stack);
          }
          snowFlowOutput.scriptResult = { error: userError.toString(), stack: userError.stack };
        }
        
        // Restore original functions
        gs.print = origPrint;
        gs.info = origInfo;
        gs.warn = origWarn;
        gs.error = origError;
        gs.debug = origDebug;
        
        // Store output in sys_properties for retrieval
        var outputJson = JSON.stringify(snowFlowOutput);
        gs.setProperty('snow_flow.script_output.' + snowFlowOutput.executionId, outputJson);
        
        // Final summary
        gs.info('Snow-Flow: Script execution complete, output stored in sys_properties');
        gs.info('Snow-Flow: Execution ID = ' + snowFlowOutput.executionId);
        gs.info('Snow-Flow: Total output lines = ' + snowFlowOutput.general.length);
      `;

      // Execute the enhanced script
      const executeResponse = await this.client.executeScript(enhancedScript);
      
      if (!executeResponse.success) {
        throw new Error(`Script execution failed: ${executeResponse.error}`);
      }
      
      // Wait a bit for execution to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retrieve the captured output from sys_properties
      const outputProperty = `snow_flow.script_output.${executionId}`;
      const outputResponse = await this.client.getProperty(outputProperty);
      
      let capturedOutput: any = {
        print: [],
        info: [],
        warn: [],
        error: [],
        debug: [],
        general: [],
        scriptResult: null
      };
      
      if (outputResponse.success && outputResponse.value) {
        try {
          capturedOutput = JSON.parse(outputResponse.value);
        } catch (parseError) {
          this.logger.warn('Failed to parse captured output, using basic result');
        }
        
        // Clean up the property
        await this.client.deleteProperty(outputProperty);
      }
      
      const executionTime = Date.now() - startTime;
      
      const result: ScriptExecutionResult = {
        success: true,
        output: capturedOutput.general || [],
        errors: capturedOutput.error || [],
        logs: {
          print: capturedOutput.print || [],
          info: capturedOutput.info || [],
          warn: capturedOutput.warn || [],
          error: capturedOutput.error || [],
          debug: capturedOutput.debug || []
        },
        executionTime,
        executionId,
        scriptResult: capturedOutput.scriptResult
      };
      
      this.logger.info(`Script execution completed with ${result.output.length} output lines`);
      
      return result;
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error(`Script execution failed: ${error.message}`);
      
      return {
        success: false,
        output: [],
        errors: [error.message],
        logs: {
          print: [],
          info: [],
          warn: [],
          error: [error.message],
          debug: []
        },
        executionTime,
        executionId,
        error: error.message
      };
    }
  }
}