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
console.log((await databaseManager.ping()) + "ms");
