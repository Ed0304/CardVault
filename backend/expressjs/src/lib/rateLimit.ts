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
}

export function createRateLimiter(options: { windowMs: number; limit: () => number }) {
  const windows = new Map<string, { startedAt: number; count: number }>();

  function consume(key: string, now = Date.now()): RateLimitDecision {
    // Drop expired windows as we go, so the map does not grow without bound.
    for (const [k, w] of windows) if (now - w.startedAt >= options.windowMs) windows.delete(k);

    const window = windows.get(key) ?? { startedAt: now, count: 0 };
    const retryAfterSeconds = Math.max(1, Math.ceil((window.startedAt + options.windowMs - now) / 1000));
    if (window.count >= options.limit()) return { allowed: false, retryAfterSeconds };
    window.count += 1;
    windows.set(key, window);
    return { allowed: true, retryAfterSeconds };
  }

  return { consume, reset: () => windows.clear() };
}
