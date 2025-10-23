/**
 * MCP Output Formatter
 *
 * Provides beautiful, structured output for MCP tool execution
 * Similar to Claude Code's clean MCP usage display
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';

export interface MCPToolCall {
  server: string;
  tool: string;
  params: any;
  description?: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export interface ExecutionPhase {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  message?: string;
  duration?: number;
}

/**
 * Formats MCP tool execution for beautiful console output
 */
export class MCPOutputFormatter {
  private spinner: Ora | null = null;
  private startTime: number = 0;
  private quiet: boolean = false;

  constructor(options?: { quiet?: boolean }) {
    this.quiet = options?.quiet || false;
  }

  /**
   * Show tool call start with beautiful formatting
   */
  startToolCall(call: MCPToolCall): void {
    if (this.quiet) return;

    this.startTime = Date.now();

    console.log('');
    console.log(chalk.blue('━'.repeat(60)));
    console.log(chalk.blue.bold('  MCP Tool Execution'));
    console.log(chalk.blue('━'.repeat(60)));
    console.log('');

    // Server info
    console.log(chalk.dim('  Server:  ') + chalk.cyan(call.server));

    // Tool info
    console.log(chalk.dim('  Tool:    ') + chalk.green(call.tool));

    // Description (if provided)
    if (call.description) {
      console.log(chalk.dim('  Action:  ') + chalk.white(call.description));
    }

    console.log('');

    // Params summary (compact, not full dump)
    this.showParamsSummary(call.params);

    console.log('');
  }

