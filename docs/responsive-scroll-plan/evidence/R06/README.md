# R06: owner review and visual baselines

**Status: approved.** The owner approved the stills and baselines on 19 October 2026 (below).

## Contact sheet

![Responsive Scroll contact sheet](sheet_responsive-scroll.webp)

`npm run contact-sheet -- --templates responsive-scroll --aspects 16:9,4:3,1:1,4:5,9:16 --times 0.5,2.05,3.6,6.4,8.45 --out …` renders through the export path. The frames are in `sheet/`, and `sheet/index.html` shows them at full size.

Rows are 16:9, 4:3, 1:1, 4:5 and 9:16. Columns are times in the 9.4 s loop:

| Time   | What both screens show                            |
| ------ | ------------------------------------------------- |
| 0.5 s  | Top hold: Aurelia's hero                          |
| 2.05 s | Moving, top → works                               |
| 3.6 s  | Works hold: "Selected Works" at the top           |
| 6.4 s  | Materials hold: "Materiality & Origin" at the top |
| 8.45 s | Monograph hold: "Matter & Silence" at the top     |

The wrap crossfade runs 8.58–9.38 s (R04 contact sheet, column 5).

## Baselines proposed (after approval)

Six stills in `tests/visual/stills.spec.ts`, rendered by the Visual baselines workflow on the CI runner:

- `responsive-scroll-<aspect>-t3.6`: the works hold at 16:9, 4:3, 1:1, 4:5 and 9:16. These pin the card geometry per aspect and both screens on the same section.
- `responsive-scroll-16x9-t2.05`: mid-move. This pins the shared timing.

## Decisions (owner, 19 October 2026)

The owner approved the stills and baselines and chose the recommendation on every open decision:

- **Contact sheet:** signed off.
- **Baselines:** the six stills above, rendered by the Visual baselines workflow on the CI runner.
- **Last stop:** as previewed. The last stop holds 1.0 s like the others, and the 0.8 s wrap crossfade falls inside that hold, so the loop is 9.4 s (holds plus moves).
