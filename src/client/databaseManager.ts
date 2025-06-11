/** @format */

import { WebSocket } from "ws";
import { EventEmitter, once } from "events";
import { Database } from "./database.js";
import { setTimeout as sleep } from "node:timers/promises";

import type { ChildEvents, Payload, Response } from "../typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  #auth: string;
  #tries = 0;
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
    if (!this.isSocketOpen) return null;

    const sent = Date.now();

    return new Promise<number | null>(async (resolve) => {
      const fn = () => {
        resolve(Date.now() - sent);
        this.webSocket!.off("pong", fn);
      };

      this.webSocket!.ping();
      this.webSocket!.on("pong", fn);

      await sleep(2500);

      this.#webSocket!.off("pong", fn);
      resolve(null);
    });
  }

  async reconnect() {
    if (this.#tries >= 5) {
      this.emit("disconnected", this.#socketAddress);
      return;
    }

    await sleep(2500);

    await this.connect()
      .then(() => {
        this.#tries = 0;
        this.emit("reconnected", this.#socketAddress);
      })
      .catch(() => {
        ++this.#tries;
      });
  }

  #requests = new Map();

  async connect() {
    const controller = new AbortController();
    try {
      this.#webSocket = new WebSocket(this.#socketAddress, { headers: { Authorization: this.#auth } });
      this.#webSocket.on("error", console.error);
      this.#webSocket.on("close", this.reconnect.bind(this));

      this.#webSocket!.on("message", (message) => {
        const data = JSON.parse(message.toString()) as Response;
        this.#requests.get(data.requestId)?.resolve(data.data);
        this.#requests.delete(data.requestId);
      });

      this.on("reconnected", () => {
        console.log("reconnected");
        this.#pending.map((fn) => fn());
      });

      await Promise.race([
        once(this.#webSocket, "open", { signal: controller.signal }),
        once(this.#webSocket, "close", { signal: controller.signal })
      ]);
      if (this.isSocketOpen) this.emit("connected", this.#socketAddress);
    } catch (err) {
      throw err;
    } finally {
      controller.abort();
    }
  }

  #pending = <(() => void)[]>[];

  async makeReq<D>(payload: Payload) {
    const isOpen = this.isSocketOpen;

    const request = {} as {
      promise: Promise<D | null>;
      reject: (err?: Error) => void;
      resolve: (args: D | null) => void;
    };

    request.promise = new Promise<D | null>((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });

    this.#requests.set(payload.requestId, request);

    isOpen
      ? this.#webSocket!.send(JSON.stringify(payload))
      : this.#pending.push(() => this.#webSocket!.send(JSON.stringify(payload)));

    setTimeout(
      () => {
        if (!this.#requests.get(payload.requestId)) return;
        request.reject(
          isOpen ? new Error("Request timed out") : new Error("Was disconnected and could not reconnect !")
        );
        this.#requests.delete(payload.requestId);
      },
      isOpen ? 2500 : 10000
    );

    return request.promise;
  }

  createDatabase<T>(path: string): Database<T> {
    if (!this.webSocket) throw new Error(`Please call <DatabaseManager>.connect() before trying to create a database`);
    return new Database<T>(this, path);
  }
}
