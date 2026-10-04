import type { LogicLayoutPart } from "./redstoneLogicLayouts";

const parts: LogicLayoutPart[] = [];
const solids = new Set<string>();

function cellKey(layer: number, x: number, z: number) {
  return `${layer}:${x}:${z}`;
}

function addBlockStack(x: number, z: number, topLayer: number) {
  for (let layer = 0; layer <= topLayer; layer += 1) {
    const key = cellKey(layer, x, z);
    if (solids.has(key)) continue;
    solids.add(key);
    parts.push({ layer, kind: "stone", x, z });
  }
}

function addDust(x: number, z: number, layer: number, signal: NonNullable<LogicLayoutPart["signal"]>) {
  addBlockStack(x, z, layer - 1);
  parts.push({ layer, kind: "dust", x, z, signal });
}

function addTorch(x: number, z: number, layer: number, signal: NonNullable<LogicLayoutPart["signal"]>) {
  addBlockStack(x, z, layer - 1);
  parts.push({ layer, kind: "torch", x, z, signal });
}

// Two side-mounted inputs on the east edge of the raised right platform.
addBlockStack(8, 0, 1);
parts.push({ layer: 1, kind: "lever", x: 8, z: 0, facing: "east", mount: "wall", powered: false, input: "A" });
addBlockStack(8, 2, 1);
parts.push({ layer: 1, kind: "lever", x: 8, z: 2, facing: "east", mount: "wall", powered: false, input: "B" });

// Raised right platform with the two torch paths and their block supports.
for (let x = 4; x <= 8; x += 1) {
  for (let z = 0; z <= 2; z += 1) addBlockStack(x, z, 1);
}
for (const [x, z] of [[1, 1], [2, 0], [2, 1], [2, 2], [3, 0], [3, 2]] as const) {
  addBlockStack(x, z, 0);
}

// Four torches form the two input paths; the fifth torch drives the output.
addTorch(7, 0, 2, "A");
addTorch(7, 2, 2, "B");
addTorch(5, 0, 2, "A_ONLY");
addTorch(5, 2, 2, "B_ONLY");

// Redstone runs along each input row and ends at the torch block boundaries.
for (const x of [6, 8]) addDust(x, 0, 2, "A");
for (const x of [6, 8]) addDust(x, 2, 2, "B");

// Exclusive paths step down from the raised platform and meet at the center torch.
addDust(4, 0, 2, "A_ONLY");
addDust(3, 0, 1, "A_ONLY");
addDust(4, 2, 2, "B_ONLY");
addDust(3, 2, 1, "B_ONLY");
addDust(3, 1, 1, "OUTPUT");
addTorch(2, 1, 1, "OUTPUT");
addDust(1, 1, 1, "OUTPUT");
parts.push({ layer: 0, kind: "lamp", x: 0, z: 1, label: "OUT" });

export const COMPACT_XOR_LAYOUT = parts;
