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
    'https://snow-flow.dev',
    'https://snow-flow-status-page-761141808583.europe-west4.run.app'
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

// Response time tracking for average latency calculation
const responseTimesMs: number[] = [];
const MAX_RESPONSE_TIMES = 100; // Keep last 100 response times

// Incident management
interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  affectedServices: string[];
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  startedAt: Date;
  resolvedAt?: Date;
  updates: IncidentUpdate[];
}

interface IncidentUpdate {
  timestamp: Date;
  status: string;
  message: string;
}

const activeIncidents: Incident[] = [];
const incidentHistory: Incident[] = [];
const MAX_INCIDENT_HISTORY = 100;

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
function determineStatus(cpuUsage: number, memoryUsagePercent: number, diskUsage: number, uptime: number): 'operational' | 'degraded' | 'outage' {
  // Warmup period: First 5 minutes after container start, always return operational
  // This prevents false outages during container initialization
  const WARMUP_PERIOD = 5 * 60; // 5 minutes in seconds
  if (uptime < WARMUP_PERIOD) {
    return 'operational';
  }

  // Critical thresholds - only trigger outage for severe issues
  if (memoryUsagePercent > 95 || diskUsage > 95) {
    return 'outage';
  }

  // Warning thresholds - degraded service
  if (memoryUsagePercent > 85 || diskUsage > 85) {
    return 'degraded';
  }

  return 'operational';
}

/**
 * GET /api/v1/status
 * Get current system status (for status page)
 */
app.get('/api/v1/status', async (req: Request, res: Response) => {
  const requestStartTime = Date.now(); // Track request processing time

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
    const overallStatus = determineStatus(cpuUsage, memoryUsagePercent, diskInfo.usage, uptime);

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

    // Calculate average response time from last 100 requests
    var avgLatency = null;
    if (responseTimesMs.length > 0) {
      var sum = 0;
      for (var i = 0; i < responseTimesMs.length; i++) {
        sum += responseTimesMs[i];
      }
      avgLatency = Math.round(sum / responseTimesMs.length);
    }

    // Check for active incidents and override status if needed
    const hasActiveIncidents = activeIncidents.length > 0;
    let finalStatus = overallStatus;

    if (hasActiveIncidents) {
      const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');
      const majorIncidents = activeIncidents.filter(i => i.severity === 'major');

      if (criticalIncidents.length > 0) {
        finalStatus = 'outage';
      } else if (majorIncidents.length > 0) {
        finalStatus = 'degraded';
      }
    }

    // Build affected services map from active incidents
    var affectedServicesMap = {};
    for (var i = 0; i < activeIncidents.length; i++) {
      var incident = activeIncidents[i];
      for (var j = 0; j < incident.affectedServices.length; j++) {
        var service = incident.affectedServices[j];
        // Track highest severity affecting each service
        if (!affectedServicesMap[service] || incident.severity === 'critical') {
          affectedServicesMap[service] = incident.severity;
        }
      }
    }

    // Helper function to determine service status
    function getServiceStatus(serviceName, baseStatus) {
      if (affectedServicesMap[serviceName]) {
        var severity = affectedServicesMap[serviceName];
        if (severity === 'critical') return 'outage';
        if (severity === 'major') return 'degraded';
        // Minor incidents don't change service status
      }
      return baseStatus;
    }

    const response = {
      overall_status: finalStatus,
      uptime_30d: Math.round(uptime30d * 100) / 100,
      avg_latency: avgLatency,
      active_incidents: activeIncidents.length,
      services: {
        mcp_server: {
          status: getServiceStatus('mcp_server', memoryUsagePercent < 80 ? 'operational' : 'degraded')
        },
        portal: {
          status: getServiceStatus('portal', 'operational')
        },
        website: {
          status: getServiceStatus('website', 'operational')
        },
        database: {
          status: getServiceStatus('database', memoryUsagePercent < 90 ? 'operational' : 'degraded')
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

    // Track response time for avg latency calculation
    var responseTime = Date.now() - requestStartTime;
    responseTimesMs.push(responseTime);

    // Keep only last MAX_RESPONSE_TIMES
    if (responseTimesMs.length > MAX_RESPONSE_TIMES) {
      responseTimesMs.shift();
    }

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

/**
 * POST /api/v1/incidents
 * Create a new incident (for testing/simulation)
 */
app.post('/api/v1/incidents', async (req: Request, res: Response) => {
  const { title, description, severity, affectedServices } = req.body;

  if (!title || !severity) {
    return res.status(400).json({ error: 'Title and severity are required' });
  }

  const incident: Incident = {
    id: `INC-${Date.now()}`,
    title,
    description: description || '',
    severity: severity as 'critical' | 'major' | 'minor',
    affectedServices: affectedServices || ['website'],
    status: 'investigating',
    startedAt: new Date(),
    updates: [{
      timestamp: new Date(),
      status: 'investigating',
      message: `Incident created: ${title}`
    }]
  };

  activeIncidents.push(incident);

  console.log(`🚨 Incident created: ${incident.id} - ${title} (${severity})`);

  res.json({
    success: true,
    incident
  });
});

/**
 * POST /api/v1/incidents/:id/update
 * Add an update to an incident
 */
app.post('/api/v1/incidents/:id/update', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, message } = req.body;

  const incident = activeIncidents.find(i => i.id === id);

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  incident.status = status || incident.status;
  incident.updates.push({
    timestamp: new Date(),
    status: status || incident.status,
    message: message || `Status updated to ${status}`
  });

  console.log(`📝 Incident updated: ${id} - ${message}`);

  res.json({
    success: true,
    incident
  });
});

/**
 * POST /api/v1/incidents/:id/resolve
 * Resolve an incident
 */
app.post('/api/v1/incidents/:id/resolve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body;

  const incidentIndex = activeIncidents.findIndex(i => i.id === id);

  if (incidentIndex === -1) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  const incident = activeIncidents[incidentIndex];
  incident.status = 'resolved';
  incident.resolvedAt = new Date();
  incident.updates.push({
    timestamp: new Date(),
    status: 'resolved',
    message: message || 'Incident has been resolved'
  });

  // Move to history
  incidentHistory.push(incident);
  activeIncidents.splice(incidentIndex, 1);

  // Keep only last MAX_INCIDENT_HISTORY
  if (incidentHistory.length > MAX_INCIDENT_HISTORY) {
    incidentHistory.shift();
  }

  const duration = Math.round((incident.resolvedAt.getTime() - incident.startedAt.getTime()) / 1000 / 60);

  console.log(`✅ Incident resolved: ${id} - Duration: ${duration} minutes`);

  res.json({
    success: true,
    incident,
    duration_minutes: duration
  });
});

/**
 * GET /api/v1/incidents
 * Get all incidents (active + recent history)
 */
app.get('/api/v1/incidents', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;

  const recentHistory = incidentHistory.slice(-limit);

  res.json({
    active: activeIncidents,
    recent: recentHistory,
    total_active: activeIncidents.length,
    total_history: incidentHistory.length
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('API error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Start server - Cloud Run provides PORT environment variable
const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Snow-Flow Health API listening on ${HOST}:${PORT}`);
  console.log(`📊 Health endpoint: http://${HOST}:${PORT}/health`);
  console.log(`🔍 Status API: http://${HOST}:${PORT}/api/v1/status`);
  console.log(`📈 Metrics API: http://${HOST}:${PORT}/api/v1/metrics`);
  console.log(`📅 History API: http://${HOST}:${PORT}/api/v1/uptime-history`);
  console.log(`🚀 Running in ${process.env.NODE_ENV || 'development'} mode`);
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
