/**
 * Wraps a dynamic import so every caller shares one load. A failed load is forgotten, so the
 * next call tries again (a dropped connection, or a deploy that replaced the chunk).
 */
export function preloadable<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch((err: unknown) => {
      pending = null;
      throw err;
    });
    return pending;
  };
}

/**
 * Runs `callback` once the browser is idle, or after `timeoutMs` at the latest. Returns a
 * function that cancels it.
 */
export function whenIdle(callback: () => void, timeoutMs: number): () => void {
  if (typeof requestIdleCallback === "function") {
    const id = requestIdleCallback(() => callback(), { timeout: timeoutMs });
    return () => cancelIdleCallback(id);
  }
  // Safari has no requestIdleCallback.
  const id = setTimeout(callback, timeoutMs);
  return () => clearTimeout(id);
}

/** Runs `callback` once the next frame has painted. Returns a function that cancels it. */
export function afterNextPaint(callback: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // A frame callback runs just before the paint; a timeout set there runs after it.
  const frame = requestAnimationFrame(() => {
    timer = setTimeout(callback, 0);
  });
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
  };
}
