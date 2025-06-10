/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Database } from "./database.js";
import { setTimeout as sleep } from "node:timers/promises";

import type { ChildEvents } from "../typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  #auth: string;
  #webSocket?: WebSocket;
  #socketAddress: string;

  get webSocket() {
    return this.#webSocket;
  }

  get isSocketOpen() {
    if (!this.webSocket) return false;
    return this.webSocket.readyState === this.webSocket.OPEN;
  }

  constructor(socketAddress: string, auth: string) {
    super();
    this.#auth = auth;
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

  #tries = 0;
  async reconnect() {
    if (this.#tries >= 5) return;

    this.#webSocket?.terminate();

    await sleep(2500);

    await this.connect()
      .then(() => {
        this.#tries = 0;
        this.emit("reconnected", this.#socketAddress);
      })
      .catch(() => {
        ++this.#tries;
        this.reconnect();
      });
  }

  async connect() {
    this.#webSocket = new WebSocket(this.#socketAddress, { headers: { Authorization: this.#auth } });

    this.on("disconnected", this.reconnect);
    this.#webSocket.on("error", (error) => this.emit("error", error));
    this.#webSocket.on("open", () => this.emit("connected", this.#socketAddress));

    return await new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error("Connection timeout")), 2500);

      this.on("connected", resolve);

      this.#webSocket?.on("close", (code, reason) => {
        switch (code) {
          case 1006:
            this.emit("disconnected", this.#socketAddress);
            break;

          case 4401:
            reject(new Error(reason.toString()));
            break;
        }
      });
    });
  }

  createDatabase<T>(path: string): Database<T> {
    if (!this.webSocket) throw new Error(`Please call <DatabaseManager>.connect() before trying to create a database`);
    return new Database<T>(this, path);
  }
}
