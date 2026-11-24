/**
 * Hand-Drawn Character Recognizer Engine (Stage 4: How Computers See)
 * Zero-dependency pure ESM module for MNIST-style preprocessing,
 * multi-style vector prototype rendering, directional HOG + blurred pixel features,
 * cosine-similarity softmax classification, and live user handwriting adaptation.
 */

export const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
];

export const CHARSETS = {
  digits: DIGITS,
  letters: LETTERS,
};

const GRID_SIZE = 16;
const INNER_SIZE = 14;

/**
 * Convert various drawing inputs (ImageData, flat RGBA array, flat grayscale array,
 * or 2D grayscale grid) into a flat Float32Array of ink values in [0, 1].
 *
 * @param {number[][]|ImageData|Uint8ClampedArray|Uint8Array|Float32Array|number[]} input
 * @param {number} [width]
 * @param {number} [height]
 * @returns {{ ink: Float32Array, width: number, height: number }}
 */
function extractInkBuffer(input, width, height) {
  if (!input) {
    return { ink: new Float32Array(0), width: 0, height: 0 };
  }

  // Case 1: 2D array number[][]
  if (Array.isArray(input) && Array.isArray(input[0])) {
    const h = input.length;
    const w = input[0].length;
    const ink = new Float32Array(w * h);
    let maxVal = 0;
    for (let y = 0; y < h; y++) {
      const row = input[y];
      for (let x = 0; x < w; x++) {
        const v = Number(row[x]) || 0;
        if (v > maxVal) maxVal = v;
        ink[y * w + x] = v;
      }
    }
    if (maxVal > 1.001) {
      const inv = 1 / 255;
      for (let i = 0; i < ink.length; i++) {
        ink[i] = Math.max(0, Math.min(1, ink[i] * inv));
      }
    }
    return { ink, width: w, height: h };
  }

  // Case 2: ImageData-like object { data, width, height }
  let buffer = input;
  let w = width;
  let h = height;
  if (typeof input === 'object' && input.data && typeof input.width === 'number') {
    buffer = input.data;
    w = input.width;
    h = input.height;
  }

  if (!w || !h) {
    const side = Math.round(Math.sqrt(buffer.length));
    w = side;
    h = side;
  }

  const totalPixels = w * h;
  const ink = new Float32Array(totalPixels);

  // Case 3: Flat RGBA buffer (length === w * h * 4)
  if (buffer.length >= totalPixels * 4) {
    // Detect whether canvas uses transparent background, light background, or dark background
    const corners = [
      0,
      (w - 1) * 4,
      (h - 1) * w * 4,
      ((h - 1) * w + (w - 1)) * 4,
    ];
    let maxCornerAlpha = 0;
    let avgCornerLuma = 0;
    for (const idx of corners) {
      const a = buffer[idx + 3] ?? 0;
      if (a > maxCornerAlpha) maxCornerAlpha = a;
      avgCornerLuma += 0.299 * buffer[idx] + 0.587 * buffer[idx + 1] + 0.114 * buffer[idx + 2];
    }
    avgCornerLuma /= corners.length;

    if (maxCornerAlpha < 20) {
      // Transparent background: ink is alpha channel
      for (let i = 0; i < totalPixels; i++) {
        ink[i] = buffer[i * 4 + 3] / 255;
      }
    } else if (avgCornerLuma > 128) {
      // Light/white background: dark strokes are ink
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const a = buffer[idx + 3] / 255;
        const luma = (0.299 * buffer[idx] + 0.587 * buffer[idx + 1] + 0.114 * buffer[idx + 2]) / 255;
        ink[i] = a * (1 - luma);
      }
    } else {
      // Dark background: bright strokes are ink
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const a = buffer[idx + 3] / 255;
        const luma = (0.299 * buffer[idx] + 0.587 * buffer[idx + 1] + 0.114 * buffer[idx + 2]) / 255;
        ink[i] = a * luma;
      }
    }
    return { ink, width: w, height: h };
  }

  // Case 4: Flat grayscale / alpha buffer (length === w * h)
  let maxVal = 0;
  const len = Math.min(totalPixels, buffer.length);
  for (let i = 0; i < len; i++) {
    const v = buffer[i] || 0;
    if (v > maxVal) maxVal = v;
    ink[i] = v;
  }
  if (maxVal > 1.001) {
    const inv = 1 / 255;
    for (let i = 0; i < len; i++) {
      ink[i] = Math.max(0, Math.min(1, ink[i] * inv));
    }
  }
  return { ink, width: w, height: h };
}

/**
 * Create an empty 16x16 2D array of zeros.
 * @returns {number[][]}
 */
function createEmptyNormalizedGrid() {
  return Array.from({ length: GRID_SIZE }, () => new Array(GRID_SIZE).fill(0));
}

/**
 * MNIST-style preprocessing:
 * 1. Extract ink intensity and find tight bounding box of drawn strokes.
 * 2. Crop and scale preserving aspect ratio into a 12x12 inner frame (area-averaged).
 * 3. Place into a 16x16 grid centered by center-of-mass.
 * 4. Normalize peak intensity to 1.0.
 *
 * @param {number[][]|ImageData|Uint8ClampedArray|Uint8Array|Float32Array|number[]} rawGridOrImageData
 * @param {number} [width]
 * @param {number} [height]
 * @returns {{
 *   normalizedGrid: number[][],
 *   hasInk: boolean,
 *   bbox: { minX: number, maxX: number, minY: number, maxY: number, width: number, height: number } | null
 * }}
 */
