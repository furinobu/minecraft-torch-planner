import wasmUrl from "./slime-search.wasm?url";
import type { SlimeSearchRequest } from "./slimeSearch";

const worker = self as unknown as DedicatedWorkerGlobalScope;

type SlimeWasmExports = {
  memory: WebAssembly.Memory;
  search: (
    seed: bigint,
    centerChunkX: number,
    centerChunkZ: number,
    radius: number,
    windowStartX: number,
    windowCountX: number,
  ) => number;
};

const wasmPromise = fetch(wasmUrl)
  .then((response) => {
    if (!response.ok) throw new Error("Unable to load the slime search WebAssembly module.");
    return response.arrayBuffer();
  })
  .then((bytes) => WebAssembly.instantiate(bytes, {
    env: {
      report_progress: (completedRows: number, totalRows: number) => {
        worker.postMessage({ type: "progress", percent: Math.floor((completedRows / totalRows) * 100) });
      },
    },
  }))
  .then(({ instance }) => instance.exports as unknown as SlimeWasmExports);

worker.onmessage = async (event: MessageEvent<SlimeSearchRequest>) => {
  try {
    const wasm = await wasmPromise;
    const pointer = wasm.search(
      BigInt(event.data.seed),
      event.data.centerChunkX,
      event.data.centerChunkZ,
      event.data.radius,
      event.data.windowStartX,
      event.data.windowCountX,
    );
    if (pointer === 0) throw new Error("The search area would extend beyond the default Minecraft world border.");

    const values = new Int32Array(wasm.memory.buffer, pointer, 8 + 16 * 16);
    const slimeChunks: number[] = [];
    for (let index = 0; index < 16 * 16; index += 1) {
      if (values[8 + index] === 1) slimeChunks.push(index);
    }
    const readUint64 = (low: number, high: number) => (high >>> 0) * 0x1_0000_0000 + (low >>> 0);

    worker.postMessage({
      type: "result",
      result: {
        startChunkX: values[0],
        startChunkZ: values[1],
        slimeCount: values[2],
        tiedWindows: readUint64(values[3], values[4]),
        testedWindows: readUint64(values[5], values[6]),
        radius: values[7],
        slimeChunks,
      },
    });
  } catch (error) {
    worker.postMessage({ type: "error", message: error instanceof Error ? error.message : "Slime chunk search failed." });
  }
};
