/** @format */

import { z } from "zod";
import type { Methods, Protocols } from "../types";

export class Database<T> {
  #schema?: z.ZodType;
  #initialized = false;
  #makeRequest: <P extends Protocols<T>[keyof Protocols<T>]["req"]>(PL: P) => Promise<Protocols<T>[keyof Protocols<T> & P["method"]]["res"]>;

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

  async get(key: string) {
    return this.#makeRequest({ method: "GET", key });
  }

  async delete(key: string) {
    return this.#makeRequest({ method: "DELETE", key });
  }

  async hasMany(keys: string[]) {
    return this.#makeRequest({ method: "HAS_MANY", keys });
  }

  async getMany(keys: string[]) {
    return this.#makeRequest({ method: "GET_MANY", keys });
  }

  async deleteMany(keys: string[]) {
    return this.#makeRequest({ method: "DELETE_MANY", keys });
  }

  async set(key: string, value: T) {
    if (["symbol", "bigint", "function"].includes(typeof value)) throw `Can't serialize data of type '${typeof value}' for storage`;
    value = this.#schema ? ((await this.#schema?.parseAsync(value)) as T) : value;
    return this.#makeRequest({ method: "SET", key, value });
  }

  async setMany(data: { key: string; value: T }[]) {
    data = await Promise.all(
      data.map(async ({ key, value }) => {
        if (["symbol", "bigint", "function"].includes(typeof value)) throw `Can't serialize data of type '${typeof value}' for storage`;
        value = this.#schema ? ((await this.#schema?.parseAsync(value)) as T) : value;
        return { key, value };
      })
    );
    return this.#makeRequest({ method: "SET_MANY", data });
  }

  pop = (async (key) => {
    return this.#makeRequest({ method: "POP", key });
  }) as Methods<T>["POP"];

  shift = (async (key) => {
    return this.#makeRequest({ method: "SHIFT", key });
  }) as Methods<T>["SHIFT"];

  length = (async (key) => {
    return this.#makeRequest({ method: "LENGTH", key });
  }) as Methods<T>["LENGTH"];

  slice = (async (key, start, end) => {
    return this.#makeRequest({ method: "SLICE", key, start, end });
  }) as Methods<T>["SLICE"];

  push = (async (key, ...items) => {
    await this.#schema?.parseAsync(items);
    return this.#makeRequest({ method: "PUSH", key, items });
  }) as Methods<T>["PUSH"];

  unshift = (async (key, ...items) => {
    await this.#schema?.parseAsync(items);
    return this.#makeRequest({ method: "UNSHIFT", key, items });
  }) as Methods<T>["UNSHIFT"];

  splice = (async (key, start, deleteCount, ...items) => {
    items && (await this.#schema?.parseAsync(items));
    return this.#makeRequest({ method: "SPLICE", key, start, deleteCount, items });
  }) as Methods<T>["SPLICE"];

  toggle = (async (key) => {
    return this.#makeRequest({ method: "TOGGLE", key });
  }) as Methods<T>["TOGGLE"];

  increment = (async (key, count) => {
    return this.#makeRequest({ method: "INCREMENT", key, count });
  }) as Methods<T>["INCREMENT"];

  decrement = (async (key, count) => {
    return this.#makeRequest({ method: "DECREMENT", key, count });
  }) as Methods<T>["DECREMENT"];
}
