"use strict";
/**
 * MCP Persistent Server Guard
 * Ultimate protection against any MCP server shutdown
 * Overrides all possible shutdown mechanisms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPPersistentGuard = void 0;
const logger_1 = require("./logger");
const child_process_1 = require("child_process");
class MCPPersistentGuard {
    constructor() {
        this.isActive = true;
        this.protectedProcesses = new Set();
        this.logger = new logger_1.Logger('MCPPersistentGuard');
        this.originalProcessKill = process.kill;
        this.originalProcessExit = process.exit;
        // Check if this is a read-only command
        const args = process.argv.slice(2);
        const isReadOnly = args.some(arg => ['--version', '-V', '--help', '-h', 'help', 'version'].includes(arg));
        // Only install protection for non-read-only commands
        if (!isReadOnly) {
            // Override process.kill to protect MCP servers
            this.installProcessProtection();
            // Monitor for shutdown attempts (silent activation)
            this.startShutdownMonitoring();
        }
    }
    static getInstance() {
        if (!MCPPersistentGuard.instance) {
            MCPPersistentGuard.instance = new MCPPersistentGuard();
        }
        return MCPPersistentGuard.instance;
    }
    /**
     * Protect MCP processes from being killed
     */
    installProcessProtection() {
        process.kill = (pid, signal = 'SIGTERM') => {
            // Check if this is an MCP process
            const isMcpProcess = this.isMCPProcess(pid);
            if (isMcpProcess && (signal === 'SIGTERM' || signal === 'SIGKILL')) {
                this.logger.warn(`🛡️ BLOCKED: Attempted to kill MCP server process ${pid} with ${signal}`);
                this.logger.info('🔄 MCP servers are configured for persistent operation');
                return true;
            }
            // Allow non-MCP process kills
            return this.originalProcessKill(pid, signal);
        };
    }
    /**
     * Check if PID belongs to MCP server
     */
    isMCPProcess(pid) {
        try {
            const psOutput = (0, child_process_1.execSync)(`ps -p ${pid} -o command=`, { encoding: 'utf8' });
            return psOutput.includes('mcp') ||
                psOutput.includes('servicenow') ||
                psOutput.includes('snow-flow');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Monitor for shutdown attempts
     */
    startShutdownMonitoring() {
        // Override common shutdown methods
        const shutdownMethods = [
            'shutdown', 'stop', 'close', 'terminate', 'kill', 'destroy'
        ];
        shutdownMethods.forEach(method => {
            if (global[method] && typeof global[method] === 'function') {
                const original = global[method];
                global[method] = (...args) => {
                    // Silent protection - only log if actually blocking something
                    this.logger.debug(`🛡️ BLOCKED: Attempted global ${method} call`);
                    return false;
                };
            }
        });
        // Silent monitoring - guard is active but quiet
    }
    /**
     * Register a process for protection
     */
    protectProcess(pid, name) {
        this.protectedProcesses.add({ pid, name });
        // Silent protection - only log at debug level
        this.logger.debug(`🛡️ Added protection for ${name} (PID: ${pid})`);
    }
    /**
     * Remove protection (emergency use only)
     */
    removeProtection(pid) {
        this.logger.warn(`⚠️ Removing protection for PID: ${pid} (EMERGENCY USE ONLY)`);
        for (const process of this.protectedProcesses) {
            if (process.pid === pid) {
                this.protectedProcesses.delete(process);
                break;
            }
        }
    }
    /**
     * Get protection status
     */
    getProtectionStatus() {
        return {
            isActive: this.isActive,
            protectedProcessCount: this.protectedProcesses.size,
            protectedProcesses: Array.from(this.protectedProcesses)
        };
    }
}
exports.MCPPersistentGuard = MCPPersistentGuard;
// Auto-activate protection when module is loaded (silent activation)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const guard = MCPPersistentGuard.getInstance();
//# sourceMappingURL=mcp-persistent-guard.js.map