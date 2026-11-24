/**
 * Multi-Layer Perceptron (MLP), Dataset Generators & Backprop Engine
 * (Stage 2: Layers & Boundaries, Stage 3: Learning from Mistakes)
 * Zero-dependency pure ESM module running 100% in the browser.
 */

/**
 * Deterministic Mulberry32 PRNG for reproducible datasets and weight initialization.
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed = 42) {
  let state = (seed >>> 0) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Activation functions and their derivatives with respect to pre-activation z.
 */
export const ACTIVATIONS = {
  relu: {
    fn: (z) => (z > 0 ? z : 0),
    deriv: (z) => (z > 0 ? 1 : 0),
  },
  tanh: {
    fn: (z) => Math.tanh(z),
    deriv: (z) => {
      const t = Math.tanh(z);
      return 1 - t * t;
    },
  },
  sigmoid: {
    fn: (z) => {
      if (z >= 40) return 1;
      if (z <= -40) return 0;
      return 1 / (1 + Math.exp(-z));
    },
    deriv: (z) => {
      const s = ACTIVATIONS.sigmoid.fn(z);
      return s * (1 - s);
    },
  },
};

/**
 * Generate a 2D binary classification dataset with coordinates in [-1, 1].
 *
 * @param {'linear'|'circle'|'xor'|'spiral'} [type='circle']
 * @param {number} [count=120]
 * @param {number} [seed=42]
 * @returns {Array<{ x: number, y: number, label: 0|1 }>}
 */
export function generateDataset(type = 'circle', count = 120, seed = 42) {
  const rng = createRng(seed);
  const points = [];
  const half = Math.floor(count / 2);

  if (type === 'linear') {
    for (let i = 0; i < count; i++) {
      let x = rng() * 1.9 - 0.95;
      let y = rng() * 1.9 - 0.95;
      // Push points slightly away from the diagonal x + y = 0 for a clean margin
      if (Math.abs(x + y) < 0.14) {
        if (x + y >= 0) {
          x = Math.min(0.95, x + 0.12);
          y = Math.min(0.95, y + 0.12);
        } else {
          x = Math.max(-0.95, x - 0.12);
          y = Math.max(-0.95, y - 0.12);
        }
      }
      const label = x + y >= 0 ? 1 : 0;
      points.push({ x, y, label });
    }
    return points;
  }

  if (type === 'circle') {
    for (let i = 0; i < half; i++) {
      const r = Math.sqrt(rng()) * 0.48;
      const angle = rng() * Math.PI * 2;
      points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), label: 1 });
    }
    for (let i = half; i < count; i++) {
      const r = 0.66 + rng() * 0.28;
      const angle = rng() * Math.PI * 2;
      points.push({ x: r * Math.cos(angle), y: r * Math.sin(angle), label: 0 });
    }
    return points;
  }

  if (type === 'xor') {
    for (let i = 0; i < count; i++) {
      const q = i % 4;
      const sx = q === 0 || q === 3 ? 1 : -1;
      const sy = q === 0 || q === 1 ? 1 : -1;
      const x = sx * (0.15 + rng() * 0.78);
      const y = sy * (0.15 + rng() * 0.78);
      const label = sx * sy > 0 ? 1 : 0;
      points.push({ x, y, label });
    }
    return points;
  }

  if (type === 'spiral') {
    const genArm = (n, deltaT, label) => {
      for (let i = 0; i < n; i++) {
        const frac = i / Math.max(1, n - 1);
        const r = 0.08 + frac * 0.84;
        const t = 1.75 * frac * 2 * Math.PI + deltaT;
        const noiseX = (rng() - 0.5) * 0.07;
        const noiseY = (rng() - 0.5) * 0.07;
        const x = Math.max(-1, Math.min(1, r * Math.sin(t) + noiseX));
        const y = Math.max(-1, Math.min(1, r * Math.cos(t) + noiseY));
        points.push({ x, y, label });
      }
    };
    genArm(half, 0, 1);
    genArm(count - half, Math.PI, 0);
    return points;
  }

  throw new Error(`Unknown dataset type: ${type}`);
}

