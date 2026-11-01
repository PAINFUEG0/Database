/** @format */

import z from "zod";
import * as fs from "node:fs";
import { resolve } from "node:path";

import type { Methods, KVstoreOptions } from "../types";

export class KeyValueStore<S extends z.ZodType | z.infer<z.ZodType> = z.ZodUnknown, T = S extends z.ZodType ? z.infer<S> : S> {
  #isWriting = false;
  #debounceCount = 0;
  #schema?: z.ZodType;
  #writeQueue = new Set<string>();

  #start = Date.now();

  #keysPerFile = 100;
  #debounceTime = 250;
  #maxDebounceCount = 100;

  #path: string;
  #journal!: number;
  #journalPath!: string;
  #timer?: NodeJS.Timeout;
  #tempJournalPath!: string;

  #keymap: { [K: string]: Set<string> } = {};
  #reverseKeymap: { [K: string]: string } = {};
  #cache = new Map<string, { [K: string]: T }>();

  #reservedWords = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);

  constructor(op: KVstoreOptions & { schema?: S }) {
    if (!op.path || typeof op.path !== "string") throw new Error(`Invalid database path.\nExpected : String.\nGot : '${op.path}'\n`);

    this.#path = resolve(op.path);
    this.#schema = op.schema as any;
    this.#journalPath = resolve(this.#path, "write-ahead-log.jsonl");
    this.#tempJournalPath = resolve(this.#path, "_write-ahead-log.jsonl");

    const validate = (K: keyof KVstoreOptions) => {
      if (!z.number().int().min(1).max(4096).safeParse(op[K]).success) throw new Error(`Invalid option '${K}'.\nExpected : Integer > 0 <= 4096.\nGot : ${op[K]}\n`);
    };

    if (op?.keysPerFile !== undefined) (validate("keysPerFile"), (this.#keysPerFile = op.keysPerFile));
    if (op?.debounceTime !== undefined) (validate("debounceTime"), (this.#debounceTime = op.debounceTime));
    if (op?.maxDebounceCount !== undefined) (validate("maxDebounceCount"), (this.#maxDebounceCount = op.maxDebounceCount));
  }

  async init(): Promise<this> {
    if (!fs.existsSync(this.#path)) fs.mkdirSync(this.#path, { recursive: true });

    for (const file of fs.readdirSync(this.#path)) file.endsWith(".tmp") && fs.unlinkSync(resolve(this.#path, file));

    this.#loadFilesIntoCache();

    if (fs.existsSync(this.#tempJournalPath)) {
      const current = fs.existsSync(this.#journalPath) ? fs.readFileSync(this.#journalPath, "utf-8") : "";
      const old = fs.readFileSync(this.#tempJournalPath, "utf-8");
      fs.writeFileSync(this.#journalPath, `${old}\n${current}`);
    }

    this.#journal = fs.openSync(this.#journalPath, "a");

    this.#replayJournal();
    await this.#write();

    fs.closeSync(this.#journal);
    fs.closeSync(fs.openSync(this.#journalPath, "w"));
    this.#journal = fs.openSync(this.#journalPath, "a");

    return this;
  }

  #replayJournal(): void {
    for (const line of fs.readFileSync(this.#journalPath, "utf-8").split("\n")) {
      if (!line) continue;
      const _ = JSON.parse(line);
      if (_.op === "set") this.#set(_.key, _.value);
      else if (_.op === "delete") this.#delete(_.key);
    }
  }

  #lookforSpaciousFile(): string | null {
    for (const [fileName, keysInFile] of Object.entries(this.#keymap)) if (keysInFile.size < this.#keysPerFile) return fileName;
    return null;
  }

  #createFile(): string {
    const fileName = `data_${Object.keys(this.#keymap).length + 1}.json`;
    this.#keymap[fileName] = new Set();
    this.#cache.set(fileName, {});
    return fileName;
  }

  async #writeAtomic(file: string, content: string): Promise<void> {
    await fs.promises.writeFile(resolve(this.#path, `${file}.tmp`), content);
    await fs.promises.rename(resolve(this.#path, `${file}.tmp`), resolve(this.#path, file));
  }

  #loadFilesIntoCache(): void {
    const files = fs.readdirSync(this.#path);

    for (const file of files) {
      if (!(file.endsWith(".json") && file.startsWith("data_"))) continue;

      const data = JSON.parse(fs.readFileSync(resolve(this.#path, file), "utf-8"));
      const keys = Object.keys(data);

      this.#keymap[file] = new Set(keys);
      for (const key of keys) this.#reverseKeymap[key] = file;

      this.#cache.set(file, data);
    }
  }

  async #write(): Promise<void> {
    const _queue = [...this.#writeQueue];
    let somethingFailed = false;
    this.#writeQueue.clear();
    this.#debounceCount = 0;

    const tasks = [..._queue.map((file) => ({ file, content: JSON.stringify(this.#cache.get(file)) }))];

    this.#isWriting = true;

    fs.closeSync(this.#journal);
    fs.renameSync(this.#journalPath, this.#tempJournalPath);
    this.#journal = fs.openSync(this.#journalPath, "a");

    await Promise.all(
      tasks.map((_) =>
        this.#writeAtomic(_.file, _.content).catch(() => {
          this.#writeQueue.add(_.file);
          somethingFailed = true;
        })
      )
    );

    if (somethingFailed) {
      const current = fs.readFileSync(this.#journalPath, "utf-8");
      const old = fs.readFileSync(this.#tempJournalPath, "utf-8");
      fs.closeSync(this.#journal);
      fs.writeFileSync(this.#journalPath, `${old}\n${current}`);
      this.#journal = fs.openSync(this.#journalPath, "a");
      this.#debouncedWrite();
    }

    fs.unlinkSync(this.#tempJournalPath);

    this.#isWriting = false;
  }

  async #debouncedWrite(): Promise<void> {
    this.#debounceCount++;
    if (this.#debounceCount >= this.#maxDebounceCount && !this.#isWriting) return await this.#write();
    this.#timer?.refresh();
    this.#timer ||= setTimeout(() => (this.#isWriting ? this.#debouncedWrite() : this.#write()), this.#debounceTime);
  }

  #set(key: string, value: T): T {
    const res = this.#reverseKeymap[key];

    value = structuredClone(value);

    if (res) {
      if (this.#cache.get(res)![key] === value) return value;
      this.#cache.get(res)![key] = value;
      this.#writeQueue.add(res);
    } else {
      const file = this.#lookforSpaciousFile() || this.#createFile();
      this.#cache.get(file)![key] = value;
      this.#reverseKeymap[key] = file;
      this.#keymap[file]!.add(key);
      this.#writeQueue.add(file);
    }

    return structuredClone(value);
  }

  #delete(key: string): boolean {
    const res = this.#reverseKeymap[key];

    if (!res) return false;

    delete this.#cache.get(res)![key];
    delete this.#reverseKeymap[key];
    this.#keymap[res]!.delete(key);
    this.#writeQueue.add(res);
    return true;
  }

  async has(key: string): Promise<boolean> {
    this.#validateKeys(key);
    return key in this.#reverseKeymap;
  }

  async get(key: string): Promise<T | null> {
    this.#validateKeys(key);
    const res = this.#reverseKeymap[key];
    return structuredClone(res ? (this.#cache.get(res)![key] as T) : null);
  }

  async set(key: string, value: T): Promise<T> {
    this.#validateKeys(key);
    value = this.#schema ? (this.#schema?.parse(value) as T) : value;
    fs.writeSync(this.#journal, JSON.stringify({ timestamp: this.#start + performance.now(), op: "set", key, value }) + "\n");
    const res = this.#set(key, value);
    await this.#debouncedWrite();
    return res;
  }

  async delete(key: string): Promise<boolean> {
    this.#validateKeys(key);
    fs.writeSync(this.#journal, JSON.stringify({ timestamp: this.#start + performance.now(), op: "delete", key }) + "\n");
    const res = this.#delete(key);
    await this.#debouncedWrite();
    return structuredClone(res);
  }

  async hasMany(keys: string[]): Promise<boolean[]> {
    this.#validateKeys(keys);
    return await Promise.all(keys.map((K) => this.has(K)));
  }

  async getMany(keys: string[]): Promise<(T | null)[]> {
    this.#validateKeys(keys);
    return await Promise.all(keys.map((K) => this.get(K)));
  }

  async setMany(data: { key: string; value: T }[]): Promise<T[]> {
    this.#validateKeys(data.map(({ key }) => key));
    data = data.map(({ key, value }) => ({ key, value: this.#schema ? (this.#schema?.parse(value) as T) : value }));
    const lines = data.map(({ key, value }) => JSON.stringify({ timestamp: this.#start + performance.now(), op: "set", key, value }));
    fs.writeSync(this.#journal, lines.join("\n") + "\n");
    const res = data.map((e) => this.#set(e.key, e.value));
    await this.#debouncedWrite();
    return res;
  }

  async deleteMany(keys: string[]): Promise<boolean[]> {
    this.#validateKeys(keys);
    const lines = keys.map((K) => JSON.stringify({ timestamp: this.#start + performance.now(), op: "delete", key: K }));
    fs.writeSync(this.#journal, lines.join("\n") + "\n");
    const res = keys.map((K) => this.#delete(K));
    await this.#debouncedWrite();
    return res;
  }

  all(): { [K: string]: T } {
    const result = {};
    for (const data of this.#cache.values()) Object.assign(result, data);
    return structuredClone(result);
  }

  #validateKeys(key: unknown | unknown[]) {
    const keys = Array.isArray(key) ? key : [key];

    for (let i = 0; i < keys.length; i++) {
      const _ = `Invalid key provided ${keys.length > 1 ? `at position ${i}` : ""}\n`;

      if (this.#reservedWords.has(keys[i])) throw `${_}Reserved word '${keys[i]}' not allowed\n`;

      if (!keys[i] || typeof keys[i] !== "string" || keys[i].length === 0 || keys[i].length > 255) throw `${_}Expected : string literal with length > 0 < 255\nGot : '${keys[i]}'\n`;
    }
  }

  toggle = (async (key) => {
    this.#validateKeys(key);
    const file = this.#reverseKeymap[key];
    const data = file ? this.#cache.get(file)![key] : false;

    if (typeof data !== "boolean") throw new Error("Can't toggle non-boolean values");

    return (await this.set(key, !data as T)) as boolean;
  }) as Methods<T>["TOGGLE"];

  increment = (async (key, count = 1) => {
    this.#validateKeys(key);
    const file = this.#reverseKeymap[key];
    const data = file ? this.#cache.get(file)![key] : 0;

    if (typeof data !== "number") throw new Error("Can't increment non-numeric values");
    if (typeof count !== "number") throw new Error("Can't increment with a non-numeric count");

    return <Promise<number>>this.set(key, (data + count) as T);
  }) as Methods<T>["INCREMENT"];

  decrement = (async (key, count = 1) => {
    this.#validateKeys(key);
    const file = this.#reverseKeymap[key];
    const data = file ? this.#cache.get(file)![key] : 0;

    if (typeof data !== "number") throw new Error("Can't increment non-numeric values");
    if (typeof count !== "number") throw new Error("Can't increment with a non-numeric count");

    return <Promise<number>>this.set(key, (data - count) as T);
  }) as Methods<T>["DECREMENT"];

  #getArrayData(key: string) {
    this.#validateKeys(key);
    const file = this.#reverseKeymap[key];
    const data = file ? this.#cache.get(file)![key] : [];
    if (!Array.isArray(data)) throw "This operation is reserved for array-only values";
    return structuredClone(data) as unknown[];
  }

  async #mutate<R extends object>(key: string, fn: (d: unknown[]) => R) {
    const data = this.#getArrayData(key);

    const res = fn(data);
    await this.set(key, data as T);
    return { ...res, length: data.length };
  }

  length = (async (K) => this.#getArrayData(K).length) as Methods<T>["LENGTH"];
  pop = (async (K) => this.#mutate(K, (arr) => ({ element: arr.pop() }))) as Methods<T>["POP"];
  shift = (async (K) => this.#mutate(K, (arr) => ({ element: arr.shift() }))) as Methods<T>["SHIFT"];
  slice = (async (K, S, E) => ({ elements: this.#getArrayData(K).slice(S, E) })) as Methods<T>["SLICE"];
  push = (async (K, ...items) => this.#mutate(K, (arr) => ({ elements: (arr.push(...items), items) }))) as Methods<T>["PUSH"];
  unshift = (async (K, ...items) => this.#mutate(K, (arr) => ({ elements: (arr.unshift(...items), items) }))) as Methods<T>["UNSHIFT"];
  splice = (async (K, ...args) => this.#mutate(K, (arr) => ({ added: args.slice(2), removed: arr.splice(...(args as [number, number, ...unknown[]])) }))) as Methods<T>["SPLICE"];
}
