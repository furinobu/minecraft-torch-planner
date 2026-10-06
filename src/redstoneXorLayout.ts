import type { LogicLayoutPart } from "./redstoneLogicLayouts";

export const DROPPER_HOPPER_XOR_LAYOUT: LogicLayoutPart[] = [
  { layer: 0, kind: "stone", x: 0, z: 0 },
  { layer: 0, kind: "lever", x: 0, z: 0, facing: "east", mount: "wall", powered: false, input: "A" },
  { layer: 0, kind: "dust", x: 1, z: 0, signal: "A" },
  { layer: 0, kind: "observer", x: 2, z: 0, facing: "west", input: "A" },
  { layer: 0, kind: "dropper", x: 3, z: 0, facing: "up" },
  { layer: 0, kind: "observer", x: 4, z: 0, facing: "east", input: "B" },
  { layer: 0, kind: "dust", x: 5, z: 0, signal: "B" },
  { layer: 0, kind: "stone", x: 6, z: 0 },
  { layer: 0, kind: "lever", x: 6, z: 0, facing: "west", mount: "wall", powered: false, input: "B" },

  { layer: 1, kind: "hopper", x: 3, z: 0, facing: "down" },
  { layer: 0, kind: "stone", x: 3, z: 1 },
  { layer: 1, kind: "comparator", x: 3, z: 1, facing: "south", comparatorMode: "compare" },
  { layer: 0, kind: "stone", x: 3, z: 2 },
  { layer: 1, kind: "dust", x: 3, z: 2, signal: "OUTPUT" },
  { layer: 0, kind: "stone", x: 3, z: 3 },
  { layer: 1, kind: "dust", x: 3, z: 3, signal: "OUTPUT" },
  { layer: 0, kind: "stone", x: 3, z: 4 },
  { layer: 1, kind: "lamp", x: 3, z: 4, label: "OUT" },
];

export const PISTON_XOR_LAYOUT: LogicLayoutPart[] = [
  { layer: 0, kind: "stone", x: 0, z: 0 },
  { layer: 0, kind: "lever", x: 0, z: 0, facing: "east", mount: "wall", powered: false, input: "A" },
  { layer: 0, kind: "stone", x: 0, z: 2 },
  { layer: 0, kind: "lever", x: 0, z: 2, facing: "east", mount: "wall", powered: false, input: "B" },

  { layer: 0, kind: "dust", x: 1, z: 0, signal: "A" },
  { layer: 0, kind: "stone", x: 2, z: 0 },
  { layer: 0, kind: "dust", x: 1, z: 2, signal: "B" },
  { layer: 0, kind: "stone", x: 2, z: 2 },
  { layer: 0, kind: "stone", x: 2, z: 1 },

  { layer: 1, kind: "dust", x: 2, z: 0, signal: "A" },
  { layer: 1, kind: "dust", x: 2, z: 2, signal: "B" },
  { layer: 1, kind: "torch", x: 2, z: 1, signal: "OUTPUT" },
  { layer: 0, kind: "repeater", x: 3, z: 1, facing: "east", signal: "A_ONLY" },
  { layer: 0, kind: "repeater", x: 3, z: 2, facing: "east", signal: "B_ONLY" },
  { layer: 0, kind: "piston", x: 4, z: 0, facing: "up", pistonType: "sticky", input: "A" },
  { layer: 0, kind: "piston", x: 4, z: 1, facing: "south", pistonType: "sticky", input: "B" },
  { layer: 0, kind: "stone", x: 4, z: 2, facing: "south", input: "B", movable: true, label: "MOBILE" },

  { layer: 0, kind: "dust", x: 5, z: 1, signal: "OUTPUT" },
  { layer: 0, kind: "dust", x: 5, z: 2, signal: "OUTPUT" },
  { layer: 0, kind: "lamp", x: 6, z: 2, label: "OUT" },
];
