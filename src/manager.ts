/** @format */

import { WebSocket } from "ws";
import { Child } from "./child.js";
import { EventEmitter } from "events";

import type { ChildEvents } from "./types.js";

export class Manager extends EventEmitter<ChildEvents> {
  #didConnect = false;
  #webSocket!: WebSocket;
  #socketAddress: string;

  get webSocket() {
    return this.#webSocket;
  }

  get isSocketOpen() {
    return this.#webSocket.readyState === this.#webSocket.OPEN;
  }

  constructor(socketAddress: string) {
    super();
    this.#socketAddress = socketAddress;
  }

  async reconnect() {
    await this.close();
    await this.connect();
  }

  async close() {
    this.#webSocket.close();
    await new Promise((resolve) => this.once("disconnected", resolve));
    this.#didConnect = false;
  }

  create<T>(path: string): Child<T> {
    return new Child<T>(this, path);
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

    await new Promise((resolve) => this.once("connected", resolve));
  }

  async ping() {
    if (this.#webSocket.readyState === this.#webSocket.CONNECTING) return -1;

    if (!this.#didConnect) return null;
    if (this.#webSocket.readyState !== this.#webSocket.OPEN) return null;

    const sent = Date.now();
    return new Promise((resolve) => {
      this.#webSocket.ping();
      this.#webSocket.once("pong", () => resolve(Date.now() - sent));
    });
  }
}
