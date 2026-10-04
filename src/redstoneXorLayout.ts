import type { LogicLayoutPart } from "./redstoneLogicLayouts";

// Voxel layout traced from the two-torch XOR reference image.
const parts: LogicLayoutPart[] = [];
const blocks = new Set<string>();
const solids = new Set<string>();

function cellKey(layer: number, x: number, z: number) {
  return `${layer}:${x}:${z}`;
}

function addBlockStack(x: number, z: number, topLayer: number) {
  for (let layer = 0; layer <= topLayer; layer += 1) {
    const key = cellKey(layer, x, z);
    if (solids.has(key) || blocks.has(key)) continue;
    blocks.add(key);
    solids.add(key);
    parts.push({ layer, kind: "stone", x, z });
  }
}

function addLamp(x: number, z: number, label: "A" | "B" | "OUT") {
  addBlockStack(x, z, 0);
  solids.add(cellKey(1, x, z));
  parts.push({ layer: 1, kind: "lamp", x, z, label });
}

function addLever(x: number, z: number, input: "A" | "B") {
  addBlockStack(x, z, 1);
  parts.push({ layer: 1, kind: "lever", x, z, facing: "east", mount: "wall", powered: false, input });
}

function addDust(x: number, z: number, layer: number, signal: NonNullable<LogicLayoutPart["signal"]>) {
  addBlockStack(x, z, layer - 1);
  parts.push({ layer, kind: "dust", x, z, signal });
}

function addTorch(x: number, z: number, signal: "A_ONLY" | "B_ONLY") {
  addBlockStack(x, z, 1);
  parts.push({ layer: 2, kind: "torch", x, z, signal });
}

// Three lamps and two separate wall-mounted lever supports.
addLamp(0, 2, "OUT");
addLamp(8, 0, "A");
addLamp(8, 2, "B");
addLever(9, 0, "A");
addLever(9, 2, "B");

// Each input rail runs over the lamp and lever supports to a standing torch.
for (const x of [6, 7, 8, 9]) addDust(x, 0, 2, "A");
for (const x of [6, 7, 8, 9]) addDust(x, 2, 2, "B");
addTorch(5, 0, "B_ONLY");
addTorch(5, 2, "A_ONLY");

// The two raised dust runs sit on full two-block supports.
for (const x of [2, 3, 4]) {
  addDust(x, 0, 2, "B_ONLY");
  addDust(x, 2, 2, "A_ONLY");
}

// Lower paths step down the front faces and return toward the output lamp.
for (const [x, z] of [[2, 1], [1, 1], [2, 3], [1, 3]] as const) {
  addDust(x, z, 1, z === 1 ? "B_ONLY" : "A_ONLY");
}
addDust(1, 2, 1, "OUTPUT");

// Full central supports visible between the two torch paths.
addBlockStack(4, 1, 1);
addBlockStack(5, 1, 1);

export const COMPACT_XOR_LAYOUT = parts;
