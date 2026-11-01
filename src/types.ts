/** @format */

export type RequestMode = "ws" | "rest";

export type KVstoreOptions = {
  path: string;
  keysPerFile?: number;
  debounceTime?: number;
  maxDebounceCount?: number;
};

export type DatabaseClientOptions = {
  host: string;
  port: number;
  secure?: boolean;
  passphrase: string;
  mode?: RequestMode;
  throwOnError?: boolean;
  throwOnDisconnect?: boolean;
  onError?: (err: Error) => void;
  onDisconnect?: (address: string) => void;
};

export type DatabaseServerOptions = {
  port: number;
  passphrase: string;
  onStderr?: (err: string) => void;
  onStdout?: (data: string) => void;
  ssl?: { key: string; cert: string };
};

export type DatabaseClientRequest<T> = {
  promise: Promise<T>;
  timeout: NodeJS.Timeout;
  resolve: (args: T) => void;
  reject: (err?: Error) => void;
};

export type Protocols<T = unknown> = {
  INIT: { req: { method: "INIT"; options: Omit<KVstoreOptions, "path"> }; res: boolean };

  ALL: { req: { method: "ALL" }; res: { [key: string]: T } };

  HAS: { req: { method: "HAS"; key: string }; res: boolean };
  HAS_MANY: { req: { method: "HAS_MANY"; keys: string[] }; res: Protocols<T>["HAS"]["res"][] };

  GET: { req: { method: "GET"; key: string }; res: T | null };
  GET_MANY: { req: { method: "GET_MANY"; keys: string[] }; res: Protocols<T>["GET"]["res"][] };

  DELETE: { req: { method: "DELETE"; key: string }; res: boolean };
  DELETE_MANY: { req: { method: "DELETE_MANY"; keys: string[] }; res: Protocols<T>["DELETE"]["res"][] };

  SET: { req: { method: "SET"; key: string; value: T }; res: T };
  SET_MANY: { req: { method: "SET_MANY"; data: { key: string; value: T }[] }; res: Protocols<T>["SET"]["res"][] };

  LENGTH: { req: { method: "LENGTH"; key: string }; res: number };

  POP: { req: { method: "POP"; key: string }; res: { element?: El<T>; length: number } };
  SHIFT: { req: { method: "SHIFT"; key: string }; res: { element?: El<T>; length: number } };

  PUSH: { req: { method: "PUSH"; key: string; items: El<T>[] }; res: { elements: El<T>[]; length: number } };
  UNSHIFT: { req: { method: "UNSHIFT"; key: string; items: El<T>[] }; res: { elements: El<T>[]; length: number } };

  SLICE: { req: { method: "SLICE"; key: string; start: number; end?: number }; res: { elements: El<T>[] } };
  SPLICE: { req: { method: "SPLICE"; key: string; start: number; deleteCount?: number; items?: El<T>[] }; res: { removed: El<T>[]; added: El<T>[]; length: number } };

  TOGGLE: { req: { method: "TOGGLE"; key: string }; res: boolean };

  INCREMENT: { req: { method: "INCREMENT"; key: string; count?: number }; res: number };
  DECREMENT: { req: { method: "DECREMENT"; key: string; count?: number }; res: number };
};

export type DatabaseServerResponse<T = unknown> = { requestId: string; data: T } | { requestId: string; error: string };

export type El<T> = T extends (infer E)[] ? E : unknown extends T ? unknown : never;
export type IfNumber<T, Fn> = T extends number ? Fn : unknown extends T ? Fn : never;
export type IfBoolean<T, Fn> = T extends boolean ? Fn : unknown extends T ? Fn : never;
export type IfArray<T, Fn> = T extends unknown[] ? Fn : unknown extends T ? Fn : never;

export type Methods<T> = {
  POP: IfArray<T, (key: string) => Promise<Protocols["POP"]["res"]>>;
  SHIFT: IfArray<T, (key: string) => Promise<Protocols["SHIFT"]["res"]>>;
  LENGTH: IfArray<T, (key: string) => Promise<Protocols["LENGTH"]["res"]>>;
  PUSH: IfArray<T, (key: string, ...items: El<T>[]) => Promise<Protocols["PUSH"]["res"]>>;
  UNSHIFT: IfArray<T, (key: string, ...items: El<T>[]) => Promise<Protocols["UNSHIFT"]["res"]>>;
  SLICE: IfArray<T, (key: string, start: number, end?: number) => Promise<Protocols["SLICE"]["res"]>>;
  SPLICE: IfArray<T, (key: string, start: number, deleteCount?: number, ...items: El<T>[]) => Promise<Protocols["SPLICE"]["res"]>>;

  TOGGLE: IfBoolean<T, (key: string) => Promise<Protocols["TOGGLE"]["res"]>>;

  INCREMENT: IfNumber<T, (key: string, count?: number) => Promise<Protocols["INCREMENT"]["res"]>>;
  DECREMENT: IfNumber<T, (key: string, count?: number) => Promise<Protocols["DECREMENT"]["res"]>>;
};
