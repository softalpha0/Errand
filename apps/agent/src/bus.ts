import { EventEmitter } from "node:events";
import type { Errand } from "@errand/core";

/** In-process pub/sub so the SSE stream can push each new errand snapshot. */
const emitter = new EventEmitter();
emitter.setMaxListeners(200);

export function publish(e: Errand) {
  emitter.emit(e.id, e);
}

export function subscribe(id: string, fn: (e: Errand) => void): () => void {
  emitter.on(id, fn);
  return () => emitter.off(id, fn);
}
