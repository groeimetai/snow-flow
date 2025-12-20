# Snow-Flow System Health Monitoring

## Overview

The System Health module provides comprehensive real-time monitoring of all Snow-Flow components, replacing placeholder metrics with actual system measurements.

## Real Metrics Implemented

### 1. **CPU Usage** (Real-time)
- Uses CPU time differentials for accurate usage calculation
- Supports multi-core systems
- Automatically averages across all CPU cores
- Updates every 100ms for initial reading

### 2. **Memory Usage** (Real-time)
- **System Memory**: Total and used memory from OS
- **Process Memory**: 
  - Heap usage (used/total)
  - RSS (Resident Set Size)
  - External memory
  - Array buffers
- Percentage calculations for threshold monitoring

### 3. **Disk Usage** (Real-time)
- **Cross-platform support**:
  - Unix/macOS: Uses `df` command
  - Windows: Uses `wmic` command
- Monitors the filesystem containing the application
- Returns usage percentage and total size in GB
- Handles edge cases (long filesystem names, parsing errors)

### 4. **Network Connectivity**
- DNS lookup test to verify internet connectivity
- Used for ServiceNow API health checks

### 5. **Database Health**
- SQLite database size monitoring
- Table and index counts
- Integration with MemorySystem stats

### 6. **Component-Specific Monitoring**
- **Memory System**: Store/retrieve tests, cache hit rates
- **MCP Servers**: Status of all MCP server processes
- **ServiceNow**: API connectivity and response times
- **Queen System**: Active sessions and agent counts
- **Performance**: Operation success rates, response times

## Usage

### Basic Health Check

```typescript
import { SystemHealth } from './health/system-health';

const systemHealth = new SystemHealth({
  memory,
  mcpManager,
  config: {
    checks: {
      memory: true,
      mcp: true,
      servicenow: true,
      queen: true
    },
    thresholds: {
      responseTime: 1000,      // 1 second
      memoryUsage: 0.9,        // 90%
      cpuUsage: 0.8,           // 80%
      queueSize: 100,
      errorRate: 0.1           // 10%
    }
  }
});

await systemHealth.initialize();

// Single health check
const status = await systemHealth.performHealthCheck();
console.log('System healthy:', status.healthy);
console.log('CPU Usage:', status.metrics.systemResources.cpuUsage + '%');
console.log('Memory:', status.metrics.systemResources.memoryUsage + 'MB');
console.log('Disk:', status.metrics.systemResources.diskUsage + '%');
```

### Continuous Monitoring

```typescript
// Start monitoring every 30 seconds
await systemHealth.startMonitoring(30000);

// Listen for health events
systemHealth.on('health:check', (status) => {
  console.log('Health update:', status);
});

systemHealth.on('health:alert', (alert) => {
  console.log('ALERT:', alert.message);
});

// Stop monitoring
await systemHealth.stopMonitoring();
```

### Testing

Run the test script to see real metrics:

```bash
npm run build
npm run test:health
```

## Thresholds and Alerts

The system triggers alerts when:
- **CPU Usage** > 80% (degraded), > 90% (critical)
- **Memory Usage** > 80% (degraded), > 90% (critical)
- **Disk Usage** > 80% (degraded), > 90% (critical)
- **Heap Usage** > 90% (degraded)
- **Network Connectivity** lost (degraded)
- **Response Times** exceed configured thresholds

## Architecture

```
SystemHealth
├── CPU Monitor (real-time calculation)
├── Memory Monitor (system + process)
├── Disk Monitor (platform-specific)
├── Network Monitor (DNS-based)
├── Component Monitors
│   ├── Memory System
│   ├── MCP Servers
│   ├── ServiceNow API
│   ├── Queen System
│   └── Performance Metrics
└── Alert System
```

## Platform Support

- ✅ **macOS**: Full support for all metrics
- ✅ **Linux**: Full support for all metrics
- ✅ **Windows**: Full support (uses WMIC for disk stats)
- ⚠️ **Other platforms**: Basic support (some metrics may be unavailable)

## Performance Impact

The health monitoring system is designed to have minimal performance impact:
- CPU usage calculation adds < 1% overhead
- Disk usage checks are cached and throttled
- Database queries are optimized with indexes
- Network checks are asynchronous and non-blocking

## Future Enhancements

- Historical metric graphing
- Predictive failure detection
- Custom metric plugins
- Prometheus/Grafana integration
- Alert webhooks and notifications