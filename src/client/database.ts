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

  all = () => this.#makeRequest({ method: "ALL" });
  has = (key: string) => this.#makeRequest({ method: "HAS", key });
  get = (key: string) => this.#makeRequest({ method: "GET", key });
  delete = (key: string) => this.#makeRequest({ method: "DELETE", key });
  hasMany = (keys: string[]) => this.#makeRequest({ method: "HAS_MANY", keys });
  getMany = (keys: string[]) => this.#makeRequest({ method: "GET_MANY", keys });
  deleteMany = (keys: string[]) => this.#makeRequest({ method: "DELETE_MANY", keys });
  set = (key: string, value: T) => (this.#schema?.parse(value), this.#makeRequest({ method: "SET", key, value }));
  setMany = (data: { key: string; value: T }[]) => (data.forEach(({ value }) => this.#schema?.parse(value)), this.#makeRequest({ method: "SET_MANY", data }));

  pop = ((key) => this.#makeRequest({ method: "POP", key })) as Methods<T>["POP"];
  shift = ((key) => this.#makeRequest({ method: "SHIFT", key })) as Methods<T>["SHIFT"];
  length = ((key) => this.#makeRequest({ method: "LENGTH", key })) as Methods<T>["LENGTH"];
  slice = ((key, start, end) => this.#makeRequest({ method: "SLICE", key, start, end })) as Methods<T>["SLICE"];
  push = ((key, ...items) => (this.#schema?.parse(items), this.#makeRequest({ method: "PUSH", key, items }))) as Methods<T>["PUSH"];
  unshift = ((key, ...items) => (this.#schema?.parse(items), this.#makeRequest({ method: "UNSHIFT", key, items }))) as Methods<T>["UNSHIFT"];
  splice = ((key, start, deleteCount, ...items) => (items && this.#schema?.parse(items), this.#makeRequest({ method: "SPLICE", key, start, deleteCount, items }))) as Methods<T>["SPLICE"];

  toggle = ((key) => this.#makeRequest({ method: "TOGGLE", key })) as Methods<T>["TOGGLE"];

  increment = ((key, count) => this.#makeRequest({ method: "INCREMENT", key, count })) as Methods<T>["INCREMENT"];
  decrement = ((key, count) => this.#makeRequest({ method: "DECREMENT", key, count })) as Methods<T>["DECREMENT"];
}
