# DevFest Messenger Chat

A tiny realtime chat app: a single-binary Go server that upgrades `/ws` to a
WebSocket, fans messages out to every connected client, and replays the
in-memory history to anyone who joins late. The frontend is plain HTML +
Tailwind (browser build) + vanilla JS.

## Features

- **Realtime broadcast** — every message is delivered to all connected clients.
- **History replay** — new clients immediately receive all prior messages.
- **No build step** — the frontend is static files served by the same binary.
- **Dark / light theme** — persisted in `localStorage`.
- **Sticky identity** — a random user ID and a prompted display name are stored
  in `localStorage`, so reloads keep you "you".
- **Messenger-style UI** — own messages on the right, others on the left,
  multi-line support, auto-resizing composer, Enter to send.
- **HTML-escaped rendering** — message text is escaped before insertion.

## Requirements

- Go 1.22 or newer (the project uses method-based `ServeMux` routing).
- A modern browser.

Dependency: [`github.com/coder/websocket`](https://github.com/coder/websocket).

## Project structure

```
.
├── .gitignore
├── go.mod
├── go.sum
├── cmd/
│   └── main.go              # entrypoint: mux, routes, server startup
├── internal/
│   └── modules/
│       └── chat/
│           └── hub.go       # Hub: clients, history, broadcast, WS handler
└── static/
    ├── index.html           # layout + Tailwind browser build
    └── app.js               # theme, identity, WS client, rendering
```

## Run it

```bash
go mod download
go run ./cmd
```

Then open <http://localhost:8080>.

To build a binary (ignored by `.gitignore`):

```bash
go build -o main ./cmd
./main
```

## Routes

| Method | Path  | Handler                       |
| ------ | ----- | ----------------------------- |
| GET    | `/ws` | WebSocket upgrade + chat loop |
| GET    | `/`   | Static files from `./static`  |

## Message format

The client sends JSON over the socket, and the server rebroadcasts the exact
same payload to everyone (after storing it):

```json
{
  "id": "user_x7f3k2a",
  "name": "Alice",
  "text": "Hello DevFest!",
  "time": "Nov 5, 10:42 AM"
}
```

Fields:

| Field  | Type   | Description                                   |
| ------ | ------ | --------------------------------------------- |
| `id`   | string | Client-generated stable user ID               |
| `name` | string | Display name shown above other users' bubbles |
| `text` | string | Message body (multi-line allowed)             |
| `time` | string | Preformatted timestamp from the sender        |

The sender's `id` is compared against the local `myId` to decide whether a
bubble renders on the right ("mine") or the left ("theirs").

## How it works

1. `cmd/main.go` builds an explicit `http.ServeMux`, registers `GET /ws` and a
   catch-all `GET /` file server, then calls `ListenAndServe(":8080", mux)`.
2. `chat.Hub` holds a `map[*websocket.Conn]bool` and a `[]Message` slice behind
   a single `sync.Mutex`.
3. On connect, `Register` adds the connection and writes the stored history
   back to that client before the read loop begins.
4. Each inbound frame is unmarshalled, appended to history, then broadcast to a
   snapshot of the client list. Write failures close and unregister that
   connection.
5. `Unregister` runs on disconnect via `defer` in `HandleWebSocket`.

## Notes and limitations

This is a demo, not a production chat server:

- **No persistence** — history lives in RAM and is lost on restart.
- **Single process only** — the in-memory hub is not shared across instances.
- **Open CORS** — `OriginPatterns: []string{"*"}` accepts any origin. Restrict
  this before deploying publicly.
- **No auth or rate limiting** — anyone can connect and send anything. The
  `id`/`name` fields are entirely client-controlled.
- **Unbounded history** — `h.messages` grows forever; add a cap or ring buffer
  if you expect long-running sessions.
- **Per-connection lock contention** — `Broadcast` writes to connections
  serially while holding no lock (it uses a snapshot), so one slow client can
  stall the fan-out loop. Consider per-client send queues for real workloads.
