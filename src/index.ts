/** @format */

import { CoreDatabase } from "./core";
import { DatabaseServer } from "./databaseServer";
import { DatabaseManager } from "./databaseManager";

export class Database {
  construct<T = unknown, M extends "standalone" | "server" | "client" = "standalone">(
    mode: M,
    ...options: M extends "server"
      ? ConstructorParameters<typeof DatabaseServer>
      : M extends "client"
        ? ConstructorParameters<typeof DatabaseManager>
        : ConstructorParameters<typeof CoreDatabase<T>>
  ): M extends "server" ? DatabaseServer : M extends "client" ? DatabaseManager : CoreDatabase<T> {
    //@ts-expect-error none
    if (mode === "server") return new DatabaseServer(...options) as any;
    //@ts-expect-error none
    if (mode === "client") return new DatabaseManager(...options) as any;
    //@ts-expect-error none
    return new CoreDatabase<T>(...options) as any;
  }
}
