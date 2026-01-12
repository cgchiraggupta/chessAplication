import { playerGameObj } from "./gameManager";

import { Chess } from "chess.js";

export interface moveOutput {
  valid: boolean;
  newState?: string;
  message: string;
  isGameEnd?: boolean;
}

export class moveManager {
  chessObj: Chess;
  constructor(initialGameState: string) {
    this.chessObj = new Chess(initialGameState);
  }
  executeMove(gameObj: playerGameObj, move: string): moveOutput {
    const color = gameObj.color;
    const turn = this.chessObj.turn();
    if (
      (color == "white" && turn == "w") ||
      (color == "black" && turn == "b")
    ) {
      //the turn is valid
      try {
        this.chessObj.move(move);
        const output: moveOutput = {
          valid: true,
          newState: this.chessObj.fen(),
          message: "valid move updating the state",
          isGameEnd: false,
        };
        if (this.chessObj.isCheckmate()) {
          output.isGameEnd = true;
        }
        return output;
      } catch (e) {
        console.log(e);
        return {
          valid: false,
          message: "the move itself is invalid",
        };
      }
    } else {
      //the person that made the move request doest not have their turn
      //return with like a warning or something
      const output: moveOutput = {
        valid: false,
        message: "not your turn rn",
      };
      return output;
    }
  }
}
