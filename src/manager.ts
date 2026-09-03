/** @format */

import { WebSocket } from "ws";
import { DatabaseClient } from "./client.js";
import { EventEmitter, once } from "node:events";

import type { z } from "zod";
import type { DatabaseClientRequest, DatabaseServerResponse } from "./types.js";

type ConstructOptions = { url: string; auth: string } | { url: string; port: number; auth: string; secure?: boolean };

export class DatabaseManager extends EventEmitter<{ error: [err: Error]; disconnected: [address: string] }> {
  auth: string;
  webSocket?: WebSocket;
  socketAddress: string;
  requests = new Map<string, DatabaseClientRequest<any>>();

  constructor(op: ConstructOptions) {
    super();
    this.auth = op.auth;
    this.socketAddress = "port" in op ? `ws${op.secure ? "s" : ""}://${op.url}:${op.port}` : op.url;
  }

  async connect() {
    this.webSocket = new WebSocket(this.socketAddress, { headers: { Authorization: this.auth } });

    await once(this.webSocket, "open");

    this.webSocket.on("message", (data) => {
      const response = <DatabaseServerResponse>JSON.parse(data.toString());
      const request = this.requests.get(response.requestId);

      if (!request) return;

      clearTimeout(request.timeout);
      this.requests.delete(response.requestId);
      "error" in response ? request.reject(new Error(JSON.stringify(response))) : request.resolve(response.data);
    });

    this.webSocket.on("error", (err) => this.emit("error", err));
    this.webSocket.once("close", () => this.emit("disconnected", this.socketAddress));
  }

  /**
   * @description Creates a new database with the given path
   * @requires {@linkcode DatabaseManager#connect} to be called and awaited
   * @throws if webSocket connection is not open i.e is closed or connecting or closing
   */
  createDatabase<T = unknown>(path: string): DatabaseClient<T>;
  createDatabase<T extends z.ZodType>(path: string, schema: T): DatabaseClient<z.infer<T>>;

  createDatabase(path: string, schema?: z.ZodType) {
    if (this.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseManager>.connect()" before trying to create a database !`);

    if (path.length === 0) throw new Error("Path cannot be empty");
    if (path === ".") throw new Error("Invalid path !! Path cannot be '.'");
    if (path.length > 1000) throw new Error("Path too long max 1000 characters");
    if (path.includes("..")) throw new Error("Invalid path !! Path cannot contain '..'");

    return new DatabaseClient(this, path, schema);
  }
}
