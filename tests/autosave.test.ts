import { describe, expect, it, vi } from "vitest";
import { createEditorStore, setupAutosave } from "../src/state/store";

// Every save fails the way IndexedDB does when the origin's quota is full.
vi.mock("../src/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/storage")>()),
  saveProject: () =>
    Promise.reject(new DOMException("The quota has been exceeded.", "QuotaExceededError")),
}));

describe("autosave", () => {
  it("reports a full storage quota as a calm error and keeps the document", async () => {
    const store = createEditorStore();
    const stop = setupAutosave(store, 0);
    store.getState().apply(
      (doc) => {
        doc.name = "Quota check";
      },
      { label: "Rename" },
    );
    await vi.waitFor(() => expect(store.getState().saveStatus).toBe("error"));
    expect(store.getState().saveError).toBe("Not enough storage space.");
    expect(store.getState().doc.name).toBe("Quota check");
    stop();
  });
});
