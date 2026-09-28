/** @format */

import { WebSocket } from "ws";
import { once } from "node:events";
import { Database } from "./database.js";
import { requestFactory } from "./requestFactory.js";

import type { z } from "zod";
import type { RequestMode, DatabaseClientRequest, DatabaseClientOptions, DatabaseServerResponse } from "../types.js";

export class DatabaseClient {
  #auth: string;
  #address: string;
  #mode: RequestMode;
  #webSocket?: WebSocket;
  #requests = new Map<string, DatabaseClientRequest<any>>();

  #throwOnError = true;
  #throwOnDisconnect = true;

  #onError: (err: Error) => void;
  #onDisconnect: (address: string) => void;

  #makeRequest = requestFactory.call(this);

  get auth() {
    return this.#auth;
  }

  get address() {
    return this.#address;
  }

  get mode() {
    return this.#mode;
  }

  get webSocket() {
    return this.#webSocket;
  }

  get requests() {
    return this.#requests;
  }

  constructor(op: DatabaseClientOptions) {
    this.#auth = op.auth;
    this.#mode = op.mode ?? "ws";

    this.#onError = op.onError ?? console.error;
    this.#throwOnError = op.throwOnError ?? !op.onError;
    this.#throwOnDisconnect = op.throwOnDisconnect ?? !op.onDisconnect;
    this.#onDisconnect = op.onDisconnect ?? console.error.bind(console, "Client disconnected ! Address : ");

    this.#address = `${this.#mode === "ws" ? "ws" : "http"}${op.secure ? "s" : ""}://${op.url}:${op.port}${this.#mode === "ws" ? "/ws" : "/rest"}`;
  }

  async connect() {
    if (this.#mode !== "ws") return;

    this.#webSocket = new WebSocket(this.#address, { headers: { Authorization: this.#auth } });

    await once(this.#webSocket, "open");

    this.#webSocket.on("message", (data) => {
      const response = <DatabaseServerResponse>JSON.parse(data.toString());
      const request = this.#requests.get(response.requestId);

      if (!request) return;

      clearTimeout(request.timeout);
      this.#requests.delete(response.requestId);
      "error" in response ? request.reject(new Error(JSON.stringify(response))) : request.resolve(response.data);
    });

    this.#webSocket.on("error", (err) => {
      if (this.#throwOnError) throw err;
      else this.#onError(err);
    });

    this.#webSocket.once("close", () => {
      if (this.#throwOnDisconnect) throw new Error(`Database server disconnected ! Address : ${this.#address}`);
      else this.#onDisconnect(this.#address);

      this.#requests.forEach((request) => request.reject(new Error("Database server disconnected !")));
    });
  }

  createDatabase<T = unknown>(path: string): Promise<Database<T>>;

  createDatabase<T = unknown>(
    path: string,
    op: { debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ): Promise<Database<T>>;

  createDatabase<T extends z.ZodType>(
    path: string,
    op: { schema: T; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ): Promise<Database<z.infer<T>>>;

  createDatabase(
    path: string,
    op?: { schema?: z.ZodType; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ) {
    if (this.#mode == "ws" && this.#webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseClient>.connect()" before trying to create a database !`);

    if (path.length === 0) throw new Error("Path cannot be empty");
    if (path === ".") throw new Error("Invalid path !! Path cannot be '.'");
    if (path.length > 1000) throw new Error("Path too long max 1000 characters");
    if (path.includes("..")) throw new Error("Invalid path !! Path cannot contain '..'");

    const db = new Database(this.#makeRequest.bind(this, path) as any, op?.schema);
    return db.init(op);
  }
}
