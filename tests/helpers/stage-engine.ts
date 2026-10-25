import { expect, type Page } from "@playwright/test";
import type { Engine } from "../../src/engine/Engine";
import { ciTimeout } from "./ci";

/**
 * Waits until the stage engine has drawn the editor's current document. Call it once the
 * document under test is in the store.
 *
 * The stage lazy-loads its engine (`EngineCanvas` in `src/editor/stage/Stage.tsx`), and the
 * engine then loads every screenshot the document shows before its first frame. Under local
 * SwiftShader that frame came 3.5–6.8 s after a template's "Use demo content" click, and about
 * 5x later on the CI runner (`tests/helpers/ci.ts`). Dev builds set `window.__editorEngine`
 * once that frame is drawn, and `Engine.getCurrentDoc()` is the document the engine last swapped
 * in and drew, so the store's document is on the stage when the two are the same object.
 *
 * Setup for the checks that follow, which keep their own timeouts. The poll returns what it is
 * still waiting for, so a timeout says which.
 */
export async function waitForStageEngine(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const hooks = window as unknown as {
            __editorEngine?: Pick<Engine, "getCurrentDoc">;
            __editorStore?: { getState: () => { doc: unknown } };
          };
          if (!hooks.__editorStore) return "__editorStore is unavailable";
          if (!hooks.__editorEngine) return "the stage engine is not ready";
          return hooks.__editorEngine.getCurrentDoc() === hooks.__editorStore.getState().doc
            ? "drawn"
            : "the engine has not drawn the current document";
        }),
      { timeout: ciTimeout(15_000), message: "the stage engine draws the editor's document" },
    )
    .toBe("drawn");
}