export function preprocessDrawing(rawGridOrImageData, width, height) {
  const { ink, width: w, height: h } = extractInkBuffer(rawGridOrImageData, width, height);
  if (w === 0 || h === 0) {
    return { normalizedGrid: createEmptyNormalizedGrid(), hasInk: false, bbox: null };
  }

  const threshold = 0.08;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  let inkSum = 0;

  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const val = ink[rowOff + x];
      if (val > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        inkSum += val;
      }
    }
  }

  if (maxX < minX || inkSum < 0.15) {
    return { normalizedGrid: createEmptyNormalizedGrid(), hasInk: false, bbox: null };
  }

  const bboxW = maxX - minX + 1;
  const bboxH = maxY - minY + 1;
  const maxDim = Math.max(bboxW, bboxH);

  // Target dimensions preserving aspect ratio inside INNER_SIZE x INNER_SIZE
  const scale = INNER_SIZE / maxDim;
  const targetW = Math.max(1, Math.min(INNER_SIZE, Math.round(bboxW * scale)));
  const targetH = Math.max(1, Math.min(INNER_SIZE, Math.round(bboxH * scale)));

  // Area-averaged resampling from [minX..maxX, minY..maxY] -> [targetW x targetH]
  const resized = new Float32Array(targetW * targetH);
  const srcStepX = bboxW / targetW;
  const srcStepY = bboxH / targetH;

  for (let ty = 0; ty < targetH; ty++) {
    const sy0 = minY + ty * srcStepY;
    const sy1 = minY + (ty + 1) * srcStepY;
    const iy0 = Math.max(0, Math.floor(sy0));
    const iy1 = Math.min(h - 1, Math.ceil(sy1) - 1);

    for (let tx = 0; tx < targetW; tx++) {
      const sx0 = minX + tx * srcStepX;
      const sx1 = minX + (tx + 1) * srcStepX;
      const ix0 = Math.max(0, Math.floor(sx0));
      const ix1 = Math.min(w - 1, Math.ceil(sx1) - 1);

      let sum = 0;
      let count = 0;
      let maxSample = 0;
      for (let sy = iy0; sy <= iy1; sy++) {
        const rOff = sy * w;
        for (let sx = ix0; sx <= ix1; sx++) {
          const v = ink[rOff + sx];
          sum += v;
          if (v > maxSample) maxSample = v;
          count += 1;
        }
      }
      // Blend area average with peak sample so thin strokes remain crisp
      const avg = count > 0 ? sum / count : 0;
      resized[ty * targetW + tx] = 0.65 * avg + 0.35 * maxSample;
    }
  }

  // Compute center of mass of resized glyph
  let mass = 0;
  let cmX = 0;
  let cmY = 0;
  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      const v = resized[ty * targetW + tx];
      mass += v;
      cmX += tx * v;
      cmY += ty * v;
    }
  }
  if (mass > 0) {
    cmX /= mass;
    cmY /= mass;
  } else {
    cmX = (targetW - 1) / 2;
    cmY = (targetH - 1) / 2;
  }

  // Place centered by center-of-mass into 16x16 grid, clamped to stay inside bounds
  const targetCenter = (GRID_SIZE - 1) / 2;
  const rawOffX = Math.round(targetCenter - cmX);
  const rawOffY = Math.round(targetCenter - cmY);
  const offX = Math.max(0, Math.min(GRID_SIZE - targetW, rawOffX));
  const offY = Math.max(0, Math.min(GRID_SIZE - targetH, rawOffY));

  const normalizedGrid = createEmptyNormalizedGrid();
  let peak = 0;
  for (let ty = 0; ty < targetH; ty++) {
    for (let tx = 0; tx < targetW; tx++) {
      const v = resized[ty * targetW + tx];
      normalizedGrid[offY + ty][offX + tx] = v;
      if (v > peak) peak = v;
    }
  }

  if (peak > 0) {
    const invPeak = 1 / peak;
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        normalizedGrid[y][x] = Math.min(1, normalizedGrid[y][x] * invPeak);
      }
    }
  }

  return {
    normalizedGrid,
    hasInk: true,
    bbox: { minX, maxX, minY, maxY, width: bboxW, height: bboxH },
  };
}

/**
 * Apply a 3x3 Gaussian blur to a 16x16 grid for shift tolerance.
 * @param {number[][]} grid
 * @returns {Float32Array}
 */
function blurGrid16(grid) {
  const out = new Float32Array(GRID_SIZE * GRID_SIZE);
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1],
  ];

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      let acc = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const ny = y + ky;
        if (ny < 0 || ny >= GRID_SIZE) continue;
        for (let kx = -1; kx <= 1; kx++) {
          const nx = x + kx;
          if (nx < 0 || nx >= GRID_SIZE) continue;
          acc += grid[ny][nx] * kernel[ky + 1][kx + 1];
        }
      }
      out[y * GRID_SIZE + x] = acc / 16;
    }
  }
  return out;
}

/**
 * L2-normalize a Float32Array in place.
 * @param {Float32Array} vec
 * @returns {Float32Array}
 */
function normalizeL2(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 1e-8) {
    const inv = 1 / norm;
    for (let i = 0; i < vec.length; i++) {
      vec[i] *= inv;
    }
  }
  return vec;
}

/**
 * Extract a rich L2-normalized feature vector from a 16x16 normalized grid + bbox:
 * - 256 blurred pixel intensities (shift-tolerant shape)
 * - 64 directional edge histogram features (4x4 spatial cells x 4 orientations)
 * - 32 zoning & projection profile features (4x4 ink density + 8 row + 8 col profiles)
 * - 2 mild aspect-ratio features
 * Total: 354 dimensions.
 *
 * @param {number[][]} grid16
 * @param {{ width: number, height: number } | null} bbox
 * @returns {Float32Array}
 */
