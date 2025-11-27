# Snow-Flow Memory Leak Fix Plan

## Executive Summary

Na grondige analyse zijn **21 memory leaks** geïdentificeerd in de snow-flow codebase. Dit plan beschrijft een gefaseerde aanpak om deze te fixen zonder de stabiliteit van het systeem te compromitteren.

## Fases

### Fase 1: Foundation - Utility Classes (Laag Risico)
**Doel:** Herbruikbare patterns creëren voor memory management

### Fase 2: Process Management (Hoog Impact)
**Doel:** MCP process lifecycle fixen

### Fase 3: Monitoring & Tracking (Medium Impact)
**Doel:** Performance en health monitoring fixen

### Fase 4: Session Management (Medium Impact)
**Doel:** Session lifecycle fixen

### Fase 5: Base Server (Medium Impact)
**Doel:** MCP server memory issues fixen

### Fase 6: Testing & Validation
**Doel:** Verifiëren dat fixes werken

---

## Fase 1: Foundation - Utility Classes

### 1.1 Nieuw bestand: `src/utils/memory-safe-collections.ts`

Creëer herbruikbare bounded collections:

```typescript
/**
 * Memory-safe collections for snow-flow
 * Prevents unbounded growth of Maps and Sets
 */

export class BoundedMap<K, V> extends Map<K, V> {
  private maxSize: number;
  private evictionStrategy: 'lru' | 'fifo';
  private accessOrder: K[] = [];

  constructor(maxSize: number = 1000, evictionStrategy: 'lru' | 'fifo' = 'lru') {
    super();
    this.maxSize = maxSize;
    this.evictionStrategy = evictionStrategy;
  }

  set(key: K, value: V): this {
    // Update access order for LRU
    if (this.evictionStrategy === 'lru') {
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }

    // Evict oldest if at capacity
    if (this.size >= this.maxSize && !this.has(key)) {
      const evictKey = this.accessOrder.shift();
      if (evictKey !== undefined) {
        super.delete(evictKey);
      }
    }

    return super.set(key, value);
  }

  get(key: K): V | undefined {
    // Update access order for LRU
    if (this.evictionStrategy === 'lru' && this.has(key)) {
      const idx = this.accessOrder.indexOf(key);
      if (idx > -1) {
        this.accessOrder.splice(idx, 1);
        this.accessOrder.push(key);
      }
    }
    return super.get(key);
  }

  delete(key: K): boolean {
    const idx = this.accessOrder.indexOf(key);
    if (idx > -1) this.accessOrder.splice(idx, 1);
    return super.delete(key);
  }

  clear(): void {
    this.accessOrder = [];
    super.clear();
  }
}

export class BoundedSet<T> extends Set<T> {
  private maxSize: number;
  private insertionOrder: T[] = [];

  constructor(maxSize: number = 1000) {
    super();
    this.maxSize = maxSize;
  }

  add(value: T): this {
    if (this.size >= this.maxSize && !this.has(value)) {
      const evictValue = this.insertionOrder.shift();
      if (evictValue !== undefined) {
        super.delete(evictValue);
      }
    }

    if (!this.has(value)) {
      this.insertionOrder.push(value);
    }

    return super.add(value);
  }

  delete(value: T): boolean {
    const idx = this.insertionOrder.indexOf(value);
    if (idx > -1) this.insertionOrder.splice(idx, 1);
    return super.delete(value);
  }

  clear(): void {
    this.insertionOrder = [];
    super.clear();
  }
}
```

### 1.2 Nieuw bestand: `src/utils/timer-registry.ts`

Centrale timer management:

