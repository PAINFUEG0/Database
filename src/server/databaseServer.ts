/** @format */

import * as fs from "node:fs";
import * as os from "node:os";
import { WebSocketServer } from "ws";
import { handleRestRequests } from "./handleRestRequests.js";
import { createServer as createHttpsServer } from "node:https";
import { handleIncomingWebsocketMessages } from "./handleWebsocketMessages.js";
import { createServer as createHttpServer, IncomingMessage, ServerResponse } from "node:http";

import type { KeyValueStore } from "./keyValueStore.js";
import type { DatabaseServerOptions } from "../types.js";

export const databases = new Map<string, KeyValueStore<any>>();
const respond = (res: ServerResponse, code: number, data: any) =>
  res.writeHead(code, { "Content-Type": "application/json" }).end(JSON.stringify(data));

export class DatabaseServer {
  #key?: string;
  #auth: string;
  #port: number;
  #cert?: string;
  #onStderr: NonNullable<DatabaseServerOptions["onStderr"]>;
  #onStdout: NonNullable<DatabaseServerOptions["onStdout"]>;

  #ip =
    Object.values(os.networkInterfaces())
      .flat()
      .find((iface) => iface?.family === "IPv4" && !iface.internal)?.address ?? "localhost";

  constructor(options: DatabaseServerOptions) {
    this.#auth = options.auth;
    this.#port = options.port;

    this.#onStdout = options.onStdout || console.log.bind(console);
    this.#onStderr = options.onStderr || console.error.bind(console);

    this.#key = options.ssl?.key && fs.readFileSync(options.ssl.key).toString();
    this.#cert = options.ssl?.cert && fs.readFileSync(options.ssl.cert).toString();
  }

  #requestHandler(req: IncomingMessage, res: ServerResponse) {
    if (req.url?.startsWith("/rest") && req.method === "POST")
      if (req.headers["authorization"] !== this.#auth) return respond(res, 401, { error: "Unauthorized" });
      else return handleRestRequests(req, res, this.#onStderr).catch((error) => this.#onStderr(JSON.stringify(error)));

    return respond(res, 404, { error: "Not Found" });
  }

  async boot() {
    const ssl = this.#key && this.#cert;

    const server = ssl
      ? createHttpsServer({ key: this.#key, cert: this.#cert }, this.#requestHandler.bind(this))
      : createHttpServer(this.#requestHandler.bind(this));

    const wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: (info, callback) => callback(info.req.headers["authorization"] === this.#auth)
    });

    return new Promise<void>((resolve) => {
      server.listen(this.#port, () => {
        resolve();
        const port = (server.address()! as any).port;

        this.#onStdout(`REST - http${ssl ? "s" : ""}://${this.#ip}:${port}/rest`);
        this.#onStdout(`WebSocket - ws${ssl ? "s" : ""}://${this.#ip}:${port}/ws`);

        wss.on("connection", (ws, req) => {
          ws.on("message", (raw) =>
            handleIncomingWebsocketMessages
              .call(ws, raw, this.#onStderr)
              .catch((error) => this.#onStderr(JSON.stringify(error)))
          );
          ws.on("error", (err) => this.#onStderr(JSON.stringify(err)));
          this.#onStdout(`Established a new connection from ${req.socket.remoteAddress}`);
          ws.on("close", () => this.#onStdout(`Connection closed from ${req.socket.remoteAddress}`));
        });
      });
    });
  }
}
