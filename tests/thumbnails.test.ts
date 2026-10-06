import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { ProjectDoc } from "../src/doc/types";
import {
  ThumbnailCancelledError,
  ThumbnailRenderer,
  thumbnailHash,
  thumbnailSize,
  type ThumbnailBackend,
} from "../src/editor/thumbnails/ThumbnailRenderer";
import { createProjectThumbnailScheduler } from "../src/editor/thumbnails/project-thumbnail-scheduler";

interface Call {
  doc: ProjectDoc;
  t: number;
  width: number;
  height: number;
}

/** Records every render; each one resolves only when the test says so. */
function fakeBackend() {
  const calls: Call[] = [];
  const finishers: (() => void)[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const backend: ThumbnailBackend = {
    render(doc, t, width, height) {
      calls.push({ doc, t, width, height });
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<Blob>((resolve) => {
        finishers.push(() => {
          inFlight--;
          resolve(new Blob([`${doc.id}@${t}`], { type: "image/webp" }));
        });
      });
    },
    dispose: vi.fn(),
  };
  return {
    backend,
    calls,
    /** Finishes the oldest unfinished render, then lets the queue move on. */
    async finishNext() {
      const finish = finishers.shift();
      if (!finish) throw new Error("No render is in flight");
      finish();
      await vi.advanceTimersByTimeAsync(0);
    },
    get maxInFlight() {
      return maxInFlight;
    },
  };
}

function docWithPreset(preset: "pushIn" | "pullBack" | "static"): ProjectDoc {
  const doc = createDoc();
  doc.shots[0].camera.preset = preset;
  return doc;
}

describe("F07: ThumbnailRenderer", () => {
  let revoked: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    revoked = [];
    const realRevoke = URL.revokeObjectURL.bind(URL);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
      revoked.push(url);
      realRevoke(url);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sizes thumbnails at 320 px on the long side times min(dpr, 2)", () => {
    expect(thumbnailSize("16:9", 320, 1)).toEqual({ width: 320, height: 180 });
    expect(thumbnailSize("16:9", 320, 2)).toEqual({ width: 640, height: 360 });
    expect(thumbnailSize("16:9", 320, 3)).toEqual({ width: 640, height: 360 });
    expect(thumbnailSize("9:16", 320, 2)).toEqual({ width: 360, height: 640 });
    expect(thumbnailSize("1:1", 320, 1)).toEqual({ width: 320, height: 320 });
    expect(thumbnailSize("4:5", 320, 1)).toEqual({ width: 256, height: 320 });
  });

  it("hashes what changes the picture and ignores what does not", () => {
    const doc = docWithPreset("pushIn");
    const renamed = { ...doc, name: "Renamed", updatedAt: doc.updatedAt + 1000 };
    expect(thumbnailHash(renamed, 2.5, "16:9")).toBe(thumbnailHash(doc, 2.5, "16:9"));
    expect(thumbnailHash(docWithPreset("pullBack"), 2.5, "16:9")).not.toBe(
      thumbnailHash(doc, 2.5, "16:9"),
    );
    expect(thumbnailHash(doc, 2.5, "9:16")).not.toBe(thumbnailHash(doc, 2.5, "16:9"));
    expect(thumbnailHash(doc, 3, "16:9")).not.toBe(thumbnailHash(doc, 2.5, "16:9"));
  });

  it("debounces each key by 300 ms and renders only the latest request", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend });
    const first = renderer.render(docWithPreset("static"), 1, "16:9", "shot-1");
    await vi.advanceTimersByTimeAsync(200);
    const second = renderer.render(docWithPreset("pushIn"), 1, "16:9", "shot-1");
    await vi.advanceTimersByTimeAsync(299);
    expect(fake.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].doc.shots[0].camera.preset).toBe("pushIn");
    expect(fake.calls[0]).toMatchObject({ width: 320, height: 180, t: 1 });

    await fake.finishNext();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toMatch(/^blob:/);
    expect(b).toBe(a);
  });

  it("renders one request at a time", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend });
    const urls = ["a", "b", "c"].map((key, i) =>
      renderer.render(docWithPreset("static"), i, "16:9", key),
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(fake.calls).toHaveLength(1);
    await fake.finishNext();
    expect(fake.calls).toHaveLength(2);
    await fake.finishNext();
    await fake.finishNext();
    expect(fake.calls).toHaveLength(3);
    expect(fake.maxInFlight).toBe(1);
    expect(new Set(await Promise.all(urls)).size).toBe(3);
  });

  it("serves a repeated picture from the cache without rendering again", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend });
    const doc = docWithPreset("pushIn");
    const pending = renderer.render(doc, 2, "16:9", "shot-1");
    await vi.advanceTimersByTimeAsync(300);
    await fake.finishNext();
    const url = await pending;

    // Same picture under another key (and with a different name): no new render, no wait.
    const again = await renderer.render({ ...doc, name: "Other" }, 2, "16:9", "shot-2");
    expect(again).toBe(url);
    expect(fake.calls).toHaveLength(1);
  });

  it("passes the requested aspect to the backend", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend, pixelRatio: 2 });
    const pending = renderer.render(docWithPreset("static"), 0, "9:16", "shot-1");
    await vi.advanceTimersByTimeAsync(300);
    expect(fake.calls[0].doc.aspect).toBe("9:16");
    expect(fake.calls[0]).toMatchObject({ width: 360, height: 640 });
    await fake.finishNext();
    await pending;
  });

  it("revokes images no key shows once more than maxUnused pile up, never shown ones", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend, maxUnused: 1 });
    const urls: string[] = [];
    for (let t = 0; t < 4; t++) {
      const pending = renderer.render(docWithPreset("static"), t, "16:9", "shot-1");
      await vi.advanceTimersByTimeAsync(300);
      await fake.finishNext();
      urls.push(await pending);
    }
    // shot-1 shows urls[3]; one unused image (urls[2]) is kept, older ones are revoked.
    expect(revoked).toEqual([urls[0], urls[1]]);
    expect(renderer.liveUrls).toBe(2);

    renderer.release("shot-1");
    expect(revoked).toEqual([urls[0], urls[1], urls[2]]);
    expect(renderer.liveUrls).toBe(1);
  });

  it("dispose revokes every URL, cancels pending requests and disposes the backend", async () => {
    const fake = fakeBackend();
    const renderer = new ThumbnailRenderer({ backend: fake.backend });
    const done = renderer.render(docWithPreset("static"), 0, "16:9", "shot-1");
    await vi.advanceTimersByTimeAsync(300);
    await fake.finishNext();
    const url = await done;

    const waiting = renderer.render(docWithPreset("pushIn"), 0, "16:9", "shot-2");
    renderer.dispose();
    await expect(waiting).rejects.toBeInstanceOf(ThumbnailCancelledError);
    expect(revoked).toEqual([url]);
    expect(fake.backend.dispose).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fake.calls).toHaveLength(1);
  });

  it("rejects the waiting requests when the backend fails, and keeps the queue running", async () => {
    let fail = true;
    const backend: ThumbnailBackend = {
      async render() {
        if (fail) throw new Error("context lost");
        return new Blob(["ok"], { type: "image/webp" });
      },
      dispose: vi.fn(),
    };
    const renderer = new ThumbnailRenderer({ backend });
    const failing = renderer.render(docWithPreset("static"), 0, "16:9", "shot-1");
    const failed = expect(failing).rejects.toThrow("context lost");
    await vi.advanceTimersByTimeAsync(300);
    await failed;

    fail = false;
    const next = renderer.render(docWithPreset("static"), 0, "16:9", "shot-1");
    await vi.advanceTimersByTimeAsync(300);
    await expect(next).resolves.toMatch(/^blob:/);
  });
});

