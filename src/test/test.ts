/** @format */

import { DatabaseClient, DatabaseServer } from "../index.js";

console.log(`Starting DatabaseServer on port 5000`);
new DatabaseServer({ port: 5000, auth: "secret" });

const client = new DatabaseClient({ url: "localhost", port: 5000, auth: "secret" });

console.log(`Connecting to DatabaseServer`);
await client.connect();
console.log(`Connected to DatabaseServer`);

console.log(`Creating database`);
const db = await client.createDatabase<string>("test", { keysPerFile: 1000 });
console.log(`Created database "test"`);

console.log(`Getting all entries`);
const entries = Object.entries((await db.all()) || {});

console.log(`Last [K, V] entry is : ${entries.at(-1)}`);

if (!entries.length) {
  console.time("set");
  for (let i = 0; i < 100000; i++) {
    await db.set(`key${i}`, `value${i}`);
    console.log(`Set key${i}`);
  }
  console.timeEnd("set");
}

// console.time("get");
// for (let i = 0; i < 100000; i++) await db.get(`key${i}`);
// console.timeEnd("get");

// console.time("delete");
// for (let i = 0; i < 100000; i++) await db.delete(`key${i}`);
// console.timeEnd("delete");
