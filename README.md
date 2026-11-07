<!-- @format -->

# Database

A small key-value database with a server and a client. The client connects over WebSocket or REST and gives you a typed API for working with databases.

## Quick start

Start the server:

```ts
import { DatabaseServer } from "<package>";

const server = new DatabaseServer({ port: 3000, passphrase: "your-secret" });
await server.boot();
```

Connect to your database server from a client:

```ts
import { DatabaseClient } from "<package>";

const client = new DatabaseClient({ host: "localhost", port: 3000, passphrase: "your-secret" });
await client.connect();

const users = await client.createDatabase("users");

await users.set("user-1", { name: "Ada" });
const user = await users.get("user-1");
```

The `host` option is a hostname or IP address. Do not include `http://`, `https://`, `ws://`, or `wss://`.

## Server

### `new DatabaseServer(options)`

| Option                   | Type                     | Required   | Description                                                  |
| ------------------------ | ------------------------ | ---------- | ------------------------------------------------------------ |
| `port`                   | `number`                 | Yes        | Port to listen on.                                           |
| `passphrase`             | `string`                 | Yes        | Shared secret required by clients.                           |
| `ssl`                    | `object`                 | No         | Enables HTTPS and secure WebSocket when provided.            |
| `ssl.key`                | `string`                 | With `ssl` | Path to the private key file.                                |
| `ssl.cert`               | `string`                 | With `ssl` | Path to the certificate file.                                |
| `ssl.rejectUnauthorized` | `boolean`                | No         | TLS certificate verification setting.                        |
| `onStdout`               | `(data: string) => void` | No         | Receives server status messages. Defaults to `console.log`.  |
| `onStderr`               | `(err: string) => void`  | No         | Receives server error messages. Defaults to `console.error`. |

### `server.boot()`

Starts the server and returns the port it is listening on:

```ts
const port = await server.boot();
```

The server accepts REST requests at `/rest` and WebSocket connections at `/ws`.

## Client

### `new DatabaseClient(options)`

| Option                   | Type                        | Required | Description                                                          |
| ------------------------ | --------------------------- | -------- | -------------------------------------------------------------------- |
| `host`                   | `string`                    | Yes      | Server hostname or IP address, without a protocol.                   |
| `port`                   | `number`                    | Yes      | Server port.                                                         |
| `passphrase`             | `string`                    | Yes      | Must match the server passphrase.                                    |
| `mode`                   | `"ws" \| "rest"`            | No       | Connection mode. Defaults to `"ws"`.                                 |
| `ssl.enabled`            | `boolean`                   | No       | Use HTTPS or secure WebSocket.                                       |
| `ssl.rejectUnauthorized` | `boolean`                   | No       | TLS certificate verification setting.                                |
| `throwOnError`           | `boolean`                   | No       | Throw client errors instead of passing them to `onError`.            |
| `throwOnDisconnect`      | `boolean`                   | No       | Throw on WebSocket disconnection instead of calling `onDisconnect`.  |
| `onError`                | `(err: Error) => void`      | No       | Handles client errors when `throwOnError` is `false`.                |
| `onDisconnect`           | `(address: string) => void` | No       | Handles WebSocket disconnection when `throwOnDisconnect` is `false`. |

When an error or disconnect callback is supplied, the corresponding `throwOn...` option defaults to `false`. Otherwise, it defaults to `true`.

### `client.connect()`

Opens the WebSocket connection. Call this before creating databases when using the default `"ws"` mode.

In `"rest"` mode, this method does nothing and does not need to be called.

### `client.createDatabase<T>(path, options?)`

Creates or opens a database and returns a `Database<T>` instance.

```ts
const settings = await client.createDatabase("settings");
```

The path must be relative and must resolve inside the server's storage directory. Use a different path for each database.

Options:

| Option             | Type         | Description                                                                                                                  |
| ------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `schema`           | `ZodType<T>` | Optional Zod schema used to validate values written to the database. The returned database type is inferred from the schema. |
| `keysPerFile`      | `number`     | Maximum number of keys stored in each data file.                                                                             |
| `debounceTime`     | `number`     | Delay, in milliseconds, before queued writes are flushed.                                                                    |
| `maxDebounceCount` | `number`     | Number of queued writes that triggers a flush.                                                                               |

The storage options are optional. Their defaults are `100` for `keysPerFile`, `250` for `debounceTime`, and `100` for `maxDebounceCount`.

Example with a schema:

```ts
import { z } from "zod";

const User = z.object({
  name: z.string(),
  age: z.number()
});

const users = await client.createDatabase("users", {
  schema: User
});

// `user` is inferred from the schema.
const user = await users.get("user-1");
```

## Database methods

`createDatabase()` returns a database instance. Values are stored by string key.

### Read and write

| Method             | Description                                                                   | Returns                      |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------- |
| `all()`            | Gets all key-value pairs.                                                     | `Promise<Record<string, T>>` |
| `has(key)`         | Checks whether a key exists.                                                  | `Promise<boolean>`           |
| `hasMany(keys)`    | Checks several keys.                                                          | `Promise<boolean[]>`         |
| `get(key)`         | Gets a value. Returns `null` if the key does not exist.                       | `Promise<T \| null>`         |
| `getMany(keys)`    | Gets several values in the same order as the keys. Missing values are `null`. | `Promise<(T \| null)[]>`     |
| `set(key, value)`  | Creates or replaces a value.                                                  | `Promise<T>`                 |
| `setMany(data)`    | Creates or replaces several values.                                           | `Promise<T[]>`               |
| `delete(key)`      | Deletes a key.                                                                | `Promise<boolean>`           |
| `deleteMany(keys)` | Deletes several keys.                                                         | `Promise<boolean[]>`         |

`setMany()` accepts an array of `{ key, value }` objects.

### Array values

These methods operate on a value that is an array. If the key does not exist, it is treated as an empty array. They are only suitable for array values.

| Method                                       | Description                                          | Returns                                                                 |
| -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| `length(key)`                                | Gets the array length.                               | `Promise<number>`                                                       |
| `push(key, ...items)`                        | Adds items to the end.                               | `Promise<{ elements: T[number][], length: number }>`                    |
| `unshift(key, ...items)`                     | Adds items to the beginning.                         | `Promise<{ elements: T[number][], length: number }>`                    |
| `pop(key)`                                   | Removes the last item.                               | `Promise<{ element?: T[number], length: number }>`                      |
| `shift(key)`                                 | Removes the first item.                              | `Promise<{ element?: T[number], length: number }>`                      |
| `slice(key, start, end?)`                    | Returns a portion without changing the stored array. | `Promise<{ elements: T[number][] }>`                                    |
| `splice(key, start, deleteCount?, ...items)` | Removes and/or inserts items.                        | `Promise<{ removed: T[number][], added: T[number][], length: number }>` |

### Boolean and number values

| Method                   | Description                                       | Returns            |
| ------------------------ | ------------------------------------------------- | ------------------ |
| `toggle(key)`            | Changes a boolean value to its opposite.          | `Promise<boolean>` |
| `increment(key, count?)` | Adds `count` to a number. Defaults to `1`.        | `Promise<number>`  |
| `decrement(key, count?)` | Subtracts `count` from a number. Defaults to `1`. | `Promise<number>`  |

`toggle()` requires an existing boolean value. `increment()` and `decrement()` treat a missing key as `0`. These methods reject values of the wrong type.

## Notes

- Database operations return promises; use `await` or handle rejections.
- Keys must be non-empty strings and cannot exceed 255 characters.
- Values written with a schema must pass its validation.
- The server and client must use the same passphrase.
