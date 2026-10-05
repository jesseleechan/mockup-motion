import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

if (fs.existsSync("/opt/pw-browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}

const chrome =
  process.platform === "win32" &&
  fs.existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
const executablePath = process.env.PW_CHROMIUM_EXECUTABLE;
const swiftShaderArgs = [
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

export default defineConfig({
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      testDir: "./tests/e2e",
      use: {
        ...devices["Desktop Chrome"],
        channel: chrome ? "chrome" : undefined,
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
          args: swiftShaderArgs,
        },
      },
    },
    {
      name: "visual",
      testDir: "./tests/visual",
      use: {
        viewport: { width: 900, height: 900 },
        deviceScaleFactor: 1,
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
          args: swiftShaderArgs,
        },
      },
    },
    {
      name: "perf",
      testDir: "./tests/perf",
      use: {
        ...devices["Desktop Chrome"],
        channel: chrome ? "chrome" : undefined,
        launchOptions: {
          ...(executablePath ? { executablePath } : {}),
          args: swiftShaderArgs,
        },
      },
    },
  ],
});
