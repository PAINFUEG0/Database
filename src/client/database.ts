/** @format */

import { randomUUID } from "node:crypto";

import type { DatabaseManager } from "./databaseManager.js";
import type { Payload, Response } from "../typings/types.js";

export class Database<T> {
  #path: string;
  #requests = new Map();
  #manager: DatabaseManager;

  constructor(manager: DatabaseManager, path: string) {
    this.#path = path;
    this.#manager = manager;

    manager.webSocket!.on("message", (message) => {
      const data = JSON.parse(message.toString()) as Response;
      this.#requests.get(data.requestId)?.resolve(data.data);
      this.#requests.delete(data.requestId);
    });
  }

  async #makeReq<D>(payload: Payload) {
    if (!this.#manager.isSocketOpen)
      return void this.#manager.emit("dropped", ...[this.#path, JSON.stringify(payload), "Socket is not open"]);

    const request = {} as { promise: Promise<D | null>; resolve: (args: D | null) => void };
    request.promise = new Promise<D | null>((resolve) => (request.resolve = resolve));
    this.#requests.set(payload.requestId, request);
    this.#manager.webSocket!.send(JSON.stringify(payload));

    setTimeout(() => {
      if (!this.#requests.get(payload.requestId)) return;
      request.resolve(null);
      this.#requests.delete(payload.requestId);
    }, 2500);

    return request.promise;
  }

  async delete(key: string) {
    return this.#makeReq<null>({ requestId: randomUUID(), path: this.#path, method: "DELETE", key });
  }
  async get(key: string) {
    return this.#makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "GET", key });
  }
  async all() {
    return await this.#makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "ALL" });
  }
  async set(key: string, value: T) {
    return this.#makeReq<T>({ requestId: randomUUID(), path: this.#path, method: "SET", key, value: value });
  }
  async has(key: string) {
    return !!(await this.#makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "GET", key }));
  }
}
