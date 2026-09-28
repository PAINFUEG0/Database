/** @format */

import { actions, cors, getBody } from "./helpers.js";
import { databases } from "./databaseServer.js";

import type { IncomingMessage, ServerResponse } from "node:http";

export async function handleRestRequests(req: IncomingMessage, res: ServerResponse, onStderr: (err: string) => void) {
  cors(res);

  const PL = JSON.parse(await getBody(req));
  const db = databases.get(PL.path)!;

  try {
    // @ts-expect-error loose typings
    const data = await actions[PL.method](db, PL);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data }));
  } catch (error) {
    error = error instanceof Error ? error.message : error;
    onStderr(JSON.stringify(error));
    res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error }));
  }
}
