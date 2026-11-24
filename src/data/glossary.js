/**
 * Plain-English glossary of AI & Neural Network terms used across Stages 1–7.
 * Pure data module — no runtime dependencies.
 */

export const GLOSSARY = {
  // Stage 1: Meet the Neuron
  perceptron: {
    term: 'Perceptron',
    emoji: '⚡',
    plain:
      'A single artificial brain cell that collects clues, multiplies each clue by its importance, adds them up, and makes a YES or NO decision.',
    formula: 'output = activation(w₁x₁ + w₂x₂ + … + bias)',
  },
  weight: {
    term: 'Weight',
    emoji: '🎛️',
    plain:
      'An importance dial on a clue. Positive weights push toward YES, negative weights warn toward NO, and 0 means "ignore this clue."',
    formula: 'contribution = weight × input',
  },
  bias: {
    term: 'Bias',
    emoji: '⚖️',
    plain:
      'A neuron’s starting mood — how easy or hard it is to convince it to say YES even before looking at the clues.',
    formula: 'score = (Σ wᵢxᵢ) + bias',
  },
  activation: {
    term: 'Activation Function',
    emoji: '🚦',
    plain:
      'The final rule that turns a neuron’s raw score into an output — like a light switch (Step) or a smooth dimmer (Sigmoid, Tanh, ReLU).',
    formula: 'y = f(z)',
  },
  step: {
    term: 'Step Function',
    emoji: '🔘',
    plain:
      'A crisp on/off light switch: if the total score reaches 0 or higher, it snaps straight to 1 (YES); otherwise it stays at 0 (NO).',
    formula: 'step(z) = 1 if z ≥ 0 else 0',
  },
  sigmoid: {
    term: 'Sigmoid',
    emoji: '📈',
    plain:
      'Smoothly squishes any number into a 0% to 100% probability! Very negative scores approach 0, very positive scores approach 1, and 0 lands right at 50%.',
    formula: 'σ(z) = 1 / (1 + e⁻ᶻ)  →  (0, 1)',
  },

  // Stage 2: Layers & Boundaries
  linear: {
    term: 'Linear Dataset',
    emoji: '📏',
    plain:
      'Two teams of dots that can be cleanly separated by a single straight line — easy even for one neuron!',
    formula: 'w₁x + w₂y + b = 0',
  },
  circle: {
    term: 'Circle Dataset',
    emoji: '🎯',
    plain:
      'One team of dots sits inside a bullseye ring while the other team surrounds it — you need a hidden layer to bend a fence all the way around!',
    formula: 'x² + y² < r²',
  },
  xor: {
    term: 'XOR',
    emoji: '🏁',
    plain:
      'Exclusive OR — like a checkerboard where opposite corners share a team, so no single straight line can separate them! Hidden layers solve it by combining multiple lines.',
    formula: '1 if (x > 0) ≠ (y > 0) else 0',
  },
  spiral: {
    term: 'Spiral Dataset',
    emoji: '🌀',
    plain:
      'Two intertwined galaxy arms twisting around each other — the hardest 2D puzzle, needing deeper hidden layers to weave between the arms.',
  },
  'hidden-layer': {
    term: 'Hidden Layer',
    emoji: '🧱',
    plain:
      'A middle team of neurons between the inputs and the final answer. Each hidden neuron draws a simple line, and together they build curves and shapes!',
  },
  tanh: {
    term: 'Tanh',
    emoji: '〰️',
    plain:
      'Hyperbolic tangent — smoothly squishes any number into a range from −1 to +1, centered right at zero. Great for hidden layers because outputs stay balanced!',
    formula: 'tanh(z) = (eᶻ − e⁻ᶻ) / (eᶻ + e⁻ᶻ)  →  (−1, +1)',
  },
  relu: {
    term: 'ReLU',
    emoji: '🚪',
    plain:
      'Rectified Linear Unit — turns negative numbers into 0 and keeps positive numbers as-is, like a one-way gate that only lets positive signals through!',
    formula: 'ReLU(z) = max(0, z)',
  },
  'learning-rate': {
    term: 'Learning Rate',
    emoji: '👟',
    plain:
      'How big a step the network takes when fixing a mistake. Too tiny = painfully slow learning; too huge = bouncing wildly past the answer!',
    formula: 'w_new = w_old − η · gradient',
  },
  epoch: {
    term: 'Epoch',
    emoji: '🔁',
    plain:
      'One full practice round where the neural network looks at every single training example once and adjusts its weights.',
  },
  loss: {
    term: 'Loss',
    emoji: '🎯',
    plain:
      'The network’s mistake score — how far its guesses are from the right answers. Lower loss means better guesses, and 0.00 is a bullseye!',
    formula: 'MSE = average of (prediction − target)²',
  },
  'decision-boundary': {
    term: 'Decision Boundary',
    emoji: '🗺️',
    plain:
      'The invisible border line the neural network draws across the map to separate one team from the other.',
  },

  // Stage 3: Learning from Mistakes
  'gradient-descent': {
    term: 'Gradient Descent',
    emoji: '⛰️',
    plain:
      'Feeling which way the ground slopes downhill on Loss Mountain and taking a step downward to make mistakes smaller.',
    formula: 'w ← w − η · ∂Loss/∂w',
  },
  backprop: {
    term: 'Backpropagation',
    emoji: '⏪',
    plain:
      'Passing error notes backward from the output to every hidden neuron so each weight knows exactly how much to nudge itself.',
    formula: '∂L/∂w₁ = (∂L/∂ŷ) · (∂ŷ/∂h) · (∂h/∂w₁)',
  },

  // Stage 4: How Computers See
  convolution: {
    term: 'Convolution',
    emoji: '🔍',
    plain:
      'Sliding a tiny pattern-detector window across an image pixel by pixel to create a glowing map of everywhere a feature (like an edge) appears.',
    formula: 'out[r,c] = Σ patch[i,j] × kernel[i,j]',
  },
  kernel: {
    term: 'Kernel (Filter)',
    emoji: '🧩',
    plain:
      'A tiny grid of numbers (like 3×3) that acts as a magnifying glass tuned to spot one specific pattern, such as a vertical edge or corner.',
  },
  pooling: {
    term: 'Pooling',
    emoji: '📦',
    plain:
      'Shrinking a big pixel grid into a smaller summary grid by averaging or picking the strongest signal in each block — keeping the big picture while cutting detail.',
    formula: '16×16 pixels → 4×4 block averages → 16 inputs',
  },
  softmax: {
    term: 'Softmax',
    emoji: '📊',
    plain:
      'Turns a list of raw category scores into clean percentages that all add up to 100%, spotlighting the model’s top guess.',
    formula: 'P(i) = e^(zᵢ) / Σ e^(zⱼ)',
  },

  // Stage 5: Words, Vectors & Attention
  token: {
    term: 'Token',
    emoji: '🏷️',
    plain:
      'A word or word-piece stamped with an ID number so an AI can read text as math. Common words are 1 token; long words split into pieces.',
  },
  embedding: {
    term: 'Embedding',
    emoji: '🧭',
    plain:
      'A list of GPS coordinates for a word’s meaning! Words with similar meanings (like "cat" and "dog") live in the same neighborhood on the map.',
    formula: 'King − Man + Woman ≈ Queen',
  },
  attention: {
    term: 'Self-Attention',
    emoji: '🔦',
    plain:
      'A spotlight that lets every word look at other words in the sentence to figure out context — like knowing what "it" refers to.',
    formula: 'Attention(Q,K,V) = softmax(QKᵀ / √d) · V',
  },

  // Stage 6: Build a Mini-LLM
  temperature: {
    term: 'Temperature',
    emoji: '🌡️',
    plain:
      'A creativity thermostat for word guessing: cool (0.2) picks the safest, most predictable word; hot (1.5) takes wild, surprising risks!',
    formula: 'P(i) = softmax(logits / T)',
  },
  'top-k': {
    term: 'Top-K Sampling',
    emoji: '🎩',
    plain:
      'Keeping only the K most likely next words in the hat before drawing one out, so the AI never picks total nonsense.',
  },
  autoregressive: {
    term: 'Autoregressive',
    emoji: '🚂',
    plain:
      'Generating text one token at a time, then feeding each brand-new word right back into the prompt to predict the next one!',
    formula: 'P(w₁..wₙ) = ∏ P(wₜ | w₁..wₜ₋₁)',
  },
  rlhf: {
    term: 'RLHF',
    emoji: '👍',
    plain:
      'Reinforcement Learning from Human Feedback — teaching an AI good manners by having people rate helpful, honest replies with thumbs-up and thumbs-down.',
  },

  // Stage 7: Story of AI & LLMs
  transformer: {
    term: 'Transformer',
    emoji: '✨',
    plain:
      'The 2017 neural network design that uses Self-Attention to read whole sentences at once instead of one word at a time — it’s the "T" in GPT!',
  },
  'scaling-laws': {
    term: 'Scaling Laws',
    emoji: '🚀',
    plain:
      'The discovery that giving a language model more parameters, more training text, and more compute makes its predictions smoothly and predictably smarter.',
  },
  mlp: {
    term: 'Feedforward / MLP',
    emoji: '🕸️',
    plain:
      'Multi-Layer Perceptron — a classic neural network where signals flow strictly one way (inputs → hidden layers → output) with no loops, great for tables, numbers, and curved boundaries.',
    formula: 'x → Layer 1 → Layer 2 → ŷ',
  },
  cnn: {
    term: 'Convolutional Network (CNN)',
    emoji: '🔍',
    plain:
      'A vision-specialist neural network that slides tiny pattern-spotting lenses (kernels) across an image grid to detect edges, shapes, and whole objects.',
    formula: 'Pixels → Conv Filters → Pooling → Object',
  },
  rnn: {
    term: 'Recurrent Network (RNN)',
    emoji: '🔁',
    plain:
      'A sequence-reading neural network with a built-in memory loop: each step feeds its hidden memory back into the next step so it remembers what happened earlier.',
    formula: 'hₜ = f(W·xₜ + U·hₜ₋₁)',
  },
  'feedback-loop': {
    term: 'Feedback Loop',
    emoji: '♻️',
    plain:
      'Any path where a network’s result circles back to guide it — either backward during training (Backpropagation fixing weights) or forward across time (Memory & LLM word-by-word loops).',
  },
}

export function getGlossaryEntry(key) {
  if (!key) return null
  const normalized = String(key).trim().toLowerCase()
  return GLOSSARY[normalized] || null
}
