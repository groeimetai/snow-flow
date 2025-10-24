/**
 * SnowCode Output Interceptor
 * Captures and reformats SnowCode's output to show beautiful MCP tool execution
 *
 * Detects patterns like:
 * - Shell Create incident dashboard via MCP server
 * - MCP tool execution scripts
 * - JSON-RPC messages
 *
 * And reformats them using MCPOutputFormatter for clean, structured display
 */

import { Transform } from 'stream';
import { MCPOutputFormatter } from './mcp-output-formatter.js';

interface MCPToolExecution {
  server?: string;
  tool?: string;
  params?: Record<string, any>;
  description?: string;
  startTime?: number;
  status?: 'pending' | 'executing' | 'success' | 'failed';
}

export class SnowCodeOutputInterceptor extends Transform {
  private formatter: MCPOutputFormatter;
  private buffer: string = '';
  private inShellBlock: boolean = false;
  private inMCPExecution: boolean = false;
  private currentExecution?: MCPToolExecution;
  private shellBlockLines: string[] = [];
  private quiet: boolean;

  constructor(options?: { quiet?: boolean }) {
    super({ objectMode: false });
    this.formatter = new MCPOutputFormatter({ quiet: options?.quiet || false });
    this.quiet = options?.quiet || false;
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {
    const text = chunk.toString();
    this.buffer += text;

    // Process line by line
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      this.processLine(line + '\n');
    }

    callback();
  }

  _flush(callback: Function) {
    // Process any remaining buffer
    if (this.buffer.length > 0) {
      this.processLine(this.buffer);
    }
    callback();
  }

  private processLine(line: string): void {
    // Detect start of shell MCP execution
    if (line.match(/^Shell\s+(Create|Execute|Query|Update|Delete|Test|Validate)\s+.+via\s+MCP/i)) {
      this.startMCPExecution(line);
      return;
    }

    // Detect shell command block
    if (line.match(/^\$\s+cat\s+>\s+\/tmp\/.*\.js\s+<<\s+'EOF'/)) {
      this.inShellBlock = true;
      this.shellBlockLines = [];
      return; // Don't output this line
    }

    // Detect end of shell block
    if (this.inShellBlock && line.trim() === 'EOF') {
      this.inShellBlock = false;
      this.handleShellBlock();
      return; // Don't output this line
    }

    // Collect shell block lines
    if (this.inShellBlock) {
      this.shellBlockLines.push(line);
      return; // Don't output during collection
    }

    // Detect MCP tool execution patterns in shell output
    if (line.includes('tools/call') && line.includes('params')) {
      this.extractMCPToolCall(line);
      return;
    }

    // Detect MCP server output
    if (line.match(/MCP (Error|Info|Debug):/i) && this.inMCPExecution) {
      // Suppress internal MCP logs during execution
      return;
    }

    // Detect JSON-RPC responses
    if (this.tryParseJSONRPC(line)) {
      return; // Handled by JSON-RPC parser
    }

    // Detect success markers
    if (line.match(/Tool result:|Result:|✓|✅|Success/i) && this.inMCPExecution) {
      this.handleMCPSuccess(line);
      return;
    }

    // Detect error markers
    if (line.match(/Error:|❌|Failed|Exception/i) && this.inMCPExecution) {
      this.handleMCPError(line);
      return;
    }

    // Pass through other lines unchanged
    if (!this.quiet) {
      this.push(line);
    }
  }

  private startMCPExecution(line: string): void {
    this.inMCPExecution = true;

    // Extract tool description from line like:
    // "Shell Create incident dashboard via MCP server"
    const match = line.match(/^Shell\s+(.+?)\s+via\s+MCP/i);
    const description = match ? match[1] : 'MCP tool execution';

    this.currentExecution = {
      description,
      startTime: Date.now(),
      status: 'pending'
    };

    // Don't show the original shell line
  }

