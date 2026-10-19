# S01 evidence: the deck tests can fail

`tests/deck.test.ts` (14 tests) passes on this branch. Each behaviour below was reverted or broken locally in `src/motion/layouts/deck.ts` or `src/doc/validate.ts`, the file was run, and the failing tests were recorded. The source was restored after each run.

```
### depth 4 instead of 3
     × shows the front card and up to two behind it 11ms
      Tests  1 failed | 13 passed (14)
### no exit margin
     × rests with the front card at full size and each card behind 6% smaller, peeking out 30ms
     × sends the front card out of the frame, up on y and left on x, 0.03 past the edge 1ms
      Tests  2 failed | 12 passed (14)
### entering card not faded
     × rests with the front card at full size and each card behind 6% smaller, peeking out 10ms
     × keeps 7% of the shortest frame side clear around the deck at rest 1ms
     × fades in only the card entering the last slot, paired with its move and scale 1ms
      Tests  3 failed | 11 passed (14)
### deck not centred (front card centred, as the reference)
     × rests with the front card at full size and each card behind 6% smaller, peeking out 8ms
     × keeps 7% of the shortest frame side clear around the deck at rest 1ms
      Tests  2 failed | 12 passed (14)
### scale step 0.10
     × rests with the front card at full size and each card behind 6% smaller, peeking out 8ms
      Tests  1 failed | 13 passed (14)
### seam: ring shifted after N steps
     × loops natively: frame(0) equals frame(N × step) 13ms
     × never reverses: every visible card moves only toward the exit and never shrinks 152ms
      Tests  2 failed | 12 passed (14)
### slot 1 overshoots (reversal)
     × rests with the front card at full size and each card behind 6% smaller, peeking out 6ms
     × never reverses: every visible card moves only toward the exit and never shrinks 127ms
     × fades in only the card entering the last slot, paired with its move and scale 2ms
      Tests  3 failed | 11 passed (14)
### front card leaves the wrong way
     × rests with the front card at full size and each card behind 6% smaller, peeking out 11ms
     × sends the front card out of the frame, up on y and left on x, 0.03 past the edge 2ms
     × never reverses: every visible card moves only toward the exit and never shrinks 203ms
      Tests  3 failed | 11 passed (14)
### sanitizer drops deck
     × keeps a valid arrangement and drops an invalid one 15ms
      Tests  1 failed | 13 passed (14)
```

Gates on this branch: typecheck, lint and build pass; `npm test` 42 files, 529 tests passed.
