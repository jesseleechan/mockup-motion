# S00: Plan, reference and decisions

**Size:** S · **Depends on:** —

## Required changes

1. `docs/stack-plan/` (this plan), `reference.md` and the reference strips in `evidence/S00/`.
2. Put D1–D7 to the owner, each with a recommendation. Record their answers in README §2.
3. Once answered, record the rules before any code:
   - `quality-bar.md` §2.2: the deck uses the carousel step timing (one step per screenshot, 1.85 s `slide` move, then hold; 30 s cap).
   - `quality-bar.md` §4: a **Desktop Stack / Mobile Stack** paragraph with the geometry from README §1 (depth, scale and peek per slot, card sizes, centring, exit margin, direction, the entering card's fade), and §2.5 "Never": the deck card's fade is paired with its scale and move.
   - `contracts.md`: the layout field D4 picks, with "unset renders as today".
   - `docs/plan/follow-ups.md`: resolve the stack item per D4, and move the reels question to its own line.

## Acceptance criteria

- [ ] The owner's answers are quoted in README §2.
- [ ] The quality bar and contracts carry the rules; no code changes.
