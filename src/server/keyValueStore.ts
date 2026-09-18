/** @format */

import * as fs from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export class KeyValueStore<T = unknown> {
  #isWriting = false;
  #debounceCount = 0;
  #writeQueue = new Set<string>();

  #start = Date.now();

  #keysPerFile: number;
  #debounceTime: number;
  #maxDebounceCount: number;

  #path: string;
  #journal!: number;
  #journalPath!: string;
  #timer?: NodeJS.Timeout;
  #tempJournalPath!: string;

  #keymap: { [K: string]: Set<string> } = {};
  #reverseKeymap: { [K: string]: string } = {};
  #cache = new Map<string, { [K: string]: T }>();

  constructor(op: string | { path: string; debounceTime?: number; maxDebounceCount?: number; keysPerFile?: number }) {
    this.#path = resolve(typeof op === "string" ? op : op.path);
    this.#journalPath = resolve(this.#path, "write-ahead-log.jsonl");
    this.#tempJournalPath = resolve(this.#path, "_write-ahead-log.jsonl");
    this.#keysPerFile = typeof op !== "string" && !isNaN(op.keysPerFile!) ? op.keysPerFile! : 100;
    this.#debounceTime = typeof op !== "string" && !isNaN(op.debounceTime!) ? op.debounceTime! : 250;
    this.#maxDebounceCount = typeof op !== "string" && !isNaN(op.maxDebounceCount!) ? op.maxDebounceCount! : 500;
  }

  async init(): Promise<this> {
    if (!fs.existsSync(this.#path)) fs.mkdirSync(this.#path, { recursive: true });

    for (const file of fs.readdirSync(this.#path))
      file.endsWith(".tmp") && fs.renameSync(resolve(this.#path, file), resolve(this.#path, file.replace(".tmp", "")));

    this.#loadFilesIntoCache();
    this.#journal = fs.openSync(this.#journalPath, "a");

    if (fs.existsSync(this.#journalPath)) {
      this.replayJournal();
      await this.#write();
    }

    fs.closeSync(fs.openSync(this.#journalPath, "w"));
    this.#journal = fs.openSync(this.#journalPath, "a");

    return this;
  }

  replayJournal(): void {
    for (const line of fs.readFileSync(this.#journalPath, "utf-8").split("\n")) {
      if (!line) continue;
      const _ = JSON.parse(line);
      if (_.op === "set") this.#set(_.key, _.value, true);
      else if (_.op === "delete") this.#delete(_.key, true);
    }
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

    fs.closeSync(this.#journal);
    fs.rmSync(this.#path, { recursive: true, force: true });
    this.init();
  }
}
