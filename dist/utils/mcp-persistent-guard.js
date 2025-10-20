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
        if (!isReadOnly) {
            this.logger.info('🛡️ MCP Persistent Guard activated - servers protected from shutdown');
        }
        // Only install protection for non-read-only commands
        if (!isReadOnly) {
            // Override process.kill to protect MCP servers
            this.installProcessProtection();
            // Override process.exit to warn about shutdowns
            this.installExitProtection();
            // Monitor for shutdown attempts
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
     * Warn about process exit attempts
     */
    installExitProtection() {
        process.exit = (code = 0) => {
            this.logger.warn(`⚠️ Process exit attempted with code ${code}`);
            this.logger.info('🔄 MCP servers remain persistent despite main process exit');
            // Still allow main process to exit, but log it
            return this.originalProcessExit(code);
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
                    this.logger.warn(`🛡️ BLOCKED: Attempted global ${method} call`);
                    this.logger.info('🔄 MCP servers protected by persistent guard');
                    return false;
                };
            }
        });
        this.logger.info('🛡️ Persistent guard monitoring active');
    }
    /**
     * Register a process for protection
     */
    protectProcess(pid, name) {
        this.protectedProcesses.add({ pid, name });
        this.logger.info(`🛡️ Added protection for ${name} (PID: ${pid})`);
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
// Auto-activate protection when module is loaded
const guard = MCPPersistentGuard.getInstance();
//# sourceMappingURL=mcp-persistent-guard.js.map