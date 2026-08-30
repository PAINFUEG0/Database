/** @format */

import { existsSync, rmSync } from "fs";
import { Database } from "./database.ts";

// const count = 1_00_000;
const path = "./test-db";

existsSync(path) && rmSync(path, { recursive: true });

const DB = new Database<string>({ path: path, maxDebounceCount: 500, keysPerFile: 500 });

setInterval(() => {
  console.clear();

  console.time("GET");
  DB.get("set-0");
  console.timeEnd("GET");

  console.time("SET");
  DB.set(Math.random().toString(36).slice(2), Math.random().toString(36).slice(2));
  console.timeEnd("SET");

  console.time("HAS");
  DB.has("set-0");
  console.timeEnd("HAS");

  console.time("DELETE");
  DB.delete("set-0");
  console.timeEnd("DELETE");
}, 1);

// let start, elapsed;

// start = performance.now();
// for (let i = 0; i < count; i++) DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (same) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.set(`set-${i}`, `value-${i + 1}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (change) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.has(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `has \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.get(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `get \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.delete(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `delete \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (repeat) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );
