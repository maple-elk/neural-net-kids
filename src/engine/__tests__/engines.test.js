import { describe, it, expect } from 'vitest';

import {
  sigmoid,
  step,
  computePerceptron,
  PERCEPTRON_SCENARIOS,
  PERCEPTRON_CHALLENGES,
  checkPerceptronChallenge,
} from '../perceptron.js';

import {
  MLP,
  createMLP,
  generateDataset,
  evaluateGrid,
  lossLandscape,
  gradientStep,
  evaluateLossLandscapeGrid,
  traceBackpropStep,
  createRng,
} from '../mlp.js';

import {
  createBlankGrid,
  toggleGridCell,
  SAMPLE_GRIDS,
  SAMPLE_GRID_LIST,
  KERNELS,
  KERNEL_LIST,
  applyConvolutionStep,
  applyFullConvolution,
} from '../convolution.js';

import {
  tokenize,
  EMBEDDING_WORDS,
  WORD_MATH_PRESETS,
  wordMath,
  findNearestWords,
  ATTENTION_EXAMPLES,
  STARTER_CORPORA,
  STARTER_CORPORA_LIST,
  MiniLanguageModel,
} from '../miniLlm.js';

describe('Perceptron Engine (src/engine/perceptron.js)', () => {
  it('computes weighted sum, terms, and step activation accurately', () => {
    const res = computePerceptron([1, 0, 1], [2, -3, 1.5], -3, 'step');
    expect(res.weightedSum).toBeCloseTo(0.5, 6);
    expect(res.output).toBe(1);
    expect(res.fired).toBe(true);
    expect(res.terms).toHaveLength(3);
    expect(res.terms[0].product).toBe(2);
    expect(res.terms[1].product).toBe(0);
    expect(res.terms[2].product).toBe(1.5);

    const off = computePerceptron([1, 1], [1, -3], 0.5, 'step');
    expect(off.weightedSum).toBeCloseTo(-1.5, 6);
    expect(off.output).toBe(0);
    expect(off.fired).toBe(false);
  });

  it('computes sigmoid activation smoothly between 0 and 1', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 6);
    expect(step(0)).toBe(1);
    expect(step(-0.001)).toBe(0);

    const res = computePerceptron([1, 1], [2, 2], -4, 'sigmoid');
    expect(res.weightedSum).toBeCloseTo(0, 6);
    expect(res.output).toBeCloseTo(0.5, 6);

    const high = computePerceptron([1], [5], 0, 'sigmoid');
    expect(high.output).toBeGreaterThan(0.99);
    expect(high.output).toBeLessThan(1);
  });

  it('provides valid kid-friendly scenarios and logic-gate challenges', () => {
    expect(PERCEPTRON_SCENARIOS.length).toBeGreaterThanOrEqual(3);
    for (const scenario of PERCEPTRON_SCENARIOS) {
      const inputs = scenario.inputs.map((i) => i.defaultValue);
      const weights = scenario.inputs.map((i) => i.defaultWeight);
      const result = computePerceptron(inputs, weights, scenario.bias, 'step');
      expect(result.terms.length).toBe(scenario.inputs.length);
    }

    expect(PERCEPTRON_CHALLENGES.length).toBeGreaterThanOrEqual(3);
    for (const challenge of PERCEPTRON_CHALLENGES) {
      const { weights, bias } = challenge.exampleSolution;
      const check = checkPerceptronChallenge(challenge.id, weights, bias, 'step');
      expect(check.passed).toBe(true);
      expect(check.score).toBe(check.total);
    }

    // Wrong weights should fail AND gate
    const failCheck = checkPerceptronChallenge('and', [1, 1], 5, 'step');
    expect(failCheck.passed).toBe(false);
    expect(failCheck.score).toBeLessThan(failCheck.total);
  });
});

describe('MLP & Backprop Engine (src/engine/mlp.js)', () => {
  it('generates balanced 2D datasets within [-1, 1] for all 4 types', () => {
    for (const type of ['linear', 'circle', 'xor', 'spiral']) {
      const data = generateDataset(type, 80, 123);
      expect(data).toHaveLength(80);
      for (const pt of data) {
        expect(pt.x).toBeGreaterThanOrEqual(-1);
        expect(pt.x).toBeLessThanOrEqual(1);
        expect(pt.y).toBeGreaterThanOrEqual(-1);
        expect(pt.y).toBeLessThanOrEqual(1);
        expect([0, 1]).toContain(pt.label);
      }
      const ones = data.filter((d) => d.label === 1).length;
      expect(ones).toBeGreaterThan(20);
      expect(ones).toBeLessThan(60);
    }
  });

  it('converges on a linearly separable dataset', () => {
    const dataset = generateDataset('linear', 80, 7);
    const mlp = createMLP({
      hiddenSizes: [4],
      activation: 'tanh',
      learningRate: 0.25,
      seed: 11,
    });

    const initial = mlp.evaluate(dataset);
    let last = initial;
    for (let i = 0; i < 150; i++) {
      last = mlp.trainStep(dataset);
    }

    expect(last.loss).toBeLessThan(initial.loss);
    expect(last.accuracy).toBeGreaterThanOrEqual(0.95);
  });

  it('converges on the non-linear XOR dataset with a hidden layer', () => {
    const dataset = generateDataset('xor', 80, 19);
    const mlp = new MLP({
      hiddenSizes: [6, 4],
      activation: 'tanh',
      learningRate: 0.35,
      seed: 23,
    });

    const initial = mlp.evaluate(dataset);
    let last = initial;
    for (let i = 0; i < 400; i++) {
      last = mlp.trainStep(dataset);
    }

    expect(last.loss).toBeLessThan(0.08);
    expect(last.accuracy).toBeGreaterThanOrEqual(0.92);

    // Evaluate 2D decision boundary grid
    const grid = evaluateGrid(mlp, 12);
    expect(grid.resolution).toBe(12);
    expect(grid.values).toHaveLength(12);
    expect(grid.values[0]).toHaveLength(12);
    // Top-right (+1, +1) should be class 1 (>0.5), top-left (-1, +1) class 0 (<0.5)
    expect(grid.values[0][11]).toBeGreaterThan(0.5);
    expect(grid.values[0][0]).toBeLessThan(0.5);
  });

  it('supports relu and sigmoid hidden activations cleanly', () => {
    const dataset = generateDataset('linear', 40, 5);
    for (const activation of ['relu', 'sigmoid']) {
      const mlp = createMLP({ hiddenSizes: [4], activation, learningRate: 0.2, seed: 9 });
      const before = mlp.evaluate(dataset).loss;
      for (let i = 0; i < 80; i++) mlp.trainStep(dataset);
      const after = mlp.evaluate(dataset).loss;
      expect(Number.isFinite(after)).toBe(true);
      expect(after).toBeLessThan(before);
    }
  });

  it('rolls downhill on the 2D Loss Mountain landscape', () => {
    let w1 = -0.8;
    let w2 = 0.8;
    const startLoss = lossLandscape(w1, w2);

    for (let i = 0; i < 60; i++) {
      const stepRes = gradientStep(w1, w2, 0.12);
      expect(stepRes.nextLoss).toBeLessThanOrEqual(stepRes.loss + 1e-9);
      w1 = stepRes.w1;
      w2 = stepRes.w2;
    }

    const endLoss = lossLandscape(w1, w2);
    expect(endLoss).toBeLessThan(startLoss * 0.25);

    const grid = evaluateLossLandscapeGrid(10, 2);
    expect(grid.values).toHaveLength(10);
    expect(grid.max).toBeGreaterThan(grid.min);
  });

  it('traces single-step backprop and strictly reduces loss', () => {
    const trace = traceBackpropStep(1.0, 1.0, 0.4, -0.2, -0.5, 0.1, 0.8);
    expect(trace.forward.output).toBeGreaterThan(0);
    expect(trace.forward.output).toBeLessThan(1);
    expect(trace.nextLoss).toBeLessThan(trace.forward.loss);
    expect(trace.lossDelta).toBeLessThan(0);
    expect(trace.nextOutput).toBeGreaterThan(trace.forward.output);
  });

  it('converges in Chapter 2 (single neuron linear) and Chapter 3 (XOR with 4 hidden neurons) via both trainStep and trainEpoch', () => {
    // Chapter 2 SingleNeuronMapDemo configuration
    const linearData = generateDataset('linear', 100, 42);
    const ch2Net = createMLP({
      inputSize: 2,
      hiddenSizes: [],
      outputSize: 1,
      activation: 'tanh',
      learningRate: 0.75,
      seed: 19,
    });
    let ch2Res = null;
    for (let i = 0; i < 220; i++) {
      ch2Res = ch2Net.trainEpoch(linearData);
    }
    expect(ch2Res.epoch).toBe(220);
    expect(ch2Res.loss).toBeLessThan(0.04);
    expect(ch2Res.accuracy).toBe(1);

    // Chapter 3 XorBreakthroughDemo configuration (4 hidden neurons)
    const xorData = generateDataset('xor', 120, 42);
    const ch3Net = createMLP({
      inputSize: 2,
      hiddenSizes: [4],
      outputSize: 1,
      activation: 'tanh',
      learningRate: 0.55,
      seed: 42,
    });
    let ch3Res = null;
    for (let i = 0; i < 450; i++) {
      ch3Res = ch3Net.trainStep(xorData);
    }
    expect(ch3Res.epoch).toBe(450);
    expect(ch3Res.loss).toBeLessThan(0.045);
    expect(ch3Res.accuracy).toBeGreaterThanOrEqual(0.96);
  });
});

