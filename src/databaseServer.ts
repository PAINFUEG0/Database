/** @format */

import { join } from "node:path";
import { WebSocketServer } from "ws";
import { FileWriter } from "./writer.js";
import { CoreDatabase } from "./databaseCore.js";
import { existsSync, readFileSync } from "node:fs";

import type { RawData, WebSocket } from "ws";
import type { Payload } from "./typings/types.js";

export class DatabaseServer {
  #wss: WebSocketServer;
  #logFile = "./logs.csv";
  #fileWriter = new FileWriter();

  constructor(port = 8080) {
    if (existsSync(this.#logFile)) {
      console.log(` ${new Date(Date.now()).toString()} - [ SERVER ] - Running Recovery Engine`);

      const start = Date.now();
      const last1000Reqs = readFileSync(this.#logFile, "utf-8").trim().split("\n").slice(-1000);

      for (const request of last1000Reqs) {
        const [, , path, method, key, value] = request.split(",\t");
        const db =
          this.#databases.get(path!) || this.#databases.set(path!, new CoreDatabase({ path: path! })).get(path!)!;
        db[method === "DELETE" ? "delete" : "set"](key!, value!);
      }

      console.log(
        ` ${new Date(Date.now()).toString()} - [ SERVER ] - Recovery Engine completed running the last 1000 requests in ${Date.now() - start}ms`
      );
    }

    this.#wss = new WebSocketServer({ port });

    this.#wss.on("listening", async () =>
      console.log(` ${new Date(Date.now()).toString()} - [ SERVER ] - Server started on port ${port}`)
    );

    this.#wss.on("connection", (ws, req) => {
      ws.on("error", (err) => console.error(JSON.stringify(err.stack)));
      ws.on("message", async (message) => this.#handleMessage(ws, message));
      ws.on("close", () =>
        console.log(
          ` ${new Date(Date.now()).toString()} - [ SERVER ] - Connection closed from ${req.socket.remoteAddress}`
        )
      );
      console.log(
        ` ${new Date(Date.now()).toString()} - [ SERVER ] - Child established a new connection established from ${req.socket.remoteAddress}`
      );
    });
  }

  #databases = new Map<string, CoreDatabase<unknown>>();

  async #handleMessage(ws: WebSocket, message: RawData) {
    const data = JSON.parse(message.toString()) as Payload;

    data.path = join("./", "storage", data.path);

    const db =
      this.#databases.get(data.path) ||
      this.#databases.set(data.path, new CoreDatabase({ path: data.path })).get(data.path)!;

    switch (data.method) {
      case "ALL":
        ws.send(JSON.stringify({ data: db.all(), requestId: data.requestId }));
        break;

      case "GET":
        ws.send(JSON.stringify({ data: db.get(data.key), requestId: data.requestId }));
        break;

      case "DELETE":
        ws.send(JSON.stringify({ data: (db.delete(data.key), null), requestId: data.requestId }));
        break;

      case "SET":
        ws.send(JSON.stringify({ data: db.set(data.key, data.value), requestId: data.requestId }));
        break;
    }

    this.#fileWriter.appendFile(
      this.#logFile,
      `${Date.now()},\t${data.requestId},\t${data.path},\t${data.method},\t${"key" in data ? data.key : ""},\t${"value" in data ? data.value : ""}\n`
    );
  }
}
