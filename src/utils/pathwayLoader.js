/**
 * Loads STAGES and PATHWAY_META from src/data/pathway.js when present,
 * with a schema-identical fallback so the shell compiles independently.
 */
const pathwayModules = import.meta.glob('../data/pathway.js', { eager: true })
const loadedModule = pathwayModules['../data/pathway.js']

const FALLBACK_PATHWAY_META = {
  title: 'From One Neuron to Large Language Models',
  tagline: '7 hands-on browser labs that take you from a single artificial neuron to building your own Mini-LLM.',
  totalStages: 7,
}

const FALLBACK_STAGES = [
  {
    id: 1,
    slug: 'neuron',
    route: '/stage/1',
    title: 'Meet the Neuron',
    subtitle: 'How one tiny math switch makes a decision',
    level: 'Beginner',
    ageBadge: 'Ages 8+',
    color: '#f59e0b',
    icon: 'Zap',
    kidSummary:
      'Discover how an artificial neuron weighs clues like sunshine and friends to make a yes-or-no choice. Tweak sliders to train your own decision-making robot!',
    deepDiveSummary:
      'Explore the McCulloch-Pitts / Rosenblatt perceptron: compute weighted sums z = Σ(wᵢxᵢ) + b and pass them through step or sigmoid activation functions.',
    learningGoals: [
      'Understand inputs, weights, bias, and threshold activation',
      'Solve logic puzzles like AND and OR with a single neuron',
      'Compare hard step switches with smooth sigmoid probabilities',
    ],
    interactiveHighlights: ['Live Neuron Simulator', 'Kid Story Logic Puzzles'],
    keyConcepts: [
      { term: 'Weight', kidDef: 'How important a clue is', deepDef: 'Scalar multiplier wᵢ on input xᵢ' },
      { term: 'Bias', kidDef: 'A head start toward yes or no', deepDef: 'Offset term b shifting the activation threshold' },
    ],
  },
  {
    id: 2,
    slug: 'playground',
    route: '/stage/2',
    title: 'Layers & Boundaries',
    subtitle: 'Team up neurons to draw curved decision maps',
    level: 'Beginner',
    ageBadge: 'Ages 8+',
    color: '#6366f1',
    icon: 'Network',
    kidSummary:
      'One neuron can only draw a straight line, so some puzzles stump it! Stack neurons into hidden layers and watch them bend space to separate spirals and rings.',
    deepDiveSummary:
      'Train a Multi-Layer Perceptron (MLP) in real time on non-linear 2D datasets (XOR, circles, spirals) and observe how hidden layers and non-linear activations warp decision boundaries.',
    learningGoals: [
      'See why a single line fails on XOR and concentric circles',
      'Add hidden layers and neurons to solve complex patterns',
      'Watch decision boundaries evolve live as the network trains',
    ],
    interactiveHighlights: ['Live 2D Decision Map', 'Custom Hidden Layers'],
    keyConcepts: [
      { term: 'Hidden Layer', kidDef: 'A middle team of helper neurons', deepDef: 'Intermediate representation layer applying affine + non-linear transforms' },
      { term: 'Decision Boundary', kidDef: 'The fence separating two groups', deepDef: 'Hypersurface where predicted class probability equals 0.5' },
    ],
  },
  {
    id: 3,
    slug: 'backprop',
    route: '/stage/3',
    title: 'Learning from Mistakes',
    subtitle: 'Roll down Loss Mountain with backpropagation',
    level: 'Explorer',
    ageBadge: 'Ages 10+',
    color: '#ef4444',
    icon: 'TrendingDown',
    kidSummary:
      'How does a neural network know which knobs to turn when it guesses wrong? Step down Loss Mountain and watch error signals travel backward to fix each weight.',
    deepDiveSummary:
      'Visualize gradient descent on a 2D loss surface and inspect a single forward-and-backward pass computing partial derivatives via the chain rule.',
    learningGoals: [
      'Understand loss as a score measuring how wrong a guess is',
      'Experiment with learning rate: too tiny vs. too bouncy',
      'Trace error signals flowing backward through weights',
    ],
    interactiveHighlights: ['Loss Mountain Explorer', 'Step-by-Step Backprop Trace'],
    keyConcepts: [
      { term: 'Loss', kidDef: 'How far off the guess was', deepDef: 'Objective function (e.g. MSE) minimized during training' },
      { term: 'Gradient Descent', kidDef: 'Taking downhill steps toward better guesses', deepDef: 'Iterative update θ ← θ − η∇L(θ)' },
    ],
  },
  {
    id: 4,
    slug: 'vision',
    route: '/stage/4',
    title: 'How Computers See',
    subtitle: 'Spot edges with pixel filters and live AI vision',
    level: 'Explorer',
    ageBadge: 'Ages 10+',
    color: '#10b981',
    icon: 'Eye',
    kidSummary:
      'Computers only see grids of numbers! Slide a magic magnifying filter across pixel art to find edges, then try a real object-detecting neural network in your browser.',
    deepDiveSummary:
      'Inspect 2D spatial convolution with Sobel/sharpen/blur kernels on pixel matrices, then run MobileNet/COCO-SSD inference locally via TensorFlow.js.',
    learningGoals: [
      'See images as grids of brightness numbers',
      'Apply edge-detection filters (convolutions) step by step',
      'Test real-time browser object detection with COCO-SSD',
    ],
    interactiveHighlights: ['Interactive Pixel Convolution', 'Live Browser Vision Detector'],
    keyConcepts: [
      { term: 'Kernel', kidDef: 'A mini pattern-spotting lens', deepDef: 'Small weight matrix convolved across an image tensor' },
      { term: 'Feature Map', kidDef: 'A map showing where a pattern appeared', deepDef: 'Output activation grid produced by sliding a filter' },
    ],
  },
  {
    id: 5,
    slug: 'language',
    route: '/stage/5',
    title: 'Words, Vectors & Attention',
    subtitle: 'Turn language into coordinates and spotlights',
    level: 'Builder',
    ageBadge: 'Ages 11+',
    color: '#8b5cf6',
    icon: 'Sparkles',
    kidSummary:
      'AI reads by chopping text into tokens, placing words on a meaning map, and shining an attention spotlight so pronouns like "it" always find the right clue.',
    deepDiveSummary:
      'Explore subword tokenization, vector-space word analogies (king − man + woman ≈ queen), and self-attention weight matrices resolving ambiguous pronouns.',
    learningGoals: [
      'Break sentences into tokens and token IDs',
      'Do word-meaning math on a 2D embedding map',
      'Click words to inspect self-attention spotlights',
    ],
    interactiveHighlights: ['Token Splitter', 'Word Math Map', 'Attention Spotlight'],
    keyConcepts: [
      { term: 'Embedding', kidDef: 'A word’s GPS location on a meaning map', deepDef: 'Dense vector representation capturing semantic similarity' },
      { term: 'Self-Attention', kidDef: 'A spotlight linking related words', deepDef: 'Scaled dot-product weighting across sequence tokens' },
    ],
  },
  {
    id: 6,
    slug: 'mini-llm',
    route: '/stage/6',
    title: 'Build a Mini-LLM',
    subtitle: 'Train a next-word predictor and tune creativity',
    level: 'Builder',
    ageBadge: 'Ages 11+',
    color: '#0ea5e9',
    icon: 'MessageSquare',
    kidSummary:
      'Feed your own stories into a tiny language model, watch it calculate next-word probabilities, and turn the Temperature dial from super-safe to wildly creative!',
    deepDiveSummary:
      'Train an in-browser n-gram backoff language model on starter or custom corpora, inspect probability distributions, and sample tokens using temperature and top-k filtering.',
    learningGoals: [
      'See how language models predict one token at a time',
      'Train a model on custom text and watch predictions shift',
      'Control randomness with Temperature and Top-K sampling',
    ],
    interactiveHighlights: ['Train on Your Own Text', 'Temperature & Top-K Dial'],
    keyConcepts: [
      { term: 'Next-Token Prediction', kidDef: 'Guessing the most likely next word', deepDef: 'Autoregressive modeling of P(xₜ | x₁…xₜ₋₁)' },
      { term: 'Temperature', kidDef: 'The creativity vs. safety dial', deepDef: 'Logit scaling parameter controlling softmax entropy' },
    ],
  },
  {
    id: 7,
    slug: 'history',
    route: '/stage/7',
    title: 'The Story of AI & LLMs',
    subtitle: 'From 1943 paper neurons to modern AI',
    level: 'Master',
    ageBadge: 'Ages 8+',
    color: '#ec4899',
    icon: 'Clock',
    kidSummary:
      'Travel through 80+ years of breakthroughs—from the very first brain-inspired neuron to Transformers and ChatGPT—and jump back into any lab along the timeline.',
    deepDiveSummary:
      'Trace the technical lineage from McCulloch-Pitts, Rosenblatt, Backprop, LeNet, AlexNet, and Word2Vec to Attention Is All You Need, scaling laws, RLHF, and reasoning models.',
    learningGoals: [
      'Connect each lab you played to the real invention in history',
      'Understand why AI winters happened and what broke through them',
      'See how Transformers unlocked modern Large Language Models',
    ],
    interactiveHighlights: ['Interactive 1943–2026 Timeline', 'Jump-to-Lab Links'],
    keyConcepts: [
      { term: 'Transformer', kidDef: 'The attention-powered engine inside modern LLMs', deepDef: 'Parallelizable sequence architecture using multi-head self-attention' },
      { term: 'Scaling Laws', kidDef: 'More data + bigger brains = surprising new skills', deepDef: 'Predictable power-law loss reduction with compute, data, and parameters' },
    ],
  },
]

export const STAGES = Array.isArray(loadedModule?.STAGES) && loadedModule.STAGES.length > 0
  ? loadedModule.STAGES
  : FALLBACK_STAGES

export const PATHWAY_META = loadedModule?.PATHWAY_META || FALLBACK_PATHWAY_META

export function getStageById(id) {
  const num = Number(id)
  return STAGES.find((stage) => stage.id === num) || null
}
