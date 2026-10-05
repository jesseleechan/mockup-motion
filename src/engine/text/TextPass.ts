import * as THREE from "three";
import type { Aspect, TextLayer } from "../../doc/types";
import type { ShotFrame } from "../../motion";
import type { TextRaster } from "../../text/rasterize";

const textVertexShader = /* glsl */ `
  attribute vec2 aLocalUv;
  varying vec2 vUv;
  varying vec2 vClipUv;

  void main() {
    vUv = uv;
    vClipUv = aLocalUv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const textFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform float uOpacity;
  uniform float uBlur;
  uniform float uClip;
  uniform vec2 uTexelSize;

  varying vec2 vUv;
  varying vec2 vClipUv;

  void main() {
    // Keep the bottom portion first, then move the boundary upward.
    if (uClip > 0.001 && vClipUv.y < uClip) {
      discard;
    }

    vec4 color;
    if (uBlur <= 0.001) {
      color = texture2D(uTexture, vUv);
    } else {
      // 9-tap Gaussian blur kernel scaled by uBlur
      vec2 b = uTexelSize * uBlur;
      vec4 sum = vec4(0.0);

      sum += texture2D(uTexture, vUv) * 0.25;

      sum += texture2D(uTexture, vUv + vec2( b.x,  0.0)) * 0.125;
      sum += texture2D(uTexture, vUv + vec2(-b.x,  0.0)) * 0.125;
      sum += texture2D(uTexture, vUv + vec2( 0.0,  b.y)) * 0.125;
      sum += texture2D(uTexture, vUv + vec2( 0.0, -b.y)) * 0.125;

      sum += texture2D(uTexture, vUv + vec2( b.x,  b.y)) * 0.0625;
      sum += texture2D(uTexture, vUv + vec2(-b.x,  b.y)) * 0.0625;
      sum += texture2D(uTexture, vUv + vec2( b.x, -b.y)) * 0.0625;
      sum += texture2D(uTexture, vUv + vec2(-b.x, -b.y)) * 0.0625;

      color = sum;
    }

    float alpha = color.a * uOpacity;
    gl_FragColor = vec4(color.rgb * alpha, alpha);
  }
`;

interface WordMeshItem {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
}

export class TextPass {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private textures = new Map<string, THREE.Texture>();
  private meshPool: WordMeshItem[] = [];

