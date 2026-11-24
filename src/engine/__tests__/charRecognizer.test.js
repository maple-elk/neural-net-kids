import { describe, it, expect } from 'vitest';

import {
  DIGITS,
  LETTERS,
  preprocessDrawing,
  createCharRecognizer,
  rasterizeStrokes,
  renderSampleChar,
} from '../charRecognizer.js';

/**
 * Helper: convert a 2D grayscale [0,1] grid into a flat transparent-bg RGBA buffer.
 */
function gridToTransparentRgba(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 30;
      data[idx + 1] = 41;
      data[idx + 2] = 59;
      data[idx + 3] = Math.round(grid[y][x] * 255);
    }
  }
  return { data, width: w, height: h };
}

/**
 * Helper: convert a 2D grayscale [0,1] grid into a flat opaque white-bg RGBA buffer.
 */
function gridToWhiteBgRgba(grid) {
  const h = grid.length;
  const w = grid[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const shade = Math.round((1 - grid[y][x]) * 255);
      data[idx] = shade;
      data[idx + 1] = shade;
      data[idx + 2] = shade;
      data[idx + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe('Hand-Drawn Character Recognizer (src/engine/charRecognizer.js)', () => {
  it('returns hasInk: false for blank inputs', () => {
    const blank2d = Array.from({ length: 32 }, () => new Array(32).fill(0));
    const res = preprocessDrawing(blank2d);
    expect(res.hasInk).toBe(false);
    expect(res.bbox).toBeNull();
    expect(res.normalizedGrid).toHaveLength(16);
    expect(res.normalizedGrid[0]).toHaveLength(16);

    const recognizer = createCharRecognizer('digits');
    const pred = recognizer.recognize(blank2d);
    expect(pred.hasInk).toBe(false);
    expect(pred.prediction).toBeNull();
    expect(pred.confidence).toBe(0);
    expect(pred.topK).toEqual([]);
  });

  it('crops, preserves aspect ratio, and centers off-center strokes from RGBA & 2D grids', () => {
    // Draw a tall vertical bar in the top-left quadrant of a 64x64 grid
    const grid = Array.from({ length: 64 }, () => new Array(64).fill(0));
    for (let y = 4; y <= 28; y++) {
      for (let x = 6; x <= 9; x++) {
        grid[y][x] = 1;
      }
    }

    const from2d = preprocessDrawing(grid);
    const fromTransRgba = preprocessDrawing(gridToTransparentRgba(grid));
    const fromWhiteRgba = preprocessDrawing(gridToWhiteBgRgba(grid));

    for (const res of [from2d, fromTransRgba, fromWhiteRgba]) {
      expect(res.hasInk).toBe(true);
      expect(res.bbox).toEqual({ minX: 6, maxX: 9, minY: 4, maxY: 28, width: 4, height: 25 });
      expect(res.normalizedGrid).toHaveLength(16);
      expect(res.normalizedGrid[0]).toHaveLength(16);

      // Compute center of mass — should be close to center (7.5, 7.5)
      let mass = 0;
      let cx = 0;
      let cy = 0;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const v = res.normalizedGrid[y][x];
          mass += v;
          cx += x * v;
          cy += y * v;
        }
      }
      expect(cx / mass).toBeGreaterThan(5.5);
      expect(cx / mass).toBeLessThan(9.5);
      expect(cy / mass).toBeGreaterThan(5.5);
      expect(cy / mass).toBeLessThan(9.5);
    }
  });

  it('accurately recognizes all digits 0-9 (including RGBA canvas input & slight slant)', () => {
    const recognizer = createCharRecognizer('digits');

    for (const digit of DIGITS) {
      const sample = renderSampleChar(digit, 64);
      const imgData = gridToTransparentRgba(sample);
      const res = recognizer.recognize(imgData);

      expect(res.hasInk).toBe(true);
      expect(res.prediction).toBe(digit);
      expect(res.confidence).toBeGreaterThan(0.25);
      expect(res.topK).toHaveLength(5);
      expect(res.topK[0].char).toBe(digit);
      expect(res.topK[0].prob).toBeCloseTo(res.confidence, 6);
      // Probabilities should be strictly non-increasing
      for (let i = 1; i < res.topK.length; i++) {
        expect(res.topK[i - 1].prob).toBeGreaterThanOrEqual(res.topK[i].prob);
      }
    }
  });

  it('accurately recognizes all uppercase letters A-Z', () => {
    const recognizer = createCharRecognizer('letters');
    let correct = 0;
    const misses = [];

    for (const letter of LETTERS) {
      const sample = renderSampleChar(letter, 64);
      const imgData = gridToWhiteBgRgba(sample);
      const res = recognizer.recognize(imgData);
      if (res.prediction === letter) {
        correct += 1;
      } else {
        misses.push(`${letter}->${res.prediction}`);
      }
    }

    expect(misses).toEqual([]);
    expect(correct).toBe(LETTERS.length);
  });

  it('recognizes hand-drawn noisy/offset strokes cleanly', () => {
    const recognizer = createCharRecognizer('digits');

    // Hand-drawn-like '7' (top bar slightly tilted + diagonal down-left)
    const drawn7 = rasterizeStrokes(
      [[[0.18, 0.14], [0.82, 0.1], [0.36, 0.92]]],
      80,
      3.5,
      0.06,
    );
    expect(recognizer.recognize(drawn7).prediction).toBe('7');

    // Hand-drawn-like '1' (slightly slanted single vertical stroke)
    const drawn1 = rasterizeStrokes([[[0.52, 0.08], [0.46, 0.94]]], 80, 3.2, 0);
    expect(recognizer.recognize(drawn1).prediction).toBe('1');

    // Hand-drawn-like '4' (open-top L + vertical line)
    const drawn4 = rasterizeStrokes(
      [
        [[0.22, 0.1], [0.24, 0.56], [0.84, 0.54]],
        [[0.68, 0.08], [0.66, 0.94]],
      ],
      80,
      3.2,
      0,
    );
    expect(recognizer.recognize(drawn4).prediction).toBe('4');
  });

  it('supports live teach(), getCustomCount(), and resetCustom() handwriting adaptation', () => {
    const recognizer = createCharRecognizer('digits');
    expect(recognizer.getCustomCount()).toBe(0);

    // Draw an unusual custom symbol (a horizontal zigzag) and teach it as '5'
    const customDoodle = rasterizeStrokes(
      [[[0.15, 0.3], [0.5, 0.7], [0.85, 0.3]]],
      64,
      3.0,
      0,
    );

    const taught = recognizer.teach('5', customDoodle);
    expect(taught.added).toBe(true);
    expect(taught.char).toBe('5');
    expect(taught.customCount).toBe(1);
    expect(recognizer.getCustomCount()).toBe(1);

    // Immediately recognizes the user's custom style as '5'
    const res = recognizer.recognize(customDoodle);
    expect(res.prediction).toBe('5');
    expect(res.confidence).toBeGreaterThan(0.5);

    // Resetting clears custom prototypes
    recognizer.resetCustom();
    expect(recognizer.getCustomCount()).toBe(0);
  });

  it('runs recognition in under 5ms per drawing on average', () => {
    const recognizer = createCharRecognizer('letters');
    const sample = gridToTransparentRgba(renderSampleChar('A', 120));

    // Warm up
    recognizer.recognize(sample);

    const iterations = 20;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      recognizer.recognize(sample);
    }
    const avgMs = (performance.now() - start) / iterations;
    expect(avgMs).toBeLessThan(5);
  });

  it('returns a valid, bounded networkTrace with distinct hidden activations per character', () => {
    const digitRec = createCharRecognizer('digits');
    const res7 = digitRec.recognize(renderSampleChar('7', 64));
    const res0 = digitRec.recognize(renderSampleChar('0', 64));

    const trace7 = res7.networkTrace;
    expect(trace7).toBeDefined();
    expect(trace7.inputNodes).toHaveLength(16);
    expect(trace7.hiddenNodes).toHaveLength(12);
    expect(trace7.outputNodes).toHaveLength(10);
    expect(trace7.outputNodes.map((n) => n.char)).toEqual(DIGITS);
    expect(trace7.outputNodes.filter((n) => n.isWinner)).toHaveLength(1);
    expect(trace7.outputNodes.find((n) => n.isWinner).char).toBe('7');

    for (const node of trace7.inputNodes) {
      expect(node.activation).toBeGreaterThanOrEqual(0);
      expect(node.activation).toBeLessThanOrEqual(1);
    }
    for (const node of trace7.hiddenNodes) {
      expect(node.activation).toBeGreaterThanOrEqual(0);
      expect(node.activation).toBeLessThanOrEqual(1);
      expect(typeof node.label).toBe('string');
      expect(typeof node.shortLabel).toBe('string');
      expect(typeof node.description).toBe('string');
    }

    expect(trace7.inputToHiddenEdges.length).toBeGreaterThanOrEqual(35);
    expect(trace7.inputToHiddenEdges.length).toBeLessThanOrEqual(52);
    for (const edge of trace7.inputToHiddenEdges) {
      expect(edge.from).toBeGreaterThanOrEqual(0);
      expect(edge.from).toBeLessThan(16);
      expect(edge.to).toBeGreaterThanOrEqual(0);
      expect(edge.to).toBeLessThan(12);
      expect(edge.weight).toBeGreaterThanOrEqual(-1);
      expect(edge.weight).toBeLessThanOrEqual(1);
    }

    expect(trace7.hiddenToOutputEdges.length).toBe(40);
    for (const edge of trace7.hiddenToOutputEdges) {
      expect(edge.from).toBeGreaterThanOrEqual(0);
      expect(edge.from).toBeLessThan(12);
      expect(edge.to).toBeGreaterThanOrEqual(0);
      expect(edge.to).toBeLessThan(10);
      expect(edge.weight).toBeGreaterThanOrEqual(-1);
      expect(edge.weight).toBeLessThanOrEqual(1);
    }

    // Distinct interpretable activations: '7' vs '0'
    const getHidden = (trace, id) => trace.hiddenNodes.find((n) => n.id === id).activation;
    expect(getHidden(trace7, 'topBar')).toBeGreaterThan(0.35);
    expect(getHidden(trace7, 'diagSlash')).toBeGreaterThan(getHidden(res0.networkTrace, 'diagSlash'));
    expect(getHidden(res0.networkTrace, 'bottomLoop')).toBeGreaterThan(
      getHidden(trace7, 'bottomLoop'),
    );

    // Letters charset returns top 10 highest-probability letters
    const letterRec = createCharRecognizer('letters');
    const resL = letterRec.recognize(renderSampleChar('L', 64));
    expect(resL.networkTrace.outputNodes).toHaveLength(10);
    expect(resL.networkTrace.outputNodes[0].char).toBe('L');
    expect(resL.networkTrace.outputNodes[0].isWinner).toBe(true);
    expect(getHidden(resL.networkTrace, 'leftStem')).toBeGreaterThan(0.35);
    expect(getHidden(resL.networkTrace, 'bottomBar')).toBeGreaterThan(0.35);
  });
});
