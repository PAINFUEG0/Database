/** @format */

import { Parent } from "../parent.js";
import { DatabaseManager } from "../manager.js";

new Parent();

const databaseManager = new DatabaseManager("ws://localhost:8080");

databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));
databaseManager.on("dropped", (...args) => console.log(`Dropped ${args.join(" | ")}`));
databaseManager.on("connected", (address) => console.log(`Connected to ${address}`));
databaseManager.on("error", (err) => console.error(err));

await databaseManager.connect();
console.log("Manager ready !");

const db = databaseManager.createDatabase<string>("./storage");
console.log((await databaseManager.ping()) + "ms");

console.time("WS - set");
for (let i = 0; i < 10000; i++) await db.set(i.toString(), i.toString());
console.timeEnd("WS - set");

console.time("WS - get");
for (let i = 0; i < 10000; i++) await db.get(i.toString());
console.timeEnd("WS - get");

console.time("WS - delete");
for (let i = 0; i < 10000; i++) await db.delete(i.toString());
console.timeEnd("WS - delete");
