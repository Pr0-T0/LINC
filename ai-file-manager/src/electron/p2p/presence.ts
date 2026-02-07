import { Bonjour } from "bonjour-service";
import { log } from "../logger.js";
import { DEVICE_ID, DEVICE_NAME } from "./deviceIdentity.js";

const bonjour = new Bonjour();

/* ───────── CONFIG ───────── */

const HTTP_PORT = 8080;

// automatic cleanup (safe + stable)
const OFFLINE_TIMEOUT = 15_000;     // device removed if unseen for 15s
const CLEANUP_INTERVAL = 3_000;

// browser self-heal (rare edge cases)
const DISCOVERY_RESTART_INTERVAL = 60_000;

/* ───────── STATE ───────── */

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
let browser: ReturnType<typeof bonjour.find> | null = null;
const START_TIME = Date.now();

/* ───────── UTILS ───────── */

function uptimeSeconds() {
  return Math.floor((Date.now() - START_TIME) / 1000);
}

/* ───────── CLEANUP ───────── */

function cleanupDevices() {
  const now = Date.now();

  for (const [id, info] of devices.entries()) {
    if (now - info.lastSeen > OFFLINE_TIMEOUT) {
      log("debug", `OFFLINE:${info.name}`);
      devices.delete(id);
    }
  }
}

/* ───────── DISCOVERY ───────── */

function handleService(service: any) {
  const ip =
    service.addresses?.find((a: string) => a.includes(".")) ??
    service.referer?.address;

  if (!ip) return;

  const deviceId = service.txt?.deviceId;
  if (!deviceId || deviceId === DEVICE_ID) return;

  const existing = devices.get(deviceId);

  devices.set(deviceId, {
    deviceId,
    name: service.name,
    address: ip,
    httpPort: service.port,
    uptime: Number(service.txt?.uptime ?? 0),
    lastSeen: Date.now(),
  });

  log(
    "debug",
    existing
      ? `REFRESH:${service.name}`
      : `ONLINE:${service.name} (${ip})`
  );
}

function startDiscovery() {
  if (browser) browser.stop();

  browser = bonjour.find({ type: "p2p-transfer" });
  browser.on("up", handleService);
}

/* ───────── START ───────── */

export function startLanPresence() {
  if (started) return;
  started = true;

  // Advertise THIS device
  bonjour.publish({
    name: DEVICE_NAME,
    type: "p2p-transfer",
    protocol: "tcp",
    port: HTTP_PORT,
    txt: {
      deviceId: DEVICE_ID,
      uptime: uptimeSeconds().toString(),
    },
  });

  startDiscovery();

  setInterval(cleanupDevices, CLEANUP_INTERVAL);
  setInterval(startDiscovery, DISCOVERY_RESTART_INTERVAL);
}

/* ───────── OPTIONAL MANUAL SCAN ───────── */

export function manualScan() {
  log("debug", "Manual scan triggered");
  startDiscovery();
  cleanupDevices();
}

/* ───────── ACCESSOR ───────── */

export function getLanDevices(): DeviceInfo[] {
  return Array.from(devices.values());
}
