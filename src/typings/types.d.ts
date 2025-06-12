/** @format */

export interface ChildEvents {
  error: [err: Error];
  disconnected: [address: string];
}

export type Response = { data: any; requestId: string };

export type Payload =
  | { path: string; method: "ALL"; requestId: string }
  | { path: string; method: "GET" | "DELETE"; key: string; requestId: string }
  | { path: string; method: "SET"; key: string; value: any; requestId: string };
