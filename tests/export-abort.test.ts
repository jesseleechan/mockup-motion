import { describe, expect, it } from "vitest";
import { createDoc, defaultShot } from "../src/doc/defaults";
import type { AssetProvider } from "../src/engine/Engine";
import { exportWithEngine } from "../src/export/engine-export";

describe("exportWithEngine cancellation", () => {
  it("rejects with AbortError when cancelled while images are being prepared", async () => {
    const controller = new AbortController();
    const doc = createDoc({
      shots: [defaultShot({ kind: "single", device: "browser", assetId: "asset-1" })],
    });
    const provider: AssetProvider = {
      async getImage() {
        // The user presses Cancel while the export is still decoding images.
        controller.abort();
        return {} as ImageBitmap;
      },
      async getText() {
        throw new Error("No text layers in this document");
      },
    };

    const result = exportWithEngine(
      doc,
      provider,
      {
        destination: "web-embed",
        resolution: 360,
        fps: 30,
        quality: "web",
        format: "webm",
        supersample: 1,
        motionBlur: false,
      },
      controller.signal,
    );

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
