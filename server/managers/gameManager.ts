import WebSocket from "ws";

import { randomUUID } from "crypto";
import { moveManager, moveOutput } from "./moveManager";

interface gameRequest {
  username: string;
  action: string;
  timeControl: string;
  id: WebSocket;
}
export interface playerGameObj {
  gameId: string;
  color: "white" | "black";
  opponent: string;
  gameState: string;
}
export class Game {
  gameId: string;
  playerW: string;
  playerB: string;
  gameState: string; //should be a FEN string
  socketW: WebSocket;
  socketB: WebSocket;
  moveManagerOfGame: moveManager;

  constructor(req1: gameRequest, req2: gameRequest) {
    this.gameId = randomUUID().split("-")[0]; // Short unique ID

    // Randomly assign colors
    const random = Math.random() < 0.5;
    this.playerW = random ? req1.username : req2.username;
    this.playerB = random ? req2.username : req1.username;
    this.socketW = random ? req1.id : req2.id;
    this.socketB = random ? req2.id : req1.id;

    this.gameState = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    console.log(
      `Game ${this.gameId} created: ${this.playerW} (W) vs ${this.playerB} (B)`,
    );

    const gameObjW = {
      gameId: this.gameId,
      color: "white",
      opponent: this.playerB,
      gameState: this.gameState,
    };

    const gameObjB = {
      gameId: this.gameId,
      color: "black",
      opponent: this.playerW,
      gameState: this.gameState,
    };

    this.socketW.send(JSON.stringify(gameObjW));
    this.socketB.send(JSON.stringify(gameObjB));
    this.moveManagerOfGame = new moveManager(this.gameState);
  }

  isPlayerInGame(username: string): boolean {
    return this.playerW === username || this.playerB === username;
  }
  //this function will make the move and send the updated gameState to the respective players
  makeMove(gameObj: playerGameObj, move: string) {
    const acutalMoveOutput: moveOutput = this.moveManagerOfGame.executeMove(
      gameObj,
      move,
    );
    if (acutalMoveOutput.newState && !acutalMoveOutput.isGameEnd) {
      this.gameState = acutalMoveOutput.newState;
      const gameObjW = {
        gameId: this.gameId,
        color: "white",
        opponent: this.playerB,
        gameState: this.gameState,
      };

      const gameObjB = {
        gameId: this.gameId,
        color: "black",
        opponent: this.playerW,
        gameState: this.gameState,
      };
      this.socketW.send(JSON.stringify(gameObjW));
      this.socketB.send(JSON.stringify(gameObjB));
    } else if (acutalMoveOutput.isGameEnd && acutalMoveOutput.newState) {
      this.gameState = acutalMoveOutput.newState;
      const gameOverMsg = {
        state: this.gameState,
        message: "game is over",
      };
      this.socketW.send(JSON.stringify(gameOverMsg));
      this.socketB.send(JSON.stringify(gameOverMsg));
    } else {
      //the output does not have a new state which means that it was not a valid move
      if (gameObj.color == "white") {
        this.socketW.send(acutalMoveOutput.message); //reason for the invalid move
      } else {
        this.socketB.send(acutalMoveOutput.message);
      }
    }
  }
}

export class gameManager {
  gameLobby: gameRequest[] = [];
  gameList: Game[] = [];
  //maps game id to its game object
  private gameMap: Map<string, Game> = new Map();
  //maps username with gameid
  private playerGameMap: Map<string, string> = new Map();

  addPlayerToLobby(createGameReq: gameRequest) {
    //not let the user enter the lobby if they are already in there
    const isAlreadyInLobby = this.gameLobby
      .map((obj) => JSON.stringify(obj))
      .includes(JSON.stringify(createGameReq));
    if (isAlreadyInLobby) {
      console.log(`player ${createGameReq.username} is already in the lobby`);
      createGameReq.id.send("you are alreay in the lobby wait");
      return;
    }
    if (this.playerGameMap.has(createGameReq.username)) {
      //should probably relay the same message to the user as well
      console.log(`${createGameReq.username} already in a game`);
      createGameReq.id.send("you are already in a game play that");
      return;
    }

    this.gameLobby.push(createGameReq);

    while (this.gameLobby.length >= 2) {
      const req1 = this.gameLobby.shift();
      const req2 = this.gameLobby.shift();

      if (req1 && req2) {
        const game = new Game(req1, req2);
        this.gameList.push(game);
        this.gameMap.set(game.gameId, game);
        this.playerGameMap.set(req1.username, game.gameId);
        this.playerGameMap.set(req2.username, game.gameId);
      }
    }
    console.log(this.gameLobby);
    this.showAllGames();
  }

  showAllGames() {
    console.log(this.gameList);
  }
  getGame(gameId: string): Game | undefined {
    //this returns the game object when given its id
    return this.gameMap.get(gameId);
  }

  validateMove(gameId: string, username: string): boolean {
    const game = this.gameMap.get(gameId);
    return game ? game.isPlayerInGame(username) : false;
  }
  makeMove(gameObj: playerGameObj, move: string) {
    const game = this.getGame(gameObj.gameId);
    if (game) {
      game.makeMove(gameObj, move);
    }
  }
}