function extractFeatures(grid16, bbox) {
  const blurred = blurGrid16(grid16);
  const blurredNorm = normalizeL2(new Float32Array(blurred));

  // 4x4 spatial grid x 4 edge orientations (0°, 45°, 90°, 135°) = 64 dims
  const hog = new Float32Array(64);
  for (let y = 1; y < GRID_SIZE - 1; y++) {
    const cellY = Math.floor(y / 4);
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      const cellX = Math.floor(x / 4);
      const gx =
        -grid16[y - 1][x - 1] + grid16[y - 1][x + 1] +
        -2 * grid16[y][x - 1] + 2 * grid16[y][x + 1] +
        -grid16[y + 1][x - 1] + grid16[y + 1][x + 1];
      const gy =
        -grid16[y - 1][x - 1] - 2 * grid16[y - 1][x] - grid16[y - 1][x + 1] +
        grid16[y + 1][x - 1] + 2 * grid16[y + 1][x] + grid16[y + 1][x + 1];

      const mag = Math.hypot(gx, gy);
      if (mag < 0.05) continue;

      let angle = Math.atan2(gy, gx); // [-pi, pi]
      if (angle < 0) angle += Math.PI; // [0, pi)
      const binFloat = (angle / Math.PI) * 4;
      const bin0 = Math.floor(binFloat) % 4;
      const bin1 = (bin0 + 1) % 4;
      const frac = binFloat - Math.floor(binFloat);

      const base = (cellY * 4 + cellX) * 4;
      hog[base + bin0] += mag * (1 - frac);
      hog[base + bin1] += mag * frac;
    }
  }
  normalizeL2(hog);

  // 4x4 zoning (16) + 8-bin horizontal profile (8) + 8-bin vertical profile (8) = 32 dims
  const profile = new Float32Array(32);
  for (let y = 0; y < GRID_SIZE; y++) {
    const zy = Math.floor(y / 4);
    const py = Math.floor(y / 2);
    for (let x = 0; x < GRID_SIZE; x++) {
      const v = grid16[y][x];
      const zx = Math.floor(x / 4);
      const px = Math.floor(x / 2);
      profile[zy * 4 + zx] += v;
      profile[16 + py] += v;
      profile[24 + px] += v;
    }
  }
  normalizeL2(profile);

  // Aspect ratio cue (distinguishes tall skinny '1'/'I' from wide shapes)
  const bw = bbox ? bbox.width : 12;
  const bh = bbox ? bbox.height : 12;
  const aspect = Math.min(2.0, bw / Math.max(1, bh));
  const aspectClamped = (aspect - 0.65) * 0.25;

  const combined = new Float32Array(256 + 64 + 32 + 2);
  for (let i = 0; i < 256; i++) combined[i] = blurredNorm[i] * 1.0;
  for (let i = 0; i < 64; i++) combined[256 + i] = hog[i] * 1.15;
  for (let i = 0; i < 32; i++) combined[320 + i] = profile[i] * 0.55;
  combined[352] = aspectClamped;
  combined[353] = aspect < 0.42 ? 0.22 : 0;

  return normalizeL2(combined);
}

/**
 * Cosine similarity between two L2-normalized Float32Arrays.
 * @param {Float32Array} a
 * @param {Float32Array} b
 * @returns {number}
 */
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Rasterize a list of vector polylines (coordinates in [0, 1] x [0, 1])
 * onto a square grayscale grid with anti-aliased stroke distance.
 *
 * @param {Array<Array<[number, number]>>} strokes
 * @param {number} [size=32]
 * @param {number} [thickness=2.2]
 * @param {number} [shearX=0]
 * @returns {number[][]}
 */
export function rasterizeStrokes(strokes, size = 32, thickness = 2.2, shearX = 0) {
  const grid = Array.from({ length: size }, () => new Array(size).fill(0));
  const pad = size * 0.14;
  const span = size - 2 * pad;

  const transformPoint = ([nx, ny]) => {
    const sx = nx + (0.5 - ny) * shearX;
    return [pad + sx * span, pad + ny * span];
  };

  const segments = [];
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.length - 1; i++) {
      segments.push([transformPoint(stroke[i]), transformPoint(stroke[i + 1])]);
    }
  }

  const radius = thickness;
  const outer = radius + 1.0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let minDist = Infinity;
      for (let s = 0; s < segments.length; s++) {
        const [[x1, y1], [x2, y2]] = segments[s];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq > 1e-6) {
          t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
        }
        const px = x1 + t * dx;
        const py = y1 + t * dy;
        const dist = Math.hypot(x - px, y - py);
        if (dist < minDist) minDist = dist;
      }

      if (minDist <= radius) {
        grid[y][x] = 1;
      } else if (minDist < outer) {
        grid[y][x] = 1 - (minDist - radius) / (outer - radius);
      }
    }
  }

  return grid;
}

/**
 * Helper to sample an elliptic arc as a polyline.
 */
function arc(cx, cy, rx, ry, startDeg, endDeg, steps = 14) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const deg = startDeg + ((endDeg - startDeg) * i) / steps;
    const rad = (deg * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(rad), cy + ry * Math.sin(rad)]);
  }
  return pts;
}

/**
 * Multi-style vector stroke definitions for Digits 0–9.
 * Coordinates are normalized in [0, 1] x [0, 1].
 */
