export const CIRCUIT_CATEGORIES = [
  "Signal",
  "Logic",
  "Pulse",
  "Clock",
  "Memory",
  "Detection",
  "Transport",
  "Storage",
  "Pistons",
] as const;

export type CircuitCategory = (typeof CIRCUIT_CATEGORIES)[number];

export type CircuitDefinition = {
  id: string;
  category: CircuitCategory;
  title: string;
  summary: string;
  path: string;
  width?: number;
  depth?: number;
  layers?: number;
  blocks?: number;
  sourceUrl?: string;
  sourceImageUrl?: string;
  clock?: { period: number; high: number; low: number };
};

// Local previews explain circuit behavior; dimensions and layouts come from each
// circuit's linked source catalog. Source references may omit a footprint.
export const REDSTONE_CIRCUITS: CircuitDefinition[] = [
  { id: "repeater-line", category: "Signal", title: "Repeater restores", summary: "Separate restoring signal strength from delaying a signal.", path: "repeater-line", width: 7, depth: 1, layers: 1 },
  { id: "dust-staircase", category: "Signal", title: "Dust staircase", summary: "Carry a signal between heights while checking support and clearance.", path: "dust-staircase", width: 9, depth: 1, layers: 5 },
  { id: "torch-tower", category: "Signal", title: "Vertical torch tower", summary: "Combine vertical routing with repeated inversion.", path: "torch-tower", width: 5, depth: 1, layers: 6 },
  { id: "wire-bridge", category: "Signal", title: "Independent wire bridge", summary: "Cross two routes without accidentally joining their signals.", path: "wire-bridge", width: 9, depth: 9, layers: 4 },
  { id: "strong-power", category: "Signal", title: "Power through a solid block", summary: "Distinguish a powered block from a block that passes the needed signal onward.", path: "strong-power", width: 5, depth: 4, layers: 1 },

  { id: "NOT", category: "Logic", title: "NOT gate", summary: "Invert one decision.", path: "not", width: 6, depth: 1, layers: 1 },
  { id: "OR", category: "Logic", title: "OR gate (isolated)", summary: "Repeaters isolate both inputs before they meet at the output.", path: "or", width: 5, depth: 3, layers: 1 },
  { id: "NOR", category: "Logic", title: "NOR gate", summary: "Detect that no input is active.", path: "nor", width: 8, depth: 3, layers: 1 },
  { id: "AND", category: "Logic", title: "AND gate", summary: "Require two conditions at the same time.", path: "and", width: 6, depth: 3, layers: 2 },
  { id: "NAND", category: "Logic", title: "NAND gate", summary: "Make the both-active state the only off state.", path: "nand", width: 4, depth: 3, layers: 2 },
  { id: "XOR", category: "Logic", title: "XOR gate", summary: "Choose a dropper-hopper latch or a piston-and-repeater layout.", path: "xor", width: 7, depth: 5, layers: 2 },
  { id: "XNOR", category: "Logic", title: "XNOR gate", summary: "Detect that two inputs agree.", path: "xnor", width: 13, depth: 17, layers: 4 },
  { id: "implication", category: "Logic", title: "Implication gate", summary: "Detect whether a logical rule is satisfied.", path: "implication", width: 5, depth: 3, layers: 1 },
  { id: "mux", category: "Logic", title: "2-to-1 multiplexer", summary: "Choose which input is allowed to become the output.", path: "mux", width: 17, depth: 20, layers: 7 },
  { id: "demux", category: "Logic", title: "1-to-2 demultiplexer", summary: "Send one input toward a selected output.", path: "demux", width: 13, depth: 17, layers: 4 },
  { id: "decoder", category: "Logic", title: "2-to-4 decoder", summary: "Translate a binary input pattern into a selected line.", path: "decoder", width: 25, depth: 17, layers: 4 },
  { id: "half-adder", category: "Logic", title: "Half adder", summary: "Add two bits and keep both sum and carry.", path: "half-adder", width: 19, depth: 17, layers: 4 },
  { id: "full-adder", category: "Logic", title: "Full adder", summary: "Add two data bits and an incoming carry.", path: "full-adder", width: 57, depth: 20, layers: 7 },
  { id: "majority", category: "Logic", title: "Three-input majority", summary: "Choose high when at least two of three inputs are high.", path: "majority", width: 25, depth: 20, layers: 7 },

  { id: "button-pulse", category: "Pulse", title: "Button pulse", summary: "Distinguish an event from a switch that stays on.", path: "button-pulse", width: 4, depth: 1, layers: 1 },
  { id: "observer-edge", category: "Pulse", title: "Edge detector (observer)", summary: "Notice changes instead of sustained levels.", path: "observer-edge", width: 6, depth: 1, layers: 1 },
  { id: "pulse-extender", category: "Pulse", title: "Pulse extender", summary: "Keep an output active longer than its input.", path: "pulse-extender", width: 8, depth: 2, layers: 1 },
  { id: "hopper-timer", category: "Pulse", title: "Hopper timer", summary: "Store a finite duration as a quantity of items.", path: "hopper-timer", width: 3, depth: 4, layers: 1 },
  { id: "rising-edge", category: "Pulse", title: "Rising-edge detector", summary: "Produce an event only when an input becomes active.", path: "rising-edge", width: 6, depth: 3, layers: 1 },
  { id: "falling-edge", category: "Pulse", title: "Falling-edge detector", summary: "Trigger an action when an input finishes.", path: "falling-edge", width: 6, depth: 3, layers: 1 },
  { id: "pulse-limiter", category: "Pulse", title: "Pulse limiter · 8 ticks", summary: "Make a short activation from a longer request.", path: "pulse-limiter", width: 6, depth: 3, layers: 1 },
  { id: "retriggerable-timer", category: "Pulse", title: "Retriggerable comparator extender", summary: "Extend a timed activity when another request arrives.", path: "retriggerable-timer", width: 8, depth: 3, layers: 1 },

  { id: "repeater-clock", category: "Clock", title: "Repeater clock", summary: "Measure one complete repeating cycle.", path: "repeater-clock", width: 5, depth: 3, layers: 1, blocks: 12, clock: { period: 20, high: 10, low: 10 } },
  { id: "torch-clock", category: "Clock", title: "Torch clock · 3 torches", summary: "Explain why an odd ring of inverters cannot hold a consistent value.", path: "torch-clock", width: 7, depth: 5, layers: 1, blocks: 20, clock: { period: 12, high: 6, low: 6 } },
  { id: "comparator-clock", category: "Clock", title: "Comparator clock", summary: "Use feedback to alternate a comparison result.", path: "comparator-clock", width: 5, depth: 3, layers: 1, blocks: 9, clock: { period: 8, high: 4, low: 4 } },
  { id: "hopper-clock", category: "Clock", title: "Two-hopper piston clock", summary: "Create a repeating interval from alternating item transfer.", path: "hopper-clock", width: 8, depth: 4, layers: 2, blocks: 20, clock: { period: 52, high: 50, low: 2 } },
  { id: "stoppable-clock", category: "Clock", title: "Stoppable repeater clock", summary: "Give an oscillator an explicit run control.", path: "enabled-clock", width: 5, depth: 5, layers: 1, blocks: 14, clock: { period: 20, high: 10, low: 10 } },

  { id: "rs-latch", category: "Memory", title: "RS latch", summary: "Remember which of two requests happened last.", path: "rs-latch", width: 8, depth: 3, layers: 1 },
  { id: "data-latch", category: "Memory", title: "Locked repeater latch", summary: "Hold a sampled logic level with a lock input.", path: "data-latch", width: 5, depth: 3, layers: 1 },
  { id: "copper-bulb", category: "Memory", title: "Copper bulb toggle", summary: "Turn repeated events into alternating remembered states.", path: "copper-bulb", width: 6, depth: 1, layers: 1 },
  { id: "register-4bit", category: "Memory", title: "Four-bit holding register", summary: "Store a four-bit word with a shared control.", path: "register-4bit", width: 7, depth: 17, layers: 1 },
  { id: "d-flip-flop", category: "Memory", title: "Edge-triggered D flip-flop", summary: "Sample data on a selected clock event.", path: "d-flip-flop", width: 11, depth: 6, layers: 1 },
  { id: "ripple-counter", category: "Memory", title: "Two-bit ripple counter", summary: "Use state to count accepted events.", path: "pulse-counter", width: 11, depth: 1, layers: 1 },
  { id: "piston-toggle", category: "Memory", title: "Piston T flip-flop", summary: "Use a mechanical arrangement to store one changing bit.", path: "piston-toggle", width: 5, depth: 1, layers: 1 },
  { id: "analog-memory", category: "Memory", title: "Analog peak memory", summary: "Remember the largest signal level seen since clearing.", path: "analog-memory", width: 9, depth: 5, layers: 1 },

  { id: "container-reader", category: "Detection", title: "Container fullness", summary: "Turn inventory contents into a small numeric signal.", path: "container-reader", width: 5, depth: 1, layers: 1 },
  { id: "comparator-threshold", category: "Detection", title: "Comparator threshold", summary: "Pass a signal only when it meets a reference.", path: "comparator-threshold", width: 10, depth: 4, layers: 1 },
  { id: "comparator-subtract", category: "Detection", title: "Comparator subtract", summary: "Compute a nonnegative difference between signal strengths.", path: "comparator-subtract", width: 10, depth: 4, layers: 1 },
  { id: "pressure-plate", category: "Detection", title: "Pressure plate", summary: "Connect a player action to a control signal.", path: "pressure-plate", width: 4, depth: 1, layers: 1 },
  { id: "container-empty", category: "Detection", title: "Container empty alarm", summary: "Turn an empty inventory into an explicit condition.", path: "container-empty", width: 7, depth: 1, layers: 1 },
  { id: "container-full", category: "Detection", title: "Container full alarm", summary: "Detect a high inventory boundary.", path: "container-full", width: 6, depth: 2, layers: 1 },

  { id: "hopper-line", category: "Transport", title: "Hopper line", summary: "Follow items through a directed transport path.", path: "hopper-line", width: 4, depth: 1, layers: 2 },
  { id: "hopper-lock", category: "Transport", title: "Hopper lock", summary: "Use a control signal to stop an item path.", path: "hopper-lock", width: 2, depth: 1, layers: 2 },
  { id: "dropper-transfer", category: "Transport", title: "Pulse-driven dropper transfer", summary: "Move one inventory item per accepted activation.", path: "dropper-transfer", width: 4, depth: 1, layers: 1 },
  { id: "auto-dropper", category: "Transport", title: "Automatic dropper feeder", summary: "Repeat a transfer while inventory still needs service.", path: "auto-dropper", width: 8, depth: 5, layers: 2 },
  { id: "dropper-elevator", category: "Transport", title: "Three-stage dropper lift", summary: "Coordinate inventory transfers across height.", path: "dropper-elevator", width: 9, depth: 5, layers: 4 },

  { id: "item-sorter", category: "Storage", title: "Item sorter", summary: "Combine a content filter, a threshold, and controlled transfer.", path: "item-sorter", width: 5, depth: 4, layers: 5 },
  { id: "overflow-storage", category: "Storage", title: "Fullness-controlled overflow storage", summary: "Give excess items a defined destination.", path: "overflow-storage", width: 8, depth: 4, layers: 4 },

  { id: "piston-push", category: "Pistons", title: "Sticky piston pusher", summary: "Observe the control, motion, and final block position separately.", path: "piston-push", width: 4, depth: 1, layers: 1 },
  { id: "piston-door", category: "Pistons", title: "Piston door · quasi-connectivity", summary: "Use one control to coordinate a vertical mechanism.", path: "piston-door", width: 3, depth: 1, layers: 2 },
  { id: "slime-pusher", category: "Pistons", title: "Slime group lifter", summary: "Move an attached group instead of a single block.", path: "slime-pusher", width: 5, depth: 2, layers: 2 },
  { id: "honey-separation", category: "Pistons", title: "Slime and honey isolation", summary: "Place adjacent moving groups without gluing them together.", path: "honey-separation", width: 3, depth: 4, layers: 2 },
  { id: "piston-door-2x2", category: "Pistons", title: "Two-by-two piston doorway", summary: "Coordinate several moving blocks to form one opening.", path: "piston-door-2x2", width: 8, depth: 4, layers: 2 },
];
