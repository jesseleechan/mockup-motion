# P04 mutation runs

Each section reverts one guarded behaviour, runs the test that guards it, and restores the code. Every test failed as expected and passed again after the restore. The e2e mutation is at the end.

## period travel replaced by the marquee speed (no native loop)

- Mutated `src/motion/layouts/rows.ts`; ran `npx vitest run tests/frames.test.ts -t "loops natively"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9 N=4: expected [ …(24) ] to deeply equal [ …(24) ]
```

## row directions swapped

- Mutated `src/motion/layouts/rows.ts`; ran `npx vitest run tests/frames.test.ts -t "moves even rows left"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 221955 wrong-way moves: expected [ …(10) ] to deeply equal []
```

## Frames rows half a period apart, as before

- Mutated `src/motion/layouts/rows.ts`; ran `npx vitest run tests/frames.test.ts -t "never lines up a screenshot"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 1300 aligned repeats: expected [ …(10) ] to deeply equal []
```

## Frames limit 0.30 instead of 0.20 frame heights per second

- Mutated `src/motion/layouts/marquee.ts`; ran `npx vitest run tests/frames.test.ts -t "stays at or under 0.20"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9 N=4 duration 10: expected 0.29480000000000217 to be less than or equal to 0.200000001
```

## framesDuration not rounded up to a half second

- Mutated `src/motion/layouts/rows.ts`; ran `npx vitest run tests/frames.test.ts -t "framesDuration is the shortest half second"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9 N=1: expected 7.370000000000001 to be 7 // Object.is equality
```

## card height 0.29 instead of 0.32 on tall frames

- Mutated `src/templates/frames.ts`; ran `npx vitest run tests/frames.test.ts -t "matches the reference composition"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: card width: expected 0.10769230769230775 to be less than 0.03
```

## three rows on wide frames

- Mutated `src/templates/frames.ts`; ran `npx vitest run tests/frames.test.ts -t "uses 3 rows on tall"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9: expected 3 to be 2 // Object.is equality
```

## default gap changed for older rows

- Mutated `src/motion/layouts/rows.ts`; ran `npx vitest run tests/frames.test.ts -t "keeps older rows layouts"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9: expected 0.9386666666666663 to be close to 0.920888888888889, received difference is 0.017777777777777337, but expected 0.0005
```

## Frames wraps with a crossfade

- Mutated `src/templates/frames.ts`; ran `npx vitest run tests/frames.test.ts -t "builds at all five aspects"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: 16:9 N=4: expected 'fade' to be 'cut' // Object.is equality
```

## Frames accepts three screenshots

- Mutated `src/templates/slots.ts`; ran `npx vitest run tests/frames.test.ts -t "dedupes slot assets"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { valid: true } to deeply equal { valid: false, …(1) }
```

## slot assets not deduped

- Mutated `src/templates/frames.ts`; ran `npx vitest run tests/frames.test.ts -t "dedupes slot assets"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected [ [ 'd1', 'd2', 'd3', 'd4', …(2) ] ] to deeply equal [ 'd1', 'd2', 'd3', 'd4' ]
```

## setShotDuration ignores the Frames minimum

- Mutated `src/state/store.ts`; ran `npx vitest run tests/frames.test.ts -t "keeps the shot duration at or above"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 3 to be 17.5 // Object.is equality
```

## adding a screenshot keeps the old duration

- Mutated `src/state/store.ts`; ran `npx vitest run tests/frames.test.ts -t "lengthens the shot"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 14.5 to be 17.5 // Object.is equality
```

## sanitizeDoc drops travel

- Mutated `src/doc/validate.ts`; ran `npx vitest run tests/frames.test.ts -t "keeps valid Frames fields"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { kind: 'rows', …(7) } to deeply equal { kind: 'rows', …(8) }
```

## sanitizeDoc does not clamp cardHeight

- Mutated `src/doc/validate.ts`; ran `npx vitest run tests/frames.test.ts -t "repairs invalid Frames fields"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 14 skipped (15)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected { kind: 'rows', …(7) } to deeply equal { kind: 'rows', …(7) }
```

## Ash palette removed

- Mutated `src/doc/palettes.ts`; ran `npx vitest run tests/palettes.test.ts -t "Built-in palettes satisfy"`.
- Result: FAILED as expected (exit 1).

```
Tests  1 failed | 3 skipped (4)
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 8 to be 9 // Object.is equality
```

## e2e: speed slider kept for Frames

- Mutated `src/editor/inspector/shot/LayoutSection.tsx`; ran `npx playwright test tests/e2e/frames.spec.ts`.
- Result: FAILED as expected (exit 1).

```
Error: expect(locator).toBeVisible() failed
Expected: visible
Error: element(s) not found
1 failed
```

## e2e: duration slider starts at 1 s

- Mutated `src/editor/inspector/shot/EntranceSection.tsx`; ran `npx playwright test tests/e2e/frames.spec.ts`.
- Result: FAILED as expected (exit 1).

```
Error: expect(locator).toHaveAttribute(expected) failed
Expected: "12"
Received: "1"
1 failed
```
