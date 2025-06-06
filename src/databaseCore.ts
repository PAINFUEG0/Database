/** @format */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

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

  constructor(op: { path: string }) {
    this.#path = op.path;
    existsSync(this.#path) || mkdirSync(this.#path, { recursive: true });

    if (existsSync(this.#path + "/index.json")) writeFileSync(this.#path + "/index.json", "{}");

    this.#index = JSON.parse(readFileSync(this.#path + "/index.json", "utf-8"));

    for (const [fileName] of Object.entries(this.#index))
      this.#cache.set(fileName, JSON.parse(readFileSync(this.#path + "/" + fileName, "utf-8")));
  }

  /**
   * @description Checks if the key is present in any file
   * if yes return the fileName and an array of keys in that file
   * if not return undefined
   */
  #searchIndexForKey(key: string) {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.includes(key)) return { fileName, keysInFile };
  }

  /**
   * @description Returns the name of the last file in the index
   * if no files are present returns undefined
   */
  #getLastFile() {
    const files = Object.keys(this.#index);
    const lastFile = files[files.length - 1];
    return lastFile;
  }

  /**
   * @description Checks the number of keys in a file
   */
  #checkNumberOfKeysInFile(fileName: string) {
    const keysInFile = this.#index[fileName];
    const numberOfKeysInFile = keysInFile!.length;
    return numberOfKeysInFile;
  }

  /**
   * @description Creates a new file and adds it to the index and returns the fileName
   */
  #createFile() {
    const fileName = `data_${Object.keys(this.#index).length + 1}.json`;
    writeFileSync(this.#path + "/" + fileName, "{}");
    this.#index[fileName] = [];
    return fileName;
  }

  /**
   * @description Checks if the last file has more than 100 keys
   * if yes creates and returns the new file
   * if no returns the last file
   */
  #getSuitableFile() {
    const lastFile = this.#lookforSpaciousFile() || this.#getLastFile() || this.#createFile();
    if (this.#checkNumberOfKeysInFile(lastFile) >= this.#maxKeysInFile) return this.#createFile();
    else return lastFile;
  }

  /**
   * @description Returns the name of the first file that has less than 100 keys if any
   */
  #lookforSpaciousFile() {
    for (const [fileName, keysInFile] of Object.entries(this.#index))
      if (keysInFile.length < this.#maxKeysInFile) return fileName;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////

  has(key: string) {
    return !!this.#searchIndexForKey(key);
  }

  get(key: string): T | null {
    const res = this.#searchIndexForKey(key);
    return res ? (this.#cache.get(res.fileName)![key] as T) : null;
  }

  set(key: string, value: T): T {
    const res = this.#searchIndexForKey(key);

    const file = res ? res.fileName : this.#getSuitableFile();

    res?.keysInFile?.includes(key) || (this.#index[file] ||= []).push(key);

    const data = this.#cache.get(file) ?? this.#cache.set(file, {}).get(file)!;

    data[key] = value;

    this.#writeQueue.add(file);
    this.#debouncedWrite();

    return value;
  }

  delete(key: string): T | null {
    const res = this.#searchIndexForKey(key);

    if (!res) return null;

    const file = res.fileName;
    const data = this.#cache.get(file)!;

    const deleted = data[key]!;

    delete data![key];

    this.#index[file] = this.#index[file]!.filter((k) => k !== key);

    this.#writeQueue.add(file);
    this.#debouncedWrite();

    return deleted;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////

  all() {
    const data = this.#cache.values().reduce(
      (prev, curr) => {
        for (const [key, value] of Object.entries(curr)) prev[key] = value;
        return prev;
      },
      {} as { [key: string]: T }
    );

    Object.defineProperty(data, "values", { value: Object.values(data), enumerable: false });
    Object.defineProperty(data, "keys", { value: Object.keys(data), enumerable: false });
    //@ts-expect-error not really
    Object.defineProperty(data, "size", { value: data.keys.length, enumerable: false });

    return data as Record<string, T> & { keys: string[]; values: T[]; size: number };
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////

  clear() {
    this.#index = {};
    this.#cache.clear();
    rmSync(this.#path, { recursive: true, force: true });
    mkdirSync(this.#path, { recursive: true });
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////
}
