/** @format */

export * from "../shared.types.js";

export type DatabaseServerOptions = {
  port: number;
  passphrase: string;
  ssl?: ServerSslConfig;
  onStderr?: (err: string) => void;
  onStdout?: (data: string) => void;
};

export type ServerSslConfig = { key: string; cert: string; rejectUnauthorized?: boolean };
