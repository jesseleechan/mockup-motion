# PF00: Record the decisions in the quality bar and contracts

**Size:** S · **Depends on:** nothing (the owner decided D1–D13 on 8 October 2026) · **Docs only**

## Why

The quality bar and contracts are the source of truth for every later task. Mobile Frames, the columns fields and the shrinking gallery must be written down there before any code changes, as P00 did for the presets plan.

## Context

- `docs/phone-frames-plan/README.md` §1–§3.
- `docs/plan/quality-bar.md` §2.2 (durations), §2.5 (the Frames speed exception), §3.4 (card radius), §4 (Marquee and wall, Frames).
- `docs/plan/contracts.md` §2 (the `Layout` union and its comments), §5 (Frames loops natively), §8 (templates).

## Required changes

1. **Decisions.** The plan README already records the owner's answers (§2). Copy nothing; link to it from the quality bar where a rule comes from a decision.
2. **`contracts.md` §2.** Add the optional columns fields to the `Layout` union, mirroring rows:
   `{ kind: "columns"; assetIds; columns: 2 | 3 | 4 | 5; tilt; speed; device?: "phone" | "card"; cardWidth?: number; gap?: number; travel?: "steps" | "period" }`.
   Comment: unset fields are today's behaviour (a tilted phone marquee). `cardWidth` is in stage units; with `device: "card"` the card is portrait at the phone screen aspect 0.4615. `travel: "period"` is the rows rule turned 90°.
3. **`contracts.md` §5.** Generalise the Frames paragraph to "Frames (`rows` or `columns` with `travel: "period"`)". Say that both layouts share one lane function, that `framesDuration` and `framesAssetIds` take either layout, and that column c starts c / columns of a period along.
4. **`quality-bar.md` §2.2 and §2.5.** Frames now names both layouts. The 0.20 limit is in stage units per second along the motion axis (D6). Give the 30 s caps for columns: 9 screenshots at 16:9, 4:3 and 1:1, and 10 at 4:5 and 9:16.
5. **`quality-bar.md` §4.** Rename the Frames bullet to "Desktop Frames" (unchanged values) and add a "Mobile Frames" bullet with the §3 table: column counts, card sizes, margins or crop, gap, direction (column 0 moves up), offsets, the passing-columns exception, and "needs 4 screenshots".
6. **`quality-bar.md` §3.4.** Say that a portrait card in a columns layout uses the same 7.5% radius as the Mobile Slider's.
7. **`contracts.md` §8.** Update the template list to the five that remain: Desktop Slider, Mobile Slider, Desktop Frames, Mobile Frames, Scroll Story.

## Acceptance criteria

- [ ] Every number in §3 of the plan README appears once in `quality-bar.md` §4, and the README links to it instead of repeating it after this PR. Or, if you keep the table in the README, say which file is authoritative.
- [ ] `contracts.md` and `quality-bar.md` agree with each other and with D5–D8 (a reviewer can check this line by line).
- [ ] `quality-bar.md` and `contracts.md` name the five remaining templates (D2, D12) and Mobile Frames (D3).
- [ ] Docs-only PR: `unit` and `visual` green, `e2e` reports "not run" (no trigger path touched).
