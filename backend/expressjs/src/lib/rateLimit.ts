/**
 * A fixed-window counter per key, held in memory.
 *
 * Enough for CardVault's single Express instance. Counts reset when the process restarts and are
 * not shared between instances; a shared store would be needed to scale out (tech.md rules out
 * Redis without a documented requirement).
 */
export interface RateLimitDecision {
  allowed: boolean;
  /** Seconds until the window resets, for the Retry-After header. */
  retryAfterSeconds: number;
  /** The limit applied to this window. */
  limit: number;
  /** Requests still allowed in this window after this one. */
  remaining: number;
}

export function createRateLimiter(options: { windowMs: number; limit: () => number }) {
  const windows = new Map<string, { startedAt: number; count: number }>();
  let lastSweep = 0;

  function consume(key: string, now = Date.now()): RateLimitDecision {
    // Drop expired windows at most once per window, so the map does not grow without bound and
    // a busy limiter does not scan every key on every request.
    if (now - lastSweep >= options.windowMs) {
      for (const [k, w] of windows) if (now - w.startedAt >= options.windowMs) windows.delete(k);
      lastSweep = now;
    }

    const existing = windows.get(key);
    const window =
      existing && now - existing.startedAt < options.windowMs ? existing : { startedAt: now, count: 0 };
    const limit = options.limit();
    const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + options.windowMs - now) / 1000));
    if (window.count >= limit) return { allowed: false, retryAfterSeconds, limit, remaining: 0 };
    window.count += 1;
    windows.set(key, window);
    return { allowed: true, retryAfterSeconds, limit, remaining: Math.max(0, limit - window.count) };
  }

  return {
    consume,
    reset: () => {
      windows.clear();
      lastSweep = 0;
    },
  };
}
