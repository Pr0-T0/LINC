//this needs to be on the renderer not on backend cause frontend is the browser window
import Peer from "peerjs";

let peer: Peer | null = null;

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
  });

  return peer;
}
