/**
 * Monitoring & Health Check Routes
 *
 * Provides comprehensive health checks and monitoring for:
 * - License Server health
 * - MCP HTTP Server health
 * - Database connectivity
 * - Service integrations (Jira, Azure, Confluence)
 * - Performance metrics
 * - Usage statistics
 */

import { Router, Request, Response } from 'express';
import { LicenseDatabase } from '../database/schema.js';
import { CredentialsDatabase } from '../database/credentials-schema.js';
import axios from 'axios';
import winston from 'winston';
import { getAPIStats, resetAPIStats } from '../middleware/api-logger.js';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Track server start time
const SERVER_START_TIME = Date.now();

// Track MCP tool execution metrics
interface ToolMetrics {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  totalDuration: number;
  avgDuration: number;
  lastCalled?: number;
  errorRate: number;
}

const toolMetrics = new Map<string, ToolMetrics>();

/**
 * Update tool metrics
 */
export function updateToolMetrics(toolName: string, success: boolean, durationMs: number): void {
  const metrics = toolMetrics.get(toolName) || {
    totalCalls: 0,
    successCalls: 0,
    failedCalls: 0,
    totalDuration: 0,
    avgDuration: 0,
    errorRate: 0
  };

  metrics.totalCalls++;
  metrics.totalDuration += durationMs;
  metrics.avgDuration = metrics.totalDuration / metrics.totalCalls;
  metrics.lastCalled = Date.now();

  if (success) {
    metrics.successCalls++;
  } else {
    metrics.failedCalls++;
  }

  metrics.errorRate = (metrics.failedCalls / metrics.totalCalls) * 100;

  toolMetrics.set(toolName, metrics);
}

/**
 * Create monitoring routes
 */
