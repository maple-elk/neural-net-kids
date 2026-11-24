/**
 * Educational Language Model, Tokenizer, Word Embeddings & Attention Engine
 * (Stage 5: Words, Vectors & Attention, Stage 6: Build a Mini-LLM)
 * Zero-dependency pure ESM module running 100% in the browser.
 */

const COMMON_PREFIXES = ['un', 're', 'pre', 'dis', 'mis', 'over'];
const COMMON_SUFFIXES = ['tion', 'sion', 'ment', 'ness', 'less', 'ing', 'ful', 'est', 'ed', 'ly', 'er'];

/**
 * Deterministic FNV-1a string hash returning a positive token ID in [100, 49999].
 * @param {string} str
 * @returns {number}
 */
function deterministicTokenId(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 100 + ((hash >>> 0) % 49900);
}

/**
 * Split a single alphabetic word into educational subword pieces
 * (prefix + stem + suffix) when the remaining stem is at least 3 characters.
 *
 * @param {string} word
 * @returns {Array<{ text: string, type: 'prefix'|'word'|'suffix' }>}
 */
function splitSubword(word) {
  const lower = word.toLowerCase();
  if (lower.length < 5) {
    return [{ text: word, type: 'word' }];
  }

  let prefixPart = null;
  let suffixPart = null;
  let stemStart = 0;
  let stemEnd = word.length;

  for (const prefix of COMMON_PREFIXES) {
    if (lower.startsWith(prefix) && stemEnd - (stemStart + prefix.length) >= 3) {
      prefixPart = word.slice(0, prefix.length);
      stemStart = prefix.length;
      break;
    }
  }

  for (const suffix of COMMON_SUFFIXES) {
    const remainingLower = lower.slice(stemStart, stemEnd);
    if (remainingLower.endsWith(suffix) && remainingLower.length - suffix.length >= 3) {
      suffixPart = word.slice(stemEnd - suffix.length, stemEnd);
      stemEnd -= suffix.length;
      break;
    }
  }

  const pieces = [];
  if (prefixPart) pieces.push({ text: prefixPart, type: 'prefix' });
  pieces.push({ text: word.slice(stemStart, stemEnd), type: 'word' });
  if (suffixPart) pieces.push({ text: suffixPart, type: 'suffix' });
  return pieces;
}

/**
 * Educational subword-style tokenizer that splits prefixes, suffixes,
 * words, numbers, punctuation, and spaces into visual tokens with
 * deterministic numeric IDs and color indices (0..7).
 *
 * @param {string} text
 * @returns {Array<{ text: string, id: number, colorIndex: number, type: string }>}
 */
export function tokenize(text) {
  if (!text || typeof text !== 'string') return [];

  const rawChunks = text.match(/[A-Za-z]+|[0-9]+|\s+|[^\sA-Za-z0-9]/g) || [];
  const tokens = [];

  for (const chunk of rawChunks) {
    if (/^\s+$/.test(chunk)) {
      tokens.push({
        text: chunk,
        id: deterministicTokenId(chunk),
        colorIndex: tokens.length % 8,
        type: 'space',
      });
    } else if (/^[0-9]+$/.test(chunk)) {
      tokens.push({
        text: chunk,
        id: deterministicTokenId(chunk),
        colorIndex: tokens.length % 8,
        type: 'number',
      });
    } else if (/^[A-Za-z]+$/.test(chunk)) {
      const pieces = splitSubword(chunk);
      for (const piece of pieces) {
        tokens.push({
          text: piece.text,
          id: deterministicTokenId(piece.text.toLowerCase()),
          colorIndex: tokens.length % 8,
          type: piece.type,
        });
      }
    } else {
      tokens.push({
        text: chunk,
        id: deterministicTokenId(chunk),
        colorIndex: tokens.length % 8,
        type: 'punctuation',
      });
    }
  }

  return tokens;
}

/**
 * Curated 2D word embeddings arranged by semantic cluster & consistent analogy vectors:
 *   king - man + woman   -> queen
 *   prince - man + woman -> princess
 *   puppy - dog + cat    -> kitten
 *   paris - france + japan -> tokyo
 *   paris - france + italy -> rome
 */
