/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Payload, Response } from "./types.js";

interface SlaveEvents {
  error: [err: Error];
  connect: [address: string];
  disconnect: [address: string];
}

export class SlaveCreator extends EventEmitter<SlaveEvents> {
  #didConnect = false;
  #webSocket!: WebSocket;
  #socketAddress: string;

  constructor(op: { socketAddress: string }) {
    super();
    this.#socketAddress = op.socketAddress;
    this.connect();
  }

  run(data: string) {
    const parsed = JSON.parse(data.toString()) as Response;
  }

  async connect() {
    this.#webSocket = new WebSocket(this.#socketAddress);

    this.#webSocket.on("message", this.run.bind(this));

    this.#webSocket.on("open", () => {
      this.#didConnect = true;
      this.emit("connect", this.#socketAddress);
    });

    this.#webSocket.on("error", (error) => this.emit("error", error));
    this.#webSocket.on("close", () => {
      if (this.#didConnect) this.emit("disconnect", this.#socketAddress);
    });

    await new Promise((resolve) => this.once("connect", resolve));
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

  create<T>(path: string): Slave<T> {
    return new Slave<T>(path, this.#webSocket);
  }
}

class Slave<T> {
  #path: string;
  #webSocket: WebSocket;

  constructor(path: string, webSocket: WebSocket) {
    this.#path = path;
    this.#webSocket = webSocket;
  }

  async get(key: string) {
    const payload: Payload = { path: this.#path, method: "GET", key: key };
    this.#webSocket.send(JSON.stringify(payload));
  }

  async delete(key: string) {
    const payload: Payload = { path: this.#path, method: "DELETE", key: key };
    this.#webSocket.send(JSON.stringify(payload));
  }

  async set(key: string, value: T) {
    const payload: Payload = { path: this.#path, method: "SET", key, value: JSON.stringify(value) };
    this.#webSocket.send(JSON.stringify(payload));
  }
}
