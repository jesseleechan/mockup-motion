import { afterEach, describe, expect, it, vi } from "vitest";
import { createDoc } from "../src/doc/defaults";
import type { AssetRef, ProjectDoc } from "../src/doc/types";
import {
  firstRunGalleryDone,
  isEmptyProject,
  openOnStart,
  watchFirstRunGallery,
  type ProjectSource,
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

function source(projects: ProjectDoc[]): ProjectSource {
  return {
    listProjects: async () => projects.map((p) => ({ id: p.id })),
    loadProject: async (id) => projects.find((p) => p.id === id) ?? null,
  };
}

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

describe("Start: the last project, or the gallery", () => {
  it("counts a project without screenshots or a template as empty", () => {
    expect(isEmptyProject(createDoc())).toBe(true);
    expect(isEmptyProject(createDoc({ assets: [desktop] }))).toBe(false);
    expect(isEmptyProject(createDoc({ templateId: "desktop-slider" }))).toBe(false);
  });

  it("opens the gallery over the new project when nothing is saved", async () => {
    await openOnStart(source([]));
    expect(galleryState()).toEqual({ templateGalleryOpen: true, firstRunGallery: true });
  });

  it("reopens the most recent saved project, without the gallery", async () => {
    const recent = createDoc({ name: "Portfolio", templateId: "desktop-slider" });
    const older = createDoc({ name: "Old" });
    await openOnStart(source([recent, older]));
    expect(useEditorStore.getState().doc.id).toBe(recent.id);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("opens the gallery when the saved projects can't be read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await openOnStart({
      listProjects: async () => {
        throw new Error("blocked");
      },
      loadProject: async () => null,
    });
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
    expect(galleryState()).toEqual({ templateGalleryOpen: true, firstRunGallery: true });
  });

  it("leaves a user who already started alone", async () => {
    const recent = createDoc({ name: "Portfolio" });
    let release: () => void = () => {};
    const slow: ProjectSource = {
      listProjects: () =>
        new Promise((resolve) => {
          release = () => resolve([{ id: recent.id }]);
        }),
      loadProject: async () => recent,
    };
    const starting = openOnStart(slow);
    await useEditorStore.getState().addAssets([desktop]);
    release();
    await starting;
    expect(useEditorStore.getState().doc.assets.map((a) => a.id)).toEqual(["home"]);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });
});

describe("The gallery the editor opened steps aside", () => {
  it("once the project gets content", async () => {
    stop = watchFirstRunGallery();
    useUIStore.getState().openFirstRunGallery();
    await useEditorStore.getState().addAssets([desktop]);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("when another project is opened, even an empty one", () => {
    const prev = createDoc();
    const next = createDoc();
    expect(firstRunGalleryDone(prev, prev)).toBe(false);
    expect(firstRunGalleryDone(prev, next)).toBe(true);

    stop = watchFirstRunGallery();
    useUIStore.getState().openFirstRunGallery();
    useEditorStore.getState().loadDoc(next);
    expect(galleryState()).toEqual({ templateGalleryOpen: false, firstRunGallery: false });
  });

  it("but leaves a gallery the user opened alone", async () => {
    stop = watchFirstRunGallery();
    useUIStore.getState().openTemplateGallery();
    await useEditorStore.getState().addAssets([desktop]);
    expect(galleryState()).toEqual({ templateGalleryOpen: true, firstRunGallery: false });
  });
});
