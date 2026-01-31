export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 30, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(): boolean {
    this.cleanup();
    return this.requests.length < this.maxRequests;
  }

  recordRequest(): void {
    this.requests.push(Date.now());
  }

  getWaitTime(): number {
    this.cleanup();
    if (this.requests.length < this.maxRequests) {
      return 0;
    }
    const oldestRequest = this.requests[0];
    return oldestRequest + this.windowMs - Date.now();
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((time) => time > cutoff);
  }
}
