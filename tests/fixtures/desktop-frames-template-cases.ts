import type { Aspect, AssetRef } from "../../src/doc/types";
import { buildTemplate, framesTemplate } from "../../src/templates";

// The Desktop Frames template golden (PF03). `record-desktop-frames-template.ts` wrote the
// documents of the `frames` template before it moved onto the `framesTemplate(spec)` factory in
// `src/templates/frames-template.ts`, and `tests/mobile-frames.test.ts` compares today's
// documents with that file exactly.

const ASPECTS: Aspect[] = ["16:9", "9:16", "1:1", "4:5", "4:3"];

const desktop = (n: number): AssetRef => ({
  id: `d${n}`,
  kind: "image",
  name: `Desktop ${n}`,
  mime: "image/png",
  bytes: 100,
  width: 1440,
  height: 900,
  role: "desktop",
});

/** The built Frames document for N = 4, 5, 6 at every aspect, without the random shot ids. */
export function desktopFramesDocs(): Record<string, unknown> {
  const docs: Record<string, unknown> = {};
  for (const aspect of ASPECTS) {
    for (const count of [4, 5, 6]) {
      const assets = Array.from({ length: count }, (_, i) => desktop(i + 1));
      const built = buildTemplate(framesTemplate, { aspect, assets, name: "Frames" });
      const shots = built.shots.map((shot) => ({ ...shot, id: "shot" }));
      docs[`${aspect} N=${count}`] = { ...built, shots };
    }
  }
  return docs;
}
