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

  ALL: async (db: KeyValueStore<any>) => await db.all(),
  HAS: async (db: KeyValueStore<any>, PL: Payload & { method: "HAS" }) => await db.has(PL.key),
  GET: async (db: KeyValueStore<any>, PL: Payload & { method: "GET" }) => await db.get(PL.key),
  DELETE: async (db: KeyValueStore<any>, PL: Payload & { method: "DELETE" }) => await db.delete(PL.key),
  SET: async (db: KeyValueStore<any>, PL: Payload & { method: "SET" }) => await db.set(PL.key, PL.value),
  GET_MANY: async (db: KeyValueStore<any>, PL: Payload & { method: "GET_MANY" }) => await db.getMany(PL.keys),
  SET_MANY: async (db: KeyValueStore<any>, PL: Payload & { method: "SET_MANY" }) => await db.setMany(PL.data),
  DELETE_MANY: async (db: KeyValueStore<any>, PL: Payload & { method: "DELETE_MANY" }) => await db.deleteMany(PL.keys)
};
