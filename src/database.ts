/** @format */

import { randomUUID } from "node:crypto";

import type { DatabaseManager } from "./databaseManager.js";
import type { Payload, Response } from "./typings/types.js";

export class Database<T> {
  #path: string;
  #manager: DatabaseManager;
  #requests = new Map();

  constructor(manager: DatabaseManager, path: string) {
    this.#path = path;
    this.#manager = manager;

    manager.webSocket.on("message", (message) => {
      const data = JSON.parse(message.toString()) as Response;
      this.#requests.get(data.requestId)?.resolve(data.data);
      this.#requests.delete(data.requestId);
    });
  }

  async #makeRequest<D>(payload: Payload) {
    if (!this.#manager.isSocketOpen) {
      this.#manager.emit("dropped", ...[this.#path, JSON.stringify(payload), "Socket is not open"]);
      return null;
    }

    const request = {} as { promise: Promise<D>; resolve: (...args: any) => void };

    request.promise = new Promise<D>((resolve) => (request.resolve = resolve));

    this.#requests.set(payload.requestId, request);
    this.#manager.webSocket.send(JSON.stringify(payload));

    setTimeout(() => {
      if (!this.#requests.get(payload.requestId)) return;
      request.resolve(null);
      this.#requests.delete(payload.requestId);
    }, 2500);

    return request.promise;
  }

  async all() {
    return await this.#makeRequest<T | null>({
      requestId: randomUUID(),
      path: this.#path,
      method: "ALL"
    });
  }

  async has(key: string) {
    return !!(await this.#makeRequest<T | null>({
      requestId: randomUUID(),
      path: this.#path,
      method: "GET",
      key
    }));
  }

  async get(key: string) {
    return this.#makeRequest<T | null>({
      requestId: randomUUID(),
      path: this.#path,
      method: "GET",
      key
    });
  }

  async delete(key: string) {
    return this.#makeRequest<null>({
      requestId: randomUUID(),
      path: this.#path,
      method: "DELETE",
      key
    });
  }

  async set(key: string, value: T) {
    return this.#makeRequest<T>({
      requestId: randomUUID(),
      path: this.#path,
      method: "SET",
      key,
      value: JSON.stringify(value)
    });
  }
}
