"use strict";
/**
 * Logger utility for ServiceNow agents
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor(agentName) {
        const logDir = path_1.default.join(process.cwd(), 'logs');
        // Check if verbose mode is enabled
        const isVerbose = process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug';
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
            defaultMeta: { agent: agentName },
            transports: [
                // Console transport - clean output in non-verbose mode
                new winston_1.default.transports.Console({
                    format: isVerbose
                        ? winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                        : winston_1.default.format.printf((info) => `${info.message}`), // Only show message in non-verbose mode
                    stderrLevels: ['error', 'warn', 'info', 'debug', 'verbose', 'silly'] // All levels to stderr
                }),
                // File transport
                new winston_1.default.transports.File({
                    filename: path_1.default.join(logDir, `${agentName}-error.log`),
                    level: 'error'
                }),
                new winston_1.default.transports.File({
                    filename: path_1.default.join(logDir, `${agentName}.log`)
                })
            ]
        });
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
}
exports.Logger = Logger;
// Create a default logger instance
exports.logger = new Logger('snow-flow');
//# sourceMappingURL=logger.js.map