import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";

/**
 * Music was removed (October 2026), but saved projects still carry a music track and its
 * audio asset. They must keep loading, without the music and without the audio asset coming
 * back as a broken image.
 */
describe("saved projects with music", () => {
  it("drop the music track and the audio asset, and keep everything else", () => {
    const doc = createDoc({ name: "With music" });
    doc.shots[0].layout = { kind: "single", device: "browser", assetId: "shot" };
    const saved = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
    saved.assets = [
      { id: "shot", kind: "image", name: "home.png", mime: "image/png", bytes: 10 },
      {
        id: "music",
        kind: "audio",
        name: "track.mp3",
        mime: "audio/mpeg",
        bytes: 4000,
        durationSec: 12,
        peaks: [0.1, 0.5, 0.9],
      },
    ];
    saved.audio = { assetId: "music", volume: 0.8, fadeIn: 0.5, fadeOut: 1.5, offset: 0 };

    const { doc: loaded } = sanitizeDoc(saved);

    expect(loaded.assets.map((a) => [a.id, a.kind])).toEqual([["shot", "image"]]);
    expect(loaded).not.toHaveProperty("audio");
    expect(loaded.name).toBe("With music");
    expect(loaded.shots[0].layout).toMatchObject({ kind: "single", assetId: "shot" });
  });
});
