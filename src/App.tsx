import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { InputHTMLAttributes } from "react";
import { findRegionFiles, readRegion } from "./worldFolder";
import type { ImportedRegion, RegionChoice } from "./worldFolder";
import { getLightLevels } from "./torchPlanner";
import type { TorchPlan } from "./torchPlanner";
import SlimeChunkFinder from "./SlimeChunkFinder";
import FarmRangeDemo from "./FarmRangeDemo";
import RedstoneLearning from "./RedstoneLearning";

type Rule = "legacy" | "modern";
type Tool = "floor" | "wall" | "empty";
type PaintDrag = { pointerId: number; startX: number; startY: number; endX: number; endY: number; value: 0 | 1 | 2 };
const INITIAL_WIDTH = 22;
const INITIAL_HEIGHT = 16;

function utilityFromPath(): "torches" | "slimes" | "farm" | "redstone" {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path.endsWith("/slime-finder")) return "slimes";
  if (path.endsWith("/farm-overlap")) return "farm";
  if (path.endsWith("/redstone-lab")) return "redstone";
  return "torches";
}

function resizeGrid(old: Uint8Array, oldWidth: number, oldHeight: number, width: number, height: number) {
  const next = new Uint8Array(width * height).fill(2);
  for (let y = 0; y < Math.min(oldHeight, height); y += 1) {
    for (let x = 0; x < Math.min(oldWidth, width); x += 1) {
      next[y * width + x] = old[y * oldWidth + x];
    }
  }
  return next;
}

