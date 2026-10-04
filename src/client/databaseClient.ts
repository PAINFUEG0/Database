/** @format */

import { WebSocket } from "ws";
import { once } from "node:events";
import { Database } from "./database.js";
import { randomUUID } from "node:crypto";
import { posix } from "node:path";

import { z } from "zod";
import type { RequestMode, DatabaseClientRequest, DatabaseClientOptions, DatabaseServerResponse, Protocols } from "../types.js";

export class DatabaseClient {
  #auth: string;
  #address: string;
  #mode: RequestMode;
  #webSocket?: WebSocket;
  #paths = new Set<string>();
  #requests = new Map<string, DatabaseClientRequest<any>>();

  #throwOnError = true;
  #throwOnDisconnect = true;

  #onError: (err: Error) => void;
  #onDisconnect: (address: string) => void;

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
      "error" in response ? request.reject(new Error(response.error)) : request.resolve(response.data);
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

  async createDatabase(path: string, op?: { schema?: z.ZodType; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }) {
    if (this.#mode == "ws" && this.#webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseClient>.connect()" before trying to create a database !`);

    path = posix.normalize(path.replace(/\\/g, "/")).replace(/\/+$/, "");

    if (path.length > 256) throw new Error("Path too long: max 256 characters");
    if (this.#paths.has(path)) throw new Error("A database at the same path already exists !");
    if (posix.isAbsolute(path) || /^[a-zA-Z]:/.test(path)) throw new Error("Path cannot be absolute");
    if (path === "" || path === ".") throw new Error("Invalid path: cannot resolve to the storage root");
    if (path === ".." || path.startsWith("../")) throw new Error("Invalid path: cannot escape the storage directory");

    for (const key of ["debounceTime", "maxDebounceCount", "keysPerFile"] as const)
      if (op && key in op && !z.number().min(0).max(4096).safeParse(op[key]).success)
        throw new Error(`Invalid option : Provided option '${key}' must be > 0 <= 4096. Got - ${op[key]}`);

    const requestMaker = this.mode === "ws" ? this.#sendWSmessage.bind(this, path) : this.#sendRestRequest.bind(this, path);

    this.#paths.add(path);
    return await new Database(requestMaker as any, op?.schema)
      .init({ debounceTime: op?.debounceTime, maxDebounceCount: op?.maxDebounceCount, keysPerFile: op?.keysPerFile })
      .catch((e) => {
        this.#paths.delete(path);
        throw e;
      });
  }

  async #sendRestRequest<P>(path: string, PL: Protocols<P>[keyof Protocols<P>]["req"]): Promise<P> {
    return fetch(this.address, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ ...PL, path }),
      headers: { "Content-Type": "application/json", Authorization: this.auth }
    }).then(async (raw) => {
      const res = await (<Promise<DatabaseServerResponse<P>>>raw.json());
      if ("error" in res) throw new Error(res.error);
      return res.data;
    });
  }

  async #sendWSmessage<P>(path: string, PL: Protocols<P>[keyof Protocols<P>]["req"]): Promise<P> {
    if (this.webSocket?.readyState !== WebSocket.OPEN) throw new Error(`Websocket Connection to database server is not open!`);

    const requestId = randomUUID();
    const request = <DatabaseClientRequest<P>>{
      ...Promise.withResolvers<P>(),
      timeout: setTimeout(() => (this.requests.delete(requestId), request.reject(new Error("Request timed out after 60 seconds."))), 60000)
    };

    this.requests.set(requestId, request);
    this.webSocket!.send(JSON.stringify({ ...PL, requestId, path }));
    return request.promise;
  }
}
