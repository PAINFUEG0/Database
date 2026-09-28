/** @format */

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type RequestMode = "ws" | "rest";

export type KVstoreOptions = {
  path: string;
  keysPerFile?: number;
  debounceTime?: number;
  maxDebounceCount?: number;
};

export type DatabaseClientOptions = {
  url: string;
  port: number;
  auth: string;
  secure?: boolean;
  mode?: RequestMode;
  throwOnError?: boolean;
  throwOnDisconnect?: boolean;
  onError?: (err: Error) => void;
  onDisconnect?: (address: string) => void;
};

export type DatabaseServerOptions = {
  auth: string;
  port: number;
  onStderr?: (err: string) => void;
  onStdout?: (data: string) => void;
  ssl?: { key: string; cert: string; rejectUnauthorized?: boolean };
};

export type DatabaseClientRequest<T> = {
  promise: Promise<T>;
  timeout: NodeJS.Timeout;
  resolve: (args: T) => void;
  reject: (err?: Error) => void;
};

export type Protocols<T = unknown> = {
  INIT: { req: { method: "INIT"; options: Omit<KVstoreOptions, "path"> }; res: void };

  ALL: { req: { method: "ALL" }; res: { [key: string]: T } };

  HAS: { req: { method: "HAS"; key: string }; res: boolean };
  HAS_MANY: { req: { method: "HAS_MANY"; keys: string[] }; res: boolean[] };

  GET: { req: { method: "GET"; key: string }; res: T | null };
  GET_MANY: { req: { method: "GET_MANY"; keys: string[] }; res: (T | null)[] };

  SET: { req: { method: "SET"; key: string; value: T }; res: T };
  SET_MANY: { req: { method: "SET_MANY"; data: { key: string; value: T }[] }; res: T[] };

  DELETE: { req: { method: "DELETE"; key: string }; res: boolean };
  DELETE_MANY: { req: { method: "DELETE_MANY"; keys: string[] }; res: boolean[] };
};

export type DatabaseServerResponse<T = unknown> = { requestId: string; data: T } | { requestId: string; error: string };
