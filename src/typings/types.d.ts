/** @format */

export interface ChildEvents {
  error: [err: Error];
  disconnected: [address: string];
}

export type Response = { data: null | string; requestId: string };

export type Payload =
  | { path: string; method: "ALL"; requestId: string }
  | { path: string; key: string; method: "GET" | "DELETE"; requestId: string }
  | { key: string; path: string; value: any; method: "SET"; requestId: string };