const DIGIT_PROTOTYPES = {
  '0': [
    [arc(0.5, 0.5, 0.32, 0.46, 0, 360, 20)],
    [arc(0.5, 0.5, 0.38, 0.46, 0, 360, 20)],
  ],
  '1': [
    [[[0.5, 0.04], [0.5, 0.96]]],
    [[[0.34, 0.22], [0.5, 0.04], [0.5, 0.96]]],
    [[[0.34, 0.22], [0.5, 0.04], [0.5, 0.96]], [[0.3, 0.96], [0.7, 0.96]]],
  ],
  '2': [
    [
      [...arc(0.5, 0.28, 0.28, 0.24, 200, 390, 12), [0.22, 0.94], [0.8, 0.94]],
    ],
    [
      [[0.24, 0.22], [0.5, 0.06], [0.76, 0.22], [0.74, 0.42], [0.22, 0.94], [0.82, 0.94]],
    ],
  ],
  '3': [
    [
      arc(0.48, 0.27, 0.28, 0.23, 215, 450, 12),
      arc(0.48, 0.72, 0.3, 0.24, 270, 515, 12),
    ],
    [
      [[0.24, 0.08], [0.76, 0.08], [0.46, 0.46], ...arc(0.5, 0.71, 0.28, 0.24, 285, 510, 10)],
    ],
  ],
  '4': [
    // Open-top 4
    [[[0.24, 0.06], [0.24, 0.56], [0.82, 0.56]], [[0.68, 0.06], [0.68, 0.96]]],
    // Closed-triangle 4
    [[[0.68, 0.96], [0.68, 0.06], [0.2, 0.62], [0.84, 0.62]]],
  ],
  '5': [
    [
      [[0.76, 0.08], [0.28, 0.08], [0.24, 0.46], ...arc(0.5, 0.69, 0.28, 0.25, 250, 515, 12)],
    ],
    [
      [[0.78, 0.08], [0.26, 0.08], [0.26, 0.48], [0.64, 0.48], [0.78, 0.68], [0.64, 0.92], [0.24, 0.9]],
    ],
  ],
  '6': [
    [
      [...arc(0.54, 0.48, 0.32, 0.44, 290, 165, 12), ...arc(0.5, 0.69, 0.28, 0.25, 180, 540, 14)],
    ],
    [
      [[0.68, 0.06], [0.32, 0.38], [0.22, 0.68], ...arc(0.5, 0.7, 0.28, 0.24, 180, 540, 14)],
    ],
  ],
  '7': [
    [[[0.2, 0.08], [0.8, 0.08], [0.38, 0.96]]],
    [[[0.2, 0.08], [0.8, 0.08], [0.44, 0.96]], [[0.38, 0.52], [0.74, 0.52]]],
    [[[0.2, 0.22], [0.2, 0.08], [0.8, 0.08], [0.38, 0.96]]],
  ],
  '8': [
    [
      arc(0.5, 0.27, 0.25, 0.22, 0, 360, 16),
      arc(0.5, 0.72, 0.29, 0.24, 0, 360, 16),
    ],
    [
      arc(0.5, 0.28, 0.28, 0.22, 0, 360, 16),
      arc(0.5, 0.72, 0.28, 0.23, 0, 360, 16),
    ],
  ],
  '9': [
    [
      arc(0.48, 0.3, 0.27, 0.24, 0, 360, 16),
      [[0.75, 0.3], [0.64, 0.96]],
    ],
    [
      arc(0.48, 0.3, 0.27, 0.24, 0, 360, 16),
      [[0.75, 0.3], [0.74, 0.72], [0.54, 0.94], [0.28, 0.88]],
    ],
  ],
};

/**
 * Multi-style vector stroke definitions for Uppercase Letters A–Z.
 */