/**
 * In-browser Multi-Layer Perceptron with backpropagation and MSE loss.
 */
export class MLP {
  /**
   * @param {object} [options]
   * @param {number} [options.inputSize=2]
   * @param {number[]} [options.hiddenSizes=[4, 4]]
   * @param {number} [options.outputSize=1]
   * @param {'relu'|'tanh'|'sigmoid'} [options.activation='tanh']
   * @param {number} [options.learningRate=0.1]
   * @param {number} [options.seed=42]
   */
  constructor({
    inputSize = 2,
    hiddenSizes = [4, 4],
    outputSize = 1,
    activation = 'tanh',
    learningRate = 0.1,
    seed = 42,
  } = {}) {
    this.inputSize = inputSize;
    this.hiddenSizes = Array.isArray(hiddenSizes) ? [...hiddenSizes] : [4];
    this.outputSize = outputSize;
    this.activation = ACTIVATIONS[activation] ? activation : 'tanh';
    this.learningRate = learningRate;
    this.seed = seed;
    this.layerSizes = [this.inputSize, ...this.hiddenSizes, this.outputSize];
    this.epoch = 0;
    this.layers = [];
    this.reset(seed);
  }

  /**
   * Re-initialize all weights and biases deterministically.
   * @param {number} [seed=this.seed]
   */
  reset(seed = this.seed) {
    this.seed = seed;
    this.epoch = 0;
    const rng = createRng(seed);
    this.layers = [];

    for (let l = 0; l < this.layerSizes.length - 1; l++) {
      const fanIn = this.layerSizes[l];
      const fanOut = this.layerSizes[l + 1];
      const isOutput = l === this.layerSizes.length - 2;
      const scale =
        !isOutput && this.activation === 'relu'
          ? Math.sqrt(2 / fanIn)
          : Math.sqrt(2 / (fanIn + fanOut));

      const weights = Array.from({ length: fanOut }, () =>
        Array.from({ length: fanIn }, () => (rng() * 2 - 1) * scale * 1.4),
      );
      const biases = Array.from({ length: fanOut }, () => (rng() * 2 - 1) * 0.1);
      this.layers.push({ weights, biases });
    }
  }

  /**
   * Run a forward pass and return activations at every layer.
   * @param {number[]} inputs
   * @returns {{ output: number, outputs: number[], activations: number[][], preActivations: number[][] }}
   */
  forward(inputs) {
    const hiddenAct = ACTIVATIONS[this.activation];
    const outAct = ACTIVATIONS.sigmoid;
    const activations = [[...inputs]];
    const preActivations = [];

    let current = inputs;
    for (let l = 0; l < this.layers.length; l++) {
      const { weights, biases } = this.layers[l];
      const isOutput = l === this.layers.length - 1;
      const act = isOutput ? outAct : hiddenAct;
      const zVec = new Array(weights.length);
      const aVec = new Array(weights.length);

      for (let j = 0; j < weights.length; j++) {
        let sum = biases[j];
        const wRow = weights[j];
        for (let i = 0; i < wRow.length; i++) {
          sum += wRow[i] * current[i];
        }
        zVec[j] = sum;
        aVec[j] = act.fn(sum);
      }

      preActivations.push(zVec);
      activations.push(aVec);
      current = aVec;
    }

    return {
      output: current[0],
      outputs: current,
      activations,
      preActivations,
    };
  }

