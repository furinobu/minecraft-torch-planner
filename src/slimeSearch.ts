export const SLIME_AREA_SIZE = 16;
export const MAX_SEARCH_RADIUS = 2048;
const WORLD_BORDER_CHUNK_MIN = -1_875_000;
const WORLD_BORDER_CHUNK_MAX = 1_874_999;
const MASK_48 = 2 ** 48;
const MASK_32 = 2 ** 32;
const JAVA_RANDOM_MULTIPLIER = 0x5deece66d;
const JAVA_RANDOM_XOR = 0x5e434e432;

export type SlimeSearchRequest = {
  seed: number;
  centerChunkX: number;
  centerChunkZ: number;
  radius: number;
};

export type SlimeSearchResult = {
  startChunkX: number;
  startChunkZ: number;
  slimeChunks: number[];
  slimeCount: number;
  tiedWindows: number;
  testedWindows: number;
  radius: number;
};

export function parseJavaSeed(seedText: string) {
  const trimmed = seedText.trim();
  if (!trimmed) throw new Error("Enter a Minecraft seed.");

  const longMin = -(1n << 63n);
  const longMax = (1n << 63n) - 1n;
  let seed: bigint;
  try {
    if (!/^[+-]?\d+$/.test(trimmed)) throw new Error("not a decimal seed");
    seed = BigInt(trimmed);
    if (seed < longMin || seed > longMax) throw new Error("outside signed long range");
  } catch {
    let hash = 0;
    for (let index = 0; index < trimmed.length; index += 1) {
      hash = (Math.imul(hash, 31) + trimmed.charCodeAt(index)) | 0;
    }
    seed = BigInt(hash);
  }
  return Number(BigInt.asUintN(48, seed));
}

function mod48(value: number) {
  const remainder = value % MASK_48;
  return remainder < 0 ? remainder + MASK_48 : remainder;
}

function xor48(value: number, bits: number) {
  const low = value % MASK_32;
  const high = Math.floor(value / MASK_32);
  const bitsLow = bits % MASK_32;
  const bitsHigh = Math.floor(bits / MASK_32);
  return ((high ^ bitsHigh) * MASK_32) + (((low ^ bitsLow) >>> 0));
}

function nextJavaRandomSeed(seed: number) {
  const low = seed % 0x10000;
  const middle = Math.floor(seed / 0x10000) % 0x10000;
  const high = Math.floor(seed / MASK_32);
  const multiplierLow = JAVA_RANDOM_MULTIPLIER % 0x10000;
  const multiplierMiddle = Math.floor(JAVA_RANDOM_MULTIPLIER / 0x10000) % 0x10000;
  const multiplierHigh = Math.floor(JAVA_RANDOM_MULTIPLIER / MASK_32);

  const productLow = low * multiplierLow;
  const productMiddle = low * multiplierMiddle + middle * multiplierLow + Math.floor(productLow / 0x10000);
  const productHigh = low * multiplierHigh + middle * multiplierMiddle + high * multiplierLow + Math.floor(productMiddle / 0x10000);
  const next = (productLow % 0x10000)
    + (productMiddle % 0x10000) * 0x10000
    + (productHigh % 0x10000) * MASK_32
    + 11;
  return next >= MASK_48 ? next - MASK_48 : next;
}

function xSeedTerm(chunkX: number) {
  return Math.imul(Math.imul(chunkX, chunkX), 4_987_142) + Math.imul(chunkX, 5_947_611);
}

function zSeedTerm(chunkZ: number) {
  const squared = BigInt(Math.imul(chunkZ, chunkZ));
  const linear = BigInt(Math.imul(chunkZ, 389_711));
  return Number(BigInt.asUintN(48, squared * 4_392_871n + linear));
}

function slimeFromTerms(seed: number, xTerm: number, zTerm: number) {
  let randomSeed = xor48(mod48(seed + xTerm + zTerm), JAVA_RANDOM_XOR);
  while (true) {
    randomSeed = nextJavaRandomSeed(randomSeed);
    const bits = Math.floor(randomSeed / 0x20000);
    const value = bits % 10;
    if (bits - value + 9 <= 0x7fffffff) return value === 0;
  }
}

export function isJavaSlimeChunk(seed: number, chunkX: number, chunkZ: number) {
  return slimeFromTerms(seed, xSeedTerm(chunkX), zSeedTerm(chunkZ));
}

