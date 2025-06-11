/** @format */

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { Database } from "./database.js";

import type { ChildEvents, Response } from "../typings/types.js";

export class DatabaseManager extends EventEmitter<ChildEvents> {
  auth: string;
  requests = new Map();
  webSocket?: WebSocket;
  socketAddress: string;

  constructor(socketAddress: string, auth: string) {
    super();
    this.auth = auth;
    this.socketAddress = socketAddress;
  }

  async connect() {
    this.webSocket = new WebSocket(this.socketAddress, { headers: { Authorization: this.auth } });

    await new Promise((resolve) => this.webSocket?.once("open", resolve));

    this.webSocket!.on("message", (message) => {
      const data = JSON.parse(message.toString()) as Response;
      this.requests.get(data.requestId)?.resolve(data.data);
      this.requests.delete(data.requestId);
    });
    this.webSocket.on("error", (err) => this.emit("error", err));
    this.webSocket.once("close", () => this.emit("disconnected", this.socketAddress));
  }

  /**
   * @description Creates a new database with the given path
   * @requires {@linkcode DatabaseManager#connect} to be called and awaited
   * @throws if webSocket connection is not open i.e is closed or connecting or closing
   */
  createDatabase<T>(path: string): Database<T> {
    if (this.webSocket?.readyState !== WebSocket.OPEN)
      throw new Error(`Please do "await <DatabaseManager>.connect()" before trying to create a database !`);
    return new Database<T>(this, path);
  }
}
