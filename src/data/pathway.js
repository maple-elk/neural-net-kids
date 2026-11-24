/**
 * Learning pathway metadata and 7 escalating stages for Neural Net Kids.
 * Pure data module — no runtime dependencies.
 */

export const PATHWAY_META = {
  title: 'Neural Net Kids',
  tagline: 'From a Single Artificial Neuron to Your Own Mini-LLM',
  description:
    'An interactive, hands-on journey through how artificial intelligence really works — built for curious kids, teens, and lifelong learners.',
  totalStages: 7,
  modes: {
    explorer: {
      id: 'explorer',
      label: 'Explorer Mode',
      badge: 'Ages 8–12',
      description: 'Playful metaphors, everyday stories, and hands-on puzzles with zero heavy math.',
    },
    'deep-dive': {
      id: 'deep-dive',
      label: 'Deep-Dive Mode',
      badge: 'Teens & Curious Minds',
      description: 'Reveals the real formulas, weights, gradients, and architecture behind modern AI.',
    },
  },
  levels: [
    { id: 'Beginner', color: '#10b981', description: 'Start from scratch — no prior AI knowledge needed.' },
    { id: 'Explorer', color: '#f59e0b', description: 'Discover how networks learn from mistakes and see images.' },
    { id: 'Builder', color: '#8b5cf6', description: 'Experiment with language vectors, attention, and text generation.' },
    { id: 'Master', color: '#0ea5e9', description: 'Connect the dots across 80+ years of AI breakthroughs.' },
  ],
};

