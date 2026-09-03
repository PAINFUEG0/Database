/** @format */

import z from "zod";
import { Database } from "./index.js";

new Database().construct("server", { port: 5000, auth: "secret" });

const client = new Database().construct("client", { url: "localhost", port: 5000, auth: "secret" });
await client.connect();
const db = client.createDatabase("test", z.number());
console.log(await db.set("test", 1));

const DB = new Database().construct<string>("standalone", { path: "./storage" });
console.log(await DB.set("test", "1"));
