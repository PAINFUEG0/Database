/** @format */

import { DatabaseServer, DatabaseManager } from "./index.js";

new DatabaseServer({ port: 1000, auth: "secret" });

const manager = new DatabaseManager({ url: "localhost", port: 1000, auth: "secret" });

await manager.connect();

const db = manager.createDatabase("test");

console.log(await db.all());

console.log(await db.set("test", "test"));

console.log(await db.get("test"));

console.log(await db.delete("test"));

console.log(await db.has("test"));
