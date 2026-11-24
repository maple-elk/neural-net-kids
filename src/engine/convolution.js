/**
 * 2D Convolution & Feature Map Engine (Stage 4: How Computers See)
 * Zero-dependency pure ESM module for 8x8 pixel grids, 3x3 kernels,
 * single-step sliding window math, and full 6x6 feature maps.
 */

/**
 * Create a blank (all zeros) square pixel grid.
 * @param {number} [size=8]
 * @returns {number[][]}
 */
export function createBlankGrid(size = 8) {
  return Array.from({ length: size }, () => new Array(size).fill(0));
}

/**
 * Clone a 2D numeric grid.
 * @param {number[][]} grid
 * @returns {number[][]}
 */
export function cloneGrid(grid) {
  return grid.map((row) => [...row]);
}

/**
 * Return a new grid with the pixel at (row, col) toggled between 0 and 1.
 * @param {number[][]} grid
 * @param {number} row
 * @param {number} col
 * @returns {number[][]}
 */
export function toggleGridCell(grid, row, col) {
  const next = cloneGrid(grid);
  if (next[row] && typeof next[row][col] === 'number') {
    next[row][col] = next[row][col] > 0 ? 0 : 1;
  }
  return next;
}

/**
 * Sample 8x8 pixel art grids for exploring how convolution filters respond.
 */
