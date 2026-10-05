/**
 * Seeded 32-bit PRNG using Mulberry32.
 * Returns a function generating deterministic pseudorandom numbers in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic hash of two numbers returning an unsigned 32-bit integer.
 */
export function hash2(a: number, b: number): number {
  let h = Math.imul(a >>> 0, 0x9e3779b9) ^ Math.imul(b >>> 0, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
