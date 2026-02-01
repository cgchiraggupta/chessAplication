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
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [jqueryLoaded, setJqueryLoaded] = useState(false);
  const [chessboardLoaded, setChessboardLoaded] = useState(false);
  const [chessJsLoaded, setChessJsLoaded] = useState(false);
  const boardRef = useRef<any>(null);
  const chessRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState("chiraggupta"); // You can make this dynamic

  // Load CSS dynamically
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.css";
    document.head.appendChild(link);

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link);
      }
    };
  }, []);

  useEffect(() => {
    // Connect to WebSocket server at port 8080
    const websocket = new WebSocket("ws://localhost:8080");
    websocket.onopen = () => {
      console.log("Connected to WebSocket server");
    };
    websocket.onmessage = (event) => {
      console.log("Message received:", event.data);
      setMessages((prev) => [...prev, event.data]);

      // Try to parse the message as JSON
      try {
        const data = JSON.parse(event.data);
        console.log("Parsed game data:", data);

        // Check if it's a game object with gameState
        if (data.gameId && data.gameState) {
          // Update the current game state
          setCurrentGame(data);

          // Update the chess.js position and board if they exist
          if (chessRef.current && boardRef.current) {
            console.log("Updating board with new FEN:", data.gameState);

            // Load the new position in chess.js
            chessRef.current.load(data.gameState);

            // Update the board visual position
            boardRef.current.position(data.gameState.split(" ")[0]);

            // Log whose turn it is
            const turn = chessRef.current.turn();
            console.log(`Turn: ${turn === "w" ? "White" : "Black"}`);
          }
        }
      } catch (e) {
        // If it's not JSON, just add it to messages
        console.log("Non-JSON message received");
      }
    };
    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
    websocket.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };
    setWs(websocket);
    // Cleanup on unmount
    return () => {
      websocket.close();
    };
  }, []);

  // Check if it's the player's turn
  const onDragStart = (
    source: string,
    piece: string,
    position: any,
    orientation: string,
  ) => {
    // Check if chess.js is loaded
    if (!chessRef.current || !currentGame) {
      return false;
    }

    // Don't allow moves if game is over
    if (chessRef.current.game_over()) {
      console.log("Game is over!");
      return false;
    }

    // Get whose turn it is ('w' for white, 'b' for black)
    const turn = chessRef.current.turn();

    // Get the player's color ('white' or 'black')
    const playerColor = currentGame.color;

    // Check if it's the player's turn
    if (
      (turn === "w" && playerColor !== "white") ||
      (turn === "b" && playerColor !== "black")
    ) {
      console.log("❌ Not your turn!");
      return false;
    }

    // Only allow the player to move their own pieces
    // Piece format: first character is color (w/b), second is piece type
    const pieceColor = piece[0]; // 'w' or 'b'
    const allowedColor = playerColor === "white" ? "w" : "b";

    if (pieceColor !== allowedColor) {
      console.log(`❌ You can only move ${playerColor} pieces!`);
      return false;
    }

    return true;
  };

  // Handle piece drop
  const onDrop = (source: string, target: string) => {
    // Check if chess.js is loaded
    if (!chessRef.current) {
      console.error("Chess.js not loaded");
      return "snapback";
    }

    // Try to make the move
    const move = chessRef.current.move({
      from: source,
      to: target,
      promotion: "q", // Always promote to queen for simplicity
    });

    // If the move is illegal, snap back
    if (move === null) {
      console.log(`❌ Invalid move: ${source} to ${target}`);
      return "snapback";
    }

    // Log the move details
    console.log(`✅ Valid move: ${move.san}`);
    console.log("Move details:", {
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      san: move.san,
      flags: move.flags,
      promotion: move.promotion,
    });

    // Update the board position
    boardRef.current.position(chessRef.current.fen());

    // Check game state
    if (chessRef.current.in_checkmate()) {
      console.log("🏁 Checkmate!");
    } else if (chessRef.current.in_draw()) {
      console.log("🤝 Draw!");
    } else if (chessRef.current.in_stalemate()) {
      console.log("🤝 Stalemate!");
    } else if (chessRef.current.in_threefold_repetition()) {
      console.log("🤝 Draw by threefold repetition!");
    } else if (chessRef.current.insufficient_material()) {
      console.log("🤝 Draw by insufficient material!");
    } else if (chessRef.current.in_check()) {
      console.log("⚠️ Check!");
    }

    // Send the move to the server in the required format
    if (ws && currentGame) {
      const moveMessage = {
        username: username,
        action: "makeMove",
        move: move.san,
        gameObj: {
          gameId: currentGame.gameId,
          color: currentGame.color,
          opponent: currentGame.opponent,
          gameState: chessRef.current.fen(), // Send the updated FEN position
        },
        timeControl: "rapid",
      };

      console.log("Sending move to server:", moveMessage);
      ws.send(JSON.stringify(moveMessage));
    }
  };

  useEffect(() => {
    if (currentGame && jqueryLoaded && chessboardLoaded && chessJsLoaded) {
      // Wait a bit to ensure everything is ready
      const timer = setTimeout(() => {
        if (
          typeof window.Chessboard !== "undefined" &&
          typeof window.Chess !== "undefined" &&
          containerRef.current
        ) {
          console.log("Creating chessboard with FEN:", currentGame.gameState);

          // Initialize chess.js with the FEN position
          chessRef.current = new window.Chess(currentGame.gameState);

          // Destroy existing board if it exists
          if (boardRef.current) {
            try {
              boardRef.current.destroy();
            } catch (e) {
              console.error("Error destroying board:", e);
            }
          }

          // Create new board
          try {
            boardRef.current = window.Chessboard("myBoard", {
              position: currentGame.gameState.split(" ")[0],
              orientation: currentGame.color === "white" ? "white" : "black",
              draggable: true,
              dropOffBoard: "snapback",
              pieceTheme:
                "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
              onDragStart: onDragStart,
              onDrop: onDrop,
            });
            console.log("Chessboard created successfully");
          } catch (error) {
            console.error("Error creating chessboard:", error);
          }
        } else {
          console.error("Libraries not available");
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [currentGame, jqueryLoaded, chessboardLoaded, chessJsLoaded]);

  const enterNewGame = () => {
    console.log("inside new game function");
    const createGameAction = {
      username: username,
      action: "createGame",
      timeControl: "rapid",
    };
    if (ws) {
      ws.send(JSON.stringify(createGameAction));
    }
  };

  const handleJQueryLoad = () => {
    console.log("jQuery loaded successfully");
    setJqueryLoaded(true);
  };

  const handleChessboardLoad = () => {
    console.log("Chessboard.js loaded successfully");
    setChessboardLoaded(true);
  };

  const handleChessJsLoad = () => {
    console.log("Chess.js loaded successfully");
    setChessJsLoaded(true);
  };

  return (
    <>
      {/* Load jQuery first */}
      <Script
        src="https://code.jquery.com/jquery-3.6.0.min.js"
        strategy="afterInteractive"
        onLoad={handleJQueryLoad}
        onError={(e) => console.error("Error loading jQuery:", e)}
      />

      {/* Load Chess.js for move validation */}
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"
        strategy="afterInteractive"
        onLoad={handleChessJsLoad}
        onError={(e) => console.error("Error loading chess.js:", e)}
      />

      {/* Load Chessboard.js */}
      <Script
        src="https://unpkg.com/@chrisoakman/chessboardjs@1.0.0/dist/chessboard-1.0.0.min.js"
        strategy="afterInteractive"
        onLoad={handleChessboardLoad}
        onError={(e) => console.error("Error loading chessboard.js:", e)}
      />

      <div>
        <main>
          <h1>testing</h1>
          <p>
            WebSocket Status:{" "}
            {ws?.readyState === 1 ? "Connected" : "Disconnected"}
          </p>
          <p>
            Scripts Status: jQuery {jqueryLoaded ? "✓" : "✗"}, Chess.js{" "}
            {chessJsLoaded ? "✓" : "✗"}, Chessboard{" "}
            {chessboardLoaded ? "✓" : "✗"}
          </p>
          <div>
            <h2>Messages:</h2>
            <ul>
              {messages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
          <button
            onClick={() => {
              console.log("hello world");
              enterNewGame();
            }}
          >
            Play a rapid game
          </button>

          {currentGame && (
            <div style={{ marginTop: "20px" }} ref={containerRef}>
              <h2>Chess Game</h2>
              <p>
                <strong>Game ID:</strong> {currentGame.gameId}
              </p>
              <p>
                <strong>Your Color:</strong> {currentGame.color}
              </p>
              <p>
                <strong>Opponent:</strong> {currentGame.opponent}
              </p>
              <div
                id="myBoard"
                style={{ width: "400px", marginTop: "10px" }}
              ></div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
