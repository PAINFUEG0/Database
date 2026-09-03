/** @format */

import { resolve } from "path";
import { Database } from "./database";

import type { Payload } from "./types";
import type { WebSocket, RawData } from "ws";

const databases = new Map<string, Database<any>>();

export function handleIncomingWebsocketMessage(this: WebSocket, data: RawData) {
  const PL: Payload = JSON.parse(data.toString());

  let { path, requestId } = PL;
  path = resolve("./", "storage", path);

  const db = databases.get(path) || databases.set(PL.path, new Database(path)).get(path)!;

  try {
    //@ts-expect-error loose typings
    const data = handlers[PL.method](db, PL);
    this.send(JSON.stringify({ requestId, data }));
  } catch (error) {
    this.send(JSON.stringify({ requestId, error }));
  }
}

const handlers = {
  ALL: (db: Database<any>) => db.all(),
  HAS: (db: Database<any>, PL: Payload & { method: "HAS" }) => db.has(PL.key),
  GET: (db: Database<any>, PL: Payload & { method: "GET" }) => db.get(PL.key),
  DELETE: (db: Database<any>, PL: Payload & { method: "DELETE" }) => db.delete(PL.key),
  SET: (db: Database<any>, PL: Payload & { method: "SET" }) => db.set(PL.key, PL.value),
  GET_MANY: (db: Database<any>, PL: Payload & { method: "GET_MANY" }) => db.getMany(PL.keys),
  SET_MANY: (db: Database<any>, PL: Payload & { method: "SET_MANY" }) => db.setMany(PL.data),
  DELETE_MANY: (db: Database<any>, PL: Payload & { method: "DELETE_MANY" }) => db.deleteMany(PL.keys)
};
