/** @format */

import { resolve } from "path";
import { KeyValueStore } from "../store.js";
import { databases } from "../databaseServer.js";

import type { Payload } from "../types";
import type { WebSocket, RawData } from "ws";

export async function handleIncomingWebsocketMessages(this: WebSocket, data: RawData) {
  const PL: Payload = JSON.parse(data.toString());

  let { path, requestId } = PL;
  path = resolve("./", "storage", path);

  const db = databases.get(path) || databases.set(path, new KeyValueStore(path)).get(path)!;

  try {
    //@ts-expect-error loose typings
    const data = await handlers[PL.method](db, PL);
    this.send(JSON.stringify({ requestId, data }));
  } catch (error) {
    error = error instanceof Error ? error.message : error;
    this.send(JSON.stringify({ requestId, error }));
  }
}

const handlers = {
  ALL: (db: KeyValueStore<any>) => db.all(),
  HAS: (db: KeyValueStore<any>, PL: Payload & { method: "HAS" }) => db.has(PL.key),
  GET: (db: KeyValueStore<any>, PL: Payload & { method: "GET" }) => db.get(PL.key),
  DELETE: (db: KeyValueStore<any>, PL: Payload & { method: "DELETE" }) => db.delete(PL.key),
  SET: (db: KeyValueStore<any>, PL: Payload & { method: "SET" }) => db.set(PL.key, PL.value),
  GET_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "GET_MANY" }) => db.getMany(PL.keys),
  SET_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "SET_MANY" }) => db.setMany(PL.data),
  DELETE_MANY: (db: KeyValueStore<any>, PL: Payload & { method: "DELETE_MANY" }) => db.deleteMany(PL.keys)
};
