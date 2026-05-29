/**
 * Levenshtein-similarity scoring. Inputs are normalised by `fullProcess`
 * (lowercase, Unicode non-letter/non-number → space, trim, collapse whitespace)
 * and compared with substitution cost 2. `partialRatio` walks candidate windows
 * from a Ratcliff-Obershelp matching-block decomposition (`getMatchingBlocks`),
 * giving an `O(n·m + k·m²)` cost profile.
 */

export function fullProcess(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}]/gu, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function levenshteinSubcost2(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const subCost = ai === b.charCodeAt(j - 1) ? 0 : 2;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + subCost;
      curr[j] = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n];
}

function ratioOfProcessed(processedA: string, processedB: string): number {
  if (processedA.length === 0 || processedB.length === 0) return 0;
  const distance = levenshteinSubcost2(processedA, processedB);
  const lensum = processedA.length + processedB.length;
  return Math.round((100 * (lensum - distance)) / lensum);
}

export function ratio(a: string, b: string): number {
  return ratioOfProcessed(fullProcess(a), fullProcess(b));
}

type MatchingBlock = readonly [aStart: number, bStart: number, size: number];

function buildB2J(b: string): Map<string, number[]> {
  const b2j = new Map<string, number[]>();
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    const arr = b2j.get(c);
    if (arr) {
      arr.push(i);
    } else {
      b2j.set(c, [i]);
    }
  }
  return b2j;
}

function findLongestMatch(
  a: string,
  b: string,
  b2j: Map<string, number[]>,
  alo: number,
  ahi: number,
  blo: number,
  bhi: number,
): MatchingBlock {
  let besti = alo;
  let bestj = blo;
  let bestsize = 0;
  // j2len[j] tracks run length ending at b[j], rebuilt fresh per i.
  let j2len = new Map<number, number>();
  for (let i = alo; i < ahi; i++) {
    const indices = b2j.get(a[i]);
    const newj2len = new Map<number, number>();
    if (indices) {
      for (const j of indices) {
        if (j < blo) continue;
        if (j >= bhi) break;
        const k = (j2len.get(j - 1) ?? 0) + 1;
        newj2len.set(j, k);
        if (k > bestsize) {
          besti = i - k + 1;
          bestj = j - k + 1;
          bestsize = k;
        }
      }
    }
    j2len = newj2len;
  }
  while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
    besti--;
    bestj--;
    bestsize++;
  }
  while (
    besti + bestsize < ahi &&
    bestj + bestsize < bhi &&
    a[besti + bestsize] === b[bestj + bestsize]
  ) {
    bestsize++;
  }
  return [besti, bestj, bestsize];
}

export function getMatchingBlocks(
  a: string,
  b: string,
): readonly MatchingBlock[] {
  const b2j = buildB2J(b);
  const la = a.length;
  const lb = b.length;
  const queue: Array<[number, number, number, number]> = [[0, la, 0, lb]];
  const matches: MatchingBlock[] = [];
  while (queue.length > 0) {
    const [alo, ahi, blo, bhi] = queue.pop()!;
    const block = findLongestMatch(a, b, b2j, alo, ahi, blo, bhi);
    const [i, j, k] = block;
    if (k > 0) {
      matches.push(block);
      if (alo < i && blo < j) queue.push([alo, i, blo, j]);
      if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
    }
  }
  matches.sort((x, y) => {
    if (x[0] !== y[0]) return x[0] - y[0];
    if (x[1] !== y[1]) return x[1] - y[1];
    return x[2] - y[2];
  });
  let i1 = 0;
  let j1 = 0;
  let k1 = 0;
  const nonAdjacent: MatchingBlock[] = [];
  for (const [i2, j2, k2] of matches) {
    if (i1 + k1 === i2 && j1 + k1 === j2) {
      k1 += k2;
    } else {
      if (k1 > 0) nonAdjacent.push([i1, j1, k1]);
      i1 = i2;
      j1 = j2;
      k1 = k2;
    }
  }
  if (k1 > 0) nonAdjacent.push([i1, j1, k1]);
  // Trailing dummy — partialRatio's last candidate window depends on it.
  nonAdjacent.push([la, lb, 0]);
  return nonAdjacent;
}

/**
 * Best-substring similarity ratio (0-100) between two strings after
 * `fullProcess`. For each matching block (and the trailing dummy) the
 * candidate window starts at `max(0, blockBStart - blockAStart)` with length
 * `shorter.length`; windows whose end runs past `longer` are clipped by
 * `.substring()`.
 */
export function partialRatio(a: string, b: string): number {
  const processedA = fullProcess(a);
  const processedB = fullProcess(b);
  if (processedA.length === 0 || processedB.length === 0) return 0;

  const [shorter, longer] =
    processedA.length <= processedB.length
      ? [processedA, processedB]
      : [processedB, processedA];

  const blocks = getMatchingBlocks(shorter, longer);
  let best = 0;
  for (const [shortStart, longStart, _size] of blocks) {
    const longSubstrStart = Math.max(0, longStart - shortStart);
    const longSubstrEnd = longSubstrStart + shorter.length;
    const longSubstr = longer.substring(longSubstrStart, longSubstrEnd);
    const score = ratioOfProcessed(shorter, longSubstr);
    if (score > 99) return 100;
    if (score > best) best = score;
  }
  return best;
}
