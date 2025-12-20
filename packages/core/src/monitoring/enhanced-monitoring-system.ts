/**
 * 🚀 PERFORMANCE FIX: Enhanced Monitoring System
 * Advanced real-time monitoring with predictive analytics, alerting, and dashboards
 * 
 * Addresses beta testing feedback on performance monitoring gaps
 */

import { EventEmitter } from 'events';
import { PerformanceTracker, PerformanceMetric, PerformanceReport } from './performance-tracker';
import { MemorySystem } from '../memory/memory-system';
import { Logger } from '../utils/logger';
import WebSocket from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';

export interface MonitoringConfig {
  realTimeEnabled: boolean;
  predictiveAnalyticsEnabled: boolean;
  alertingEnabled: boolean;
  dashboardEnabled: boolean;
  websocketPort: number;
  alertThresholds: AlertThresholds;
  retentionPeriods: RetentionPeriods;
}

export interface AlertThresholds {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  responseTime: number;
  errorRate: number;
  cacheHitRate: number;
  queueDepth: number;
}

export interface RetentionPeriods {
  realTimeMetrics: number; // milliseconds
  hourlyAggregates: number;
  dailyAggregates: number;
  weeklyAggregates: number;
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical' | 'unknown';
  components: {
    cpu: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
    network: ComponentHealth;
    database: ComponentHealth;
    cache: ComponentHealth;
    api: ComponentHealth;
  };
  alerts: ActiveAlert[];
  recommendations: string[];
  predictedIssues: PredictedIssue[];
}

export interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  value: number;
  threshold: number;
  trend: 'improving' | 'stable' | 'degrading';
  lastUpdated: Date;
  details: string;
}

export interface ActiveAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  count: number;
  firstSeen: Date;
}

export interface PredictedIssue {
  type: 'resource_exhaustion' | 'performance_degradation' | 'capacity_limit' | 'error_spike';
  component: string;
  description: string;
  probability: number;
  estimatedTime: Date;
  impact: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface PerformanceTrend {
  metric: string;
  period: 'hour' | 'day' | 'week' | 'month';
  trend: 'improving' | 'stable' | 'degrading';
  percentageChange: number;
  currentValue: number;
  historicalAverage: number;
  volatility: number;
}

export interface ResourceForecast {
  resource: string;
  currentUsage: number;
  predictedUsage: number;
  timeHorizon: number; // hours
  confidence: number;
  exhaustionDate?: Date;
  recommendations: string[];
}

export class EnhancedMonitoringSystem extends EventEmitter {
  private performanceTracker: PerformanceTracker;
  private memory: MemorySystem;
  private logger: Logger;
  private config: MonitoringConfig;
  private websocketServer?: WebSocket.Server;
  private httpServer?: http.Server;
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private metricHistory: Map<string, number[]> = new Map();
  private systemHealth: SystemHealth;
  private monitoringInterval?: NodeJS.Timeout;
  private alertingInterval?: NodeJS.Timeout;
  private predictionInterval?: NodeJS.Timeout;
  private connectedClients: Set<WebSocket> = new Set();

  constructor(
    performanceTracker: PerformanceTracker,
    memory: MemorySystem,
    config?: Partial<MonitoringConfig>
  ) {
    super();
    
    this.performanceTracker = performanceTracker;
    this.memory = memory;
    this.logger = new Logger('EnhancedMonitoringSystem');
    
    this.config = {
      realTimeEnabled: true,
      predictiveAnalyticsEnabled: true,
      alertingEnabled: true,
      dashboardEnabled: true,
      websocketPort: 8090,
      alertThresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        responseTime: 5000,
        errorRate: 10,
        cacheHitRate: 50,
        queueDepth: 100
      },
      retentionPeriods: {
        realTimeMetrics: 3600000, // 1 hour
        hourlyAggregates: 2592000000, // 30 days
        dailyAggregates: 7776000000, // 90 days
        weeklyAggregates: 31536000000 // 1 year
      },
      ...config
    };

    this.systemHealth = this.initializeSystemHealth();
    
    this.logger.info('🚀 Enhanced Monitoring System initialized', {
      realTimeEnabled: this.config.realTimeEnabled,
      predictiveAnalyticsEnabled: this.config.predictiveAnalyticsEnabled,
      alertingEnabled: this.config.alertingEnabled,
      dashboardEnabled: this.config.dashboardEnabled
    });
  }