```typescript
/**
 * Timer Registry - Centralized timer management
 * Ensures all intervals/timeouts are properly cleaned up
 */

export class TimerRegistry {
  private static instance: TimerRegistry;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private shutdownHandlers: Array<() => Promise<void>> = [];

  private constructor() {
    // Register global shutdown handlers
    process.on('beforeExit', () => this.cleanup());
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  static getInstance(): TimerRegistry {
    if (!TimerRegistry.instance) {
      TimerRegistry.instance = new TimerRegistry();
    }
    return TimerRegistry.instance;
  }

  registerInterval(id: string, callback: () => void, ms: number, unref = true): NodeJS.Timeout {
    // Clear existing interval with same id
    this.clearInterval(id);

    const timer = setInterval(callback, ms);
    if (unref) timer.unref();

    this.intervals.set(id, timer);
    return timer;
  }

  registerTimeout(id: string, callback: () => void, ms: number): NodeJS.Timeout {
    // Clear existing timeout with same id
    this.clearTimeout(id);

    const timer = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, ms);

    this.timeouts.set(id, timer);
    return timer;
  }

  clearInterval(id: string): void {
    const timer = this.intervals.get(id);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(id);
    }
  }

  clearTimeout(id: string): void {
    const timer = this.timeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timeouts.delete(id);
    }
  }

  registerShutdownHandler(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }

  async cleanup(): Promise<void> {
    // Clear all intervals
    for (const [id, timer] of this.intervals) {
      clearInterval(timer);
    }
    this.intervals.clear();

    // Clear all timeouts
    for (const [id, timer] of this.timeouts) {
      clearTimeout(timer);
    }
    this.timeouts.clear();

    // Run shutdown handlers
    for (const handler of this.shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        console.error('Shutdown handler error:', error);
      }
    }
    this.shutdownHandlers = [];
  }

  getStats(): { intervals: number; timeouts: number; shutdownHandlers: number } {
    return {
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      shutdownHandlers: this.shutdownHandlers.length
    };
  }
}

export const timerRegistry = TimerRegistry.getInstance();
```

---

## Fase 2: Process Management Fixes

### 2.1 Fix: `src/utils/mcp-on-demand-manager.ts`

**Probleem:** `servers` Map wordt nooit opgeruimd - stopped servers blijven in geheugen

**Locatie:** Regel 26, 194-229

**Fix:**

```typescript
// VOOR (regel 226-228):
server.status = 'stopped';
server.process = undefined;
server.startTime = undefined;

// NA:
server.status = 'stopped';
server.process = undefined;
server.startTime = undefined;

// NIEUW: Verwijder stopped server na cleanup period
setTimeout(() => {
  const current = this.servers.get(serverName);
  if (current && current.status === 'stopped') {
    this.servers.delete(serverName);
    logger.debug(`Removed stopped server ${serverName} from registry`);
  }
}, 60000); // 1 minuut na stop
```

**Extra Fix:** Event listeners cleanup in `stopServer()`:

```typescript
// NIEUW: Toevoegen in stopServer() vóór process.kill()
if (server.process) {
  // Remove all event listeners to prevent memory leak
  server.process.removeAllListeners('error');
  server.process.removeAllListeners('exit');
  server.process.stdout?.removeAllListeners('data');
  server.process.stderr?.removeAllListeners('data');
}
```

**Extra Fix:** Gebruik TimerRegistry voor cleanupInterval:

```typescript
// VOOR (regel 269-279):
private startInactivityMonitor(): void {
  this.cleanupInterval = setInterval(() => {
    this.stopInactiveServers().catch(...);
  }, 60000);
  this.cleanupInterval.unref();
}

// NA:
private startInactivityMonitor(): void {
  timerRegistry.registerInterval(
    'mcp-on-demand-inactivity',
    () => this.stopInactiveServers().catch(error => {
      logger.error('Error during inactivity cleanup:', error);
    }),
    60000,
    true // unref
  );
}

stopInactivityMonitor(): void {
  timerRegistry.clearInterval('mcp-on-demand-inactivity');
}
```

### 2.2 Fix: `src/utils/mcp-persistent-guard.ts`

**Probleem:** `process.kill` override wordt nooit teruggedraaid

**Locatie:** Regel 49-62

**Fix:** Voeg cleanup method toe:

```typescript
// NIEUW: Toevoegen aan class
cleanup(): void {
  // Restore original process.kill
  if (this.originalProcessKill) {
    process.kill = this.originalProcessKill;
  }

  // Clear protected processes
  this.protectedProcesses.clear();

  this.isActive = false;
  this.logger.info('MCPPersistentGuard cleanup complete');
}

// NIEUW: Registreer cleanup bij TimerRegistry
// In constructor, na installProcessProtection():
timerRegistry.registerShutdownHandler(async () => {
  this.cleanup();
});
```

### 2.3 Fix: `src/utils/mcp-process-manager.ts`

**Probleem:** `cleanupTimer` wordt nooit gestopt

**Locatie:** Regel 276-299, 304-310

**Fix:** Registreer shutdown handler:

```typescript
// In constructor, toevoegen:
timerRegistry.registerShutdownHandler(async () => {
  this.stopPeriodicCleanup();
});
```

---

## Fase 3: Monitoring & Tracking Fixes

### 3.1 Fix: `src/monitoring/performance-tracker.ts`

**Probleem 1:** `activeOperations` Map kan orphaned entries bevatten

**Locatie:** Regel 99, 153

**Fix:** Timeout voor orphaned operations:

