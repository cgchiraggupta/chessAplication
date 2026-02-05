# Chess Application

A real-time multiplayer chess game with a **Next.js** frontend and a **WebSocket** backend. Players connect, enter a username, get matched in a lobby, and play chess with live board sync. Supports resign, leave game, cancel search, and reconnect by session.

---

## Project structure

```
chessAplication/
├── client/                 # Next.js 16 frontend (React 19, Tailwind CSS)
│   ├── app/
│   │   ├── page.tsx        # Main page: WebSocket, lobby, game view
│   │   ├── layout.tsx      # Root layout, fonts
│   │   ├── globals.css     # Theme variables, board styles
│   │   └── components/
│   │       ├── LobbyView.tsx   # Username, Find game, Cancel, waiting state
│   │       └── GameView.tsx   # Board, opponent, turn, Resign, Leave game
│   └── ...
├── server/
│   ├── index.ts            # WebSocket server, port, event routing
│   └── managers/
│       ├── gameManager.ts  # Lobby, matchmaking, Game instances, rejoin, resign, leave
│       └── moveManager.ts  # Chess rules (chess.js), move validation
└── README.md
```

---

## Tech stack

| Layer   | Tech |
|--------|------|
| **Server** | Node.js, `ws`, TypeScript, `chess.js`, nodemon |
| **Client** | Next.js 16, React 19, Tailwind CSS 4, chessboard.js (CDN), chess.js (CDN) |

---

## Prerequisites

- **Node.js** (v18+)
- **npm** (or yarn/pnpm)

---

## Branches and ports (important)

| Branch | Server port | Client WS URL | Has LobbyView/GameView? |
|--------|-------------|---------------|--------------------------|
| **main** | 8080 | ws://localhost:8080 | No |
| **ui-revamp** | 8080 | ws://localhost:8080 | No |
| **fix/chessboard-init-error** | **5555** | **ws://localhost:5555** | Yes |

**If nothing runs or client stays "Disconnected":** You must run server and client from the **same branch**, and use that branch’s port. This README describes **fix/chessboard-init-error** (port 5555). For **main** or **ui-revamp** use port 8080.

---

## How to run

Run **both** the server and the client (from repo root).

### 1. Server (port 5555 on this branch)

```bash
cd server
npm install
npx tsc
npm run dev
```

- `npx tsc` compiles TypeScript to `server/dist/`.
- `npm run dev` runs `nodemon dist/index.js` (auto-restart on file changes; run `tsc` again after editing `.ts`).

Server listens on **5555** by default. Override with `PORT=5556 npm run dev` if needed.

### 2. Client (port 3000)

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:3000**. The client connects to **ws://localhost:5555** by default. For production, set `NEXT_PUBLIC_WS_URL` (e.g. `wss://your-server.com`).

**If you get "port in use" or client never connects:**  
- Kill whatever is on that port, e.g. `lsof -i :5555` then `kill <PID>`, or use another port: `PORT=5556 npm run dev` in server and set client to 5556 (e.g. `NEXT_PUBLIC_WS_URL=ws://localhost:5556` in client).

---

## WebSocket API (server ↔ client)

**Client → Server**

| Action        | Payload |
|---------------|---------|
| Join lobby    | `{ "action": "createGame", "username": "<name>", "timeControl": "rapid", "sessionId": "<uuid>" }` |
| Cancel search | `{ "action": "cancelSearch" }` |
| Make move     | `{ "action": "makeMove", "username", "move": "<SAN>", "gameObj": { "gameId", "color", "opponent", "gameState" }, "timeControl": "rapid" }` |
| Resign        | `{ "action": "resign", "gameObj": { "gameId", "color", "opponent", "gameState" } }` |
| Leave game    | `{ "action": "leaveGame", "gameId": "<id>" }` |
| Rejoin game   | `{ "action": "rejoin", "sessionId": "<uuid>" }` |

**Server → Client**

- Connection: plain text `"connected to the game server"`.
- Matched: JSON `{ "gameId", "color", "opponent", "gameState" }` (FEN).
- After each move: same shape with updated `gameState`.
- Game over: `{ "state": "<FEN>", "message": "game is over", "reason": "resign" | "opponent_left" }` (or no reason for checkmate/draw).
- Rejoin: same as matched payload, or `{ "message": "no game to rejoin" }`.
- Errors: plain text, e.g. `"Invalid username"`, `"you are already in a game play that"`, `"Unauthorized"`.

Game state is **FEN**; the server uses `chess.js` in `moveManager` to validate moves and update state. Username is validated on client and server (length ≤ 20, pattern `[a-zA-Z0-9_-]+`). Moves, resign, and leave are authorized by verifying the WebSocket is the player’s socket for that game.

---

## Features

- **Lobby:** Enter username, “Find a game” to join; first two players are paired with random white/black. “Cancel” to leave lobby.
- **Play:** Board with orientation by color; drag-and-drop moves; turn indicator; Resign and Leave game.
- **Reconnect:** Session ID in `localStorage`; on reconnect, client sends `rejoin` with `sessionId` to reattach to the same game.
- **Security:** SRI on CDN scripts; strong session IDs; server-side username validation and socket checks for moves/resign/leave.

---

## Branches

- **main:** Default branch.
- **ui-revamp:** UI/UX improvements (layout, styling, lobby/game views).
- **fix/chessboard-init-error:** Chessboard init fixes, connection status, security hardening, LobbyView/GameView split.

---

## License

See repository or add a `LICENSE` file (e.g. MIT).
