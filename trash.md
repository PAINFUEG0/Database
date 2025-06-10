<!-- @format -->

| **Trigger / Cause**                                 | **`error` Event** | **`close` Event** | **Notes**                                                          |
| --------------------------------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------ |
| **Server unreachable (e.g. ECONNREFUSED)**          | ✅ Yes            | ❌ No             | Connection never established, only `error` is emitted.             |
| **Invalid WebSocket upgrade response (e.g. 403)**   | ✅ Yes            | ❌ No             | Happens during the initial handshake; connection rejected.         |
| **TLS/SSL issues (invalid cert)**                   | ✅ Yes            | ❌ No             | Secure WS (wss\://) with bad cert will trigger an `error`.         |
| **Malformed WebSocket frames / protocol violation** | ✅ Yes            | ✅ Yes            | `error` is triggered, then `close` follows automatically.          |
| **Server closes connection normally**               | ❌ No             | ✅ Yes            | Server sends a proper close frame.                                 |
| **Client calls `ws.close()`**                       | ❌ No             | ✅ Yes            | Clean closure initiated by client.                                 |
| **Server crashes or drops TCP connection**          | ✅ Sometimes      | ✅ Yes            | If it's abrupt, `error` might occur first (e.g., `ECONNRESET`).    |
| **Network failure / sudden disconnection**          | ✅ Sometimes      | ✅ Yes            | Depends on OS and how the disconnection is detected.               |
| **Client times out waiting for a response**         | ✅ Yes            | ✅ Maybe          | Timeout logic is often app-defined; `error` if manually thrown.    |
| **Invalid data sent by server**                     | ✅ Yes            | ✅ Yes            | E.g., UTF-8 violation in text frame.                               |
| **Ping/pong timeout**                               | ❌ No             | ✅ Yes            | If server doesn’t respond to ping (if enabled), connection closes. |
| **Bad URL or malformed WebSocket address**          | ✅ Yes            | ❌ No             | Immediately throws on connection attempt.                          |
| **DNS resolution failure**                          | ✅ Yes            | ❌ No             | Hostname can’t be resolved.                                        |
