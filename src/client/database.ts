/** @format */

import { randomUUID } from "node:crypto";

import type { DatabaseManager } from "./databaseManager.js";
import { Payload } from "../typings/types.js";

export class Database<T> {
  path: string;
  manager: DatabaseManager;

  constructor(manager: DatabaseManager, path: string) {
    this.path = path;
    this.manager = manager;
  }

  async #makeReq<D>(payload: Payload) {
    if (this.manager.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error("Websocket connection has already been closed !");

    const request = {} as {
      promise: Promise<D | null>;
      reject: (err?: Error) => void;
      resolve: (args: D | null) => void;
    };

    request.promise = new Promise<D | null>((resolve, reject) => {
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

  async all() {
    return await this.#makeReq<T | null>({ requestId: randomUUID(), path: this.path, method: "ALL" });
  }

  async set(key: string, value: T) {
    return this.#makeReq<T>({ requestId: randomUUID(), path: this.path, method: "SET", key, value: value });
  }

  async has(key: string) {
    return !!(await this.#makeReq<T | null>({ requestId: randomUUID(), path: this.path, method: "GET", key }));
  }
}
