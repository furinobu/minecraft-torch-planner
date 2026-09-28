export type RegionChoice = {
  path: string;
  file: File;
  x: number;
  z: number;
};

export type ImportedRegion = {
  surface: Uint8Array;
  chunksRead: number;
  chunksSkipped: number;
};

type NbtValue =
  | number
  | bigint
  | string
  | Uint8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | { [key: string]: NbtValue };

const decoder = new TextDecoder();

function parseNbt(data: Uint8Array): { [key: string]: NbtValue } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 0;
  const readU8 = () => view.getUint8(offset++);
  const readI8 = () => view.getInt8(offset++);
  const readI16 = () => {
    const value = view.getInt16(offset);
    offset += 2;
    return value;
  };
  const readU16 = () => {
    const value = view.getUint16(offset);
    offset += 2;
    return value;
  };
  const readI32 = () => {
    const value = view.getInt32(offset);
    offset += 4;
    return value;
  };
  const readString = () => {
    const length = readU16();
    const value = decoder.decode(data.subarray(offset, offset + length));
    offset += length;
    return value;
  };

  const payload = (type: number): NbtValue => {
    switch (type) {
      case 1:
        return readI8();
      case 2:
        return readI16();
      case 3:
        return readI32();
      case 4: {
        const value = view.getBigInt64(offset);
        offset += 8;
        return value;
      }
      case 5: {
        const value = view.getFloat32(offset);
        offset += 4;
        return value;
      }
      case 6: {
        const value = view.getFloat64(offset);
        offset += 8;
        return value;
      }
      case 7: {
        const length = readI32();
        const value = data.slice(offset, offset + length);
        offset += length;
        return value;
      }
      case 8:
        return readString();
      case 9: {
        const childType = readU8();
        const length = readI32();
        return Array.from({ length }, () => payload(childType));
      }
      case 10: {
        const value: { [key: string]: NbtValue } = {};
        while (true) {
          const childType = readU8();
          if (childType === 0) break;
          const name = readString();
          value[name] = payload(childType);
        }
        return value;
      }
      case 11: {
        const length = readI32();
        const value = new Int32Array(length);
        for (let i = 0; i < length; i += 1) value[i] = readI32();
        return value;
      }
      case 12: {
        const length = readI32();
        const value = new BigInt64Array(length);
        for (let i = 0; i < length; i += 1) {
          value[i] = view.getBigInt64(offset);
          offset += 8;
        }
        return value;
      }
      default:
        throw new Error(`Unsupported NBT tag type ${type}`);
    }
  };

  if (readU8() !== 10) throw new Error("Chunk data does not start with an NBT compound");
  readString();
  return payload(10) as { [key: string]: NbtValue };
}

async function decompressChunk(bytes: Uint8Array, compression: number): Promise<Uint8Array> {
  if (compression === 3) return bytes;
  const format = compression === 1 ? "gzip" : compression === 2 ? "deflate" : null;
  if (!format) throw new Error(`Unsupported region compression format ${compression}`);
  const compressed = bytes.slice().buffer;
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function unpackHeight(data: BigInt64Array, index: number): number {
  const bits = 9;
  const valuesPerLong = Math.floor(64 / bits);
  if (data.length >= Math.ceil(256 / valuesPerLong)) {
    const word = BigInt.asUintN(64, data[Math.floor(index / valuesPerLong)]);
    return Number((word >> BigInt((index % valuesPerLong) * bits)) & 0x1ffn);
  }
  const bitIndex = index * bits;
  const wordIndex = Math.floor(bitIndex / 64);
  const shift = bitIndex % 64;
  let value = BigInt.asUintN(64, data[wordIndex]) >> BigInt(shift);
  if (shift + bits > 64 && wordIndex + 1 < data.length) {
    value |= BigInt.asUintN(64, data[wordIndex + 1]) << BigInt(64 - shift);
  }
  return Number(value & 0x1ffn);
}

function asCompound(value: NbtValue | undefined): { [key: string]: NbtValue } | undefined {
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Uint8Array) &&
      !(value instanceof Int32Array) && !(value instanceof BigInt64Array)) return value;
  return undefined;
}

export function findRegionFiles(files: File[]): RegionChoice[] {
  const regions: RegionChoice[] = [];
  for (const file of files) {
    const path = file.webkitRelativePath || file.name;
    const match = path.match(/(?:^|\/)region\/r\.(-?\d+)\.(-?\d+)\.mca$/i);
    if (!match) continue;
    regions.push({ path, file, x: Number(match[1]), z: Number(match[2]) });
  }
  return regions.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readRegion(file: File): Promise<ImportedRegion> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 8192) throw new Error("This region file is shorter than its 8 KiB header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const surface = new Uint8Array(512 * 512);
  let chunksRead = 0;
  let chunksSkipped = 0;

  for (let slot = 0; slot < 1024; slot += 1) {
    const location = view.getUint32(slot * 4);
    const sectorOffset = location >>> 8;
    if (sectorOffset === 0) continue;
    try {
      const chunkOffset = sectorOffset * 4096;
      const length = view.getUint32(chunkOffset);
      if (length < 1 || chunkOffset + 4 + length > bytes.length) throw new Error("Invalid chunk length");
      const compression = view.getUint8(chunkOffset + 4);
      if ((compression & 0x80) !== 0) throw new Error("External chunk streams are unsupported");
      const data = await decompressChunk(bytes.subarray(chunkOffset + 5, chunkOffset + 4 + length), compression);
      const root = parseNbt(data);
      const level = asCompound(root.Level) ?? root;
      const heightmaps = asCompound(level.Heightmaps) ?? asCompound(root.Heightmaps);
      const map = heightmaps?.MOTION_BLOCKING ?? heightmaps?.WORLD_SURFACE ?? heightmaps?.MOTION_BLOCKING_NO_LEAVES;
      if (!(map instanceof BigInt64Array) || map.length === 0) throw new Error("Chunk has no supported heightmap");

      const chunkX = slot % 32;
      const chunkZ = Math.floor(slot / 32);
      for (let z = 0; z < 16; z += 1) {
        for (let x = 0; x < 16; x += 1) {
          const heightValue = unpackHeight(map, z * 16 + x);
          if (heightValue > 0) surface[(chunkZ * 16 + z) * 512 + chunkX * 16 + x] = 1;
        }
      }
      chunksRead += 1;
    } catch {
      chunksSkipped += 1;
    }
  }

  if (chunksRead === 0) throw new Error("No readable chunks with a supported heightmap were found in this region");
  return { surface, chunksRead, chunksSkipped };
}