export const SAMPLE_GRIDS = {
  verticalBar: {
    id: 'verticalBar',
    name: 'Vertical Bar',
    emoji: '▮',
    description: 'A tall vertical stripe down the center.',
    grid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  horizontalBar: {
    id: 'horizontalBar',
    name: 'Horizontal Bar',
    emoji: '▬',
    description: 'A wide horizontal stripe across the middle.',
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
  cross: {
    id: 'cross',
    name: 'Cross / Plus',
    emoji: '➕',
    description: 'Both vertical and horizontal bars meeting at the center.',
    grid: [
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
    ],
  },
  smiley: {
    id: 'smiley',
    name: 'Smiley Face',
    emoji: '😊',
    description: 'Two bright eyes and a curved smile.',
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 0, 0, 1, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
  diagonal: {
    id: 'diagonal',
    name: 'Diagonal Line',
    emoji: '↘️',
    description: 'A slanted line running from top-left to bottom-right.',
    grid: [
      [1, 1, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 1],
    ],
  },
  letterT: {
    id: 'letterT',
    name: 'Letter T',
    emoji: '🇹',
    description: 'A top horizontal roof supported by a vertical stem.',
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
  letterL: {
    id: 'letterL',
    name: 'Letter L',
    emoji: '🇱',
    description: 'A vertical wall that turns sharply into a horizontal floor.',
    grid: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
  },
};

export const SAMPLE_GRID_LIST = Object.values(SAMPLE_GRIDS);

/**
 * Standard 3x3 convolution kernels with kid-friendly explanations.
 */
export const KERNELS = {
  verticalEdge: {
    id: 'verticalEdge',
    name: 'Vertical Edge',
    kidName: 'Up-Down Wall Finder',
    emoji: '🧱',
    description: 'Lights up wherever dark pixels meet bright pixels side-by-side!',
    deepDive: 'Horizontal Sobel gradient operator approximating dI/dx.',
    weights: [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ],
  },
  horizontalEdge: {
    id: 'horizontalEdge',
    name: 'Horizontal Edge',
    kidName: 'Flat Floor Finder',
    emoji: '➖',
    description: 'Lights up wherever dark pixels sit above or below bright pixels!',
    deepDive: 'Vertical Sobel gradient operator approximating dI/dy.',
    weights: [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ],
  },
  corner: {
    id: 'corner',
    name: 'Corner Detector',
    kidName: 'Corner Spotter',
    emoji: '📐',
    description: 'Ignores flat straight lines and fires right where shapes turn a corner!',
    deepDive: 'Cross-derivative filter approximating d²I/(dx·dy); zero on pure horizontal/vertical edges.',
    weights: [
      [1, 0, -1],
      [0, 0, 0],
      [-1, 0, 1],
    ],
  },
  sharpen: {
    id: 'sharpen',
    name: 'Sharpen',
    kidName: 'Super Crisp Booster',
    emoji: '✨',
    description: 'Boosts the center pixel while subtracting its neighbors to make edges pop!',
    deepDive: 'Unsharp-style 3x3 sharpening kernel (identity + discrete Laplacian).',
    weights: [
      [0, -1, 0],
      [-1, 5, -1],
      [0, -1, 0],
    ],
  },
  blur: {
    id: 'blur',
    name: 'Box Blur',
    kidName: 'Soft Smudger',
    emoji: '☁️',
    description: 'Averages every pixel with its 8 neighbors to make the image soft and smooth.',
    deepDive: 'Normalized 3x3 box filter (uniform low-pass averaging kernel, weights = 1/9).',
    weights: [
      [1 / 9, 1 / 9, 1 / 9],
      [1 / 9, 1 / 9, 1 / 9],
      [1 / 9, 1 / 9, 1 / 9],
    ],
  },
};

export const KERNEL_LIST = Object.values(KERNELS);

/**
 * Extract the 3x3 weight matrix from either a raw matrix or a kernel descriptor object.
 * @param {number[][]|{ weights: number[][] }} kernel
 * @returns {number[][]}
 */
function resolveKernelWeights(kernel) {
  if (Array.isArray(kernel)) return kernel;
  if (kernel && Array.isArray(kernel.weights)) return kernel.weights;
  throw new Error('Invalid kernel: expected 3x3 array or object with weights matrix.');
}

/**
 * Apply a 3x3 convolution kernel at a single (row, col) top-left patch offset.
 *
 * @param {number[][]} grid - Input 2D pixel grid (e.g. 8x8)
 * @param {number[][]|{ weights: number[][] }} kernel - 3x3 kernel matrix or KERNELS entry
 * @param {number} row - Top-left row index (0 .. grid.length - 3)
 * @param {number} col - Top-left col index (0 .. grid[0].length - 3)
 * @returns {{
 *   row: number,
 *   col: number,
 *   patch: number[][],
 *   kernel: number[][],
 *   products: number[][],
 *   value: number
 * }}
 */
export function applyConvolutionStep(grid, kernel, row, col) {
  const weights = resolveKernelWeights(kernel);
  const kRows = weights.length;
  const kCols = weights[0].length;

  const patch = [];
  const products = [];
  let value = 0;

  for (let kr = 0; kr < kRows; kr++) {
    const patchRow = [];
    const prodRow = [];
    for (let kc = 0; kc < kCols; kc++) {
      const pixel = grid[row + kr]?.[col + kc] ?? 0;
      const w = weights[kr][kc];
      const rawProd = pixel * w;
      const prod = rawProd === 0 ? 0 : rawProd;
      patchRow.push(pixel);
      prodRow.push(prod);
      value += prod;
    }
    patch.push(patchRow);
    products.push(prodRow);
  }

  return {
    row,
    col,
    patch,
    kernel: weights,
    products,
    value,
  };
}

/**
 * Slide a 3x3 kernel across the entire input grid (valid padding) to produce
 * the full feature map (6x6 for an 8x8 input grid).
 *
 * @param {number[][]} grid
 * @param {number[][]|{ weights: number[][] }} kernel
 * @returns {{
 *   featureMap: number[][],
 *   rows: number,
 *   cols: number,
 *   min: number,
 *   max: number,
 *   maxAbs: number
 * }}
 */
export function applyFullConvolution(grid, kernel) {
  const weights = resolveKernelWeights(kernel);
  const outRows = Math.max(0, grid.length - weights.length + 1);
  const outCols = Math.max(0, (grid[0]?.length ?? 0) - weights[0].length + 1);

  const featureMap = [];
  let min = Infinity;
  let max = -Infinity;
  let maxAbs = 0;

  for (let r = 0; r < outRows; r++) {
    const rowVals = new Array(outCols);
    for (let c = 0; c < outCols; c++) {
      const { value } = applyConvolutionStep(grid, weights, r, c);
      rowVals[c] = value;
      if (value < min) min = value;
      if (value > max) max = value;
      const absVal = Math.abs(value);
      if (absVal > maxAbs) maxAbs = absVal;
    }
    featureMap.push(rowVals);
  }

  if (outRows === 0 || outCols === 0) {
    min = 0;
    max = 0;
  }

  return {
    featureMap,
    rows: outRows,
    cols: outCols,
    min,
    max,
    maxAbs,
  };
}
