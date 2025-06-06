/** @format */

import { WebSocketServer } from "ws";
import { CoreDatabase } from "./databaseCore.js";

import type { RawData, WebSocket } from "ws";
import type { Payload } from "./typings/types.js";

export class DatabaseServer {
  #wss: WebSocketServer;

  constructor(port = 8080) {
    this.#wss = new WebSocketServer({ port });

    this.#wss.on("listening", () => console.log(`Server started on port ${port}`));

    this.#wss.on("connection", (ws, req) => {
      ws.on("message", async (message) => this.#handleMessage(ws, message));
      ws.on("error", (err) => console.error(JSON.stringify(err.stack)));
      ws.on("close", () => console.log(`Connection closed from ${req.socket.remoteAddress}`));
      console.log(`Child established a new connection established from ${req.socket.remoteAddress}`);
    });
  }

  #databases = new Map<string, CoreDatabase<unknown>>();

  async #handleMessage(ws: WebSocket, message: RawData) {
    const data = JSON.parse(message.toString()) as Payload;

    const key = data.key;
    const path = data.path;
    const requestId = data.requestId;

    const db = this.#databases.get(path) || this.#databases.set(path, new CoreDatabase({ path })).get(path)!;

    switch (data.method) {
      case "DELETE":
        {
          await db.delete(key);
          ws.send(JSON.stringify({ data: null, status: 200, requestId }));
        }
        break;

      case "SET":
        {
          await db.set(key, data.value);
          ws.send(JSON.stringify({ data: data.value, status: 200, requestId }));
        }
        break;

      case "GET":
        {
          const value = await db.get(key);
          if (value === null) return ws.send(JSON.stringify({ data: null, status: 404, requestId }));
          ws.send(JSON.stringify({ data: value, status: 200, requestId }));
        }
        break;
    }
  }
}
