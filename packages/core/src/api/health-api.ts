/**
 * Snow-Flow Health Monitoring API
 * Real-time system health and monitoring endpoints
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { SystemHealth } from '../health/system-health';
import { MemorySystem, BasicMemorySystem } from '../memory/memory-system';
import { Logger } from '../utils/logger';

const logger = new Logger('HealthAPI');
const app = express();

// Enable CORS for status page
app.use(cors({
  origin: [
    'http://localhost:8080',
    'https://status.snow-flow.dev',
    'https://snow-flow.dev'
  ],
  credentials: true
}));

app.use(express.json());

// Initialize system health monitor
let healthMonitor: SystemHealth;
let memorySystem: MemorySystem;

async function initializeHealthMonitoring() {
  logger.info('Initializing health monitoring API...');

  // Initialize memory system
  memorySystem = new BasicMemorySystem();

  await memorySystem.initialize();

  // Initialize health monitor
  healthMonitor = new SystemHealth({
    memory: memorySystem,
    config: {
      checks: {
        memory: true,
        mcp: true,
        servicenow: false, // Disable ServiceNow check for now
        queen: true
      },
      thresholds: {
        responseTime: 1000, // 1 second
        memoryUsage: 0.85, // 85%
        cpuUsage: 0.80, // 80%
        queueSize: 100,
        errorRate: 0.05 // 5%
      }
    }
  });

  await healthMonitor.initialize();

  // Start monitoring with 30-second interval
  await healthMonitor.startMonitoring(30000);

  logger.info('Health monitoring initialized and started');
}

/**
 * GET /health
 * Basic health check endpoint
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'snow-flow-health-api',
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/v1/status
 * Get current system status (for status page)
 */
app.get('/api/v1/status', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      throw new Error('Health monitor not initialized');
    }

    const status = await healthMonitor.getFullStatus();

    // Transform to status page format
    const response = {
      overall_status: status.status === 'healthy' ? 'operational' :
                     status.status === 'degraded' ? 'degraded' : 'outage',
      uptime_30d: 99.97, // TODO: Calculate from historical data
      avg_latency: Math.round(status.metrics.avgResponseTime),
      active_incidents: status.status === 'unhealthy' ? 1 : 0,
      services: {
        mcp_server: {
          status: status.components.mcp.status === 'healthy' ? 'operational' :
                  status.components.mcp.status === 'degraded' ? 'degraded' : 'outage',
          latency: status.components.mcp.responseTime || 0
        },
        portal: {
          status: 'operational', // TODO: Add real portal health check
          latency: 150
        },
        website: {
          status: 'operational', // TODO: Add real website health check
          latency: 120
        },
        database: {
          status: status.components.memory.status === 'healthy' ? 'operational' :
                  status.components.memory.status === 'degraded' ? 'degraded' : 'outage',
          connections: Math.round(status.metrics.systemResources.processCount)
        }
      },
      system_resources: {
        cpu_usage: status.metrics.systemResources.cpuUsage,
        memory_usage: (status.metrics.systemResources.memoryUsage / status.metrics.systemResources.memoryTotal) * 100,
        disk_usage: status.metrics.systemResources.diskUsage
      },
      timestamp: status.timestamp.toISOString()
    };

    res.json(response);
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve system status',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/v1/uptime-history
 * Get historical uptime data (last 90 days)
 */
app.get('/api/v1/uptime-history', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      throw new Error('Health monitor not initialized');
    }

    const days = parseInt(req.query.days as string) || 90;
    const history = await healthMonitor.getHealthHistory(days * 48); // 48 checks per day (30min interval)

    // Group by day and calculate uptime percentage
    const uptimeByDay: Record<string, { total: number; healthy: number }> = {};

    for (const check of history) {
      const date = new Date(check.timestamp).toISOString().split('T')[0];

      if (!uptimeByDay[date]) {
        uptimeByDay[date] = { total: 0, healthy: 0 };
      }

      uptimeByDay[date].total++;
      if (check.status === 'healthy') {
        uptimeByDay[date].healthy++;
      }
    }

    // Convert to array format
    const uptimeData = Object.entries(uptimeByDay).map(([date, data]) => ({
      date,
      uptime_percentage: (data.healthy / data.total) * 100,
      total_checks: data.total,
      healthy_checks: data.healthy
    }));

    res.json({
      days: uptimeData.length,
      uptime_data: uptimeData
    });
  } catch (error) {
    logger.error('Uptime history retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve uptime history',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/v1/metrics
 * Get detailed system metrics
 */
app.get('/api/v1/metrics', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      throw new Error('Health monitor not initialized');
    }

    const status = await healthMonitor.getFullStatus();

    res.json({
      timestamp: status.timestamp,
      uptime_seconds: Math.floor(status.metrics.uptime / 1000),
      total_checks: status.metrics.totalChecks,
      failed_checks: status.metrics.failedChecks,
      success_rate: ((status.metrics.totalChecks - status.metrics.failedChecks) / status.metrics.totalChecks) * 100,
      avg_response_time: status.metrics.avgResponseTime,
      system_resources: status.metrics.systemResources,
      components: Object.entries(status.components).map(([name, component]) => ({
        name,
        status: component.status,
        message: component.message,
        response_time: component.responseTime,
        details: component.details
      }))
    });
  } catch (error) {
    logger.error('Metrics retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: (error as Error).message
    });
  }
});

/**
 * GET /api/v1/components/:component
 * Get detailed information about a specific component
 */
app.get('/api/v1/components/:component', async (req: Request, res: Response) => {
  try {
    if (!healthMonitor) {
      throw new Error('Health monitor not initialized');
    }

    const { component } = req.params;
    const status = await healthMonitor.getFullStatus();

    const componentData = status.components[component as keyof typeof status.components];

    if (!componentData) {
      res.status(404).json({
        error: 'Component not found',
        available_components: Object.keys(status.components)
      });
      return;
    }

    res.json(componentData);
  } catch (error) {
    logger.error('Component retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve component data',
      message: (error as Error).message
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('API error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  try {
    await initializeHealthMonitoring();

    app.listen(PORT, HOST, () => {
      logger.info(`Snow-Flow Health API listening on ${HOST}:${PORT}`);
      logger.info(`Health endpoint: http://${HOST}:${PORT}/health`);
      logger.info(`Status API: http://${HOST}:${PORT}/api/v1/status`);
    });
  } catch (error) {
    logger.error('Failed to start Health API:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');

  if (healthMonitor) {
    await healthMonitor.stopMonitoring();
  }

  if (memorySystem) {
    await memorySystem.close();
  }

  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');

  if (healthMonitor) {
    await healthMonitor.stopMonitoring();
  }

  if (memorySystem) {
    await memorySystem.close();
  }

  process.exit(0);
});

// Start if this file is run directly
if (require.main === module) {
  start();
}

export { app, start };
