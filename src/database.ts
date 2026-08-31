/** @format */

import * as fs from "node:fs";
import { resolve } from "node:path";

export type SerializableDataTypes =
  | string
  | number
  | boolean
  | SerializableDataTypes[]
  | { [key: string]: SerializableDataTypes };

export class Database<T extends SerializableDataTypes> {
  #isWriting = false;
  #debounceCount = 0;
  #writeQueue = new Set<string>();

  start = Date.now();

  #keysPerFile: number;
  #debounceTime: number;
  #maxDebounceCount: number;

  #path: string;
  journal: number;
  #timer?: ReturnType<typeof setTimeout>;

  #isKeymapDirty = false;
  #keymap: { [K: string]: Set<string> } = {};
  #reverseKeymap: { [K: string]: string } = {};
  #cache = new Map<string, { [K: string]: T }>();

  constructor(op: string | { path: string; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }) {
    this.#path = resolve(typeof op === "string" ? op : op.path);
    this.#keysPerFile = typeof op !== "string" && !isNaN(op.keysPerFile!) ? op.keysPerFile! : 100;
    this.#debounceTime = typeof op !== "string" && !isNaN(op.debounceTime!) ? op.debounceTime! : 250;
    this.#maxDebounceCount = typeof op !== "string" && !isNaN(op.maxDebounceCount!) ? op.maxDebounceCount! : 500;

    if (!fs.existsSync(this.#path)) fs.mkdirSync(this.#path, { recursive: true });

    this.#loadKeymap();
    this.#loadFilesIntoCache();
    this.journal = fs.openSync(resolve(this.#path, ".wal"), "a");
  }

  // ----------------------------------------------- Private Helper Functions -----------------------------------------------

  #loadKeymap(): void {
    const keymap = resolve(this.#path, "keymap.json");
    if (!fs.existsSync(keymap)) fs.writeFileSync(keymap, JSON.stringify((this.#keymap = {})));
    else
      this.#keymap = Object.fromEntries(
        Object.entries(JSON.parse(fs.readFileSync(keymap, "utf-8"))).map(([_, K]) => {
          for (const key of K as string[]) this.#reverseKeymap[key] = _;
          return [_, new Set(K as string[])];
        })
      );
  }

  #loadFilesIntoCache(): void {
    for (const [fileName] of Object.entries(this.#keymap))
      this.#cache.set(fileName, JSON.parse(fs.readFileSync(resolve(this.#path, fileName), "utf-8")));
  }

  #lookforSpaciousFile(): string | null {
    for (const [fileName, keysInFile] of Object.entries(this.#keymap))
      if (keysInFile.size < this.#keysPerFile) return fileName;
    return null;
  }

  #createFile(): string {
    const fileName = `data_${Object.keys(this.#keymap).length + 1}.json`;
    this.#keymap[fileName] = new Set();
    this.#cache.set(fileName, {});
    this.#isKeymapDirty = true;
    return fileName;
  }

  async #writeAtomic(file: string, content: string): Promise<void> {
    await fs.promises.writeFile(resolve(this.#path, `${file}.tmp`), content);
    await fs.promises.rename(resolve(this.#path, `${file}.tmp`), resolve(this.#path, file));
  }

  async #write(): Promise<void> {
    const _isKeymapDirty = this.#isKeymapDirty;
    const _queue = [...this.#writeQueue];

    let somethingFailed = false;

    this.#isKeymapDirty = false;
    this.#writeQueue.clear();
    this.#debounceCount = 0;

    const tasks = [..._queue.map((file) => ({ file, content: JSON.stringify(this.#cache.get(file)) }))];

    if (_isKeymapDirty)
      tasks.push({
        file: "keymap.json",
        content: JSON.stringify(Object.fromEntries(Object.entries(this.#keymap).map(([k, v]) => [k, [...v]])))
      });

    this.#isWriting = true;
    await Promise.all(
      tasks.map((_) =>
        this.#writeAtomic(_.file, _.content).catch(() => {
          this.#isKeymapDirty = _.file === "keymap.json";
          this.#writeQueue.add(_.file);
          somethingFailed = true;
        })
      )
    );
    this.#isWriting = false;

    if (somethingFailed) this.#debouncedWrite();
  }

  async #debouncedWrite(): Promise<void> {
    this.#debounceCount++;
    if (this.#debounceCount >= this.#maxDebounceCount && !this.#isWriting) return await this.#write();
    this.#timer?.refresh();
    this.#timer ||= setTimeout(() => (this.#isWriting ? this.#debouncedWrite() : this.#write()), this.#debounceTime);
  }

  // ------------------------------------------------------------------------------------------------------------------------

  async has(key: string): Promise<boolean> {
    return !!this.#reverseKeymap[key];
  }

  async get(key: string): Promise<T | null> {
    const res = this.#reverseKeymap[key];
    return res ? (this.#cache.get(res)![key] as T) : null;
  }

  async set(key: string, value: T): Promise<T> {
    const res = this.#reverseKeymap[key];

    if (res) {
      if (this.#cache.get(res)![key] === value) return value;
      this.#cache.get(res)![key] = value;
      this.#writeQueue.add(res);
    } else {
      const file = this.#lookforSpaciousFile() || this.#createFile();
      this.#cache.get(file)![key] = value;
      this.#reverseKeymap[key] = file;
      this.#keymap[file]!.add(key);
      this.#isKeymapDirty = true;
      this.#writeQueue.add(file);
    }

    fs.writeSync(
      this.journal,
      JSON.stringify({ timestamp: this.start + performance.now(), op: "set", key, value }) + "\n"
    );
    await this.#debouncedWrite();
    return value;
  }

  async delete(key: string): Promise<boolean> {
    const res = this.#reverseKeymap[key];

    if (!res) return false;

    fs.writeSync(this.journal, JSON.stringify({ timestamp: this.start + performance.now(), op: "delete", key }) + "\n");
    delete this.#cache.get(res)![key];
    delete this.#reverseKeymap[key];
    this.#keymap[res]!.delete(key);
    this.#isKeymapDirty = true;
    this.#writeQueue.add(res);
    await this.#debouncedWrite();
    return true;
  }
}
