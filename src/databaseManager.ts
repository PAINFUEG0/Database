/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Database } from "./database.js";

import type { ChildEvents } from "./typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  #didConnect = false;
  #webSocket?: WebSocket;
  #socketAddress: string;

  get webSocket() {
    return this.#webSocket;
  }

  get isSocketOpen() {
    if (!this.#webSocket) return false;
    return this.#webSocket.readyState === this.#webSocket.OPEN;
  }

  constructor(socketAddress: string) {
    super();
    this.#socketAddress = socketAddress;
  }

  createDatabase<T>(path: string): Database<T> {
    if (!this.#webSocket) throw new Error(`Please call <DatabaseManager>.connect() before trying to create a database`);
    return new Database<T>(this, path);
  }

  async connect() {
    this.#webSocket = new WebSocket(this.#socketAddress);

    this.#webSocket.on("open", () => {
      this.#didConnect = true;
      this.emit("connected", this.#socketAddress);
    });

    this.#webSocket.on("close", () => {
      if (this.#didConnect) this.emit("disconnected", this.#socketAddress);
    });

    this.#webSocket.on("error", (error) => this.emit("error", error));

    await new Promise((resolve) => this.on("connected", resolve));
  }

  async ping() {
    if (!this.#webSocket) return -1;
    if (this.#webSocket.readyState === this.#webSocket.CONNECTING) return -1;

    if (!this.#didConnect) return null;
    if (this.#webSocket.readyState !== this.#webSocket.OPEN) return null;

    const sent = Date.now();
    return new Promise((resolve) => {
      this.#webSocket!.ping();
      this.#webSocket!.once("pong", () => resolve(Date.now() - sent));
    });
  }
}