describe('Convolution Vision Engine (src/engine/convolution.js)', () => {
  it('creates and toggles blank 8x8 grids immutably', () => {
    const blank = createBlankGrid(8);
    expect(blank).toHaveLength(8);
    expect(blank[0]).toHaveLength(8);
    expect(blank[2][3]).toBe(0);

    const toggled = toggleGridCell(blank, 2, 3);
    expect(toggled[2][3]).toBe(1);
    expect(blank[2][3]).toBe(0); // immutable
  });

  it('includes 7 sample 8x8 grids and 5 standard 3x3 kernels', () => {
    expect(SAMPLE_GRID_LIST.length).toBeGreaterThanOrEqual(7);
    for (const item of SAMPLE_GRID_LIST) {
      expect(item.grid).toHaveLength(8);
      expect(item.grid[0]).toHaveLength(8);
    }

    expect(KERNEL_LIST.length).toBeGreaterThanOrEqual(5);
    for (const k of KERNEL_LIST) {
      expect(k.weights).toHaveLength(3);
      expect(k.weights[0]).toHaveLength(3);
    }
  });

  it('computes accurate 3x3 convolution steps and 6x6 feature maps', () => {
    // Vertical edge kernel on vertical bar should fire strongly on the bar edges
    const vStep = applyConvolutionStep(
      SAMPLE_GRIDS.verticalBar.grid,
      KERNELS.verticalEdge,
      2,
      1,
    );
    expect(vStep.patch).toHaveLength(3);
    expect(vStep.products).toHaveLength(3);
    // Patch columns at col=1 are [0, 0, 1] for all 3 rows -> right edge gives +1+2+1 = +4
    expect(vStep.value).toBe(4);

    // Horizontal edge kernel on vertical bar should be 0 everywhere!
    const hOnV = applyFullConvolution(SAMPLE_GRIDS.verticalBar.grid, KERNELS.horizontalEdge);
    expect(hOnV.rows).toBe(6);
    expect(hOnV.cols).toBe(6);
    expect(hOnV.maxAbs).toBe(0);

    // Horizontal edge kernel on horizontal bar should respond strongly!
    const hOnH = applyFullConvolution(SAMPLE_GRIDS.horizontalBar.grid, KERNELS.horizontalEdge);
    expect(hOnH.maxAbs).toBe(4);

    // Box blur on all-ones patch returns 1
    const allOnes = Array.from({ length: 8 }, () => new Array(8).fill(1));
    const blurred = applyConvolutionStep(allOnes, KERNELS.blur, 0, 0);
    expect(blurred.value).toBeCloseTo(1, 6);
  });
});

