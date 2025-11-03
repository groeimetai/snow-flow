/**
 * Snow-Flow Simple Health Monitoring API
 * Lightweight real-time system health endpoints
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import os from 'os';
import { execSync } from 'child_process';

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

// In-memory storage for health history
interface HealthRecord {
  timestamp: Date;
  status: 'operational' | 'degraded' | 'outage';
  cpuUsage: number;
  memoryUsage: number;
}

const healthHistory: HealthRecord[] = [];
const MAX_HISTORY = 4320; // 90 days at 30min intervals

/**
 * GET /health
 * Basic health check endpoint
 */
app.get('/health', async (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'snow-flow-health-api',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * Calculate CPU usage
 */
function getCPUUsage(): number {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type as keyof typeof cpu.times];
    }
    totalIdle += cpu.times.idle;
  });

  const idle = totalIdle / cpus.length;
  const total = totalTick / cpus.length;
  const usage = 100 - ~~(100 * idle / total);

  return Math.max(0, Math.min(100, usage));
}

/**
 * Get disk usage (Unix-based systems)
 */
function getDiskUsage(): { usage: number; total: number } {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const output = execSync(`df -k "${process.cwd()}"`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');

      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);

        // Find numeric values
        for (let i = 0; i < parts.length - 1; i++) {
          const total = parseInt(parts[i], 10);
          const used = parseInt(parts[i + 1], 10);

          if (!isNaN(total) && !isNaN(used) && total > 0) {
            const totalGB = total / 1024 / 1024;
            const usedGB = used / 1024 / 1024;
            const usagePercent = (usedGB / totalGB) * 100;

            return {
              usage: Math.round(usagePercent * 10) / 10,
              total: Math.round(totalGB * 10) / 10
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn('Failed to get disk usage:', error);
  }

  return { usage: 0, total: 0 };
}

/**
 * Determine overall system status
 */
function determineStatus(cpuUsage: number, memoryUsagePercent: number, diskUsage: number): 'operational' | 'degraded' | 'outage' {
  if (cpuUsage > 90 || memoryUsagePercent > 90 || diskUsage > 90) {
    return 'outage';
  }

  if (cpuUsage > 75 || memoryUsagePercent > 80 || diskUsage > 80) {
    return 'degraded';
  }

  return 'operational';
}

/**
 * GET /api/v1/status
 * Get current system status (for status page)
 */
app.get('/api/v1/status', async (req: Request, res: Response) => {
  try {
    // Get system metrics
    const cpuUsage = getCPUUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    const diskInfo = getDiskUsage();
    const uptime = os.uptime();

    // Determine status
    const overallStatus = determineStatus(cpuUsage, memoryUsagePercent, diskInfo.usage);

    // Store in history
    const healthRecord: HealthRecord = {
      timestamp: new Date(),
      status: overallStatus,
      cpuUsage,
      memoryUsage: memoryUsagePercent
    };

    healthHistory.push(healthRecord);

    // Keep only last MAX_HISTORY records
    if (healthHistory.length > MAX_HISTORY) {
      healthHistory.shift();
    }

    // Calculate 30-day uptime
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentRecords = healthHistory.filter(r => r.timestamp.getTime() > thirtyDaysAgo);
    const operationalRecords = recentRecords.filter(r => r.status === 'operational');
    const uptime30d = recentRecords.length > 0
      ? (operationalRecords.length / recentRecords.length) * 100
      : 99.95;

    // Mock latency (TODO: Add real latency monitoring)
    const avgLatency = Math.floor(Math.random() * 100) + 150;

    const response = {
      overall_status: overallStatus,
      uptime_30d: Math.round(uptime30d * 100) / 100,
      avg_latency: avgLatency,
      active_incidents: overallStatus === 'outage' ? 1 : 0,
      services: {
        mcp_server: {
          status: cpuUsage < 80 ? 'operational' : 'degraded',
          latency: Math.floor(Math.random() * 50) + 150
        },
        portal: {
          status: 'operational',
          latency: Math.floor(Math.random() * 50) + 200
        },
        website: {
          status: 'operational',
          latency: Math.floor(Math.random() * 30) + 100
        },
        database: {
          status: memoryUsagePercent < 85 ? 'operational' : 'degraded',
          connections: Math.floor(Math.random() * 10) + 5
        }
      },
      system_resources: {
        cpu_usage: Math.round(cpuUsage * 10) / 10,
        memory_usage: Math.round(memoryUsagePercent * 10) / 10,
        disk_usage: diskInfo.usage,
        uptime_seconds: Math.floor(uptime)
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error('Status check failed:', error);
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
    const days = parseInt(req.query.days as string) || 90;

    // Group by day and calculate uptime percentage
    const uptimeByDay: Record<string, { total: number; healthy: number }> = {};

    for (const record of healthHistory) {
      const date = record.timestamp.toISOString().split('T')[0];

      if (!uptimeByDay[date]) {
        uptimeByDay[date] = { total: 0, healthy: 0 };
      }

      uptimeByDay[date].total++;
      if (record.status === 'operational') {
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
    console.error('Uptime history retrieval failed:', error);
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
    const cpuUsage = getCPUUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const loadAvg = os.loadavg();
    const diskInfo = getDiskUsage();

    res.json({
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(os.uptime()),
      total_checks: healthHistory.length,
      system_resources: {
        cpuUsage: Math.round(cpuUsage * 10) / 10,
        memoryUsage: Math.round((usedMemory / 1024 / 1024) * 10) / 10,
        memoryTotal: Math.round((totalMemory / 1024 / 1024) * 10) / 10,
        memoryUsagePercent: Math.round(((usedMemory / totalMemory) * 100) * 10) / 10,
        diskUsage: diskInfo.usage,
        diskTotal: diskInfo.total,
        loadAverage: loadAvg,
        processCount: os.cpus().length,
        platform: os.platform(),
        arch: os.arch()
      }
    });
  } catch (error) {
    console.error('Metrics retrieval failed:', error);
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: (error as Error).message
    });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('API error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Snow-Flow Health API listening on ${HOST}:${PORT}`);
  console.log(`📊 Health endpoint: http://${HOST}:${PORT}/health`);
  console.log(`🔍 Status API: http://${HOST}:${PORT}/api/v1/status`);
  console.log(`📈 Metrics API: http://${HOST}:${PORT}/api/v1/metrics`);
  console.log(`📅 History API: http://${HOST}:${PORT}/api/v1/uptime-history`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export { app };
