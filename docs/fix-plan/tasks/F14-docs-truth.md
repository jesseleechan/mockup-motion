# F14: Make docs and statuses truthful

**Size:** S · **Depends on:** all other tasks

## Why

The previous run marked every work package "Complete". `docs/plan/quality-review.md` ticks every quality-bar box ("Colors use unlit materials, sRGB textures…"), and `docs/plan/browser-matrix.md` reports "No blocking issue", all without anyone looking at the output. Future agents and the user rely on these docs.

## Required changes

1. **`docs/plan/README.md` WP table:** set each WP's status to "Done (fixed in Fxx)" with links, or "Done" where no fix was needed. Only do this after the F-tasks are merged.
2. **Rewrite `docs/plan/quality-review.md`** from the F11 contact sheet. For each template, record each §8 checklist item with a one-line observation and a link to its still.
3. **`docs/plan/browser-matrix.md`:** keep only rows and columns that were actually run, with the date and version. Mark every other cell "Not tested". If the user can run Safari and Firefox, list the exact steps for them.
4. **`README.md` (the user guide):** check every claim against the app (templates, export destinations, web-embed bundle, capture CLI, music). Remove or fix anything untrue.
5. **`CLAUDE.md` and `AGENTS.md`:** make sure the commands, the browser-override note (F00) and the pointer to `docs/fix-plan/` are current.

## Acceptance criteria

- [ ] Every status, checkbox and claim in these docs links to evidence (a test, a still or a CI run).
- [ ] `grep -rn "Complete" docs/plan/README.md` returns nothing that lacks an evidence link.