const LETTER_PROTOTYPES = {
  A: [
    [[[0.16, 0.95], [0.5, 0.06], [0.84, 0.95]], [[0.28, 0.64], [0.72, 0.64]]],
    [[[0.18, 0.95], [0.5, 0.08], [0.82, 0.95]], [[0.26, 0.58], [0.74, 0.58]]],
  ],
  B: [
    [
      [[0.22, 0.06], [0.22, 0.94]],
      [[0.22, 0.06], [0.54, 0.06], ...arc(0.54, 0.28, 0.24, 0.22, 270, 450, 10), [0.22, 0.5]],
      [[0.22, 0.5], [0.56, 0.5], ...arc(0.56, 0.72, 0.26, 0.22, 270, 450, 10), [0.22, 0.94]],
    ],
  ],
  C: [
    [arc(0.54, 0.5, 0.34, 0.44, 42, 318, 18)],
    [arc(0.54, 0.5, 0.32, 0.44, 55, 305, 18)],
  ],
  D: [
    [
      [[0.22, 0.06], [0.22, 0.94]],
      [[0.22, 0.06], [0.46, 0.06], ...arc(0.46, 0.5, 0.36, 0.44, 270, 450, 16), [0.22, 0.94]],
    ],
  ],
  E: [
    [
      [[0.78, 0.08], [0.24, 0.08], [0.24, 0.92], [0.8, 0.92]],
      [[0.24, 0.5], [0.7, 0.5]],
    ],
  ],
  F: [
    [
      [[0.78, 0.08], [0.24, 0.08], [0.24, 0.94]],
      [[0.24, 0.5], [0.68, 0.5]],
    ],
  ],
  G: [
    [
      [...arc(0.52, 0.5, 0.34, 0.44, 330, 15, 18)],
      [[0.54, 0.54], [0.84, 0.54], [0.84, 0.88]],
    ],
    [
      [...arc(0.52, 0.5, 0.34, 0.44, 325, 25, 18), [0.82, 0.54], [0.54, 0.54]],
    ],
  ],
  H: [
    [
      [[0.22, 0.06], [0.22, 0.94]],
      [[0.78, 0.06], [0.78, 0.94]],
      [[0.22, 0.5], [0.78, 0.5]],
    ],
  ],
  I: [
    [[[0.5, 0.06], [0.5, 0.94]]],
    [
      [[0.26, 0.08], [0.74, 0.08]],
      [[0.5, 0.08], [0.5, 0.92]],
      [[0.26, 0.92], [0.74, 0.92]],
    ],
  ],
  J: [
    [
      [[0.68, 0.08], [0.68, 0.7], ...arc(0.45, 0.7, 0.23, 0.24, 0, 175, 10)],
    ],
    [
      [[0.34, 0.08], [0.82, 0.08]],
      [[0.64, 0.08], [0.64, 0.7], ...arc(0.42, 0.7, 0.22, 0.24, 0, 175, 10)],
    ],
  ],
  K: [
    [
      [[0.22, 0.06], [0.22, 0.94]],
      [[0.78, 0.08], [0.22, 0.54], [0.8, 0.94]],
    ],
  ],
  L: [
    [[[0.24, 0.06], [0.24, 0.92], [0.8, 0.92]]],
  ],
  M: [
    [[[0.14, 0.94], [0.18, 0.08], [0.5, 0.58], [0.82, 0.08], [0.86, 0.94]]],
    [[[0.14, 0.94], [0.14, 0.08], [0.5, 0.72], [0.86, 0.08], [0.86, 0.94]]],
  ],
  N: [
    [[[0.2, 0.94], [0.2, 0.08], [0.8, 0.94], [0.8, 0.08]]],
  ],
  O: [
    [arc(0.5, 0.5, 0.36, 0.44, 0, 360, 20)],
    [arc(0.5, 0.5, 0.32, 0.44, 0, 360, 20)],
  ],
  P: [
    [
      [[0.24, 0.94], [0.24, 0.08], [0.54, 0.08], ...arc(0.54, 0.31, 0.26, 0.23, 270, 450, 12), [0.24, 0.54]],
    ],
  ],
  Q: [
    [
      arc(0.48, 0.48, 0.34, 0.41, 0, 360, 20),
      [[0.58, 0.66], [0.88, 0.96]],
    ],
  ],
  R: [
    [
      [[0.24, 0.94], [0.24, 0.08], [0.54, 0.08], ...arc(0.54, 0.3, 0.24, 0.22, 270, 450, 12), [0.24, 0.52]],
      [[0.5, 0.52], [0.8, 0.94]],
    ],
  ],
  S: [
    [
      [...arc(0.5, 0.28, 0.28, 0.21, 330, 110, 12), ...arc(0.5, 0.72, 0.3, 0.22, 280, 520, 12)],
    ],
    [
      [[0.76, 0.18], [0.54, 0.06], [0.26, 0.18], [0.26, 0.38], [0.74, 0.6], [0.74, 0.82], [0.48, 0.94], [0.22, 0.82]],
    ],
  ],
  T: [
    [
      [[0.16, 0.08], [0.84, 0.08]],
      [[0.5, 0.08], [0.5, 0.94]],
    ],
  ],
  U: [
    [
      [[0.22, 0.08], [0.22, 0.64], ...arc(0.5, 0.64, 0.28, 0.3, 180, 0, 12), [0.78, 0.08]],
    ],
  ],
  V: [
    [[[0.18, 0.08], [0.5, 0.94], [0.82, 0.08]]],
  ],
  W: [
    [[[0.1, 0.08], [0.3, 0.92], [0.5, 0.4], [0.7, 0.92], [0.9, 0.08]]],
    [[[0.12, 0.08], [0.32, 0.92], [0.5, 0.55], [0.68, 0.92], [0.88, 0.08]]],
  ],
  X: [
    [
      [[0.18, 0.08], [0.82, 0.92]],
      [[0.82, 0.08], [0.18, 0.92]],
    ],
  ],
  Y: [
    [
      [[0.18, 0.08], [0.5, 0.5], [0.82, 0.08]],
      [[0.5, 0.5], [0.5, 0.94]],
    ],
  ],
  Z: [
    [[[0.18, 0.08], [0.82, 0.08], [0.18, 0.92], [0.82, 0.92]]],
    [
      [[0.18, 0.08], [0.82, 0.08], [0.18, 0.92], [0.82, 0.92]],
      [[0.34, 0.5], [0.66, 0.5]],
    ],
  ],
};

/**
 * 12 interpretable hidden feature-detector neuron definitions.
 */
