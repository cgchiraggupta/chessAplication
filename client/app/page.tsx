"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { LobbyView } from "./components/LobbyView";
import { GameView, type GameState } from "./components/GameView";

declare global {
  interface Window {
    Chessboard: any;
    $: any;
    jQuery: any;
    Chess: any;
  }
}

// WebSocket URL - use env var for production, fallback for local dev
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5555";

// Username constraints
const USERNAME_MAX_LENGTH = 20;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export default function Home() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [findingGame, setFindingGame] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [username, setUsername] = useState("");
  const sessionIdRef = useRef<string>("");
  const currentGameRef = useRef<GameState | null>(null);
  const [jqueryLoaded, setJqueryLoaded] = useState(false);
  const [chessboardLoaded, setChessboardLoaded] = useState(false);
  const [chessJsLoaded, setChessJsLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const boardRef = useRef<any>(null);
  const chessRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scriptsReady = jqueryLoaded && chessboardLoaded && chessJsLoaded;

  // Load chessboard CSS with SRI
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css";
    link.integrity =
      "sha384-q94+BZtLrkL1/ohfjR8c6L+A6qzNH9R2hBLwyoAfu3i/WCvQjzL2RQJ3uNHDISdU";
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  // Session id for reconnect (persist in localStorage)
  useEffect(() => {
    if (typeof window === "undefined") return;
    let id = localStorage.getItem("chessSessionId");
    if (!id) {
      // Use crypto.randomUUID or getRandomValues for strong session IDs
      if (typeof crypto?.randomUUID === "function") {
        id = crypto.randomUUID();
      } else if (typeof crypto?.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      } else {
        // Last resort fallback (should not happen in modern browsers)
        id = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      localStorage.setItem("chessSessionId", id);
    }
    sessionIdRef.current = id;
  }, []);

  currentGameRef.current = currentGame;

  // WebSocket with reconnect when in a game
  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;
    let websocket: WebSocket;

    function connect() {
      websocket = new WebSocket(WS_URL);
      websocket.onopen = () => {
        setConnected(true);
        setStatusMessage(null);
        if (currentGameRef.current && sessionIdRef.current) {
          websocket.send(
            JSON.stringify({
              action: "rejoin",
              sessionId: sessionIdRef.current,
            })
          );
        }
      };
      websocket.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data);
        } catch {
          // Non-JSON message - ignore
          return;
        }

        // Handle server shutdown
        if (data.message === "server_shutdown") {
          setStatusMessage("Server is restarting. Please wait...");
          setConnected(false);
          return;
        }

        // Handle connection confirmation
        if (data.message === "connected" && data.status === "ok") {
          setStatusMessage(null);
          return;
        }

        // Handle rate limiting
        if (data.message === "Rate limited. Slow down.") {
          setStatusMessage("Too many requests. Please slow down.");
          return;
        }

        // Handle game over
        if (data.message === "game is over") {
          if (data.state && typeof data.state === "string") {
            setCurrentGame((prev) =>
              prev ? { ...prev, gameState: data.state as string } : null
            );
            if (chessRef.current) chessRef.current.load(data.state);
            if (boardRef.current) {
              try {
                boardRef.current.position((data.state as string).split(" ")[0]);
              } catch {
                // Board DOM may not be ready
              }
            }
          }
          setGameOver(true);
          if (data.reason === "opponent_left") {
            setStatusMessage("Opponent left.");
            setTimeout(() => {
              setCurrentGame(null);
              setGameOver(false);
              setStatusMessage(null);
            }, 2000);
          } else if (data.reason === "resign") {
            const winner = data.winner === currentGame?.color ? "You win!" : "You lost.";
            setStatusMessage(`Game over (resignation). ${winner}`);
          } else if (data.reason === "stalemate") {
            setStatusMessage("Game over - Stalemate (draw).");
          } else if (data.reason === "threefold_repetition") {
            setStatusMessage("Game over - Threefold repetition (draw).");
          } else if (data.reason === "insufficient_material") {
            setStatusMessage("Game over - Insufficient material (draw).");
          } else if (data.reason === "fifty_moves") {
            setStatusMessage("Game over - 50-move rule (draw).");
          } else if (data.reason === "checkmate") {
            setStatusMessage("Checkmate!");
          } else {
            setStatusMessage("Game over.");
          }
          return;
        }

        // Handle game start/rejoin
        if (data.gameId && data.gameState) {
          setFindingGame(false);
          setGameOver(false);
          setStatusMessage(null);
          setCurrentGame(data as unknown as GameState);
          return;
        }

        // Handle no game to rejoin
        if (data.message === "no game to rejoin") {
          setStatusMessage(null);
          setCurrentGame(null);
          currentGameRef.current = null;
          return;
        }

        // Handle already in game
        if (typeof data.message === "string" && data.message.includes("already in a game")) {
          setFindingGame(false);
          if (sessionIdRef.current) {
            setStatusMessage("Rejoining your game...");
            websocket.send(
              JSON.stringify({
                action: "rejoin",
                sessionId: sessionIdRef.current,
              })
            );
          } else {
            setStatusMessage(data.message);
          }
          return;
        }

        // Handle other messages
        if (typeof data.message === "string") {
          setStatusMessage(data.message);
        }
      };
      websocket.onerror = () =>
        setStatusMessage("Connection error. Is the server running?");
      websocket.onclose = () => {
        setWs(null);
        setConnected(false);
        setStatusMessage("Disconnected. Reconnecting…");
        if (mounted && currentGameRef.current) {
          reconnectTimeout = setTimeout(() => connect(), 2000);
        }
      };
      setWs(websocket);
    }
    connect();
    return () => {
      mounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      websocket.close();
    };
  }, []);

  const onDragStart = (
    source: string,
    piece: string,
    _position: any,
    _orientation: string
  ) => {
    if (!chessRef.current || !currentGame || gameOver) return false;
    if (chessRef.current.game_over()) return false;
    const turn = chessRef.current.turn();
    const playerColor = currentGame.color;
    if (
      (turn === "w" && playerColor !== "white") ||
      (turn === "b" && playerColor !== "black")
    )
      return false;
    const pieceColor = piece[0];
    const allowedColor = playerColor === "white" ? "w" : "b";
    if (pieceColor !== allowedColor) return false;
    return true;
  };

  const onDrop = (source: string, target: string) => {
    if (!chessRef.current) return "snapback";
    const move = chessRef.current.move({
      from: source,
      to: target,
      promotion: "q",
    });
    if (move === null) return "snapback";
    if (boardRef.current) {
      try {
        boardRef.current.position(chessRef.current.fen());
      } catch {
        // Board DOM may not be ready
      }
    }
    if (ws && currentGame) {
      ws.send(
        JSON.stringify({
          username,
          action: "makeMove",
          move: move.san,
          gameObj: {
            gameId: currentGame.gameId,
            color: currentGame.color,
            opponent: currentGame.opponent,
            gameState: chessRef.current.fen(),
          },
          timeControl: "rapid",
        })
      );
    }
    return undefined;
  };

  useEffect(() => {
    if (!currentGame || !scriptsReady) return;
    const game = currentGame;
    let cancelled = false;
    let rafId: number | undefined;
    let attempts = 0;
    const maxAttempts = 60; // ~1s at 60fps

    function tryInitBoard() {
      if (cancelled || attempts >= maxAttempts) return;
      attempts += 1;
      const el = document.getElementById("myBoard");
      if (
        !el ||
        typeof window.Chessboard === "undefined" ||
        typeof window.Chess === "undefined"
      ) {
        rafId = requestAnimationFrame(tryInitBoard);
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        rafId = requestAnimationFrame(tryInitBoard);
        return;
      }
      chessRef.current = new window.Chess(game.gameState);
      if (boardRef.current) {
        try {
          boardRef.current.destroy();
        } catch {}
      }
      try {
        boardRef.current = window.Chessboard("myBoard", {
          position: game.gameState.split(" ")[0],
          orientation: game.color === "white" ? "white" : "black",
          draggable: true,
          dropOffBoard: "snapback",
          pieceTheme:
            "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
          onDragStart,
          onDrop,
        });
      } catch {}
    }

    const timer = setTimeout(() => {
      tryInitBoard();
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (typeof rafId === "number") cancelAnimationFrame(rafId);
    };
  }, [currentGame, scriptsReady]);

  // Sync board when server sends updated FEN (opponent move)
  useEffect(() => {
    if (!currentGame || !chessRef.current || !boardRef.current) return;
    const el = document.getElementById("myBoard");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    try {
      chessRef.current.load(currentGame.gameState);
      boardRef.current.position(currentGame.gameState.split(" ")[0]);
    } catch {
      // Board DOM may not be ready; ignore to avoid "reading 'top'" crash
    }
  }, [currentGame?.gameState]);

  // Timer while finding opponent
  useEffect(() => {
    if (!findingGame) {
      setWaitSeconds(0);
      return;
    }
    const start = Date.now();
    const id = setInterval(() => setWaitSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [findingGame]);

  // Validate username: alphanumeric, _, -, max 20 chars
  const validateUsername = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a username to find a game.";
    if (trimmed.length > USERNAME_MAX_LENGTH)
      return `Username must be ${USERNAME_MAX_LENGTH} characters or less.`;
    if (!USERNAME_PATTERN.test(trimmed))
      return "Username can only contain letters, numbers, _ and -.";
    return null; // valid
  };

  const enterNewGame = () => {
    const error = validateUsername(username);
    if (error) {
      setStatusMessage(error);
      return;
    }
    setStatusMessage(null);
    setFindingGame(true);
    if (ws)
      ws.send(
        JSON.stringify({
          username: username.trim(),
          action: "createGame",
          timeControl: "rapid",
          sessionId: sessionIdRef.current || undefined,
        })
      );
  };

  const cancelSearch = () => {
    if (ws) ws.send(JSON.stringify({ action: "cancelSearch" }));
    setFindingGame(false);
    setStatusMessage(null);
  };

  const resign = () => {
    if (ws && currentGame) {
      ws.send(
        JSON.stringify({
          action: "resign",
          gameObj: {
            gameId: currentGame.gameId,
            color: currentGame.color,
            opponent: currentGame.opponent,
            gameState: currentGame.gameState,
          },
        })
      );
      setGameOver(true);
      setStatusMessage("Game over (resignation).");
    }
  };

  const leaveGame = () => {
    if (ws && currentGame) {
      ws.send(JSON.stringify({ action: "leaveGame", gameId: currentGame.gameId }));
      setCurrentGame(null);
      setGameOver(false);
      setStatusMessage("You left the game.");
    }
  };

  // Derive turn from server FEN (currentGame.gameState) so it updates when server sends new state.
  // FEN format: "pieces position active_color ..." — active color is 2nd field, "w" or "b".
  const activeColor = currentGame?.gameState?.split(" ")[1];
  const myTurn =
    currentGame &&
    activeColor &&
    !gameOver &&
    ((activeColor === "w" && currentGame.color === "white") ||
      (activeColor === "b" && currentGame.color === "black"));

  return (
    <>
      <Script
        src="https://code.jquery.com/jquery-3.6.0.min.js"
        integrity="sha512-894YE6QWD5I59HgZOGReFYm4dnWc1Qt5NtvYSaNcOP+u1T9qYdvdihz0PPSiiqn/+/3e7Jo4EaG7TubfWGUrMQ=="
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setJqueryLoaded(true)}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"
        integrity="sha512-xRllwz2gdZciIB+AkEbeq+gVhX8VB8XsfqeFbUh+SzHlN96dEduwtTuVuc2u9EROlmW9+yhRlxjif66ORpsgVA=="
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setChessJsLoaded(true)}
      />
      <Script
        src="https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js"
        integrity="sha384-8Vi8VHwn3vjQ9eUHUxex3JSN/NFqUg3QbPyX8kWyb93+8AC/pPWTzj+nHtbC5bxD"
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onLoad={() => setChessboardLoaded(true)}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-16 sm:py-10">
        <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <h1
            className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--cream)]"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Chess
          </h1>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-[var(--success)]" : "bg-[var(--error)]"
              }`}
            />
            <span className="text-xs sm:text-sm text-[var(--cream-muted)]">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </header>

        {!currentGame ? (
          <LobbyView
            username={username}
            onUsernameChange={setUsername}
            onFindGame={enterNewGame}
            onCancelSearch={cancelSearch}
            connected={connected}
            findingGame={findingGame}
            scriptsReady={scriptsReady}
            waitSeconds={waitSeconds}
            statusMessage={statusMessage}
          />
        ) : (
          <GameView
            currentGame={currentGame}
            gameOver={gameOver}
            myTurn={!!myTurn}
            statusMessage={statusMessage}
            containerRef={containerRef}
            onResign={resign}
            onLeaveGame={leaveGame}
          />
        )}
      </div>
    </>
  );
}