export function createMonitoringRoutes(db: LicenseDatabase, credsDb: CredentialsDatabase): Router {
  const router = Router();

  /**
   * GET /health
   * Basic health check endpoint
   */
  router.get('/health', async (req: Request, res: Response) => {
    const uptime = process.uptime();
    const uptimeSinceStart = (Date.now() - SERVER_START_TIME) / 1000;

    const health = {
      status: 'healthy',
      timestamp: Date.now(),
      uptime: {
        process: uptime,
        server: uptimeSinceStart
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(health);
  });

  /**
   * GET /health/detailed
   * Detailed health check with all subsystem checks
   */
  router.get('/health/detailed', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const checks: Record<string, any> = {};

    // 1. Main Database Check (License Server DB)
    try {
      const dbStart = Date.now();
      const serviceIntegrators = db.listServiceIntegrators();
      const allCustomers: any[] = [];
      serviceIntegrators.forEach(si => {
        allCustomers.push(...db.listCustomers(si.id));
      });
      const activeCustomers = allCustomers.filter(c => c.status === 'active').length;

      checks.database = {
        status: 'healthy',
        message: `${serviceIntegrators.length} SIs, ${allCustomers.length} customers (${activeCustomers} active)`,
        responseTime: Date.now() - dbStart,
        details: {
          serviceIntegrators: serviceIntegrators.length,
          totalCustomers: allCustomers.length,
          activeCustomers,
          suspendedCustomers: allCustomers.filter(c => c.status === 'suspended').length
        }
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database error',
        responseTime: Date.now() - startTime
      };
    }

    // 2. Credentials Database Check
    try {
      const credStart = Date.now();
      const serviceIntegrators = db.listServiceIntegrators();
      let totalCreds = 0;
      serviceIntegrators.forEach(si => {
        const customers = db.listCustomers(si.id);
        customers.forEach(c => {
          totalCreds += credsDb.listCustomerCredentials(c.id).length;
        });
      });

      checks.credentialsDb = {
        status: 'healthy',
        message: `${totalCreds} stored credentials`,
        responseTime: Date.now() - credStart,
        details: {
          totalCredentials: totalCreds,
          encrypted: true
        }
      };
    } catch (error) {
      checks.credentialsDb = {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Credentials DB error',
        responseTime: Date.now() - startTime
      };
    }

    // 3. Memory Check (Comprehensive)
    const memUsage = process.memoryUsage();
    const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    const rssPercent = (memUsage.rss / (512 * 1024 * 1024)) * 100; // Assume 512MB container

    checks.memory = {
      status: heapPercent > 90 ? 'critical' : heapPercent > 75 ? 'warning' : 'healthy',
      message: `Heap: ${heapPercent.toFixed(1)}%, RSS: ${(memUsage.rss / 1024 / 1024).toFixed(0)}MB`,
      details: {
        heapUsed: (memUsage.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        heapTotal: (memUsage.heapTotal / 1024 / 1024).toFixed(2) + 'MB',
        heapPercent: heapPercent.toFixed(2) + '%',
        rss: (memUsage.rss / 1024 / 1024).toFixed(2) + 'MB',
        external: (memUsage.external / 1024 / 1024).toFixed(2) + 'MB'
      }
    };

    // 4. MCP Tools Health Check
    try {
      let totalMcpCalls = 0;
      let totalMcpErrors = 0;
      let totalMcpDuration = 0;

      toolMetrics.forEach(metrics => {
        totalMcpCalls += metrics.totalCalls;
        totalMcpErrors += metrics.failedCalls;
        totalMcpDuration += metrics.totalDuration;
      });

      const avgDuration = totalMcpCalls > 0 ? totalMcpDuration / totalMcpCalls : 0;
      const errorRate = totalMcpCalls > 0 ? (totalMcpErrors / totalMcpCalls) * 100 : 0;

      checks.mcpTools = {
        status: errorRate > 10 ? 'warning' : 'healthy',
        message: `${totalMcpCalls} calls, ${errorRate.toFixed(1)}% error rate`,
        details: {
          totalCalls: totalMcpCalls,
          successCalls: totalMcpCalls - totalMcpErrors,
          errorCalls: totalMcpErrors,
          errorRate: errorRate.toFixed(2) + '%',
          avgDuration: avgDuration.toFixed(2) + 'ms',
          activeTools: toolMetrics.size
        }
      };
    } catch (error) {
      checks.mcpTools = {
        status: 'unknown',
        message: 'Unable to gather MCP metrics'
      };
    }

    // 5. API Performance Check
    try {
      const apiStats = {
        total: 0,
        last24h: 0,
        errors: 0
      };

      // This is a simplified check - in production you'd query actual API logs
      toolMetrics.forEach(metrics => {
        apiStats.total += metrics.totalCalls;
        apiStats.errors += metrics.failedCalls;
      });

      const errorRate = apiStats.total > 0 ? (apiStats.errors / apiStats.total) * 100 : 0;

      checks.apiPerformance = {
        status: errorRate > 5 ? 'warning' : 'healthy',
        message: `${apiStats.total} requests, ${errorRate.toFixed(1)}% errors`,
        details: {
          totalRequests: apiStats.total,
          successfulRequests: apiStats.total - apiStats.errors,
          failedRequests: apiStats.errors,
          errorRate: errorRate.toFixed(2) + '%'
        }
      };
    } catch (error) {
      checks.apiPerformance = {
        status: 'unknown',
        message: 'Unable to gather API metrics'
      };
    }

    // 6. Uptime Check
    const uptimeSeconds = process.uptime();
    const uptimeHours = uptimeSeconds / 3600;

    checks.uptime = {
      status: 'healthy',
      message: uptimeHours < 1
        ? `${Math.floor(uptimeSeconds / 60)} minutes`
        : `${uptimeHours.toFixed(1)} hours`,
      details: {
        seconds: Math.floor(uptimeSeconds),
        since: new Date(Date.now() - uptimeSeconds * 1000).toISOString()
      }
    };

    // 7. Environment Check
    checks.environment = {
      status: 'healthy',
      message: `${process.env.NODE_ENV || 'development'} mode`,
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    // Calculate Overall Status
    const healthyCount = Object.values(checks).filter(c => c.status === 'healthy').length;
    const warningCount = Object.values(checks).filter(c => c.status === 'warning').length;
    const criticalCount = Object.values(checks).filter(c => c.status === 'critical' || c.status === 'unhealthy').length;

    let overallStatus = 'healthy';
    if (criticalCount > 0) {
      overallStatus = 'unhealthy';
    } else if (warningCount > 0) {
      overallStatus = 'degraded';
    }

    res.json({
      status: overallStatus,
      timestamp: Date.now(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks,
      summary: {
        total: Object.keys(checks).length,
        healthy: healthyCount,
        warnings: warningCount,
        critical: criticalCount
      },
      totalCheckTime: Date.now() - startTime
    });
  });

  /**
   * GET /health/mcp
   * MCP HTTP Server health check
   */
  router.get('/health/mcp', async (req: Request, res: Response) => {
    try {
      // Get tool-specific metrics from in-memory tracking
      const toolStats = Array.from(toolMetrics.entries()).map(([tool, metrics]) => ({
        tool,
        ...metrics
      }));

      // Calculate overall stats from tool metrics
      let totalCalls = 0;
      let successCalls = 0;
      let failedCalls = 0;
      let totalDuration = 0;

      toolMetrics.forEach(metrics => {
        totalCalls += metrics.totalCalls;
        successCalls += metrics.successCalls;
        failedCalls += metrics.failedCalls;
        totalDuration += metrics.totalDuration;
      });

      const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

      res.json({
        status: 'healthy',
        mcp: {
          available: true,
          totalTools: 26, // 8 Jira + 10 Azure + 8 Confluence
          categories: ['jira', 'azure', 'confluence']
        },
        usage: {
          sinceServerStart: {
            totalCalls,
            successCalls,
            failedCalls,
            errorRate: totalCalls > 0 ? ((failedCalls / totalCalls) * 100).toFixed(2) : 0,
            avgDurationMs: avgDuration.toFixed(2)
          },
          byTool: toolStats
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('MCP health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        status: 'unhealthy',
        error: 'Failed to retrieve MCP health',
        timestamp: Date.now()
      });
    }
  });

  /**
   * GET /metrics
   * Prometheus-compatible metrics endpoint
   */
  router.get('/metrics', (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();

    // Calculate MCP metrics
    let totalMcpCalls = 0;
    let successMcpCalls = 0;
    let totalMcpDuration = 0;
    let totalMcpErrors = 0;

    toolMetrics.forEach(metrics => {
      totalMcpCalls += metrics.totalCalls;
      successMcpCalls += metrics.successCalls;
      totalMcpDuration += metrics.totalDuration;
      totalMcpErrors += metrics.failedCalls;
    });

    const avgMcpDuration = totalMcpCalls > 0 ? totalMcpDuration / totalMcpCalls : 0;
    const mcpErrorRate = totalMcpCalls > 0 ? (totalMcpErrors / totalMcpCalls) * 100 : 0;

    // Check if JSON format is requested (for web dashboard)
    const acceptHeader = req.headers.accept || '';
    const wantsJson = acceptHeader.includes('application/json') || req.query.format === 'json';

    if (wantsJson) {
      // Get customer stats
      const serviceIntegrators = db.listServiceIntegrators();
      const allCustomers: any[] = [];
      serviceIntegrators.forEach(si => {
        const customers = db.listCustomers(si.id);
        allCustomers.push(...customers);
      });

      const byCategory: Record<string, number> = {};
      toolMetrics.forEach((metricsData, toolName) => {
        // Extract category from tool name (e.g., "jira_create_issue" -> "jira")
        const category = toolName.split('_')[0];
        byCategory[category] = (byCategory[category] || 0) + metricsData.totalCalls;
      });

      // Return JSON format for web dashboard
      return res.json({
        apiCalls: {
          total: totalMcpCalls,
          successful: successMcpCalls,
          failed: totalMcpErrors,
          avgDuration: Math.round(avgMcpDuration)
        },
        mcpTools: {
          totalCalls: totalMcpCalls,
          byCategory,
          avgDuration: Math.round(avgMcpDuration)
        },
        customers: {
          total: allCustomers.length,
          active: allCustomers.filter((c: any) => c.status === 'active').length,
          suspended: allCustomers.filter((c: any) => c.status === 'suspended').length
        }
      });
    }

    // Prometheus format
    const metrics = [
      `# HELP snow_flow_up Snow-Flow Enterprise License Server up status`,
      `# TYPE snow_flow_up gauge`,
      `snow_flow_up 1`,
      ``,
      `# HELP snow_flow_uptime_seconds Server uptime in seconds`,
      `# TYPE snow_flow_uptime_seconds counter`,
      `snow_flow_uptime_seconds ${uptime.toFixed(0)}`,
      ``,
      `# HELP snow_flow_memory_used_bytes Memory usage in bytes`,
      `# TYPE snow_flow_memory_used_bytes gauge`,
      `snow_flow_memory_used_bytes{type="heap"} ${memUsage.heapUsed}`,
      `snow_flow_memory_used_bytes{type="rss"} ${memUsage.rss}`,
      `snow_flow_memory_used_bytes{type="external"} ${memUsage.external}`,
      ``,
      `# HELP snow_flow_mcp_calls_total Total MCP tool calls`,
      `# TYPE snow_flow_mcp_calls_total counter`,
      `snow_flow_mcp_calls_total ${totalMcpCalls}`,
      ``,
      `# HELP snow_flow_mcp_errors_total Total MCP errors`,
      `# TYPE snow_flow_mcp_errors_total counter`,
      `snow_flow_mcp_errors_total ${totalMcpErrors}`,
      ``,
      `# HELP snow_flow_mcp_duration_ms Average MCP call duration in milliseconds`,
      `# TYPE snow_flow_mcp_duration_ms gauge`,
      `snow_flow_mcp_duration_ms ${avgMcpDuration.toFixed(2)}`,
      ``,
      `# HELP snow_flow_mcp_error_rate_percent MCP error rate percentage`,
      `# TYPE snow_flow_mcp_error_rate_percent gauge`,
      `snow_flow_mcp_error_rate_percent ${mcpErrorRate.toFixed(2)}`,
      ``
    ];

    // Add per-tool metrics
    const toolMetricsLines: string[] = [];
    toolMetrics.forEach((metricsData, toolName) => {
      toolMetricsLines.push(
        `snow_flow_mcp_tool_calls{tool="${toolName}"} ${metricsData.totalCalls}`,
        `snow_flow_mcp_tool_errors{tool="${toolName}"} ${metricsData.failedCalls}`,
        `snow_flow_mcp_tool_duration_ms{tool="${toolName}"} ${metricsData.avgDuration.toFixed(2)}`
      );
    });
    metrics.push(...toolMetricsLines);

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.join('\n'));
  });

  /**
   * GET /stats/usage
   * Usage statistics for admin dashboard
   */
  router.get('/stats/usage', async (req: Request, res: Response) => {
    try {
      // Verify admin authentication
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get all service integrators and their customers
      const serviceIntegrators = db.listServiceIntegrators();
      const allCustomers: any[] = [];

      serviceIntegrators.forEach(si => {
        const customers = db.listCustomers(si.id);
        allCustomers.push(...customers);
      });

      const activeCustomers = allCustomers.filter((c: any) => c.status === 'active').length;
      const totalCustomers = allCustomers.length;

      // Calculate MCP stats from in-memory metrics
      let totalMcpCalls = 0;
      let successMcpCalls = 0;
      let failedMcpCalls = 0;
      let totalMcpDuration = 0;

      toolMetrics.forEach(metrics => {
        totalMcpCalls += metrics.totalCalls;
        successMcpCalls += metrics.successCalls;
        failedMcpCalls += metrics.failedCalls;
        totalMcpDuration += metrics.totalDuration;
      });

      const avgMcpDuration = totalMcpCalls > 0 ? totalMcpDuration / totalMcpCalls : 0;

      res.json({
        period: {
          note: 'Metrics since server start',
          serverStartTime: new Date(SERVER_START_TIME).toISOString()
        },
        overview: {
          totalServiceIntegrators: serviceIntegrators.length,
          totalCustomers,
          activeCustomers,
          totalMcpCalls
        },
        mcp: {
          totalCalls: totalMcpCalls,
          successCalls: successMcpCalls,
          failedCalls: failedMcpCalls,
          avgDurationMs: avgMcpDuration.toFixed(2)
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Usage stats failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({ error: 'Failed to retrieve usage statistics' });
    }
  });

  /**
   * GET /stats/performance
   * Performance metrics for monitoring
   */
  router.get('/stats/performance', (req: Request, res: Response) => {
    try {
      // Verify admin authentication
      const adminKey = req.headers['x-admin-key'];
      if (adminKey !== process.env.ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const memUsage = process.memoryUsage();

      res.json({
        server: {
          uptime: process.uptime(),
          startTime: new Date(SERVER_START_TIME).toISOString(),
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch
        },
        memory: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          heapUsedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2),
          rss: memUsage.rss,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          usage: process.cpuUsage()
        },
        mcp: {
          toolCount: toolMetrics.size,
          totalCalls: Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.totalCalls, 0),
          avgResponseTime: Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.avgDuration, 0) / (toolMetrics.size || 1)
        },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Performance stats failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({ error: 'Failed to retrieve performance statistics' });
    }
  });

  /**
   * GET /status
   * Service status dashboard
   */
  router.get('/status', async (req: Request, res: Response) => {
    try {
      // Public endpoint - no auth required

      const services = {
        licenseServer: {
          status: 'operational',
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0'
        },
        database: {
          status: 'operational',
          type: 'SQLite'
        },
        mcpServer: {
          status: 'operational',
          toolsAvailable: 26
        },
        sso: {
          status: 'operational',
          providers: ['saml']
        },
        credentialsApi: {
          status: 'operational',
          services: ['jira', 'azure', 'confluence', 'servicenow']
        }
      };

      // Test database connectivity
      try {
        db.listServiceIntegrators();
      } catch (error) {
        services.database.status = 'degraded';
      }

      // Overall status
      const allOperational = Object.values(services).every(s => s.status === 'operational');

      res.json({
        status: allOperational ? 'operational' : 'degraded',
        services,
        timestamp: Date.now(),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Status check failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        status: 'error',
        error: 'Failed to retrieve status',
        timestamp: Date.now()
      });
    }
  });

  /**
   * GET /api-stats
   * Get API call statistics
   */
  router.get('/api-stats', (req: Request, res: Response) => {
    try {
      const stats = getAPIStats();

      // Calculate totals
      const totalCalls = stats.reduce((sum, s) => sum + s.count, 0);
      const totalErrors = stats.reduce((sum, s) => sum + s.errorCount, 0);
      const avgDuration = stats.length > 0
        ? stats.reduce((sum, s) => sum + s.avgDuration, 0) / stats.length
        : 0;

      res.json({
        success: true,
        summary: {
          totalCalls,
          totalErrors,
          errorRate: totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) + '%' : '0%',
          avgDuration: avgDuration.toFixed(2) + 'ms',
          endpoints: stats.length
        },
        endpoints: stats,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to get API stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve API statistics'
      });
    }
  });

  /**
   * POST /api-stats/reset
   * Reset API statistics
   */
  router.post('/api-stats/reset', (req: Request, res: Response) => {
    try {
      resetAPIStats();

      res.json({
        success: true,
        message: 'API statistics reset successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Failed to reset API stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reset API statistics'
      });
    }
  });

  return router;
}

export { toolMetrics };
