import express from "express";
import { createServer, Server } from "http";
import { ExpressPeerServer } from "peer";
import { log } from "../logger.js";

let httpServer: Server | null = null;
let peerServer: ReturnType<typeof ExpressPeerServer> | null = null;

const PEER_PORT = 9000;
const PEER_PATH = "/peerjs";

export function startPeerServer() {
  if (peerServer) {
    log("warn", "PeerJS server already running");
    return;
  }

  const app = express();
  httpServer = createServer(app);

  peerServer = ExpressPeerServer(httpServer, {
    allow_discovery: true,
  });

  app.use(PEER_PATH, peerServer);

  httpServer.listen(PEER_PORT, () => {
    log("info", `PeerJS signaling server started on :${PEER_PORT}${PEER_PATH}`);
  });

  peerServer.on("connection", (client) => {
    log("info", `Peer connected to signaling server: ${client.getId()}`);
  });

  peerServer.on("disconnect", (client) => {
    log("info", `Peer disconnected from signaling server: ${client.getId()}`);
  });
}

export function stopPeerServer() {
  if (!httpServer) return;

  httpServer.close(() => {
    log("info", "PeerJS signaling server stopped");
  });

  peerServer = null;
  httpServer = null;
}
