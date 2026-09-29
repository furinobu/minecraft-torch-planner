import { planTorches } from "./torchPlanner";

type PlanRequest = {
  width: number;
  height: number;
  terrain: Uint8Array;
  radius: number;
};

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<PlanRequest>) => {
  const { width, height, terrain, radius } = event.data;
  worker.postMessage(planTorches(width, height, terrain, radius));
};
