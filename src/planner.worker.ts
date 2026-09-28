import { planTorches } from "./torchPlanner";

type PlanRequest = {
  width: number;
  height: number;
  floor: Uint8Array;
  radius: number;
};

const worker = self as unknown as DedicatedWorkerGlobalScope;
worker.onmessage = (event: MessageEvent<PlanRequest>) => {
  const { width, height, floor, radius } = event.data;
  worker.postMessage(planTorches(width, height, floor, radius));
};
