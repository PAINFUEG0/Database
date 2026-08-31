/** @format */

import { Database } from "./database.ts";

// const count = 100000;
const path = "./test-db";

// existsSync(path) && rmSync(path, { recursive: true });

const DB = new Database<string>({ path: path, keysPerFile: 100, maxDebounceCount: 1000 });

await DB.setMany(Array.from({ length: 10_000 }, (_, i) => ({ key: `set-${i}`, value: `value-${i}` })));

await DB.nuke();

await DB.setMany(Array.from({ length: 10_000 }, (_, i) => ({ key: `set-${i}`, value: `value-${i}` })));

// let start, elapsed;

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (same) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.set(`set-${i}`, `value-${i + 1}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (change) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.has(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `has \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.get(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `get \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.delete(`set-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `delete \t\t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );

// start = performance.now();
// for (let i = 0; i < count; i++) await DB.set(`set-${i}`, `value-${i}`);
// elapsed = performance.now() - start;

// console.log(
//   `set (repeat) \t ${count} keys \t\t ${elapsed.toFixed(3)} ms \t\t ${Math.round((count / elapsed) * 1000).toLocaleString()} ops/sec`
// );
