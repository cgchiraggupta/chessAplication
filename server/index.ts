import { WebSocketServer, type WebSocket as WsSocket } from "ws";
import { gameManager } from "./managers/gameManager";

const PORT = Number(process.env.PORT) || 5555;
const wss = new WebSocketServer({ port: PORT });
wss.on("listening", () => console.log(`WebSocket server listening on port ${PORT}`));
wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is in use. Stop the other server (Ctrl+C in that terminal) or run: PORT=${PORT + 1} npm run dev`);
  } else console.error(err);
});

const mainGameManager = new gameManager();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);
  ws.on("close", function () {
    mainGameManager.handleDisconnect(ws);
  });
  ws.on("message", function message(data) {
    let event: { action: string; id?: WsSocket; gameObj?: unknown; move?: string; gameId?: string; sessionId?: string };
    try {
      event = JSON.parse(data.toString()) as typeof event;
    } catch {
      console.error("Invalid JSON from client");
      return;
    }
    event.id = ws;
    if (event.action == "createGame") {
      mainGameManager.addPlayerToLobby(event as never);
    } else if (event.action == "cancelSearch") {
      mainGameManager.removeFromLobby(ws);
    } else if (event.action == "makeMove" && event.gameObj != null && event.move != null) {
      mainGameManager.makeMove(event.gameObj as never, event.move, ws);
    } else if (event.action == "resign" && event.gameObj != null) {
      mainGameManager.resign(event.gameObj as never, ws);
    } else if (event.action == "leaveGame" && event.gameId != null) {
      mainGameManager.leaveGame(event.gameId, ws);
    } else if (event.action == "rejoin" && event.sessionId != null) {
      mainGameManager.rejoin(event.sessionId, ws);
    }
  });
  console.log("Player connected");
  ws.send("connected to the game server");
});