```typescript
// NIEUW: In startOperation(), na this.activeOperations.set():
// Set cleanup timeout for orphaned operations (5 minutes max)
setTimeout(() => {
  if (this.activeOperations.has(id)) {
    this.logger.warn(`Cleaning up orphaned operation: ${id}`);
    this.activeOperations.delete(id);
  }
}, 5 * 60 * 1000);
```

**Probleem 2:** `metricsBuffer` heeft geen hard limit

**Locatie:** Regel 100, 187-192

**Fix:**

```typescript
// VOOR (regel 187-192):
this.metricsBuffer.push(metric);
if (this.metricsBuffer.length >= 100) {
  await this.flushMetrics();
}

// NA:
// Hard limit: if buffer exceeds 500, drop oldest
if (this.metricsBuffer.length >= 500) {
  this.metricsBuffer = this.metricsBuffer.slice(-400);
  this.logger.warn('Metrics buffer exceeded limit, dropping oldest entries');
}
this.metricsBuffer.push(metric);
if (this.metricsBuffer.length >= 100) {
  await this.flushMetrics().catch(err => {
    this.logger.error('Failed to flush metrics:', err);
  });
}
```

**Probleem 3:** `aggregationTimer` en resource monitoring interval niet gestopt

**Locatie:** Regel 501-529

**Fix:** Gebruik TimerRegistry:

```typescript
// VOOR (regel 501-505):
private startAggregation(): void {
  this.aggregationTimer = setInterval(async () => {
    await this.flushMetrics();
    await this.aggregateMetrics();
  }, this.config.aggregationInterval);
}

// NA:
private startAggregation(): void {
  timerRegistry.registerInterval(
    'performance-tracker-aggregation',
    async () => {
      await this.flushMetrics();
      await this.aggregateMetrics();
    },
    this.config.aggregationInterval,
    true
  );
}

// VOOR (regel 508-529):
private startResourceMonitoring(): void {
  setInterval(() => {
    const usage = this.captureResourceUsage();
    // ...
  }, 10000);
}

// NA:
private startResourceMonitoring(): void {
  timerRegistry.registerInterval(
    'performance-tracker-resource-monitor',
    () => {
      const usage = this.captureResourceUsage();
      if (usage.memoryUsage > 0.8) {
        this.emit('resource:warning', { type: 'memory', usage: usage.memoryUsage, threshold: 0.8 });
      }
      if (usage.cpuUsage > 0.8) {
        this.emit('resource:warning', { type: 'cpu', usage: usage.cpuUsage, threshold: 0.8 });
      }
    },
    10000,
    true
  );
}

// UPDATE shutdown() method (regel 452-464):
async shutdown(): Promise<void> {
  this.logger.info('Shutting down Performance Tracker...');

  timerRegistry.clearInterval('performance-tracker-aggregation');
  timerRegistry.clearInterval('performance-tracker-resource-monitor');

  await this.flushMetrics();
  this.activeOperations.clear();

  this.initialized = false;
}
```

---

## Fase 4: Session Management Fixes

### 4.1 Fix: `src/snow-flow-system.ts`

**Probleem:** `sessions` Map wordt nooit opgeruimd

**Locatie:** Regel 47, 224

**Fix:** Session cleanup met TTL:

```typescript
// NIEUW: Constanten toevoegen
private readonly SESSION_TTL = 24 * 60 * 60 * 1000; // 24 uur
private readonly SESSION_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 uur

// NIEUW: In initialize(), na alle andere initializations:
private startSessionCleanup(): void {
  timerRegistry.registerInterval(
    'snow-flow-session-cleanup',
    () => this.cleanupOldSessions(),
    this.SESSION_CLEANUP_INTERVAL,
    true
  );
}

private cleanupOldSessions(): void {
  const now = Date.now();
  const sessionsToRemove: string[] = [];

  for (const [id, session] of this.sessions) {
    // Remove completed/failed sessions older than TTL
    if (['completed', 'failed'].includes(session.status)) {
      const age = now - session.startedAt.getTime();
      if (age > this.SESSION_TTL) {
        sessionsToRemove.push(id);
      }
    }
  }

  for (const id of sessionsToRemove) {
    this.sessions.delete(id);
    this.logger.debug(`Cleaned up old session: ${id}`);
  }

  if (sessionsToRemove.length > 0) {
    this.logger.info(`Cleaned up ${sessionsToRemove.length} old sessions`);
  }
}

// UPDATE shutdown() om sessions te clearen:
async shutdown(): Promise<void> {
  // ... existing code ...

  timerRegistry.clearInterval('snow-flow-session-cleanup');
  this.sessions.clear();

  // ... rest of existing code ...
}
```

---

## Fase 5: Base Server Fixes

