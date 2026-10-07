/**
 * GitHub's ubuntu-latest runner renders SwiftShader about 5x slower than a laptop (measured
 * across F07–F12 CI runs). Timing tests scale their waits by this factor on CI. They never
 * change what they assert, only how long they wait for it.
 */
export const CI_SLOWDOWN = process.env.CI ? 5 : 1;

/** A wait in milliseconds, scaled for the CI runner. */
export function ciTimeout(ms: number): number {
  return ms * CI_SLOWDOWN;
}
