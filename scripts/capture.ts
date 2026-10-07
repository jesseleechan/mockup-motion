import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

export interface CaptureOptions {
  url: string;
  outDir?: string;
  desktopWidth?: number;
  mobileWidth?: number;
  scale?: number;
  mode?: 'full' | 'viewport' | 'both';
  hide?: string;
  waitMs?: number;
  unstick?: boolean;
}

export interface SectionBoundary {
  tag: string;
  id?: string;
  className?: string;
  top: number;
  height: number;
}

export interface CaptureMetadata {
  url: string;
  viewportWidth: number;
  scale: number;
  pageHeight: number;
  sections: SectionBoundary[];
}

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

export async function preparePage(
  page: Page,
  options: { hide?: string; unstick?: boolean; waitMs?: number },
): Promise<void> {
  // Inject style to kill animations, transitions, and carets
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });

  // Hide requested selectors if any
  if (options.hide) {
    const hideCss = `${options.hide} { display: none !important; }`;
    await page.addStyleTag({ content: hideCss });
  }

  // Auto-scroll the page down to trigger lazy loaders and back to top
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let current = 0;
      const step = 400;
      const maxScroll = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
      );
      const interval = setInterval(() => {
        window.scrollBy(0, step);
        current += step;
        if (current >= maxScroll) {
          clearInterval(interval);
          window.scrollTo(0, 0);
          resolve();
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
      const targets = Array.from(document.querySelectorAll('*'))
        .map((el) => ({ el: el as HTMLElement, position: window.getComputedStyle(el).position }))
        .filter((t) => t.position === 'fixed' || t.position === 'sticky')
        .map((t) => ({ ...t, rect: t.el.getBoundingClientRect() }));

      for (const { el, position, rect } of targets) {
        if (rect.top + window.scrollY > vh) {
          el.style.setProperty('position', 'static', 'important');
        } else if (position === 'sticky') {
          // At scroll 0 a sticky element sits at its in-flow position, which is exactly
          // `relative` with no offset. `absolute` would pull it out of the flow, shrink it to
          // fit its content and slide the page up underneath it (the F12 header bug).
          el.style.setProperty('position', 'relative', 'important');
          el.style.setProperty('top', 'auto', 'important');
          el.style.setProperty('bottom', 'auto', 'important');
        } else {
          // Fixed elements are already out of the flow. Pin them at their current page
          // position and size so they do not repeat down the full page.
          // offsetParent is null for fixed elements, so find the absolute containing block.
          let parent = el.parentElement;
          while (parent && parent !== document.body && window.getComputedStyle(parent).position === 'static') {
            parent = parent.parentElement;
          }
          let originX = 0;
          let originY = 0;
          if (parent && window.getComputedStyle(parent).position !== 'static') {
            const parentRect = parent.getBoundingClientRect();
            originX = parentRect.left + window.scrollX + parent.clientLeft;
            originY = parentRect.top + window.scrollY + parent.clientTop;
          }
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('box-sizing', 'border-box', 'important');
          el.style.setProperty('margin', '0', 'important');
          el.style.setProperty('top', `${rect.top + window.scrollY - originY}px`, 'important');
          el.style.setProperty('left', `${rect.left + window.scrollX - originX}px`, 'important');
          el.style.setProperty('right', 'auto', 'important');
          el.style.setProperty('bottom', 'auto', 'important');
          el.style.setProperty('width', `${rect.width}px`, 'important');
        }
      }
    });
  }

  if (options.waitMs && options.waitMs > 0) {
    await page.waitForTimeout(options.waitMs);
  }
}

export async function recordSectionBoundaries(
  page: Page,
  viewportWidth: number,
  scale: number,
): Promise<CaptureMetadata> {
  return await page.evaluate(
    ({ vw, sc }) => {
      // Find top-level section, header, footer, or main > *
      const candidates = Array.from(
        document.querySelectorAll('header, section, footer, main > *, body > section, body > div[id]'),
      );
      const seen = new Set<Element>();
      const sections: {
        tag: string;
        id?: string;
        className?: string;
        top: number;
        height: number;
      }[] = [];

      for (const el of candidates) {
        if (seen.has(el)) continue;
        // Make sure it is not nested inside another candidate
        let parent = el.parentElement;
        let isNested = false;
        while (parent && parent !== document.body && parent.tagName !== 'MAIN') {
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
        pageHeight: Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
        ),
        sections,
      };
    },
    { vw: viewportWidth, sc: scale },
  );
}

export function getBrowserLaunchOptions() {
  const isWinChrome = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  return {
    headless: true,
    channel: isWinChrome ? 'chrome' : undefined,
  };
}

