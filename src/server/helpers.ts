/** @format */

import { resolve } from "node:path";
import { databases } from "./databaseServer.js";
import { KeyValueStore as Store } from "./keyValueStore.js";

import type { Protocols } from "../types.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export const actions = {
  INIT: async (_, PL) => {
    if (databases.get(PL.path)) return false;
    const kv = new Store({ path: resolve("./", "storage", PL.path), ...PL.options });
    databases.set(PL.path, await kv.init());
    return true;
  },

  ALL: (db) => Promise.resolve(db.all()),

  HAS: (db, PL) => db.has(PL.key),
  HAS_MANY: (db, PL) => db.hasMany(PL.keys),

  GET: (db, PL) => db.get(PL.key),
  GET_MANY: (db, PL) => db.getMany(PL.keys),

  SET: (db, PL) => db.set(PL.key, PL.value),
  SET_MANY: (db, PL) => db.setMany(PL.data),

  DELETE: (db, PL) => db.delete(PL.key),
  DELETE_MANY: (db, PL) => db.deleteMany(PL.keys)
} satisfies {
  [K in keyof Protocols]: (db: Store, pl: Protocols[K]["req"] & { path: string }) => Promise<Protocols[K]["res"]>;
};

export function getBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function cors(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}
