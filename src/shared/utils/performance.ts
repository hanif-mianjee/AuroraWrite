/**
 * Performance Logger
 *
 * Tracks and logs performance metrics for the incremental analysis system.
 * Helps measure API call reduction, token savings, and latency improvements.
 */

export interface PerformanceMetrics {
  totalAnalyses: number;
  blocksAnalyzed: number;
  blocksSkipped: number;
  apiCallsSaved: number;
  averageLatencyMs: number;
  totalLatencyMs: number;
  tokensSaved: number;
  sessionStartTime: number;
}

export interface AnalysisEvent {
  type: 'full' | 'incremental';
  fieldId: string;
  totalBlocks: number;
  dirtyBlocks: number;
  cleanBlocks: number;
  latencyMs: number;
  timestamp: number;
}

class PerformanceLogger {
  private metrics: PerformanceMetrics = {
    totalAnalyses: 0,
    blocksAnalyzed: 0,
    blocksSkipped: 0,
    apiCallsSaved: 0,
    averageLatencyMs: 0,
    totalLatencyMs: 0,
    tokensSaved: 0,
    sessionStartTime: Date.now(),
  };

  private events: AnalysisEvent[] = [];
  private analysisStartTimes: Map<string, number> = new Map();

  /**
   * Start timing an analysis.
   */
  startAnalysis(fieldId: string): void {
    this.analysisStartTimes.set(fieldId, performance.now());
  }

  /**
   * Record a completed analysis.
   */
  recordAnalysis(
    fieldId: string,
    totalBlocks: number,
    dirtyBlocks: number,
    cleanBlocks: number
  ): void {
    const startTime = this.analysisStartTimes.get(fieldId);
    const latencyMs = startTime ? performance.now() - startTime : 0;
    this.analysisStartTimes.delete(fieldId);

    const event: AnalysisEvent = {
      type: dirtyBlocks < totalBlocks ? 'incremental' : 'full',
      fieldId,
      totalBlocks,
      dirtyBlocks,
      cleanBlocks,
      latencyMs,
      timestamp: Date.now(),
    };

    this.events.push(event);

    // Update metrics
    this.metrics.totalAnalyses++;
    this.metrics.blocksAnalyzed += dirtyBlocks;
    this.metrics.blocksSkipped += cleanBlocks;
    this.metrics.apiCallsSaved += cleanBlocks; // Each skipped block = 1 saved API call
    this.metrics.totalLatencyMs += latencyMs;
    this.metrics.averageLatencyMs = this.metrics.totalLatencyMs / this.metrics.totalAnalyses;

    // Estimate tokens saved (rough estimate: 150 tokens per block average)
    this.metrics.tokensSaved += cleanBlocks * 150;

    this.logEvent(event);
  }

  /**
   * Record a suggestion acceptance (no API call).
   */
  recordSuggestionAcceptance(fieldId: string): void {
    this.metrics.apiCallsSaved++;
  }

  /**
   * Get current metrics.
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent events.
   */
  getRecentEvents(count: number = 10): AnalysisEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get efficiency stats.
   */
  getEfficiencyStats(): {
    blockSkipRate: number;
    apiCallReduction: number;
    averageLatency: number;
    sessionDuration: number;
  } {
    const totalPossibleCalls = this.metrics.blocksAnalyzed + this.metrics.blocksSkipped;
    const blockSkipRate =
      totalPossibleCalls > 0
        ? (this.metrics.blocksSkipped / totalPossibleCalls) * 100
        : 0;

    return {
      blockSkipRate,
      apiCallReduction: this.metrics.apiCallsSaved,
      averageLatency: this.metrics.averageLatencyMs,
      sessionDuration: Date.now() - this.metrics.sessionStartTime,
    };
  }

  /**
   * Log an analysis event.
   */
  private logEvent(event: AnalysisEvent): void {
    const savedBlocks = event.cleanBlocks;
    const efficiency = event.totalBlocks > 0
      ? ((savedBlocks / event.totalBlocks) * 100).toFixed(1)
      : '0';

    // Event logged internally for summary
  }

  /**
   * Log a summary of session performance.
   */
  logSummary(): void {
    const stats = this.getEfficiencyStats();
    console.log('[AuroraWrite:Perf] === Session Performance Summary ===');
    console.log(`  Total analyses: ${this.metrics.totalAnalyses}`);
    console.log(`  Blocks analyzed: ${this.metrics.blocksAnalyzed}`);
    console.log(`  Blocks skipped: ${this.metrics.blocksSkipped}`);
    console.log(`  Block skip rate: ${stats.blockSkipRate.toFixed(1)}%`);
    console.log(`  API calls saved: ${this.metrics.apiCallsSaved}`);
    console.log(`  Estimated tokens saved: ${this.metrics.tokensSaved}`);
    console.log(`  Average latency: ${stats.averageLatency.toFixed(0)}ms`);
    console.log(`  Session duration: ${(stats.sessionDuration / 1000).toFixed(0)}s`);
  }

  /**
   * Reset metrics (for testing).
   */
  reset(): void {
    this.metrics = {
      totalAnalyses: 0,
      blocksAnalyzed: 0,
      blocksSkipped: 0,
      apiCallsSaved: 0,
      averageLatencyMs: 0,
      totalLatencyMs: 0,
      tokensSaved: 0,
      sessionStartTime: Date.now(),
    };
    this.events = [];
    this.analysisStartTimes.clear();
  }
}

// Singleton instance
export const performanceLogger = new PerformanceLogger();
