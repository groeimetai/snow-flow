/**
 * Logger utility for ServiceNow agents
 */

import winston from 'winston';
import path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(agentName: string) {
    const logDir = path.join(process.cwd(), 'logs');

    // Check if verbose mode is enabled
    const isVerbose = process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug';

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { agent: agentName },
      transports: [
        // Console transport - clean output in non-verbose mode
        new winston.transports.Console({
          format: isVerbose
            ? winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
              )
            : winston.format.printf((info) => `${info.message}`), // Only show message in non-verbose mode
          stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'] // All levels to stderr
        }),
        // File transport
        new winston.transports.File({
          filename: path.join(logDir, `${agentName}-error.log`),
          level: 'error'
        }),
        new winston.transports.File({
          filename: path.join(logDir, `${agentName}.log`)
        })
      ]
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}

// Create a default logger instance
export const logger = new Logger('snow-flow');