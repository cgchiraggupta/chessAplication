import { WebSocketServer } from "ws";
import { gameManager } from "./managers/gameManager";

const wss = new WebSocketServer({ port: 8080 });

const mainGameManager = new gameManager();

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);
  ws.on("message", function message(data) {
    const event = JSON.parse(data.toString());
    event.id = ws;
    if (event.action == "createGame") {
      mainGameManager.addPlayerToLobby(event);
      //receive list of active games and then send the gameIds to their respective players
    } else {
      mainGameManager.seeActiveGames();
    }
  });
  console.log("a player got made connection to this server");
  ws.send("connected to the game server");
});
