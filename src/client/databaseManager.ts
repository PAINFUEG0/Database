/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Database } from "./database.js";

import type { ChildEvents } from "../typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  #didConnect = false;
  #webSocket?: WebSocket;
  #socketAddress: string;

  get webSocket() {
    return this.#webSocket;
  }

  get isSocketOpen() {
    if (!this.webSocket) return false;
    return this.webSocket.readyState === this.webSocket.OPEN;
  }

  constructor(socketAddress: string) {
    super();
    this.#socketAddress = socketAddress;
  }

  async ping() {
    if (!this.webSocket || this.webSocket.readyState !== this.webSocket.OPEN) return;

    const sent = Date.now();
    return await new Promise<number>((resolve) => {
      const fn = () => {
        resolve(Date.now() - sent);
        this.webSocket!.off("pong", fn);
      };

      this.webSocket!.ping();
      this.webSocket!.on("pong", fn);
    });
  }

  async connect() {
    this.#webSocket = new WebSocket(this.#socketAddress);

    this.#webSocket.on("error", (error) => this.emit("error", error));
    this.#webSocket.on("close", () => !this.#didConnect || this.emit("disconnected", this.#socketAddress));
    this.#webSocket.on("open", () => ((this.#didConnect = true), this.emit("connected", this.#socketAddress)));

    return await new Promise((resolve) => this.on("connected", resolve));
  }

  createDatabase<T>(path: string): Database<T> {
    if (!this.webSocket) throw new Error(`Please call <DatabaseManager>.connect() before trying to create a database`);
    return new Database<T>(this, path);
  }
}