describe('Mini-LLM Language Engine (src/engine/miniLlm.js)', () => {
  it('tokenizes words into subword pieces with deterministic IDs and color indices', () => {
    const tokens1 = tokenize('Unhappily, robots are rebuilding!');
    const tokens2 = tokenize('Unhappily, robots are rebuilding!');

    expect(tokens1).toEqual(tokens2);
    const texts = tokens1.map((t) => t.text);
    // Prefix/suffix splitting checks
    expect(texts).toContain('Un');
    expect(texts).toContain('ly');
    expect(texts).toContain('re');
    expect(texts).toContain('ing');
    expect(texts).toContain('!');

    for (const tok of tokens1) {
      expect(Number.isInteger(tok.id)).toBe(true);
      expect(tok.id).toBeGreaterThanOrEqual(100);
      expect(tok.colorIndex).toBeGreaterThanOrEqual(0);
      expect(tok.colorIndex).toBeLessThan(8);
    }
  });

  it('solves classic vector analogies with wordMath() in both 2D and 3D and exposes concrete vectors', () => {
    expect(EMBEDDING_WORDS.length).toBeGreaterThanOrEqual(24);
    expect(WORD_MATH_PRESETS.length).toBeGreaterThanOrEqual(3);

    // Every word has valid 3D coordinates (x, y, z) in [-1, 1]
    for (const entry of EMBEDDING_WORDS) {
      expect(Number.isFinite(entry.z)).toBe(true);
      expect(entry.z).toBeGreaterThanOrEqual(-1);
      expect(entry.z).toBeLessThanOrEqual(1);
    }

    // Every preset has an offsetLabel and resolves to expected top-1 match in BOTH 2D and 3D
    for (const preset of WORD_MATH_PRESETS) {
      expect(typeof preset.offsetLabel).toBe('string');
      expect(preset.offsetLabel.length).toBeGreaterThan(0);

      for (const use3D of [false, true]) {
        const res = wordMath(preset.a, preset.b, preset.c, { topN: 5, use3D });
        expect(res.use3D).toBe(use3D);
        expect(res.bestMatch.word).toBe(preset.expected);
        expect(res.bestMatch.similarity).toBeGreaterThan(0.95);
        expect(res.matches).toEqual(res.results);

        // Verify exact vecA - vecB = diffVec and diffVec + vecC = resultVec
        expect(res.diffVec.x).toBeCloseTo(res.vecA.x - res.vecB.x, 4);
        expect(res.diffVec.y).toBeCloseTo(res.vecA.y - res.vecB.y, 4);
        expect(res.diffVec.z).toBeCloseTo(res.vecA.z - res.vecB.z, 4);

        expect(res.resultVec.x).toBeCloseTo(res.vecA.x - res.vecB.x + res.vecC.x, 4);
        expect(res.resultVec.y).toBeCloseTo(res.vecA.y - res.vecB.y + res.vecC.y, 4);
        expect(res.resultVec.z).toBeCloseTo(res.vecA.z - res.vecB.z + res.vecC.z, 4);

        for (const match of res.matches) {
          expect(match.distance).toBeGreaterThanOrEqual(0);
          expect(match.similarity).toBeGreaterThan(0);
          expect(match.similarity).toBeLessThanOrEqual(1);
          expect(match.cosineSim).toBeGreaterThanOrEqual(-1.0001);
          expect(match.cosineSim).toBeLessThanOrEqual(1.0001);
        }
      }
    }

    // Backwards-compatible numeric topN call still works
    const legacy = wordMath('king', 'man', 'woman', 3);
    expect(legacy.results).toHaveLength(3);
    expect(legacy.bestMatch.word).toBe('queen');
  });

  it('finds sorted nearest semantic neighbors in 2D and 3D with findNearestWords()', () => {
    for (const use3D of [false, true]) {
      const neighbors = findNearestWords('king', 3, use3D);
      expect(neighbors).toHaveLength(3);
      expect(neighbors.some((n) => n.word === 'king')).toBe(false);
      // Royalty cluster neighbors should appear closest to king
      expect(['prince', 'queen', 'man', 'princess']).toContain(neighbors[0].word);
      for (let i = 1; i < neighbors.length; i++) {
        expect(neighbors[i].distance).toBeGreaterThanOrEqual(neighbors[i - 1].distance);
      }
    }

    expect(findNearestWords('not-a-word', 3, true)).toEqual([]);
  });

  it('provides normalized attention weight matrices for Winograd pronoun pairs', () => {
    expect(ATTENTION_EXAMPLES.length).toBeGreaterThanOrEqual(4);

    for (const ex of ATTENTION_EXAMPLES) {
      expect(ex.weights).toHaveLength(ex.tokens.length);
      for (const row of ex.weights) {
        expect(row).toHaveLength(ex.tokens.length);
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1.0, 2);
      }

      // Focus token ("it") should attend most strongly to its referent
      const focusRow = ex.weights[ex.focusIndex];
      const maxWeight = Math.max(...focusRow);
      expect(focusRow[ex.referentIndex]).toBe(maxWeight);
    }
  });

  it('trains MiniLanguageModel on starter & custom corpora and respects temperature/topK', () => {
    expect(STARTER_CORPORA_LIST.length).toBeGreaterThanOrEqual(4);

    const model = new MiniLanguageModel();
    const stats = model.train(STARTER_CORPORA.space.text);
    expect(stats.tokenCount).toBeGreaterThan(50);
    expect(stats.vocabSize).toBeGreaterThan(20);

    // Custom corpus with clear frequency skew: "the cat sat" x5, "the cat jumped" x1, "the cat slept" x1
    const custom = new MiniLanguageModel();
    custom.train(
      'the cat sat. the cat sat. the cat sat. the cat sat. the cat sat. the cat jumped. the cat slept.',
    );

    const coldDist = custom.getNextTokenDistribution(['the', 'cat'], 0.2, 3);
    const hotDist = custom.getNextTokenDistribution(['the', 'cat'], 2.5, 3);

    expect(coldDist).toHaveLength(3);
    expect(coldDist[0].token).toBe('sat');
    // Probabilities sum to 1
    expect(coldDist.reduce((s, d) => s + d.probability, 0)).toBeCloseTo(1, 6);
    expect(hotDist.reduce((s, d) => s + d.probability, 0)).toBeCloseTo(1, 6);

    // Lower temperature concentrates probability more sharply on top token than higher temperature
    expect(coldDist[0].probability).toBeGreaterThan(hotDist[0].probability);

    // Deterministic sampling with seeded RNG
    const rng = createRng(99);
    const sample = custom.sampleNextToken(['the', 'cat'], 0.5, 3, rng);
    expect(['sat', 'jumped', 'slept']).toContain(sample.token);

    // Multi-token generation produces readable text
    const gen = model.generate('The silver', 10, 0.8, 5, createRng(7));
    expect(gen.tokens.length).toBe(12);
    expect(gen.text.startsWith('the silver')).toBe(true);
  });
});