### 5.1 Fix: `src/mcp/base-mcp-server.ts`

**Probleem 1:** `toolMetrics` Map groeit onbeperkt

**Locatie:** Regel 72

**Fix:** Gebruik BoundedMap:

```typescript
// VOOR:
private toolMetrics: Map<string, { calls: number; totalTime: number; errors: number }> = new Map();

// NA:
import { BoundedMap } from '../utils/memory-safe-collections.js';

private toolMetrics: BoundedMap<string, { calls: number; totalTime: number; errors: number }> =
  new BoundedMap(100); // Max 100 tools tracked
```

**Probleem 2:** `circuitBreakers` Map groeit onbeperkt

**Locatie:** Regel 346

**Fix:**

```typescript
// VOOR:
private circuitBreakers: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();

// NA:
private circuitBreakers: BoundedMap<string, { failures: number; lastFailure: number; isOpen: boolean }> =
  new BoundedMap(50); // Max 50 circuit breakers
```

**Probleem 3:** `authCheckInterval` alleen opgeruimd bij gracefulShutdown

**Locatie:** Regel 191-198

**Fix:** Gebruik TimerRegistry:

```typescript
// VOOR (regel 191-198):
this.authCheckInterval = setInterval(async () => {
  try {
    await this.validateAuth();
  } catch (error) {
    this.logger.error('Background auth check failed:', error);
  }
}, 5 * 60 * 1000);

// NA:
timerRegistry.registerInterval(
  `${this.config.name}-auth-check`,
  async () => {
    try {
      await this.validateAuth();
    } catch (error) {
      this.logger.error('Background auth check failed:', error);
    }
  },
  5 * 60 * 1000,
  true
);
```

**Probleem 4:** Metrics interval (setupMetrics) nooit gestopt

**Locatie:** Regel 533-545

**Fix:**

```typescript
// VOOR:
private setupMetrics(): void {
  setInterval(() => {
    // ... logging code ...
  }, 60000);
}

// NA:
private setupMetrics(): void {
  timerRegistry.registerInterval(
    `${this.config.name}-metrics`,
    () => {
      const metrics = Array.from(this.toolMetrics.entries()).map(([tool, data]) => ({
        tool,
        calls: data.calls,
        avgTime: data.calls > 0 ? Math.round(data.totalTime / data.calls) : 0,
        errorRate: data.calls > 0 ? (data.errors / data.calls * 100).toFixed(2) : '0',
      }));

      if (metrics.length > 0) {
        this.logger.info('Tool metrics:', metrics);
      }
    },
    60000,
    true
  );
}
```

**Probleem 5:** Event listeners op process niveau

**Locatie:** Regel 513-527

**Fix:** Gebruik named handlers zodat ze verwijderd kunnen worden:

```typescript
// VOOR:
private setupErrorHandling(): void {
  process.on('uncaughtException', (error) => { ... });
  process.on('unhandledRejection', (reason, promise) => { ... });
  process.on('SIGINT', () => { ... });
}

// NA:
private uncaughtExceptionHandler = (error: Error) => {
  this.logger.error('Uncaught exception:', error);
  this.gracefulShutdown();
};

private unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
  this.logger.error('Unhandled rejection:', { promise, reason });
};

private sigintHandler = () => {
  this.logger.info('Received SIGINT, shutting down gracefully...');
  this.gracefulShutdown();
};

private setupErrorHandling(): void {
  process.on('uncaughtException', this.uncaughtExceptionHandler);
  process.on('unhandledRejection', this.unhandledRejectionHandler);
  process.on('SIGINT', this.sigintHandler);
}

// UPDATE gracefulShutdown():
private async gracefulShutdown(): Promise<void> {
  this.logger.info('Starting graceful shutdown...');

  // Remove event listeners
  process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
  process.removeListener('unhandledRejection', this.unhandledRejectionHandler);
  process.removeListener('SIGINT', this.sigintHandler);

  // Clear intervals via TimerRegistry
  timerRegistry.clearInterval(`${this.config.name}-auth-check`);
  timerRegistry.clearInterval(`${this.config.name}-metrics`);

  // Clear collections
  this.toolMetrics.clear();
  this.circuitBreakers.clear();

  // ... rest of existing code ...
}
```

---

## Fase 6: Testing & Validation

### 6.1 Memory Leak Test Script

Nieuw bestand: `tests/memory-leak-test.ts`

