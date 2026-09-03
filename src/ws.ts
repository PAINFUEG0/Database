/** @format */

import type { WebSocket, RawData } from "ws";

export function handleIncomingWebsocketMessage(this: WebSocket, data: RawData, isBinary: boolean) {
  console.log({ isBinary, data: data.toString() });
}
