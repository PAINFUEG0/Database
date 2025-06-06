/** @format */

import { randomUUID } from "node:crypto";

import type { DatabaseManager } from "./manager.js";
import type { Payload, Response } from "./types.js";

export class Child<T> {
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

    const request = {} as { promise: Promise<D | null>; resolve: (...args: any) => void };

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

  async get(key: string) {
    const requestId = randomUUID();
    const payload: Payload = { requestId, path: this.#path, method: "GET", key };
    return this.#makeRequest<T>(payload);
  }

  async delete(key: string) {
    const requestId = randomUUID();
    const payload: Payload = { requestId, path: this.#path, method: "DELETE", key };
    return this.#makeRequest<null>(payload);
  }

  async set(key: string, value: T) {
    const requestId = randomUUID();
    const _value = JSON.stringify(value);
    const payload: Payload = { requestId, path: this.#path, method: "SET", key, value: _value };
    return this.#makeRequest<T>(payload);
  }
}
