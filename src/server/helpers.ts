/** @format */

import { posix, resolve } from "node:path";
import { databases } from "./databaseServer.js";
import { KeyValueStore as Store } from "./keyValueStore.js";

import type { Protocols } from "../types.js";
import type { IncomingMessage, ServerResponse } from "node:http";

const promises = new Map<string, Promise<boolean>>();

export const actions = {
  ALL: (db) => Promise.resolve(db.all()),

  HAS: (db, PL) => db.has(PL.key),
  HAS_MANY: (db, PL) => db.hasMany(PL.keys),

  GET: (db, PL) => db.get(PL.key),
  GET_MANY: (db, PL) => db.getMany(PL.keys),

  SET: (db, PL) => db.set(PL.key, PL.value),
  SET_MANY: (db, PL) => db.setMany(PL.data),

  DELETE: (db, PL) => db.delete(PL.key),
  DELETE_MANY: (db, PL) => db.deleteMany(PL.keys),

  INIT: async (_, PL) => {
    PL.path = posix.normalize(PL.path.trim().replace(/\\/g, "/")).replace(/[\s/]+$/, "");

    if (PL.path.length > 256)
      throw new Error(`Invalid database path.\nExpected : String <= 256 characters.\nGot : ${PL.path.length} characters.\n`);

    if (posix.isAbsolute(PL.path) || /^[a-zA-Z]:/.test(PL.path))
      throw new Error(`Invalid database path.\nExpected : A relative (non-absolute) path.\nGot : '${PL.path}'.\n`);

    if (PL.path === "" || PL.path === "." || PL.path === ".." || PL.path.startsWith("../"))
      throw new Error(`Invalid database path.\nExpected : A path that resolves within the storage directory.\nGot : '${PL.path}'.\n`);

    const path = resolve("./", "storage", PL.path);
    if (promises.has(path)) return promises.get(path)!;

    const kv = new Store({
      path,
      keysPerFile: PL.options.keysPerFile,
      debounceTime: PL.options.debounceTime,
      maxDebounceCount: PL.options.maxDebounceCount
    });

    const ready = kv.init().then(
      () => (databases.set(PL.path, kv), true),
      (e) => (promises.delete(path), Promise.reject(e))
    );
    promises.set(path, ready);
    return ready;
  }
} satisfies { [K in keyof Protocols]: (db: Store, pl: Protocols[K]["req"] & { path: string }) => Promise<Protocols[K]["res"]> };

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
