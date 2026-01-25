import type { DataConnection } from "peerjs";
import { createRequire } from "module";
import { log } from "../logger.js";

const require = createRequire(import.meta.url);
const Peer = require("peerjs").default; // ✅ THIS FIXES IT

let peer: any = null;
const connections = new Map<string, DataConnection>();

export function createPeerClient(selfId: string, hostIp: string) {
  if (peer) return peer;

  peer = new Peer(selfId, {
    host: hostIp,
    port: 9000,
    path: "/peerjs",
    secure: false,
  });

  peer.on("open", (id: string) => {
    log("info", `Peer client ready: ${id}`);
  });

  peer.on("connection", (conn: DataConnection) => {
    log("info", `Incoming connection from ${conn.peer}`);
    registerConnection(conn);
  });

  peer.on("error", (err: Error) => {
    log("error", `Peer error: ${err.message}`);
  });

  return peer;
}

export function connectToPeer(peerId: string): Promise<DataConnection> {
  if (!peer) throw new Error("Peer client not initialized");

  return new Promise((resolve) => {
    const conn: DataConnection = peer.connect(peerId);
    conn.on("open", () => {
      log("info", `Connected to peer ${peerId}`);
      registerConnection(conn);
      resolve(conn);
    });
  });
}

function registerConnection(conn: DataConnection) {
  connections.set(conn.peer, conn);
  conn.on("close", () => connections.delete(conn.peer));
}

export function getConnection(peerId: string) {
  return connections.get(peerId);
}
