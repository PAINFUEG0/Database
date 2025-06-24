/** @format */

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "worker_threads";

export class ThreadedFileWriter {
  worker: Worker;
  constructor() {
    this.worker = new Worker(fileURLToPath(import.meta.url));
    this.worker.on("error", (err) => console.error("FileWriter error:", err));
  }

  appendFile(path: string, data: string) {
    this.worker.postMessage({ path, data });
  }
}

if (!isMainThread) parentPort?.on("message", ({ path, data }) => appendFileSync(path, data));
