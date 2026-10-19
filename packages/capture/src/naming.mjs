/**
 * File names the capture writes. The editor reads them back (src/assets/capture-json.ts), so a
 * change here is a change to the capture format.
 */

/**
 * The file name prefix for a URL: host, port and path, with unsafe characters replaced by `_`.
 * `http://localhost:8765/aurelia/` becomes `localhost_8765__aurelia_`.
 *
 * @param {string} url
 * @returns {string}
 */
export function hostSlug(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_err) {
    // Not a URL Node can parse: Playwright reports the real problem when it navigates.
    return "capture";
  }
  let host = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
  if (parsed.port) host += `_${parsed.port}`;
  if (parsed.pathname && parsed.pathname !== "/") {
    const slug = parsed.pathname.replace(/[^a-zA-Z0-9_-]/g, "_");
    host += `_${slug}`;
  }
  return host;
}

/**
 * The base names (without `.json`, `.png` or `-full.png`) for one capture.
 * The mobile name says `@2x` whatever `--scale` is, as the capture always has.
 *
 * @param {string} host
 * @param {number} desktopWidth
 * @param {number} mobileWidth
 * @returns {{ desktop: string, mobile: string }}
 */
export function captureBaseNames(host, desktopWidth, mobileWidth) {
  return {
    desktop: `${host}-desktop-${desktopWidth}`,
    mobile: `${host}-mobile-${mobileWidth}@2x`,
  };
}
