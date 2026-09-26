/** @format */

import * as fs from "node:fs";
import * as os from "node:os";
import { WebSocketServer } from "ws";
import { handleRestRequests } from "./handleRestRequests.js";
import { createServer as createHttpsServer } from "node:https";
import { handleIncomingWebsocketMessages } from "./handleWebsocketMessages.js";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";

import type { SSLOptions } from "../types.js";
import type { KeyValueStore } from "./keyValueStore.js";

export const databases = new Map<string, KeyValueStore<any>>();
const respond = (res: ServerResponse, code: number, data: any) =>
  res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(data));

export class DatabaseServer {
  #log: (data: string) => void;

  ip =
    Object.values(os.networkInterfaces())
      .flat()
      .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address ?? "localhost";

  constructor(options: { port: number; auth: string; ssl?: SSLOptions; onStdout?: (data: string) => void }) {
    this.#log = options.onStdout || ((data: string) => console.log(data));

    const key = options.ssl?.key && fs.readFileSync(options.ssl.key).toString();
    const cert = options.ssl?.cert && fs.readFileSync(options.ssl.cert).toString();

    const ssl = key && cert;

    const handler = (req: IncomingMessage, res: ServerResponse) => {
      if (!req.url?.startsWith("/rest")) return respond(res, 404, { error: "Not Found" });
      if (req.headers["authorization"] !== options.auth) return respond(res, 401, { error: "Unauthorized" });

      ssl ? handleRestRequests.call(server, req, res) : handleRestRequests.call(server, req, res);
    };

    const server = ssl ? createHttpsServer({ key, cert }, handler) : createHttpServer(handler);

    const wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: (info, callback) => callback(info.req.headers["authorization"] === options.auth)
    });

    server.listen(options.port, () => {
      const port = (server.address()! as any).port;

      this.#log(`REST - http${ssl ? "s" : ""}://${this.ip}:${port}/rest`);
      this.#log(`WebSocket - ws${ssl ? "s" : ""}://${this.ip}:${port}/ws`);

      wss.on("connection", (ws, req) => {
        this.#log(`Established a new connection from ${req.socket.remoteAddress}`);

        ws.on("message", handleIncomingWebsocketMessages.bind(ws));
        ws.on("error", (err) => console.error(JSON.stringify(err.stack)));
        ws.on("close", () => this.#log(`Connection closed from ${req.socket.remoteAddress}`));
      });
    });
  }
}
