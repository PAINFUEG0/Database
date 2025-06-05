/** @format */

export type Payload =
  | { path: string; key: string; method: "GET" | "DELETE" }
  | { key: string; path: string; value: string; method: "SET" };

export type Response = { data: null; status: 404 } | { data: string; status: 200 };