```typescript
/**
 * Memory Leak Test Suite
 * Validates that memory stays bounded during extended operation
 */

import { MCPOnDemandManager } from '../src/utils/mcp-on-demand-manager';
import { PerformanceTracker } from '../src/monitoring/performance-tracker';
import { timerRegistry } from '../src/utils/timer-registry';

async function runMemoryTest(durationMinutes: number = 5) {
  console.log(`Starting ${durationMinutes} minute memory test...`);

  const initialMemory = process.memoryUsage();
  const samples: number[] = [];

  // Sample memory every 10 seconds
  const sampleInterval = setInterval(() => {
    const mem = process.memoryUsage();
    samples.push(mem.heapUsed);
    console.log(`Heap: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
  }, 10000);

  // Simulate activity
  const activityInterval = setInterval(() => {
    // Simulate various operations that could leak
    // ... test code ...
  }, 1000);

  // Wait for test duration
  await new Promise(resolve => setTimeout(resolve, durationMinutes * 60 * 1000));

  clearInterval(sampleInterval);
  clearInterval(activityInterval);

  // Analyze results
  const finalMemory = process.memoryUsage();
  const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  const avgMemory = samples.reduce((a, b) => a + b, 0) / samples.length / 1024 / 1024;

  console.log('\n=== Memory Test Results ===');
  console.log(`Initial heap: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
  console.log(`Final heap: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
  console.log(`Growth: ${memoryGrowth.toFixed(2)}MB`);
  console.log(`Average: ${avgMemory.toFixed(2)}MB`);
  console.log(`Timer registry: ${JSON.stringify(timerRegistry.getStats())}`);

  // Cleanup
  await timerRegistry.cleanup();

  // Pass/Fail criteria
  if (memoryGrowth > 100) {
    console.log('❌ FAIL: Excessive memory growth detected');
    process.exit(1);
  } else {
    console.log('✅ PASS: Memory growth within acceptable limits');
    process.exit(0);
  }
}

runMemoryTest(5);
```

### 6.2 Monitoring Command

Voeg toe aan CLI: `snow-flow memory-status`

```typescript
// In src/cli.ts, nieuw command:
.command('memory-status')
.description('Show memory usage and leak indicators')
.action(async () => {
  const mem = process.memoryUsage();
  const timerStats = timerRegistry.getStats();

  console.log('=== Snow-Flow Memory Status ===\n');
  console.log('Heap Used:', Math.round(mem.heapUsed / 1024 / 1024), 'MB');
  console.log('Heap Total:', Math.round(mem.heapTotal / 1024 / 1024), 'MB');
  console.log('External:', Math.round(mem.external / 1024 / 1024), 'MB');
  console.log('Array Buffers:', Math.round(mem.arrayBuffers / 1024 / 1024), 'MB');
  console.log('\nTimers:');
  console.log('  Active Intervals:', timerStats.intervals);
  console.log('  Active Timeouts:', timerStats.timeouts);
  console.log('  Shutdown Handlers:', timerStats.shutdownHandlers);
});
```

---

## Implementatie Volgorde

1. **Fase 1** - Foundation (dag 1)
   - [ ] Maak `memory-safe-collections.ts`
   - [ ] Maak `timer-registry.ts`
   - [ ] Test beide utilities

2. **Fase 2** - Process Management (dag 1-2)
   - [ ] Fix `mcp-on-demand-manager.ts`
   - [ ] Fix `mcp-persistent-guard.ts`
   - [ ] Fix `mcp-process-manager.ts`

3. **Fase 3** - Monitoring (dag 2)
   - [ ] Fix `performance-tracker.ts`

4. **Fase 4** - Sessions (dag 2)
   - [ ] Fix `snow-flow-system.ts`

5. **Fase 5** - Base Server (dag 3)
   - [ ] Fix `base-mcp-server.ts`
   - [ ] Verify alle MCP servers erven correct

6. **Fase 6** - Testing (dag 3-4)
   - [ ] Run memory leak tests
   - [ ] 24-uur stress test
   - [ ] Documenteer resultaten

---

## Risico Mitigatie

### Backward Compatibility
- Alle nieuwe utilities zijn optioneel
- Bestaande functionaliteit blijft werken
- Gradual rollout mogelijk per component

### Rollback Plan
- Git branch per fase
- Feature flag voor nieuwe cleanup logic
- Monitoring voor memory regression

### Testing Checkpoints
- Na elke fase: basis functionaliteit test
- Na fase 5: volledige integration test
- Na fase 6: long-running stress test

---

## Success Criteria

1. **Memory stabiel** - Heap groeit niet meer dan 50MB over 24 uur
2. **Geen crashes** - Zero OOM errors in productie
3. **Performance behouden** - Response times niet verslechterd
4. **Alle tests groen** - Bestaande test suite blijft werken
