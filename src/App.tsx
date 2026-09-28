import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { InputHTMLAttributes } from "react";
import { findRegionFiles, readRegion } from "./worldFolder";
import type { ImportedRegion, RegionChoice } from "./worldFolder";
import type { TorchPlan } from "./torchPlanner";

type Rule = "legacy" | "modern";
type Tool = "paint" | "erase";
const INITIAL_WIDTH = 22;
const INITIAL_HEIGHT = 16;

function resizeGrid(old: Uint8Array, oldWidth: number, oldHeight: number, width: number, height: number) {
  const next = new Uint8Array(width * height);
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
  const [floor, setFloor] = useState(() => new Uint8Array(INITIAL_WIDTH * INITIAL_HEIGHT));
  const [rule, setRule] = useState<Rule>("modern");
  const [tool, setTool] = useState<Tool>("paint");
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const cellsOn = useMemo(() => floor.reduce((count, value) => count + (value ? 1 : 0), 0), [floor]);
  const radius = rule === "legacy" ? 6 : 13;
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
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const cellSize = 28;
    canvas.width = width * cellSize;
    canvas.height = height * cellSize;
    context.fillStyle = "#242a24";
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < floor.length; index += 1) {
      const x = index % width;
      const y = Math.floor(index / width);
      if (floor[index]) {
        context.fillStyle = "#687c5d";
        context.fillRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
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
        context.lineTo((x + 0.5) * cellSize, (y + 0.78) * cellSize);
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
  }, [floor, width, height, plan]);

  const paintAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.type === "pointermove" && event.buttons === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * width);
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * height);
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = y * width + x;
    const value = tool === "paint" ? 1 : 0;
    setFloor((current) => {
      if (current[index] === value) return current;
      const next = current.slice();
      next[index] = value;
      return next;
    });
    cancelPlan();
    setPlan(null);
    setPlanError("");
  };

  const changeDimension = (which: "width" | "height", value: number) => {
    const nextWidth = which === "width" ? value : width;
    const nextHeight = which === "height" ? value : height;
    setFloor((current) => resizeGrid(current, width, height, nextWidth, nextHeight));
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
    worker.postMessage({ width, height, floor, radius });
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
    setFloor(next);
    const region = regions[selectedRegion];
    if (region) setWorldOrigin({ x: region.x * 512 + cropX, z: region.z * 512 + cropZ });
    cancelPlan();
    setPlan(null);
    setPlanError("");
  };

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Torch Planner home">
          <span className="brand-mark">✦</span><span>TORCH<span className="brand-muted">PLAN</span></span>
        </a>
        <span className="topbar-note">A small tool for safer builds</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="eyebrow-dot" /> MINECRAFT LIGHTING PLANNER</div>
        <h1>Light the whole area.<br /><em>Carry fewer torches.</em></h1>
        <p>Draw a build area or load a Java world region. Get a compact torch layout for the mob-spawn rule you play with.</p>
      </section>

      <div className="workspace">
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
            <div className="assumption"><span className="info-mark">i</span><span>Assumes a torch gives level 14 and light spreads across a flat, unobstructed grid.</span></div>
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
            <p className="import-help">Select a region and crop up to 64 × 64 blocks. The map uses its top surface and ignores height.</p>
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
              <button className={tool === "paint" ? "active" : ""} onClick={() => setTool("paint")}>＋ Paint floor</button>
              <button className={tool === "erase" ? "active" : ""} onClick={() => setTool("erase")}>⌫ Erase</button>
            </div>
            <span className="map-count">{cellsOn.toLocaleString()} floor blocks</span>
          </div>
          <div className="map-scroll">
            <canvas ref={canvasRef} className="map-canvas" onPointerDown={paintAt} onPointerMove={paintAt} onContextMenu={(event) => event.preventDefault()} aria-label="Paintable top-down map grid" role="application" />
          </div>
          <div className="map-footer">
            <div className="legend"><span className="legend-swatch floor-swatch" /> Walkable floor <span className="legend-swatch torch-swatch">✦</span> Suggested torch</div>
            <button className="clear-button" onClick={() => { setFloor(new Uint8Array(width * height)); setPlan(null); }}>Clear map</button>
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

      <footer className="footnote"><span>Planning is based on block light only. Spawn conditions such as biome, floor block, sky light, and nearby players are outside this 2D model.</span><a href="https://feedback.minecraft.net/hc/en-us/articles/4415128577293-Minecraft-Java-Edition-1-18" target="_blank" rel="noreferrer">1.18 light rule ↗</a></footer>
    </main>
  );
}
