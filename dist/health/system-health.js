"use strict";
/**
 * Snow-Flow System Health Monitoring
 * Comprehensive health checks for all components
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemHealth = void 0;
const events_1 = require("events");
const servicenow_client_1 = require("../utils/servicenow-client");
const logger_1 = require("../utils/logger");
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
class SystemHealth extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.checkHistory = [];
        this.totalChecks = 0;
        this.failedChecks = 0;
        this.lastCPUInfo = null;
        this.memory = options.memory;
        this.mcpManager = options.mcpManager;
        this.config = options.config;
        this.logger = new logger_1.Logger('SystemHealth');
        this.startTime = Date.now();
    }
    /**
     * Initialize health monitoring
     */
    async initialize() {
        this.logger.info('Initializing System Health monitoring...');
        // Initialize ServiceNow client for health checks
        try {
            this.serviceNowClient = new servicenow_client_1.ServiceNowClient();
            // Note: ServiceNowClient may not have an initialize method
            // await this.serviceNowClient.initialize();
        }
        catch (error) {
            this.logger.warn('ServiceNow client initialization failed:', error);
        }
        // Create health check tables
        await this.createHealthTables();
        // Perform initial health check
        await this.performHealthCheck();
        this.logger.info('System Health monitoring initialized');
    }
    /**
     * Start periodic health monitoring
     */
    async startMonitoring(intervalMs = 60000) {
        if (this.checkInterval) {
            this.logger.warn('Health monitoring already started');
            return;
        }
        this.logger.info(`Starting health monitoring with ${intervalMs}ms interval`);
        this.checkInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            }
            catch (error) {
                this.logger.error('Health check failed:', error);
            }
        }, intervalMs);
        // Perform immediate check
        await this.performHealthCheck();
    }
    /**
     * Stop health monitoring
     */
    async stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = undefined;
            this.logger.info('Health monitoring stopped');
        }
        if (this.cpuCheckInterval) {
            clearInterval(this.cpuCheckInterval);
            this.cpuCheckInterval = undefined;
        }
    }
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        this.totalChecks++;
        const startTime = Date.now();
        this.logger.debug('Performing system health check...');
        // Run all health checks in parallel
        const [memory, mcp, servicenow, queen, system, performance] = await Promise.all([
            this.config.checks.memory ? this.checkMemory() : this.createSkippedResult('memory'),
            this.config.checks.mcp ? this.checkMCP() : this.createSkippedResult('mcp'),
            this.config.checks.servicenow ? this.checkServiceNow() : this.createSkippedResult('servicenow'),
            this.config.checks.queen ? this.checkQueen() : this.createSkippedResult('queen'),
            this.checkSystem(),
            this.checkPerformance()
        ]);
        const components = { memory, mcp, servicenow, queen, system, performance };
        // Determine overall health status
        const unhealthyCount = Object.values(components).filter(c => c.status === 'unhealthy').length;
        const degradedCount = Object.values(components).filter(c => c.status === 'degraded').length;
        let overallStatus;
        if (unhealthyCount > 0) {
            overallStatus = 'unhealthy';
            this.failedChecks++;
        }
        else if (degradedCount > 0) {
            overallStatus = 'degraded';
        }
        else {
            overallStatus = 'healthy';
        }
        const status = {
            healthy: overallStatus === 'healthy',
            status: overallStatus,
            timestamp: new Date(),
            components,
            metrics: {
                uptime: Date.now() - this.startTime,
                totalChecks: this.totalChecks,
                failedChecks: this.failedChecks,
                avgResponseTime: this.calculateAverageResponseTime(),
                systemResources: await this.getSystemResources()
            }
        };
        // Store health check result
        await this.storeHealthResult(status);
        // Emit health status
        this.emit('health:check', status);
        // Check for alerts
        this.checkAlerts(status);
        const duration = Date.now() - startTime;
        this.logger.debug(`Health check completed in ${duration}ms - Status: ${overallStatus}`);
        return status;
    }
    /**
     * Get full health status
     */
    async getFullStatus() {
        return this.performHealthCheck();
    }
    /**
     * Get health history
     */
    async getHealthHistory(limit = 100) {
        const results = await this.memory.query?.(`
      SELECT * FROM health_checks
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `);
        return results || [];
    }
    /**
     * Check if system is healthy
     */
    async isHealthy() {
        const status = await this.performHealthCheck();
        return status.healthy;
    }
    /**
     * Private health check methods
     */
    async checkMemory() {
        const startTime = Date.now();
        try {
            // Check if memory system is responsive
            const testKey = `health_check_${Date.now()}`;
            await this.memory.store(testKey, { test: true }, 60000); // 1 minute TTL
            const retrieved = await this.memory.get(testKey);
            await this.memory.delete(testKey);
            if (!retrieved) {
                throw new Error('Memory store/retrieve test failed');
            }
            // Check memory database size
            const dbStats = await this.memory.getDatabaseStats();
            const dbSizeMB = dbStats.size / 1024 / 1024;
            // Check cache performance
            const cacheStats = await this.memory.getCacheStats();
            const cacheHitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0;
            const responseTime = Date.now() - startTime;
            // Determine status
            let status = 'healthy';
            let message = 'Memory system operating normally';
            if (dbSizeMB > 1000) { // > 1GB
                status = 'degraded';
                message = 'Database size exceeding recommended limits';
            }
            if (cacheHitRate < 0.5 && cacheStats.hits + cacheStats.misses > 100) {
                status = 'degraded';
                message = 'Low cache hit rate';
            }
            if (responseTime > this.config.thresholds.responseTime) {
                status = 'unhealthy';
                message = 'Memory system response time too high';
            }
            return {
                component: 'memory',
                status,
                message,
                details: {
                    dbSizeMB,
                    cacheHitRate,
                    cacheStats,
                    responseTime
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'memory',
                status: 'unhealthy',
                message: 'Memory system check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    async checkMCP() {
        const startTime = Date.now();
        try {
            const serverStatuses = this.mcpManager.getServerList();
            const totalServers = serverStatuses.length;
            const healthyServers = serverStatuses.filter(s => s.status === 'running').length;
            const unhealthyServers = serverStatuses.filter(s => s.status === 'error').length;
            const responseTime = Date.now() - startTime;
            let status = 'healthy';
            let message = `All ${totalServers} MCP servers running`;
            if (unhealthyServers > 0) {
                status = unhealthyServers >= totalServers / 2 ? 'unhealthy' : 'degraded';
                message = `${unhealthyServers} of ${totalServers} MCP servers not running`;
            }
            return {
                component: 'mcp',
                status,
                message,
                details: {
                    totalServers,
                    healthyServers,
                    unhealthyServers,
                    serverStatuses
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'mcp',
                status: 'unhealthy',
                message: 'MCP server check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    async checkServiceNow() {
        const startTime = Date.now();
        try {
            if (!this.serviceNowClient) {
                return {
                    component: 'servicenow',
                    status: 'unknown',
                    message: 'ServiceNow client not initialized',
                    timestamp: new Date(),
                    responseTime: Date.now() - startTime
                };
            }
            // Perform a simple API call to check connectivity
            const testResult = await this.serviceNowClient.testConnection();
            const responseTime = Date.now() - startTime;
            if (!testResult.success) {
                return {
                    component: 'servicenow',
                    status: 'unhealthy',
                    message: 'ServiceNow connection test failed',
                    error: testResult.error,
                    timestamp: new Date(),
                    responseTime
                };
            }
            let status = 'healthy';
            let message = 'ServiceNow connection healthy';
            if (responseTime > this.config.thresholds.responseTime) {
                status = 'degraded';
                message = 'ServiceNow response time high';
            }
            return {
                component: 'servicenow',
                status,
                message,
                details: {
                    connected: true,
                    responseTime
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'servicenow',
                status: 'unhealthy',
                message: 'ServiceNow check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    async checkQueen() {
        const startTime = Date.now();
        try {
            // Check active queen sessions
            const activeSessions = await this.memory.query?.(`
        SELECT COUNT(*) as count FROM swarm_sessions
        WHERE status = 'active'
      `) || [];
            // Check agent coordination
            const activeAgents = await this.memory.query?.(`
        SELECT COUNT(*) as count FROM agent_coordination
        WHERE status IN ('spawned', 'active')
      `) || [];
            const responseTime = Date.now() - startTime;
            let status = 'healthy';
            let message = 'Queen coordination system healthy';
            const sessionCount = activeSessions[0]?.count || 0;
            const agentCount = activeAgents[0]?.count || 0;
            if (agentCount > this.config.thresholds.queueSize) {
                status = 'degraded';
                message = 'High number of active agents';
            }
            return {
                component: 'queen',
                status,
                message,
                details: {
                    activeSessions: sessionCount,
                    activeAgents: agentCount,
                    responseTime
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'queen',
                status: 'unhealthy',
                message: 'Queen system check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    async checkSystem() {
        const startTime = Date.now();
        try {
            const resources = await this.getSystemResources();
            const enhancedMetrics = await this.getEnhancedSystemMetrics();
            const responseTime = Date.now() - startTime;
            let status = 'healthy';
            let message = 'System resources within normal limits';
            const issues = [];
            // Check CPU usage
            if (resources.cpuUsage > this.config.thresholds.cpuUsage * 100) {
                status = 'degraded';
                issues.push(`High CPU usage: ${resources.cpuUsage.toFixed(1)}%`);
            }
            // Check memory usage
            const memoryUsagePercent = (resources.memoryUsage / resources.memoryTotal) * 100;
            if (memoryUsagePercent > this.config.thresholds.memoryUsage * 100) {
                status = status === 'degraded' ? 'unhealthy' : 'degraded';
                issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`);
            }
            // Check disk usage
            if (resources.diskUsage > 90) {
                status = 'unhealthy';
                issues.push(`Critical disk usage: ${resources.diskUsage.toFixed(1)}%`);
            }
            else if (resources.diskUsage > 80) {
                status = status === 'healthy' ? 'degraded' : status;
                issues.push(`High disk usage: ${resources.diskUsage.toFixed(1)}%`);
            }
            // Check process memory
            const heapUsagePercent = (enhancedMetrics.process.memory.heapUsed / enhancedMetrics.process.memory.heapTotal) * 100;
            if (heapUsagePercent > 90) {
                status = status === 'degraded' ? 'unhealthy' : 'degraded';
                issues.push(`High heap usage: ${heapUsagePercent.toFixed(1)}%`);
            }
            // Check network connectivity
            if (!enhancedMetrics.network.connected) {
                status = 'degraded';
                issues.push('Network connectivity issues detected');
            }
            if (issues.length > 0) {
                message = issues.join(', ');
            }
            return {
                component: 'system',
                status,
                message,
                details: {
                    ...resources,
                    enhanced: enhancedMetrics
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'system',
                status: 'unhealthy',
                message: 'System resource check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    async checkPerformance() {
        const startTime = Date.now();
        try {
            // Get recent performance metrics
            const fiveMinutesAgo = Date.now() - 300000;
            const recentMetrics = await this.memory.query?.(`
        SELECT
          COUNT(*) as total_operations,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_operations,
          AVG(duration) as avg_duration,
          MAX(duration) as max_duration
        FROM performance_metrics
        WHERE start_time > ${fiveMinutesAgo}
      `);
            const metrics = recentMetrics[0] || {};
            const errorRate = metrics.total_operations > 0
                ? (metrics.total_operations - metrics.successful_operations) / metrics.total_operations
                : 0;
            const responseTime = Date.now() - startTime;
            let status = 'healthy';
            let message = 'Performance metrics within normal limits';
            if (errorRate > this.config.thresholds.errorRate) {
                status = 'degraded';
                message = `High error rate: ${(errorRate * 100).toFixed(1)}%`;
            }
            if (metrics.avg_duration > this.config.thresholds.responseTime) {
                status = status === 'degraded' ? 'unhealthy' : 'degraded';
                message = `High average response time: ${metrics.avg_duration}ms`;
            }
            return {
                component: 'performance',
                status,
                message,
                details: {
                    totalOperations: metrics.total_operations || 0,
                    successfulOperations: metrics.successful_operations || 0,
                    errorRate,
                    avgDuration: metrics.avg_duration || 0,
                    maxDuration: metrics.max_duration || 0
                },
                timestamp: new Date(),
                responseTime
            };
        }
        catch (error) {
            return {
                component: 'performance',
                status: 'unhealthy',
                message: 'Performance check failed',
                error: error.message,
                timestamp: new Date(),
                responseTime: Date.now() - startTime
            };
        }
    }
    createSkippedResult(component) {
        return {
            component,
            status: 'unknown',
            message: 'Health check skipped',
            timestamp: new Date()
        };
    }
    async getSystemResources() {
        const cpus = os_1.default.cpus();
        const totalMemory = os_1.default.totalmem();
        const freeMemory = os_1.default.freemem();
        const usedMemory = totalMemory - freeMemory;
        // Calculate CPU usage with averaging
        const cpuUsage = await this.calculateCPUUsage();
        // Get real disk usage
        const { diskUsage, diskTotal } = await this.getDiskUsage();
        return {
            cpuUsage,
            memoryUsage: usedMemory / 1024 / 1024, // MB
            memoryTotal: totalMemory / 1024 / 1024, // MB
            diskUsage,
            diskTotal,
            loadAverage: os_1.default.loadavg(),
            processCount: cpus.length
        };
    }
    async createHealthTables() {
        await this.memory.execute(`
      CREATE TABLE IF NOT EXISTS health_checks (
        id TEXT PRIMARY KEY,
        component TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT,
        details TEXT,
        error TEXT,
        response_time INTEGER,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_health_component ON health_checks(component);
      CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_checks(timestamp);
      
      CREATE TABLE IF NOT EXISTS health_alerts (
        id TEXT PRIMARY KEY,
        alert_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged BOOLEAN DEFAULT FALSE
      );
    `);
    }
    async storeHealthResult(status) {
        // Store individual component results
        for (const [component, result] of Object.entries(status.components)) {
            await this.memory.insert('health_checks', {
                id: `${component}_${Date.now()}`,
                component,
                status: result.status,
                message: result.message,
                details: JSON.stringify(result.details),
                error: result.error,
                response_time: result.responseTime,
                timestamp: result.timestamp
            });
        }
        // Add to history
        this.checkHistory.push(...Object.values(status.components));
        // Limit history size
        if (this.checkHistory.length > 1000) {
            this.checkHistory = this.checkHistory.slice(-500);
        }
    }
    checkAlerts(status) {
        // Check for critical conditions
        const unhealthyComponents = Object.entries(status.components)
            .filter(([_, result]) => result.status === 'unhealthy');
        if (unhealthyComponents.length > 0) {
            this.emit('health:alert', {
                type: 'component_failure',
                severity: 'critical',
                message: `${unhealthyComponents.length} components unhealthy`,
                components: unhealthyComponents.map(([name]) => name)
            });
        }
        // Check system resources
        const resources = status.metrics.systemResources;
        if (resources.cpuUsage > 90) {
            this.emit('health:alert', {
                type: 'resource_critical',
                severity: 'critical',
                message: `CPU usage critical: ${resources.cpuUsage}%`
            });
        }
        if ((resources.memoryUsage / resources.memoryTotal) > 0.9) {
            this.emit('health:alert', {
                type: 'resource_critical',
                severity: 'critical',
                message: `Memory usage critical: ${(resources.memoryUsage / resources.memoryTotal * 100).toFixed(1)}%`
            });
        }
    }
    calculateAverageResponseTime() {
        if (this.checkHistory.length === 0)
            return 0;
        const responseTimes = this.checkHistory
            .map(h => h.responseTime || 0)
            .filter(t => t > 0);
        if (responseTimes.length === 0)
            return 0;
        return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    }
    /**
     * Calculate real CPU usage with averaging
     */
    async calculateCPUUsage() {
        const cpus = os_1.default.cpus();
        const currentCPUInfo = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((acc, time) => acc + time, 0);
            return {
                idle: cpu.times.idle,
                total: total
            };
        });
        if (!this.lastCPUInfo) {
            this.lastCPUInfo = currentCPUInfo;
            // Wait a bit and calculate again for initial reading
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.calculateCPUUsage();
        }
        let totalIdleDiff = 0;
        let totalDiff = 0;
        for (let i = 0; i < cpus.length; i++) {
            const lastCPU = this.lastCPUInfo[i];
            const currentCPU = currentCPUInfo[i];
            const idleDiff = currentCPU.idle - lastCPU.idle;
            const totalCPUDiff = currentCPU.total - lastCPU.total;
            totalIdleDiff += idleDiff;
            totalDiff += totalCPUDiff;
        }
        this.lastCPUInfo = currentCPUInfo;
        if (totalDiff === 0)
            return 0;
        const idlePercentage = (totalIdleDiff / totalDiff) * 100;
        const usagePercentage = 100 - idlePercentage;
        return Math.max(0, Math.min(100, usagePercentage));
    }
    /**
     * Get real disk usage statistics
     */
    async getDiskUsage() {
        try {
            // Platform-specific disk usage calculation
            if (process.platform === 'darwin' || process.platform === 'linux') {
                return this.getUnixDiskUsage();
            }
            else if (process.platform === 'win32') {
                return this.getWindowsDiskUsage();
            }
            else {
                // Fallback for unsupported platforms
                return { diskUsage: 0, diskTotal: 0 };
            }
        }
        catch (error) {
            this.logger.warn('Failed to get disk usage:', error);
            return { diskUsage: 0, diskTotal: 0 };
        }
    }
    /**
     * Get disk usage for Unix-based systems (macOS, Linux)
     */
    getUnixDiskUsage() {
        try {
            // Get current working directory's mount point
            const cwd = process.cwd();
            // Get disk usage for the filesystem containing the current directory
            const output = (0, child_process_1.execSync)(`df -k "${cwd}"`, { encoding: 'utf8' });
            const lines = output.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('Unexpected df output format');
            }
            // Handle cases where the output might span multiple lines
            let dataLine = lines[1];
            if (lines.length > 2 && !lines[1].includes('/')) {
                // Some systems split long filesystem names across lines
                dataLine = lines[1] + ' ' + lines[2];
            }
            // Parse the data line
            const parts = dataLine.split(/\s+/);
            // Find the numeric values (skip filesystem name)
            let totalBlocks = 0;
            let usedBlocks = 0;
            let foundNumbers = false;
            for (let i = 0; i < parts.length; i++) {
                const num = parseInt(parts[i], 10);
                if (!isNaN(num) && !foundNumbers) {
                    totalBlocks = num;
                    if (i + 1 < parts.length) {
                        usedBlocks = parseInt(parts[i + 1], 10);
                        foundNumbers = true;
                        break;
                    }
                }
            }
            if (!foundNumbers || isNaN(totalBlocks) || isNaN(usedBlocks)) {
                throw new Error('Failed to parse disk usage numbers');
            }
            const diskTotal = totalBlocks / 1024 / 1024; // Convert to GB
            const diskUsed = usedBlocks / 1024 / 1024; // Convert to GB
            const diskUsage = (diskUsed / diskTotal) * 100;
            return {
                diskUsage: Math.round(diskUsage * 10) / 10, // Round to 1 decimal
                diskTotal: Math.round(diskTotal * 10) / 10
            };
        }
        catch (error) {
            this.logger.error('Unix disk usage check failed:', error);
            throw error;
        }
    }
    /**
     * Get disk usage for Windows systems
     */
    getWindowsDiskUsage() {
        try {
            // Get disk usage for C: drive using WMIC
            const output = (0, child_process_1.execSync)('wmic logicaldisk where caption="C:" get size,freespace /value', { encoding: 'utf8' });
            const sizeMatch = output.match(/Size=(\d+)/);
            const freeMatch = output.match(/FreeSpace=(\d+)/);
            if (!sizeMatch || !freeMatch) {
                throw new Error('Failed to parse Windows disk usage');
            }
            const totalBytes = parseInt(sizeMatch[1], 10);
            const freeBytes = parseInt(freeMatch[1], 10);
            const usedBytes = totalBytes - freeBytes;
            const diskTotal = totalBytes / 1024 / 1024 / 1024; // Convert to GB
            const diskUsed = usedBytes / 1024 / 1024 / 1024; // Convert to GB
            const diskUsage = (diskUsed / diskTotal) * 100;
            return {
                diskUsage: Math.round(diskUsage * 10) / 10,
                diskTotal: Math.round(diskTotal * 10) / 10
            };
        }
        catch (error) {
            this.logger.error('Windows disk usage check failed:', error);
            throw error;
        }
    }
    /**
     * Get process-specific memory usage
     */
    getProcessMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapUsed: usage.heapUsed / 1024 / 1024, // MB
            heapTotal: usage.heapTotal / 1024 / 1024, // MB
            rss: usage.rss / 1024 / 1024, // MB
            external: usage.external / 1024 / 1024, // MB
            arrayBuffers: usage.arrayBuffers / 1024 / 1024 // MB
        };
    }
    /**
     * Check network connectivity
     */
    async checkNetworkConnectivity() {
        try {
            // Simple DNS lookup to check network connectivity
            const dns = await Promise.resolve().then(() => __importStar(require('dns'))).then(m => m.promises);
            await dns.lookup('google.com');
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get additional SQLite database statistics
     */
    async getExtendedDatabaseStats() {
        try {
            // Use the existing memory system stats
            const dbStats = await this.memory.getDatabaseStats();
            // Get additional table information if possible
            try {
                const tableInfo = await this.memory.query(`
          SELECT 
            COUNT(DISTINCT name) as table_count,
            SUM(CASE WHEN type = 'index' THEN 1 ELSE 0 END) as index_count
          FROM sqlite_master 
          WHERE type IN ('table', 'index')
        `);
                return {
                    ...dbStats,
                    tables: tableInfo[0]?.table_count || 0,
                    indexes: tableInfo[0]?.index_count || 0
                };
            }
            catch (error) {
                // If query fails, just return basic stats
                return dbStats;
            }
        }
        catch (error) {
            this.logger.warn('Failed to get extended database stats:', error);
            return null;
        }
    }
    /**
     * Enhanced system check with more detailed metrics
     */
    async getEnhancedSystemMetrics() {
        const processMemory = this.getProcessMemoryUsage();
        const networkConnected = await this.checkNetworkConnectivity();
        const dbStats = await this.getExtendedDatabaseStats();
        return {
            process: {
                memory: processMemory,
                uptime: process.uptime(),
                pid: process.pid,
                version: process.version,
                platform: process.platform,
                arch: process.arch
            },
            network: {
                connected: networkConnected
            },
            database: dbStats
        };
    }
}
exports.SystemHealth = SystemHealth;
//# sourceMappingURL=system-health.js.map