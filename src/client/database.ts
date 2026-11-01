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

  all = async () => this.#makeRequest({ method: "ALL" });
  has = async (key: string) => this.#makeRequest({ method: "HAS", key });
  get = async (key: string) => this.#makeRequest({ method: "GET", key });
  delete = async (key: string) => this.#makeRequest({ method: "DELETE", key });
  hasMany = async (keys: string[]) => this.#makeRequest({ method: "HAS_MANY", keys });
  getMany = async (keys: string[]) => this.#makeRequest({ method: "GET_MANY", keys });
  deleteMany = async (keys: string[]) => this.#makeRequest({ method: "DELETE_MANY", keys });
  set = async (key: string, value: T) => this.#makeRequest({ method: "SET", key, value: this.#schema ? ((await this.#schema?.parseAsync(value)) as T) : value });
  setMany = async (data: { key: string; value: T }[]) =>
    this.#makeRequest({ method: "SET_MANY", data: this.#schema ? await Promise.all(data.map(async ({ key, value }) => ({ key, value: (await this.#schema?.parseAsync(value)) as T }))) : data });

  pop = (async (key) => this.#makeRequest({ method: "POP", key })) as Methods<T>["POP"];
  shift = (async (key) => this.#makeRequest({ method: "SHIFT", key })) as Methods<T>["SHIFT"];
  length = (async (key) => this.#makeRequest({ method: "LENGTH", key })) as Methods<T>["LENGTH"];
  slice = (async (key, start, end) => this.#makeRequest({ method: "SLICE", key, start, end })) as Methods<T>["SLICE"];
  push = (async (key, ...items) => (await this.#schema?.parseAsync(items), this.#makeRequest({ method: "PUSH", key, items }))) as Methods<T>["PUSH"];
  unshift = (async (key, ...items) => (await this.#schema?.parseAsync(items), this.#makeRequest({ method: "UNSHIFT", key, items }))) as Methods<T>["UNSHIFT"];
  splice = (async (key, start, deleteCount, ...items) => (
    items && (await this.#schema?.parseAsync(items)),
    this.#makeRequest({ method: "SPLICE", key, start, deleteCount, items })
  )) as Methods<T>["SPLICE"];

  toggle = (async (key) => this.#makeRequest({ method: "TOGGLE", key })) as Methods<T>["TOGGLE"];

  increment = (async (key, count) => this.#makeRequest({ method: "INCREMENT", key, count })) as Methods<T>["INCREMENT"];
  decrement = (async (key, count) => this.#makeRequest({ method: "DECREMENT", key, count })) as Methods<T>["DECREMENT"];
}
