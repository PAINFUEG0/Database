/** @format */

import { Logger } from "pastel-logger";
import { existsSync, readFileSync } from "fs";
import { CoreDatabase } from "./coreDatabase.js";
import { ThreadedFileWriter } from "./threadedFileWriter.js";

import type { Payload } from "../typings/types.js";

export class RecoveryEngine {
  #logFile: string;
  #requestCount = 1000;
  #logger = new Logger();
  #fileWriter = new ThreadedFileWriter();
  #databases: Map<string, CoreDatabase<unknown>>;

  constructor(logFile: string, databases: Map<string, CoreDatabase<unknown>>) {
    this.#logFile = logFile;
    this.#databases = databases;
  }

  #log(...args: Parameters<Logger["log"]>) {
    this.#logger.log(` - [ Recovery Engine ] - ${args[0]}`, args[1]);
  }

  async run() {
    if (!existsSync(this.#logFile)) return this.#log(`Skipping RE !!! No log file found at ${this.#logFile}`, "warn");

    this.#log(`Running Recovery Engine`, "info");

    const start = Date.now();
    const requests = readFileSync(this.#logFile, "utf-8")
      .trim()
      .split("\n")
      .filter((req) => req.includes("\tSET,") || req.includes("\tDELETE,"))
      .slice(-this.#requestCount);

    for (const request of requests) {
      const [, , path, method, key, value] = request.split(",\t");

      if (!path) continue;

      const db = this.#databases.get(path) || this.#databases.set(path!, new CoreDatabase(path)).get(path)!;
      db[method === "DELETE" ? "delete" : "set"](key!, value ? JSON.parse(value) : undefined);
    }

    this.#log(`RE completed running the last ${requests.length} requests in ${Date.now() - start}ms`, "success");
  }

  recordRequest(data: Payload) {
    this.#fileWriter.appendFile(
      this.#logFile,
      //@ts-expect-error - Accessing <data>.key | <data>.value even when non-existant - Won't throw error !!!
      `${Date.now()},\t${data.requestId},\t${data.path},\t${data.method},\t${data.key || ""},\t${data.value ? JSON.stringify(data.value) : ""}\n`
    );
  }
}
