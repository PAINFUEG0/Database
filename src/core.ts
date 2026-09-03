/** @format */

import * as fs from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export class CoreDatabase<T = unknown> {
  #isWriting = false;
  #debounceCount = 0;
  #writeQueue = new Set<string>();

  #start = Date.now();

  #keysPerFile: number;
  #debounceTime: number;
  #maxDebounceCount: number;

  #path: string;
  #journal!: number;
  #timer?: NodeJS.Timeout;

  #isKeymapDirty = false;
  #keymap: { [K: string]: Set<string> } = {};
  #reverseKeymap: { [K: string]: string } = {};
  #cache = new Map<string, { [K: string]: T }>();

  constructor(op: string | { path: string; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }) {
    this.#path = resolve(typeof op === "string" ? op : op.path);
    this.#keysPerFile = typeof op !== "string" && !isNaN(op.keysPerFile!) ? op.keysPerFile! : 100;
    this.#debounceTime = typeof op !== "string" && !isNaN(op.debounceTime!) ? op.debounceTime! : 250;
    this.#maxDebounceCount = typeof op !== "string" && !isNaN(op.maxDebounceCount!) ? op.maxDebounceCount! : 500;

    this.init();
  }

  init(): void {
    if (!fs.existsSync(this.#path)) fs.mkdirSync(this.#path, { recursive: true });

    this.#loadKeymap();
    this.#loadFilesIntoCache();
    this.#journal = fs.openSync(resolve(this.#path, ".wal"), "a");
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

  async #write(): Promise<void> {
    const _isKeymapDirty = this.#isKeymapDirty;
    const _queue = [...this.#writeQueue];
    let somethingFailed = false;
    this.#isKeymapDirty = false;
    this.#writeQueue.clear();
    this.#debounceCount = 0;

    const tasks = [..._queue.map((file) => ({ file, content: JSON.stringify(this.#cache.get(file)) }))];
    const keymap = Object.fromEntries(Object.entries(this.#keymap).map(([k, v]) => [k, [...v]]));

    if (_isKeymapDirty) tasks.push({ file: "keymap.json", content: JSON.stringify(keymap) });

    this.#isWriting = true;
    await Promise.all(
      tasks.map((_) =>
        this.#writeAtomic(_.file, _.content).catch(() => {
          this.#isKeymapDirty = _.file === "keymap.json";
          if (_.file !== "keymap.json") this.#writeQueue.add(_.file);
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

  async #set(key: string, value: T, internal: boolean): Promise<T> {
    const timestamp = this.#start + performance.now();
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

    !internal && fs.writeSync(this.#journal, JSON.stringify({ timestamp, op: "set", key, value }) + "\n");
    !internal && (await this.#debouncedWrite());
    return value;
  }

  async #delete(key: string, internal: boolean): Promise<boolean> {
    const timestamp = this.#start + performance.now();
    const res = this.#reverseKeymap[key];

    if (!res) return false;

    delete this.#cache.get(res)![key];
    delete this.#reverseKeymap[key];
    this.#keymap[res]!.delete(key);
    this.#isKeymapDirty = true;
    this.#writeQueue.add(res);

    !internal && fs.writeSync(this.#journal, JSON.stringify({ timestamp, op: "delete", key }) + "\n");
    !internal && (await this.#debouncedWrite());
    return true;
  }

  async has(key: string): Promise<boolean> {
    return !!this.#reverseKeymap[key];
  }

  async get(key: string): Promise<T | null> {
    const res = this.#reverseKeymap[key];
    return res ? (this.#cache.get(res)![key] as T) : null;
  }

  async set(key: string, value: T): Promise<T> {
    return await this.#set(key, value, false);
  }

  async delete(key: string): Promise<boolean> {
    return await this.#delete(key, false);
  }

  async getMany(keys: string[]): Promise<(T | null)[]> {
    return await Promise.all(keys.map((K) => this.get(K)));
  }

  async setMany(data: { key: string; value: T }[]): Promise<T[]> {
    const _: string[] = [];

    const __ = await Promise.all(
      data.map(async ({ key, value }) => {
        _.push(JSON.stringify({ timestamp: this.#start + performance.now(), op: "set", key, value }));
        return await this.#set(key, value, true);
      })
    );

    fs.writeSync(this.#journal, _.join("\n") + "\n");
    await this.#debouncedWrite();
    return __;
  }

  async deleteMany(keys: string[]): Promise<boolean[]> {
    const _: string[] = [];

    const __ = await Promise.all(
      keys.map(async (K) => {
        const res = await this.#delete(K, true);
        _.push(JSON.stringify({ timestamp: this.#start + performance.now(), op: "delete", key: K }));
        return res;
      })
    );

    fs.writeSync(this.#journal, _.join("\n") + "\n");
    await this.#debouncedWrite();
    return __;
  }

  all(): { [K: string]: T } {
    const result = {};
    for (const data of this.#cache.values()) Object.assign(result, data);
    return result;
  }

  async nuke(): Promise<void> {
    if (this.#isWriting) return await sleep(500).then(() => this.nuke());

    this.#timer?.close();
    this.#timer = undefined;

    this.#isWriting = false;
    this.#debounceCount = 0;
    this.#writeQueue.clear();

    this.#cache.clear();
    this.#reverseKeymap = {};
    this.#isKeymapDirty = false;

    fs.rmSync(this.#path, { recursive: true, force: true });
    fs.closeSync(this.#journal);
    this.init();
  }
}