export const EMBEDDING_WORDS = [
  // Royalty & People
  { word: 'king', emoji: '👑', category: 'royalty', x: 0.58, y: 0.78 },
  { word: 'queen', emoji: '👸', category: 'royalty', x: 0.86, y: 0.78 },
  { word: 'prince', emoji: '🤴', category: 'royalty', x: 0.62, y: 0.62 },
  { word: 'princess', emoji: '🎀', category: 'royalty', x: 0.90, y: 0.62 },
  { word: 'man', emoji: '👨', category: 'royalty', x: 0.58, y: 0.44 },
  { word: 'woman', emoji: '👩', category: 'royalty', x: 0.86, y: 0.44 },

  // Animals
  { word: 'dog', emoji: '🐶', category: 'animals', x: -0.78, y: 0.54 },
  { word: 'puppy', emoji: '🐾', category: 'animals', x: -0.78, y: 0.82 },
  { word: 'cat', emoji: '🐱', category: 'animals', x: -0.46, y: 0.54 },
  { word: 'kitten', emoji: '🧶', category: 'animals', x: -0.46, y: 0.82 },
  { word: 'lion', emoji: '🦁', category: 'animals', x: -0.86, y: 0.28 },
  { word: 'wolf', emoji: '🐺', category: 'animals', x: -0.60, y: 0.28 },

  // Places (Countries & Capitals)
  { word: 'france', emoji: '🇫🇷', category: 'places', x: -0.78, y: -0.66 },
  { word: 'paris', emoji: '🗼', category: 'places', x: -0.78, y: -0.34 },
  { word: 'japan', emoji: '🇯🇵', category: 'places', x: -0.36, y: -0.66 },
  { word: 'tokyo', emoji: '🏯', category: 'places', x: -0.36, y: -0.34 },
  { word: 'italy', emoji: '🇮🇹', category: 'places', x: -0.58, y: -0.82 },
  { word: 'rome', emoji: '🏛️', category: 'places', x: -0.58, y: -0.50 },

  // Food
  { word: 'apple', emoji: '🍎', category: 'food', x: 0.08, y: -0.56 },
  { word: 'banana', emoji: '🍌', category: 'food', x: 0.20, y: -0.66 },
  { word: 'pizza', emoji: '🍕', category: 'food', x: 0.36, y: -0.46 },
  { word: 'burger', emoji: '🍔', category: 'food', x: 0.46, y: -0.58 },
  { word: 'cake', emoji: '🎂', category: 'food', x: 0.26, y: -0.82 },

  // Space
  { word: 'sun', emoji: '☀️', category: 'space', x: -0.08, y: 0.84 },
  { word: 'moon', emoji: '🌙', category: 'space', x: 0.12, y: 0.78 },
  { word: 'star', emoji: '⭐', category: 'space', x: -0.18, y: 0.66 },
  { word: 'planet', emoji: '🪐', category: 'space', x: -0.02, y: 0.56 },
  { word: 'rocket', emoji: '🚀', category: 'space', x: 0.18, y: 0.50 },

  // Tech
  { word: 'robot', emoji: '🤖', category: 'tech', x: 0.68, y: -0.34 },
  { word: 'computer', emoji: '💻', category: 'tech', x: 0.82, y: -0.48 },
  { word: 'code', emoji: '🧩', category: 'tech', x: 0.72, y: -0.68 },
  { word: 'chip', emoji: '🔌', category: 'tech', x: 0.88, y: -0.64 },
  { word: 'ai', emoji: '🧠', category: 'tech', x: 0.60, y: -0.52 },
];

export const WORD_MATH_PRESETS = [
  { label: 'king − man + woman', a: 'king', b: 'man', c: 'woman', expected: 'queen' },
  { label: 'puppy − dog + cat', a: 'puppy', b: 'dog', c: 'cat', expected: 'kitten' },
  { label: 'paris − france + japan', a: 'paris', b: 'france', c: 'japan', expected: 'tokyo' },
  { label: 'prince − man + woman', a: 'prince', b: 'man', c: 'woman', expected: 'princess' },
];

/**
 * Perform vector analogy arithmetic: vec(a) - vec(b) + vec(c)
 * and return the closest words with similarity scores in (0, 1].
 *
 * @param {string} a
 * @param {string} b
 * @param {string} c
 * @param {number} [topN=5]
 * @returns {{
 *   formula: string,
 *   target: { x: number, y: number },
 *   inputs: { a: object, b: object, c: object },
 *   bestMatch: object,
 *   results: Array<{ word: string, emoji: string, category: string, x: number, y: number, distance: number, similarity: number }>
 * }}
 */