  constructor() {
    this.scene = new THREE.Scene();
    // Default 1x1 screen coordinates, resized during render
    this.camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);
  }

  /**
   * Sets or updates pre-rasterized text bitmap texture.
   */
  setTextRaster(layerId: string, raster: TextRaster): void {
    let tex = this.textures.get(layerId);
    if (!tex) {
      tex = new THREE.Texture(raster.bitmap);
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      this.textures.set(layerId, tex);
    } else {
      tex.image = raster.bitmap;
    }
    tex.needsUpdate = true;
  }

  private getOrCreateMesh(index: number): WordMeshItem {
    if (index < this.meshPool.length) {
      return this.meshPool[index];
    }

    const geometry = new THREE.BufferGeometry();
    // 4 vertices (quad)
    const positions = new Float32Array(12);
    const uvs = new Float32Array(8);
    const localUvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    const indices = new Uint16Array([0, 1, 2, 2, 3, 0]);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("aLocalUv", new THREE.BufferAttribute(localUvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader: textVertexShader,
      fragmentShader: textFragmentShader,
      uniforms: {
        uTexture: { value: null },
        uOpacity: { value: 1.0 },
        uBlur: { value: 0.0 },
        uClip: { value: 0.0 },
        uTexelSize: { value: new THREE.Vector2(1, 1) },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);

    const item: WordMeshItem = { mesh, material, geometry };
    this.meshPool.push(item);
    return item;
  }

  /**
   * Renders screen-space text overlay for the current shot frame.
   */
  render(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget,
    frame: ShotFrame,
    layers: TextLayer[],
    rasters: Map<string, TextRaster>,
    aspect: Aspect,
    renderW: number,
    renderH: number,
  ): void {
    if (!frame.texts || frame.texts.length === 0 || layers.length === 0) {
      return;
    }

    // Configure orthographic camera matching target pixel resolution (0,0 top-left)
    this.camera.left = 0;
    this.camera.right = renderW;
    this.camera.top = 0;
    this.camera.bottom = renderH;
    this.camera.near = 0.1;
    this.camera.far = 100;
    this.camera.position.set(0, 0, 10);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    // Hide all pooled meshes initially
    for (const item of this.meshPool) {
      item.mesh.visible = false;
    }

    // Safe margins per quality-bar §4 & §7:
    // At least 7% of shortest frame side.
    // For vertical formats (9:16, 4:5): keep inside central 80% of height (10% top/bottom).
    const margin = Math.round(0.07 * Math.min(renderW, renderH));
    const isVertical = aspect === "9:16" || aspect === "4:5";
    const minY = isVertical ? Math.round(renderH * 0.10) : margin;
    const maxY = isVertical ? Math.round(renderH * 0.90) : renderH - margin;
    const minX = margin;
    const maxX = renderW - margin;

    let poolIdx = 0;

    for (const textFrame of frame.texts) {
      const layer = layers.find((l) => l.id === textFrame.layerId);
      if (!layer || !layer.text.trim()) continue;

      const raster = rasters.get(layer.id);
      if (!raster) continue;

      let tex = this.textures.get(layer.id);
      if (!tex) {
        this.setTextRaster(layer.id, raster);
        tex = this.textures.get(layer.id)!;
      }

      // Calculate block position based on layer.anchor
      let blockX = minX;
      let blockY = minY;

      const anchor = layer.anchor ?? "center";

      // Horizontal anchoring
      if (anchor === "top-left" || anchor === "left" || anchor === "bottom-left") {
        blockX = minX;
      } else if (anchor === "top" || anchor === "center" || anchor === "bottom") {
        blockX = Math.round((renderW - raster.width) / 2);
      } else if (anchor === "top-right" || anchor === "right" || anchor === "bottom-right") {
        blockX = maxX - raster.width;
      }

      // Vertical anchoring
      if (anchor === "top-left" || anchor === "top" || anchor === "top-right") {
        blockY = minY;
      } else if (anchor === "left" || anchor === "center" || anchor === "right") {
        blockY = Math.round((renderH - raster.height) / 2);
      } else if (anchor === "bottom-left" || anchor === "bottom" || anchor === "bottom-right") {
        blockY = maxY - raster.height;
      }

      // Clamp within safe margins
      blockX = Math.max(minX, Math.min(maxX - raster.width, blockX));
      blockY = Math.max(minY, Math.min(maxY - raster.height, blockY));

      const texelSize = new THREE.Vector2(1 / raster.width, 1 / raster.height);

      // Render each word
      const wordCount = Math.min(raster.words.length, textFrame.words.length);
      for (let i = 0; i < wordCount; i++) {
        const wordBox = raster.words[i];
        const wordFrame = textFrame.words[i];

        if (wordFrame.opacity <= 0.001 || textFrame.opacity <= 0.001) {
          continue;
        }

        const item = this.getOrCreateMesh(poolIdx++);
        item.mesh.visible = true;

        const dyPx = (wordFrame.dy / 100) * renderH;
        const wx0 = blockX + wordBox.x;
        const wy0 = blockY + wordBox.y + dyPx;
        const wx1 = wx0 + wordBox.w;
        const wy1 = wy0 + wordBox.h;

        // In Three.js orthographic coordinates with top=0, bottom=H:
        // Position buffer
        const pos = item.geometry.attributes.position as THREE.BufferAttribute;
        pos.setXYZ(0, wx0, wy0, 0);
        pos.setXYZ(1, wx1, wy0, 0);
        pos.setXYZ(2, wx1, wy1, 0);
        pos.setXYZ(3, wx0, wy1, 0);
        pos.needsUpdate = true;

        // Texture UVs preserve the top-down bitmap row order.
        const u0 = wordBox.x / raster.width;
        const u1 = (wordBox.x + wordBox.w) / raster.width;
        const v0 = wordBox.y / raster.height;
        const v1 = (wordBox.y + wordBox.h) / raster.height;

        const uvs = item.geometry.attributes.uv as THREE.BufferAttribute;
        uvs.setXY(0, u0, v0);
        uvs.setXY(1, u1, v0);
        uvs.setXY(2, u1, v1);
        uvs.setXY(3, u0, v1);
        uvs.needsUpdate = true;

        // Set uniforms
        const uniforms = item.material.uniforms;
        uniforms.uTexture.value = tex;
        uniforms.uOpacity.value = wordFrame.opacity * textFrame.opacity;
        uniforms.uBlur.value = wordFrame.blur ?? 0.0;
        uniforms.uClip.value = wordFrame.clip ?? 0.0;
        uniforms.uTexelSize.value = texelSize;
      }
    }

    if (poolIdx > 0) {
      const prevTarget = renderer.getRenderTarget();
      const prevAutoClear = renderer.autoClear;

      renderer.setRenderTarget(target);
      renderer.autoClear = false;
      renderer.render(this.scene, this.camera);

      renderer.autoClear = prevAutoClear;
      renderer.setRenderTarget(prevTarget);
    }
  }

  dispose(): void {
    for (const tex of this.textures.values()) {
      tex.dispose();
    }
    this.textures.clear();

    for (const item of this.meshPool) {
      item.geometry.dispose();
      item.material.dispose();
      this.scene.remove(item.mesh);
    }
    this.meshPool = [];
  }
}