export async function captureUrl(options: CaptureOptions): Promise<{
  desktopFiles: string[];
  mobileFiles: string[];
  metadata: Record<string, CaptureMetadata>;
}> {
  const outDir = options.outDir || 'captures';
  fs.mkdirSync(outDir, { recursive: true });

  const desktopWidth = options.desktopWidth ?? 1440;
  const mobileWidth = options.mobileWidth ?? 390;
  const scale = options.scale ?? 2;
  const mode = options.mode ?? 'both';

  let host = 'capture';
  try {
    const parsed = new URL(options.url);
    host = parsed.hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    if (parsed.port) host += `_${parsed.port}`;
    if (parsed.pathname && parsed.pathname !== '/') {
      const slug = parsed.pathname.replace(/[^a-zA-Z0-9_-]/g, '_');
      host += `_${slug}`;
    }
  } catch {
    // fallback
  }

  const browser: Browser = await chromium.launch(getBrowserLaunchOptions());
  const desktopFiles: string[] = [];
  const mobileFiles: string[] = [];
  const metadata: Record<string, CaptureMetadata> = {};

  try {
    // 1. Desktop Capture
    {
      const context = await browser.newContext({
        viewport: { width: desktopWidth, height: 900 },
        deviceScaleFactor: scale,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30000 });
      await preparePage(page, {
        hide: options.hide,
        unstick: options.unstick,
        waitMs: options.waitMs,
      });

      const meta = await recordSectionBoundaries(page, desktopWidth, scale);
      metadata['desktop'] = meta;
      const jsonFile = path.join(outDir, `${host}-desktop-${desktopWidth}.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(meta, null, 2), 'utf-8');
      desktopFiles.push(jsonFile);

      if (mode === 'viewport' || mode === 'both') {
        const vpFile = path.join(outDir, `${host}-desktop-${desktopWidth}.png`);
        await page.screenshot({ path: vpFile, fullPage: false });
        desktopFiles.push(vpFile);
      }
      if (mode === 'full' || mode === 'both') {
        const fullFile = path.join(outDir, `${host}-desktop-${desktopWidth}-full.png`);
        await page.screenshot({ path: fullFile, fullPage: true });
        desktopFiles.push(fullFile);
      }
      await context.close();
    }

    // 2. Mobile Capture
    {
      const context = await browser.newContext({
        viewport: { width: mobileWidth, height: 844 },
        deviceScaleFactor: scale,
        reducedMotion: 'reduce',
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      await page.goto(options.url, { waitUntil: 'networkidle', timeout: 30000 });
      await preparePage(page, {
        hide: options.hide,
        unstick: options.unstick,
        waitMs: options.waitMs,
      });

      const meta = await recordSectionBoundaries(page, mobileWidth, scale);
      metadata['mobile'] = meta;
      const jsonFile = path.join(outDir, `${host}-mobile-${mobileWidth}@2x.json`);
      fs.writeFileSync(jsonFile, JSON.stringify(meta, null, 2), 'utf-8');
      mobileFiles.push(jsonFile);

      if (mode === 'viewport' || mode === 'both') {
        const vpFile = path.join(outDir, `${host}-mobile-${mobileWidth}@2x.png`);
        await page.screenshot({ path: vpFile, fullPage: false });
        mobileFiles.push(vpFile);
      }
      if (mode === 'full' || mode === 'both') {
        const fullFile = path.join(outDir, `${host}-mobile-${mobileWidth}@2x-full.png`);
        await page.screenshot({ path: fullFile, fullPage: true });
        mobileFiles.push(fullFile);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  return { desktopFiles, mobileFiles, metadata };
}

// CLI runner
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run capture -- <url> [options]

Options:
  --out <dir>           Output directory (default: captures/)
  --desktop <width>     Desktop viewport width (default: 1440)
  --mobile <width>      Mobile viewport width (default: 390)
  --scale <factor>      Device scale factor (default: 2)
  --mode <mode>         Capture mode: full | viewport | both (default: both)
  --hide "<selectors>"  CSS selectors to hide
  --wait <ms>           Milliseconds to wait after ready
  --unstick             Convert position:fixed/sticky to static after first viewport
`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  const url = args[0];
  const options: CaptureOptions = { url };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' && i + 1 < args.length) {
      options.outDir = args[++i];
    } else if (arg === '--desktop' && i + 1 < args.length) {
      options.desktopWidth = parseInt(args[++i], 10);
    } else if (arg === '--mobile' && i + 1 < args.length) {
      options.mobileWidth = parseInt(args[++i], 10);
    } else if (arg === '--scale' && i + 1 < args.length) {
      options.scale = parseFloat(args[++i]);
    } else if (arg === '--mode' && i + 1 < args.length) {
      options.mode = args[++i] as 'full' | 'viewport' | 'both';
    } else if (arg === '--hide' && i + 1 < args.length) {
      options.hide = args[++i];
    } else if (arg === '--wait' && i + 1 < args.length) {
      options.waitMs = parseInt(args[++i], 10);
    } else if (arg === '--unstick') {
      options.unstick = true;
    }
  }

  console.log(`[Capture] Launching capture for: ${url}`);
  const result = await captureUrl(options);
  console.log(`[Capture] Complete!`);
  console.log('Desktop output:', result.desktopFiles);
  console.log('Mobile output:', result.mobileFiles);
}

// Only run if invoked directly from CLI
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('[Capture Error]', err);
    process.exit(1);
  });
}
