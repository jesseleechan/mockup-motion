import { afterEach, describe, expect, it } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { AssetRef } from "../src/doc/types";
import {
  firstRunGalleryDone,
  isEmptyProject,
  startFirstRunGallery,
} from "../src/editor/first-run-gallery";
import { useEditorStore } from "../src/state/store";
import { useUIStore } from "../src/state/ui-store";

const desktop: AssetRef = {
  id: "home",
  kind: "image",
  name: "home.png",
  mime: "image/png",
  bytes: 1000,
  role: "desktop",
};

let stop: (() => void) | undefined;

afterEach(() => {
  stop?.();
  stop = undefined;
  useUIStore.getState().closeTemplateGallery();
  useEditorStore.getState().loadDoc(createDoc());
});

function galleryState() {
  const { templateGalleryOpen, firstRunGallery } = useUIStore.getState();
  return { templateGalleryOpen, firstRunGallery };
}

describe("First run: the editor opens on the gallery", () => {
  it("counts a project without screenshots or a template as empty", () => {
    expect(isEmptyProject(createDoc())).toBe(true);
    expect(isEmptyProject(createDoc({ assets: [desktop] }))).toBe(false);
    expect(isEmptyProject(createDoc({ templateId: "desktop-slider" }))).toBe(false);
  });

  it("opens the gallery over an empty project", () => {
    stop = startFirstRunGallery();
    expect(galleryState()).toEqual({ templateGalleryOpen: true, firstRunGallery: true });
  });

  it("stays closed when the editor starts on a project with content", () => {
    useEditorStore.getState().loadDoc(createDoc({ templateId: "desktop-slider" }));
    stop = startFirstRunGallery();
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("steps aside once the project gets content", async () => {
    stop = startFirstRunGallery();
    await useEditorStore.getState().addAssets([desktop]);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("steps aside when another project is opened, even an empty one", () => {
    const prev = createDoc();
    const next = createDoc();
    expect(firstRunGalleryDone(prev, prev)).toBe(false);
    expect(firstRunGalleryDone(prev, next)).toBe(true);

    stop = startFirstRunGallery();
    useEditorStore.getState().loadDoc(next);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("leaves a gallery the user opened alone", async () => {
    stop = startFirstRunGallery();
    useUIStore.getState().openTemplateGallery();
    await useEditorStore.getState().addAssets([desktop]);
    expect(galleryState()).toEqual({ templateGalleryOpen: true, firstRunGallery: false });
  });
});
