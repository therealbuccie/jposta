import { HttpException, HttpStatus } from "@nestjs/common";

type Bucket = {
  count: number;
  resetAt: number;
};

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly label: string,
  ) {}

  check(key: string) {
    const now = Date.now();
    const normalizedKey = key || "anonymous";
    const bucket = this.buckets.get(normalizedKey);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(normalizedKey, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    bucket.count += 1;

    if (bucket.count > this.limit) {
      throw new HttpException(
        `Too many ${this.label} attempts. Try again shortly.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
