import * as THREE from "three";
import type { ManagedTexture } from "../textures/TextureManager";
import { createTopLeftQuad, createTopLeftQuadSubrange } from "../geometry/quads";
import { PHONE_STATUS_BAR } from "../../motion/phone-spec";
import { createStatusBarTexture, statusBarTone } from "../devices/status-bar";

export interface ScreenPageOptions {
  hasStatusBar?: boolean;
  isPhone?: boolean;
}

// A screen with no screenshot, and the fill under a short screenshot whose bottom row is unknown.
const EMPTY_COLOR = 0x18181b;
const SHORT_FILL_COLOR = 0x1e1e21;

/**
 * One screenshot drawn into a screen's target (ScreenCompositor): its texture strips fit to the
 * target's width and scrolled, the fill under a short screenshot (quality bar §3.1) and, on a
 * phone, the status bar (§3.3). The target's camera has y up, from 0 at the bottom.
 *
 * `offsetPx` moves the page sideways, for a screen that draws two screenshots (contracts.md §4).
 * The status bar's glyphs are the phone's, not the page's, so they stay put; the compositor clips
 * each page to its band of the screen, so each page's glyphs show only over that page.
 */
export class ScreenPage {
  readonly scene = new THREE.Scene();

  private stripMeshes: THREE.Mesh[] = [];
  private fillMesh: THREE.Mesh;
  // A screenshot's own status bar, pinned while the page scrolls.
  private statusBarMesh: THREE.Mesh;
  // A phone's own status bar for screenshots without one: the page's top colour and the glyphs.
  private statusFillMesh: THREE.Mesh;
  private statusGlyphMesh: THREE.Mesh;
  private statusGlyphKey = "";

  constructor() {
    // Default fill quad for blank screens or short image bottoms
    const fillMat = new THREE.MeshBasicMaterial({ color: SHORT_FILL_COLOR });
    this.fillMesh = new THREE.Mesh(createTopLeftQuad(), fillMat);
    this.fillMesh.visible = false;
    this.scene.add(this.fillMesh);

    const sbMat = new THREE.MeshBasicMaterial({ transparent: true });
    this.statusBarMesh = new THREE.Mesh(createTopLeftQuadSubrange(0), sbMat);
    this.statusBarMesh.visible = false;
    this.scene.add(this.statusBarMesh);

    this.statusFillMesh = new THREE.Mesh(createTopLeftQuad(), new THREE.MeshBasicMaterial());
    // The target has no depth buffer and three.js draws opaque meshes front to back, so the
    // page strips would paint over the bar; renderOrder draws it after them.
    this.statusFillMesh.renderOrder = 1;
    this.statusFillMesh.visible = false;
    this.scene.add(this.statusFillMesh);
    this.statusGlyphMesh = new THREE.Mesh(
      createTopLeftQuad(),
      new THREE.MeshBasicMaterial({ transparent: true }),
    );
    this.statusGlyphMesh.renderOrder = 2;
    this.statusGlyphMesh.visible = false;
    this.scene.add(this.statusGlyphMesh);
  }

