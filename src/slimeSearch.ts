export const SLIME_AREA_SIZE = 16;
export const MAX_SEARCH_RADIUS = 512;

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
