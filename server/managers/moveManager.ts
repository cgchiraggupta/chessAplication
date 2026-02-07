import { PlayerGameObj } from "./gameManager";
import { Chess } from "chess.js";

export interface MoveOutput {
  valid: boolean;
  newState?: string;
  message: string;
  isGameEnd?: boolean;
  endReason?: "checkmate" | "stalemate" | "threefold_repetition" | "insufficient_material" | "fifty_moves" | "draw";
}

export class MoveManager {
  private chess: Chess;

  constructor(initialGameState: string) {
    this.chess = new Chess(initialGameState);
  }

  executeMove(gameObj: PlayerGameObj, move: string): MoveOutput {
    const color = gameObj.color;
    const turn = this.chess.turn();

    // Validate it's the player's turn
    if (
      (color === "white" && turn !== "w") ||
      (color === "black" && turn !== "b")
    ) {
      return {
        valid: false,
        message: "Not your turn",
      };
    }

    // Attempt the move
    try {
      this.chess.move(move);
    } catch (e) {
      return {
        valid: false,
        message: "Invalid move",
      };
    }

    const newState = this.chess.fen();

    // Check all game end conditions
    if (this.chess.isCheckmate()) {
      return {
        valid: true,
        newState,
        message: "Checkmate",
        isGameEnd: true,
        endReason: "checkmate",
      };
    }

    if (this.chess.isStalemate()) {
      return {
        valid: true,
        newState,
        message: "Stalemate - draw",
        isGameEnd: true,
        endReason: "stalemate",
      };
    }

    if (this.chess.isThreefoldRepetition()) {
      return {
        valid: true,
        newState,
        message: "Threefold repetition - draw",
        isGameEnd: true,
        endReason: "threefold_repetition",
      };
    }

    if (this.chess.isInsufficientMaterial()) {
      return {
        valid: true,
        newState,
        message: "Insufficient material - draw",
        isGameEnd: true,
        endReason: "insufficient_material",
      };
    }

    if (this.chess.isDraw()) {
      // This catches 50-move rule and other draw conditions
      return {
        valid: true,
        newState,
        message: "Draw",
        isGameEnd: true,
        endReason: "fifty_moves",
      };
    }

    // Game continues
    return {
      valid: true,
      newState,
      message: "Move accepted",
      isGameEnd: false,
    };
  }
}
