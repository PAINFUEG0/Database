/** @format */

import { z } from "zod";
import type { Protocols } from "../types";

export class Database<T> {
  #schema?: z.ZodType;
  #initialized = false;
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
    return this.#makeRequest({ method: "HAS", key });
  }

  async hasMany(keys: string[]) {
    return this.#makeRequest({ method: "HAS_MANY", keys });
  }

  async get(key: string) {
    return this.#makeRequest({ method: "GET", key });
  }

  async getMany(keys: string[]) {
    return this.#makeRequest({ method: "GET_MANY", keys });
  }

  async set(key: string, value: T) {
    this.#schema && (await this.#schema.parseAsync(value));
    return this.#makeRequest({ method: "SET", key, value });
  }

  async setMany(data: { key: string; value: T }[]) {
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
    return this.#makeRequest({ method: "DELETE", key });
  }

  async deleteMany(keys: string[]) {
    return this.#makeRequest({ method: "DELETE_MANY", keys });
  }
}
