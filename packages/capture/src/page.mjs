/**
 * What runs in the captured page: settle it for a still screenshot, then record where its
 * sections are. The functions passed to `page.evaluate` run in the browser, so they must not use
 * anything from this module's scope.
 */

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    animation-duration: 0.001s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`;

/**
 * @param {import("playwright").Page} page
 * @param {{ hide?: string, unstick?: boolean, waitMs?: number }} options
 * @returns {Promise<void>}
 */
export async function preparePage(page, options) {
  // Inject style to kill animations, transitions, and carets
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

  // Hide requested selectors if any
  if (options.hide) {
    const hideCss = `${options.hide} { display: none !important; }`;
    await page.addStyleTag({ content: hideCss });
  }

  // Auto-scroll the page down to trigger lazy loaders and back to top
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let current = 0;
      const step = 400;
      const maxScroll = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const interval = setInterval(() => {
        window.scrollBy(0, step);
        current += step;
        if (current >= maxScroll) {
          clearInterval(interval);
          window.scrollTo(0, 0);
          resolve(undefined);
        }
      }, 40);
    });
  });

  // Wait for fonts
  await page.evaluate(() => document.fonts.ready);

  // Convert fixed/sticky to static after first viewport if unstick is enabled
  if (options.unstick) {
    await page.evaluate(() => {
      const vh = window.innerHeight;
      // Measure everything first so one change cannot shift the next element's rect.
      const targets = Array.from(document.querySelectorAll("*"))
        .map((el) => ({
          el: /** @type {HTMLElement} */ (el),
          position: window.getComputedStyle(el).position,
        }))
        .filter((t) => t.position === "fixed" || t.position === "sticky")
        .map((t) => ({ ...t, rect: t.el.getBoundingClientRect() }));

      for (const { el, position, rect } of targets) {
        if (rect.top + window.scrollY > vh) {
          el.style.setProperty("position", "static", "important");
        } else if (position === "sticky") {
          // At scroll 0 a sticky element sits at its in-flow position, which is exactly
          // `relative` with no offset. `absolute` would pull it out of the flow, shrink it to
          // fit its content and slide the page up underneath it (the F12 header bug).
          el.style.setProperty("position", "relative", "important");
          el.style.setProperty("top", "auto", "important");
          el.style.setProperty("bottom", "auto", "important");
        } else {
          // Fixed elements are already out of the flow. Pin them at their current page
          // position and size so they do not repeat down the full page.
          // offsetParent is null for fixed elements, so find the absolute containing block.
          let parent = el.parentElement;
          while (
            parent &&
            parent !== document.body &&
            window.getComputedStyle(parent).position === "static"
          ) {
            parent = parent.parentElement;
          }
          let originX = 0;
          let originY = 0;
          if (parent && window.getComputedStyle(parent).position !== "static") {
            const parentRect = parent.getBoundingClientRect();
            originX = parentRect.left + window.scrollX + parent.clientLeft;
            originY = parentRect.top + window.scrollY + parent.clientTop;
          }
          el.style.setProperty("position", "absolute", "important");
          el.style.setProperty("box-sizing", "border-box", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("top", `${rect.top + window.scrollY - originY}px`, "important");
          el.style.setProperty("left", `${rect.left + window.scrollX - originX}px`, "important");
          el.style.setProperty("right", "auto", "important");
          el.style.setProperty("bottom", "auto", "important");
          el.style.setProperty("width", `${rect.width}px`, "important");
        }
      }
    });
  }

  if (options.waitMs && options.waitMs > 0) {
    await page.waitForTimeout(options.waitMs);
  }
}

/**
 * @param {import("playwright").Page} page
 * @param {number} viewportWidth
 * @param {number} scale
 * @returns {Promise<import("./index.mjs").CaptureMetadata>}
 */
export async function recordSectionBoundaries(page, viewportWidth, scale) {
  return await page.evaluate(
    ({ vw, sc }) => {
      // Find top-level section, header, footer, or main > *
      const candidates = Array.from(
        document.querySelectorAll(
          "header, section, footer, main > *, body > section, body > div[id]",
        ),
      );
      const seen = new Set();
      /** @type {{ tag: string, id?: string, className?: string, top: number, height: number }[]} */
      const sections = [];

      for (const el of candidates) {
        if (seen.has(el)) continue;
        // Make sure it is not nested inside another candidate
        let parent = el.parentElement;
        let isNested = false;
        while (parent && parent !== document.body && parent.tagName !== "MAIN") {
          if (candidates.includes(parent)) {
            isNested = true;
            break;
          }
          parent = parent.parentElement;
        }
        if (isNested) continue;

        const rect = el.getBoundingClientRect();
        if (rect.height > 10) {
          seen.add(el);
          sections.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || undefined,
            className: el.className ? String(el.className).trim() : undefined,
            top: Math.round(rect.top + window.scrollY),
            height: Math.round(rect.height),
          });
        }
      }

      // Sort by vertical position
      sections.sort((a, b) => a.top - b.top);

      return {
        url: window.location.href,
        viewportWidth: vw,
        scale: sc,
        pageHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        sections,
      };
    },
    { vw: viewportWidth, sc: scale },
  );
}