  /**
   * Start the enhanced monitoring system
   */
  async start(): Promise<void> {
    this.logger.info('🚀 Starting Enhanced Monitoring System...');

    // Initialize monitoring tables
    await this.createMonitoringTables();

    // Start real-time monitoring
    if (this.config.realTimeEnabled) {
      this.startRealTimeMonitoring();
    }

    // Start alerting system
    if (this.config.alertingEnabled) {
      this.startAlertingSystem();
    }

    // Start predictive analytics
    if (this.config.predictiveAnalyticsEnabled) {
      this.startPredictiveAnalytics();
    }

    // Start dashboard server
    if (this.config.dashboardEnabled) {
      await this.startDashboardServer();
    }

    // Set up performance tracker integration
    this.setupPerformanceTrackerIntegration();

    this.logger.info('✅ Enhanced Monitoring System started successfully');
  }

  /**
   * Get current system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    await this.updateSystemHealth();
    return { ...this.systemHealth };
  }

  /**
   * Get performance trends for specified periods
   */
  async getPerformanceTrends(periods: string[] = ['hour', 'day', 'week']): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    
    const metrics = [
      'response_time',
      'throughput',
      'error_rate',
      'cpu_usage',
      'memory_usage',
      'cache_hit_rate'
    ];

    for (const metric of metrics) {
      for (const period of periods) {
        const trend = await this.calculateTrend(metric, period as 'hour' | 'day' | 'week');
        if (trend) {
          trends.push(trend);
        }
      }
    }

