/** @format */

import { DatabaseClient, DatabaseServer } from "../index.js";

new DatabaseServer({ port: 5000, auth: "secret" });

const client = new DatabaseClient({ url: "localhost", port: 5000, auth: "secret" });

await client.connect();

const db = await client.createDatabase<string>("test", { keysPerFile: 1000 });

console.log(await db.all());

console.time("set");
for (let i = 0; i < 100000; i++) await db.set(`key${i}`, `value${i}`);
console.timeEnd("set");

console.time("get");
for (let i = 0; i < 100000; i++) await db.get(`key${i}`);
console.timeEnd("get");

console.time("delete");
for (let i = 0; i < 100000; i++) await db.delete(`key${i}`);
console.timeEnd("delete");
