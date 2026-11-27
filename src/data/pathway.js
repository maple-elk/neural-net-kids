/**
 * 8-Chapter progressive interactive book pathway for BrainSpark (Neural Net Kids).
 * Each chapter teaches one core idea starting from 0 and ends with the exact
 * limitation that motivates the next chapter.
 */

export const PATHWAY_META = {
  title: 'BrainSpark',
  tagline: 'An interactive book that takes you from zero to building your own Mini-LLM — one tiny idea at a time.',
  description:
    'Read along and play with built-in demos right in your browser. No prior AI or heavy math needed.',
  totalStages: 8,
}

export const STAGES = [
  {
    id: 1,
    slug: 'neuron',
    route: '/stage/1',
    part: 'Part I · Building Blocks',
    title: 'One Tiny Decision-Maker',
    subtitle: 'How a single artificial neuron weighs clues to make a YES or NO choice.',
    level: 'Chapter 1',
    ageBadge: 'Start Here',
    color: '#f59e0b',
    icon: 'Zap',
    summary:
      'Computers only understand numbers. See how one simple math cell collects clues, dials their importance up or down, and decides whether to fire.',
    keyConcepts: [
      { term: 'Input', definition: 'A clue turned into a number (0 or 1).' },
      { term: 'Weight', definition: 'An importance dial — positive votes YES, negative warns NO.' },
      { term: 'Bias', definition: 'The neuron’s starting mood before seeing clues.' },
    ],
  },
  {
    id: 2,
    slug: 'learning',
    route: '/stage/2',
    part: 'Part I · Building Blocks',
    title: 'Learning from Mistakes',
    subtitle: 'How a neuron measures how wrong it is and slides downhill to fix its own weights.',
    level: 'Chapter 2',
    ageBadge: 'Core Idea',
    color: '#ef4444',
    icon: 'TrendingDown',
    summary:
      'Tuning weights by hand is slow! Discover Loss Mountain, experiment with stride size (Learning Rate), and watch a single neuron teach itself to draw a straight fence.',
    keyConcepts: [
      { term: 'Loss', definition: 'A mistake scoreboard — lower is better.' },
      { term: 'Gradient Descent', definition: 'Stepping downhill on Loss Mountain.' },
      { term: 'Learning Rate', definition: 'Stride size — too tiny is slow, too huge overshoots.' },
    ],
  },
  {
    id: 3,
    slug: 'layers',
    route: '/stage/3',
    part: 'Part I · Building Blocks',
    title: 'Teamwork & Curved Lines',
    subtitle: 'Why one straight fence gets trapped by XOR — and how hidden layers + backpropagation break through.',
    level: 'Chapter 3',
    ageBadge: 'Breakthrough',
    color: '#6366f1',
    icon: 'Network',
    summary:
      'One neuron gets stuck on a checkerboard puzzle (XOR). Add a hidden team of helper neurons to bend the boundary, then trace how error notes flow backward to train every weight.',
    keyConcepts: [
      { term: 'XOR Trap', definition: 'A checkerboard puzzle no single straight line can solve.' },
      { term: 'Hidden Layer', definition: 'A middle team of neurons that bend boundaries.' },
      { term: 'Backpropagation', definition: 'Passing blame backward so hidden weights improve.' },
    ],
  },
  {
    id: 4,
    slug: 'vision',
    route: '/stage/4',
    part: 'Part II · Senses',
    title: 'How Computers See',
    subtitle: 'Turn pictures into pixel grids, slide tiny edge-spotting filters, and recognize your handwriting.',
    level: 'Chapter 4',
    ageBadge: 'Vision',
    color: '#10b981',
    icon: 'Eye',
    summary:
      'To an AI, a photo is just a grid of brightness numbers. Slide a 3×3 magnifying glass to spot edges, then draw a digit and watch pooling + feature neurons guess what you drew.',
    keyConcepts: [
      { term: 'Convolution Filter', definition: 'A tiny 3×3 lens scanning for edges and corners.' },
      { term: 'Pooling', definition: 'Shrinking a pixel grid into a compact summary.' },
      { term: 'Softmax', definition: 'Turning raw scores into clean percentages.' },
    ],
  },
  {
    id: 5,
    slug: 'tokens-vectors',
    route: '/stage/5',
    part: 'Part III · Language',
    title: 'Turning Words into Maps',
    subtitle: 'Chop sentences into numbered tokens and place words on a Meaning Map where you can do word math.',
    level: 'Chapter 5',
    ageBadge: 'Language',
    color: '#8b5cf6',
    icon: 'Compass',
    summary:
      'AI reads by snapping text into reusable Lego pieces called tokens, then placing similar words into the same neighborhood on a Meaning Map — where King − Man + Woman = Queen!',
    keyConcepts: [
      { term: 'Token', definition: 'A word or word-piece stamped with an ID number.' },
      { term: 'Embedding', definition: 'A word’s GPS coordinates on a Meaning Map.' },
      { term: 'Word Math', definition: 'Sliding meaning arrows between related words.' },
    ],
  },
  {
    id: 6,
    slug: 'attention',
    route: '/stage/6',
    part: 'Part III · Language',
    title: 'The Attention Spotlight',
    subtitle: 'How words look around a sentence to solve puzzles like "it" and "river bank vs. money bank".',
    level: 'Chapter 6',
    ageBadge: 'Transformers',
    color: '#ec4899',
    icon: 'Sparkles',
    summary:
      'Words are chameleons whose meaning changes with context. Flip one word in a sentence and watch Self-Attention redirect its spotlight to completely change what a word means.',
    keyConcepts: [
      { term: 'Self-Attention', definition: 'A spotlight letting every word borrow clues from neighbors.' },
      { term: 'Context', definition: 'Surrounding words that clarify ambiguous meanings.' },
      { term: 'Multi-Head', definition: 'Multiple spotlights tracking who, size, and action at once.' },
    ],
  },
  {
    id: 7,
    slug: 'mini-llm',
    route: '/stage/7',
    part: 'Part III · Language',
    title: 'The Next-Word Game',
    subtitle: 'Train your own Mini-LLM, peek at next-word odds, and steer creativity with Temperature.',
    level: 'Chapter 7',
    ageBadge: 'Build It',
    color: '#0ea5e9',
    icon: 'MessageSquare',
    summary:
      'Even giant chatbots write one token at a time! Train a Mini-LLM on a story in milliseconds, roll the weighted dice, and slide Temperature from Predictable Robot to Wild Chaos.',
    keyConcepts: [
      { term: 'Autoregressive', definition: 'Guessing one word, adding it, and repeating.' },
      { term: 'Temperature', definition: 'Creativity thermostat from safe robot to wild storyteller.' },
      { term: 'RLHF', definition: 'Polishing an AI’s manners with human feedback.' },
    ],
  },
  {
    id: 8,
    slug: 'story',
    route: '/stage/8',
    part: 'Epilogue · The Big Picture',
    title: 'The 80-Year Story & AI Zoo',
    subtitle: 'Meet the 4 families of AI brains and trace every breakthrough from 1943 to today.',
    level: 'Chapter 8',
    ageBadge: 'Finale',
    color: '#f97316',
    icon: 'Clock',
    summary:
      'Zoom out to compare the 4 classic AI brain designs (MLP, CNN, RNN, Transformer), travel the 1943–2026 timeline, and take the final quiz!',
    keyConcepts: [
      { term: 'MLP / CNN / RNN / Transformer', definition: 'The four specialist brain designs of modern AI.' },
      { term: 'AI Winter', definition: 'When early AI hit a wall until a new math idea broke through.' },
      { term: 'Scaling Laws', definition: 'More data + more neurons = surprisingly smarter models.' },
    ],
  },
]

export function getStageById(id) {
  return STAGES.find((stage) => stage.id === Number(id)) || null
}

export function getStageBySlug(slug) {
  return STAGES.find((stage) => stage.slug === slug) || null
}
