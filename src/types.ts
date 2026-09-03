/** @format */

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type BasePayload = { path: string; requestId: string };

export type PayloadOverloads =
  | { method: "ALL" }
  | { method: "SET"; key: string; value: any }
  | { method: "GET" | "DELETE" | "HAS"; key: string }
  | { method: "GET_MANY" | "DELETE_MANY"; keys: string[] }
  | { method: "SET_MANY"; data: { key: string; value: any }[] };

export type Payload = Prettify<BasePayload & PayloadOverloads>;

export type DatabaseClientRequest<T> = {
  promise: Promise<T>;
  timeout: NodeJS.Timeout;
  resolve: (args: T) => void;
  reject: (err?: Error) => void;
};

export type DatabaseServerResponse<T = unknown> = { requestId: string; data: T } | { requestId: string; error: string };
