/** @format */

import { actions } from "./helpers.js";
import { databases } from "./databaseServer.js";

import type { WebSocket, RawData } from "ws";

export async function handleIncomingWebsocketMessages(this: WebSocket, raw: RawData, onStderr: (err: string) => void) {
  const PL = JSON.parse(raw.toString());

  const { path, requestId } = PL;
  const db = databases.get(path);

  try {
    if (!db && PL.method !== "INIT") throw new Error(`No database with path '${path}' exists !`);
    // @ts-expect-error loose typings
    const data = await actions[PL.method](db, PL);
    this.send(JSON.stringify({ requestId, data }));
  } catch (error) {
    error = error instanceof Error ? error.message : error;
    onStderr(typeof error === "string" ? error : JSON.stringify(error));
    this.send(JSON.stringify({ requestId, error }));
  }
}
