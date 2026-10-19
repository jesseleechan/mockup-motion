import type { Browser, Page } from "playwright";

export interface CaptureOptions {
  url: string;
  outDir?: string;
  desktopWidth?: number;
  mobileWidth?: number;
  scale?: number;
  mode?: "full" | "viewport" | "both";
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

/** The JSON file written next to each screenshot. */
export interface CaptureMetadata {
  url: string;
  viewportWidth: number;
  scale: number;
  pageHeight: number;
  sections: SectionBoundary[];
}

export interface CaptureResult {
  desktopFiles: string[];
  mobileFiles: string[];
  metadata: Record<string, CaptureMetadata>;
}

export type ParsedArgs =
  { help: true; exitCode: number } | { help: false; options: CaptureOptions };

export declare const USAGE: string;
export declare function parseArgs(args: string[]): ParsedArgs;

export declare const MISSING_BROWSER_MESSAGE: string;
export declare class BrowserNotFoundError extends Error {
  constructor();
}
export declare function isMissingBrowserError(err: unknown): boolean;
export declare function getBrowserLaunchOptions(): {
  headless: boolean;
  channel: string | undefined;
};
export declare function launchBrowser(): Promise<Browser>;

export declare function hostSlug(url: string): string;
export declare function captureBaseNames(
  host: string,
  desktopWidth: number,
  mobileWidth: number,
): { desktop: string; mobile: string };

export declare function preparePage(
  page: Page,
  options: { hide?: string; unstick?: boolean; waitMs?: number },
): Promise<void>;
export declare function recordSectionBoundaries(
  page: Page,
  viewportWidth: number,
  scale: number,
): Promise<CaptureMetadata>;

export declare function captureUrl(options: CaptureOptions): Promise<CaptureResult>;

/** Runs the command line with the arguments after the script path; resolves to the exit code. */
export declare function main(args: string[]): Promise<number>;
