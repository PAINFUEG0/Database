/** @format */

import sourceMapSupport from "source-map-support";
import { DatabaseServer, DatabaseManager } from "../src/index.js";

sourceMapSupport.install();

new DatabaseServer();

const databaseManager = new DatabaseManager("ws://localhost:8080");

databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));
databaseManager.on("dropped", (...args) => console.log(`Dropped ${args.join(" | ")}`));
databaseManager.on("connected", (address) => console.log(`Connected to ${address}`));
databaseManager.on("error", (err) => console.error(err));

await databaseManager.connect();
console.log("Manager ready !");

const db = databaseManager.createDatabase<unknown>("test");

console.log(`Websocket ping is ${await databaseManager.ping()} ms`);
console.log(`Websocket ping is ${await databaseManager.ping()} ms`);
console.log(`Websocket ping is ${await databaseManager.ping()} ms`);

const count = 1e4;

let diff: [number, number];
let start: [number, number];

start = process.hrtime();
for (let i = 0; i < count; i++) await db.delete(i.toString());
diff = process.hrtime(start);
const timeTakenForDelete = diff[0] * 1000 + diff[1] / 1e6;
console.log(
  `[ DELETE ] - ${count} keys in : ${timeTakenForDelete.toFixed(2)} ms | ~ ${count / (timeTakenForDelete / 1000)} op/s`
);

start = process.hrtime();
for (let i = 0; i < count; i++)
  if ((await db.get(i.toString())) !== null) throw new Error("Expected null got something else");
diff = process.hrtime(start);
const timeTakenForGet = diff[0] * 1000 + diff[1] / 1e6;
console.log(
  `[ GET ] - ${count} keys in : ${timeTakenForGet.toFixed(2)} ms | ~ ${count / (timeTakenForGet / 1000)} op/s`
);

start = process.hrtime();
for (let i = 0; i < count; i++) await db.set(i.toString(), i);
diff = process.hrtime(start);
const timeTakenForSet = diff[0] * 1000 + diff[1] / 1e6;
console.log(
  `[ SET ] - ${count} keys in : ${timeTakenForSet.toFixed(2)} ms | ~ ${count / (timeTakenForSet / 1000)} op/s`
);

start = process.hrtime();
for (let i = 0; i < count; i++)
  if ((await db.get(i.toString())) !== i) throw new Error("Expected null got something else");
diff = process.hrtime(start);
const timeTakenForGet2 = diff[0] * 1000 + diff[1] / 1e6;
console.log(
  `[ GET ] - ${count} keys in : ${timeTakenForGet2.toFixed(2)} ms | ~ ${count / (timeTakenForGet / 1000)} op/s`
);
