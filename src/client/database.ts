/** @format */

import { z } from "zod";
import type { Protocols } from "../types";

export class Database<T> {
  #schema?: z.ZodType;
  #initialized = false;
  #reservedWords = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);
  #makeRequest: <P extends Protocols<T>[keyof Protocols<T>]["req"]>(
    PL: P
  ) => Promise<Protocols<T>[keyof Protocols<T> & P["method"]]["res"]>;

  constructor(payloadSenderFunction: <D>(PL: Protocols<D>[keyof Protocols<D>]["req"]) => Promise<D>, schema?: z.ZodType) {
    this.#schema = schema;
    this.#makeRequest = payloadSenderFunction;
  }

  async init(options: Protocols<T>["INIT"]["req"]["options"] = {}) {
    if (this.#initialized) return this;
    await this.#makeRequest({ method: "INIT", options });
    this.#initialized = true;
    return this;
  }

  async all() {
    return this.#makeRequest({ method: "ALL" });
  }

  async has(key: string) {
    this.#validateKeys(key);
    return this.#makeRequest({ method: "HAS", key });
  }

  async hasMany(keys: string[]) {
    this.#validateKeys(keys);
    return this.#makeRequest({ method: "HAS_MANY", keys });
  }

  async get(key: string) {
    this.#validateKeys(key);
    return this.#makeRequest({ method: "GET", key });
  }

  async getMany(keys: string[]) {
    this.#validateKeys(keys);
    return this.#makeRequest({ method: "GET_MANY", keys });
  }

  async set(key: string, value: T) {
    this.#validateKeys(key);
    this.#schema && (await this.#schema.parseAsync(value));
    return this.#makeRequest({ method: "SET", key, value });
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
    return this.#makeRequest({ method: "SET_MANY", data });
  }

  async delete(key: string) {
    this.#validateKeys(key);
    return this.#makeRequest({ method: "DELETE", key });
  }

  async deleteMany(keys: string[]) {
    this.#validateKeys(keys);
    return this.#makeRequest({ method: "DELETE_MANY", keys });
  }

  #validateKeys(key: unknown | unknown[]) {
    const keys = Array.isArray(key) ? key : [key];

    for (let i = 0; i < keys.length; i++) {
      const _ = `Invalid key provided ${keys.length > 1 ? `at keys[${i}]` : ""}\n`;

      if (this.#reservedWords.has(keys[i])) throw new Error(`${_} Reserved word (${keys[i]}) not allowed`);

      if (!keys[i] || typeof keys[i] !== "string" || keys[i].length === 0 || keys[i].length > 255)
        throw new Error(`${_} Expexcted : string literal with length > 0 < 255\nGot : ${key}`);
    }
  }
}
