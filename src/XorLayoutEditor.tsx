import { useEffect, useState } from "react";
import type { LogicLayoutPart } from "./redstoneLogicLayouts";

type Tool = "stone" | "torch" | "dust" | "comparator" | "piston" | "dropper" | "hopper" | "observer" | "erase";

type Props = {
  layout: LogicLayoutPart[];
  onChange: (layout: LogicLayoutPart[]) => void;
  onReset: () => void;
};

const X_CELLS = Array.from({ length: 13 }, (_, index) => index - 2);
const Z_CELLS = Array.from({ length: 7 }, (_, index) => index - 2);
const MAX_LAYER = 4;
const FACINGS = ["north", "east", "south", "west"] as const;
const MACHINE_FACINGS = ["north", "east", "south", "west", "up", "down"] as const;
const FACING_ARROWS: Record<(typeof FACINGS)[number], string> = { north: "↑", east: "→", south: "↓", west: "←" };
const SOLID_KINDS = new Set(["stone", "piston", "dropper", "hopper", "observer"]);

const TOOLS: Array<{ id: Tool; label: string; symbol: string }> = [
  { id: "stone", label: "Block", symbol: "■" },
  { id: "torch", label: "Torch", symbol: "♨" },
  { id: "dust", label: "Redstone", symbol: "━" },
  { id: "comparator", label: "Comparator", symbol: "◈" },
  { id: "piston", label: "Piston", symbol: "▰" },
  { id: "dropper", label: "Dropper", symbol: "▣" },
  { id: "hopper", label: "Hopper", symbol: "▽" },
  { id: "observer", label: "Observer", symbol: "◉" },
  { id: "erase", label: "Erase", symbol: "×" },
];

