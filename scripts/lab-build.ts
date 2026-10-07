/**
 * Shared by the scripts that render through `/lab` (template previews, contact sheet):
 * a production build with the lab enabled, a static server for it, and a SwiftShader
 * browser launched the same way as playwright.config.ts.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { build } from "vite";

const WINDOWS_CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/** Builds the app with the lab enabled into `outDir` (a scratch directory, never dist/). */
export async function buildLab(outDir: string): Promise<void> {
  process.env.VITE_LAB = "1";
  await build({ logLevel: "warn", build: { outDir, emptyOutDir: true } });
}

/** Serves a build; extensionless paths (`/lab`) fall back to index.html like any SPA host. */
export function serveBuild(root: string, port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    let filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      if (path.extname(pathname) !== "") {
        res.writeHead(404, { "Content-Type": "text/plain" }).end(`Not found: ${pathname}`);
        return;
      }
      filePath = path.join(root, "index.html");
    }
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (!type) {
      res.writeHead(500, { "Content-Type": "text/plain" }).end(`No MIME type for ${filePath}`);
      return;
    }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve(server));
  });
}

/**
 * Same browser choice as playwright.config.ts: an explicit executable, else installed
 * Chrome on Windows, else Playwright's Chromium; WebGL through SwiftShader.
 */
export function launchSwiftShader(): Promise<Browser> {
  const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
  const useChrome = process.platform === "win32" && fs.existsSync(WINDOWS_CHROME);
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : useChrome ? { channel: "chrome" } : {}),
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
    ],
  });
}
