/**
 * Logger utility for ServiceNow agents
 *
 * Features:
 * - Log rotation with maxsize (5MB per file)
 * - Maximum 3 log files per agent (15MB total max)
 * - Logs stored in ~/.snow-flow/logs (centralized)
 * - Silent mode available via SNOW_FLOW_SILENT_LOGS=true
 */

import winston from "winston"
import path from "path"
import os from "os"
import fs from "fs"

// Centralized log directory in user's home
const LOG_DIR = path.join(os.homedir(), ".snow-flow", "logs")

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true })
}

export class Logger {
  private logger: winston.Logger

  constructor(agentName: string) {
    // Check if logging should be silent (for production/quiet mode)
    const isSilent = process.env.SNOW_FLOW_SILENT_LOGS === "true"

    // Check if verbose mode is enabled
    const isVerbose = process.env.LOG_LEVEL === "verbose" || process.env.LOG_LEVEL === "debug"

    // Only log errors in production, or respect LOG_LEVEL
    const logLevel = isSilent ? "error" : process.env.LOG_LEVEL || "warn"

    const transports: winston.transport[] = []

    // Console transport - only in verbose mode or for errors
    if (!isSilent) {
      transports.push(
        new winston.transports.Console({
          format: isVerbose
            ? winston.format.combine(winston.format.colorize(), winston.format.simple())
            : winston.format.printf((info) => `${info.message}`),
          stderrLevels: ["error", "warn", "info", "debug", "verbose", "silly"],
        }),
      )
    }

    // File transports with rotation
    // maxsize: 5MB per file, maxFiles: 3 files (15MB max total per agent)
    transports.push(
      new winston.transports.File({
        filename: path.join(LOG_DIR, `${agentName}-error.log`),
        level: "error",
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
        tailable: true,
      }),
      new winston.transports.File({
        filename: path.join(LOG_DIR, `${agentName}.log`),
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3,
        tailable: true,
      }),
    )

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { agent: agentName },
      transports,
    })
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta)
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta)
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta)
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta)
  }
}

// Create a default logger instance
export const logger = new Logger("snow-flow")
