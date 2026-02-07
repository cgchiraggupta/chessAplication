import { WebSocketServer, type WebSocket as WsSocket } from "ws";
import type { IncomingMessage } from "http";
import { GameManager } from "./managers/gameManager";

// Configuration
const PORT = Number(process.env.PORT) || 5555;
const MAX_CONNECTIONS = Number(process.env.MAX_CONNECTIONS) || 1000;
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const RATE_LIMIT_MAX_MESSAGES = 10; // max messages per window
const MAX_MESSAGE_SIZE = 1024; // 1KB max message size
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000", "https://localhost:3000"];

// Rate limiting map: socket -> { count, windowStart }
const rateLimitMap = new WeakMap<WsSocket, { count: number; windowStart: number }>();

function isRateLimited(ws: WsSocket): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ws);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    entry = { count: 1, windowStart: now };
    rateLimitMap.set(ws, entry);
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX_MESSAGES) {
    return true;
  }
  return false;
}

// Origin validation
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  // In development, allow localhost
  if (process.env.NODE_ENV !== "production") {
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      return true;
    }
  }
  return ALLOWED_ORIGINS.includes(origin);
}

// Create WebSocket server with origin validation
const wss = new WebSocketServer({
  port: PORT,
  maxPayload: MAX_MESSAGE_SIZE,
  verifyClient: (info: { origin: string; req: IncomingMessage }, callback: (result: boolean, code?: number, message?: string) => void) => {
    // Check connection limit
    if (wss.clients.size >= MAX_CONNECTIONS) {
      callback(false, 503, "Server at capacity");
      return;
    }

    // Validate origin
    if (!isOriginAllowed(info.origin)) {
      console.warn(`Rejected connection from origin: ${info.origin}`);
      callback(false, 403, "Origin not allowed");
      return;
    }

    callback(true);
  },
});

wss.on("listening", () => {
  console.log(`WebSocket server listening on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`Max connections: ${MAX_CONNECTIONS}`);
});

wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is in use. Stop the other server (Ctrl+C in that terminal) or run: PORT=${PORT + 1} npm run dev`
    );
  } else {
    console.error("WebSocket server error:", err);
  }
});

const mainGameManager = new GameManager();

// Health check stats
let totalConnections = 0;
let totalMessages = 0;

// Graceful shutdown
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Graceful shutdown starting...`);

  // Notify all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ message: "server_shutdown", reason: "Server is restarting" }));
      client.close(1001, "Server shutting down");
    }
  });

  wss.close(() => {
    console.log("WebSocket server closed");
    process.exit(0);
  });

  // Force close after 5 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Message event interface with proper types
interface ClientMessage {
  action: string;
  username?: string;
  timeControl?: string;
  sessionId?: string;
  gameId?: string;
  move?: string;
  gameObj?: {
    gameId: string;
    color: "white" | "black";
    opponent: string;
    gameState: string;
  };
}

wss.on("connection", function connection(ws: WsSocket, req: IncomingMessage) {
  totalConnections++;

  ws.on("error", (err) => {
    console.error("WebSocket client error:", err.message);
  });

  ws.on("close", function () {
    mainGameManager.handleDisconnect(ws);
  });

  ws.on("message", function message(data) {
    // Rate limiting
    if (isRateLimited(ws)) {
      ws.send(JSON.stringify({ message: "Rate limited. Slow down." }));
      return;
    }

    totalMessages++;

    // Parse and validate message
    let event: ClientMessage;
    try {
      const raw = data.toString();
      if (raw.length > MAX_MESSAGE_SIZE) {
        ws.send(JSON.stringify({ message: "Message too large" }));
        return;
      }
      event = JSON.parse(raw) as ClientMessage;
    } catch {
      console.warn("Invalid JSON from client");
      return;
    }

    // Validate action field exists
    if (typeof event.action !== "string") {
      ws.send(JSON.stringify({ message: "Invalid action" }));
      return;
    }

    // Route actions
    switch (event.action) {
      case "createGame":
        if (event.username && event.timeControl) {
          mainGameManager.addPlayerToLobby({
            username: event.username,
            action: event.action,
            timeControl: event.timeControl,
            id: ws,
            sessionId: event.sessionId,
          });
        }
        break;

      case "cancelSearch":
        mainGameManager.removeFromLobby(ws);
        break;

      case "makeMove":
        if (event.gameObj && event.move) {
          mainGameManager.makeMove(event.gameObj, event.move, ws);
        }
        break;

      case "resign":
        if (event.gameObj) {
          mainGameManager.resign(event.gameObj, ws);
        }
        break;

      case "leaveGame":
        if (event.gameId) {
          mainGameManager.leaveGame(event.gameId, ws);
        }
        break;

      case "rejoin":
        if (event.sessionId) {
          mainGameManager.rejoin(event.sessionId, ws);
        }
        break;

      case "health":
        // Health check for monitoring
        ws.send(
          JSON.stringify({
            status: "ok",
            connections: wss.clients.size,
            activeGames: mainGameManager.getActiveGameCount(),
            lobbySize: mainGameManager.getLobbySize(),
          })
        );
        break;

      default:
        ws.send(JSON.stringify({ message: "Unknown action" }));
    }
  });

  ws.send(JSON.stringify({ message: "connected", status: "ok" }));
});

// Log stats periodically in development
if (process.env.NODE_ENV !== "production") {
  setInterval(() => {
    console.log(
      `[Stats] Connections: ${wss.clients.size}, Games: ${mainGameManager.getActiveGameCount()}, Lobby: ${mainGameManager.getLobbySize()}`
    );
  }, 30000);
}