  /**
   * Show execution phases with progress
   */
  async executeWithProgress<T>(
    phases: ExecutionPhase[],
    executor: () => Promise<T>
  ): Promise<T> {
    if (this.quiet) {
      return await executor();
    }

    console.log(chalk.dim('  Execution Steps:'));
    console.log('');

    // Show all phases as pending initially
    const phaseLines: string[] = [];
    for (const phase of phases) {
      phaseLines.push(this.formatPhase(phase));
    }

    // Execute with live updates
    let currentPhaseIndex = 0;

    const updatePhase = (index: number, status: ExecutionPhase['status'], message?: string) => {
      if (index < phases.length) {
        phases[index].status = status;
        if (message) phases[index].message = message;

        // Re-render all phases
        process.stdout.write('\x1b[' + phases.length + 'A'); // Move cursor up
        for (let i = 0; i < phases.length; i++) {
          console.log('  ' + this.formatPhase(phases[i]));
        }
      }
    };

    try {
      // Simulate phase progression (in real implementation, this would be event-driven)
      updatePhase(0, 'running');

      const result = await executor();

      // Mark all as completed
      for (let i = 0; i < phases.length; i++) {
        updatePhase(i, 'completed');
      }

      return result;

    } catch (error) {
      updatePhase(currentPhaseIndex, 'failed', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Show tool result with beautiful formatting
   */
  showToolResult(call: MCPToolCall, result: MCPToolResult): void {
    if (this.quiet) return;

    console.log('');
    console.log(chalk.blue('━'.repeat(60)));

    if (result.success) {
      console.log(chalk.green.bold('  ✓ Success'));
    } else {
      console.log(chalk.red.bold('  ✗ Failed'));
    }

    console.log(chalk.blue('━'.repeat(60)));
    console.log('');

    // Execution time
    const duration = result.executionTime || (Date.now() - this.startTime);
    console.log(chalk.dim('  Duration: ') + chalk.yellow(this.formatDuration(duration)));

    console.log('');

    // Result data (summarized, not full dump)
    if (result.success && result.data) {
      this.showResultSummary(result.data);
    } else if (result.error) {
      this.showError(result.error);
    }

    console.log('');
  }

  /**
   * Show compact spinner for simple operations
   */
  startSpinner(message: string): void {
    if (this.quiet) return;

    this.spinner = ora({
      text: message,
      color: 'cyan',
      spinner: 'dots'
    }).start();
  }

  /**
   * Update spinner message
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Complete spinner with success
   */
  succeedSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    }
  }

  /**
   * Complete spinner with failure
   */
  failSpinner(message?: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Show inline progress (for batch operations)
   */
  showBatchProgress(current: number, total: number, itemName?: string): void {
    if (this.quiet) return;

    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 2);
    const empty = 50 - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    const info = itemName ? ` ${itemName}` : '';

    process.stdout.write(`\r  ${bar} ${percentage}% (${current}/${total})${info}`);

    if (current === total) {
      console.log(''); // New line when complete
    }
  }

  /**
   * Format execution phase for display
   */
  private formatPhase(phase: ExecutionPhase): string {
    let icon: string;
    let color: (text: string) => string;

    switch (phase.status) {
      case 'pending':
        icon = chalk.dim('○');
        color = chalk.dim;
        break;
      case 'running':
        icon = chalk.cyan('◐');
        color = chalk.cyan;
        break;
      case 'completed':
        icon = chalk.green('✓');
        color = chalk.green;
        break;
      case 'failed':
        icon = chalk.red('✗');
        color = chalk.red;
        break;
    }

    const message = phase.message ? chalk.dim(` - ${phase.message}`) : '';
    const duration = phase.duration ? chalk.dim(` (${this.formatDuration(phase.duration)})`) : '';

    return `${icon} ${color(phase.name)}${message}${duration}`;
  }

  /**
   * Show compact parameters summary (not full JSON dump)
   */
  private showParamsSummary(params: any): void {
    if (!params || Object.keys(params).length === 0) {
      console.log(chalk.dim('  Parameters: (none)'));
      return;
    }

    console.log(chalk.dim('  Parameters:'));

    const keys = Object.keys(params);
    const maxKeysToShow = 5;

    for (let i = 0; i < Math.min(keys.length, maxKeysToShow); i++) {
      const key = keys[i];
      const value = params[key];

      // Format value intelligently
      let displayValue: string;
      if (typeof value === 'string') {
        displayValue = value.length > 50
          ? chalk.white(value.substring(0, 50) + '...')
          : chalk.white(value);
      } else if (typeof value === 'object' && value !== null) {
        const objKeys = Object.keys(value);
        displayValue = chalk.dim(`{${objKeys.length} properties}`);
      } else {
        displayValue = chalk.white(String(value));
      }

      console.log(`    ${chalk.cyan(key)}: ${displayValue}`);
    }

    if (keys.length > maxKeysToShow) {
      console.log(chalk.dim(`    ... and ${keys.length - maxKeysToShow} more`));
    }
  }

  /**
   * Show compact result summary (not full JSON dump)
   */
  private showResultSummary(data: any): void {
    if (!data) {
      console.log(chalk.dim('  Result: (empty)'));
      return;
    }

    // Handle common result types
    if (data.sys_id) {
      console.log(chalk.dim('  Record Created:'));
      console.log(`    ${chalk.cyan('sys_id')}: ${chalk.white(data.sys_id)}`);
      if (data.number) {
        console.log(`    ${chalk.cyan('number')}: ${chalk.white(data.number)}`);
      }
      if (data.name) {
        console.log(`    ${chalk.cyan('name')}: ${chalk.white(data.name)}`);
      }
    } else if (Array.isArray(data)) {
      console.log(chalk.dim(`  Result: `));
      console.log(`    ${chalk.green('✓')} ${data.length} item(s) returned`);

      if (data.length > 0 && data.length <= 3) {
        data.forEach((item, i) => {
          const summary = this.summarizeItem(item);
          console.log(`    ${i + 1}. ${summary}`);
        });
      }
    } else if (typeof data === 'object') {
      console.log(chalk.dim('  Result:'));
      const keys = Object.keys(data);
      const maxKeysToShow = 5;

      for (let i = 0; i < Math.min(keys.length, maxKeysToShow); i++) {
        const key = keys[i];
        const value = this.formatValue(data[key]);
        console.log(`    ${chalk.cyan(key)}: ${value}`);
      }

      if (keys.length > maxKeysToShow) {
        console.log(chalk.dim(`    ... and ${keys.length - maxKeysToShow} more`));
      }
    } else {
      console.log(chalk.dim('  Result: ') + chalk.white(String(data)));
    }
  }

  /**
   * Show error with formatting
   */
  private showError(error: string): void {
    console.log(chalk.red.bold('  Error:'));
    console.log('');

    // Split error into lines and indent
    const lines = error.split('\n');
    lines.forEach(line => {
      console.log(`    ${chalk.red(line)}`);
    });
  }

  /**
   * Format duration in human-readable form
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Summarize an item for display
   */
  private summarizeItem(item: any): string {
    if (typeof item === 'string') {
      return item.length > 50 ? item.substring(0, 50) + '...' : item;
    }

    if (typeof item === 'object' && item !== null) {
      if (item.name) {
        return chalk.white(item.name) + (item.sys_id ? chalk.dim(` (${item.sys_id.substring(0, 8)}...)`) : '');
      }
      if (item.number) {
        return chalk.white(item.number);
      }
      return chalk.dim(`{${Object.keys(item).length} properties}`);
    }

    return String(item);
  }

  /**
   * Format a value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return chalk.dim('(empty)');
    }

    if (typeof value === 'string') {
      return value.length > 60
        ? chalk.white(value.substring(0, 60) + '...')
        : chalk.white(value);
    }

    if (typeof value === 'boolean') {
      return value ? chalk.green('true') : chalk.red('false');
    }

    if (typeof value === 'number') {
      return chalk.yellow(String(value));
    }

    if (Array.isArray(value)) {
      return chalk.dim(`[${value.length} items]`);
    }

    if (typeof value === 'object') {
      return chalk.dim(`{${Object.keys(value).length} properties}`);
    }

    return chalk.white(String(value));
  }

  /**
   * Clear the console (for clean slate)
   */
  clear(): void {
    if (!this.quiet) {
      console.clear();
    }
  }

  /**
   * Show section header
   */
  section(title: string): void {
    if (this.quiet) return;

    console.log('');
    console.log(chalk.blue.bold(`  ${title}`));
    console.log(chalk.blue('  ' + '─'.repeat(title.length)));
    console.log('');
  }

  /**
   * Show info message
   */
  info(message: string): void {
    if (!this.quiet) {
      console.log(`  ${chalk.blue('ℹ')} ${message}`);
    }
  }

  /**
   * Show success message
   */
  success(message: string): void {
    if (!this.quiet) {
      console.log(`  ${chalk.green('✓')} ${message}`);
    }
  }

  /**
   * Show warning message
   */
  warning(message: string): void {
    if (!this.quiet) {
      console.log(`  ${chalk.yellow('⚠')} ${message}`);
    }
  }

  /**
   * Show error message
   */
  error(message: string): void {
    if (!this.quiet) {
      console.log(`  ${chalk.red('✗')} ${message}`);
    }
  }

  /**
   * Show table of data
   */
  table(headers: string[], rows: string[][]): void {
    if (this.quiet) return;

    // Calculate column widths
    const widths = headers.map((h, i) => {
      const maxContentWidth = Math.max(
        h.length,
        ...rows.map(r => (r[i] || '').length)
      );
      return Math.min(maxContentWidth, 40); // Max 40 chars per column
    });

    // Print header
    const headerRow = headers.map((h, i) =>
      chalk.cyan(h.padEnd(widths[i]))
    ).join('  ');
    console.log(`  ${headerRow}`);

    // Print separator
    const separator = widths.map(w => '─'.repeat(w)).join('  ');
    console.log(`  ${chalk.dim(separator)}`);

    // Print rows
    rows.forEach(row => {
      const formattedRow = row.map((cell, i) => {
        const truncated = cell.length > widths[i]
          ? cell.substring(0, widths[i] - 3) + '...'
          : cell;
        return truncated.padEnd(widths[i]);
      }).join('  ');
      console.log(`  ${formattedRow}`);
    });

    console.log('');
  }
}

/**
 * Singleton instance for global use
 */
export const mcpFormatter = new MCPOutputFormatter();