const HIDDEN_NEURON_DEFS = [
  { id: 'topBar', label: 'Top Bar', shortLabel: 'Top Bar', description: 'Reads Row 1 input zones (0–3) to detect a top horizontal stroke (like 7, 5, T, E, Z).' },
  { id: 'midBar', label: 'Middle Bar', shortLabel: 'Mid Bar', description: 'Reads Row 2 input zones (4–7) to detect an upper-middle bar (like 4, 8, A, E, H).' },
  { id: 'bottomBar', label: 'Bottom Bar', shortLabel: 'Bot Bar', description: 'Reads Row 4 input zones (12–15) to detect a flat base along the bottom (like 2, E, L, Z).' },
  { id: 'leftStem', label: 'Left Stem', shortLabel: 'L-Stem', description: 'Reads left-side input zones (0, 4, 5, 8, 9, 12) to detect a vertical wall on the left (like B, D, E, F, H, L, P).' },
  { id: 'rightStem', label: 'Right Stem', shortLabel: 'R-Stem', description: 'Reads right-side input zones (3, 6, 7, 10, 11, 15) to detect a vertical stroke on the right (like 4, 9, H, M, N, U).' },
  { id: 'diagSlash', label: 'Diagonal /', shortLabel: 'Diag /', description: 'Reads anti-diagonal input zones (3, 6, 9, 12) for a slanted / stroke (like 7, 2, Z, X).' },
  { id: 'diagBackslash', label: 'Diagonal \\', shortLabel: 'Diag \\', description: 'Reads main-diagonal input zones (0, 5, 10, 15) for a slanted \\ stroke (like N, X, K, R).' },
  { id: 'centerInk', label: 'Center Ink', shortLabel: 'Center', description: 'Reads the 4 center input zones (5, 6, 9, 10) for ink crossing the middle (like 1, 3, 8, X, H, S).' },
  { id: 'topLoop', label: 'Top Loop', shortLabel: 'Top O', description: 'Reads upper ring zones (1, 2, 4, 7) with mild center inhibition (5) for a top loop (like 0, 8, 9, B, O, P).' },
  { id: 'bottomLoop', label: 'Bottom Loop', shortLabel: 'Bot O', description: 'Reads lower ring zones (8, 11, 13, 14) with mild center inhibition (9) for a bottom loop (like 0, 6, 8, B, O, U).' },
  { id: 'topBottom', label: 'Top & Bottom Caps', shortLabel: 'Top+Bot', description: 'Reads top-center and bottom-center zones (1, 2, 13, 14) for characters capped at both ends (like 0, 2, 3, 8, E, I, O, S, Z).' },
  { id: 'sideWalls', label: 'Side Walls', shortLabel: 'Sides', description: 'Reads left and right middle walls (4, 7, 8, 11) for wide framed shapes (like 0, H, M, N, O, U).' },
];

/**
 * Receptive-field edges connecting the 16 pooled input zones (0..15)
 * to the 12 hidden feature-detector neurons (0..11).
 */
const INPUT_TO_HIDDEN_SPEC = [
  // 0: Top Bar (Row 1: 0, 1, 2, 3)
  [0, 0, 0.85], [1, 0, 0.95], [2, 0, 0.95], [3, 0, 0.85],
  // 1: Mid Bar (Row 2: 4, 5, 6, 7)
  [4, 1, 0.75], [5, 1, 0.95], [6, 1, 0.95], [7, 1, 0.75],
  // 2: Bottom Bar (Row 4: 12, 13, 14, 15)
  [12, 2, 0.85], [13, 2, 0.95], [14, 2, 0.95], [15, 2, 0.85],
  // 3: Left Stem (left column + inner-left spine: 0, 4, 8, 12, 5, 9)
  [0, 3, 0.85], [4, 3, 0.9], [8, 3, 0.9], [12, 3, 0.85], [5, 3, 0.75], [9, 3, 0.75],
  // 4: Right Stem (right column + inner-right spine: 3, 7, 11, 15, 6, 10)
  [3, 4, 0.85], [7, 4, 0.9], [11, 4, 0.9], [15, 4, 0.85], [6, 4, 0.75], [10, 4, 0.75],
  // 5: Diag / (3, 6, 9, 12 positive; 5, 10 perpendicular inhibitory)
  [3, 5, 0.9], [6, 5, 0.95], [9, 5, 0.95], [12, 5, 0.9], [5, 5, -0.75], [10, 5, -0.75],
  // 6: Diag \ (0, 5, 10, 15 positive; 6, 9 perpendicular inhibitory)
  [0, 6, 0.9], [5, 6, 0.95], [10, 6, 0.95], [15, 6, 0.9], [6, 6, -0.75], [9, 6, -0.75],
  // 7: Center Ink (5, 6, 9, 10)
  [5, 7, 0.9], [6, 7, 0.9], [9, 7, 0.9], [10, 7, 0.9],
  // 8: Top Loop (1, 2, 4, 7 positive; 5 mildly inhibitory)
  [1, 8, 0.85], [2, 8, 0.85], [4, 8, 0.8], [7, 8, 0.8], [5, 8, -0.35],
  // 9: Bottom Loop (8, 11, 13, 14 positive; 9 mildly inhibitory)
  [8, 9, 0.8], [11, 9, 0.8], [13, 9, 0.85], [14, 9, 0.85], [9, 9, -0.35],
  // 10: Top & Bottom Caps (1, 2, 13, 14)
  [1, 10, 0.8], [2, 10, 0.8], [13, 10, 0.8], [14, 10, 0.8],
  // 11: Side Walls (4, 7, 8, 11)
  [4, 11, 0.8], [7, 11, 0.8], [8, 11, 0.8], [11, 11, 0.8],
];

/**
 * Clamp a number to [0, 1].
 */
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Compute mean ink in a rectangular region [y0..y1] x [x0..x1] of a 16x16 grid.
 */
function regionMean(grid, y0, y1, x0, x1) {
  let sum = 0;
  let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      sum += grid[y][x];
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * Compute the 16 pooled input zone activations (4x4 average pooling of 16x16 grid).
 * @param {number[][]} grid16
 * @returns {Array<{ id: number, row: number, col: number, activation: number }>}
 */
function computeInputNodes(grid16) {
  const nodes = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const avg = regionMean(grid16, row * 4, row * 4 + 3, col * 4, col * 4 + 3);
      nodes.push({
        id: row * 4 + col,
        row,
        col,
        activation: Number(clamp01(avg * 1.9).toFixed(3)),
      });
    }
  }
  return nodes;
}

