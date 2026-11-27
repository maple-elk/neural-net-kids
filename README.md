# BrainSpark (Neural Net Kids)

An interactive, 100% browser-based STEM book that takes curious kids, teens, and lifelong learners from a single artificial neuron all the way to training their own Mini-LLM — no backend, no API keys, and no server required.

## The 8-Chapter Interactive Book

| Chapter | Title | Part | What You Play With |
| :---: | :--- | :--- | :--- |
| **1** | **One Tiny Decision-Maker** | Part I · Building Blocks | Interactive perceptron diagram, live weight/bias sliders, Step vs. Sigmoid toggle, and AND/OR/NOT/NAND logic gate puzzles. |
| **2** | **Learning from Mistakes** | Part I · Building Blocks | 2D "Loss Mountain" gradient descent explorer, Learning Rate experiments, and live single-neuron linear training. |
| **3** | **Teamwork & Curved Lines** | Part I · Building Blocks | The XOR checkerboard trap, hidden-layer builder on `Linear`/`Circle`/`XOR`/`Spiral` maps, and step-by-step Backpropagation trace. |
| **4** | **How Computers See** | Part II · Senses | 8×8 CNN pixel-filter explorer, live 3-layer handwriting recognizer, and lazy-loaded TensorFlow.js (`COCO-SSD`) live camera object detector. |
| **5** | **Turning Words into Maps** | Part III · Language | Live subword Tokenizer and 2D/3D Word Meaning Map with vector math (`King − Man + Woman = Queen`). |
| **6** | **The Attention Spotlight** | Part III · Language | Interactive Winograd & homonym Self-Attention spotlights, Before/After context blending, and Multi-Head attention views. |
| **7** | **The Next-Word Game** | Part III · Language | Trainable in-browser Mini-LLM (starter stories + custom text), live next-token probability bars, Temperature & Top-K sliders. |
| **8** | **The 80-Year Story & AI Zoo** | Epilogue · The Big Picture | The 4 families of AI brains (MLP, CNN, RNN, Transformer), interactive 1943–Today timeline, and capstone quiz. |

Every chapter uses a unified, reading-first narrative with inline glossary tooltips (`<TermTip />`) and optional collapsible math/sandbox drawers (`<MathDrawer />`, `<BonusDrawer />`).

## Browser-Only Architecture

- **Zero backend / zero API keys:** All neural network simulations (`src/engine/`), data (`src/data/`), and interactive chapters (`src/labs/`) run locally in the browser using React 19 + Vite 8.
- **Hash-based routing (`#/` and `#/stage/1`..`#/stage/8`):** Works reliably on static hosts like GitHub Pages with no 404s on refresh.
- **Privacy-first Computer Vision (Chapter 4):** `@tensorflow/tfjs` and `@tensorflow-models/coco-ssd` are lazy-loaded via dynamic `import()` only when opened. All inference runs locally on-device, with built-in sample scenes and image upload when no webcam is present.

## Local Development

```bash
npm install
npm run dev
```

### Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start Vite development server with HMR |
| `npm run test` | Run Vitest engine unit tests (`vitest run`) |
| `npm run lint` | Lint source files with `oxlint` |
| `npm run check` | Run full inner-loop check (`vitest run && oxlint && vite build`) |
| `npm run build` | Build production bundle into `dist/` (with `base: './'`) |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build (`predeploy`) and publish `dist/` to GitHub Pages via `gh-pages` |
