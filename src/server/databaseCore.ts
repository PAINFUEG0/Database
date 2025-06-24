/** @format */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export class CoreDatabase<T> {
  #path!: string;
  #maxKeysInFile = 100;
  #index!: { [fileName: string]: string[] };
  #cache = new Map<string, { [key: string]: T }>();

  #isWriting = false;
  #writeQueue = new Set<string>();

  #timer?: NodeJS.Timeout;

  #debounceCount = 0;
  #debounceTime = 250;
  #maxDebounceCount = 250;

  #debouncedWrite() {
    this.#debounceCount++;

    if (this.#debounceCount >= this.#maxDebounceCount) return (this.#debounceCount = 0), this.#write();

    this.#timer?.refresh();

    this.#timer ||= setTimeout(() => (this.#isWriting ? this.#debouncedWrite() : this.#write()), this.#debounceTime);
  }

  #write() {
    const _ = [...this.#writeQueue];
    this.#writeQueue.clear();

    this.#isWriting = true;

    for (const file of _) writeFileSync(`${this.#path}/${file}`, JSON.stringify(this.#cache.get(file)));
    writeFileSync(`${this.#path}/index.json`, JSON.stringify(this.#index));

    this.#isWriting = false;
  }

  constructor(path: string) {
    this.#path = path;
    if (!existsSync(this.#path)) mkdirSync(this.#path, { recursive: true });

    if (!existsSync(this.#path + "/index.json")) writeFileSync(this.#path + "/index.json", "{}");

    this.#index = JSON.parse(readFileSync(this.#path + "/index.json", "utf-8"));

    for (const [fileName] of Object.entries(this.#index))
      this.#cache.set(fileName, JSON.parse(readFileSync(`${this.#path}/${fileName}`, "utf-8")));
  }

  #searchIndexForKey(key: string) {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.includes(key)) return { fileName, keysInFile };
  }

  #getLastFile() {
    const files = Object.keys(this.#index);
    const lastFile = files[files.length - 1];
    return lastFile;
  }

  #checkNumberOfKeysInFile(fileName: string) {
    const keysInFile = this.#index[fileName];
    const numberOfKeysInFile = keysInFile!.length;
    return numberOfKeysInFile;
  }

  #createFile() {
    const fileName = `data_${Object.keys(this.#index).length + 1}.json`;
    writeFileSync(`${this.#path}/${fileName}`, JSON.stringify({}));
    this.#index[fileName] = [];
    return fileName;
  }

  #getSuitableFile() {
    const lastFile = this.#lookforSpaciousFile() || this.#getLastFile() || this.#createFile();
    if (this.#checkNumberOfKeysInFile(lastFile) >= this.#maxKeysInFile) return this.#createFile();
    else return lastFile;
  }

  #lookforSpaciousFile() {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.length < this.#maxKeysInFile) return fileName;
  }

  all() {
    const data = this.#cache.values().reduce(
      (prev, curr) => {
        for (const [key, value] of Object.entries(curr)) prev[key] = value;
        return prev;
      },
      {} as { [key: string]: T }
    );

    return data;
  }

  get(key: string) {
    const res = this.#searchIndexForKey(key);
    return res ? (this.#cache.get(res.fileName)![key] as T) : null;
  }

  set(key: string, value: T) {
    const res = this.#searchIndexForKey(key);

    const file = res ? res.fileName : this.#getSuitableFile();

    if (!res?.keysInFile?.includes(key)) (this.#index[file] ||= []).push(key);

    const data = this.#cache.get(file) ?? this.#cache.set(file, {}).get(file)!;

    if (data[key] == value) return value;

    data[key] = value;

    this.#writeQueue.add(file);
    this.#debouncedWrite();

    return value;
  }

  delete(key: string) {
    const res = this.#searchIndexForKey(key);

    if (!res) return null;

    const file = res.fileName;
    const data = this.#cache.get(file)!;

    delete data![key];

    this.#index[file] = this.#index[file]!.filter((k) => k !== key);

    this.#writeQueue.add(file);
    this.#debouncedWrite();

    return null;
  }
}
