/** @format */

import { resolve } from "node:path";
import { databases } from "./databaseServer.js";
import { KeyValueStore } from "./keyValueStore.js";

import type { Payload } from "../types";

export const actions = {
  PATHS: () => databases.keys().toArray(),

  INIT: async (_: any, pl: Payload & { method: "INIT" }) =>
    databases.set(pl.path, await new KeyValueStore({ path: resolve("./", "storage", pl.path), ...pl.options }).init()),

  ALL: (db: KeyValueStore<any>) => db.all(),
  HAS: (db: KeyValueStore<any>, PL: Payload & { method: "HAS" }) => db.has(PL.key),
  GET: (db: KeyValueStore<any>, PL: Payload & { method: "GET" }) => db.get(PL.key),
  DELETE: (db: KeyValueStore<any>, PL: Payload & { method: "DELETE" }) => db.delete(PL.key),
  SET: (db: KeyValueStore<any>, PL: Payload & { method: "SET" }) => db.set(PL.key, PL.value),
  GET_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "GET_MANY" }) => db.getMany(PL.keys),
  SET_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "SET_MANY" }) => db.setMany(PL.data),
  DELETE_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "DELETE_MANY" }) => db.deleteMany(PL.keys)
};
