import type { FontRef, Style, TextLayer } from "../doc/types";

export interface CuratedFontPair {
  id: string;
  name: string;
  display: FontRef;
  body: FontRef;
}

export const CURATED_FONT_PAIRS: CuratedFontPair[] = [
  {
    id: "inter",
    name: "Inter",
    display: { source: "builtin", family: "Inter Display", weight: 600 },
    body: { source: "builtin", family: "Inter", weight: 400 },
  },
  {
    id: "instrument-serif",
    name: "Instrument Serif / Inter",
    display: { source: "builtin", family: "Instrument Serif", weight: 400 },
    body: { source: "builtin", family: "Inter", weight: 400 },
  },
  {
    id: "fraunces",
    name: "Fraunces / Inter",
    display: { source: "builtin", family: "Fraunces", weight: 600 },
    body: { source: "builtin", family: "Inter", weight: 400 },
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk / Inter",
    display: { source: "builtin", family: "Space Grotesk", weight: 600 },
    body: { source: "builtin", family: "Inter", weight: 400 },
  },
  {
    id: "dm-serif",
    name: "DM Serif Display / DM Sans",
    display: { source: "builtin", family: "DM Serif Display", weight: 400 },
    body: { source: "builtin", family: "DM Sans", weight: 400 },
  },
];

async function getBuiltinFontDef(
  family: string,
): Promise<{ url: string; weight: string; style?: string } | null> {
  switch (family) {
    case "Inter Display":
    case "Inter": {
      const mod = await import(
        "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url"
      );
      return { url: mod.default, weight: "100 900" };
    }
    case "Instrument Serif": {
      const mod = await import(
        "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url"
      );
      return { url: mod.default, weight: "400" };
    }
    case "Fraunces": {
      const mod = await import(
        "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url"
      );
      return { url: mod.default, weight: "100 900" };
    }
    case "Space Grotesk": {
      const mod = await import(
        "@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url"
      );
      return { url: mod.default, weight: "300 700" };
    }
    case "DM Serif Display": {
      const mod = await import(
        "@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url"
      );
      return { url: mod.default, weight: "400" };
    }
    case "DM Sans": {
      const mod = await import(
        "@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url"
      );
      return { url: mod.default, weight: "100 1000" };
    }
    default:
      return null;
  }
}

const loadedFonts = new Set<string>();

/**
 * Loads a built-in font family into the browser's FontFace set on first use.
 */
export async function loadBuiltinFont(family: string): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  const def = await getBuiltinFontDef(family);
  if (!def) return;

  const key = `${family}:${def.weight}`;
  if (loadedFonts.has(key)) return;

  try {
    const face = new FontFace(family, `url(${def.url})`, {
      weight: def.weight,
      style: def.style ?? "normal",
    });
    await face.load();
    document.fonts.add(face);
    loadedFonts.add(key);
  } catch (err) {
    console.warn(`[fonts] Failed to load built-in font ${family}:`, err);
  }
}

/**
 * Parses TrueType/OpenType sfnt font buffer to extract the family name from the 'name' table.
 * Falls back to cleaning up the filename if parsing fails or for WOFF2.
 */
export function parseFontFamily(buffer: ArrayBuffer, fallbackName: string): string {
  const cleanFallback = fallbackName
    .replace(/\.(woff2|woff|ttf|otf)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  try {
    if (buffer.byteLength < 12) return cleanFallback || "Custom Font";

    const view = new DataView(buffer);
    const tag = view.getUint32(0);

    // TrueType / OpenType tags: 0x00010000, 0x4F54544F ('OTTO'), 'true', 'typ1'
    if (tag === 0x00010000 || tag === 0x4f54544f || tag === 0x74727565 || tag === 0x74797031) {
      const numTables = view.getUint16(4);
      let nameTableOffset = 0;
      let nameTableLength = 0;

      for (let i = 0; i < numTables; i++) {
        const offset = 12 + i * 16;
        if (offset + 16 > buffer.byteLength) break;
        const tableTag = view.getUint32(offset);
        if (tableTag === 0x6e616d65) {
          // 'name' table
          nameTableOffset = view.getUint32(offset + 8);
          nameTableLength = view.getUint32(offset + 12);
          break;
        }
      }

      if (nameTableOffset > 0 && nameTableOffset + nameTableLength <= buffer.byteLength) {
        const count = view.getUint16(nameTableOffset + 2);
        const stringOffset = nameTableOffset + view.getUint16(nameTableOffset + 4);

        let candidateFamily = "";

        for (let i = 0; i < count; i++) {
          const rec = nameTableOffset + 6 + i * 12;
          if (rec + 12 > nameTableOffset + nameTableLength) break;

          const platformID = view.getUint16(rec + 0);
          const encodingID = view.getUint16(rec + 2);
          const nameID = view.getUint16(rec + 6);
          const length = view.getUint16(rec + 8);
          const strOffset = stringOffset + view.getUint16(rec + 10);

          if (strOffset + length > buffer.byteLength) continue;

          // nameID 16 = Typographic Family (preferred), nameID 1 = Font Family
          if (nameID === 1 || nameID === 16) {
            let str = "";
            if (platformID === 3) {
              // Windows: UTF-16BE
              for (let k = 0; k < length; k += 2) {
                str += String.fromCharCode(view.getUint16(strOffset + k));
              }
            } else if (platformID === 1 && encodingID === 0) {
              // Mac Roman
              for (let k = 0; k < length; k++) {
                str += String.fromCharCode(view.getUint8(strOffset + k));
              }
            } else if (platformID === 0) {
              // Unicode
              for (let k = 0; k < length; k += 2) {
                str += String.fromCharCode(view.getUint16(strOffset + k));
              }
            }

            str = str.trim();
            if (str) {
              if (nameID === 16) return str;
              candidateFamily = str;
            }
          }
        }

        if (candidateFamily) return candidateFamily;
      }
    }

    return cleanFallback || "Custom Font";
  } catch {
    return cleanFallback || "Custom Font";
  }
}

/**
 * Loads a user-supplied font into document.fonts from an ArrayBuffer or Blob.
 */
export async function loadUserFont(
  family: string,
  data: ArrayBuffer | Blob,
): Promise<FontFace | null> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return null;
  }

  const key = `user:${family}`;
  if (loadedFonts.has(key)) return null;

  try {
    const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
    const face = new FontFace(family, buffer);
    await face.load();
    document.fonts.add(face);
    loadedFonts.add(key);
    return face;
  } catch (err) {
    console.warn(`[fonts] Failed to load user font ${family}:`, err);
    return null;
  }
}

/**
 * Ensures that all font faces required by the style and text layers are loaded.
 */
export async function ensureFonts(
  style: Style,
  layers?: TextLayer[],
  getAssetBlob?: (assetId: string) => Promise<Blob | null>,
): Promise<void> {
  const promises: Promise<unknown>[] = [];

  const neededFonts: FontRef[] = [style.fonts.display, style.fonts.body];
  if (layers) {
    for (const l of layers) {
      const f = l.font === "display" ? style.fonts.display : style.fonts.body;
      neededFonts.push(f);
    }
  }

  for (const font of neededFonts) {
    if (font.source === "builtin") {
      promises.push(loadBuiltinFont(font.family));
    } else if (font.source === "asset" && getAssetBlob) {
      promises.push(
        (async () => {
          const blob = await getAssetBlob(font.family);
          if (blob) {
            await loadUserFont(font.family, blob);
          }
        })(),
      );
    }
  }

  await Promise.all(promises);
}