  private handleShellBlock(): void {
    // Parse the shell script to extract MCP tool details
    const scriptContent = this.shellBlockLines.join('\n');

    // Extract server name
    const serverMatch = scriptContent.match(/\/([^\/]+)\/index\.js/);
    const server = serverMatch ? serverMatch[1] : 'servicenow-unified';

    // Extract tool call from script
    const toolMatch = scriptContent.match(/name:\s*['"]([^'"]+)['"]/);
    const tool = toolMatch ? toolMatch[1] : 'unknown';

    // Extract parameters
    let params: Record<string, any> = {};
    const paramsMatch = scriptContent.match(/arguments:\s*({[\s\S]*?})/);
    if (paramsMatch) {
      try {
        // Clean up the params string and parse
        const paramsStr = paramsMatch[1]
          .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?\s*:/g, '"$2":') // Quote keys
          .replace(/'/g, '"'); // Replace single quotes with double quotes
        params = JSON.parse(paramsStr);
      } catch (e) {
        // If parsing fails, extract key params manually
        const lines = scriptContent.split('\n');
        for (const line of lines) {
          const kvMatch = line.match(/^\s*([a-zA-Z_]+):\s*['"]?([^'"]+)['"]?/);
          if (kvMatch) {
            params[kvMatch[1]] = kvMatch[2];
          }
        }
      }
    }

    // Update current execution with details
    if (this.currentExecution) {
      this.currentExecution.server = server;
      this.currentExecution.tool = tool;
      this.currentExecution.params = params;
      this.currentExecution.status = 'executing';

      // Show beautiful formatted header
      this.formatter.startToolCall({
        server,
        tool,
        params,
        description: this.currentExecution.description
      });
    }
  }

  private extractMCPToolCall(line: string): void {
    // Try to parse JSON-RPC tool call
    try {
      const jsonMatch = line.match(/({.*})/);
      if (jsonMatch) {
        const rpc = JSON.parse(jsonMatch[1]);
        if (rpc.method === 'tools/call' && rpc.params) {
          if (this.currentExecution) {
            this.currentExecution.tool = rpc.params.name;
            this.currentExecution.params = rpc.params.arguments;
          }
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  private tryParseJSONRPC(line: string): boolean {
    try {
      const trimmed = line.trim();
      if (!trimmed.startsWith('{')) return false;

      const rpc = JSON.parse(trimmed);

      // Handle RPC result
      if (rpc.result && this.inMCPExecution && this.currentExecution) {
        this.handleMCPSuccess(JSON.stringify(rpc.result, null, 2));
        return true;
      }

      // Handle RPC error
      if (rpc.error && this.inMCPExecution) {
        this.handleMCPError(rpc.error.message || JSON.stringify(rpc.error));
        return true;
      }
    } catch (e) {
      // Not valid JSON, return false
    }
    return false;
  }

  private handleMCPSuccess(resultLine: string): void {
    if (!this.currentExecution) return;

    const duration = this.currentExecution.startTime
      ? (Date.now() - this.currentExecution.startTime) / 1000
      : 0;

    // Try to extract result data
    let resultData: any;
    try {
      const jsonMatch = resultLine.match(/({[\s\S]*})/);
      if (jsonMatch) {
        resultData = JSON.parse(jsonMatch[1]);
      }
    } catch (e) {
      resultData = { message: resultLine.trim() };
    }

    // Show beautiful formatted result
    this.formatter.showToolResult(
      {
        server: this.currentExecution.server || 'servicenow-unified',
        tool: this.currentExecution.tool || 'unknown',
        params: this.currentExecution.params || {},
        description: this.currentExecution.description
      },
      {
        success: true,
        data: resultData,
        executionTime: duration
      }
    );

    // Reset state
    this.inMCPExecution = false;
    this.currentExecution = undefined;
  }

  private handleMCPError(errorLine: string): void {
    if (!this.currentExecution) return;

    const duration = this.currentExecution.startTime
      ? (Date.now() - this.currentExecution.startTime) / 1000
      : 0;

    // Show beautiful formatted error
    this.formatter.showToolResult(
      {
        server: this.currentExecution.server || 'servicenow-unified',
        tool: this.currentExecution.tool || 'unknown',
        params: this.currentExecution.params || {},
        description: this.currentExecution.description
      },
      {
        success: false,
        error: errorLine.trim(),
        executionTime: duration
      }
    );

    // Reset state
    this.inMCPExecution = false;
    this.currentExecution = undefined;
  }
}

/**
 * Convenience function to pipe SnowCode output through the interceptor
 */
export function interceptSnowCodeOutput(options?: { quiet?: boolean }): SnowCodeOutputInterceptor {
  return new SnowCodeOutputInterceptor(options);
}
