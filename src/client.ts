/** @format */

import { randomUUID } from "node:crypto";

import { type z } from "zod";
import type { DatabaseManager } from "./manager.js";
import type { DatabaseClientRequest, PayloadOverloads } from "./types.js";

export class DatabaseClient<T> {
  path: string;
  #schema?: z.ZodType;
  manager: DatabaseManager;

  constructor(manager: DatabaseManager, path: string, schema?: z.ZodType) {
    this.path = path;
    this.#schema = schema;
    this.manager = manager;
  }

  async #makeReq<D>(PL: PayloadOverloads) {
    const requestId = randomUUID();
    const request = <DatabaseClientRequest<D>>{ ...Promise.withResolvers<D>() };

    this.manager.requests.set(requestId, request);
    this.manager.webSocket!.send(JSON.stringify({ ...PL, requestId, path: this.path }));

    request.timeout = setTimeout(() => {
      this.manager.requests.delete(requestId);
      request.reject(new Error("Request timed out after 120 seconds."));
    }, 120000);

    return request.promise;
  }

  #validateKeys(key: unknown | unknown[]) {
    const keys = Array.isArray(key) ? key : [key];

    for (let i = 0; i < keys.length; i++)
      if (!keys[i] || typeof keys[i] !== "string" || keys[i].length === 0 || keys[i].length > 255)
        throw new Error(
          `Invalid key provided ${keys.length > 1 ? `at keys[${i}]` : ""}\nExpexcted : string literal with length > 0 < 255\nGot : ${key}`
        );
  }

  async all() {
    return this.#makeReq<{ [key: string]: T }>({ method: "ALL" });
  }

  async has(key: string) {
    this.#validateKeys(key);
    return this.#makeReq<boolean>({ method: "HAS", key });
  }

  async get(key: string) {
    this.#validateKeys(key);
    return this.#makeReq<T | null>({ method: "GET", key });
  }

  async delete(key: string) {
    this.#validateKeys(key);
    return this.#makeReq<boolean>({ method: "DELETE", key });
  }

  async set(key: string, value: T) {
    this.#validateKeys(key);
    this.#schema && (await this.#schema.parseAsync(value));
    return this.#makeReq<T>({ method: "SET", key, value });
  }

  async deleteMany(keys: string[]) {
    this.#validateKeys(keys);
    return this.#makeReq<boolean[]>({ method: "DELETE_MANY", keys });
  }

  async getMany(keys: string[]) {
    this.#validateKeys(keys);
    return this.#makeReq<(T | null)[]>({ method: "GET_MANY", keys });
  }

  async setMany(data: { key: string; value: T }[]) {
    this.#validateKeys(data.map(({ key }) => key));
    this.#schema &&
      (await Promise.all(
        data.map(({ key, value }, i) =>
          this.#schema!.parseAsync(value).catch((err) => {
            throw new Error(`Invalid value provided for key: ${key} @ index ${i}.\nError:\n${err.message}`);
          })
        )
      ));
    return this.#makeReq<T[]>({ method: "SET_MANY", data });
  }
}
