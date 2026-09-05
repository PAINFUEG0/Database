/** @format */

import z from "zod";
import { KeyValueStore, DatabaseClient, DatabaseServer } from "../index.js";

new DatabaseServer({ port: 5000, auth: "secret" });

const client = new DatabaseClient({ url: "localhost", port: 5000, auth: "secret" });

await client.connect();

const db = client.createDatabase("test", z.number());

console.log(await db.all());

const DB = new KeyValueStore<string>({ path: "./storage/test2" });

console.log(await DB.all());

for (let i = 0; i < 100000; i++) {
  await DB.set(`key${i}`, `value${i}`);
  console.log(i);
}