  /**
   * Predict binary class probability in [0, 1] for a 2D point (x, y).
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  predict(x, y) {
    return this.forward([x, y]).output;
  }

  /**
   * Compute Mean Squared Error (MSE) loss and classification accuracy on a dataset.
   * @param {Array<{ x: number, y: number, label: number }>} dataset
   * @returns {{ loss: number, accuracy: number }}
   */
  evaluate(dataset) {
    if (!dataset || dataset.length === 0) {
      return { loss: 0, accuracy: 0 };
    }
    let totalLoss = 0;
    let correct = 0;
    for (let i = 0; i < dataset.length; i++) {
      const pt = dataset[i];
      const pred = this.predict(pt.x, pt.y);
      const diff = pred - pt.label;
      totalLoss += diff * diff;
      if ((pred >= 0.5 ? 1 : 0) === pt.label) {
        correct += 1;
      }
    }
    return {
      loss: totalLoss / dataset.length,
      accuracy: correct / dataset.length,
    };
  }

  /**
   * Perform one full-batch gradient descent backpropagation step over the dataset.
   * @param {Array<{ x: number, y: number, label: number }>} dataset
   * @param {number} [lr=this.learningRate]
   * @returns {{ epoch: number, loss: number, accuracy: number }}
   */
  trainStep(dataset, lr = this.learningRate) {
    if (!dataset || dataset.length === 0) {
      return { epoch: this.epoch, loss: 0, accuracy: 0 };
    }

    const numLayers = this.layers.length;
    const hiddenAct = ACTIVATIONS[this.activation];
    const outAct = ACTIVATIONS.sigmoid;

    const gradW = this.layers.map((layer) =>
      layer.weights.map((row) => new Array(row.length).fill(0)),
    );
    const gradB = this.layers.map((layer) => new Array(layer.biases.length).fill(0));

    let totalLoss = 0;
    let correct = 0;

    for (let n = 0; n < dataset.length; n++) {
      const pt = dataset[n];
      const { activations, preActivations, output } = this.forward([pt.x, pt.y]);
      const error = output - pt.label;
      totalLoss += error * error;
      if ((output >= 0.5 ? 1 : 0) === pt.label) {
        correct += 1;
      }

      // Compute deltas backward from output layer to first hidden layer
      const deltas = new Array(numLayers);
      const lastIdx = numLayers - 1;
      const lastZ = preActivations[lastIdx];
      deltas[lastIdx] = [2 * error * outAct.deriv(lastZ[0])];

      for (let l = lastIdx - 1; l >= 0; l--) {
        const nextWeights = this.layers[l + 1].weights;
        const nextDelta = deltas[l + 1];
        const currZ = preActivations[l];
        const currDelta = new Array(currZ.length);

        for (let i = 0; i < currZ.length; i++) {
          let sum = 0;
          for (let j = 0; j < nextDelta.length; j++) {
            sum += nextWeights[j][i] * nextDelta[j];
          }
          currDelta[i] = sum * hiddenAct.deriv(currZ[i]);
        }
        deltas[l] = currDelta;
      }

      // Accumulate gradients
      for (let l = 0; l < numLayers; l++) {
        const aPrev = activations[l];
        const delta = deltas[l];
        const gW = gradW[l];
        const gB = gradB[l];

        for (let j = 0; j < delta.length; j++) {
          gB[j] += delta[j];
          const gWRow = gW[j];
          for (let i = 0; i < aPrev.length; i++) {
            gWRow[i] += delta[j] * aPrev[i];
          }
        }
      }
    }

    // Apply averaged gradient step
    const scale = lr / dataset.length;
    for (let l = 0; l < numLayers; l++) {
      const { weights, biases } = this.layers[l];
      const gW = gradW[l];
      const gB = gradB[l];

      for (let j = 0; j < weights.length; j++) {
        biases[j] -= scale * gB[j];
        const wRow = weights[j];
        const gWRow = gW[j];
        for (let i = 0; i < wRow.length; i++) {
          wRow[i] -= scale * gWRow[i];
        }
      }
    }

    this.epoch += 1;
    return {
      epoch: this.epoch,
      loss: totalLoss / dataset.length,
      accuracy: correct / dataset.length,
    };
  }

