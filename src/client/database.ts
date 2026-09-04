/** @format */

import { randomUUID } from "node:crypto";

import type { z } from "zod";
import type { DatabaseClient } from "./databaseClient.js";
import type { DatabaseClientRequest, PayloadOverloads } from "../types.js";

export class Database<T> {
  path: string;
  #schema?: z.ZodType;
  #reservedWords = ["__proto__", "prototype", "constructor"];

  #manager: DatabaseClient;

  get manager() {
    return this.#manager;
  }

  constructor(manager: DatabaseClient, path: string, schema?: z.ZodType) {
    this.path = path;
    this.#schema = schema;
    this.#manager = manager;
  }

  async #makeReq<D>(PL: PayloadOverloads) {
    if (this.#manager.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Connection to database server is not open yet / closing / closed !`);

    const requestId = randomUUID();
    const request = <DatabaseClientRequest<D>>{ ...Promise.withResolvers<D>() };

    this.#manager.requests.set(requestId, request);
    this.#manager.webSocket!.send(JSON.stringify({ ...PL, requestId, path: this.path }));

    request.timeout = setTimeout(() => {
      this.#manager.requests.delete(requestId);
      request.reject(new Error("Request timed out after 120 seconds."));
    }, 120000);

    return request.promise;
  }

  #validateKeys(key: unknown | unknown[]) {
    const keys = Array.isArray(key) ? key : [key];

    for (let i = 0; i < keys.length; i++) {
      const _ = `Invalid key provided ${keys.length > 1 ? `at keys[${i}]` : ""}\n`;

      const __ = this.#reservedWords.findIndex((word) => keys[i] === word);
      if (__ !== -1) throw new Error(`${_} Reserved word (${this.#reservedWords[__]}) not allowed`);

      if (!keys[i] || typeof keys[i] !== "string" || keys[i].length === 0 || keys[i].length > 255)
        throw new Error(`${_} Expexcted : string literal with length > 0 < 255\nGot : ${key}`);
    }
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
