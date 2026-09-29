import { searchBestSlimeArea } from "./slimeSearch";
import type { SlimeSearchRequest } from "./slimeSearch";

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<SlimeSearchRequest>) => {
  try {
    worker.postMessage({ type: "result", result: searchBestSlimeArea(event.data) });
  } catch (error) {
    worker.postMessage({ type: "error", message: error instanceof Error ? error.message : "Slime chunk search failed." });
  }
};