/**
 * Compute the 12 hidden neuron activations (0..1) directly and faithfully from
 * `inputNodes` and `INPUT_TO_HIDDEN_SPEC` using a ReLU-clamped weighted sum:
 *   z_h = sum(inputNodes[from].activation * weight)
 *   act_h = clamp01(max(0, z_h) / (posWeightSum_h * 0.85))
 *
 * Hard invariant: if every positively-weighted incoming input node for hidden
 * neuron h has activation === 0, then hidden neuron h's activation is strictly 0.
 *
 * @param {Array<{ id: number, row: number, col: number, activation: number }>} inputNodes
 * @returns {number[]}
 */
function computeHiddenActivations(inputNodes) {
  const count = HIDDEN_NEURON_DEFS.length;
  const weightedSums = new Array(count).fill(0);
  const posWeightSums = new Array(count).fill(0);

  for (let i = 0; i < INPUT_TO_HIDDEN_SPEC.length; i++) {
    const [from, to, weight] = INPUT_TO_HIDDEN_SPEC[i];
    const inAct = inputNodes[from]?.activation ?? 0;
    weightedSums[to] += inAct * weight;
    if (weight > 0) {
      posWeightSums[to] += weight;
    }
  }

  return weightedSums.map((z, h) => {
    if (z <= 0 || posWeightSums[h] <= 0) return 0;
    const scaled = z / (posWeightSums[h] * 0.85);
    return Number(clamp01(scaled).toFixed(3));
  });
}

/**
 * Module-level cache of compiled base prototypes & class hidden-feature weights per charset
 * so repeated createCharRecognizer() calls are instant (<0.1ms).
 */
const prototypeCache = new Map();

/**
 * Compile multi-style + slight slant variations for every character in the charset,
 * along with normalized hidden-to-output class weights for networkTrace visualization.
 * @param {'digits'|'letters'} charset
 * @returns {{
 *   prototypes: Array<{ char: string, features: Float32Array, boost: number }>,
 *   classHiddenWeights: Map<string, number[]>
 * }}
 */
function getBasePrototypes(charset) {
  if (prototypeCache.has(charset)) {
    return prototypeCache.get(charset);
  }

  const defMap = charset === 'letters' ? LETTER_PROTOTYPES : DIGIT_PROTOTYPES;
  const chars = CHARSETS[charset] || DIGITS;
  const prototypes = [];
  const shears = [-0.14, 0, 0.14];
  const classHiddenMeans = new Map();
  const globalMean = new Array(HIDDEN_NEURON_DEFS.length).fill(0);

  for (const char of chars) {
    const styles = defMap[char] || [];
    const sumHidden = new Array(HIDDEN_NEURON_DEFS.length).fill(0);
    let protoCount = 0;

    for (const strokes of styles) {
      for (const shear of shears) {
        const raw = rasterizeStrokes(strokes, 28, 2.0, shear);
        const { normalizedGrid, bbox } = preprocessDrawing(raw);
        const features = extractFeatures(normalizedGrid, bbox);
        prototypes.push({ char, features, boost: 0 });

        const hActs = computeHiddenActivations(computeInputNodes(normalizedGrid));
        for (let h = 0; h < hActs.length; h++) {
          sumHidden[h] += hActs[h];
        }
        protoCount += 1;
      }
    }

    const avgHidden = sumHidden.map((v) => (protoCount > 0 ? v / protoCount : 0));
    classHiddenMeans.set(char, avgHidden);
    for (let h = 0; h < avgHidden.length; h++) {
      globalMean[h] += avgHidden[h] / chars.length;
    }
  }

  // Convert per-class hidden profiles into centered weights in [-1, 1]
  const classHiddenWeights = new Map();
  for (const char of chars) {
    const profile = classHiddenMeans.get(char);
    const diffs = profile.map((v, h) => v - globalMean[h]);
    const maxAbs = Math.max(0.15, ...diffs.map((d) => Math.abs(d)));
    const weights = diffs.map((d) => Number(Math.max(-1, Math.min(1, d / maxAbs)).toFixed(3)));
    classHiddenWeights.set(char, weights);
  }

  const entry = { prototypes, classHiddenWeights };
  prototypeCache.set(charset, entry);
  return entry;
}

/**
 * Render a clean sample drawing of a character (useful for UI hints or tests).
 * @param {string} char
 * @param {number} [size=48]
 * @returns {number[][]}
 */
export function renderSampleChar(char, size = 48) {
  const key = String(char).toUpperCase();
  const styles = DIGIT_PROTOTYPES[key] || LETTER_PROTOTYPES[key];
  if (!styles || styles.length === 0) {
    return Array.from({ length: size }, () => new Array(size).fill(0));
  }
  return rasterizeStrokes(styles[0], size, Math.max(1.8, size * 0.065), 0);
}

/**
 * Create a fast, zero-dependency browser hand-drawn character recognizer.
 *
 * @param {'digits'|'letters'} [charset='digits']
 * @returns {{
 *   charset: 'digits'|'letters',
 *   characters: string[],
 *   recognize: (rawGridOrImageData: any, width?: number, height?: number) => {
 *     prediction: string|null,
 *     confidence: number,
 *     topK: Array<{ char: string, prob: number }>,
 *     normalizedGrid: number[][],
 *     hasInk: boolean
 *   },
 *   teach: (char: string, rawGridOrImageData: any, width?: number, height?: number) => {
 *     added: boolean,
 *     char: string,
 *     customCount: number
 *   },
 *   getCustomCount: () => number,
 *   resetCustom: () => void
 * }}
 */
