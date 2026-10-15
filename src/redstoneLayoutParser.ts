export type LogicLayoutPart = {
  layer: number;
  kind: "lever" | "dust" | "stone" | "wall-torch" | "torch" | "repeater" | "comparator" | "piston" | "dropper" | "hopper" | "observer" | "lamp";
  x: number;
  z: number;
  facing?: "north" | "east" | "south" | "west" | "up" | "down";
  comparatorMode?: "compare" | "subtract";
  pistonType?: "normal" | "sticky";
  extended?: boolean;
  movable?: boolean;
  mount?: "wall";
  powered?: boolean;
  input?: "A" | "B" | "C" | "SEL";
  label?: string;
  signal?: "A" | "B" | "A_ONLY" | "B_ONLY" | "SAME" | "OUTPUT";
};

const PART_FIELDS = new Set([
  "layer", "kind", "x", "z", "facing", "comparatorMode", "pistonType", "extended", "movable", "mount", "powered", "input", "label", "signal",
]);
const KINDS = ["lever", "dust", "stone", "wall-torch", "torch", "repeater", "comparator", "piston", "dropper", "hopper", "observer", "lamp"] as const;
const FACINGS = ["north", "east", "south", "west", "up", "down"] as const;
const INPUTS = ["A", "B", "C", "SEL"] as const;
const SIGNALS = ["A", "B", "A_ONLY", "B_ONLY", "SAME", "OUTPUT"] as const;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePart(value: unknown, path: string): LogicLayoutPart {
  if (!isObject(value)) throw new Error(`${path} must be an object`);
  for (const key of Object.keys(value)) {
    if (!PART_FIELDS.has(key)) throw new Error(`${path}.${key} is not a supported field`);
  }

  if (!Number.isInteger(value.layer) || (value.layer as number) < 0) throw new Error(`${path}.layer must be a non-negative integer`);
  if (!Number.isInteger(value.x)) throw new Error(`${path}.x must be an integer`);
  if (!Number.isInteger(value.z)) throw new Error(`${path}.z must be an integer`);
  if (!KINDS.includes(value.kind as (typeof KINDS)[number])) throw new Error(`${path}.kind is not a supported block`);

  const enumFields = [
    ["facing", FACINGS],
    ["comparatorMode", ["compare", "subtract"]],
    ["pistonType", ["normal", "sticky"]],
    ["mount", ["wall"]],
    ["input", INPUTS],
    ["signal", SIGNALS],
  ] as const;
  for (const [field, options] of enumFields) {
    if (value[field] !== undefined && !(options as readonly unknown[]).includes(value[field])) {
      throw new Error(`${path}.${field} has an unsupported value`);
    }
  }

  for (const field of ["extended", "movable", "powered"] as const) {
    if (value[field] !== undefined && typeof value[field] !== "boolean") {
      throw new Error(`${path}.${field} must be true or false`);
    }
  }
  if (value.label !== undefined && typeof value.label !== "string") throw new Error(`${path}.label must be text`);

  return value as unknown as LogicLayoutPart;
}

function parseLayout(value: unknown, name: string): LogicLayoutPart[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`Circuit layout "${name}" must be a non-empty array`);
  return value.map((part, index) => parsePart(part, `Circuit layout "${name}"[${index}]`));
}

export function parseLogicLayoutJson(source: string, name: string): LogicLayoutPart[] {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Layout "${name}" JSON could not be parsed: ${detail}`);
  }
  return parseLayout(value, name);
}
