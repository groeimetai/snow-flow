/**
 * Memory Leak Test Suite for Snow-Flow
 *
 * Run with: npx ts-node tests/memory-leak-test.ts
 *
 * This test validates that memory stays bounded during extended operation
 * by simulating various operations and monitoring heap usage.
 */

import { BoundedMap, BoundedSet, BoundedArray } from '../src/utils/memory-safe-collections.js';
import { timerRegistry } from '../src/utils/timer-registry.js';

interface MemorySample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
}

class MemoryLeakTester {
  private samples: MemorySample[] = [];
  private testDurationMs: number;
  private sampleIntervalMs: number;

  constructor(durationMinutes: number = 1, sampleIntervalSeconds: number = 5) {
    this.testDurationMs = durationMinutes * 60 * 1000;
    this.sampleIntervalMs = sampleIntervalSeconds * 1000;
  }

  private captureMemory(): MemorySample {
    const mem = process.memoryUsage();
    return {
      timestamp: Date.now(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external
    };
  }

  private formatBytes(bytes: number): string {
    return `${Math.round(bytes / 1024 / 1024)}MB`;
  }

  async testBoundedCollections(): Promise<boolean> {
    console.log('\n=== Testing BoundedMap ===');

    const map = new BoundedMap<string, object>(100);

    // Add 1000 items to a map with max size 100
    for (let i = 0; i < 1000; i++) {
      map.set(`key-${i}`, { data: 'x'.repeat(1000), index: i });
    }

    const mapSize = map.size;
    console.log(`BoundedMap size after 1000 inserts (max 100): ${mapSize}`);

    if (mapSize > 100) {
      console.log('❌ FAIL: BoundedMap exceeded max size');
      return false;
    }

    console.log('✅ PASS: BoundedMap respects max size');

    console.log('\n=== Testing BoundedSet ===');

    const set = new BoundedSet<string>(50);

    // Add 500 items to a set with max size 50
    for (let i = 0; i < 500; i++) {
      set.add(`item-${i}`);
    }

    const setSize = set.size;
    console.log(`BoundedSet size after 500 inserts (max 50): ${setSize}`);

    if (setSize > 50) {
      console.log('❌ FAIL: BoundedSet exceeded max size');
      return false;
    }

    console.log('✅ PASS: BoundedSet respects max size');

    console.log('\n=== Testing BoundedArray ===');

    const arr = new BoundedArray<object>(25);

    // Push 250 items to an array with max size 25
    for (let i = 0; i < 250; i++) {
      arr.push({ data: 'y'.repeat(500), index: i });
    }

    const arrLength = arr.length;
    console.log(`BoundedArray length after 250 pushes (max 25): ${arrLength}`);

    if (arrLength > 25) {
      console.log('❌ FAIL: BoundedArray exceeded max size');
      return false;
    }

    console.log('✅ PASS: BoundedArray respects max size');

    return true;
  }

  async testTimerRegistry(): Promise<boolean> {
    console.log('\n=== Testing TimerRegistry ===');

    const initialStats = timerRegistry.getStats();
    console.log(`Initial timers: ${initialStats.intervals} intervals, ${initialStats.timeouts} timeouts`);

    // Register some timers
    for (let i = 0; i < 10; i++) {
      timerRegistry.registerInterval(`test-interval-${i}`, () => {}, 60000, true);
      timerRegistry.registerTimeout(`test-timeout-${i}`, () => {}, 60000);
    }

    const afterRegister = timerRegistry.getStats();
    console.log(`After registration: ${afterRegister.intervals} intervals, ${afterRegister.timeouts} timeouts`);

    // Clear them
    for (let i = 0; i < 10; i++) {
      timerRegistry.clearInterval(`test-interval-${i}`);
      timerRegistry.clearTimeout(`test-timeout-${i}`);
    }

    const afterClear = timerRegistry.getStats();
    console.log(`After cleanup: ${afterClear.intervals} intervals, ${afterClear.timeouts} timeouts`);

    // Verify cleanup
    if (afterClear.intervals > initialStats.intervals || afterClear.timeouts > initialStats.timeouts) {
      console.log('❌ FAIL: TimerRegistry did not properly clean up');
      return false;
    }

    console.log('✅ PASS: TimerRegistry properly cleans up timers');

    return true;
  }

  async runMemoryTest(): Promise<boolean> {
    console.log('\n=== Starting Memory Growth Test ===');
    console.log(`Duration: ${this.testDurationMs / 60000} minutes`);
    console.log(`Sample interval: ${this.sampleIntervalMs / 1000} seconds`);

    const initialMemory = this.captureMemory();
    console.log(`\nInitial heap: ${this.formatBytes(initialMemory.heapUsed)}`);

    // Take samples while simulating activity
    const startTime = Date.now();
    const activityMap = new BoundedMap<string, object>(500);
    let operationCount = 0;

    while (Date.now() - startTime < this.testDurationMs) {
      // Simulate activity
      for (let i = 0; i < 100; i++) {
        activityMap.set(`op-${operationCount++}`, {
          timestamp: Date.now(),
          data: 'x'.repeat(100)
        });
      }

      // Capture sample
      const sample = this.captureMemory();
      this.samples.push(sample);
      console.log(`  Heap: ${this.formatBytes(sample.heapUsed)} (ops: ${operationCount})`);

      // Wait for next sample
      await new Promise(resolve => setTimeout(resolve, this.sampleIntervalMs));
    }

    const finalMemory = this.captureMemory();
    const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(`\nFinal heap: ${this.formatBytes(finalMemory.heapUsed)}`);
    console.log(`Memory growth: ${memoryGrowth.toFixed(2)}MB`);
    console.log(`Total operations: ${operationCount}`);

    // Pass if growth is less than 100MB
    const passed = memoryGrowth < 100;

    if (passed) {
      console.log('✅ PASS: Memory growth within acceptable limits (<100MB)');
    } else {
      console.log('❌ FAIL: Excessive memory growth detected (>=100MB)');
    }

    return passed;
  }

  async run(): Promise<void> {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   Snow-Flow Memory Leak Test Suite         ║');
    console.log('╚════════════════════════════════════════════╝');

    const results: { test: string; passed: boolean }[] = [];

    // Test 1: Bounded Collections
    const collectionsResult = await this.testBoundedCollections();
    results.push({ test: 'BoundedCollections', passed: collectionsResult });

    // Test 2: Timer Registry
    const timerResult = await this.testTimerRegistry();
    results.push({ test: 'TimerRegistry', passed: timerResult });

    // Test 3: Memory Growth
    const memoryResult = await this.runMemoryTest();
    results.push({ test: 'MemoryGrowth', passed: memoryResult });

    // Summary
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║   Test Results Summary                     ║');
    console.log('╚════════════════════════════════════════════╝');

    let allPassed = true;
    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${status}: ${result.test}`);
      if (!result.passed) allPassed = false;
    }

    console.log('\n' + (allPassed ? '✅ All tests passed!' : '❌ Some tests failed!'));

    // Timer registry stats
    const timerStats = timerRegistry.getStats();
    console.log(`\nTimer Registry Stats:`);
    console.log(`  Intervals: ${timerStats.intervals}`);
    console.log(`  Timeouts: ${timerStats.timeouts}`);
    console.log(`  Shutdown Handlers: ${timerStats.shutdownHandlers}`);

    // Cleanup
    await timerRegistry.cleanup();

    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  }
}

// Run the tests
const tester = new MemoryLeakTester(1, 5); // 1 minute test, 5 second samples
tester.run().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
