/** @format */

import { join } from "node:path";
import { WebSocketServer } from "ws";
import { Logger } from "pastel-logger";
import { CoreDatabase } from "./coreDatabase.js";
import { RecoveryEngine } from "./recoveryEngine.js";

import type { RawData, WebSocket } from "ws";
import type { Payload } from "../typings/types.js";

export class DatabaseServer {
  #wss: WebSocketServer;
  #logger = new Logger();
  #logFile = "./logs.csv";
  #databases = new Map<string, CoreDatabase<unknown>>();
  #recoveryEngine = new RecoveryEngine(this.#logFile, this.#databases);

  #log(...args: Parameters<Logger["log"]>) {
    this.#logger.log(` - [ Database Server ] - ${args[0]}`, args[1]);
  }

  constructor(port = 8080, auth = "hello") {
    this.#recoveryEngine.run();

    this.#wss = new WebSocketServer({
      port,
      verifyClient: (info, callback) => {
        const authHeader = info.req.headers["authorization"];
        if (!authHeader) return callback(false, 401, "Unauthorized: No credentials provided");
        if (authHeader !== auth) return callback(false, 401, "Unauthorized: Invalid credentials");
        callback(true);
      }
    });

    this.#wss.on("listening", async () => this.#log(`Server started on port ${port}`, "success"));

    this.#wss.on("connection", (ws, req) => {
      ws.on("message", async (message) => this.#handleMessage(ws, message));
      ws.on("error", (err) => this.#log(JSON.stringify(err.stack), "error"));
      ws.on("close", () => this.#log(`Connection closed from ${req.socket.remoteAddress}`, "warn"));
      this.#log(`Established a new connection established from ${req.socket.remoteAddress}`, "success");
    });
  }

  async #handleMessage(ws: WebSocket, message: RawData) {
    const data = JSON.parse(message.toString()) as Payload;

    data.path = join("./", "storage", data.path);

    const db =
      this.#databases.get(data.path) || this.#databases.set(data.path, new CoreDatabase(data.path)).get(data.path)!;

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

    this.#recoveryEngine.recordRequest(data);
  }
}
