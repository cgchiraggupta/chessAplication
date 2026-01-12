import { WebSocketServer } from "ws";
import { gameManager } from "./managers/gameManager";

const wss = new WebSocketServer({ port: 8080 });

const mainGameManager = new gameManager();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);
  ws.on("message", function message(data) {
    const event = JSON.parse(data.toString());
    //each event from a client gets its websocket acctached to it as its id
    event.id = ws;
    if (event.action == "createGame") {
      //only tell the gamemanager to put the current player in lobby if they requested to create a game
      mainGameManager.addPlayerToLobby(event);
    } else if (event.action == "makeMove") {
      mainGameManager.makeMove(event.gameObj, event.move);
    }
  });
  console.log("a player got made connection to this server");
  ws.send("connected to the game server");
});
