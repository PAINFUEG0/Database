/** @format */

import { randomUUID } from "node:crypto";

import type { ZodTypeAny } from "zod";
import type { Payload } from "../typings/types.js";
import type { DatabaseManager } from "./databaseManager.js";

export class Database<T> {
  path: string;
  #schema?: ZodTypeAny;
  manager: DatabaseManager;

  constructor(manager: DatabaseManager, path: string, schema?: ZodTypeAny) {
    this.path = path;
    this.#schema = schema;
    this.manager = manager;
  }

  async #makeReq<D>(payload: Payload) {
    if (this.manager.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error("Websocket connection has already been closed !");

    const request = {} as {
      promise: Promise<D>;
      reject: (err?: Error) => void;
      resolve: (args: D) => void;
    };

    request.promise = new Promise<D>((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    this.manager.requests.set(payload.requestId, request);
    this.manager.webSocket!.send(JSON.stringify(payload));

    setTimeout(() => {
      if (!this.manager.requests.get(payload.requestId)) return;
      request.reject(new Error("Request timed out"));
      this.manager.requests.delete(payload.requestId);
    }, 2500);

    return request.promise;
  }

  async delete(key: string) {
    return this.#makeReq<null>({ requestId: randomUUID(), path: this.path, method: "DELETE", key });
  }

  async get(key: string) {
    return this.#makeReq<T | null>({ requestId: randomUUID(), path: this.path, method: "GET", key });
  }

  async set(key: string, value: T) {
    if (this.#schema) {
      const parse = this.#schema?.safeParse(value);
      if (!parse.success) throw new Error(JSON.stringify(parse.error, null, 2));
    }

    return this.#makeReq<T>({ requestId: randomUUID(), path: this.path, method: "SET", key, value: value });
  }

  async has(key: string) {
    return !!(await this.#makeReq<T | null>({ requestId: randomUUID(), path: this.path, method: "GET", key }));
  }

  async all() {
    return await this.#makeReq<{ [key: string]: T }>({ requestId: randomUUID(), path: this.path, method: "ALL" });
  }
}