export function searchBestSlimeArea({ seed, centerChunkX, centerChunkZ, radius }: SlimeSearchRequest): SlimeSearchResult {
  if (!Number.isInteger(radius) || radius < 0 || radius > MAX_SEARCH_RADIUS) {
    throw new Error(`Search radius must be between 0 and ${MAX_SEARCH_RADIUS} chunks.`);
  }

  const startsPerAxis = radius * 2 + 1;
  const startChunkX = centerChunkX - 7 - radius;
  const startChunkZ = centerChunkZ - 7 - radius;
  const scannedSide = startsPerAxis + SLIME_AREA_SIZE - 1;
  if (
    startChunkX < WORLD_BORDER_CHUNK_MIN
    || startChunkZ < WORLD_BORDER_CHUNK_MIN
    || startChunkX + startsPerAxis - 1 + SLIME_AREA_SIZE - 1 > WORLD_BORDER_CHUNK_MAX
    || startChunkZ + startsPerAxis - 1 + SLIME_AREA_SIZE - 1 > WORLD_BORDER_CHUNK_MAX
  ) {
    throw new Error("The search area would extend beyond the default Minecraft world border.");
  }

  const xTerms = new Float64Array(scannedSide);
  for (let x = 0; x < scannedSide; x += 1) xTerms[x] = xSeedTerm(startChunkX + x);

  const verticalSums = new Int32Array(startsPerAxis);
  const previousRows = Array.from({ length: SLIME_AREA_SIZE }, () => new Uint8Array(startsPerAxis));
  const rowChunks = new Uint8Array(scannedSide);
  const rowSums = new Uint8Array(startsPerAxis);
  let bestCount = -1;
  let tiedWindows = 0;
  let bestDistance = Infinity;
  let bestX = startChunkX;
  let bestZ = startChunkZ;

  for (let z = 0; z < scannedSide; z += 1) {
    const zTerm = zSeedTerm(startChunkZ + z);
    for (let x = 0; x < scannedSide; x += 1) {
      rowChunks[x] = slimeFromTerms(seed, xTerms[x], zTerm) ? 1 : 0;
    }

    let horizontalSum = 0;
    for (let x = 0; x < SLIME_AREA_SIZE; x += 1) horizontalSum += rowChunks[x];
    for (let x = 0; x < startsPerAxis; x += 1) {
      rowSums[x] = horizontalSum;
      if (x + SLIME_AREA_SIZE < scannedSide) {
        horizontalSum += rowChunks[x + SLIME_AREA_SIZE] - rowChunks[x];
      }
    }

    const historyIndex = z % SLIME_AREA_SIZE;
    const previousRow = previousRows[historyIndex];
    for (let x = 0; x < startsPerAxis; x += 1) {
      if (z >= SLIME_AREA_SIZE) verticalSums[x] -= previousRow[x];
      verticalSums[x] += rowSums[x];
      previousRow[x] = rowSums[x];
    }

    if (z < SLIME_AREA_SIZE - 1) continue;
    const windowZ = startChunkZ + z - (SLIME_AREA_SIZE - 1);
    for (let x = 0; x < startsPerAxis; x += 1) {
      const count = verticalSums[x];
      const windowX = startChunkX + x;
      const dx = windowX * 2 + SLIME_AREA_SIZE - 1 - centerChunkX * 2 - 1;
      const dz = windowZ * 2 + SLIME_AREA_SIZE - 1 - centerChunkZ * 2 - 1;
      const distance = dx * dx + dz * dz;
      if (count > bestCount) {
        bestCount = count;
        tiedWindows = 1;
        bestDistance = distance;
        bestX = windowX;
        bestZ = windowZ;
      } else if (count === bestCount) {
        tiedWindows += 1;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestX = windowX;
          bestZ = windowZ;
        }
      }
    }
  }

  const slimeChunks: number[] = [];
  for (let z = 0; z < SLIME_AREA_SIZE; z += 1) {
    for (let x = 0; x < SLIME_AREA_SIZE; x += 1) {
      if (isJavaSlimeChunk(seed, bestX + x, bestZ + z)) slimeChunks.push(z * SLIME_AREA_SIZE + x);
    }
  }

  return {
    startChunkX: bestX,
    startChunkZ: bestZ,
    slimeChunks,
    slimeCount: bestCount,
    tiedWindows,
    testedWindows: startsPerAxis * startsPerAxis,
    radius,
  };
}
