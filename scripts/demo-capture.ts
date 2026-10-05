import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { getBrowserLaunchOptions, preparePage, recordSectionBoundaries } from './capture';

const SITES = [
  { id: 'aurelia', name: 'Aurelia' },
  { id: 'northwind', name: 'Northwind' },
  { id: 'maison-oak', name: 'Maison Oak' },
  { id: 'field-notes', name: 'Field Notes' },
  { id: 'studio-kova', name: 'Studio Kova' },
];

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function startServer(root: string, port = 3456): Promise<http.Server> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURI(req.url || '/').split('?')[0];
      if (reqPath === '/' || !reqPath) reqPath = '/index.html';

      // Map root fonts to demo-sites/fonts
      let filePath = path.join(root, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`Not found: ${reqPath}`);
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

export interface DemoManifestEntry {
  site: string;
  file: string;
  role: 'hero' | 'full';
  tall: boolean;
  width: number;
  height: number;
  category: 'desktop' | 'mobile';
  sizeBytes: number;
}

export async function runDemoCapture() {
  const rootDir = path.resolve('demo-sites');
  const publicDemoDir = path.resolve('public/demo');
  fs.mkdirSync(publicDemoDir, { recursive: true });

  const port = 3591;
  const server = await startServer(rootDir, port);
  console.log(`[Demo Capture] Local server listening on http://localhost:${port}`);

  const browser = await chromium.launch(getBrowserLaunchOptions());
  const manifest: DemoManifestEntry[] = [];
  let totalBytes = 0;

  try {
    for (const site of SITES) {
      console.log(`\n=============================================`);
      console.log(`[Demo Capture] Processing: ${site.name} (${site.id})`);
      console.log(`=============================================`);

      const siteDir = path.join(publicDemoDir, site.id);
      fs.mkdirSync(siteDir, { recursive: true });

      const siteUrl = `http://localhost:${port}/${site.id}/`;

      // 1. Desktop captures
      // A. Desktop Hero (1440 × 900 @2x)
      {
        const ctx = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
        });
        const page = await ctx.newPage();
        await page.goto(siteUrl, { waitUntil: 'networkidle' });
        await preparePage(page, { unstick: false });

        const rawPng = await page.screenshot({ fullPage: false });
        const heroWebpPath = path.join(siteDir, 'desktop-hero.webp');
        await sharp(rawPng).webp({ quality: 92 }).toFile(heroWebpPath);

        const meta = await sharp(heroWebpPath).metadata();
        const stat = fs.statSync(heroWebpPath);
        totalBytes += stat.size;

        manifest.push({
          site: site.id,
          file: `${site.id}/desktop-hero.webp`,
          role: 'hero',
          tall: false,
          width: meta.width || 2880,
          height: meta.height || 1800,
          category: 'desktop',
          sizeBytes: stat.size,
        });
        console.log(`  -> Saved desktop-hero.webp: ${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB`);
        await ctx.close();
      }

      // B. Desktop Full (1440 wide @1x)
      {
        const ctx = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        });
        const page = await ctx.newPage();
        await page.goto(siteUrl, { waitUntil: 'networkidle' });
        await preparePage(page, { unstick: true });

        // Record sections
        const sectionsData = await recordSectionBoundaries(page, 1440, 1);
        fs.writeFileSync(
          path.join(siteDir, 'sections.json'),
          JSON.stringify(sectionsData, null, 2),
          'utf-8',
        );
        console.log(`  -> Recorded ${sectionsData.sections.length} sections in sections.json`);

        const rawPng = await page.screenshot({ fullPage: true });
        const fullWebpPath = path.join(siteDir, 'desktop-full.webp');
        await sharp(rawPng).webp({ quality: 92 }).toFile(fullWebpPath);

        const meta = await sharp(fullWebpPath).metadata();
        const stat = fs.statSync(fullWebpPath);
        totalBytes += stat.size;

        manifest.push({
          site: site.id,
          file: `${site.id}/desktop-full.webp`,
          role: 'full',
          tall: true,
          width: meta.width || 1440,
          height: meta.height || 3000,
          category: 'desktop',
          sizeBytes: stat.size,
        });
        console.log(`  -> Saved desktop-full.webp: ${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB`);
        await ctx.close();
      }

      // 2. Mobile captures
      // A. Mobile Hero (390 × 844 @2x)
      {
        const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await page.goto(siteUrl, { waitUntil: 'networkidle' });
        await preparePage(page, { unstick: false });

        const rawPng = await page.screenshot({ fullPage: false });
        const heroWebpPath = path.join(siteDir, 'mobile-hero.webp');
        await sharp(rawPng).webp({ quality: 92 }).toFile(heroWebpPath);

        const meta = await sharp(heroWebpPath).metadata();
        const stat = fs.statSync(heroWebpPath);
        totalBytes += stat.size;

        manifest.push({
          site: site.id,
          file: `${site.id}/mobile-hero.webp`,
          role: 'hero',
          tall: false,
          width: meta.width || 780,
          height: meta.height || 1688,
          category: 'mobile',
          sizeBytes: stat.size,
        });
        console.log(`  -> Saved mobile-hero.webp: ${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB`);
        await ctx.close();
      }

      // B. Mobile Full (390 wide @2x)
      {
        const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          reducedMotion: 'reduce',
          isMobile: true,
          hasTouch: true,
        });
        const page = await ctx.newPage();
        await page.goto(siteUrl, { waitUntil: 'networkidle' });
        await preparePage(page, { unstick: true });

        const rawPng = await page.screenshot({ fullPage: true });
        const fullWebpPath = path.join(siteDir, 'mobile-full.webp');
        await sharp(rawPng).webp({ quality: 92 }).toFile(fullWebpPath);

        const meta = await sharp(fullWebpPath).metadata();
        const stat = fs.statSync(fullWebpPath);
        totalBytes += stat.size;

        manifest.push({
          site: site.id,
          file: `${site.id}/mobile-full.webp`,
          role: 'full',
          tall: true,
          width: meta.width || 780,
          height: meta.height || 5000,
          category: 'mobile',
          sizeBytes: stat.size,
        });
        console.log(`  -> Saved mobile-full.webp: ${meta.width}x${meta.height}, ${(stat.size / 1024).toFixed(1)} KB`);
        await ctx.close();
      }
    }

    // Write manifest.json
    const manifestPath = path.join(publicDemoDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`\n=============================================`);
    console.log(`[Demo Capture] Manifest written to: ${manifestPath}`);
    console.log(`[Demo Capture] Total assets captured: ${manifest.length}`);
    console.log(`[Demo Capture] Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB (Budget: <= 14 MB)`);
    console.log(`=============================================\n`);
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  runDemoCapture().catch((err) => {
    console.error('[Demo Capture Error]', err);
    process.exit(1);
  });
}
