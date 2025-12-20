/**
 * Enterprise Proxy Logger
 * Writes debug logs to project folder for troubleshooting
 */

import fs from 'fs';
import path from 'path';

class ProxyLogger {
  private logPath: string | null = null;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    this.initializeLogFile();

    // Log ALL environment variables related to Snow-Flow at startup
    this.logEnvironmentVariables();
  }

  private logEnvironmentVariables(): void {
    const relevantVars = Object.keys(process.env)
      .filter(key => key.includes('SNOW') || key.includes('LICENSE'))
      .reduce((obj: any, key) => {
        // Mask secrets but show first/last few chars for debugging
        const value = process.env[key] || '';
        if (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN')) {
          obj[key] = value.length > 20
            ? `${value.substring(0, 10)}...${value.slice(-10)} (${value.length} chars)`
            : `${value.substring(0, 5)}...${value.slice(-3)} (${value.length} chars)`;
        } else {
          obj[key] = value;
        }
        return obj;
      }, {});

    this.log('debug', 'Environment variables at startup', relevantVars);
  }

  private initializeLogFile(): void {
    try {
      // Get project directory from CWD (where Claude Code is running)
      const projectDir = process.cwd();
      const logsDir = path.join(projectDir, 'logs');

      // Create logs directory if it doesn't exist
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Create log file with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      this.logPath = path.join(logsDir, `enterprise-proxy-${timestamp}.log`);

      // Create write stream
      this.writeStream = fs.createWriteStream(this.logPath, { flags: 'a' });

      this.log('info', '========================================');
      this.log('info', 'Enterprise Proxy Logger Initialized');
      this.log('info', `Log file: ${this.logPath}`);
      this.log('info', '========================================');
    } catch (error) {
      // Fallback to stderr if file logging fails
      console.error('[Proxy Logger] Failed to initialize log file:', error);
      this.logPath = null;
      this.writeStream = null;
    }
  }

  public log(level: 'info' | 'debug' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}\n`;

    // Write to file only (no console output for clean UX)
    if (this.writeStream) {
      this.writeStream.write(logEntry);
    }

    // Only write to stderr for actual errors (not info/debug)
    if (level === 'error') {
      console.error(`[Proxy ${level.toUpperCase()}] ${message}`);
      if (data) {
        console.error(JSON.stringify(data, null, 2));
      }
    }
  }

  public close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  public getLogPath(): string | null {
    return this.logPath;
  }
}

// Singleton instance
export const proxyLogger = new ProxyLogger();

// Cleanup on process exit
process.on('exit', () => {
  proxyLogger.close();
});

process.on('SIGINT', () => {
  proxyLogger.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  proxyLogger.close();
  process.exit(0);
});
