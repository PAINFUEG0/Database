/** @format */

import { z } from "zod";
import type { SpecialMethods, Protocols } from "./types.js";

export class Database<T> {
  #schema?: z.ZodType;
  #initialized = false;
  #makeRequest: <P extends Protocols<T>[keyof Protocols<T>]["req"]>(PL: P) => Promise<Protocols<T>[keyof Protocols<T> & P["method"]]["res"]>;

  constructor(payloadSenderFunction: <D>(PL: Protocols<D>[keyof Protocols<D>]["req"]) => Promise<D>, schema?: z.ZodType) {
    this.#schema = schema;
    this.#makeRequest = payloadSenderFunction;
  }

  init = async (options: Protocols<T>["INIT"]["req"]["options"] = {}) => {
    if (this.#initialized) return this;
    await this.#makeRequest({ method: "INIT", options, schema: this.#schema?.toJSONSchema() });
    this.#initialized = true;
    return this;
  };

  all = async () => this.#makeRequest({ method: "ALL" });

  has = async (key: string) => this.#makeRequest({ method: "HAS", key });
  hasMany = async (keys: string[]) => this.#makeRequest({ method: "HAS_MANY", keys });

  get = async (key: string) => this.#makeRequest({ method: "GET", key });
  getMany = async (keys: string[]) => this.#makeRequest({ method: "GET_MANY", keys });

  delete = async (key: string) => this.#makeRequest({ method: "DELETE", key });
  deleteMany = async (keys: string[]) => this.#makeRequest({ method: "DELETE_MANY", keys });

  set = async (key: string, value: T) => this.#makeRequest({ method: "SET", key, value });
  setMany = async (data: { key: string; value: T }[]) => this.#makeRequest({ method: "SET_MANY", data });

  pop = (async (key) => this.#makeRequest({ method: "POP", key })) as SpecialMethods<T>["POP"];
  shift = (async (key) => this.#makeRequest({ method: "SHIFT", key })) as SpecialMethods<T>["SHIFT"];

  length = (async (key) => this.#makeRequest({ method: "LENGTH", key })) as SpecialMethods<T>["LENGTH"];
  slice = (async (key, start, end) => this.#makeRequest({ method: "SLICE", key, start, end })) as SpecialMethods<T>["SLICE"];

  push = (async (key, ...items) => this.#makeRequest({ method: "PUSH", key, items })) as SpecialMethods<T>["PUSH"];
  unshift = (async (key, ...items) => this.#makeRequest({ method: "UNSHIFT", key, items })) as SpecialMethods<T>["UNSHIFT"];

  splice = (async (key, start, deleteCount, ...items) =>
    this.#makeRequest({ method: "SPLICE", key, start, deleteCount, items })) as SpecialMethods<T>["SPLICE"];

  toggle = (async (key) => this.#makeRequest({ method: "TOGGLE", key })) as SpecialMethods<T>["TOGGLE"];

  increment = (async (key, count) => this.#makeRequest({ method: "INCREMENT", key, count })) as SpecialMethods<T>["INCREMENT"];
  decrement = (async (key, count) => this.#makeRequest({ method: "DECREMENT", key, count })) as SpecialMethods<T>["DECREMENT"];
}
