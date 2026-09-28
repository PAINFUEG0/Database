/** @format */

import { WebSocket } from "ws";
import { randomUUID } from "crypto";

import type { DatabaseClient } from "./databaseClient.js";
import type { Protocols, DatabaseClientRequest, DatabaseServerResponse } from "../types.js";

export function requestFactory(this: DatabaseClient) {
  return async <P>(path: string, PL: Protocols<P>[keyof Protocols<P>]["req"]): Promise<P> => {
    const requestId = randomUUID();
    const request = <DatabaseClientRequest<P>>{ ...Promise.withResolvers<P>() };

    if (this.mode === "ws") {
      if (this.webSocket?.readyState !== WebSocket.OPEN)
        throw new Error(`Connection to database server is not open yet / is closing / is closed !`);

      this.requests.set(requestId, request);
      this.webSocket!.send(JSON.stringify({ ...PL, requestId, path }));
    } else {
      const raw = await fetch(this.address, {
        method: "POST",
        body: JSON.stringify({ ...PL, path }),
        headers: { "Content-Type": "application/json", Authorization: this.auth }
      });
      const res = await (<Promise<DatabaseServerResponse<P>>>raw.json());
      "error" in res ? request.reject(new Error(res.error)) : request.resolve(res.data);
    }

    request.timeout = setTimeout(() => {
      this.requests.delete(requestId);
      request.reject(new Error("Request timed out after 60 seconds."));
    }, 60000);

    return request.promise;
  };
}