export function createCharRecognizer(charset = 'digits') {
  const safeCharset = charset === 'letters' ? 'letters' : 'digits';
  const characters = CHARSETS[safeCharset];
  const { prototypes: basePrototypes, classHiddenWeights } = getBasePrototypes(safeCharset);
  let customPrototypes = [];

  function buildNetworkTrace(normalizedGrid, probByChar, sortedScored, winnerChar, hasInk) {
    const inputNodes = hasInk
      ? computeInputNodes(normalizedGrid)
      : Array.from({ length: 16 }, (_, id) => ({
          id,
          row: Math.floor(id / 4),
          col: id % 4,
          activation: 0,
        }));

    const hiddenActVals = hasInk
      ? computeHiddenActivations(inputNodes)
      : new Array(HIDDEN_NEURON_DEFS.length).fill(0);

    const hiddenNodes = HIDDEN_NEURON_DEFS.map((def, idx) => ({
      ...def,
      activation: hiddenActVals[idx],
    }));

    const outputChars =
      safeCharset === 'digits'
        ? DIGITS
        : hasInk
          ? sortedScored.slice(0, 10).map((item) => item.char)
          : LETTERS.slice(0, 10);

    const outputNodes = outputChars.map((char) => ({
      char,
      prob: hasInk ? Number((probByChar.get(char) || 0).toFixed(4)) : 0,
      isWinner: hasInk && char === winnerChar,
    }));

    const inputToHiddenEdges = INPUT_TO_HIDDEN_SPEC.map(([from, to, weight]) => {
      const sig = inputNodes[from].activation * weight;
      return {
        from,
        to,
        weight,
        signal: Number((sig === 0 ? 0 : sig).toFixed(3)),
      };
    });

    const hiddenToOutputEdges = [];
    for (let oIdx = 0; oIdx < outputNodes.length; oIdx++) {
      const char = outputNodes[oIdx].char;
      const weights = classHiddenWeights.get(char) || new Array(HIDDEN_NEURON_DEFS.length).fill(0);
      // Keep top 4 strongest-magnitude connections per output class (~40 crisp edges total)
      const ranked = weights
        .map((weight, hIdx) => ({ hIdx, weight }))
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 4);

      for (const { hIdx, weight } of ranked) {
        const sig = hiddenNodes[hIdx].activation * weight;
        hiddenToOutputEdges.push({
          from: hIdx,
          to: oIdx,
          weight,
          signal: Number((sig === 0 ? 0 : sig).toFixed(3)),
        });
      }
    }

    return {
      inputNodes,
      hiddenNodes,
      outputNodes,
      inputToHiddenEdges,
      hiddenToOutputEdges,
    };
  }

  function recognize(rawGridOrImageData, width, height) {
    const { normalizedGrid, hasInk, bbox } = preprocessDrawing(
      rawGridOrImageData,
      width,
      height,
    );

    if (!hasInk) {
      return {
        prediction: null,
        confidence: 0,
        topK: [],
        normalizedGrid,
        hasInk: false,
        networkTrace: buildNetworkTrace(normalizedGrid, new Map(), [], null, false),
      };
    }

    const queryFeatures = extractFeatures(normalizedGrid, bbox);
    const bestScores = new Map();
    for (const c of characters) {
      bestScores.set(c, -Infinity);
    }

    // Score base prototypes
    for (let i = 0; i < basePrototypes.length; i++) {
      const proto = basePrototypes[i];
      const sim = dotProduct(queryFeatures, proto.features);
      if (sim > bestScores.get(proto.char)) {
        bestScores.set(proto.char, sim);
      }
    }

    // Score user-taught custom prototypes (with priority boost for user's own handwriting)
    for (let i = 0; i < customPrototypes.length; i++) {
      const proto = customPrototypes[i];
      const sim = dotProduct(queryFeatures, proto.features) + proto.boost;
      if (sim > bestScores.get(proto.char)) {
        bestScores.set(proto.char, sim);
      }
    }

    // Temperature-scaled softmax over class similarity scores
    const temperature = 0.085;
    let maxScore = -Infinity;
    for (const score of bestScores.values()) {
      if (score > maxScore) maxScore = score;
    }

    const scored = [];
    let expSum = 0;
    for (const [char, score] of bestScores.entries()) {
      const expVal = Math.exp((score - maxScore) / temperature);
      expSum += expVal;
      scored.push({ char, score, expVal });
    }

    scored.sort((a, b) => b.score - a.score || a.char.localeCompare(b.char));

    const probByChar = new Map();
    for (const item of scored) {
      probByChar.set(item.char, item.expVal / expSum);
    }

    const topK = scored.slice(0, 5).map((item) => ({
      char: item.char,
      prob: item.expVal / expSum,
    }));

    const prediction = topK[0]?.char ?? null;
    const networkTrace = buildNetworkTrace(normalizedGrid, probByChar, scored, prediction, true);

    return {
      prediction,
      confidence: topK[0]?.prob ?? 0,
      topK,
      normalizedGrid,
      hasInk: true,
      networkTrace,
    };
  }

  function teach(char, rawGridOrImageData, width, height) {
    const label = String(char).toUpperCase();
    if (!characters.includes(label)) {
      throw new Error(`Character "${char}" is not in the "${safeCharset}" charset.`);
    }

    const { normalizedGrid, hasInk, bbox } = preprocessDrawing(
      rawGridOrImageData,
      width,
      height,
    );

    if (!hasInk) {
      return { added: false, char: label, customCount: customPrototypes.length };
    }

    const features = extractFeatures(normalizedGrid, bbox);
    customPrototypes.push({ char: label, features, boost: 0.14 });

    return { added: true, char: label, customCount: customPrototypes.length };
  }

  function getCustomCount() {
    return customPrototypes.length;
  }

  function resetCustom() {
    customPrototypes = [];
  }

  return {
    charset: safeCharset,
    characters,
    recognize,
    teach,
    getCustomCount,
    resetCustom,
  };
}
