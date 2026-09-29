export type TorchPlan = {
  positions: number[];
  optimal: boolean;
  examinedNodes: number;
};

type Candidate = {
  cell: number;
  coverage: bigint;
};

const bitCount = (bits: bigint): number => {
  let count = 0;
  while (bits !== 0n) {
    bits &= bits - 1n;
    count += 1;
  }
  return count;
};

export function planTorches(
  width: number,
  height: number,
  terrain: Uint8Array,
  radius: number,
  timeLimitMs = 2500,
): TorchPlan {
  const cells: number[] = [];
  for (let i = 0; i < width * height; i += 1) {
    if (terrain[i] === 1) cells.push(i);
  }
  if (cells.length === 0) return { positions: [], optimal: true, examinedNodes: 0 };

  const cellToIndex = new Int32Array(width * height).fill(-1);
  cells.forEach((cell, i) => {
    cellToIndex[cell] = i;
  });
  const byCell: number[][] = cells.map(() => []);
  const visited = new Uint32Array(width * height);
  const distances = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const candidates: Candidate[] = cells.map((cell, candidateIndex) => {
    let coverage = 0n;
    const visitId = candidateIndex + 1;
    let head = 0;
    let tail = 1;
    queue[0] = cell;
    visited[cell] = visitId;
    distances[cell] = 0;

    while (head < tail) {
      const current = queue[head++];
      const distance = distances[current];
      const cellIndex = cellToIndex[current];
      if (cellIndex !== -1) {
        coverage |= 1n << BigInt(cellIndex);
        byCell[cellIndex].push(candidateIndex);
      }
      if (distance >= radius) continue;

      const x = current % width;
      const addNeighbor = (next: number) => {
        if (terrain[next] === 2 || visited[next] === visitId) return;
        visited[next] = visitId;
        distances[next] = distance + 1;
        queue[tail++] = next;
      };
      if (x > 0) addNeighbor(current - 1);
      if (x + 1 < width) addNeighbor(current + 1);
      if (current >= width) addNeighbor(current - width);
      if (current + width < width * height) addNeighbor(current + width);
    }
    return { cell, coverage };
  });

  const fullMask = (1n << BigInt(cells.length)) - 1n;
  const greedy: number[] = [];
  let greedyUncovered = fullMask;
  while (greedyUncovered !== 0n) {
    let bestIndex = -1;
    let bestGain = -1;
    for (let i = 0; i < candidates.length; i += 1) {
      const gain = bitCount(candidates[i].coverage & greedyUncovered);
      if (gain > bestGain) {
        bestIndex = i;
        bestGain = gain;
      }
    }
    if (bestIndex < 0 || bestGain === 0) break;
    greedy.push(bestIndex);
    greedyUncovered &= ~candidates[bestIndex].coverage;
  }

  let best = greedy;
  let examinedNodes = 0;
  let timedOut = false;
  const deadline = performance.now() + timeLimitMs;
  const selected: number[] = [];

  const search = (uncovered: bigint, available: Uint8Array): void => {
    examinedNodes += 1;
    if (performance.now() >= deadline) {
      timedOut = true;
      return;
    }
    if (uncovered === 0n) {
      if (selected.length < best.length) best = [...selected];
      return;
    }
    if (selected.length + 1 >= best.length) return;

    let pivot = -1;
    let pivotOptions: number[] = [];
    let maxGain = 0;
    for (let bitIndex = 0; bitIndex < cells.length; bitIndex += 1) {
      const bit = 1n << BigInt(bitIndex);
      if ((uncovered & bit) === 0n) continue;
      const options = byCell[bitIndex].filter((candidateIndex) => available[candidateIndex] === 1);
      if (options.length === 0) return;
      if (options.length < pivotOptions.length || pivot === -1) {
        pivot = bitIndex;
        pivotOptions = options;
      }
      for (const candidateIndex of options) {
        maxGain = Math.max(maxGain, bitCount(candidates[candidateIndex].coverage & uncovered));
      }
    }
    if (pivot === -1 || maxGain === 0) return;
    const lowerBound = Math.ceil(bitCount(uncovered) / maxGain);
    if (selected.length + lowerBound >= best.length) return;

    pivotOptions.sort((a, b) =>
      bitCount(candidates[b].coverage & uncovered) - bitCount(candidates[a].coverage & uncovered),
    );
    for (let optionIndex = 0; optionIndex < pivotOptions.length; optionIndex += 1) {
      if (timedOut) return;
      const candidateIndex = pivotOptions[optionIndex];
      const branchAvailable = available.slice();
      for (let excluded = 0; excluded <= optionIndex; excluded += 1) {
        branchAvailable[pivotOptions[excluded]] = 0;
      }
      selected.push(candidateIndex);
      search(uncovered & ~candidates[candidateIndex].coverage, branchAvailable);
      selected.pop();
    }
  };

  search(fullMask, new Uint8Array(candidates.length).fill(1));
  return {
    positions: best.map((candidateIndex) => candidates[candidateIndex].cell),
    optimal: !timedOut,
    examinedNodes,
  };
}
