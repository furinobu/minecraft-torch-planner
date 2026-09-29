import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { MAX_SEARCH_RADIUS, parseJavaSeed, SLIME_AREA_SIZE } from "./slimeSearch";
import type { SlimeSearchRequest, SlimeSearchResult } from "./slimeSearch";

type SearchReply =
  | { type: "progress"; percent: number }
  | { type: "result"; result: SlimeSearchResult }
  | { type: "error"; message: string };

function windowDistance(result: SlimeSearchResult, centerChunkX: number, centerChunkZ: number) {
  const dx = result.startChunkX * 2 + SLIME_AREA_SIZE - 2 - centerChunkX * 2;
  const dz = result.startChunkZ * 2 + SLIME_AREA_SIZE - 2 - centerChunkZ * 2;
  return dx * dx + dz * dz;
}

function combinePartialResults(
  partials: SlimeSearchResult[],
  centerChunkX: number,
  centerChunkZ: number,
  radius: number,
): SlimeSearchResult {
  const bestCount = Math.max(...partials.map((partial) => partial.slimeCount));
  const leaders = partials.filter((partial) => partial.slimeCount === bestCount);
  const winner = leaders.reduce((best, candidate) => {
    const bestDistance = windowDistance(best, centerChunkX, centerChunkZ);
    const candidateDistance = windowDistance(candidate, centerChunkX, centerChunkZ);
    if (candidateDistance < bestDistance) return candidate;
    if (candidateDistance > bestDistance) return best;
    if (candidate.startChunkZ < best.startChunkZ) return candidate;
    if (candidate.startChunkZ > best.startChunkZ) return best;
    return candidate.startChunkX < best.startChunkX ? candidate : best;
  });

  return {
    ...winner,
    tiedWindows: leaders.reduce((total, partial) => total + partial.tiedWindows, 0),
    testedWindows: (radius * 2 + 1) ** 2,
    radius,
  };
}

export default function SlimeChunkFinder() {
  const [seedText, setSeedText] = useState("");
  const [centerX, setCenterX] = useState("0");
  const [centerZ, setCenterZ] = useState("0");
  const [radius, setRadius] = useState("256");
  const [result, setResult] = useState<SlimeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);
  const [error, setError] = useState("");
  const workerRef = useRef<Worker[]>([]);

  useEffect(() => () => workerRef.current.forEach((worker) => worker.terminate()), []);

  const cancelSearch = () => {
    workerRef.current.forEach((worker) => worker.terminate());
    workerRef.current = [];
    setSearching(false);
    setProgress(0);
    setWorkerCount(0);
  };

  const findBestArea = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (searching) return;
    workerRef.current.forEach((worker) => worker.terminate());
    workerRef.current = [];
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
      windowStartX: 0,
      windowCountX: 1,
    };
    const startsPerAxis = searchRadius * 2 + 1;
    const availableWorkers = navigator.hardwareConcurrency || 2;
    const workersToUse = Math.max(1, Math.min(8, availableWorkers, startsPerAxis));
    const workers: Worker[] = [];
    const partialResults: Array<SlimeSearchResult | null> = Array(workersToUse).fill(null);
    const workerProgress = Array(workersToUse).fill(0) as number[];
    let remainingWorkers = workersToUse;

    setSearching(true);
    setProgress(0);
    setWorkerCount(workersToUse);
    workerRef.current = workers;

    const failSearch = (message: string) => {
      if (workerRef.current !== workers) return;
      workers.forEach((worker) => worker.terminate());
      workerRef.current = [];
      setSearching(false);
      setProgress(0);
      setWorkerCount(0);
      setError(message);
    };

    for (let workerIndex = 0; workerIndex < workersToUse; workerIndex += 1) {
      const windowStartX = Math.floor((workerIndex * startsPerAxis) / workersToUse);
      const windowEndX = Math.floor(((workerIndex + 1) * startsPerAxis) / workersToUse);
      const worker = new Worker(new URL("./slimeSearch.worker.ts", import.meta.url), { type: "module" });
      workers.push(worker);
      worker.onmessage = (message: MessageEvent<SearchReply>) => {
        if (workerRef.current !== workers) return;
        if (message.data.type === "progress") {
          workerProgress[workerIndex] = message.data.percent;
          setProgress(Math.floor(workerProgress.reduce((total, value) => total + value, 0) / workersToUse));
          return;
        }
        if (message.data.type === "error") {
          failSearch(message.data.message);
          return;
        }

        partialResults[workerIndex] = message.data.result;
        workerProgress[workerIndex] = 100;
        worker.terminate();
        remainingWorkers -= 1;
        setProgress(Math.floor(workerProgress.reduce((total, value) => total + value, 0) / workersToUse));
        if (remainingWorkers !== 0) return;

        const completed = partialResults.filter((partial): partial is SlimeSearchResult => partial !== null);
        setResult(combinePartialResults(completed, request.centerChunkX, request.centerChunkZ, searchRadius));
        workerRef.current = [];
        setSearching(false);
        setProgress(100);
      };
      worker.onerror = () => failSearch("The slime chunk search stopped unexpectedly. Try a smaller search radius.");
      worker.postMessage({ ...request, windowStartX, windowCountX: windowEndX - windowStartX });
    }
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
            {searching ? <><span className="spinner" /> Searching {progress}% · {workerCount} workers…</> : <>Find densest area <span>→</span></>}
          </button>
        </form>
        {searching && <button className="small-button slime-cancel-button" type="button" onClick={cancelSearch}>Cancel search</button>}
        <p className="import-help">The radius moves the searched area’s center up to that many chunks from your chosen center. Searches use up to 8 CPU workers. The 1,048,576-chunk maximum checks about 4.4 trillion candidate areas, so large searches can take a very long time. Progress is shown and the search can be cancelled.</p>
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
        <p className="slime-search-stats">Checked {result.testedWindows.toLocaleString()} possible areas within a {result.radius.toLocaleString()}-chunk radius using {workerCount} worker{workerCount === 1 ? "" : "s"}.</p>
      </section>}
    </section>
  );
}