describe("F07: project thumbnail scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function edit(doc: ProjectDoc, name: string): ProjectDoc {
    return { ...doc, name };
  }

  it("writes the first change right away, then at most once per 30 s with the latest state", async () => {
    const writes: string[] = [];
    const scheduler = createProjectThumbnailScheduler((doc) => writes.push(doc.name));
    const doc = createDoc();

    scheduler.update(edit(doc, "a"));
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toEqual(["a"]);

    scheduler.update(edit(doc, "b"));
    await vi.advanceTimersByTimeAsync(10_000);
    scheduler.update(edit(doc, "c"));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(writes).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toEqual(["a", "c"]);

    // Nothing changed since: no write.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(writes).toEqual(["a", "c"]);
    scheduler.dispose();
  });

  it("writes the previous project's pending state when another project opens", async () => {
    const writes: string[] = [];
    const scheduler = createProjectThumbnailScheduler((doc) =>
      writes.push(`${doc.id}:${doc.name}`),
    );
    const first = createDoc({ id: "first" });
    const second = createDoc({ id: "second" });

    scheduler.update(edit(first, "a"));
    await vi.advanceTimersByTimeAsync(0);
    scheduler.update(edit(first, "b"));
    await vi.advanceTimersByTimeAsync(5_000);
    scheduler.update(second);
    expect(writes).toEqual(["first:a", "first:b"]);
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toEqual(["first:a", "first:b", "second:Untitled presentation"]);
    scheduler.dispose();
  });

  it("dispose drops a pending write", async () => {
    const write = vi.fn();
    const scheduler = createProjectThumbnailScheduler(write);
    const doc = createDoc();
    scheduler.update(doc);
    await vi.advanceTimersByTimeAsync(0);
    scheduler.update(edit(doc, "later"));
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
