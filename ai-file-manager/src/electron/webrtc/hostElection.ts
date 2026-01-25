// src/webrtc/hostElection.ts
import { getLanDevices, setHostRole } from "./presence.js";
import { log } from "../logger.js";
import { startPeerServer, stopPeerServer } from "./peerServer.js";

const ELECTION_INTERVAL = 3000; // ms

let isHost = false;
let electionTimer: NodeJS.Timeout | null = null;

/**
 * Decide if THIS device should be the host
 */
function shouldBecomeHost(
  selfUptime: number,
  devices: ReturnType<typeof getLanDevices>
): boolean {
  const hosts = devices.filter(d => d.role === "host");

  // No host exists → become host
  if (hosts.length === 0) return true;

  // Host with lowest uptime wins
  const bestHost = hosts.reduce((a, b) =>
    a.uptime < b.uptime ? a : b
  );

  return selfUptime < bestHost.uptime;
}

/**
 * Start election loop
 */
export function startHostElection(getSelfUptime: () => number) {
  if (electionTimer) return;

  electionTimer = setInterval(() => {
    const devices = getLanDevices();
    const selfUptime = getSelfUptime();

    const shouldHost = shouldBecomeHost(selfUptime, devices);

    // Become host 
    if (shouldHost && !isHost) {
      isHost = true;
      log("info", "Becoming signaling host");
      setHostRole(true);
      startPeerServer();
    }

    // Step down
    if (!shouldHost && isHost) {
      isHost = false;
      log("info", "Stepping down as host");
      stopPeerServer();
      setHostRole(false);
    }
  }, ELECTION_INTERVAL);
}

/**
 * Stop election loop
 */
export function stopHostElection() {
  if (electionTimer) {
    clearInterval(electionTimer);
    electionTimer = null;
  }
}