  /**
   * Return a clean snapshot of weights and layer architecture for UI rendering.
   */
  getSnapshot() {
    return {
      layerSizes: [...this.layerSizes],
      activation: this.activation,
      learningRate: this.learningRate,
      epoch: this.epoch,
      layers: this.layers.map((layer) => ({
        weights: layer.weights.map((row) => [...row]),
        biases: [...layer.biases],
      })),
    };
  }
}

/**
 * Convenience factory for creating an MLP instance.
 * @param {object} [config]
 * @returns {MLP}
 */
export function createMLP(config = {}) {
  return new MLP(config);
}

/**
 * Evaluate a 2D decision boundary grid over [-1, 1] x [-1, 1].
 * Row 0 corresponds to y = +1 (top), row (resolution - 1) to y = -1 (bottom).
 * Col 0 corresponds to x = -1 (left), col (resolution - 1) to x = +1 (right).
 *
 * @param {MLP} network
 * @param {number} [resolution=24]
 * @returns {{ resolution: number, values: number[][] }}
 */
export function evaluateGrid(network, resolution = 24) {
  const res = Math.max(2, Math.floor(resolution));
  const values = [];

  for (let r = 0; r < res; r++) {
    const y = 1 - (2 * r) / (res - 1);
    const row = new Array(res);
    for (let c = 0; c < res; c++) {
      const x = -1 + (2 * c) / (res - 1);
      row[c] = network.predict(x, y);
    }
    values.push(row);
  }

  return { resolution: res, values };
}

/**
 * Smooth 2D "Loss Mountain" landscape for Stage 3 gradient descent visualization.
 * Has a clear global valley near (0.8, -0.6) and a hill near (-0.6, 0.6).
 *
 * @param {number} w1
 * @param {number} w2
 * @returns {number}
 */
export function lossLandscape(w1, w2) {
  const dxValley = w1 - 0.8;
  const dyValley = w2 + 0.6;
  const bowl = 0.35 * (dxValley * dxValley + dyValley * dyValley);

  const dxHill = w1 + 0.6;
  const dyHill = w2 - 0.6;
  const hill = 0.65 * Math.exp(-(dxHill * dxHill + dyHill * dyHill) / 0.55);

  return bowl + hill;
}

/**
 * Exact analytical gradient [dL/dw1, dL/dw2] of lossLandscape(w1, w2).
 *
 * @param {number} w1
 * @param {number} w2
 * @returns {{ dw1: number, dw2: number }}
 */
export function lossLandscapeGradient(w1, w2) {
  const dxValley = w1 - 0.8;
  const dyValley = w2 + 0.6;

  const dxHill = w1 + 0.6;
  const dyHill = w2 - 0.6;
  const hillExp = 0.65 * Math.exp(-(dxHill * dxHill + dyHill * dyHill) / 0.55);
  const hillFactor = (-2 / 0.55) * hillExp;

  return {
    dw1: 0.7 * dxValley + hillFactor * dxHill,
    dw2: 0.7 * dyValley + hillFactor * dyHill,
  };
}

/**
 * Perform one gradient descent step on the 2D Loss Mountain.
 *
 * @param {number} w1
 * @param {number} w2
 * @param {number} [lr=0.15]
 * @returns {{
 *   w1: number,
 *   w2: number,
 *   prevW1: number,
 *   prevW2: number,
 *   loss: number,
 *   nextLoss: number,
 *   grad: { dw1: number, dw2: number },
 *   gradMagnitude: number
 * }}
 */
export function gradientStep(w1, w2, lr = 0.15) {
  const loss = lossLandscape(w1, w2);
  const grad = lossLandscapeGradient(w1, w2);
  const nextW1 = w1 - lr * grad.dw1;
  const nextW2 = w2 - lr * grad.dw2;
  const nextLoss = lossLandscape(nextW1, nextW2);
  const gradMagnitude = Math.hypot(grad.dw1, grad.dw2);

  return {
    w1: nextW1,
    w2: nextW2,
    prevW1: w1,
    prevW2: w2,
    loss,
    nextLoss,
    grad,
    gradMagnitude,
  };
}

