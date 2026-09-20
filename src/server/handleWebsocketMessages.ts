/** @format */

import { resolve } from "path";
import { databases } from "./databaseServer.js";
import { KeyValueStore } from "./keyValueStore.js";

import type { Payload } from "../types.js";
import type { WebSocket, RawData } from "ws";

export async function handleIncomingWebsocketMessages(this: WebSocket, raw: RawData) {
  const PL: Payload = JSON.parse(raw.toString());

  let { path, requestId } = PL;
  const db = databases.get(path)!;

  try {
    // @ts-expect-error loose typings
    const data = await handlers[PL.method](db, PL);
    this.send(JSON.stringify({ requestId, data }));
  } catch (error) {
    error = error instanceof Error ? error.message : error;
    this.send(JSON.stringify({ requestId, error }));
  }
}

const handlers = {
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
