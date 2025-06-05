/** @format */

import { Manager } from "./manager.js";
import { randomUUID } from "node:crypto";

import type { Payload, Response } from "./types.js";

export class Child<T> {
  #path: string;
  #manager: Manager;
  #requests = new Map();

  constructor(manager: Manager, path: string) {
    this.#path = path;
    this.#manager = manager;

    manager.webSocket.on("message", (message) => {
      const data = JSON.parse(message.toString()) as Response;
      this.#requests.get(data.requestId)?.resolve(data.data);
      this.#requests.delete(data.requestId);
    });
  }

  async close() {
    return this.#manager.close();
  }

  async reconnect() {
    return this.#manager.reconnect();
  }

  #ensureConnection() {
    if (!this.#manager.isSocketOpen)
      throw new Error(`Connection to ${this.#path} is not not ready / open !`);
    // tbd . . .
  }

  async #makeRequest<D>(requestId: string, payload: Payload) {
    this.#ensureConnection();

    const request = {} as { promise: Promise<D | null>; resolve: (...args: any) => void };

    request.promise = new Promise<D>((resolve) => (request.resolve = resolve));

    this.#requests.set(requestId, request);
    this.#manager.webSocket.send(JSON.stringify(payload));

    setTimeout(() => {
      if (!this.#requests.get(requestId)) return;

      this.#ensureConnection();

      request.resolve(null);
      this.#requests.delete(requestId);
    }, 2500);

    return request.promise;
  }

  async get(key: string) {
    const requestId = randomUUID();
    const payload: Payload = { path: this.#path, method: "GET", key: key, requestId };
    return this.#makeRequest<T>(requestId, payload);
  }

  async delete(key: string) {
    const requestId = randomUUID();
    const payload: Payload = { path: this.#path, method: "DELETE", key: key, requestId };
    return this.#makeRequest<null>(requestId, payload);
  }

  async set(key: string, value: T) {
    const requestId = randomUUID();
    const _value = JSON.stringify(value);
    const payload: Payload = { key, requestId, path: this.#path, method: "SET", value: _value };
    return this.#makeRequest<T>(requestId, payload);
  }
}