export function wordMath(a, b, c, topN = 5) {
  const findWord = (w) =>
    EMBEDDING_WORDS.find((entry) => entry.word.toLowerCase() === String(w).toLowerCase());

  const wa = findWord(a);
  const wb = findWord(b);
  const wc = findWord(c);

  if (!wa || !wb || !wc) {
    const missing = [
      !wa ? a : null,
      !wb ? b : null,
      !wc ? c : null,
    ].filter(Boolean);
    throw new Error(`Unknown embedding word(s): ${missing.join(', ')}`);
  }

  const target = {
    x: wa.x - wb.x + wc.x,
    y: wa.y - wb.y + wc.y,
  };

  const excluded = new Set([wa.word, wb.word, wc.word]);

  const ranked = EMBEDDING_WORDS.filter((entry) => !excluded.has(entry.word))
    .map((entry) => {
      const distance = Math.hypot(entry.x - target.x, entry.y - target.y);
      const similarity = Math.exp(-distance * 2.5);
      return {
        ...entry,
        distance,
        similarity,
      };
    })
    .sort((u, v) => u.distance - v.distance);

  const results = ranked.slice(0, Math.max(1, topN));
  return {
    formula: `${wa.word} - ${wb.word} + ${wc.word}`,
    target,
    inputs: { a: wa, b: wb, c: wc },
    bestMatch: results[0],
    results,
  };
}

/**
 * Helper to build a normalized N x N attention weight matrix where every row sums to 1.
 * @param {string[]} tokens
 * @param {Record<number, Record<number, number>>} customLinks - Map of queryIndex -> { keyIndex: weight }
 * @returns {number[][]}
 */
function buildAttentionMatrix(tokens, customLinks) {
  const n = tokens.length;
  return tokens.map((_, qIdx) => {
    const row = new Array(n).fill(0.03);
    row[qIdx] = 0.25;
    if (qIdx > 0) row[qIdx - 1] += 0.08;
    if (qIdx < n - 1) row[qIdx + 1] += 0.08;

    const overrides = customLinks[qIdx];
    if (overrides) {
      for (const [kStr, weight] of Object.entries(overrides)) {
        const kIdx = Number(kStr);
        if (kIdx >= 0 && kIdx < n) {
          row[kIdx] = weight;
        }
      }
    }

    const sum = row.reduce((acc, v) => acc + v, 0);
    return row.map((v) => Number((v / sum).toFixed(4)));
  });
}

const TROPHY_BIG_TOKENS = [
  'The', 'trophy', "didn't", 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'big',
];
const TROPHY_SMALL_TOKENS = [
  'The', 'trophy', "didn't", 'fit', 'in', 'the', 'suitcase', 'because', 'it', 'was', 'too', 'small',
];
const ANIMAL_TIRED_TOKENS = [
  'The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'tired',
];
const ANIMAL_WIDE_TOKENS = [
  'The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', 'wide',
];

/**
 * Rich interactive self-attention examples (Winograd pronoun resolution pairs).
 * Clicking any token highlights the row weights[tokenIndex] showing what it attends to.
 */
