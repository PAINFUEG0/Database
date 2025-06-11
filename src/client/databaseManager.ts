/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Database } from "./database.js";

import type { ChildEvents, Payload, Response } from "../typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  #auth: string;
  #requests = new Map();
  #webSocket?: WebSocket;
  #socketAddress: string;

  constructor(socketAddress: string, auth: string) {
    super();
    this.#auth = auth;
    this.#socketAddress = socketAddress;
  }

  async connect() {
    this.#webSocket = new WebSocket(this.#socketAddress, { headers: { Authorization: this.#auth } });

    await new Promise((resolve) => this.#webSocket?.once("open", resolve));

    this.#webSocket!.on("message", (message) => {
      const data = JSON.parse(message.toString()) as Response;
      this.#requests.get(data.requestId)?.resolve(data.data);
      this.#requests.delete(data.requestId);
    });
    this.#webSocket.on("error", (err) => this.emit("error", err));
    this.#webSocket.once("close", () => this.emit("disconnected", this.#socketAddress));
  }

  /**
   * @requires {@linkcode DatabaseManager#connect} to be called and awaited
   * @throws if webSocket connection is not open i.e is closed or connecting or closing
   */
  async makeReq<D>(payload: Payload) {
    if (this.#webSocket?.readyState !== WebSocket.OPEN)
      throw new Error("Websocket connection has already been closed !");

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
    this.#webSocket!.send(JSON.stringify(payload));

    setTimeout(() => {
      if (!this.#requests.get(payload.requestId)) return;
      request.reject(new Error("Request timed out"));
      this.#requests.delete(payload.requestId);
    }, 2500);

    return request.promise;
  }

  /**
   * @description Creates a new database with the given path
   * @requires {@linkcode DatabaseManager#connect} to be called and awaited
   * @throws if webSocket connection is not open i.e is closed or connecting or closing
   */
  createDatabase<T>(path: string): Database<T> {
    if (this.#webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseManager>.connect()" before trying to create a database !`);
    return new Database<T>(this, path);
  }
}
