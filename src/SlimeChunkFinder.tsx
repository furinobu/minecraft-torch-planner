import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MAX_SEARCH_RADIUS, parseJavaSeed, SLIME_AREA_SIZE } from "./slimeSearch";
import type { SlimeSearchRequest, SlimeSearchResult } from "./slimeSearch";

type SearchReply =
  | { type: "result"; result: SlimeSearchResult }
  | { type: "error"; message: string };

export default function SlimeChunkFinder() {
  const [seedText, setSeedText] = useState("");
  const [centerX, setCenterX] = useState("0");
  const [centerZ, setCenterZ] = useState("0");
  const [radius, setRadius] = useState("256");
  const [result, setResult] = useState<SlimeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const findBestArea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    workerRef.current?.terminate();
    workerRef.current = null;
    setResult(null);
    setError("");

    const blockX = Number(centerX);
    const blockZ = Number(centerZ);
    const searchRadius = Number(radius);
    if (!Number.isSafeInteger(blockX) || !Number.isSafeInteger(blockZ)) {
      setError("Enter whole-number block coordinates for the search center.");
      return;
    }
    if (!Number.isInteger(searchRadius) || searchRadius < 0 || searchRadius > MAX_SEARCH_RADIUS) {
      setError(`Search radius must be between 0 and ${MAX_SEARCH_RADIUS} chunks.`);
      return;
    }

    let seed: number;
    try {
      seed = parseJavaSeed(seedText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enter a Minecraft seed.");
      return;
    }

    const request: SlimeSearchRequest = {
      seed,
      centerChunkX: Math.floor(blockX / 16),
      centerChunkZ: Math.floor(blockZ / 16),
      radius: searchRadius,
    };
    setSearching(true);
    const worker = new Worker(new URL("./slimeSearch.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (message: MessageEvent<SearchReply>) => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      setSearching(false);
      if (message.data.type === "result") setResult(message.data.result);
      else setError(message.data.message);
      worker.terminate();
    };
    worker.onerror = () => {
      if (workerRef.current !== worker) return;
      workerRef.current = null;
      setSearching(false);
      setError("The slime chunk search stopped unexpectedly. Try a smaller search radius.");
      worker.terminate();
    };
    worker.postMessage(request);
  };

  return (
    <section className="slime-finder">
      <div className="slime-intro panel">
        <div className="section-heading"><span className="step">01</span><h2>Find a slime-rich area</h2></div>
        <p>Search for the most slime chunks in a 16 × 16 chunk square. Enter your seed and a place to search around.</p>
        <form className="slime-form" onSubmit={findBestArea}>
          <label className="field-label seed-field">Java seed
            <input type="text" value={seedText} onChange={(event) => setSeedText(event.target.value)} placeholder="Number or text seed" autoComplete="off" required />
          </label>
          <fieldset className="center-fields">
            <legend>Search center (block X, Z)</legend>
            <label className="field-label">X <input type="number" step="1" min="-30000000" max="30000000" value={centerX} onChange={(event) => setCenterX(event.target.value)} /></label>
            <label className="field-label">Z <input type="number" step="1" min="-30000000" max="30000000" value={centerZ} onChange={(event) => setCenterZ(event.target.value)} /></label>
          </fieldset>
          <label className="field-label radius-field">Search radius (chunks)
            <input type="number" step="1" min="0" max={MAX_SEARCH_RADIUS} value={radius} onChange={(event) => setRadius(event.target.value)} />
          </label>
          <button className="plan-button slime-search-button" type="submit" disabled={searching}>
            {searching ? <><span className="spinner" /> Searching…</> : <>Find densest area <span>→</span></>}
          </button>
        </form>
        <p className="import-help">The radius moves the searched area’s center up to that many chunks from your chosen center. The search runs locally in your browser.</p>
        {error && <p className="plan-error" role="alert">{error}</p>}
      </div>

      {result && <section className="slime-result panel" aria-live="polite">
        <div className="slime-result-heading">
          <div><div className="eyebrow"><span className="eyebrow-dot" /> BEST AREA FOUND</div><h2>{result.slimeCount} slime chunks <span>in 256 chunks</span></h2></div>
          <span className="map-count">{result.tiedWindows.toLocaleString()} area{result.tiedWindows === 1 ? "" : "s"} tied</span>
        </div>
        <div className="slime-coordinate-summary">
          <div><span>Area center (block X, Z)</span><strong>{((result.startChunkX + 8) * 16).toLocaleString()}, {((result.startChunkZ + 8) * 16).toLocaleString()}</strong><small>Between the four center chunks</small></div>
          <div><span>Northwest corner</span><strong>{(result.startChunkX * 16).toLocaleString()}, {(result.startChunkZ * 16).toLocaleString()}</strong><small>Chunk {result.startChunkX}, {result.startChunkZ}</small></div>
        </div>
        <p className="map-instructions">Each square is one chunk (16 × 16 blocks). Filled squares are slime chunks.</p>
        <div className="slime-map-scroll">
          <div className="slime-map" role="img" aria-label={`${result.slimeCount} slime chunks in a 16 by 16 chunk area`}>
            {Array.from({ length: SLIME_AREA_SIZE * SLIME_AREA_SIZE }, (_, index) => {
              const x = index % SLIME_AREA_SIZE;
              const z = Math.floor(index / SLIME_AREA_SIZE);
              const isSlime = result.slimeChunks.includes(index);
              const chunkX = result.startChunkX + x;
              const chunkZ = result.startChunkZ + z;
              return <span className={`slime-cell ${isSlime ? "is-slime" : ""}`} key={index} title={`Chunk ${chunkX}, ${chunkZ}${isSlime ? " · slime chunk" : ""}`} aria-hidden="true">{isSlime ? "✦" : ""}</span>;
            })}
          </div>
        </div>
        <p className="slime-search-stats">Checked {result.testedWindows.toLocaleString()} possible areas within a {result.radius.toLocaleString()}-chunk radius.</p>
      </section>}
    </section>
  );
}
