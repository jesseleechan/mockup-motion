import { describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import { sanitizeDoc } from "../src/doc/validate";

/**
 * GIF export and motion blur were removed (October 2026). A saved project that names them
 * still loads, with an MP4 export and no motion blur setting.
 */
describe("saved projects with removed export options", () => {
  it("load a GIF export as MP4 and drop motion blur", () => {
    const saved = JSON.parse(JSON.stringify(createDoc({ name: "Old export" })));
    saved.export = {
      destination: "custom",
      resolution: 720,
      fps: 24,
      quality: "web",
      format: "gif",
      supersample: 1,
      motionBlur: true,
    };

    const { doc } = sanitizeDoc(saved);

    expect(doc.export).toEqual({
      destination: "custom",
      resolution: 720,
      fps: 24,
      quality: "web",
      format: "mp4",
      supersample: 1,
    });
    expect(doc.name).toBe("Old export");
  });
});