export const ATTENTION_EXAMPLES = [
  {
    id: 'trophy-big',
    pairId: 'trophy',
    title: 'The Big Trophy',
    sentence: TROPHY_BIG_TOKENS.join(' '),
    tokens: TROPHY_BIG_TOKENS,
    focusIndex: 8, // "it"
    referentIndex: 1, // "trophy"
    explanation:
      'Because the ending says "too big", the word "it" pays strong attention to "trophy" — the thing that is too large to go inside!',
    weights: buildAttentionMatrix(TROPHY_BIG_TOKENS, {
      1: { 0: 0.22, 1: 0.35, 3: 0.25, 11: 0.22 },
      3: { 1: 0.38, 2: 0.24, 3: 0.25, 6: 0.32 },
      6: { 4: 0.2, 5: 0.2, 6: 0.38, 3: 0.24 },
      8: { 1: 0.72, 6: 0.1, 8: 0.14, 11: 0.42 }, // "it" -> "trophy" & "big"
      11: { 1: 0.52, 8: 0.38, 10: 0.22, 11: 0.28 },
    }),
  },
  {
    id: 'trophy-small',
    pairId: 'trophy',
    title: 'The Small Suitcase',
    sentence: TROPHY_SMALL_TOKENS.join(' '),
    tokens: TROPHY_SMALL_TOKENS,
    focusIndex: 8, // "it"
    referentIndex: 6, // "suitcase"
    explanation:
      'Change just ONE word ("big" → "small") and attention flips! Now "it" pays strong attention to "suitcase" instead of "trophy".',
    weights: buildAttentionMatrix(TROPHY_SMALL_TOKENS, {
      1: { 0: 0.22, 1: 0.35, 3: 0.28 },
      3: { 1: 0.35, 2: 0.24, 3: 0.25, 6: 0.36 },
      6: { 4: 0.2, 5: 0.2, 6: 0.35, 11: 0.28 },
      8: { 1: 0.1, 6: 0.74, 8: 0.14, 11: 0.42 }, // "it" -> "suitcase" & "small"
      11: { 6: 0.54, 8: 0.38, 10: 0.22, 11: 0.28 },
    }),
  },
  {
    id: 'animal-tired',
    pairId: 'animal',
    title: 'The Tired Animal',
    sentence: ANIMAL_TIRED_TOKENS.join(' '),
    tokens: ANIMAL_TIRED_TOKENS,
    focusIndex: 7, // "it"
    referentIndex: 1, // "animal"
    explanation:
      'Streets cannot feel tired — living creatures do! Attention connects "it" directly to "animal" and "tired".',
    weights: buildAttentionMatrix(ANIMAL_TIRED_TOKENS, {
      1: { 0: 0.2, 1: 0.36, 3: 0.26, 10: 0.28 },
      3: { 1: 0.38, 2: 0.22, 3: 0.24, 5: 0.34 },
      5: { 3: 0.26, 4: 0.22, 5: 0.38 },
      7: { 1: 0.75, 5: 0.08, 7: 0.14, 10: 0.44 }, // "it" -> "animal" & "tired"
      10: { 1: 0.56, 7: 0.36, 9: 0.22, 10: 0.26 },
    }),
  },
  {
    id: 'animal-wide',
    pairId: 'animal',
    title: 'The Wide Street',
    sentence: ANIMAL_WIDE_TOKENS.join(' '),
    tokens: ANIMAL_WIDE_TOKENS,
    focusIndex: 7, // "it"
    referentIndex: 5, // "street"
    explanation:
      'When the last word is "wide", self-attention links "it" to "street" because streets can be too wide to cross!',
    weights: buildAttentionMatrix(ANIMAL_WIDE_TOKENS, {
      1: { 0: 0.2, 1: 0.36, 3: 0.28 },
      3: { 1: 0.34, 2: 0.22, 3: 0.24, 5: 0.38 },
      5: { 3: 0.28, 4: 0.2, 5: 0.36, 10: 0.3 },
      7: { 1: 0.09, 5: 0.76, 7: 0.14, 10: 0.44 }, // "it" -> "street" & "wide"
      10: { 5: 0.58, 7: 0.36, 9: 0.22, 10: 0.26 },
    }),
  },
];

/**
 * Themed kid-friendly starter corpora for training the in-browser MiniLanguageModel.
 */
export const STARTER_CORPORA = {
  space: {
    id: 'space',
    title: 'Space Adventure',
    emoji: '🚀',
    description: 'Rockets, glowing planets, friendly aliens, and starlight missions.',
    text: `The silver rocket blasted off into the starry sky.
The brave astronaut steered the silver rocket past the glowing moon.
The glowing moon shined bright above the quiet craters.
On the red planet, a friendly alien waved a glowing lantern.
The brave astronaut shared cosmic snacks with the friendly alien.
Together they explored the starry sky and mapped the red planet.
The silver rocket zoomed past the bright comets and sparkling stars.
Every star in the starry sky twinkled like a tiny diamond.`,
  },
  dinosaurs: {
    id: 'dinosaurs',
    title: 'Dinosaur Park',
    emoji: '🦕',
    description: 'Gentle giants, leafy jungles, roaring T-Rexes, and ancient volcanoes.',
    text: `The giant dinosaur stomped through the green jungle.
The green jungle was full of tall ferns and giant trees.
A tiny triceratops nibbled on sweet berries near the sparkling river.
Near the sparkling river, a friendly stegosaurus wagged its spiky tail.
Suddenly the volcano rumbled and puffed a cloud of warm smoke.
The giant dinosaur led the tiny triceratops to a safe valley.
In the safe valley, all the dinosaurs rested beneath the warm sun.
The green jungle echoed with happy roars and gentle footsteps.`,
  },
  fairytale: {
    id: 'fairytale',
    title: 'Fairy Tale Castle',
    emoji: '🏰',
    description: 'Clever dragons, glowing spells, crystal castles, and brave knights.',
    text: `The clever dragon guarded the crystal castle on the snowy mountain.
Inside the crystal castle, the young wizard mixed a sparkling potion.
The sparkling potion turned golden and floated into the air.
A brave knight rode across the wooden bridge toward the crystal castle.
The clever dragon smiled and offered the brave knight warm tea.
Together the young wizard and the brave knight solved the ancient riddle.
The ancient riddle unlocked a secret garden full of glowing flowers.
Every glowing flower sang a gentle melody beneath the silver moon.`,
  },
  robots: {
    id: 'robots',
    title: 'Robot Lab',
    emoji: '🤖',
    description: 'Helpful bots, blinking circuits, clever code, and sunny workshops.',
    text: `The little robot rolled across the sunny workshop floor.
Its bright sensors scanned the colorful gears and shiny wires.
The clever inventor wrote neat code for the little robot.
With neat code, the little robot stacked tall towers of blocks.
A tiny drone buzzed overhead and delivered a glowing battery.
The little robot beeped happily and painted a smiling sun.
Every machine in the sunny workshop worked together as a team.
The clever inventor cheered as the little robot danced in circles.`,
  },
};

