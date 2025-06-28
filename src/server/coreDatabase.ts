/** @format */

import * as fs from "node:fs";

export class CoreDatabase<T> {
  #path: string;
  #isWriting = false;
  #debounceCount = 0;
  #debounceTime = 250;
  #maxKeysInFile = 100;
  #timer?: NodeJS.Timeout;
  #maxDebounceCount = 250;
  #writeQueue = new Set<string>();
  #index: { [fileName: string]: string[] };
  #cache = new Map<string, { [key: string]: T }>();

  constructor(path: string) {
    this.#path = path;
    if (!fs.existsSync(this.#path)) fs.mkdirSync(this.#path, { recursive: true });

    if (!fs.existsSync(this.#path + "/index.json")) fs.writeFileSync(this.#path + "/index.json", "{}");

    this.#index = JSON.parse(fs.readFileSync(this.#path + "/index.json", "utf-8"));

    for (const [fileName] of Object.entries(this.#index))
      this.#cache.set(fileName, JSON.parse(fs.readFileSync(`${this.#path}/${fileName}`, "utf-8")));
  }

  // ----------------------------------------------- Private Helper Functions -----------------------------------------------

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

  #searchIndexForKey(key: string) {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.includes(key)) return { fileName, keysInFile };
  }

  #lookforSpaciousFile() {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.length < this.#maxKeysInFile) return fileName;
  }

  #createFile() {
    const fileName = `data_${Object.keys(this.#index).length + 1}.json`;
    fs.writeFileSync(`${this.#path}/${fileName}`, JSON.stringify({}));
    this.#index[fileName] = [];
    return fileName;
  }

  #getSuitableFile() {
    const lastFile = this.#lookforSpaciousFile() || this.#getLastFile() || this.#createFile();
    if (this.#checkNumberOfKeysInFile(lastFile) >= this.#maxKeysInFile) return this.#createFile();
    else return lastFile;
  }

  #write() {
    const _ = [...this.#writeQueue];
    this.#writeQueue.clear();

    this.#isWriting = true;

    for (const file of _) fs.writeFileSync(`${this.#path}/${file}`, JSON.stringify(this.#cache.get(file)));
    fs.writeFileSync(`${this.#path}/index.json`, JSON.stringify(this.#index));

    this.#isWriting = false;
  }

  #debouncedWrite() {
    this.#debounceCount++;

    if (this.#debounceCount >= this.#maxDebounceCount) return (this.#debounceCount = 0), this.#write();

    this.#timer?.refresh();

    this.#timer ||= setTimeout(() => (this.#isWriting ? this.#debouncedWrite() : this.#write()), this.#debounceTime);
  }

  // ------------------------------------------------------------------------------------------------------------------------

  get(key: string) {
    const res = this.#searchIndexForKey(key);
    return res ? (this.#cache.get(res.fileName)![key] as T) : null;
  }

  getMany(keys: string[]) {
    return keys.map((key) => this.get(key));
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

  setMany(data: { key: string; value: T }[]) {
    return data.map(({ key, value }) => this.set(key, value));
  }

  delete(key: string) {
    const res = this.#searchIndexForKey(key);

    if (!res) return false;

    const file = res.fileName;
    const data = this.#cache.get(file)!;

    delete data![key];

    this.#index[file] = this.#index[file]!.filter((k) => k !== key);

    this.#writeQueue.add(file);
    this.#debouncedWrite();

    return true;
  }

  deleteMany(keys: string[]) {
    return keys.map((key) => this.delete(key));
  }

  all() {
    return this.#cache.values().reduce(
      (prev, curr) => {
        for (const [key, value] of Object.entries(curr)) prev[key] = value;
        return prev;
      },
      {} as { [key: string]: T }
    );
  }
}
