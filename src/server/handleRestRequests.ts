/** @format */

import { actions } from "./actions.js";
import { databases } from "./databaseServer.js";

import type { Server, IncomingMessage, ServerResponse } from "node:http";

export async function handleRestRequests(this: Server, req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");

  try {
    const PL = JSON.parse((await getBody(req)) || "{}");
    const db = databases.get(PL.path)!;

    // @ts-expect-error loose typings
    const data = await actions[PL.method](db, PL);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data }));
  } catch (error) {
    error = error instanceof Error ? error.message : error;
    res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error }));
  }
}

function getBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
