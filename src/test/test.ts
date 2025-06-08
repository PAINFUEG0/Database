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

const db = databaseManager.createDatabase<unknown>(".");

console.log(`Websocket ping is ${await databaseManager.ping()} ms`);

async function mesaureTime(fn: (i: number) => Promise<unknown>, repeat = 10) {
  const start = process.hrtime();
  for (let i = 0; i < repeat; i++) await fn(i);
  const diff = process.hrtime(start);
  return Number((diff[0] * 1000 + diff[1] / 1e6).toFixed(2));
}

const count = 1e4;
const timeTakenForGet = await mesaureTime(async (i) => await db.get(i.toString()), count);
const timeTakenForSet = await mesaureTime(async (i) => await db.set(i.toString(), i), count);
const timeTakenForDelete = await mesaureTime(async (i) => await db.delete(i.toString()), count);

console.log(`[ DEL ] - ${count} keys in : ${timeTakenForSet} ms | ~ ${count / (timeTakenForSet / 1000)} op/s`);
console.log(`[ SET ] - ${count} keys in : ${timeTakenForGet} ms | ~ ${count / (timeTakenForGet / 1000)} op/s`);
console.log(`[ GET ] - ${count} keys in : ${timeTakenForDelete} ms | ~ ${count / (timeTakenForDelete / 1000)} op/s`);
