/** @format */

import z from "zod";
import sourceMapSupport from "source-map-support";
import { DatabaseManager, DatabaseServer } from "../src/index.js";

new DatabaseServer(8080, "hello");

sourceMapSupport.install();

const databaseManager = new DatabaseManager("ws://localhost:8080", "hello");

databaseManager.on("error", (err) => console.error(err));
databaseManager.on("disconnected", (address) => console.log(`Disconnected from ${address}`));

await databaseManager.connect();

const db = databaseManager.createDatabase("test", z.number());

const count = 1e4;

for (let i = 0; i < count; ++i) console.log(await db.set(i.toString(), i));
