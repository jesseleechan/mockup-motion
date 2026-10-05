# AGENTS.md

Instructions for any coding agent working in this repository (Codex, ChatGPT, Claude, Gemini, Cursor, and others).

1. Read **`CLAUDE.md`** first. It holds the commands, hard rules and code style for every agent, not just Claude.
2. The active work is the fix plan: **`docs/fix-plan/README.md`**. Read all of it, including section 3, "Rules for the executor", before changing code. Then do one task from `docs/fix-plan/tasks/`, in the order given.
3. What to build is defined by `docs/plan/contracts.md` (types and APIs) and `docs/plan/quality-bar.md` (look and motion rules).
4. Ignore the `master` branch: it holds an unrelated prototype. Work from `main`.
5. A task is done only when its acceptance criteria are met with evidence committed or in the PR: tests that fail without the fix, rendered stills you looked at, and gate output.
