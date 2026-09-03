/** @format */

export type SerializableDataTypes =
  | number
  | string
  | boolean
  | SerializableDataTypes[]
  | { [K: string]: SerializableDataTypes };

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type BasePayload = { path: string; requestId: string };

export type Payload = Prettify<
  BasePayload &
    (
      | { method: "ALL" }
      | { method: "SET"; key: string; value: any }
      | { method: "GET" | "DELETE" | "HAS"; key: string }
      | { method: "GET_MANY" | "DELETE_MANY"; keys: string[] }
      | { method: "SET_MANY"; data: { key: string; value: any }[] }
    )
>;
