/** @format */

export * from "../shared.types.js";

export type RequestMode = "ws" | "rest";

export type DatabaseClientOptions = {
  host: string;
  port: number;
  passphrase: string;
  mode?: RequestMode;
  ssl?: ClientSslConfig;
  throwOnError?: boolean;
  throwOnDisconnect?: boolean;
  onError?: (err: Error) => void;
  onDisconnect?: (address: string) => void;
};

export type ClientSslConfig = { enabled: boolean; rejectUnauthorized?: boolean };

export type DatabaseServerResponse<T = unknown> = { requestId: string; data: T } | { requestId: string; error: string };

export type DatabaseClientRequest<T> = { promise: Promise<T>; timeout: NodeJS.Timeout; resolve: (args: T) => void; reject: (err?: Error) => void };
