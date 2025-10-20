"use strict";
/**
 * Snow-Flow Performance Monitoring System
 * Real-time metrics collection and analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerformanceTracker = void 0;
const events_1 = require("events");
const logger_1 = require("../utils/logger");
class PerformanceTracker extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.activeOperations = new Map();
        this.metricsBuffer = [];
        this.initialized = false;
        this.memory = options.memory;
        this.config = options.config;
        this.logger = new logger_1.Logger('PerformanceTracker');
    }
    /**
     * Initialize the performance tracker
     */
    async initialize() {
        if (this.initialized)
            return;
        this.logger.info('Initializing Performance Tracker...');
        // Create performance tables if not exist
        await this.createPerformanceTables();
        // Start aggregation timer
        this.startAggregation();
        // Monitor system resources
        this.startResourceMonitoring();
        this.initialized = true;
        this.logger.info('Performance Tracker initialized');
    }
    /**
     * Start tracking an operation
     */
    async startOperation(operation, metadata = {}) {
        // Apply sampling rate
        if (Math.random() > this.config.sampleRate) {
            return 'not_sampled';
        }
        const id = this.generateMetricId();
        const metric = {
            id,
            operation,
            startTime: Date.now(),
            success: false,
            metadata,
            sessionId: metadata.sessionId,
            agentId: metadata.agentId,
            resourceUsage: this.captureResourceUsage()
        };
        this.activeOperations.set(id, metric);
        // Emit start event
        this.emit('operation:start', {
            id,
            operation,
            metadata
        });
        return id;
    }
    /**
     * End tracking an operation
     */
    async endOperation(operationId, result) {
        const metric = this.activeOperations.get(operationId);
        if (!metric || operationId === 'not_sampled')
            return;
        metric.endTime = Date.now();
        metric.duration = metric.endTime - metric.startTime;
        metric.success = result.success;
        metric.error = result.error;
        if (result.metadata) {
            Object.assign(metric.metadata, result.metadata);
        }
        // Capture final resource usage
        const finalResourceUsage = this.captureResourceUsage();
        metric.resourceUsage = this.calculateResourceDelta(metric.resourceUsage, finalResourceUsage);
        // Remove from active and add to buffer
        this.activeOperations.delete(operationId);
        this.metricsBuffer.push(metric);
        // Store immediately if buffer is large
        if (this.metricsBuffer.length >= 100) {
            await this.flushMetrics();
        }
        // Emit end event
        this.emit('operation:end', {
            id: operationId,
            operation: metric.operation,
            duration: metric.duration,
            success: metric.success
        });
        // Check for performance issues
        this.checkPerformanceThresholds(metric);
    }
    /**
     * Track a complete operation (convenience method)
     */
    async trackOperation(operation, metadata, fn) {
        const id = await this.startOperation(operation, metadata);
        try {
            const result = await fn();
            await this.endOperation(id, { success: true });
            return result;
        }
        catch (error) {
            await this.endOperation(id, {
                success: false,
                error: error.message
            });
            throw error;
        }
    }
    /**
     * Get metrics for a specific session
     */
    async getSessionMetrics(sessionId) {
        const metrics = await this.memory.query?.(`
      SELECT * FROM performance_metrics
      WHERE session_id = '${sessionId}'
      ORDER BY start_time
    `) || [];
        if (metrics.length === 0) {
            return {
                sessionId,
                startTime: new Date(),
                operationCount: 0,
                successCount: 0,
                failureCount: 0,
                agentCount: 0,
                artifactCount: 0,
                averageOperationTime: 0,
                resourceUsage: []
            };
        }
        const startTime = new Date(metrics[0].startTime);
        const endTime = metrics[metrics.length - 1].endTime ?
            new Date(metrics[metrics.length - 1].endTime) : undefined;
        const successCount = metrics.filter(m => m.success).length;
        const totalDuration = metrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        const agentIds = new Set(metrics.map(m => m.agentId).filter(Boolean));
        return {
            sessionId,
            startTime,
            endTime,
            duration: endTime ? endTime.getTime() - startTime.getTime() : undefined,
            operationCount: metrics.length,
            successCount,
            failureCount: metrics.length - successCount,
            agentCount: agentIds.size,
            artifactCount: await this.countSessionArtifacts(sessionId),
            averageOperationTime: metrics.length > 0 ? totalDuration / metrics.length : 0,
            resourceUsage: metrics.map(m => m.resourceUsage).filter(Boolean)
        };
    }
    /**
     * Get aggregate metrics for an operation
     */
    async getAggregateMetrics(operation, timeframe) {
        const since = timeframe ? Date.now() - timeframe : 0;
        const metrics = await this.memory.query?.(`
      SELECT * FROM performance_metrics
      WHERE operation = '${operation}' AND start_time > ${since}
      ORDER BY duration
    `) || [];
        if (metrics.length === 0) {
            return {
                operation,
                count: 0,
                successCount: 0,
                failureCount: 0,
                averageDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                percentile95: 0,
                percentile99: 0,
                errorRate: 0,
                throughput: 0
            };
        }
        const successCount = metrics.filter(m => m.success).length;
        const durations = metrics.map(m => m.duration || 0).filter(d => d > 0);
        durations.sort((a, b) => a - b);
        const timeRange = metrics[metrics.length - 1].startTime - metrics[0].startTime;
        const throughput = timeRange > 0 ? (metrics.length / timeRange) * 1000 : 0;
        return {
            operation,
            count: metrics.length,
            successCount,
            failureCount: metrics.length - successCount,
            averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
            minDuration: durations[0] || 0,
            maxDuration: durations[durations.length - 1] || 0,
            percentile95: this.calculatePercentile(durations, 0.95),
            percentile99: this.calculatePercentile(durations, 0.99),
            errorRate: metrics.length > 0 ? (metrics.length - successCount) / metrics.length : 0,
            throughput
        };
    }
    /**
     * Generate performance report
     */
    async generateReport(period = 'day') {
        const timeframe = this.getTimeframe(period);
        const since = Date.now() - timeframe;
        // Get all metrics for the period
        const allMetrics = await this.memory.query?.(`
      SELECT * FROM performance_metrics
      WHERE start_time > ${since}
    `) || [];
        // Get unique operations
        const operations = [...new Set(allMetrics.map(m => m.operation))];
        // Calculate operation metrics
        const operationMetrics = await Promise.all(operations.map(op => this.getAggregateMetrics(op, timeframe)));
        // Get session metrics
        const sessionIds = [...new Set(allMetrics.map(m => m.sessionId).filter(Boolean))];
        const sessionMetrics = await Promise.all(sessionIds.map(id => this.getSessionMetrics(id)));
        // Identify bottlenecks
        const bottlenecks = await this.identifyBottlenecks(allMetrics);
        // Generate recommendations
        const recommendations = this.generateRecommendations(operationMetrics, sessionMetrics, bottlenecks);
        // Calculate summary
        const totalOperations = allMetrics.length;
        const successCount = allMetrics.filter(m => m.success).length;
        const totalDuration = allMetrics.reduce((sum, m) => sum + (m.duration || 0), 0);
        const report = {
            timestamp: new Date(),
            period,
            summary: {
                totalOperations,
                successRate: totalOperations > 0 ? (successCount / totalOperations) * 100 : 0,
                averageResponseTime: totalOperations > 0 ? totalDuration / totalOperations : 0,
                peakConcurrency: this.calculatePeakConcurrency(allMetrics),
                errorRate: totalOperations > 0 ? ((totalOperations - successCount) / totalOperations) * 100 : 0
            },
            operationMetrics,
            sessionMetrics,
            bottlenecks,
            recommendations
        };
        // Store report
        await this.memory.store(`performance_report_${period}_${Date.now()}`, report);
        return report;
    }
    /**
     * Identify performance bottlenecks
     */
    async identifyBottlenecks(metrics) {
        const bottlenecks = [];
        // Group by operation
        const operationGroups = this.groupBy(metrics, 'operation');
        for (const [operation, operationMetrics] of Object.entries(operationGroups)) {
            const durations = operationMetrics.map(m => m.duration || 0);
            const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
            const p95Duration = this.calculatePercentile(durations, 0.95);
            // Check for slow operations
            if (avgDuration > 5000) { // > 5 seconds average
                bottlenecks.push({
                    operation,
                    severity: avgDuration > 30000 ? 'critical' : avgDuration > 15000 ? 'high' : 'medium',
                    impact: `Average response time of ${(avgDuration / 1000).toFixed(2)}s`,
                    occurrences: operationMetrics.length,
                    averageDelay: avgDuration - 5000,
                    recommendation: 'Optimize operation logic or add caching'
                });
            }
            // Check for high variance
            const variance = this.calculateVariance(durations);
            if (variance > avgDuration * 2) {
                bottlenecks.push({
                    operation,
                    severity: 'medium',
                    impact: 'High response time variance',
                    occurrences: operationMetrics.length,
                    averageDelay: 0,
                    recommendation: 'Investigate inconsistent performance patterns'
                });
            }
            // Check for high error rate
            const errorCount = operationMetrics.filter(m => !m.success).length;
            const errorRate = errorCount / operationMetrics.length;
            if (errorRate > 0.1) { // > 10% error rate
                bottlenecks.push({
                    operation,
                    severity: errorRate > 0.5 ? 'critical' : errorRate > 0.25 ? 'high' : 'medium',
                    impact: `${(errorRate * 100).toFixed(1)}% error rate`,
                    occurrences: errorCount,
                    averageDelay: 0,
                    recommendation: 'Review error handling and retry logic'
                });
            }
        }
        return bottlenecks.sort((a, b) => this.severityScore(b.severity) - this.severityScore(a.severity));
    }
    /**
     * Shutdown the tracker
     */
    async shutdown() {
        this.logger.info('Shutting down Performance Tracker...');
        // Stop timers
        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
        }
        // Flush remaining metrics
        await this.flushMetrics();
        this.initialized = false;
    }
    /**
     * Private helper methods
     */
    async createPerformanceTables() {
        await this.memory.execute(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration INTEGER,
        success BOOLEAN NOT NULL,
        session_id TEXT,
        agent_id TEXT,
        metadata TEXT,
        resource_usage TEXT,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_performance_operation ON performance_metrics(operation);
      CREATE INDEX IF NOT EXISTS idx_performance_session ON performance_metrics(session_id);
      CREATE INDEX IF NOT EXISTS idx_performance_time ON performance_metrics(start_time);
      
      CREATE TABLE IF NOT EXISTS performance_aggregates (
        id TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        period TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metrics TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }
    startAggregation() {
        this.aggregationTimer = setInterval(async () => {
            await this.flushMetrics();
            await this.aggregateMetrics();
        }, this.config.aggregationInterval);
    }
    startResourceMonitoring() {
        // Monitor Node.js process resources
        setInterval(() => {
            const usage = this.captureResourceUsage();
            // Check thresholds
            if (usage.memoryUsage > 0.8) {
                this.emit('resource:warning', {
                    type: 'memory',
                    usage: usage.memoryUsage,
                    threshold: 0.8
                });
            }
            if (usage.cpuUsage > 0.8) {
                this.emit('resource:warning', {
                    type: 'cpu',
                    usage: usage.cpuUsage,
                    threshold: 0.8
                });
            }
        }, 10000); // Every 10 seconds
    }
    captureResourceUsage() {
        const usage = process.cpuUsage();
        const memory = process.memoryUsage();
        return {
            cpuUsage: (usage.user + usage.system) / 1000000, // Convert to seconds
            memoryUsage: memory.rss / 1024 / 1024, // Convert to MB
            heapUsed: memory.heapUsed / 1024 / 1024,
            heapTotal: memory.heapTotal / 1024 / 1024,
            external: memory.external / 1024 / 1024,
            arrayBuffers: memory.arrayBuffers / 1024 / 1024
        };
    }
    calculateResourceDelta(start, end) {
        return {
            cpuUsage: end.cpuUsage - start.cpuUsage,
            memoryUsage: end.memoryUsage - start.memoryUsage,
            heapUsed: end.heapUsed - start.heapUsed,
            heapTotal: end.heapTotal,
            external: end.external - start.external,
            arrayBuffers: end.arrayBuffers - start.arrayBuffers
        };
    }
    async flushMetrics() {
        if (this.metricsBuffer.length === 0)
            return;
        const metrics = [...this.metricsBuffer];
        this.metricsBuffer = [];
        // Store metrics in database
        for (const metric of metrics) {
            await this.memory.insert('performance_metrics', {
                id: metric.id,
                operation: metric.operation,
                start_time: metric.startTime,
                end_time: metric.endTime,
                duration: metric.duration,
                success: metric.success,
                session_id: metric.sessionId,
                agent_id: metric.agentId,
                metadata: JSON.stringify(metric.metadata),
                resource_usage: JSON.stringify(metric.resourceUsage),
                error: metric.error
            });
        }
        this.emit('metrics:flushed', { count: metrics.length });
    }
    async aggregateMetrics() {
        // Aggregate metrics for different time periods
        const cutoff = Date.now() - this.config.aggregationInterval;
        const operations = await this.memory.query?.(`
      SELECT DISTINCT operation FROM performance_metrics
      WHERE start_time > ${cutoff}
    `) || [];
        for (const { operation } of operations) {
            const aggregate = await this.getAggregateMetrics(operation, this.config.aggregationInterval);
            await this.memory.insert('performance_aggregates', {
                id: `${operation}_${Date.now()}`,
                operation,
                period: 'interval',
                timestamp: Date.now(),
                metrics: JSON.stringify(aggregate)
            });
        }
        // Clean up old metrics
        await this.cleanupOldMetrics();
    }
    async cleanupOldMetrics() {
        const cutoff = Date.now() - this.config.metricsRetention;
        await this.memory.execute?.(`
      DELETE FROM performance_metrics WHERE start_time < ${cutoff}
    `);
        await this.memory.execute?.(`
      DELETE FROM performance_aggregates WHERE timestamp < ${cutoff}
    `);
    }
    checkPerformanceThresholds(metric) {
        // Check for slow operations
        if (metric.duration && metric.duration > 10000) { // > 10 seconds
            this.emit('performance:slow', {
                operation: metric.operation,
                duration: metric.duration,
                metadata: metric.metadata
            });
        }
        // Check for failures
        if (!metric.success) {
            this.emit('performance:failure', {
                operation: metric.operation,
                error: metric.error,
                metadata: metric.metadata
            });
        }
        // Check for high resource usage
        if (metric.resourceUsage && metric.resourceUsage.memoryUsage > 100) { // > 100MB
            this.emit('performance:high-memory', {
                operation: metric.operation,
                memoryUsage: metric.resourceUsage.memoryUsage,
                metadata: metric.metadata
            });
        }
    }
    generateMetricId() {
        return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    calculatePercentile(values, percentile) {
        if (values.length === 0)
            return 0;
        const index = Math.ceil(values.length * percentile) - 1;
        return values[index] || 0;
    }
    calculateVariance(values) {
        if (values.length === 0)
            return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    calculatePeakConcurrency(metrics) {
        if (metrics.length === 0)
            return 0;
        const events = [];
        for (const metric of metrics) {
            events.push({ time: metric.startTime, type: 'start' });
            if (metric.endTime) {
                events.push({ time: metric.endTime, type: 'end' });
            }
        }
        events.sort((a, b) => a.time - b.time);
        let concurrent = 0;
        let peak = 0;
        for (const event of events) {
            if (event.type === 'start') {
                concurrent++;
                peak = Math.max(peak, concurrent);
            }
            else {
                concurrent--;
            }
        }
        return peak;
    }
    async countSessionArtifacts(sessionId) {
        const result = await this.memory.query?.(`
      SELECT COUNT(*) as count FROM servicenow_artifacts
      WHERE session_id = '${sessionId}'
    `) || [];
        return result[0]?.count || 0;
    }
    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = String(item[key]);
            if (!groups[group])
                groups[group] = [];
            groups[group].push(item);
            return groups;
        }, {});
    }
    getTimeframe(period) {
        const timeframes = {
            hour: 3600000,
            day: 86400000,
            week: 604800000,
            month: 2592000000
        };
        return timeframes[period] || timeframes.day;
    }
    severityScore(severity) {
        const scores = {
            low: 1,
            medium: 2,
            high: 3,
            critical: 4
        };
        return scores[severity] || 0;
    }
    generateRecommendations(operationMetrics, sessionMetrics, bottlenecks) {
        const recommendations = [];
        // Check for slow operations
        const slowOps = operationMetrics.filter(m => m.averageDuration > 5000);
        if (slowOps.length > 0) {
            recommendations.push(`Optimize slow operations: ${slowOps.map(op => op.operation).join(', ')}`);
        }
        // Check for high error rates
        const errorOps = operationMetrics.filter(m => m.errorRate > 0.1);
        if (errorOps.length > 0) {
            recommendations.push(`Review error handling for: ${errorOps.map(op => op.operation).join(', ')}`);
        }
        // Check for resource usage
        const highMemorySessions = sessionMetrics.filter(s => s.resourceUsage.some(r => r.memoryUsage > 500));
        if (highMemorySessions.length > 0) {
            recommendations.push('Consider implementing memory optimization strategies');
        }
        // Add bottleneck recommendations
        bottlenecks.forEach(b => {
            if (!recommendations.includes(b.recommendation)) {
                recommendations.push(b.recommendation);
            }
        });
        return recommendations;
    }
}
exports.PerformanceTracker = PerformanceTracker;
//# sourceMappingURL=performance-tracker.js.map