# Neural Net Kids

An interactive, 100% browser-based STEM learning lab that takes curious kids, teens, and lifelong learners from a single artificial neuron all the way to training their own Mini-LLM — no backend, no API keys, and no server required.

## The 7-Stage Learning Pathway

| Stage | Title | Level | What You Play With |
| :---: | :--- | :--- | :--- |
| **1** | **Meet the Neuron** | Beginner (8+) | Interactive perceptron diagram, live weight/bias sliders, Step vs. Sigmoid toggle, and AND/OR/NOT/NAND logic gate puzzles. |
| **2** | **Layers & Boundaries** | Beginner (9+) | Live 2D neural network playground (`Linear`, `Circle`, `XOR`, `Spiral`), hidden-layer builder, live SVG weights, and 4 experiment missions. |
| **3** | **Learning from Mistakes** | Explorer (10+) | 2D "Loss Mountain" gradient descent explorer + 4-step Backpropagation Time-Machine tracing forward passes, errors, and weight nudges. |
| **4** | **How Computers See** | Explorer (10+) | 8×8 CNN pixel-filter explorer, lazy-loaded TensorFlow.js (`COCO-SSD`) live camera object detector with camera-free fallback, and a 2-class "Teach a Mini-Brain" drawing classifier. |
| **5** | **Words, Vectors & Attention** | Builder (11+) | Live subword Tokenizer, 2D Word Meaning Map with vector math (`King − Man + Woman = Queen`), and interactive Self-Attention pronoun spotlights. |
| **6** | **Build a Mini-LLM** | Builder (12+) | Trainable in-browser language model (4 starter stories + custom text), live next-token probability bars, Temperature & Top-K sliders, and autoregressive generation. |
| **7** | **The Story of AI & LLMs** | Master (8+) | Interactive 1943–2026 timeline across 4 eras linking historical breakthroughs back to Stages 1–6, plus a 4-question AI History Quick Quiz. |

## Explorer Mode vs. Deep-Dive Mode

Toggle modes anytime from the top navigation bar (saved in `localStorage` alongside stage completion progress):

- **Explorer Mode (Ages 8–12):** Playful metaphors, everyday stories, and hands-on puzzles with zero heavy math.
- **Deep-Dive Mode (Teens & Curious Minds):** Reveals real formulas, activation curves, gradients, Q/K/V attention notes, and technical architecture details.

## Browser-Only Architecture

- **Zero backend / zero API keys:** All neural network simulations (`src/engine/`), data (`src/data/`), and UI labs (`src/labs/`) run locally in the browser using React 19 + Vite 8.
- **Hash-based routing (`#/` and `#/stage/1`..`#/stage/7`):** Works reliably on static hosts like GitHub Pages with no 404s on refresh.
- **Privacy-first Computer Vision (Stage 4):** `@tensorflow/tfjs` and `@tensorflow-models/coco-ssd` are lazy-loaded via dynamic `import()` only when the user opens the Live Camera AI tab. All inference runs locally on-device, and built-in sample scenes + image upload ensure Stage 4 works seamlessly even without a webcam.

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
| `npm run build` | Build production bundle into `dist/` (with `base: './'`) |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build (`predeploy`) and publish `dist/` to GitHub Pages via `gh-pages` |

## Project Structure

```text
src/
├── context/      # LearningContext (Explorer/Deep-Dive mode, localStorage progress, hash routing)
├── components/   # Layout shell, HomePathway map, LabPlaceholder
├── data/         # pathway.js (7 stages & metadata), history.js (4 eras & 12 milestones)
├── engine/       # Pure ESM simulation engines (perceptron, mlp, convolution, miniLlm) + Vitest suite
├── labs/         # Interactive Stage 1–7 lab views & styles
└── styles/       # Light-first STEM lab design system (theme.css)
```