export const STARTER_CORPORA_LIST = Object.values(STARTER_CORPORA);

/**
 * Normalize raw text into word/punctuation tokens for n-gram modeling.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeForModel(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.toLowerCase().match(/[a-z0-9']+[a-z0-9]|[a-z0-9]|[.,!?]/g);
  return matches || [];
}

/**
 * Detokenize an array of model tokens into readable prose.
 * @param {string[]} tokens
 * @returns {string}
 */
export function detokenizeModelTokens(tokens) {
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (i === 0) {
      out += tok;
    } else if (/^[.,!?]$/.test(tok)) {
      out += tok;
    } else {
      out += ` ${tok}`;
    }
  }
  return out;
}

/**
 * Trainable in-browser n-gram Language Model (trigram + bigram backoff + unigram smoothing).
 */
export class MiniLanguageModel {
  constructor() {
    this.clear();
  }

  /**
   * Reset all learned counts.
   */
  clear() {
    this.unigrams = new Map();
    this.bigrams = new Map();
    this.trigrams = new Map();
    this.totalTokens = 0;
  }

  /**
   * Train the model on text (replaces existing counts unless append=true).
   *
   * @param {string} text
   * @param {boolean} [append=false]
   * @returns {{ tokenCount: number, vocabSize: number, bigramCount: number, trigramCount: number }}
   */
  train(text, append = false) {
    if (!append) this.clear();
    const tokens = tokenizeForModel(text);
    this.totalTokens += tokens.length;

    for (let i = 0; i < tokens.length; i++) {
      const w0 = tokens[i];
      this.unigrams.set(w0, (this.unigrams.get(w0) || 0) + 1);

      if (i >= 1) {
        const prev1 = tokens[i - 1];
        if (!this.bigrams.has(prev1)) this.bigrams.set(prev1, new Map());
        const bMap = this.bigrams.get(prev1);
        bMap.set(w0, (bMap.get(w0) || 0) + 1);
      }

      if (i >= 2) {
        const key2 = `${tokens[i - 2]} ${tokens[i - 1]}`;
        if (!this.trigrams.has(key2)) this.trigrams.set(key2, new Map());
        const tMap = this.trigrams.get(key2);
        tMap.set(w0, (tMap.get(w0) || 0) + 1);
      }
    }

    return this.getStats();
  }

  /**
   * Return model vocabulary and n-gram statistics.
   */
  getStats() {
    return {
      tokenCount: this.totalTokens,
      vocabSize: this.unigrams.size,
      bigramCount: this.bigrams.size,
      trigramCount: this.trigrams.size,
    };
  }