  /**
   * Lays the page out in a `widthPx` × `heightPx` target, its left edge at `offsetPx`:
   * `managed` fit to the width and scrolled to `scroll` (0..1 of its scrollable range), or the
   * empty-state fill when there is no screenshot.
   */
  layout(
    managed: ManagedTexture | null,
    scroll: number,
    widthPx: number,
    heightPx: number,
    offsetPx: number,
    options?: ScreenPageOptions,
  ): void {
    if (!managed || managed.strips.length === 0) {
      for (const mesh of this.stripMeshes) mesh.visible = false;
      // Empty state
      this.fillMesh.visible = true;
      this.fillMesh.scale.set(widthPx, heightPx, 1);
      this.fillMesh.position.set(offsetPx, 0, 0);
      (this.fillMesh.material as THREE.MeshBasicMaterial).color.set(EMPTY_COLOR);
      this.statusBarMesh.visible = false;
      this.statusFillMesh.visible = false;
      this.statusGlyphMesh.visible = false;
      return;
    }

    const scaleFactor = widthPx / managed.width;
    const totalRenderedHeight = managed.height * scaleFactor;
    // Quality-bar §3.3: on a phone, a screenshot without a status bar starts below the phone's own.
    const statusBarPx = options?.isPhone ? Math.round(heightPx * PHONE_STATUS_BAR) : 0;
    const insetPx = options?.isPhone && !options.hasStatusBar ? statusBarPx : 0;
    const viewportPx = heightPx - insetPx;
    const scrollablePx = Math.max(0, totalRenderedHeight - viewportPx);
    const scrollY = scroll * scrollablePx;

    // Keep one mesh and material per texture strip; scrolling only changes transforms.
    while (this.stripMeshes.length < managed.strips.length) {
      const strip = managed.strips[this.stripMeshes.length];
      const material = new THREE.MeshBasicMaterial({ map: strip.texture, transparent: false });
      const mesh = new THREE.Mesh(createTopLeftQuad(), material);
      this.stripMeshes.push(mesh);
      this.scene.add(mesh);
    }
    for (let index = 0; index < this.stripMeshes.length; index++) {
      const mesh = this.stripMeshes[index];
      if (index >= managed.strips.length) {
        mesh.visible = false;
        continue;
      }
      const strip = managed.strips[index];
      (mesh.material as THREE.MeshBasicMaterial).map = strip.texture;
      const stripY = insetPx + strip.yOffset * scaleFactor - scrollY;
      const stripH = strip.height * scaleFactor;

      // Check visibility within viewport [0, heightPx]
      if (stripY + stripH < 0 || stripY > heightPx) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      mesh.scale.set(widthPx, stripH, 1);
      // In Three Orthographic camera top is heightPx, so y starts at heightPx - stripY - stripH
      mesh.position.set(offsetPx, heightPx - stripY - stripH, 0);
    }

    // Fill bottom if screenshot is shorter than viewport
    if (totalRenderedHeight < viewportPx) {
      this.fillMesh.visible = true;
      const fillHeight = viewportPx - totalRenderedHeight;
      this.fillMesh.scale.set(widthPx, fillHeight, 1);
      this.fillMesh.position.set(offsetPx, 0, 0);

      const color = managed.bottomRowColor;
      if (color) {
        (this.fillMesh.material as THREE.MeshBasicMaterial).color.setRGB(
          color[0],
          color[1],
          color[2],
          THREE.SRGBColorSpace,
        );
      } else {
        (this.fillMesh.material as THREE.MeshBasicMaterial).color.set(SHORT_FILL_COLOR);
      }
    } else {
      this.fillMesh.visible = false;
    }

    this.layoutStatusBar(managed, widthPx, heightPx, insetPx, offsetPx);

    // A screenshot's own status bar stays pinned while the page scrolls
    if (options?.isPhone && options?.hasStatusBar && scrollY > 0 && managed.strips.length > 0) {
      const sbHeight = statusBarPx;
      const firstStrip = managed.strips[0];
      const sbSourcePx = sbHeight / scaleFactor;
      const vMax = Math.min(1, sbSourcePx / firstStrip.height);
      const sbPosition = this.statusBarMesh.geometry.attributes.position;
      const sbUv = this.statusBarMesh.geometry.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < sbPosition.count; i++) {
        sbUv.setY(i, sbPosition.getY(i) > 0 ? 0 : vMax);
      }
      sbUv.needsUpdate = true;
      const mat = this.statusBarMesh.material as THREE.MeshBasicMaterial;
      mat.map = firstStrip.texture;
      mat.transparent = true;
      this.statusBarMesh.visible = true;
      this.statusBarMesh.scale.set(widthPx, sbHeight, 1);
      this.statusBarMesh.position.set(offsetPx, heightPx - sbHeight, 0.2);
    } else {
      this.statusBarMesh.visible = false;
    }
  }

  /**
   * The phone's status bar over the top `barPx` of the screen: the page's top colour, which moves
   * with the page, and the glyphs, which stay put.
   */
  private layoutStatusBar(
    managed: ManagedTexture,
    widthPx: number,
    heightPx: number,
    barPx: number,
    offsetPx: number,
  ): void {
    if (barPx <= 0) {
      this.statusFillMesh.visible = false;
      this.statusGlyphMesh.visible = false;
      return;
    }
    const top = managed.topRowColor ?? [1, 1, 1, 1];
    const fill = this.statusFillMesh.material as THREE.MeshBasicMaterial;
    fill.color.setRGB(top[0], top[1], top[2], THREE.SRGBColorSpace);
    this.statusFillMesh.visible = true;
    this.statusFillMesh.scale.set(widthPx, barPx, 1);
    this.statusFillMesh.position.set(offsetPx, heightPx - barPx, 0.15);

    const tone = statusBarTone([top[0], top[1], top[2]]);
    const key = `${widthPx}x${barPx}:${tone}`;
    const glyphs = this.statusGlyphMesh.material as THREE.MeshBasicMaterial;
    if (key !== this.statusGlyphKey) {
      glyphs.map?.dispose();
      glyphs.map = createStatusBarTexture(widthPx, barPx, tone);
      glyphs.needsUpdate = true;
      this.statusGlyphKey = key;
    }
    this.statusGlyphMesh.visible = glyphs.map !== null;
    this.statusGlyphMesh.scale.set(widthPx, barPx, 1);
    this.statusGlyphMesh.position.set(0, heightPx - barPx, 0.2);
  }

  dispose(): void {
    for (const mesh of this.stripMeshes) {
      (mesh.material as THREE.Material).dispose();
    }
    this.stripMeshes = [];
    (this.fillMesh.material as THREE.Material).dispose();
    this.statusBarMesh.geometry.dispose();
    (this.statusBarMesh.material as THREE.Material).dispose();
    (this.statusFillMesh.material as THREE.Material).dispose();
    const glyphs = this.statusGlyphMesh.material as THREE.MeshBasicMaterial;
    glyphs.map?.dispose();
    glyphs.dispose();
  }
}
