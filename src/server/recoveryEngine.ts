/** @format */

import { existsSync, readFileSync } from "fs";
import { CoreDatabase } from "./databaseCore.js";
import { FileWriter } from "./threadedFileWriter.js";
import { Payload } from "../typings/types.js";
import { Logger } from "pastel-logger";

export class RecoveryEngine {
  #logFile: string;
  #requestCount = 1000;
  #logger = new Logger();
  #fileWriter = new FileWriter();
  #databases: Map<string, CoreDatabase<unknown>>;

  constructor(logFile: string, databases: Map<string, CoreDatabase<unknown>>) {
    this.#logFile = logFile;
    this.#databases = databases;
  }

  #log(...args: Parameters<Logger["log"]>) {
    this.#logger.log(` - [ Recovery Engine ] - ${args[0]}`, args[1]);
  }

  async run() {
    if (!existsSync(this.#logFile)) return this.#log(`No log file found at ${this.#logFile}`, "warn");

    this.#log(`Running Recovery Engine`, "info");

    const start = Date.now();
    const requests = readFileSync(this.#logFile, "utf-8").trim().split("\n").slice(-this.#requestCount);

    for (const request of requests) {
      const [, , path, method, key, value] = request.split(",\t");

      if (!path) continue;

      const db = this.#databases.get(path) || this.#databases.set(path!, new CoreDatabase({ path })).get(path)!;
      db[method === "DELETE" ? "delete" : "set"](key!, value!);
    }

    this.#log(`RE completed running the last ${this.#requestCount} requests in ${Date.now() - start}ms`, "success");
  }

  log(data: Payload) {
    this.#fileWriter.appendFile(
      this.#logFile,
      //@ts-expect-error accessing prop that may/not be present (<data>.key | <data>.value) | Wont throw error !!!
      `${Date.now()},\t${data.requestId},\t${data.path},\t${data.method},\t${data.key || ""},\t${data.value || ""}\n`
    );
  }
}
