/** @format */

import sourceMapSupport from "source-map-support";
import { DatabaseManager } from "../src/index.js";
import { setTimeout } from "node:timers/promises";

sourceMapSupport.install();

const databaseManager = new DatabaseManager("ws://localhost:8080", "hello");

databaseManager.on("error", (err) => console.error(err));
databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));

await databaseManager.connect();

const db = databaseManager.createDatabase<unknown>("test");

const count = 1e4;

for (let i = 0; i < count; ++i) {
  console.log(await db.set(i.toString(), i));
  await setTimeout(500);
}
