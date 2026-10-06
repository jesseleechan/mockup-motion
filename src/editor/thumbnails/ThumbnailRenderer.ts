import type { Aspect, ProjectDoc } from "../../doc/types";

/** Draws one frame of a document into an image. The default backend wraps an Engine. */
export interface ThumbnailBackend {
  render(doc: ProjectDoc, t: number, width: number, height: number): Promise<Blob>;
  dispose(): void;
}

export interface ThumbnailRendererOptions {
  backend: ThumbnailBackend;
  /** CSS px on the long side; the image is this times `pixelRatio`. */
  longSide?: number;
  pixelRatio?: number;
  /** A key's render starts this long after its last request. */
  debounceMs?: number;
  /** Rendered images no key shows any more; the oldest beyond this are revoked. */
  maxUnused?: number;
}

/** A pending request was replaced by `release()` or `dispose()` before it rendered. */
export class ThumbnailCancelledError extends Error {
  constructor(key: string) {
    super(`Thumbnail request for "${key}" was cancelled`);
    this.name = "ThumbnailCancelledError";
  }
}

interface Entry {
  url: string;
  blob: Blob;
}

interface Waiter {
  resolve: (entry: Entry) => void;
  reject: (err: unknown) => void;
}

interface Pending {
  doc: ProjectDoc;
  t: number;
  hash: string;
  waiters: Waiter[];
  timer: ReturnType<typeof setTimeout> | null;
}

const DEFAULT_LONG_SIDE = 320;
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MAX_UNUSED = 24;
// Higher ratios add pixels without visible gain at thumbnail size.
const MAX_PIXEL_RATIO = 2;

const ASPECT_RATIOS: Record<Aspect, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "1:1": 1,
  "4:5": 4 / 5,
  "4:3": 4 / 3,
};

/** Output pixels for a thumbnail: `longSide` CSS px on the long side, times the pixel ratio. */
export function thumbnailSize(
  aspect: Aspect,
  longSide = DEFAULT_LONG_SIDE,
  pixelRatio = 1,
): { width: number; height: number } {
  const ratio = ASPECT_RATIOS[aspect];
  const scale = Math.min(Math.max(pixelRatio, 1), MAX_PIXEL_RATIO);
  const long = Math.round(longSide * scale);
  const short = Math.round(long / Math.max(ratio, 1 / ratio));
  return ratio >= 1 ? { width: long, height: short } : { width: short, height: long };
}

/** cyrb53: a fast 53-bit string hash. Collisions only cost a wrong thumbnail, never data. */
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Everything that changes the picture: the shots, the style, the aspect, the time and the
 * assets (by id). Names, timestamps and export settings are left out.
 */
export function thumbnailHash(doc: ProjectDoc, t: number, aspect: Aspect): string {
  return hashString(
    JSON.stringify({
      shots: doc.shots,
      style: doc.style,
      loop: doc.loop,
      aspect,
      t: Math.round(t * 1000),
      assets: doc.assets.map((a) => a.id),
    }),
  );
}

/**
 * Renders small stills of documents for the timeline and the Projects dialog. One backend
 * (one WebGL context) serves every request through a serial queue. Requests are debounced
 * per key (a shot id, or "project"), cached by content hash, and returned as object URLs.
 * URLs that no key shows any more are revoked once more than `maxUnused` pile up.
 */
export class ThumbnailRenderer {
  private readonly backend: ThumbnailBackend;
  private readonly longSide: number;
  private readonly pixelRatio: number;
  private readonly debounceMs: number;
  private readonly maxUnused: number;
  /** hash → rendered image, oldest first (a hit moves it to the end). */
  private readonly cache = new Map<string, Entry>();
  /** key → hash of the image that key shows now. */
  private readonly current = new Map<string, string>();
  private readonly pending = new Map<string, Pending>();
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(opts: ThumbnailRendererOptions) {
    this.backend = opts.backend;
    this.longSide = opts.longSide ?? DEFAULT_LONG_SIDE;
    this.pixelRatio = opts.pixelRatio ?? 1;
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxUnused = opts.maxUnused ?? DEFAULT_MAX_UNUSED;
  }

  /** Object URL of `doc` at time `t`, rendered at `aspect`. Valid until revoked (see class). */
  async render(doc: ProjectDoc, t: number, aspect: Aspect, key: string = doc.id): Promise<string> {
    return (await this.request(doc, t, aspect, key)).url;
  }