export const STAGES = [
  {
    id: 1,
    slug: 'neuron',
    route: '/stage/1',
    title: 'Meet the Neuron',
    subtitle: 'Discover how one tiny digital brain cell weighs clues to make a YES or NO decision.',
    level: 'Beginner',
    ageBadge: 'Ages 8+',
    color: '#f59e0b',
    icon: 'Zap',
    kidSummary:
      'Every giant AI starts with a single tiny decision-maker called a neuron. Give it clues, turn the importance dials up or down, and watch it light up when the clues add up!',
    deepDiveSummary:
      'A perceptron computes a weighted sum of numerical inputs plus a bias term and passes the result through an activation function such as a step or sigmoid. Adjusting weights rotates the linear decision threshold in input space.',
    learningGoals: [
      'See how inputs, weights, and bias combine into a single decision.',
      'Experiment with turning weights positive (helpful) or negative (warnings).',
      'Solve logic puzzles like AND, OR, and NOT using just one neuron.',
    ],
    interactiveHighlights: [
      'Tune live weight sliders for kid-friendly scenarios like "Go to the Park?" and "Pizza Party".',
      'Toggle between a crisp Step switch and a smooth Sigmoid probability curve.',
      'Beat built-in Logic Gate challenges by wiring a perceptron yourself.',
    ],
    keyConcepts: [
      {
        term: 'Input',
        kidDef: 'A clue you hand to the neuron, like "Is it sunny?" or "Are my friends coming?"',
        deepDef: 'A numerical feature value x_i fed into the neuron representing one observation.',
      },
      {
        term: 'Weight',
        kidDef: 'An importance dial that says how much a clue matters — and whether it pushes toward YES or NO.',
        deepDef: 'A learnable scalar multiplier w_i that scales input x_i in the dot product Σ w_i x_i.',
      },
      {
        term: 'Bias',
        kidDef: 'The neuron’s built-in mood — how easy or hard it is to convince it to say YES.',
        deepDef: 'An additive offset b that shifts the activation threshold independently of the inputs.',
      },
      {
        term: 'Activation Function',
        kidDef: 'The final switch that turns a total score into a clear answer like FIRE or STAY QUIET.',
        deepDef: 'A function f(z) (such as Heaviside step or σ(z) = 1 / (1 + e^-z)) mapping the pre-activation score z to output.',
      },
    ],
  },
  {
    id: 2,
    slug: 'playground',
    route: '/stage/2',
    title: 'Layers & Boundaries',
    subtitle: 'Team up multiple neurons into hidden layers to bend lines around tricky patterns.',
    level: 'Beginner',
    ageBadge: 'Ages 9+',
    color: '#6366f1',
    icon: 'Network',
    kidSummary:
      'One neuron can only draw a straight fence between dots, which gets stuck on tricky puzzles like checkerboards and rings. Stack neurons into hidden layers and watch them team up to draw curved shapes!',
    deepDiveSummary:
      'A Multi-Layer Perceptron (MLP) composes linear transformations with nonlinear activations (ReLU, tanh, sigmoid) across hidden layers. This enables universal function approximation and non-linear decision boundaries like XOR, circles, and spirals.',
    learningGoals: [
      'Discover why a single straight line cannot separate XOR or ring-shaped datasets.',
      'Add hidden layers and neurons to watch the decision boundary curve in real time.',
      'Compare how ReLU, tanh, and sigmoid shape the network’s boundary.',
    ],
    interactiveHighlights: [
      'Train a real neural network live in your browser on Linear, Circle, XOR, and Spiral datasets.',
      'Add or remove hidden neurons and watch the 2D decision map reshape every epoch.',
      'Track live loss curves as the network improves step by step.',
    ],
    keyConcepts: [
      {
        term: 'Hidden Layer',
        kidDef: 'A middle team of neurons that spots simple patterns and passes hints to the final layer.',
        deepDef: 'An intermediate layer of neurons between input and output that learns latent feature representations.',
      },
      {
        term: 'Decision Boundary',
        kidDef: 'The invisible border the network draws to separate orange dots from blue dots.',
        deepDef: 'The hypersurface in feature space where the model’s predicted class probability crosses 0.5.',
      },
      {
        term: 'Nonlinearity (ReLU / Tanh)',
        kidDef: 'The special bendiness that lets stacked neurons draw curves instead of just straight lines.',
        deepDef: 'Nonlinear elementwise activations that prevent stacked matrix multiplications from collapsing into a single linear map.',
      },
      {
        term: 'XOR Problem',
        kidDef: 'A classic checkerboard puzzle that stumped single-layer AI until hidden layers arrived.',
        deepDef: 'The exclusive-OR classification task, which is not linearly separable and requires at least one hidden layer.',
      },
    ],
  },
  {
    id: 3,
    slug: 'backprop',
    route: '/stage/3',
    title: 'Learning from Mistakes',
    subtitle: 'Roll down Loss Mountain and trace how errors flow backward to fix every weight.',
    level: 'Explorer',
    ageBadge: 'Ages 10+',
    color: '#ec4899',
    icon: 'TrendingDown',
    kidSummary:
      'Neural networks aren’t born smart — they start out guessing wildly! By measuring how wrong a guess is and nudging each weight downhill, the network teaches itself to get better every round.',
    deepDiveSummary:
      'Backpropagation applies the chain rule of calculus to compute ∂L/∂w for every parameter from output to input. Gradient descent then updates weights via w ← w − η · ∂L/∂w to minimize the loss function.',
    learningGoals: [
      'Visualize loss as the height on a misty mountain you want to hike down.',
      'See what happens when the learning rate is too tiny versus way too bouncy.',
      'Step through one forward guess and one backward blame-sharing pass.',
    ],
    interactiveHighlights: [
      'Roll a hiker down a 2D Loss Mountain and test different learning rates.',
      'Single-step through a live forward pass, error calculation, and backward weight update.',
      'Watch the error shrink with every click of "Take 1 Training Step".',
    ],
    keyConcepts: [
      {
        term: 'Loss (Error)',
        kidDef: 'A scoreboard for mistakes — lower is better, and zero means a bullseye!',
        deepDef: 'A differentiable objective function (such as Mean Squared Error) quantifying the gap between prediction and target.',
      },
      {
        term: 'Gradient Descent',
        kidDef: 'Feeling which way the ground slopes downhill and taking a step in that direction.',
        deepDef: 'First-order iterative optimization that moves parameters opposite the gradient vector ∇L(w).',
      },
      {
        term: 'Learning Rate',
        kidDef: 'Your stride size — too small takes forever, too huge makes you overshoot the valley.',
        deepDef: 'A hyperparameter η controlling the step size applied to parameter gradients during each update.',
      },
      {
        term: 'Backpropagation',
        kidDef: 'Passing a note backward through the network so every weight knows how much to change.',
        deepDef: 'Reverse-mode automatic differentiation computing exact partial derivatives layer by layer via the chain rule.',
      },
    ],
  },
  {
    id: 4,
    slug: 'vision',
    route: '/stage/4',
    title: 'How Computers See',
    subtitle: 'Slide tiny detective filters over pixels to spot edges, corners, and real-world objects.',
    level: 'Explorer',
    ageBadge: 'Ages 10+',
    color: '#10b981',
    icon: 'Eye',
    kidSummary:
      'To a computer, a photo is just a giant grid of brightness numbers! By sliding small pattern-detectors called filters across the grid, vision networks find edges, shapes, and eventually whole objects.',
    deepDiveSummary:
      'Convolutional Neural Networks (CNNs) slide learned 2D kernels across pixel tensors to produce translation-equivariant feature maps. Deeper layers compose low-level edges into textures, object parts, and semantic detections.',
    learningGoals: [
      'See how an image turns into a grid of numbers a computer can inspect.',
      'Slide a 3×3 filter window over pixel art to detect vertical edges, horizontal edges, and outlines.',
      'Test a real pre-trained browser vision model on live objects or sample scenes.',
    ],
    interactiveHighlights: [
      'Paint your own 8×8 pixel grid and watch convolution filters light up edges instantly.',
      'Hover over any output cell to see the exact 3×3 multiply-and-add math.',
      'Try an optional live webcam / image object detector powered by TensorFlow.js in your browser.',
    ],
    keyConcepts: [
      {
        term: 'Pixel Grid',
        kidDef: 'A mosaic of tiny colored squares where each square is stored as a number.',
        deepDef: 'A 2D matrix (grayscale) or 3D tensor (H × W × RGB) of numeric intensity values.',
      },
      {
        term: 'Convolution Filter (Kernel)',
        kidDef: 'A mini magnifying glass that scans the image looking for one specific pattern like an edge.',
        deepDef: 'A small weight matrix (e.g. 3×3) slid across the input via elementwise multiplication and summation.',
      },
      {
        term: 'Feature Map',
        kidDef: 'A glowing treasure map showing everywhere the filter spotted its favorite pattern.',
        deepDef: 'The 2D activation output produced by applying a convolution kernel across an input image or layer.',
      },
    ],
  },
  {
    id: 5,
    slug: 'language',
    route: '/stage/5',
    title: 'Words, Vectors & Attention',
    subtitle: 'Chop text into tokens, do math with word meanings, and shine the attention spotlight.',
    level: 'Builder',
    ageBadge: 'Ages 11+',
    color: '#8b5cf6',
    icon: 'Sparkles',
    kidSummary:
      'Computers don’t read letters like we do — they chop sentences into numbered puzzle pieces called tokens and place similar words near each other on a giant meaning map. Then Attention lets every word look around the sentence for clues!',
    deepDiveSummary:
      'Modern language models map subword tokens into dense embedding vectors where semantic relationships form linear offsets. Self-attention computes contextual relevance weights across all tokens via scaled dot-product queries, keys, and values.',
    learningGoals: [
      'See how sentences split into tokens and integer IDs.',
      'Explore a 2D meaning map and try word math like King − Man + Woman = Queen.',
      'Click words in tricky sentences to see how Attention resolves what "it" refers to.',
    ],
    interactiveHighlights: [
      'Type any sentence into the live Tokenizer to watch words snap into colored token chips.',
      'Solve interactive Word Vector analogies and inspect cosine similarity scores.',
      'Click pronouns in ambiguous sentences to illuminate real self-attention spotlight lines.',
    ],
    keyConcepts: [
      {
        term: 'Token',
        kidDef: 'A word or word-piece stamped with an ID number so an AI can read it.',
        deepDef: 'A discrete unit from a subword vocabulary (such as BPE) mapped to an integer index.',
      },
      {
        term: 'Embedding Vector',
        kidDef: 'A secret GPS coordinate for a word’s meaning — "cat" and "dog" live in the same neighborhood!',
        deepDef: 'A dense vector in ℝ^d capturing semantic and syntactic properties such that similar words have high cosine similarity.',
      },
      {
        term: 'Self-Attention',
        kidDef: 'A spotlight that lets a word like "it" look back at other words to figure out who it means.',
        deepDef: 'A mechanism computing Attention(Q,K,V) = softmax(QK^T / √d_k)V to dynamically weight context tokens.',
      },
    ],
  },
  {
    id: 6,
    slug: 'mini-llm',
    route: '/stage/6',
    title: 'Build a Mini-LLM',
    subtitle: 'Train your own next-word predictor and steer its imagination with temperature and top-K.',
    level: 'Builder',
    ageBadge: 'Ages 12+',
    color: '#0ea5e9',
    icon: 'MessageSquare',
    kidSummary:
      'Under the hood, even giant chatbots play one super-powered game: guessing the very next word! Feed your own stories into a Mini-LLM, peek at its probability bars, and twist the Temperature dial from robot-predictable to wild-creative.',
    deepDiveSummary:
      'Autoregressive language models generate text by estimating P(w_t | w_<t) and sampling one token at a time. Decoding controls like temperature scaling and top-K truncation trade off coherence against diversity.',
    learningGoals: [
      'Train a live in-browser language model on starter stories or your own custom text.',
      'Inspect the ranked probability bar chart for every next-word prediction.',
      'Control creativity vs. predictability using Temperature and Top-K sliders.',
    ],
    interactiveHighlights: [
      'Switch between Space Adventure, Dinosaur Park, Fairy Tale, Robot Lab, or paste your own story.',
      'Generate text one word at a time and watch the probability distribution shift live.',
      'Dial Temperature from icy 0.2 (safe) to fiery 1.8 (surprising) to see sampling in action.',
    ],
    keyConcepts: [
      {
        term: 'Next-Token Prediction',
        kidDef: 'Guessing which word fits best next, over and over, to build whole sentences.',
        deepDef: 'Autoregressive factorization of sequence probability P(x_1..T) = ∏ P(x_t | x_1..t-1).',
      },
      {
        term: 'Temperature',
        kidDef: 'A creativity thermostat: cool picks the safest word, hot takes wild, silly risks.',
        deepDef: 'A logit scaling factor T in softmax(z_i / T) that sharpens (T < 1) or flattens (T > 1) the sampling distribution.',
      },
      {
        term: 'Top-K Sampling',
        kidDef: 'Keeping only the K best word candidates in the hat before drawing one out.',
        deepDef: 'A decoding constraint that truncates the vocabulary distribution to the K highest-probability tokens before renormalization.',
      },
      {
        term: 'Training Corpus',
        kidDef: 'The pile of stories and facts a language model reads to learn how words go together.',
        deepDef: 'The text dataset used to estimate token transition probabilities or optimize language model parameters.',
      },
    ],
  },
  {
    id: 7,
    slug: 'history',
    route: '/stage/7',
    title: 'The Story of AI & LLMs',
    subtitle: 'Travel from 1943’s first paper neuron to today’s multimodal and reasoning models.',
    level: 'Master',
    ageBadge: 'Ages 8+',
    color: '#f97316',
    icon: 'Clock',
    kidSummary:
      'Modern AI didn’t appear overnight — it took more than 80 years of wild inventions, winter slowdowns, and eureka moments! Explore the timeline and jump straight back into the lab behind each breakthrough.',
    deepDiveSummary:
      'Trace the intellectual lineage from McCulloch–Pitts threshold logic and Rosenblatt’s perceptron through backpropagation, CNNs, LSTMs, Word2Vec, Transformers, scaling laws, RLHF, and modern reasoning systems.',
    learningGoals: [
      'Follow the 4 major eras that turned simple math neurons into fluent AI assistants.',
      'See why AI faced setbacks like the 1969 XOR problem — and what unlocked the next leap.',
      'Connect every historical milestone directly back to the interactive labs you just mastered.',
    ],
    interactiveHighlights: [
      'Filter 12 landmark breakthroughs from 1943 to 2026 across 4 color-coded eras.',
      'Flip between Kid Story mode and Deep-Dive technical history on every milestone card.',
      'Click "Try This Lab" on any milestone to jump straight to the matching interactive stage.',
    ],
    keyConcepts: [
      {
        term: 'AI Winter',
        kidDef: 'A chilly pause in AI history when early computers hit a wall and people lost excitement for a while.',
        deepDef: 'Periods of reduced funding and interest (e.g. post-1969, late 1980s) when symbolic or single-layer methods met hard limits.',
      },
      {
        term: 'Transformer',
        kidDef: 'The 2017 invention that used Attention to read whole sentences at once and sparked the LLM boom.',
        deepDef: 'The attention-only sequence architecture introduced by Vaswani et al. (2017) enabling massive parallel training.',
      },
      {
        term: 'Scaling Laws',
        kidDef: 'The discovery that giving AI more data, more neurons, and more computer power makes it steadily smarter.',
        deepDef: 'Empirical power-law relationships linking model loss predictably to parameter count, dataset size, and training compute.',
      },
      {
        term: 'RLHF',
        kidDef: 'Teaching an AI good manners by having humans give thumbs-up and thumbs-down feedback.',
        deepDef: 'Reinforcement Learning from Human Feedback — aligning pretrained language models to follow instructions safely and helpfully.',
      },
    ],
  },
];

export function getStageById(id) {
  return STAGES.find((stage) => stage.id === Number(id)) || null;
}

export function getStageBySlug(slug) {
  return STAGES.find((stage) => stage.slug === slug) || null;
}
