# BrainSpark (`neural-net-kids`) — Agent Context

Client-only interactive STEM book teaching neural networks, computer vision, and Large Language Models in plain JavaScript + React + Vite (`base: './'`, hash routing).

## Verify & Deploy
- **Inner-Loop Check (run before finishing):** `npm run check`
- **Dev Server:** `npm run dev`
- **Deploy Live Site (`https://maple-elk.github.io/neural-net-kids/`):**
  - Pushing to `origin/main` does **not** deploy the live app; GitHub Pages serves from the `gh-pages` branch.
  - Run `npm run deploy` (`gh-pages -d dist`), then confirm the async `pages-build-deployment` workflow reaches `built` via `gh run watch` or `gh api repos/maple-elk/neural-net-kids/pages/builds/latest`.

## Product & Engineering Invariants
- **Single Reading-First Narrative (No Mode Toggles):** Every chapter uses `<BookChapter />` with one unified explanation for all readers. Never introduce global audience or difficulty mode toggles (e.g., Explorer vs. Deep-Dive); place optional formulas and free-play controls inside inline collapsible `<MathDrawer />` and `<BonusDrawer />` components.
- **Plain-JSX ↔ Engine Contract Verification:** Because `src/` is untyped `.js`/`.jsx` (no TypeScript), `oxlint` and `vite build` will not catch method-name or return-shape mismatches between `src/labs/*.jsx` handlers and `src/engine/*.js` classes. Whenever adding or refactoring interactive lab controls (`Train`, `+N Steps`, `Reset`), verify exact exported signatures in `src/engine/` and cover the exact call/convergence path in `vitest` or a live browser check.
- **Clean Up Superseded Views:** When splitting or replacing labs in `src/App.jsx`, delete orphaned `.jsx` components and unused `LearningContext` state in the same commit (checking first whether shared `.css` files are still imported by active chapters).
- **100% In-Browser & Zero Secrets:** Keep all simulations and optional `@tensorflow/tfjs` inference strictly client-side with zero backend or API keys, and lazy-load heavy ML bundles via dynamic `import()`.