  /**
   * Compute the next-token probability distribution given context tokens,
   * applying trigram/bigram backoff, temperature scaling, and top-K filtering.
   *
   * @param {string[]|string} contextTokens - Previous tokens (or raw prompt string)
   * @param {number} [temperature=1.0] - Sampling temperature (low = focused, high = creative)
   * @param {number} [topK=5] - Keep top K candidates (0 or null keeps all)
   * @returns {Array<{ token: string, probability: number, count: number, source: 'trigram'|'bigram'|'unigram' }>}
   */
  getNextTokenDistribution(contextTokens = [], temperature = 1.0, topK = 5) {
    if (this.unigrams.size === 0) return [];

    const tokens =
      typeof contextTokens === 'string'
        ? tokenizeForModel(contextTokens)
        : contextTokens.map((t) => String(t).toLowerCase());

    const last1 = tokens.length >= 1 ? tokens[tokens.length - 1] : null;
    const last2 = tokens.length >= 2 ? `${tokens[tokens.length - 2]} ${tokens[tokens.length - 1]}` : null;

    const trigramMap = last2 ? this.trigrams.get(last2) : null;
    const bigramMap = last1 ? this.bigrams.get(last1) : null;

    // Combine counts with backoff preference (trigram > bigram > unigram)
    // while keeping smoothing so high temperatures can explore plausible words
    const candidates = new Map();

    if (trigramMap && trigramMap.size > 0) {
      for (const [tok, count] of trigramMap.entries()) {
        candidates.set(tok, { score: count * 6.0, count, source: 'trigram' });
      }
    }

    if (bigramMap && bigramMap.size > 0) {
      for (const [tok, count] of bigramMap.entries()) {
        const existing = candidates.get(tok);
        if (existing) {
          existing.score += count * 1.5;
        } else {
          candidates.set(tok, { score: count * 1.5, count, source: 'bigram' });
        }
      }
    }

    if (candidates.size === 0) {
      for (const [tok, count] of this.unigrams.entries()) {
        candidates.set(tok, { score: count, count, source: 'unigram' });
      }
    } else if (candidates.size < (topK || 5)) {
      // Gently pad with top unigrams at small smoothed weight for educational visibility
      for (const [tok, count] of this.unigrams.entries()) {
        if (!candidates.has(tok)) {
          candidates.set(tok, {
            score: 0.12 * (count / Math.max(1, this.totalTokens)),
            count: 0,
            source: 'unigram',
          });
        }
      }
    }

    // Sort by raw score descending and apply top-K truncation before temperature softmax
    let entries = Array.from(candidates.entries())
      .map(([token, info]) => ({ token, ...info }))
      .sort((a, b) => b.score - a.score || a.token.localeCompare(b.token));

    if (topK && topK > 0) {
      entries = entries.slice(0, topK);
    }

    // Temperature-scaled softmax over log-scores: p_i ∝ exp(log(score_i) / T)
    const safeTemp = Math.max(0.05, Number.isFinite(temperature) ? temperature : 1.0);
    const logits = entries.map((e) => Math.log(Math.max(1e-9, e.score)) / safeTemp);
    const maxLogit = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - maxLogit));
    const sumExps = exps.reduce((acc, v) => acc + v, 0);

    return entries.map((e, i) => ({
      token: e.token,
      probability: exps[i] / sumExps,
      count: e.count,
      source: e.source,
    }));
  }

  /**
   * Sample the next token from the model's probability distribution.
   *
   * @param {string[]|string} contextTokens
   * @param {number} [temperature=1.0]
   * @param {number} [topK=5]
   * @param {() => number} [rng=Math.random]
   * @returns {{ token: string|null, probability: number, distribution: Array<object> }}
   */
  sampleNextToken(contextTokens = [], temperature = 1.0, topK = 5, rng = Math.random) {
    const distribution = this.getNextTokenDistribution(contextTokens, temperature, topK);
    if (distribution.length === 0) {
      return { token: null, probability: 0, distribution: [] };
    }

    const r = rng();
    let cumulative = 0;
    for (const item of distribution) {
      cumulative += item.probability;
      if (r <= cumulative) {
        return {
          token: item.token,
          probability: item.probability,
          distribution,
        };
      }
    }

    const last = distribution[distribution.length - 1];
    return {
      token: last.token,
      probability: last.probability,
      distribution,
    };
  }

  /**
   * Generate a multi-token continuation from a prompt.
   *
   * @param {string} prompt
   * @param {number} [maxTokens=20]
   * @param {number} [temperature=1.0]
   * @param {number} [topK=5]
   * @param {() => number} [rng=Math.random]
   * @returns {{ text: string, tokens: string[], steps: Array<object> }}
   */
  generate(prompt = '', maxTokens = 20, temperature = 1.0, topK = 5, rng = Math.random) {
    const tokens = tokenizeForModel(prompt);
    const steps = [];

    for (let i = 0; i < maxTokens; i++) {
      const sample = this.sampleNextToken(tokens, temperature, topK, rng);
      if (!sample.token) break;
      tokens.push(sample.token);
      steps.push(sample);
    }

    return {
      text: detokenizeModelTokens(tokens),
      tokens,
      steps,
    };
  }
}
