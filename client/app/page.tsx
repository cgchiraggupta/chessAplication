"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";

interface GameState {
  gameId: string;
  color: string;
  opponent: string;
  gameState: string;
}

declare global {
  interface Window {
    Chessboard: any;
    $: any;
    jQuery: any;
    Chess: any;
  }
}

export default function Home() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [findingGame, setFindingGame] = useState(false);
  const [username, setUsername] = useState("");
  const [jqueryLoaded, setJqueryLoaded] = useState(false);
  const [chessboardLoaded, setChessboardLoaded] = useState(false);
  const [chessJsLoaded, setChessJsLoaded] = useState(false);
  const boardRef = useRef<any>(null);
  const chessRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scriptsReady = jqueryLoaded && chessboardLoaded && chessJsLoaded;
  const connected = ws?.readyState === 1;

  // Load chessboard CSS
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css";
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  // WebSocket
  useEffect(() => {
    const websocket = new WebSocket("ws://localhost:8080");
    websocket.onopen = () => setStatusMessage(null);
    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message === "game is over" && data.state) {
          setCurrentGame((prev) =>
            prev ? { ...prev, gameState: data.state } : null
          );
          setGameOver(true);
          setStatusMessage("Game over.");
          if (chessRef.current) chessRef.current.load(data.state);
          if (boardRef.current) boardRef.current.position(data.state.split(" ")[0]);
          return;
        }
        if (data.gameId && data.gameState) {
          setFindingGame(false);
          setGameOver(false);
          setStatusMessage(null);
          setCurrentGame(data);
          return;
        }
      } catch {
        // Plain text: connection confirm or error
        const text = event.data.toString();
        if (text.includes("connected")) setStatusMessage(null);
        else if (text.includes("lobby") || text.includes("already in a game"))
          setFindingGame(false);
        setStatusMessage(text);
      }
    };
    websocket.onerror = () =>
      setStatusMessage("Connection error. Is the server running on port 8080?");
    websocket.onclose = () =>
      setStatusMessage("Disconnected. Reconnect by refreshing.");
    setWs(websocket);
    return () => websocket.close();
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
    if (boardRef.current) boardRef.current.position(chessRef.current.fen());
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
    const timer = setTimeout(() => {
      if (
        typeof window.Chessboard === "undefined" ||
        typeof window.Chess === "undefined" ||
        !containerRef.current
      )
        return;
      chessRef.current = new window.Chess(currentGame.gameState);
      if (boardRef.current) {
        try {
          boardRef.current.destroy();
        } catch {}
      }
      try {
        boardRef.current = window.Chessboard("myBoard", {
          position: currentGame.gameState.split(" ")[0],
          orientation: currentGame.color === "white" ? "white" : "black",
          draggable: true,
          dropOffBoard: "snapback",
          pieceTheme:
            "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
          onDragStart,
          onDrop,
        });
      } catch {}
    }, 100);
    return () => clearTimeout(timer);
  }, [currentGame, scriptsReady]);

  // Sync board when server sends updated FEN (opponent move)
  useEffect(() => {
    if (!currentGame || !chessRef.current || !boardRef.current) return;
    chessRef.current.load(currentGame.gameState);
    boardRef.current.position(currentGame.gameState.split(" ")[0]);
  }, [currentGame?.gameState]);

  const enterNewGame = () => {
    if (!username.trim()) {
      setStatusMessage("Enter a username to find a game.");
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
        })
      );
  };

  const myTurn =
    currentGame &&
    chessRef.current &&
    !chessRef.current.game_over() &&
    ((chessRef.current.turn() === "w" && currentGame.color === "white") ||
      (chessRef.current.turn() === "b" && currentGame.color === "black"));

  return (
    <>
      <Script
        src="https://code.jquery.com/jquery-3.6.0.min.js"
        strategy="afterInteractive"
        onLoad={() => setJqueryLoaded(true)}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"
        strategy="afterInteractive"
        onLoad={() => setChessJsLoaded(true)}
      />
      <Script
        src="https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js"
        strategy="afterInteractive"
        onLoad={() => setChessboardLoaded(true)}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4">
          <h1
            className="text-2xl font-semibold tracking-tight text-[var(--cream)]"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Chess
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-[var(--success)]" : "bg-[var(--error)]"
              }`}
            />
            <span className="text-sm text-[var(--cream-muted)]">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </header>

        {!currentGame ? (
          <section className="w-full max-w-md animate-fade-up text-center">
            <p
              className="text-[var(--cream-muted)] text-lg mb-8"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Play a rapid game. You’ll be matched with another player.
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enterNewGame()}
                className="w-full rounded-[var(--radius)] border border-[var(--felt-light)] bg-[var(--felt)] px-4 py-3 text-[var(--cream)] placeholder-[var(--cream-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
                disabled={!connected || findingGame}
              />
              <button
                onClick={enterNewGame}
                disabled={!connected || findingGame || !scriptsReady}
                className="w-full rounded-[var(--radius)] bg-[var(--gold)] px-4 py-3 font-medium text-[var(--ink)] transition hover:bg-[var(--gold-dim)] hover:text-[var(--cream)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {findingGame ? "Finding opponent…" : "Find a game"}
              </button>
            </div>
            {statusMessage && (
              <p
                className="mt-4 text-sm text-[var(--cream-muted)] animate-fade-up"
                role="status"
              >
                {statusMessage}
              </p>
            )}
          </section>
        ) : (
          <section className="flex flex-col items-center gap-6 animate-fade-up">
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--cream-muted)] animate-fade-up animate-fade-up-delay-1">
              <span>
                You play{" "}
                <strong className="text-[var(--cream)]">
                  {currentGame.color}
                </strong>
              </span>
              <span>·</span>
              <span>
                Opponent:{" "}
                <strong className="text-[var(--cream)]">
                  {currentGame.opponent}
                </strong>
              </span>
            </div>

            <div
              className={`board-frame animate-fade-up animate-fade-up-delay-2 ${myTurn ? "turn-indicator-active" : ""}`}
              ref={containerRef}
            >
              <div
                id="myBoard"
                className="min-w-[320px] w-[min(80vw,400px)] aspect-square"
              />
            </div>

            <div
              className="text-center animate-fade-up animate-fade-up-delay-3"
              role="status"
            >
              {gameOver ? (
                <p className="text-[var(--gold)] font-medium">Game over.</p>
              ) : myTurn ? (
                <p className="text-[var(--gold)]">Your turn</p>
              ) : (
                <p className="text-[var(--cream-muted)]">Opponent’s turn</p>
              )}
            </div>

            {statusMessage && (
              <p className="text-sm text-[var(--cream-muted)]" role="alert">
                {statusMessage}
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
