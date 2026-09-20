/** @format */

import { WebSocket } from "ws";
import { Database } from "./database.js";
import { EventEmitter, once } from "node:events";

import type { z } from "zod";
import type { DatabaseClientRequest, DatabaseServerResponse } from "../types.js";

type RequestMode = "ws" | "rest";

type ConstructOptions = { url: string; port: number; auth: string; secure?: boolean; mode?: RequestMode };

export class DatabaseClient extends EventEmitter<{ error: [err: Error]; disconnected: [address: string] }> {
  auth: string;
  address: string;
  mode: RequestMode;
  webSocket?: WebSocket;
  requests = new Map<string, DatabaseClientRequest<any>>();

  constructor(op: ConstructOptions) {
    super();
    this.auth = op.auth;
    this.mode = op.mode ?? "ws";
    this.address = `${this.mode === "ws" ? "ws" : "http"}${op.secure ? "s" : ""}://${op.url}:${op.port}`;
  }

  async connect() {
    if (this.mode !== "ws") return;
    this.webSocket = new WebSocket(this.address, { headers: { Authorization: this.auth } });

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

    this.webSocket.once("close", () => {
      this.emit("disconnected", this.address);
      this.requests.forEach((request) => request.reject(new Error("Database server disconnected !")));
    });
  }

  /**
   * @description Creates a new database with the given path
   * @requires {@linkcode DatabaseClient#connect} to be called and awaited
   * @throws if webSocket connection is not open i.e is closed or connecting or closing
   */
  createDatabase<T = unknown>(path: string): Promise<Database<T>>;
  createDatabase<T = unknown>(
    path: string,
    op: { debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ): Promise<Database<T>>;
  createDatabase<T extends z.ZodType>(
    path: string,
    op: { schema: T; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ): Promise<Database<z.infer<T>>>;

  async createDatabase(
    path: string,
    op?: { schema?: z.ZodType; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ) {
    if (this.mode == "ws" && this.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseClient>.connect()" before trying to create a database !`);

    if (path.length === 0) throw new Error("Path cannot be empty");
    if (path === ".") throw new Error("Invalid path !! Path cannot be '.'");
    if (path.length > 1000) throw new Error("Path too long max 1000 characters");
    if (path.includes("..")) throw new Error("Invalid path !! Path cannot contain '..'");

    const db = new Database(this, path, this.mode, op?.schema);
    return await db.init(op);
  }
}
