/** @format */

import { z } from "zod";
import { WebSocket } from "ws";
import { posix } from "node:path";
import { once } from "node:events";
import { Database } from "./database.js";
import { randomUUID } from "node:crypto";

import type { RequestMode, DatabaseClientRequest, DatabaseClientOptions, DatabaseServerResponse, Protocols } from "../types.js";

export class DatabaseClient {
  #address: string;
  #mode: RequestMode;
  #passphrase: string;
  #webSocket?: WebSocket;
  #paths = new Set<string>();
  #requests = new Map<string, DatabaseClientRequest<any>>();

  #throwOnError = true;
  #throwOnDisconnect = true;

  #onError: (err: Error) => void;
  #onDisconnect: (address: string) => void;

  constructor(options: DatabaseClientOptions) {
    z.object({
      port: z.number({ error: "Option 'port' must be a number" }),
      passphrase: z.string({ error: "Option 'passphrase' must be a string" }),
      secure: z.boolean({ error: "Option 'secure' must be a boolean" }).optional(),
      throwOnError: z.boolean({ error: "Option 'throwOnError' must be a boolean" }).optional(),
      mode: z.enum(["ws", "rest"], { error: "Option 'mode' must be either 'ws' or 'rest'" }).optional(),
      throwOnDisconnect: z.boolean({ error: "Option 'throwOnDisconnect' must be a boolean" }).optional(),
      onError: z.custom((v) => typeof v === "function", { error: "Option 'onError' must be a function" }).optional(),
      onDisconnect: z.custom((v) => typeof v === "function", { error: "Option 'onDisconnect' must be a function" }).optional(),
      host: z
        .string({ error: "Option 'host' must be a string" })
        .refine((host) => !/^https?:\/\//.test(host), { error: "Option 'host' must not contain a protocol, e.g., 'http://' or 'https://'" })
    }).parse(options);

    this.#mode = options.mode ?? "ws";
    this.#passphrase = options.passphrase;

    this.#onError = options.onError ?? console.error;
    this.#throwOnError = options.throwOnError ?? !options.onError;
    this.#throwOnDisconnect = options.throwOnDisconnect ?? !options.onDisconnect;
    this.#onDisconnect = options.onDisconnect ?? console.error.bind(console, "Client disconnected ! Address : ");

    this.#address = `${this.#mode === "ws" ? "ws" : "http"}${options.secure ? "s" : ""}://${options.host}:${options.port}/${this.#mode}`;
  }

  async connect() {
    if (this.#mode !== "ws") return;

    this.#webSocket = new WebSocket(this.#address, { headers: { Authorization: this.#passphrase } });

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
      this.#requests.forEach((request) => (clearTimeout(request.timeout), request.reject(new Error("Database server disconnected !"))));
      this.#requests.clear();
      if (this.#throwOnDisconnect) throw new Error(`Database server disconnected ! Address : ${this.#address}`);
      else this.#onDisconnect(this.#address);
    });
  }

  createDatabase<T = unknown>(path: string): Promise<Database<T>>;

  createDatabase<T = unknown>(path: string, op: { debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }): Promise<Database<T>>;

  createDatabase<T extends z.ZodType>(
    path: string,
    op: { schema: T; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }
  ): Promise<Database<z.infer<T>>>;

  async createDatabase(path: string, op?: { schema?: z.ZodType; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }) {
    path = posix.normalize(path.trim().replace(/\\/g, "/")).replace(/[\s/]+$/, "");

    if (this.#paths.has(path)) throw new Error(`Duplicate database path.\nExpected : A path that does not already exist.\nGot : '${path}'.\n`);

    if (this.#mode == "ws" && this.#webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Invalid operation.\nExpected : WebSocket connection to be open.\nGot : WebSocket is not connected.\n`);

    const requestMaker = this.#mode === "ws" ? this.#sendWSmessage.bind(this, path) : this.#sendRestRequest.bind(this, path);

    this.#paths.add(path);
    return await new Database(requestMaker as any, op?.schema)
      .init({ debounceTime: op?.debounceTime, maxDebounceCount: op?.maxDebounceCount, keysPerFile: op?.keysPerFile })
      .catch((e) => {
        this.#paths.delete(path);
        throw e;
      });
  }

  async #sendRestRequest<P>(path: string, PL: Protocols<P>[keyof Protocols<P>]["req"]): Promise<P> {
    return fetch(this.#address, {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({ ...PL, path }),
      headers: { "Content-Type": "application/json", Authorization: this.#passphrase }
    }).then(async (raw) => {
      const res = await (<Promise<DatabaseServerResponse<P>>>raw.json());
      if ("error" in res) throw new Error(res.error);
      return res.data;
    });
  }

  async #sendWSmessage<P>(path: string, PL: Protocols<P>[keyof Protocols<P>]["req"]): Promise<P> {
    if (this.#webSocket?.readyState !== WebSocket.OPEN) throw new Error(`Websocket Connection to database server is not open!`);

    const requestId = randomUUID();
    const request = <DatabaseClientRequest<P>>{
      ...Promise.withResolvers<P>(),
      timeout: setTimeout(() => (this.#requests.delete(requestId), request.reject(new Error("Request timed out after 60 seconds."))), 60000)
    };

    this.#requests.set(requestId, request);
    this.#webSocket!.send(JSON.stringify({ ...PL, requestId, path }));
    return request.promise;
  }
}
