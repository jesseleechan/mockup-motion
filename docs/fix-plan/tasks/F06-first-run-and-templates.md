# F06: First run and template flow

**Size:** S · **Depends on:** F05

## Bugs

1. **"Start with a template" does nothing.** In `src/editor/EditorShell.tsx:285-288`, `onOpenTemplates` only toggles the Library panel when it is closed, and it is open by default. The e2e test `polish.spec.ts:19` ("first run opens the template gallery") fails.
2. After a template is applied with no screenshots, the stage shows dark empty screens with no guidance. The empty-state condition in `Stage.tsx:242` only checks `doc.assets.length === 0 && !doc.templateId`.
3. "Try with demo content" loads a fixed asset set that ignores the current template's slots.

## Required changes

1. **Gallery state** moves to the UI store (`src/state/ui-store.ts`): `templateGalleryOpen: boolean`, `openTemplateGallery()`, `closeTemplateGallery()`.
   - Render `TemplateGalleryModal` **once**, in `EditorShell`.
   - The Stage empty-state button, the Library "Browse all templates" button and the top-bar project menu all call `openTemplateGallery()`.
2. **"Fill this template" overlay.** When `doc.templateId` is set and any **required** slot of that template has no asset (use `fillSlots`), show a non-blocking overlay at the bottom-centre of the stage. Copy: "Add screenshots to fill this template", with the buttons "Choose screenshots" and "Use demo content". It disappears once all required slots are filled.
3. **Template-aware demo content:** "Use demo content" and "Try with demo content" pick assets from the F04 demo map that satisfy the current template's slots (desktop, mobile and tall roles). Add them, then re-run `applyTemplate` so the slots fill, all as **one** undo step.
4. **Applying a template from the gallery** keeps the existing assets and brand style (`ctx.style`), fills the slots, closes the modal and selects the first shot.

## Tests

- `polish.spec.ts:19` passes **unchanged**.
- New e2e test: first run → "Start with a template" → pick "Responsive Pair" → apply → the overlay is visible → "Use demo content" → the overlay disappears → both screens show content (pixel check: the screen centres are not the empty fill colour) → Undo removes the demo assets in one step.

## Acceptance criteria

- [ ] Both tests pass. Reverting change 1 makes `polish.spec.ts:19` fail again (paste the output).
- [ ] Commit screenshots of the first-run sheet, the gallery and the fill overlay under `docs/fix-plan/evidence/F06/`.
