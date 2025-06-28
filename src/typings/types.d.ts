/** @format */

export interface ChildEvents {
  error: [err: Error];
  disconnected: [address: string];
}

export type Response = { data: unknown; requestId: string };

export type Payload =
  | { path: string; method: "ALL"; requestId: string }
  | { path: string; method: "GET" | "DELETE"; key: string; requestId: string }
  | { path: string; method: "SET"; key: string; value: unknown; requestId: string }
  | { path: string; method: "GET_MANY" | "DELETE_MANY"; keys: string[]; requestId: string }
  | { path: string; method: "SET_MANY"; data: { key: string; value: unknown }[]; requestId: string };
