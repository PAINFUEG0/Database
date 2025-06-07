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

    const db =
      this.#databases.get(data.path) ||
      this.#databases.set(data.path, new CoreDatabase({ path: data.path })).get(data.path)!;

    switch (data.method) {
      case "ALL":
        {
          const value = db.all();
          ws.send(JSON.stringify({ data: value, status: 200, requestId: data.requestId }));
        }
        break;

      case "DELETE":
        {
          db.delete(data.key);
          ws.send(JSON.stringify({ data: null, status: 200, requestId: data.requestId }));
        }
        break;

      case "SET":
        {
          db.set(data.key, data.value);
          ws.send(JSON.stringify({ data: data.value, status: 200, requestId: data.requestId }));
        }
        break;

      case "GET":
        {
          const value = db.get(data.key);
          if (value === null) return ws.send(JSON.stringify({ data: null, status: 404, requestId: data.requestId }));
          ws.send(JSON.stringify({ data: value, status: 200, requestId: data.requestId }));
        }
        break;
    }
  }
}
