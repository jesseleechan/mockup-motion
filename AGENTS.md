# AGENTS.md

Instructions for any coding agent working in this repository (Codex, ChatGPT, Claude, Gemini, Cursor, and others).

1. Read **`CLAUDE.md`** first. It holds the commands, hard rules and code style for every agent, not just Claude.
2. The fix plan, **`docs/fix-plan/README.md`**, is complete (F00–F14). Read its section 3, "Rules for the executor", before changing code: those rules still apply. Open work is listed in `docs/plan/follow-ups.md`.
3. What to build is defined by `docs/plan/contracts.md` (types and APIs) and `docs/plan/quality-bar.md` (look and motion rules).
4. Ignore the `master` branch: it holds an unrelated prototype. Work from `main`.
5. A task is done only when its acceptance criteria are met with evidence committed or in the PR: tests that fail without the fix, rendered stills you looked at, gate output, and green `unit`, `e2e` and `visual` CI checks. `e2e` runs the Playwright suite only when the PR touches an e2e trigger path (listed in CLAUDE.md and `scripts/e2e-paths.ts`); `main` and the nightly run always run it.
6. Visual baselines are Linux-only, and changing them needs the project owner's approval. See `tests/visual/README.md`.
