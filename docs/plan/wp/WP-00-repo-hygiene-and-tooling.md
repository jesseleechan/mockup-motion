# WP-00: Repo hygiene and tooling

**Milestone:** M1 · **Depends on:** none · **Unblocks:** everything · **Size:** S

## Goal

Get the repository into a state where several agents can work in parallel safely: real linting, a modern test runner, CI on every PR, self-hosted fonts, no scaffold leftovers, and the shared contract types in place.

## Context (read first)

- `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `metadata.json`, `tests/core.test.ts`
- `docs/plan/contracts.md` §2 (you will copy it into code)
- `docs/plan/audit.md` §4

## Scope

**In**

1. **Remove scaffold leftovers.** Delete `metadata.json`. In `vite.config.ts`, remove the `DISABLE_HMR` block and comments, and point the `@` alias at `src/`. In `tsconfig.json`, remove `experimentalDecorators`, `useDefineForClassFields`, and `allowJs`, set `"paths": { "@/*": ["./src/*"] }`, and keep `strict`.
2. **Testing.** Add `vitest`. Move `tests/core.test.ts` to Vitest syntax (`describe`/`it`/`expect`), keeping the same assertions. Configure `environment: "node"` by default and allow `// @vitest-environment jsdom` per file. Scripts: `test` (`vitest run`) and `test:watch`.
3. **Linting.** Add an ESLint flat config with `typescript-eslint` (recommended-type-checked where fast enough, otherwise recommended), `eslint-plugin-react-hooks`, and `eslint-plugin-react-refresh`. Script: `lint` = `eslint .`. Fix or suppress, with a reason, every existing violation. Do not refactor legacy code beyond what lint requires.
4. **Formatting.** Add `.prettierrc` (defaults, `printWidth: 100`) and a `format:check` script.
5. **Fonts.** Add `@fontsource-variable/inter`, import it in `src/main.tsx`, and remove the Google Fonts `<link>` tags from `index.html`. Fix the meta description copy: "Turn website screenshots into elegant presentation videos. Rendered on your device."
6. **Contracts.** Create `src/doc/types.ts` with the TypeScript from `contracts.md` §2 copied verbatim. Add `src/doc/index.ts` re-exporting it. Nothing uses it yet.
7. **CI.** Add `.github/workflows/ci.yml`: Node 22, `npm ci`, then `typecheck`, `lint`, `test`, and `build` on `pull_request` and pushes to `main`.
8. **PR template.** Add `.github/pull_request_template.md` with sections: Summary, WP, Acceptance criteria evidence, Quality-bar checklist (for visual work, copied from `quality-bar.md` §8), Follow-ups.
9. **`.nvmrc`** with `22`.

**Out:** any behavior change to the app; adding three.js or other runtime dependencies (later WPs add their own).

## Acceptance criteria

- [ ] `npm ci && npm run typecheck && npm run lint && npm test && npm run build` passes locally and in CI.
- [ ] The app behaves exactly as before (smoke test: load the demo, switch presets, export a PNG).
- [ ] No network requests to `fonts.googleapis.com` or `fonts.gstatic.com` (check the Playwright request log).
- [ ] `src/doc/types.ts` matches `contracts.md` §2 exactly (diff the code block against the file).
- [ ] The CI workflow runs on the PR and is green.

## Verification

Attach the CI run link and the request log excerpt to the PR.
