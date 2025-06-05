/** @format */

import { WebSocketServer } from "ws";
import { Payload } from "./types.js";
import { Logger } from "pastel-logger";

const logger = new Logger();

const wss = new WebSocketServer({ port: 8080 });

wss.on("listening", () => logger.log("Server started"));

wss.on("connection", (ws, req) => {
  logger.log(`New connection established from ${req.socket.remoteAddress}`);

  ws.on("message", (message) => {
    const data = JSON.parse(message.toString()) as Payload;
    logger.log(`Received ${data.method} request for ${data.path}`);
  });

  ws.on("close", () => {
    logger.log(`Connection closed from ${req.socket.remoteAddress}`);
  });

  ws.on("error", (err) => {
    logger.error(JSON.stringify(err.stack));
  });
});
