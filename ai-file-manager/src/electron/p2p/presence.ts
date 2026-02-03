import dgram from "dgram";
import os from "os";
import crypto from "crypto";
import { log } from "../logger.js";
import {DEVICE_ID, DEVICE_NAME} from "./deviceIdentity.js"

const DISCOVERY_PORT = 41234;
const BROADCAST_ADDR = "255.255.255.255";

const HEARTBEAT_INTERVAL = 3000; // ms
const OFFLINE_TIMEOUT = 9000; // ms (≈ 3 heartbeats)

// HTTP server port (IMPORTANT)
const HTTP_PORT = 8080;

const socket = dgram.createSocket("udp4");

const START_TIME = Date.now();

type DeviceInfo = {
  deviceId: string;
  name: string;
  address: string;
  httpPort: number;
  uptime: number;
  lastSeen: number;
};

const devices = new Map<string, DeviceInfo>();

let started = false;

function getUptimeSeconds() {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

// broadcast presence
function broadcastPresence() {
  const payload = {
    deviceId: DEVICE_ID,
    name: DEVICE_NAME,
    httpPort: HTTP_PORT,
    uptime: getUptimeSeconds(),
    timestamp: Date.now(),
  };

  const message = Buffer.from(JSON.stringify(payload));

  socket.send(
    message,
    0,
    message.length,
    DISCOVERY_PORT,
    BROADCAST_ADDR
  );

  // log("debug",`BroadCasting Info : ${payload.name}`);
}

// listen for other devices
socket.on("message", (msg, rinfo) => {
  try {
    const data = JSON.parse(msg.toString());

    // ignore our own packets
    if (data.deviceId === DEVICE_ID) return;
    if (!data.deviceId || !data.httpPort) return;

    devices.set(data.deviceId, {
      deviceId: data.deviceId,
      name: data.name ?? "Unknown",
      address: rinfo.address,
      httpPort: data.httpPort,
      uptime: data.uptime ?? 0,
      lastSeen: Date.now(),
    });
  } catch {
    // ignore malformed packets
  }
});

// remove offline devices
function cleanupDevices() {
  const now = Date.now();

  for (const [id, info] of devices.entries()) {
    if (now - info.lastSeen > OFFLINE_TIMEOUT) {
      devices.delete(id);
    }
  }
}

// socket error handling 
socket.on("error", (err) => {
  console.error("LAN presence socket error:", err);
  socket.close();
});

// start presence system
export function startLanPresence() {
  if (started) return;
  started = true;

  socket.bind(DISCOVERY_PORT, () => {
    socket.setBroadcast(true);

    setInterval(broadcastPresence, HEARTBEAT_INTERVAL);
    setInterval(cleanupDevices, HEARTBEAT_INTERVAL);
  });
}

// IPC-safe accessor
export function getLanDevices(): DeviceInfo[] {
  return Array.from(devices.values());
}