export default function XorLayoutEditor({ layout, onChange, onReset }: Props) {
  const [tool, setTool] = useState<Tool>("stone");
  const [layer, setLayer] = useState(0);
  const [comparatorFacing, setComparatorFacing] = useState<(typeof FACINGS)[number]>("east");
  const [comparatorMode, setComparatorMode] = useState<"compare" | "subtract">("compare");
  const [pistonFacing, setPistonFacing] = useState<(typeof FACINGS)[number]>("east");
  const [pistonType, setPistonType] = useState<"normal" | "sticky">("normal");
  const [pistonExtended, setPistonExtended] = useState(false);
  const [dropperFacing, setDropperFacing] = useState<(typeof MACHINE_FACINGS)[number]>("up");
  const [hopperFacing, setHopperFacing] = useState<(typeof MACHINE_FACINGS)[number]>("down");
  const [observerFacing, setObserverFacing] = useState<(typeof MACHINE_FACINGS)[number]>("east");
  const [history, setHistory] = useState<LogicLayoutPart[][]>([]);
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    const stopPainting = () => setPainting(false);
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    return () => {
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
    };
  }, []);

  const commit = (nextLayout: LogicLayoutPart[]) => {
    setHistory((previous) => [...previous.slice(-39), layout]);
    onChange(nextLayout);
  };

  const placeAt = (x: number, z: number) => {
    const stoneAtLevel = layout.some((part) => part.kind === "stone" && part.layer === layer && part.x === x && part.z === z);
    const blockAtLevel = layout.some((part) => SOLID_KINDS.has(part.kind) && part.layer === layer && part.x === x && part.z === z);
    const blockAbove = layout.some((part) => SOLID_KINDS.has(part.kind) && part.layer === layer + 1 && part.x === x && part.z === z);
    const componentAtLevel = layout.find((part) =>
      (part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator")
      && part.layer === layer + 1 && part.x === x && part.z === z,
    );
    const fixedLamp = layout.some((part) => part.kind === "lamp" && part.layer === layer && part.x === x && part.z === z);
    const fixedLeverAtLevel = layout.some((part) => part.kind === "lever" && part.layer === layer && part.x === x && part.z === z);
    const fixedLeverAbove = layout.some((part) => part.kind === "lever" && part.layer === layer + 1 && part.x === x && part.z === z);

    if (tool === "erase") {
      const nextLayout = layout.filter((part) => !(
        part.x === x && part.z === z && (
          SOLID_KINDS.has(part.kind) && part.layer === layer && !fixedLeverAtLevel
          || (part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator") && part.layer === layer + 1
        )
      ));
      if (nextLayout.length !== layout.length) commit(nextLayout);
      return;
    }

    if (tool === "stone") {
      if (stoneAtLevel || fixedLamp) return;
      const withoutComponent = layout.filter((part) => !(
        part.x === x && part.z === z && part.layer === layer
        && (SOLID_KINDS.has(part.kind) || part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator")
      ));
      commit([...withoutComponent, { layer, kind: "stone", x, z }]);
      return;
    }

    if (tool === "piston" || tool === "dropper" || tool === "hopper" || tool === "observer") {
      const currentMachine = layout.find((part) => part.kind === tool && part.layer === layer && part.x === x && part.z === z);
      if (fixedLamp || fixedLeverAtLevel) return;
      const facing = tool === "piston" ? pistonFacing : tool === "dropper" ? dropperFacing : tool === "hopper" ? hopperFacing : observerFacing;
      if (tool === "piston" && currentMachine?.facing === facing && currentMachine.pistonType === pistonType
        && Boolean(currentMachine.extended) === pistonExtended) return;
      if (tool !== "piston" && currentMachine?.facing === facing) return;
      const withoutBlock = layout.filter((part) => !(
        part.x === x && part.z === z && part.layer === layer
        && (SOLID_KINDS.has(part.kind) || part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator")
      ));
      const machine: LogicLayoutPart = tool === "piston"
        ? { layer, kind: "piston", x, z, facing: pistonFacing, pistonType, extended: pistonExtended }
        : { layer, kind: tool, x, z, facing };
      commit([...withoutBlock, machine]);
      return;
    }

    if (tool === "comparator" && componentAtLevel?.kind === "comparator"
      && componentAtLevel.facing === comparatorFacing && componentAtLevel.comparatorMode === comparatorMode) return;
    if (tool !== "comparator" && componentAtLevel?.kind === tool) return;
    if (blockAbove || fixedLeverAbove) return;
    const withoutComponent = layout.filter((part) => !(
      part.x === x && part.z === z && part.layer === layer + 1
        && (part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator")
    ));
    const withSupport = blockAtLevel || fixedLamp
      ? withoutComponent
      : [...withoutComponent, { layer, kind: "stone" as const, x, z }];
    const component: LogicLayoutPart = tool === "comparator"
      ? { layer: layer + 1, kind: "comparator", x, z, facing: comparatorFacing, comparatorMode }
      : { layer: layer + 1, kind: tool as "torch" | "dust", x, z, signal: "OUTPUT" };
    commit([...withSupport, component]);
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((current) => current.slice(0, -1));
    onChange(previous);
  };

  const download = () => {
    const file = new Blob([JSON.stringify(layout, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "xor-layout.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const reset = () => {
    setHistory([]);
    setLayer(0);
    setTool("stone");
    setComparatorFacing("east");
    setComparatorMode("compare");
    setPistonFacing("east");
    setPistonType("normal");
    setPistonExtended(false);
    setDropperFacing("up");
    setHopperFacing("down");
    setObserverFacing("east");
    onReset();
  };

  return (
    <div className="redstone-layout-editor">
      <div className="redstone-layout-editor-heading">
        <div>
          <span className="redstone-kicker">PLACE BLOCKS AND WIRES</span>
          <h3>Layout editor</h3>
          <p>Changes appear in the 3D gate above and save in this browser. Drag across cells to place a row.</p>
        </div>
        <div className="redstone-layout-editor-actions">
          <button className="small-button" type="button" onClick={undo} disabled={history.length === 0}>Undo</button>
          <button className="small-button" type="button" onClick={download}>Download JSON</button>
          <button className="small-button" type="button" onClick={reset}>Reset reference</button>
        </div>
      </div>

      <div className="redstone-layout-editor-body">
        <div className="redstone-layout-tools">
          <span className="redstone-layout-label">TOOL</span>
          {TOOLS.map(({ id, label, symbol }) => (
            <button
              key={id}
              type="button"
              className={`redstone-layout-tool ${tool === id ? "selected" : ""} tool-${id}`}
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
            >
              <span aria-hidden="true">{symbol}</span>{label}
            </button>
          ))}

          <span className="redstone-layout-label layer-label">BLOCK LAYER</span>
          <div className="redstone-layout-layer-control">
            <button type="button" aria-label="Lower block layer" disabled={layer === 0} onClick={() => setLayer((value) => Math.max(0, value - 1))}>−</button>
            <strong>Y {layer}</strong>
            <button type="button" aria-label="Raise block layer" disabled={layer === MAX_LAYER} onClick={() => setLayer((value) => Math.min(MAX_LAYER, value + 1))}>+</button>
          </div>
          {(tool === "comparator" || tool === "piston" || tool === "dropper" || tool === "hopper" || tool === "observer") && <>
            <span className="redstone-layout-label layer-label">FACING</span>
            <div className="redstone-layout-facing-control" role="group" aria-label={`${tool[0].toUpperCase()}${tool.slice(1)} facing`}>
              {(tool === "dropper" || tool === "hopper" || tool === "observer" ? MACHINE_FACINGS : FACINGS).map((facing) => {
                const selected = tool === "piston" ? pistonFacing === facing
                  : tool === "comparator" ? comparatorFacing === facing
                    : tool === "dropper" ? dropperFacing === facing
                      : tool === "hopper" ? hopperFacing === facing : observerFacing === facing;
                return <button key={facing} type="button" className={selected ? "selected" : ""} aria-label={`Face ${facing}`} aria-pressed={selected} onClick={() => {
                  if (tool === "piston") setPistonFacing(facing as (typeof FACINGS)[number]);
                  else if (tool === "comparator") setComparatorFacing(facing as (typeof FACINGS)[number]);
                  else if (tool === "dropper") setDropperFacing(facing as (typeof MACHINE_FACINGS)[number]);
                  else if (tool === "hopper") setHopperFacing(facing as (typeof MACHINE_FACINGS)[number]);
                  else if (tool === "observer") setObserverFacing(facing as (typeof MACHINE_FACINGS)[number]);
                }}>{facing[0].toUpperCase()}</button>;
              })}
            </div>
          </>}
          {tool === "comparator" && <>
            <span className="redstone-layout-label layer-label">MODE</span>
            <div className="redstone-layout-mode-control" role="group" aria-label="Comparator mode">
              <button type="button" className={comparatorMode === "compare" ? "selected" : ""} aria-pressed={comparatorMode === "compare"} onClick={() => setComparatorMode("compare")}>Compare</button>
              <button type="button" className={comparatorMode === "subtract" ? "selected" : ""} aria-pressed={comparatorMode === "subtract"} onClick={() => setComparatorMode("subtract")}>Subtract</button>
            </div>
          </>}
          {tool === "piston" && <>
            <span className="redstone-layout-label layer-label">TYPE</span>
            <div className="redstone-layout-mode-control" role="group" aria-label="Piston type">
              <button type="button" className={pistonType === "normal" ? "selected" : ""} aria-pressed={pistonType === "normal"} onClick={() => setPistonType("normal")}>Normal</button>
              <button type="button" className={pistonType === "sticky" ? "selected" : ""} aria-pressed={pistonType === "sticky"} onClick={() => setPistonType("sticky")}>Sticky</button>
            </div>
            <span className="redstone-layout-label layer-label">PREVIEW</span>
            <div className="redstone-layout-mode-control" role="group" aria-label="Piston extension preview">
              <button type="button" className={!pistonExtended ? "selected" : ""} aria-pressed={!pistonExtended} onClick={() => setPistonExtended(false)}>Retracted</button>
              <button type="button" className={pistonExtended ? "selected" : ""} aria-pressed={pistonExtended} onClick={() => setPistonExtended(true)}>Extended</button>
            </div>
          </>}
          <p>{tool === "comparator" ? "Click a cell to place the comparator on this layer’s support block." : tool === "piston" || tool === "dropper" || tool === "hopper" || tool === "observer" ? `Click a cell to place the ${tool} at this layer.` : "Dust and torches sit on this layer’s blocks."}</p>
        </div>

        <div className="redstone-layout-grid-scroll">
          <div className="redstone-layout-grid" role="grid" aria-label={`XOR layout editor, block layer ${layer}`}>
            <span className="redstone-layout-axis corner" aria-hidden="true">Z / X</span>
            {X_CELLS.map((x) => <span className="redstone-layout-axis" key={`x-${x}`} aria-hidden="true">{x}</span>)}
            {Z_CELLS.map((z) => (
              <div className="redstone-layout-grid-row" role="row" key={`z-${z}`}>
                <span className="redstone-layout-axis" aria-hidden="true">{z}</span>
                {X_CELLS.map((x) => {
                  const solid = layout.find((part) => SOLID_KINDS.has(part.kind) && part.layer === layer && part.x === x && part.z === z);
                  const piston = solid?.kind === "piston" ? solid : undefined;
                  const machine = solid && solid.kind !== "stone" ? solid : undefined;
                  const stone = solid?.kind === "stone";
                  const block = Boolean(solid);
                  const component = layout.find((part) =>
                    (part.kind === "dust" || part.kind === "torch" || part.kind === "repeater" || part.kind === "comparator")
                    && part.layer === layer + 1 && part.x === x && part.z === z,
                  );
                  const blockAbove = layout.some((part) => SOLID_KINDS.has(part.kind) && part.layer === layer + 1 && part.x === x && part.z === z);
                  const fixed = layout.find((part) =>
                    (part.kind === "lamp" && part.layer === layer || part.kind === "lever" && (part.layer === layer || part.layer === layer + 1))
                    && part.x === x && part.z === z,
                  );
                  const label = [machine?.kind ?? (stone ? "block" : ""), component?.kind === "dust" ? "redstone" : component?.kind ?? "", blockAbove ? "block above" : "", fixed?.kind ?? ""]
                    .filter(Boolean).join(" and ") || "empty";
                  return (
                    <button
                      key={`${x}-${z}`}
                      type="button"
                      role="gridcell"
                      className={`redstone-layout-cell ${block ? "has-block" : ""} ${component ? `has-${component.kind}` : ""} ${blockAbove ? "has-block-above" : ""} ${fixed ? `has-fixed-${fixed.kind}` : ""}`}
                      aria-label={`X ${x}, Z ${z}: ${label}. Place ${tool}.`}
                      title={`X ${x}, Z ${z} · ${label}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        setPainting(true);
                        placeAt(x, z);
                      }}
                      onPointerEnter={() => { if (painting) placeAt(x, z); }}
                      onClick={(event) => { if (event.detail === 0) placeAt(x, z); }}
                    >
                      {stone && <i className="layout-cell-block" aria-hidden="true" />}
                      {piston && <i className={`layout-cell-piston ${piston.pistonType === "sticky" ? "sticky" : ""}`} aria-hidden="true">P{piston.extended && <b>{FACING_ARROWS[piston.facing as (typeof FACINGS)[number]] ?? "→"}</b>}</i>}
                      {machine && machine.kind !== "piston" && <i className={`layout-cell-machine machine-${machine.kind}`} aria-hidden="true">{machine.kind === "dropper" ? "D" : machine.kind === "hopper" ? "H" : "O"}</i>}
                      {component?.kind === "dust" && <i className="layout-cell-dust" aria-hidden="true" />}
                      {component?.kind === "torch" && <i className="layout-cell-torch" aria-hidden="true" />}
                      {component?.kind === "comparator" && <i className="layout-cell-comparator" aria-hidden="true">C</i>}
                      {blockAbove && <i className="layout-cell-overhead" aria-hidden="true">↑</i>}
                      {fixed && <i className={`layout-cell-fixed fixed-${fixed.kind}`} aria-hidden="true">{fixed.kind === "lamp" ? "L" : "↗"}</i>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
