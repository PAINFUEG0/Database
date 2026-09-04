/** @format */

import type { Server, IncomingMessage, ServerResponse } from "node:http";

export function handleRestRequests(this: Server, req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE");

  switch (req.method) {
    case "GET":
      switch (req.url) {
        case "/":
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify("Process uptime is: " + process.uptime()));
          break;

        default:
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not Found" }));
          break;
      }
      break;

    default:
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method Not Allowed" }));
      break;
  }
}
