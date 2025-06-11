/** @format */

import { randomUUID } from "node:crypto";

import type { DatabaseManager } from "./databaseManager.js";

export class Database<T> {
  #path: string;
  #manager: DatabaseManager;

  constructor(manager: DatabaseManager, path: string) {
    this.#path = path;
    this.#manager = manager;
  }

  async delete(key: string) {
    return this.#manager.makeReq<null>({ requestId: randomUUID(), path: this.#path, method: "DELETE", key });
  }
  async get(key: string) {
    return this.#manager.makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "GET", key });
  }
  async all() {
    return await this.#manager.makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "ALL" });
  }
  async set(key: string, value: T) {
    return this.#manager.makeReq<T>({ requestId: randomUUID(), path: this.#path, method: "SET", key, value: value });
  }
  async has(key: string) {
    return !!(await this.#manager.makeReq<T | null>({ requestId: randomUUID(), path: this.#path, method: "GET", key }));
  }
}
