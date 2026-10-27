/**
 * Where a line sits in a raster from `rasterizeText`, in em of its font size. The engine lays the
 * rasters out by these: the browser URL pill (quality bar §3.2) and Before & After's labels (§4).
 * No imports, so the engine and the export worker can use them without loading the font.
 */

/** The padding above and below the 1.3 em line. */
export const RASTER_PADDING_Y_EM = 0.2;
/** The padding on each side of the glyphs. */
export const RASTER_SIDE_PADDING_EM = 0.4;
/**
 * Where Inter's capitals and ascenders sit in a raster: from 0.24 em below its top to the
 * baseline at 1.0 em (measured in Chromium), so their middle is 0.62 em down. That is 0.23 em
 * above the raster's middle, so a pill centres the text on this line, not on the raster.
 */
export const RASTER_CAP_MIDDLE_EM = 0.62;
