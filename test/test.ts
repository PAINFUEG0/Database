/** @format */

import sourceMapSupport from "source-map-support";
import { DatabaseManager } from "../src/index.js";
import { setTimeout } from "node:timers/promises";

sourceMapSupport.install();

const databaseManager = new DatabaseManager("ws://localhost:8080", "hello");

databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));
// databaseManager.on("dropped", (...args) => console.log(`Dropped ${args.join(" | ")}`));
databaseManager.on("connected", (address) => console.log(`Connected to ${address}`));
// databaseManager.on("error", (err) => console.error(err));

await databaseManager.connect();
console.log("Manager ready !");

const db = databaseManager.createDatabase<unknown>("test");

console.log(`Websocket ping is ${await databaseManager.ping()} ms`);
console.log(`Websocket ping is ${await databaseManager.ping()} ms`);
console.log(`Websocket ping is ${await databaseManager.ping()} ms`);

const count = 1e4;

for (let i = 0; i < count; ++i) {
  console.log(await db.set(i.toString(), i));
  await setTimeout(500);
}
