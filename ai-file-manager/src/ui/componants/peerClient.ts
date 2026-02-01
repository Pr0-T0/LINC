// renderer/peerClient.ts
import Peer from "peerjs";
import type { DataConnection } from "peerjs";

let peer: Peer | null = null;
const connections = new Map<string, DataConnection>();

export function startPeerClient(selfId: string, hostIp: string) {
  if (peer) return peer;

  peer = new Peer(selfId, {
    host: hostIp,
    port: 9000,
    path: "/peerjs",
  });

  peer.on("open", () => {
    console.log("[Peer] Client ready");
  });

  peer.on("error", (err) => {
    console.error("[Peer] Error:", err);
  });

  peer.on("connection", (conn) => {
    console.log("[Peer] Incoming connection from", conn.peer);
    registerConnection(conn);
  });

  return peer;
}

/* ---------- CONNECTION HANDLING ---------- */

function registerConnection(conn: DataConnection) {
  if (connections.has(conn.peer)) return;
  connections.set(conn.peer, conn);

  const onOpen = () => {
    console.log("[Peer] DataChannel open with", conn.peer);

    //  THIS is where file data arrives
    conn.on("data", (data) => {
      //@ts-ignore
    window.electron.webrtc.send({
      from: conn.peer,
      payload: data,
    });
  });

  };

  if (conn.open) onOpen();
  else conn.once("open", onOpen);

  conn.on("close", () => {
    connections.delete(conn.peer);
    console.log("[Peer] Connection closed with", conn.peer);
  });
}

/* ---------- SENDING ---------- */

export function sendToPeer(peerId: string, message: any) {
  const conn = connections.get(peerId);
  if (!conn || !conn.open) {
    console.warn("[Peer] No open connection to", peerId);
    return;
  }

  conn.send(message);
}
