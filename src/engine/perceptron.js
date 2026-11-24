/**
 * Perceptron Simulation Engine (Stage 1: Meet the Neuron)
 * Zero-dependency pure ESM module for interactive neuron math,
 * kid-friendly decision scenarios, and logic-gate challenges.
 */

/**
 * Sigmoid activation function mapping any real number to (0, 1).
 * @param {number} x
 * @returns {number}
 */
export function sigmoid(x) {
  if (x >= 40) return 1;
  if (x <= -40) return 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Step (Heaviside) activation function: 1 if x >= 0, else 0.
 * @param {number} x
 * @returns {number}
 */
export function step(x) {
  return x >= 0 ? 1 : 0;
}

/**
 * Compute a single artificial neuron (perceptron) forward pass.
 *
 * @param {number[]} inputs - Numeric input signals (e.g. [1, 0, 1])
 * @param {number[]} weights - Weight per input (e.g. [2, -1, 1.5])
 * @param {number} [bias=0] - Bias term added to the weighted sum
 * @param {'step'|'sigmoid'} [activation='step'] - Activation function name
 * @returns {{
 *   weightedSum: number,
 *   output: number,
 *   terms: Array<{ index: number, input: number, weight: number, product: number }>,
 *   bias: number,
 *   activation: 'step'|'sigmoid',
 *   fired: boolean
 * }}
 */
export function computePerceptron(inputs, weights, bias = 0, activation = 'step') {
  const safeInputs = Array.isArray(inputs) ? inputs : [];
  const safeWeights = Array.isArray(weights) ? weights : [];

  const terms = safeInputs.map((input, index) => {
    const weight = Number.isFinite(safeWeights[index]) ? safeWeights[index] : 0;
    const val = Number.isFinite(input) ? input : 0;
    const rawProduct = val * weight;
    return {
      index,
      input: val,
      weight,
      product: rawProduct === 0 ? 0 : rawProduct,
    };
  });

  const safeBias = Number.isFinite(bias) ? bias : 0;
  const weightedSum = terms.reduce((sum, term) => sum + term.product, safeBias);

  const act = activation === 'sigmoid' ? 'sigmoid' : 'step';
  const output = act === 'sigmoid' ? sigmoid(weightedSum) : step(weightedSum);

  return {
    weightedSum,
    output,
    terms,
    bias: safeBias,
    activation: act,
    fired: output >= 0.5,
  };
}

/**
 * Preset kid-friendly neuron decision scenarios.
 */
export const PERCEPTRON_SCENARIOS = [
  {
    id: 'park',
    title: 'Go to the Park?',
    emoji: '🌳',
    description: 'Help the neuron decide if today is a great day to play outside!',
    yesLabel: 'Yes! Grab your sneakers! 🏃',
    noLabel: 'Nope, stay cozy inside 🏠',
    kidTip: 'Negative weights act like warning signs — a thunderstorm can outvote everything else!',
    bias: -1.5,
    inputs: [
      { id: 'sunny', label: 'Sunny Sky', emoji: '☀️', defaultValue: 1, defaultWeight: 2.0 },
      { id: 'homework', label: 'Homework Done', emoji: '📚', defaultValue: 1, defaultWeight: 1.5 },
      { id: 'friends', label: 'Friends Are Free', emoji: '👯', defaultValue: 0, defaultWeight: 1.0 },
      { id: 'storm', label: 'Thunderstorm', emoji: '⛈️', defaultValue: 0, defaultWeight: -4.0 },
    ],
  },
  {
    id: 'robot',
    title: 'Friendly Robot Detector',
    emoji: '🤖',
    description: 'Decide whether a new robot visitor is friendly or up to mischief!',
    yesLabel: 'Friendly Bot! Say hi! 👋',
    noLabel: 'Careful! Activate shields! 🛡️',
    kidTip: 'Try turning on Laser Eyes and see how a big negative weight flips the neuron off.',
    bias: -1.0,
    inputs: [
      { id: 'smile', label: 'Glowing Smile', emoji: '😊', defaultValue: 1, defaultWeight: 1.5 },
      { id: 'flowers', label: 'Holding Flowers', emoji: '💐', defaultValue: 1, defaultWeight: 1.0 },
      { id: 'polite', label: 'Says Please & Thanks', emoji: '💬', defaultValue: 0, defaultWeight: 1.5 },
      { id: 'lasers', label: 'Laser Eyes', emoji: '🔴', defaultValue: 0, defaultWeight: -3.5 },
    ],
  },
  {
    id: 'pizza',
    title: 'Pizza Party Decider',
    emoji: '🍕',
    description: 'Should the crew order a giant pizza right now?',
    yesLabel: 'Pizza Time! Order up! 🎉',
    noLabel: 'Maybe sandwiches instead 🥪',
    kidTip: 'The bias sets how picky the neuron is. A lower (more negative) bias needs more positive votes!',
    bias: -2.0,
    inputs: [
      { id: 'hungry', label: 'Everyone Is Hungry', emoji: '😋', defaultValue: 1, defaultWeight: 2.0 },
      { id: 'cheese', label: 'Extra Cheese Available', emoji: '🧀', defaultValue: 1, defaultWeight: 1.5 },
      { id: 'celebrating', label: 'Special Celebration', emoji: '🎈', defaultValue: 0, defaultWeight: 1.0 },
      { id: 'ovenBroken', label: 'Pizza Oven Broken', emoji: '🔥', defaultValue: 0, defaultWeight: -5.0 },
    ],
  },
];

/**
 * Interactive logic-gate puzzles framed as kid-friendly stories.
 */
export const PERCEPTRON_CHALLENGES = [
  {
    id: 'and',
    gate: 'AND',
    title: 'The Secret Treehouse Lock',
    emoji: '🔐',
    story:
      'To open the treehouse door, a visitor must know BOTH the Secret Knock AND the Magic Password!',
    hint: 'Give both inputs positive weights (like +1 and +1), and set a negative bias (like -1.5) so one input alone is not enough.',
    inputLabels: ['Secret Knock ✊', 'Magic Password 🗝️'],
    outputLabel: 'Door Opens',
    truthTable: [
      { inputs: [0, 0], expected: 0 },
      { inputs: [0, 1], expected: 0 },
      { inputs: [1, 0], expected: 0 },
      { inputs: [1, 1], expected: 1 },
    ],
    exampleSolution: { weights: [1, 1], bias: -1.5 },
  },
  {
    id: 'or',
    gate: 'OR',
    title: 'The Rescue Beacon',
    emoji: '🚨',
    story:
      'Launch the rescue drone if EITHER the Flashlight Flashes OR the Whistle Blows (or both!).',
    hint: 'Give both inputs positive weights (like +1 and +1), and set the bias to -0.5 so just one signal is enough to reach 0.',
    inputLabels: ['Flashlight 🔦', 'Whistle 📣'],
    outputLabel: 'Send Rescue',
    truthTable: [
      { inputs: [0, 0], expected: 0 },
      { inputs: [0, 1], expected: 1 },
      { inputs: [1, 0], expected: 1 },
      { inputs: [1, 1], expected: 1 },
    ],
    exampleSolution: { weights: [1, 1], bias: -0.5 },
  },
  {
    id: 'not',
    gate: 'NOT',
    title: 'The Opposite-Day Switch',
    emoji: '🔄',
    story:
      'If it is raining, stay inside (0). If it is NOT raining, go ride bikes (1)!',
    hint: 'Use a negative weight (like -2) so turning the input ON pushes the sum below zero, and a positive bias (like +1).',
    inputLabels: ['Is Raining 🌧️'],
    outputLabel: 'Ride Bikes',
    truthTable: [
      { inputs: [0], expected: 1 },
      { inputs: [1], expected: 0 },
    ],
    exampleSolution: { weights: [-2], bias: 1 },
  },
  {
    id: 'nand',
    gate: 'NAND',
    title: 'The Cookie Jar Guard',
    emoji: '🍪',
    story:
      'Sneak a cookie UNLESS BOTH Dad is watching AND it is right before dinner!',
    hint: 'Think of AND flipped upside down: use negative weights (like -1 and -1) and a positive bias (like +1.5).',
    inputLabels: ['Dad Watching 👀', 'Before Dinner 🍽️'],
    outputLabel: 'Grab Cookie',
    truthTable: [
      { inputs: [0, 0], expected: 1 },
      { inputs: [0, 1], expected: 1 },
      { inputs: [1, 0], expected: 1 },
      { inputs: [1, 1], expected: 0 },
    ],
    exampleSolution: { weights: [-1, -1], bias: 1.5 },
  },
];

/**
 * Check a user's weights and bias against a perceptron challenge's truth table.
 *
 * @param {string|object} challengeOrId - Challenge object or its id ('and'|'or'|'not'|'nand')
 * @param {number[]} weights
 * @param {number} bias
 * @param {'step'|'sigmoid'} [activation='step']
 * @returns {{
 *   passed: boolean,
 *   score: number,
 *   total: number,
 *   results: Array<{
 *     inputs: number[],
 *     expected: number,
 *     actual: number,
 *     output: number,
 *     weightedSum: number,
 *     correct: boolean
 *   }>
 * }}
 */
export function checkPerceptronChallenge(challengeOrId, weights, bias, activation = 'step') {
  const challenge =
    typeof challengeOrId === 'string'
      ? PERCEPTRON_CHALLENGES.find((c) => c.id === challengeOrId)
      : challengeOrId;

  if (!challenge) {
    throw new Error(`Unknown perceptron challenge: ${String(challengeOrId)}`);
  }

  const results = challenge.truthTable.map((row) => {
    const { weightedSum, output } = computePerceptron(row.inputs, weights, bias, activation);
    const actual = output >= 0.5 ? 1 : 0;
    return {
      inputs: row.inputs,
      expected: row.expected,
      actual,
      output,
      weightedSum,
      correct: actual === row.expected,
    };
  });

  const score = results.filter((r) => r.correct).length;
  return {
    passed: score === results.length,
    score,
    total: results.length,
    results,
  };
}