/**
 * Sample the 2D Loss Mountain into a grid for heatmap/contour rendering.
 * @param {number} [resolution=25]
 * @param {number} [range=2]
 * @returns {{ resolution: number, range: number, values: number[][], min: number, max: number }}
 */
export function evaluateLossLandscapeGrid(resolution = 25, range = 2) {
  const res = Math.max(2, Math.floor(resolution));
  const values = [];
  let min = Infinity;
  let max = -Infinity;

  for (let r = 0; r < res; r++) {
    const w2 = range - (2 * range * r) / (res - 1);
    const row = new Array(res);
    for (let c = 0; c < res; c++) {
      const w1 = -range + (2 * range * c) / (res - 1);
      const val = lossLandscape(w1, w2);
      row[c] = val;
      if (val < min) min = val;
      if (val > max) max = val;
    }
    values.push(row);
  }

  return { resolution: res, range, values, min, max };
}

/**
 * Trace a single step of backpropagation through a tiny 1-1-1 sigmoid neural network:
 *   z1 = w1 * x + b1,  h = sigmoid(z1)
 *   z2 = w2 * h + b2,  y = sigmoid(z2)
 *   loss = 0.5 * (y - target)^2
 *
 * @param {number} x - Input value
 * @param {number} target - Desired output in [0, 1]
 * @param {number} w1 - Input-to-hidden weight
 * @param {number} b1 - Hidden bias
 * @param {number} w2 - Hidden-to-output weight
 * @param {number} b2 - Output bias
 * @param {number} [lr=0.5] - Learning rate
 * @returns {{
 *   forward: { x: number, z1: number, h: number, z2: number, output: number, target: number, error: number, loss: number },
 *   gradients: { dL_dy: number, delta2: number, dL_dw2: number, dL_db2: number, dL_dh: number, delta1: number, dL_dw1: number, dL_db1: number },
 *   updatedWeights: { w1: number, b1: number, w2: number, b2: number },
 *   nextOutput: number,
 *   nextLoss: number,
 *   lossDelta: number
 * }}
 */
export function traceBackpropStep(x, target, w1, b1, w2, b2, lr = 0.5) {
  const sig = ACTIVATIONS.sigmoid.fn;

  // 1. Forward pass
  const z1 = w1 * x + b1;
  const h = sig(z1);
  const z2 = w2 * h + b2;
  const output = sig(z2);
  const error = output - target;
  const loss = 0.5 * error * error;

  // 2. Backward pass (chain rule)
  const dL_dy = error;
  const delta2 = dL_dy * output * (1 - output);
  const dL_dw2 = delta2 * h;
  const dL_db2 = delta2;

  const dL_dh = delta2 * w2;
  const delta1 = dL_dh * h * (1 - h);
  const dL_dw1 = delta1 * x;
  const dL_db1 = delta1;

  // 3. Gradient descent weight update
  const updatedWeights = {
    w1: w1 - lr * dL_dw1,
    b1: b1 - lr * dL_db1,
    w2: w2 - lr * dL_dw2,
    b2: b2 - lr * dL_db2,
  };

  // 4. Re-evaluate after update to show loss improvement
  const nextH = sig(updatedWeights.w1 * x + updatedWeights.b1);
  const nextOutput = sig(updatedWeights.w2 * nextH + updatedWeights.b2);
  const nextError = nextOutput - target;
  const nextLoss = 0.5 * nextError * nextError;

  return {
    forward: { x, z1, h, z2, output, target, error, loss },
    gradients: {
      dL_dy,
      delta2,
      dL_dw2,
      dL_db2,
      dL_dh,
      delta1,
      dL_dw1,
      dL_db1,
    },
    updatedWeights,
    nextOutput,
    nextLoss,
    lossDelta: nextLoss - loss,
  };
}