function RegionPreview({ region, cropX, cropZ, cropWidth, cropHeight }: {
  region: ImportedRegion;
  cropX: number;
  cropZ: number;
  cropWidth: number;
  cropHeight: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.createImageData(512, 512);
    for (let i = 0; i < region.surface.length; i += 1) {
      const offset = i * 4;
      const filled = region.surface[i] === 1;
      image.data[offset] = filled ? 99 : 32;
      image.data[offset + 1] = filled ? 119 : 39;
      image.data[offset + 2] = filled ? 77 : 43;
      image.data[offset + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.strokeStyle = "#f7c66d";
    context.lineWidth = 2;
    context.strokeRect(cropX + 1, cropZ + 1, cropWidth - 2, cropHeight - 2);
  }, [region, cropX, cropZ, cropWidth, cropHeight]);
  return <canvas className="region-preview" ref={ref} width={512} height={512} aria-label="Selected region preview" />;
}

export default function App() {
  const [width, setWidth] = useState(INITIAL_WIDTH);
  const [height, setHeight] = useState(INITIAL_HEIGHT);
  const utility = utilityFromPath();
  const [terrain, setTerrain] = useState(() => new Uint8Array(INITIAL_WIDTH * INITIAL_HEIGHT).fill(2));
  const [rule, setRule] = useState<Rule>("modern");
  const [tool, setTool] = useState<Tool>("floor");
  const [plan, setPlan] = useState<TorchPlan | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [regions, setRegions] = useState<RegionChoice[]>([]);
  const [selectedRegion, setSelectedRegion] = useState(0);
  const [imported, setImported] = useState<ImportedRegion | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [readingRegion, setReadingRegion] = useState(false);
  const [cropX, setCropX] = useState(240);
  const [cropZ, setCropZ] = useState(240);
  const [cropWidth, setCropWidth] = useState(22);
  const [cropHeight, setCropHeight] = useState(16);
  const [worldOrigin, setWorldOrigin] = useState<{ x: number; z: number } | null>(null);
  const [planError, setPlanError] = useState("");
  const [dragPreview, setDragPreview] = useState<PaintDrag | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const dragRef = useRef<PaintDrag | null>(null);
  const cellsOn = useMemo(() => terrain.reduce((count, value) => count + (value === 1 ? 1 : 0), 0), [terrain]);
  const wallsOn = useMemo(() => terrain.reduce((count, value) => count + (value === 2 ? 1 : 0), 0), [terrain]);
  const radius = rule === "legacy" ? 6 : 13;
  const lightLevels = useMemo(
    () => plan ? getLightLevels(width, height, terrain, plan.positions) : null,
    [plan, width, height, terrain],
  );
  const torchCoordinates = plan?.positions.map((position) => {
    const x = position % width;
    const z = Math.floor(position / width);
    return worldOrigin ? `${worldOrigin.x + x}, ${worldOrigin.z + z}` : `${x}, ${z}`;
  }) ?? [];

  const cancelPlan = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setCalculating(false);
  };

  useEffect(() => () => workerRef.current?.terminate(), []);

  useEffect(() => {
    if (utility !== "slimes") return;
    workerRef.current?.terminate();
    workerRef.current = null;
    setCalculating(false);
  }, [utility]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const cellSize = 28;
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    context.fillStyle = "#242a24";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < terrain.length; index += 1) {
      const x = index % width;
      const y = Math.floor(index / width);
      if (terrain[index] === 1) {
        context.fillStyle = "#687c5d";
        context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
      } else if (terrain[index] === 2) {
        context.fillStyle = "#505a57";
        context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        context.strokeStyle = "#849087";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x * cellSize + 5, y * cellSize + 10);
        context.lineTo((x + 1) * cellSize - 5, y * cellSize + 10);
        context.moveTo(x * cellSize + 5, y * cellSize + 19);
        context.lineTo((x + 1) * cellSize - 5, y * cellSize + 19);
        context.stroke();
      }
    }
    if (lightLevels) {
      for (let index = 0; index < lightLevels.length; index += 1) {
        if (terrain[index] === 2) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        const level = lightLevels[index];
        if (level > 0) {
          context.fillStyle = `rgba(244, 170, 79, ${0.08 + (level / 14) * 0.22})`;
          context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
        context.font = "bold 11px monospace";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.lineWidth = 3;
        context.strokeStyle = "rgba(18, 22, 18, .9)";
        context.strokeText(String(level), (x + 0.5) * cellSize, (y + 1) * cellSize - 2);
        context.fillStyle = level === 0 ? "#aab0a3" : "#fff0cf";
        context.fillText(String(level), (x + 0.5) * cellSize, (y + 1) * cellSize - 2);
      }
    }
    if (plan) {
      for (const position of plan.positions) {
        const x = position % width;
        const y = Math.floor(position / width);
        context.fillStyle = "rgba(244, 170, 79, .20)";
        context.beginPath();
        context.arc((x + 0.5) * cellSize, (y + 0.5) * cellSize, cellSize * 0.4, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "#ffd28a";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo((x + 0.5) * cellSize, (y + 0.21) * cellSize);
        context.lineTo((x + 0.5) * cellSize, (y + 0.56) * cellSize);
        context.stroke();
        context.fillStyle = "#ffca70";
        context.beginPath();
        context.arc((x + 0.5) * cellSize, (y + 0.25) * cellSize, cellSize * 0.16, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.strokeStyle = "rgba(12, 16, 12, .7)";
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 1) {
      context.beginPath();
      context.moveTo(x * cellSize + 0.5, 0);
      context.lineTo(x * cellSize + 0.5, canvas.height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 1) {
      context.beginPath();
      context.moveTo(0, y * cellSize + 0.5);
      context.lineTo(canvas.width, y * cellSize + 0.5);
      context.stroke();
    }
    if (dragPreview) {
      const left = Math.min(dragPreview.startX, dragPreview.endX);
      const right = Math.max(dragPreview.startX, dragPreview.endX);
      const top = Math.min(dragPreview.startY, dragPreview.endY);
      const bottom = Math.max(dragPreview.startY, dragPreview.endY);
      context.fillStyle = dragPreview.value === 1 ? "rgba(153, 190, 125, .30)" : dragPreview.value === 2 ? "rgba(183, 195, 184, .32)" : "rgba(105, 160, 185, .30)";
      context.fillRect(left * cellSize + 1, top * cellSize + 1, (right - left + 1) * cellSize - 2, (bottom - top + 1) * cellSize - 2);
      context.strokeStyle = dragPreview.value === 1 ? "#b5d796" : dragPreview.value === 2 ? "#d0d8cf" : "#8ec3d8";
      context.lineWidth = 2;
      context.strokeRect(left * cellSize + 1, top * cellSize + 1, (right - left + 1) * cellSize - 2, (bottom - top + 1) * cellSize - 2);
    }
  }, [terrain, width, height, plan, lightLevels, dragPreview]);

  const cellAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * width)));
    const y = Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * height)));
    return { x, y };
  };

  const applyDragRectangle = (drag: PaintDrag) => {
    const left = Math.min(drag.startX, drag.endX);
    const right = Math.max(drag.startX, drag.endX);
    const top = Math.min(drag.startY, drag.endY);
    const bottom = Math.max(drag.startY, drag.endY);
    setTerrain((current) => {
      let next: Uint8Array | null = null;
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const index = y * width + x;
          if (current[index] === drag.value) continue;
          if (!next) next = current.slice();
          next[index] = drag.value;
        }
      }
      return next ?? current;
    });
  };

  const startDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 && event.button !== 2) return;
    const { x, y } = cellAt(event);
    const value: 0 | 1 | 2 = event.button === 2 ? 2 : tool === "wall" ? 2 : tool === "empty" ? 0 : 1;
    const drag = { pointerId: event.pointerId, startX: x, startY: y, endX: x, endY: y, value };
    dragRef.current = drag;
    setDragPreview(drag);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const { x, y } = cellAt(event);
    if (drag.endX === x && drag.endY === y) return;
    const updated = { ...drag, endX: x, endY: y };
    dragRef.current = updated;
    setDragPreview(updated);
  };

  const endDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragPreview(null);
    applyDragRectangle(drag);
    cancelPlan();
    setPlan(null);
    setPlanError("");
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragPreview(null);
  };

  const changeDimension = (which: "width" | "height", value: number) => {
    const nextWidth = which === "width" ? value : width;
    const nextHeight = which === "height" ? value : height;
    setTerrain((current) => resizeGrid(current, width, height, nextWidth, nextHeight));
    setWidth(nextWidth);
    setHeight(nextHeight);
    cancelPlan();
    setPlan(null);
    setPlanError("");
  };

  const calculate = () => {
    if (cellsOn === 0 || calculating) return;
    setCalculating(true);
    setPlan(null);
    setPlanError("");
    const worker = new Worker(new URL("./planner.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<TorchPlan>) => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      setPlan(event.data);
      setCalculating(false);
      worker.terminate();
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      setCalculating(false);
      setPlanError("The torch planner stopped unexpectedly. Try a smaller map.");
      worker.terminate();
    };
    worker.postMessage({ width, height, terrain, radius });
  };

  const handleFolder = (fileList: FileList | null) => {
    if (!fileList) return;
    const choices = findRegionFiles(Array.from(fileList));
    setRegions(choices);
    setSelectedRegion(0);
    setImported(null);
    setImportMessage(choices.length ? `${choices.length} region file${choices.length === 1 ? "" : "s"} found.` : "No Java region files found. Select a world save folder containing a region folder.");
  };

  const loadSelectedRegion = async () => {
    const choice = regions[selectedRegion];
    if (!choice) return;
    setReadingRegion(true);
    setImported(null);
    setImportMessage("Reading chunk heightmaps locally…");
    try {
      const result = await readRegion(choice.file);
      setImported(result);
      setImportMessage(`${result.chunksRead} chunks read${result.chunksSkipped ? `; ${result.chunksSkipped} skipped` : ""}.`);
      setCropX(240);
      setCropZ(240);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Unable to read this region file.");
    } finally {
      setReadingRegion(false);
    }
  };

  const applyCrop = () => {
    if (!imported) return;
    const nextWidth = Math.max(1, Math.min(64, cropWidth, 512 - cropX));
    const nextHeight = Math.max(1, Math.min(64, cropHeight, 512 - cropZ));
    const next = new Uint8Array(nextWidth * nextHeight);
    for (let y = 0; y < nextHeight; y += 1) {
      for (let x = 0; x < nextWidth; x += 1) {
        next[y * nextWidth + x] = imported.surface[(cropZ + y) * 512 + cropX + x];
      }
    }
    setWidth(nextWidth);
    setHeight(nextHeight);
    setTerrain(next);
    const region = regions[selectedRegion];
    if (region) setWorldOrigin({ x: region.x * 512 + cropX, z: region.z * 512 + cropZ });
    cancelPlan();
    setPlan(null);
    setPlanError("");
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href={`${import.meta.env.BASE_URL}torch-planner/`} aria-label="Minecraft utilities home">
          <span className="brand-mark">✦</span><span>MINECRAFT<span className="brand-muted">TOOLS</span></span>
        </a>
        <nav className="utility-nav" aria-label="Minecraft utilities">
          <a className={utility === "torches" ? "active" : ""} href={`${import.meta.env.BASE_URL}torch-planner/`} aria-current={utility === "torches" ? "page" : undefined}>Torch planner</a>
          <a className={utility === "slimes" ? "active" : ""} href={`${import.meta.env.BASE_URL}slime-finder/`} aria-current={utility === "slimes" ? "page" : undefined}>Slime finder</a>
          <a className={utility === "farm" ? "active" : ""} href={`${import.meta.env.BASE_URL}farm-overlap/`} aria-current={utility === "farm" ? "page" : undefined}>Farm demo</a>
          <a className={utility === "redstone" ? "active" : ""} href={`${import.meta.env.BASE_URL}redstone-lab/`} aria-current={utility === "redstone" ? "page" : undefined}>Redstone lab</a>
        </nav>
      </header>

      <section className="hero" id="top">
        {utility === "torches" ? <>
          <div className="eyebrow"><span className="eyebrow-dot" /> MINECRAFT LIGHTING PLANNER</div>
          <h1>Light the whole area.<br /><em>Carry fewer torches.</em></h1>
          <p>Draw a build area or load a Java world region. Get a compact torch layout for the mob-spawn rule you play with.</p>
        </> : utility === "slimes" ? <>
          <div className="eyebrow"><span className="eyebrow-dot" /> JAVA SLIME CHUNK FINDER</div>
          <h1>Find the best area<br /><em>for a slime farm.</em></h1>
          <p>Search a seed for a 16 × 16 chunk area with as many slime chunks as possible.</p>
        </> : utility === "farm" ? <>
          <div className="eyebrow"><span className="eyebrow-dot" /> INTERACTIVE CONCEPT DEMO</div>
          <h1>See which farms<br /><em>are in AFK range.</em></h1>
          <p>Move players and farm platforms around a sample server map. The list updates as their distance bands overlap.</p>
        </> : <>
          <div className="eyebrow"><span className="eyebrow-dot" /> LEARN REDSTONE COMPUTING</div>
          <h1>Build a computer<br /><em>one bit at a time.</em></h1>
          <p>Explore logic gates, store bytes in RAM, and connect the parts into a tiny 8-bit CPU.</p>
        </>}
      </section>

      <div className={`workspace ${utility !== "torches" ? "utility-hidden" : ""}`}>
        <aside className="sidebar">
          <section className="panel">
            <div className="section-heading"><span className="step">01</span><h2>Choose light rule</h2></div>
            <div className="rule-options" role="radiogroup" aria-label="Minecraft spawn light rule">
              <button className={`rule-card ${rule === "legacy" ? "selected" : ""}`} onClick={() => { cancelPlan(); setRule("legacy"); setPlan(null); setPlanError(""); }} role="radio" aria-checked={rule === "legacy"}>
                <span className="rule-name">Old rule</span><span className="rule-level">Light 8+</span><span className="rule-detail">Hostile mobs can spawn at light 7 or less.</span>
              </button>
              <button className={`rule-card ${rule === "modern" ? "selected" : ""}`} onClick={() => { cancelPlan(); setRule("modern"); setPlan(null); setPlanError(""); }} role="radio" aria-checked={rule === "modern"}>
                <span className="rule-name">New rule</span><span className="rule-level">Light 1+</span><span className="rule-detail">Most hostile mobs need block light 0 to spawn.</span>
              </button>
            </div>
            <div className="assumption"><span className="info-mark">i</span><span>Assumes level-14 torches and full-height wall cells that block light in this flat grid.</span></div>
          </section>

          <section className="panel import-panel">
            <div className="section-heading"><span className="step">02</span><h2>Load a world area</h2><span className="optional">OPTIONAL</span></div>
            <label className="folder-picker">
              <input type="file" multiple onChange={(event) => handleFolder(event.currentTarget.files)} {...({ webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>)} />
              <span className="folder-icon">↥</span>
              <span><strong>Choose Minecraft world folder</strong><small>Java Edition save · stays on this device</small></span>
              <span className="pick-arrow">→</span>
            </label>
            {importMessage && <div className="import-message" role="status">{importMessage}</div>}
            {regions.length > 0 && <div className="region-controls">
              <label className="field-label">Region file
                <select value={selectedRegion} onChange={(event) => setSelectedRegion(Number(event.target.value))}>
                  {regions.map((region, index) => <option value={index} key={region.path}>{region.path.replace(/^.*?region\//, "")}</option>)}
                </select>
              </label>
              <button className="small-button" onClick={loadSelectedRegion} disabled={readingRegion}>{readingRegion ? "Reading…" : "Read region"}</button>
            </div>}
            {imported && <div className="crop-area">
              <RegionPreview region={imported} cropX={cropX} cropZ={cropZ} cropWidth={cropWidth} cropHeight={cropHeight} />
              <div className="crop-fields">
                <label className="field-label">X <input type="number" step="1" min="0" max={512 - cropWidth} value={cropX} onChange={(event) => setCropX(Math.floor(Math.max(0, Math.min(512 - cropWidth, Number(event.target.value) || 0))))} /></label>
                <label className="field-label">Z <input type="number" step="1" min="0" max={512 - cropHeight} value={cropZ} onChange={(event) => setCropZ(Math.floor(Math.max(0, Math.min(512 - cropHeight, Number(event.target.value) || 0))))} /></label>
                <label className="field-label">Width <input type="number" step="1" min="1" max={Math.min(64, 512 - cropX)} value={cropWidth} onChange={(event) => setCropWidth(Math.floor(Math.max(1, Math.min(64, 512 - cropX, Number(event.target.value) || 1))))} /></label>
                <label className="field-label">Height <input type="number" step="1" min="1" max={Math.min(64, 512 - cropZ)} value={cropHeight} onChange={(event) => setCropHeight(Math.floor(Math.max(1, Math.min(64, 512 - cropZ, Number(event.target.value) || 1))))} /></label>
              </div>
              <button className="small-button apply-crop" onClick={applyCrop}>Use this area →</button>
            </div>}
            <p className="import-help">Select a region and crop up to 64 × 64 blocks. Imported top surfaces don’t infer walls; mark them with the Wall brush.</p>
          </section>
        </aside>

        <section className="map-panel">
          <div className="map-header">
            <div><div className="section-heading"><span className="step">03</span><h2>Shape your ground</h2></div><p>Paint the blocks where mobs could spawn.</p></div>
            <div className="dimensions">
              <label>W <input type="number" step="1" min="1" max="64" value={width} onChange={(event) => changeDimension("width", Math.floor(Math.max(1, Math.min(64, Number(event.target.value) || 1))))} /></label>
              <span>×</span>
              <label>H <input type="number" step="1" min="1" max="64" value={height} onChange={(event) => changeDimension("height", Math.floor(Math.max(1, Math.min(64, Number(event.target.value) || 1))))} /></label>
            </div>
          </div>
          <div className="canvas-toolbar">
            <div className="tool-switch" role="group" aria-label="Map drawing tool">
              <button className={tool === "floor" ? "active" : ""} onClick={() => setTool("floor")}>＋ Floor</button>
              <button className={tool === "wall" ? "active" : ""} onClick={() => setTool("wall")}>▤ Wall</button>
              <button className={tool === "empty" ? "active" : ""} onClick={() => setTool("empty")}>◌ Empty</button>
            </div>
            <span className="map-count">{cellsOn.toLocaleString()} floor · {wallsOn.toLocaleString()} walls</span>
          </div>
          <p className="map-instructions">Drag to fill a rectangle with the selected tile · right drag to fill walls · Empty cells are ignored as spawn targets and let light pass through</p>
          {plan && <p className="map-instructions">Passable cell numbers show block light from 0 (dark) to 14 (at a torch); walls block light.</p>}
          <div className="map-scroll">
            <canvas ref={canvasRef} className="map-canvas" style={plan ? { minWidth: `${width * 22}px` } : undefined} onPointerDown={startDrag} onPointerMove={continueDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onContextMenu={(event) => event.preventDefault()} aria-label="Paintable top-down map grid with light levels after planning" role="application" />
          </div>
          <div className="map-footer">
            <div className="legend"><span className="legend-swatch floor-swatch" /> Walkable floor <span className="legend-swatch wall-swatch" /> Wall blocks light <span className="legend-swatch torch-swatch">✦</span> Suggested torch</div>
            <button className="clear-button" onClick={() => { cancelPlan(); setTerrain(new Uint8Array(width * height).fill(2)); setPlan(null); setPlanError(""); }}>Reset to walls</button>
          </div>

          <div className="plan-bar">
            <div className="plan-copy"><span className="plan-icon">✦</span><span><strong>{plan ? (plan.optimal ? "Minimum layout found" : "Best layout found so far") : "Ready to plan"}</strong><small>{plan ? `${plan.positions.length} torches · ${plan.optimal ? "minimum proven" : "minimum not proven before time limit"}` : `Cover ${cellsOn.toLocaleString()} floor blocks under the ${rule === "legacy" ? "old" : "new"} light rule`}</small></span></div>
            <button className="plan-button" onClick={calculate} disabled={cellsOn === 0 || calculating}>{calculating ? <><span className="spinner" /> Planning…</> : <>Find minimum torches <span>→</span></>}</button>
          </div>
          {planError && <p className="plan-error" role="alert">{planError}</p>}
          {plan && <div className="coordinates">
            <strong>{worldOrigin ? "World block coordinates (X, Z)" : "Map coordinates (X, Z)"}</strong>
            <p>{torchCoordinates.map((coordinate, index) => <span key={`${coordinate}-${index}`}>{coordinate}</span>)}</p>
          </div>}
        </section>
      </div>

      {utility === "slimes" && <SlimeChunkFinder />}
      {utility === "farm" && <FarmRangeDemo />}
      {utility === "redstone" && <RedstoneLearning />}
      <footer className="footnote">
        <span>{utility === "torches" ? "Walls are treated as full-height opaque cells in a flat 2D layer. Other spawn conditions such as biome, floor block, sky light, and nearby players are outside this model." : utility === "slimes" ? "Slime chunk results use the Java Edition seed algorithm. The 16 × 16 display is a 256 × 256 block square, with coordinates aligned to chunk borders." : utility === "farm" ? "The farm range demo uses same-height horizontal distances and does not model mob caps or farm rates." : "Lessons and circuit layouts on this page are for Java Edition redstone. Bedrock timing and circuit behavior may differ."}</span>
        <nav className="footnote-links" aria-label="Minecraft references and tools">
          {utility === "torches" && <a href="https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18" target="_blank" rel="noreferrer">1.18 light rule ↗</a>}
          <a href="https://www.minecraftmaps.com/tools" target="_blank" rel="noreferrer">Minecraft Maps Tools ↗</a>
          <a href="https://www.chunkbase.com/apps" target="_blank" rel="noreferrer">Chunkbase Apps ↗</a>
        </nav>
      </footer>
    </main>
  );
}