  /** Like `render`, but returns the image itself (for storage). */
  async renderBlob(
    doc: ProjectDoc,
    t: number,
    aspect: Aspect,
    key: string = doc.id,
  ): Promise<Blob> {
    return (await this.request(doc, t, aspect, key)).blob;
  }

  /** The key no longer shows a thumbnail: cancel its pending request and let its image go. */
  release(key: string): void {
    this.cancelPending(key);
    this.current.delete(key);
    this.prune();
  }

  /** Number of object URLs currently alive (tests and debugging). */
  get liveUrls(): number {
    return this.cache.size;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const key of [...this.pending.keys()]) this.cancelPending(key);
    for (const entry of this.cache.values()) URL.revokeObjectURL(entry.url);
    this.cache.clear();
    this.current.clear();
    this.backend.dispose();
  }

  private request(doc: ProjectDoc, t: number, aspect: Aspect, key: string): Promise<Entry> {
    if (this.disposed) return Promise.reject(new Error("ThumbnailRenderer is disposed"));
    const target = doc.aspect === aspect ? doc : { ...doc, aspect };
    const hash = thumbnailHash(target, t, aspect);

    const cached = this.cache.get(hash);
    if (cached) {
      // A newer request for this key wins over one still waiting for its debounce.
      const stale = this.pending.get(key);
      if (stale) {
        if (stale.timer) clearTimeout(stale.timer);
        this.pending.delete(key);
        for (const waiter of stale.waiters) waiter.resolve(cached);
      }
      this.touch(hash, cached);
      this.show(key, hash);
      return Promise.resolve(cached);
    }

    return new Promise<Entry>((resolve, reject) => {
      let entry = this.pending.get(key);
      if (!entry) {
        entry = { doc: target, t, hash, waiters: [], timer: null };
        this.pending.set(key, entry);
      }
      if (entry.timer) clearTimeout(entry.timer);
      entry.doc = target;
      entry.t = t;
      entry.hash = hash;
      entry.waiters.push({ resolve, reject });
      entry.timer = setTimeout(() => this.enqueue(key), this.debounceMs);
    });
  }

  private enqueue(key: string): void {
    const job = this.pending.get(key);
    if (!job) return;
    // Later requests for this key start a new debounce; this job is fixed now.
    this.pending.delete(key);
    job.timer = null;
    this.queue = this.queue.then(() => this.run(key, job));
  }

  private async run(key: string, job: Pending): Promise<void> {
    if (this.disposed) {
      for (const waiter of job.waiters) waiter.reject(new ThumbnailCancelledError(key));
      return;
    }
    try {
      let entry = this.cache.get(job.hash);
      if (!entry) {
        const { width, height } = thumbnailSize(job.doc.aspect, this.longSide, this.pixelRatio);
        const blob = await this.backend.render(job.doc, job.t, width, height);
        if (this.disposed) throw new ThumbnailCancelledError(key);
        entry = { url: URL.createObjectURL(blob), blob };
        this.cache.set(job.hash, entry);
      }
      this.touch(job.hash, entry);
      this.show(key, job.hash);
      for (const waiter of job.waiters) waiter.resolve(entry);
    } catch (err) {
      for (const waiter of job.waiters) waiter.reject(err);
    }
  }

  private cancelPending(key: string): void {
    const entry = this.pending.get(key);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.pending.delete(key);
    for (const waiter of entry.waiters) waiter.reject(new ThumbnailCancelledError(key));
  }

  private touch(hash: string, entry: Entry): void {
    this.cache.delete(hash);
    this.cache.set(hash, entry);
  }

  private show(key: string, hash: string): void {
    this.current.set(key, hash);
    this.prune();
  }

  /** Revokes the oldest images no key shows, keeping at most `maxUnused` of them. */
  private prune(): void {
    const shown = new Set(this.current.values());
    const unused = [...this.cache.keys()].filter((hash) => !shown.has(hash));
    for (const hash of unused.slice(0, Math.max(0, unused.length - this.maxUnused))) {
      const entry = this.cache.get(hash);
      if (entry) URL.revokeObjectURL(entry.url);
      this.cache.delete(hash);
    }
  }
}
