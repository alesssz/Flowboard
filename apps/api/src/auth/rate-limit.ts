// Attempts counted per key in fixed windows, in this process's memory: one API instance only.

export class RateLimiter {
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #windows = new Map<string, { count: number; endsAt: number }>();

  constructor(limit: number, windowMs: number) {
    this.#limit = limit;
    this.#windowMs = windowMs;
  }

  /** Counts an attempt: 0 when it may go ahead, else the seconds until the key's window ends. */
  hit(key: string): number {
    const now = Date.now();
    const window = this.#windows.get(key);
    if (window === undefined || window.endsAt <= now) {
      this.#prune(now);
      this.#windows.set(key, { count: 1, endsAt: now + this.#windowMs });
      return 0;
    }
    if (window.count >= this.#limit) return Math.ceil((window.endsAt - now) / 1000);
    window.count += 1;
    return 0;
  }

  /** Forgets the key's attempts, after one that succeeded. */
  reset(key: string): void {
    this.#windows.delete(key);
  }

  // Keys sent once and never again would otherwise stay for good.
  #prune(now: number): void {
    if (this.#windows.size < 10_000) return;
    for (const [key, window] of this.#windows) {
      if (window.endsAt <= now) this.#windows.delete(key);
    }
  }
}
