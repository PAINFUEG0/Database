/** @format */

import * as fs from "node:fs";
import * as os from "node:os";
import { WebSocketServer } from "ws";
import { handleRestRequest } from "./rest.ts";
import { handleIncomingWebsocketMessage } from "./ws.ts";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";

export type SSLOptions = { key: string; cert: string; rejectUnauthorized?: boolean };

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

    const server = ssl ? createHttpsServer({ key, cert }, handleRestRequest) : createHttpServer(handleRestRequest);

    const wss = new WebSocketServer({
      server,
      verifyClient: (info, callback) => callback(info.req.headers["authorization"] === options.auth)
    });

    server.listen(options.port, () => {
      const port = (server.address()! as any).port;

      this.#log(`REST - http${ssl ? "s" : ""}://${this.ip}:${port}`);
      this.#log(`WebSocket - ws${ssl ? "s" : ""}://${this.ip}:${port}`);

      wss.on("connection", (ws, req) => {
        this.#log(`Established a new connection from ${req.socket.remoteAddress}`);

        ws.on("message", handleIncomingWebsocketMessage.bind(ws));
        ws.on("error", (err) => console.error(JSON.stringify(err.stack)));
        ws.on("close", () => this.#log(`Connection closed from ${req.socket.remoteAddress}`));
      });
    });
  }
}
