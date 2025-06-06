/** @format */

export type Payload =
  | { path: string; key: string; method: "GET" | "DELETE"; requestId: string }
  | { key: string; path: string; value: string; method: "SET"; requestId: string };

export type Response =
  | { data: null; status: 404; requestId: string }
  | { data: string; status: 200; requestId: string };

export interface ChildEvents {
  error: [err: Error];
  connected: [address: string];
  disconnected: [address: string];
  dropped: [path: string, payload: string, reason: string];
}
