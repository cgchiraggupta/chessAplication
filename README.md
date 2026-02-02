# Chess Application

A real-time multiplayer chess game with a **Next.js** frontend and a **WebSocket** backend. Players connect to the server, enter a lobby, get matched into games, and play chess with live board sync.

---

## Project structure

```
chessAplication/
├── client/          # Next.js 16 frontend (React 19, Tailwind CSS)
│   ├── app/         # App Router: page.tsx, layout.tsx, globals.css
│   └── ...
├── server/          # Node.js WebSocket server (TypeScript)
│   ├── index.ts     # WebSocket server entry, event routing
│   └── managers/
│       ├── gameManager.ts   # Lobby, matchmaking, Game instances
│       └── moveManager.ts  # Chess rules (chess.js), move validation
└── README.md
```

- **Backend** (you built this): WebSocket server on port **8080**, lobby-based matchmaking, one `Game` per two players, FEN-based game state, move validation via `chess.js`.
- **Frontend** (from create-next-app): Connects to `ws://localhost:8080`, loads chessboard (chessboard.js + chess.js from CDN), “Play a rapid game” to join lobby; when matched, shows board and sends moves as SAN.

---

## Tech stack

| Layer    | Tech |
|----------|------|
| **Server** | Node.js, `ws`, TypeScript, `chess.js`, `nodemon` |
| **Client** | Next.js 16, React 19, Tailwind CSS 4, chessboard.js (CDN), chess.js (CDN) |

---

## Prerequisites

- **Node.js** (v18+ recommended)
- **npm** (or yarn/pnpm)

---

## Running the app

You need **both** the server and the client.

### 1. Server (port 8080)

The server runs from **compiled** JavaScript in `dist/`. There is no `build` script in `package.json` yet, so compile and run like this:

```bash
cd server
npm install
npx tsc
npm run dev
```

- `npx tsc` compiles TypeScript from `server/` into `server/dist/`.
- `npm run dev` runs `nodemon dist/index.js` (restarts on file changes; you still need to run `tsc` again after editing `.ts` files).

**Optional:** add a build script so you can run `npm run build` then `npm run dev`:

```json
"scripts": {
  "build": "tsc",
  "dev": "nodemon dist/index.js"
}
```

### 2. Client (port 3000)

```bash
cd client
npm install
npm run dev
```

Then open **http://localhost:3000**. The client expects the WebSocket server at **ws://localhost:8080**.

---

## WebSocket API (server ↔ client)

- **Client → Server**
  - **Create game / join lobby**
    - `{ "action": "createGame", "username": "<name>", "timeControl": "rapid" }`
  - **Make move**
    - `{ "action": "makeMove", "gameObj": { "gameId", "color", "opponent", "gameState" }, "move": "<SAN>" }`  
    - Example: `"move": "e4"`.

- **Server → Client**
  - **Connection:** plain text `"connected to the game server"`.
  - **Matched into a game:** JSON `{ "gameId", "color", "opponent", "gameState" }` (FEN).
  - **After each move:** same JSON with updated `gameState`.
  - **Game over:** `{ "state": "<FEN>", "message": "game is over" }`.
  - **Errors (lobby/game):** plain text, e.g. `"you are already in a game play that"`, `"not your turn rn"`, invalid-move message.

Game state is **FEN**; the server uses `chess.js` in `moveManager` to validate moves and update state.

---

## Current behavior (quick reference)

- **Lobby:** First two players sending `createGame` are paired; each gets a `Game` with random white/black and initial FEN.
- **Play:** Each client has a board (orientation by color). Moves are validated locally with chess.js and sent as SAN; server re-validates and broadcasts new FEN to both players.
- **Frontend:** Single page: connection status, script load status, “Play a rapid game”, and when in a game: game id, your color, opponent, and the board. Username is currently hardcoded in `page.tsx` (e.g. `"chiraggupta"`).

---

## Branches

- **main (or default):** Current state as above.
- **ui-revamp:** Branch for UI/UX improvements (e.g. layout, styling, flows). The core client/server behavior is the same; this branch is for making the frontend better.

---

## Possible next steps

- Add a `build` script in `server/package.json` and document `npm run build` in this README.
- On **ui-revamp:** improve layout (e.g. hide raw “Messages”, clean up status text), optional username input, and better game-over/not-your-turn feedback.
- Consider moving chess logic to the server only (client sends from/to or SAN, server is source of truth) to avoid desyncs if you add more features later.

---

## License

Private / unlicensed unless you add one.
