# R03 evidence: Responsive Scroll motion

Motion only; R04 renders it. `tests/responsive-scroll.test.ts`, 19 tests:

| Check                                                                                                                                                    | Test                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Card sizes per aspect match the plan's table, 1.6 and 0.4615 screens, the pair centred inside 0.86 × 0.86, side by side or stacked                       | `<aspect>: card sizes, centred pair inside the safe margin` (5) |
| Two card nodes at the desktop and phone screen aspects                                                                                                   | `emits two cards …`                                             |
| Aurelia's default stops are works, materials and monograph (the preview's)                                                                               | `defaults to the top and three spread-out shared sections …`    |
| Aurelia loops in 9.38 s (4 × 1 s holds + 2.11 + 1.88 + 1.39 s moves); the shot is 0.8 s longer for the wrap crossfade                                    | `loops in 9.4 s for Aurelia …`                                  |
| Both screens hold with the same section at the top during every hold (desktop 0 / 1664 / 2409 / 3088 px, mobile 0 / 3204 / 6066 / 8178 image px)         | `holds both screens with the same section …`                    |
| No move beats 0.9 screen heights per second on average, measured by sampling the motion every millisecond; the screen that travels further sets the pace | `never beats 0.9 screen heights per second …`                   |
| Scroll never decreases within the shot                                                                                                                   | `never scrolls back within the shot`                            |
| Without section data on both screens: the same 0, ⅓, ⅔, 1 fractions of each page                                                                         | `falls back to the same fractions …`                            |
| Named sections; keys a page lacks are ignored; out-of-order keys that would reverse are dropped                                                          | `stops on the sections the spec names …`                        |
| A section a page can't scroll to the top stops at the page's bottom                                                                                      | `stops at the bottom of a page …`                               |
| A shot fits in 30 s                                                                                                                                      | `fits in 30 s by leaving out the last stops`                    |
| `evaluate` sets both screens' scroll                                                                                                                     | `evaluates both screens to the scroll motion …`                 |
| frame(total) ≡ frame(0); through the crossfade the outgoing screens hold the last stop and the incoming the top                                          | `loops by the wrap crossfade, inside the last hold …`           |
| Shot length from the stops, still camera, user-set length without scroll                                                                                 | `sets the shot length from the stops …`                         |
| Layout and section stops survive validation                                                                                                              | `keeps the layout and section stops through validation`         |

Shown failing with the change reverted:

- `evaluate` wiring removed: 2 failed (`evaluates both screens …`, `loops by the wrap crossfade …`).
- Pace set by the screen that travels less (min instead of max): 4 failed, including the measured speed test.
- No wrap overlap: 3 failed (`loops in 9.4 s …`, `loops by the wrap crossfade …`, `sets the shot length …`).
- Stop direction ignored: 1 failed (`stops on the sections the spec names …`, the out-of-order case).

## Timing note

A looping single shot shows `duration − 0.8` s and its wrap crossfade covers the 0.8 s before the loop point (contracts.md §5). With `duration = holds + moves` the fade would start during the last move. So the shot lasts holds + moves + 0.8 s: the loop is holds + moves (9.4 s for Aurelia, as previewed), and the fade falls inside the last 1.0 s hold.