    return trends.sort((a, b) => {
      // Sort by severity: degrading trends first, then by impact
      if (a.trend === 'degrading' && b.trend !== 'degrading') return -1;
      if (b.trend === 'degrading' && a.trend !== 'degrading') return 1;
      return Math.abs(b.percentageChange) - Math.abs(a.percentageChange);
    });
  }

  /**
   * Get resource usage forecasts
   */
  async getResourceForecasts(timeHorizonHours: number = 24): Promise<ResourceForecast[]> {
    const forecasts: ResourceForecast[] = [];
    
    const resources = ['cpu', 'memory', 'disk', 'network', 'database_connections'];
    
    for (const resource of resources) {
      const forecast = await this.generateResourceForecast(resource, timeHorizonHours);
      if (forecast) {
        forecasts.push(forecast);
      }
    }

    return forecasts.sort((a, b) => {
      // Sort by urgency: resources approaching exhaustion first
      if (a.exhaustionDate && b.exhaustionDate) {
        return a.exhaustionDate.getTime() - b.exhaustionDate.getTime();
      }
      if (a.exhaustionDate && !b.exhaustionDate) return -1;
      if (!a.exhaustionDate && b.exhaustionDate) return 1;
      return b.predictedUsage - a.predictedUsage;
    });
  }

  /**
   * Generate comprehensive monitoring report
   */
  async generateMonitoringReport(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    this.logger.info('📊 Generating comprehensive monitoring report', { period });

    const [
      systemHealth,
      performanceReport,
      trends,
      forecasts,
      alerts,
      recommendations
    ] = await Promise.all([
      this.getSystemHealth(),
      this.performanceTracker.generateReport(period),
      this.getPerformanceTrends([period]),
      this.getResourceForecasts(period === 'hour' ? 24 : 168), // 24h or 1 week
      this.getActiveAlerts(),
      this.generateSmartRecommendations()
    ]);

    const report = {
      timestamp: new Date(),
      period,
      summary: {
        overallHealth: systemHealth.overall,
        totalAlerts: alerts.length,
        criticalIssues: alerts.filter(a => a.severity === 'critical').length,
        performanceScore: this.calculatePerformanceScore(performanceReport, systemHealth),
        trendsCount: trends.length,
        forecastsCount: forecasts.length
      },
      systemHealth,
      performance: performanceReport,
      trends: trends.slice(0, 10), // Top 10 trends
      forecasts: forecasts.slice(0, 5), // Top 5 forecasts
      alerts: alerts.slice(0, 20), // Recent 20 alerts
      recommendations: recommendations.slice(0, 10), // Top 10 recommendations
      metadata: {
        monitoringSystemVersion: '2.0.0',
        reportGenerationTime: Date.now() - Date.now(), // Will be updated at end
        includedComponents: Object.keys(systemHealth.components),
        dataPoints: await this.getDataPointCount(period)
      }
    };

    // Update generation time
    report.metadata.reportGenerationTime = Date.now() - report.timestamp.getTime();

    // Store report
    await this.memory.store(`monitoring_report_${period}_${Date.now()}`, report, 
      this.config.retentionPeriods.dailyAggregates);

    this.logger.info('✅ Monitoring report generated', {
      period,
      overallHealth: systemHealth.overall,
      alertCount: alerts.length,
      generationTime: report.metadata.reportGenerationTime
    });

    return report;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.acknowledged = true;
    
    // Store acknowledgment
    await this.memory.store(`alert_ack_${alertId}`, {
      alertId,
      acknowledgedBy,
      acknowledgedAt: new Date(),
      alert: { ...alert }
    });

    this.logger.info('🔔 Alert acknowledged', { alertId, acknowledgedBy });
    
    // Broadcast to connected clients
    this.broadcastToClients({
      type: 'alert_acknowledged',
      data: { alertId, acknowledgedBy, timestamp: new Date() }
    });

    return true;
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<ActiveAlert[]> {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.timestamp.getTime() - a.timestamp.getTime();
      });
  }

  /**
   * Private Methods
   */

  private initializeSystemHealth(): SystemHealth {
    return {
      overall: 'unknown',
      components: {
        cpu: { status: 'unknown', value: 0, threshold: 80, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        memory: { status: 'unknown', value: 0, threshold: 85, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        disk: { status: 'unknown', value: 0, threshold: 90, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        network: { status: 'unknown', value: 0, threshold: 80, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        database: { status: 'unknown', value: 0, threshold: 75, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        cache: { status: 'unknown', value: 0, threshold: 50, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' },
        api: { status: 'unknown', value: 0, threshold: 5000, trend: 'stable', lastUpdated: new Date(), details: 'Initializing...' }
      },
      alerts: [],
      recommendations: [],
      predictedIssues: []
    };
  }

  private async createMonitoringTables(): Promise<void> {
    await this.memory.execute(`
      CREATE TABLE IF NOT EXISTS monitoring_metrics (
        id TEXT PRIMARY KEY,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        component TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_name ON monitoring_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);
      CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_component ON monitoring_metrics(component);
      
      CREATE TABLE IF NOT EXISTS monitoring_alerts (
        id TEXT PRIMARY KEY,
        severity TEXT NOT NULL,
        component TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_by TEXT,
        acknowledged_at INTEGER,
        count INTEGER DEFAULT 1,
        first_seen INTEGER NOT NULL,
        last_seen INTEGER NOT NULL,
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_component ON monitoring_alerts(component);
      CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_timestamp ON monitoring_alerts(timestamp);
      
      CREATE TABLE IF NOT EXISTS monitoring_predictions (
        id TEXT PRIMARY KEY,
        prediction_type TEXT NOT NULL,
        component TEXT NOT NULL,
        description TEXT NOT NULL,
        probability REAL NOT NULL,
        estimated_time INTEGER,
        impact TEXT NOT NULL,
        recommendations TEXT,
        confidence REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private startRealTimeMonitoring(): void {
    this.logger.info('🔄 Starting real-time monitoring...');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.updateSystemHealth();
        
        // Broadcast to connected clients
        if (this.connectedClients.size > 0) {
          this.broadcastToClients({
            type: 'system_health_update',
            data: this.systemHealth
          });
        }
      } catch (error) {
        this.logger.error('❌ Error in real-time monitoring:', error);
      }
    }, 5000); // Every 5 seconds
  }

  private startAlertingSystem(): void {
    this.logger.info('🔔 Starting alerting system...');
    
    this.alertingInterval = setInterval(async () => {
      try {
        await this.checkAlertConditions();
        await this.cleanupOldAlerts();
      } catch (error) {
        this.logger.error('❌ Error in alerting system:', error);
      }
    }, 10000); // Every 10 seconds
  }

  private startPredictiveAnalytics(): void {
    this.logger.info('🔮 Starting predictive analytics...');
    
    this.predictionInterval = setInterval(async () => {
      try {
        await this.runPredictiveAnalysis();
      } catch (error) {
        this.logger.error('❌ Error in predictive analytics:', error);
      }
    }, 300000); // Every 5 minutes
  }

  private async startDashboardServer(): Promise<void> {
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.websocketServer = new WebSocket.Server({ 
      server: this.httpServer,
      path: '/monitoring-ws'
    });

    this.websocketServer.on('connection', (ws) => {
      this.handleWebSocketConnection(ws);
    });

    return new Promise((resolve) => {
      this.httpServer!.listen(this.config.websocketPort, () => {
        this.logger.info(`🌐 Dashboard server started on port ${this.config.websocketPort}`);
        resolve();
      });
    });
  }

  private setupPerformanceTrackerIntegration(): void {
    // Listen to performance tracker events
    this.performanceTracker.on('performance:slow', (data) => {
      this.createAlert('high', 'api', `Slow operation detected: ${data.operation} (${data.duration}ms)`, data);
    });

    this.performanceTracker.on('performance:failure', (data) => {
      this.createAlert('medium', 'api', `Operation failed: ${data.operation} - ${data.error}`, data);
    });

    this.performanceTracker.on('performance:high-memory', (data) => {
      this.createAlert('medium', 'memory', `High memory usage: ${data.operation} (${data.memoryUsage}MB)`, data);
    });

    this.performanceTracker.on('resource:warning', (data) => {
      this.createAlert('high', data.type, `Resource warning: ${data.type} usage at ${(data.usage * 100).toFixed(1)}%`, data);
    });
  }

  private async collectSystemMetrics(): Promise<void> {
    const timestamp = Date.now();
    
    // Collect Node.js process metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics = [
      {
        name: 'process_memory_heap_used',
        value: memUsage.heapUsed / 1024 / 1024, // MB
        component: 'memory'
      },
      {
        name: 'process_memory_heap_total',
        value: memUsage.heapTotal / 1024 / 1024, // MB
        component: 'memory'
      },
      {
        name: 'process_memory_rss',
        value: memUsage.rss / 1024 / 1024, // MB
        component: 'memory'
      },
      {
        name: 'process_cpu_user',
        value: cpuUsage.user / 1000, // milliseconds
        component: 'cpu'
      },
      {
        name: 'process_cpu_system',
        value: cpuUsage.system / 1000, // milliseconds
        component: 'cpu'
      }
    ];

    // Collect memory system metrics
    const memoryStats = await this.memory.getDatabaseStats();
    metrics.push({
      name: 'database_size',
      value: memoryStats.size / 1024 / 1024, // MB
      component: 'database'
    });

    // Collect cache metrics if available
    try {
      const cacheStats = await this.memory.getCacheStats();
      metrics.push(
        {
          name: 'cache_hit_rate',
          value: cacheStats.hits / (cacheStats.hits + cacheStats.misses) * 100,
          component: 'cache'
        },
        {
          name: 'cache_size',
          value: cacheStats.size,
          component: 'cache'
        }
      );
    } catch (error) {
      // Cache stats may not be available
    }

    // Store metrics
    for (const metric of metrics) {
      await this.storeMetric(metric.name, metric.value, metric.component, timestamp);
      
      // Update history for trend analysis
      const historyKey = `${metric.component}_${metric.name}`;
      if (!this.metricHistory.has(historyKey)) {
        this.metricHistory.set(historyKey, []);
      }
      const history = this.metricHistory.get(historyKey)!;
      history.push(metric.value);
      
      // Keep only last 100 values
      if (history.length > 100) {
        history.shift();
      }
    }
  }

  private async storeMetric(name: string, value: number, component: string, timestamp: number): Promise<void> {
    const id = `${component}_${name}_${timestamp}`;
    
    await this.memory.insert('monitoring_metrics', {
      id,
      metric_name: name,
      metric_value: value,
      component,
      timestamp,
      metadata: JSON.stringify({
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      })
    });
  }

  private async updateSystemHealth(): Promise<void> {
    const now = new Date();
    
    // Update CPU health
    const cpuHistory = this.metricHistory.get('cpu_process_cpu_user') || [];
    if (cpuHistory.length > 0) {
      const currentCpu = cpuHistory[cpuHistory.length - 1] || 0;
      this.systemHealth.components.cpu = {
        status: currentCpu > this.config.alertThresholds.cpuUsage ? 'critical' : 
                currentCpu > this.config.alertThresholds.cpuUsage * 0.8 ? 'warning' : 'healthy',
        value: currentCpu,
        threshold: this.config.alertThresholds.cpuUsage,
        trend: this.calculateComponentTrend('cpu', cpuHistory),
        lastUpdated: now,
        details: `CPU usage: ${currentCpu.toFixed(1)}%`
      };
    }

    // Update Memory health
    const memHistory = this.metricHistory.get('memory_process_memory_heap_used') || [];
    if (memHistory.length > 0) {
      const currentMem = memHistory[memHistory.length - 1] || 0;
      this.systemHealth.components.memory = {
        status: currentMem > 500 ? 'critical' : currentMem > 300 ? 'warning' : 'healthy',
        value: currentMem,
        threshold: 500,
        trend: this.calculateComponentTrend('memory', memHistory),
        lastUpdated: now,
        details: `Heap usage: ${currentMem.toFixed(1)}MB`
      };
    }

    // Update Database health
    const dbHistory = this.metricHistory.get('database_database_size') || [];
    if (dbHistory.length > 0) {
      const currentDb = dbHistory[dbHistory.length - 1] || 0;
      this.systemHealth.components.database = {
        status: currentDb > 1000 ? 'warning' : 'healthy',
        value: currentDb,
        threshold: 1000,
        trend: this.calculateComponentTrend('database', dbHistory),
        lastUpdated: now,
        details: `Database size: ${currentDb.toFixed(1)}MB`
      };
    }

    // Update Cache health
    const cacheHitHistory = this.metricHistory.get('cache_cache_hit_rate') || [];
    if (cacheHitHistory.length > 0) {
      const currentHitRate = cacheHitHistory[cacheHitHistory.length - 1] || 0;
      this.systemHealth.components.cache = {
        status: currentHitRate < this.config.alertThresholds.cacheHitRate ? 'warning' : 'healthy',
        value: currentHitRate,
        threshold: this.config.alertThresholds.cacheHitRate,
        trend: this.calculateComponentTrend('cache', cacheHitHistory),
        lastUpdated: now,
        details: `Cache hit rate: ${currentHitRate.toFixed(1)}%`
      };
    }

    // Calculate overall health
    const componentStatuses = Object.values(this.systemHealth.components).map(c => c.status);
    if (componentStatuses.includes('critical')) {
      this.systemHealth.overall = 'critical';
    } else if (componentStatuses.includes('warning')) {
      this.systemHealth.overall = 'warning';
    } else if (componentStatuses.every(s => s === 'healthy')) {
      this.systemHealth.overall = 'healthy';
    } else {
      this.systemHealth.overall = 'unknown';
    }

    // Update alerts list
    this.systemHealth.alerts = await this.getActiveAlerts();
  }

  private calculateComponentTrend(component: string, history: number[]): 'improving' | 'stable' | 'degrading' {
    if (history.length < 10) return 'stable';
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    
    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    // For CPU, memory, response time: increasing is degrading
    // For cache hit rate, throughput: increasing is improving
    const isInverseMetric = component.includes('cache') || component.includes('throughput');
    
    if (Math.abs(changePercent) < 5) return 'stable';
    
    if (isInverseMetric) {
      return changePercent > 0 ? 'improving' : 'degrading';
    } else {
      return changePercent > 0 ? 'degrading' : 'improving';
    }
  }

  private async checkAlertConditions(): Promise<void> {
    const now = Date.now();
    
    // Check each component health
    for (const [componentName, component] of Object.entries(this.systemHealth.components)) {
      if (component.status === 'critical' || component.status === 'warning') {
        const severity = component.status === 'critical' ? 'critical' : 'high';
        const alertId = `${componentName}_${component.status}`;
        
        if (this.activeAlerts.has(alertId)) {
          // Update existing alert
          const alert = this.activeAlerts.get(alertId)!;
          alert.count++;
          (alert as any).lastSeen = new Date();
        } else {
          // Create new alert
          await this.createAlert(severity, componentName, component.details, {
            threshold: component.threshold,
            currentValue: component.value,
            trend: component.trend
          });
        }
      }
    }
  }

  private async createAlert(
    severity: 'low' | 'medium' | 'high' | 'critical',
    component: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    const alertId = `${component}_${severity}_${Date.now()}`;
    const now = new Date();
    
    const alert: ActiveAlert = {
      id: alertId,
      severity,
      component,
      message,
      timestamp: now,
      acknowledged: false,
      count: 1,
      firstSeen: now
    };
    
    this.activeAlerts.set(alertId, alert);
    
    // Store in database
    await this.memory.insert('monitoring_alerts', {
      id: alertId,
      severity,
      component,
      message,
      timestamp: now.getTime(),
      acknowledged: false,
      count: 1,
      first_seen: now.getTime(),
      last_seen: now.getTime(),
      metadata: JSON.stringify(metadata || {})
    });
    
    this.logger.warn(`🚨 Alert created: ${severity.toUpperCase()} - ${component} - ${message}`, { alertId });
    
    // Emit alert event
    this.emit('alert', alert);
    
    // Broadcast to connected clients
    this.broadcastToClients({
      type: 'new_alert',
      data: alert
    });
  }

  private async cleanupOldAlerts(): Promise<void> {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.timestamp.getTime() < cutoff && alert.acknowledged) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  private async runPredictiveAnalysis(): Promise<void> {
    this.logger.debug('🔮 Running predictive _analysis...');
    
    const predictions: PredictedIssue[] = [];
    
    // Analyze memory growth
    const memHistory = this.metricHistory.get('memory_process_memory_heap_used') || [];
    if (memHistory.length > 20) {
      const memoryPrediction = this.predictResourceExhaustion('memory', memHistory, 1000); // 1GB limit
      if (memoryPrediction) {
        predictions.push(memoryPrediction);
      }
    }
    
    // Analyze database growth
    const dbHistory = this.metricHistory.get('database_database_size') || [];
    if (dbHistory.length > 20) {
      const dbPrediction = this.predictResourceExhaustion('database', dbHistory, 5000); // 5GB limit
      if (dbPrediction) {
        predictions.push(dbPrediction);
      }
    }
    
    // Store predictions
    for (const prediction of predictions) {
      await this.memory.insert('monitoring_predictions', {
        id: `prediction_${prediction.type}_${prediction.component}_${Date.now()}`,
        prediction_type: prediction.type,
        component: prediction.component,
        description: prediction.description,
        probability: prediction.probability,
        estimated_time: prediction.estimatedTime?.getTime(),
        impact: prediction.impact,
        recommendations: JSON.stringify(prediction.recommendations),
        confidence: prediction.probability
      });
    }
    
    // Update system health with predictions
    this.systemHealth.predictedIssues = predictions;
  }

  private predictResourceExhaustion(
    resource: string, 
    history: number[], 
    limit: number
  ): PredictedIssue | null {
    if (history.length < 10) return null;
    
    // Simple linear regression to predict growth
    const recentHistory = history.slice(-20);
    const n = recentHistory.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recentHistory;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Predict when resource will reach limit
    if (slope > 0) {
      const currentValue = y[y.length - 1];
      const timeToLimit = (limit - currentValue) / slope;
      
      if (timeToLimit > 0 && timeToLimit < 1000) { // Within 1000 time units
        const probability = Math.min(0.9, Math.max(0.1, 1 - (timeToLimit / 1000)));
        const estimatedTime = new Date(Date.now() + (timeToLimit * 300000)); // 5-minute intervals
        
        return {
          type: 'resource_exhaustion',
          component: resource,
          description: `${resource} usage is growing and may reach capacity limits`,
          probability,
          estimatedTime,
          impact: timeToLimit < 100 ? 'critical' : timeToLimit < 300 ? 'high' : 'medium',
          recommendations: [
            `Monitor ${resource} usage closely`,
            `Consider optimizing ${resource} consumption`,
            'Implement cleanup/archival processes',
            'Scale resources if necessary'
          ]
        };
      }
    }
    
    return null;
  }

  private async calculateTrend(metric: string, period: 'hour' | 'day' | 'week'): Promise<PerformanceTrend | null> {
    const timeframe = {
      hour: 3600000,
      day: 86400000,
      week: 604800000
    }[period];
    
    const since = Date.now() - timeframe;
    
    const metrics = await this.memory.query<{ metric_value: number, timestamp: number }>(`
      SELECT metric_value, timestamp FROM monitoring_metrics 
      WHERE metric_name = ? AND timestamp > ?
      ORDER BY timestamp
    `, [metric, since]);
    
    if (metrics.length < 10) return null;
    
    const values = metrics.map(m => m.metric_value);
    const recent = values.slice(-Math.floor(values.length / 3));
    const older = values.slice(0, Math.floor(values.length / 3));
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
    const overallAvg = values.reduce((a, b) => a + b, 0) / values.length;
    
    const percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - overallAvg, 2), 0) / values.length;
    const volatility = Math.sqrt(variance) / overallAvg;
    
    return {
      metric,
      period,
      trend: Math.abs(percentageChange) < 5 ? 'stable' : 
             percentageChange > 0 ? 'degrading' : 'improving',
      percentageChange,
      currentValue: recentAvg,
      historicalAverage: overallAvg,
      volatility
    };
  }

  private async generateResourceForecast(resource: string, timeHorizonHours: number): Promise<ResourceForecast | null> {
    const history = this.metricHistory.get(`${resource}_${resource}_usage`) || 
                   this.metricHistory.get(`${resource}_process_memory_heap_used`) ||
                   this.metricHistory.get(`${resource}_database_size`) || [];
    
    if (history.length < 10) return null;
    
    const currentUsage = history[history.length - 1] || 0;
    const trend = this.calculateComponentTrend(resource, history);
    
    // Simple prediction based on trend
    let predictedUsage = currentUsage;
    let confidence = 0.5;
    
    if (trend === 'degrading') {
      const growthRate = this.calculateGrowthRate(history);
      predictedUsage = currentUsage * (1 + (growthRate * timeHorizonHours / 24));
      confidence = 0.7;
    } else if (trend === 'improving') {
      const reductionRate = this.calculateGrowthRate(history);
      predictedUsage = currentUsage * (1 + (reductionRate * timeHorizonHours / 24));
      confidence = 0.6;
    }
    
    const recommendations: string[] = [];
    let exhaustionDate: Date | undefined;
    
    if (predictedUsage > currentUsage * 1.5) {
      recommendations.push(`${resource} usage expected to increase significantly`);
      recommendations.push('Consider implementing resource optimization');
    }
    
    if (predictedUsage > 1000) { // Arbitrary threshold
      exhaustionDate = new Date(Date.now() + (timeHorizonHours * 3600000));
      recommendations.push('Resource exhaustion predicted - immediate action required');
    }
    
    return {
      resource,
      currentUsage,
      predictedUsage,
      timeHorizon: timeHorizonHours,
      confidence,
      exhaustionDate,
      recommendations
    };
  }

  private calculateGrowthRate(history: number[]): number {
    if (history.length < 5) return 0;
    
    const recent = history.slice(-5);
    const older = history.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    return (recentAvg - olderAvg) / olderAvg;
  }

  private calculatePerformanceScore(performanceReport: PerformanceReport, systemHealth: SystemHealth): number {
    let score = 100;
    
    // Deduct points for errors
    score -= performanceReport.summary.errorRate * 2;
    
    // Deduct points for slow response times
    if (performanceReport.summary.averageResponseTime > 2000) {
      score -= (performanceReport.summary.averageResponseTime - 2000) / 100;
    }
    
    // Deduct points for unhealthy components
    const unhealthyComponents = Object.values(systemHealth.components)
      .filter(c => c.status !== 'healthy').length;
    score -= unhealthyComponents * 10;
    
    // Deduct points for critical alerts
    const criticalAlerts = systemHealth.alerts.filter(a => a.severity === 'critical').length;
    score -= criticalAlerts * 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private async generateSmartRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze system health and generate recommendations
    for (const [componentName, component] of Object.entries(this.systemHealth.components)) {
      if (component.status !== 'healthy') {
        if (componentName === 'memory' && component.trend === 'degrading') {
          recommendations.push('Consider implementing memory optimization strategies');
          recommendations.push('Review memory leaks in long-running processes');
        }
        
        if (componentName === 'cpu' && component.value > 80) {
          recommendations.push('CPU usage is high - consider scaling or optimization');
        }
        
        if (componentName === 'cache' && component.value < 50) {
          recommendations.push('Cache hit rate is low - review caching strategy');
        }
      }
    }
    
    // Add predictive recommendations
    for (const prediction of this.systemHealth.predictedIssues) {
      recommendations.push(...prediction.recommendations);
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private async getDataPointCount(period: string): Promise<number> {
    const timeframe = {
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000
    }[period] || 86400000;
    
    const since = Date.now() - timeframe;
    
    const result = await this.memory.query<{ count: number }>(`
      SELECT COUNT(*) as count FROM monitoring_metrics 
      WHERE timestamp > ?
    `, [since]);
    
    return result[0]?.count || 0;
  }

  private handleWebSocketConnection(ws: WebSocket): void {
    this.connectedClients.add(ws);
    this.logger.info('📱 WebSocket client connected', { totalClients: this.connectedClients.size });
    
    // Send initial system health
    ws.send(JSON.stringify({
      type: 'initial_data',
      data: {
        systemHealth: this.systemHealth,
        timestamp: new Date()
      }
    }));
    
    ws.on('close', () => {
      this.connectedClients.delete(ws);
      this.logger.info('📱 WebSocket client disconnected', { totalClients: this.connectedClients.size });
    });
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        await this.handleWebSocketMessage(ws, data);
      } catch (error) {
        this.logger.error('❌ Error handling WebSocket message:', error);
      }
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
    switch (message.type) {
      case 'acknowledge_alert':
        if (message.alertId && message.user) {
          const success = await this.acknowledgeAlert(message.alertId, message.user);
          ws.send(JSON.stringify({
            type: 'alert_acknowledged',
            success,
            alertId: message.alertId
          }));
        }
        break;
        
      case 'get_performance_trends':
        const trends = await this.getPerformanceTrends(message.periods || ['day']);
        ws.send(JSON.stringify({
          type: 'performance_trends',
          data: trends
        }));
        break;
        
      case 'get_resource_forecasts':
        const forecasts = await this.getResourceForecasts(message.timeHorizon || 24);
        ws.send(JSON.stringify({
          type: 'resource_forecasts',
          data: forecasts
        }));
        break;
    }
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Serve basic monitoring dashboard
    const dashboardHtml = this.generateDashboardHtml();
    
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Length': Buffer.byteLength(dashboardHtml)
    });
    res.end(dashboardHtml);
  }

  private generateDashboardHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Snow-Flow Enhanced Monitoring Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .status-healthy { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-critical { color: #e74c3c; }
        .status-unknown { color: #95a5a6; }
        .metric { display: flex; justify-content: space-between; margin: 10px 0; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .alert-critical { background: #ffebee; border-left: 4px solid #e74c3c; }
        .alert-high { background: #fff3e0; border-left: 4px solid #ff9800; }
        .alert-medium { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .alert-low { background: #e8f5e8; border-left: 4px solid #4caf50; }
        #connectionStatus { position: fixed; top: 10px; right: 10px; padding: 5px 10px; border-radius: 3px; }
        .connected { background: #4caf50; color: white; }
        .disconnected { background: #f44336; color: white; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Snow-Flow Enhanced Monitoring Dashboard</h1>
        <p>Real-time system health and performance monitoring</p>
        <div id="connectionStatus" class="disconnected">Connecting...</div>
    </div>
    
    <div class="grid">
        <div class="card">
            <h3>System Health Overview</h3>
            <div id="overallHealth">Loading...</div>
            <div id="componentHealth"></div>
        </div>
        
        <div class="card">
            <h3>Active Alerts</h3>
            <div id="alerts">Loading...</div>
        </div>
        
        <div class="card">
            <h3>Performance Metrics</h3>
            <div id="performanceMetrics">Loading...</div>
        </div>
        
        <div class="card">
            <h3>Resource Usage</h3>
            <div id="resourceUsage">Loading...</div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:${this.config.websocketPort}/monitoring-ws');
        const connectionStatus = document.getElementById('connectionStatus');
        
        ws.onopen = function() {
            connectionStatus.textContent = 'Connected';
            connectionStatus.className = 'connected';
        };
        
        ws.onclose = function() {
            connectionStatus.textContent = 'Disconnected';
            connectionStatus.className = 'disconnected';
        };
        
        ws.onmessage = function(event) {
            const message = JSON.parse(event.data);
            
            switch(message.type) {
                case 'initial_data':
                case 'system_health_update':
                    updateSystemHealth(message.data.systemHealth || message.data);
                    break;
                case 'new_alert':
                    addAlert(message.data);
                    break;
            }
        };
        
        function updateSystemHealth(health) {
            // Update overall health
            const overallHealth = document.getElementById('overallHealth');
            overallHealth.innerHTML = \`
                <div class="metric">
                    <span>Overall Status:</span>
                    <span class="status-\${health.overall}">\${health.overall.toUpperCase()}</span>
                </div>
            \`;
            
            // Update component health
            const componentHealth = document.getElementById('componentHealth');
            let componentsHtml = '';
            
            for (const [name, component] of Object.entries(health.components)) {
                componentsHtml += \`
                    <div class="metric">
                        <span>\${name.charAt(0).toUpperCase() + name.slice(1)}:</span>
                        <span class="status-\${component.status}">
                            \${component.value.toFixed(1)} (\${component.status})
                        </span>
                    </div>
                \`;
            }
            componentHealth.innerHTML = componentsHtml;
            
            // Update alerts
            updateAlerts(health.alerts || []);
        }
        
        function updateAlerts(alerts) {
            const alertsDiv = document.getElementById('alerts');
            
            if (alerts.length === 0) {
                alertsDiv.innerHTML = '<p>No active alerts</p>';
                return;
            }
            
            let alertsHtml = '';
            alerts.slice(0, 10).forEach(alert => {
                alertsHtml += \`
                    <div class="alert alert-\${alert.severity}">
                        <strong>\${alert.component.toUpperCase()}</strong>: \${alert.message}
                        <br><small>\${new Date(alert.timestamp).toLocaleString()}</small>
                    </div>
                \`;
            });
            
            alertsDiv.innerHTML = alertsHtml;
        }
        
        function addAlert(alert) {
            // Add new alert to the top of the list
            const alertsDiv = document.getElementById('alerts');
            const newAlertHtml = \`
                <div class="alert alert-\${alert.severity}">
                    <strong>\${alert.component.toUpperCase()}</strong>: \${alert.message}
                    <br><small>\${new Date(alert.timestamp).toLocaleString()}</small>
                </div>
            \`;
            
            alertsDiv.innerHTML = newAlertHtml + alertsDiv.innerHTML;
        }
    </script>
</body>
</html>
    `;
  }

  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Shutdown the monitoring system
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Shutting down Enhanced Monitoring System...');
    
    // Clear intervals
    if (this.monitoringInterval) clearInterval(this.monitoringInterval);
    if (this.alertingInterval) clearInterval(this.alertingInterval);
    if (this.predictionInterval) clearInterval(this.predictionInterval);
    
    // Close WebSocket connections
    this.connectedClients.forEach(client => {
      client.close();
    });
    this.connectedClients.clear();
    
    // Close servers
    if (this.websocketServer) {
      this.websocketServer.close();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    this.logger.info('✅ Enhanced Monitoring System shut down');
  }
}