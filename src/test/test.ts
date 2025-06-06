/** @format */

import sourceMapSupport from "source-map-support";
import { DatabaseServer, DatabaseManager } from "../index.js";

sourceMapSupport.install();

new DatabaseServer();

const databaseManager = new DatabaseManager("ws://localhost:8080");

databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));
databaseManager.on("dropped", (...args) => console.log(`Dropped ${args.join(" | ")}`));
databaseManager.on("connected", (address) => console.log(`Connected to ${address}`));
databaseManager.on("error", (err) => console.error(err));

await databaseManager.connect();
console.log("Manager ready !");

const db = databaseManager.createDatabase<any>("./storage");

console.log(`Websocket ping is ${await databaseManager.ping()} ms`);

let start = process.hrtime();
for (let i = 0; i < 10000; i++) await db.set(i.toString(), i);
let diff = process.hrtime(start);
let timeInMs = diff[0] * 1000 + diff[1] / 1e6;
console.log(`[ SET ] - 10000 keys in : ${timeInMs.toFixed(4)} ms | ~ ${Math.round(10000 / (timeInMs / 1000))} req/s`);

start = process.hrtime();
for (let i = 0; i < 10000; i++) await db.get(i.toString());
diff = process.hrtime(start);
timeInMs = diff[0] * 1000 + diff[1] / 1e6;
console.log(`[ GET ] - 10000 keys in : ${timeInMs.toFixed(4)} ms | ~ ${Math.round(10000 / (timeInMs / 1000))} req/s`);

start = process.hrtime();
for (let i = 0; i < 10000; i++) await db.delete(i.toString());
diff = process.hrtime(start);
timeInMs = diff[0] * 1000 + diff[1] / 1e6;
console.log(`[ DEL ] - 10000 keys in : ${timeInMs.toFixed(4)} ms | ~ ${Math.round(10000 / (timeInMs / 1000))} req/s`);
