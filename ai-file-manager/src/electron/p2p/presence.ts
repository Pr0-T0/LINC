import { Bonjour } from "bonjour-service";
import { log } from "../logger.js";
import { DEVICE_ID, DEVICE_NAME } from "./deviceIdentity.js";

const bonjour = new Bonjour();

/* ───────── CONFIG ───────── */

const HTTP_PORT = 8080;

/* ───────── STATE ───────── */

type DeviceInfo = {
  deviceId: string;
  name: string;
  address: string;
  httpPort: number;
  uptime: number;
};

const devices = new Map<string, DeviceInfo>();

let started = false;
let browser: ReturnType<typeof bonjour.find> | null = null;

/* ───────── DISCOVERY HANDLER ───────── */

function handleServiceUp(service: any) {
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
  });

  log(
    "debug",
    existing
      ? `REFRESH:${service.name}`
      : `ONLINE:${service.name} (${ip})`
  );
}

function handleServiceDown(service: any) {
  const deviceId = service.txt?.deviceId;
  if (!deviceId) return;

  const existing = devices.get(deviceId);
  if (!existing) return;

  devices.delete(deviceId);
  log("debug", `OFFLINE:${existing.name}`);
}

/* ───────── START DISCOVERY ───────── */

function startDiscovery() {
  if (browser) return;

  browser = bonjour.find({ type: "p2p-transfer" });

  browser.on("up", handleServiceUp);
  browser.on("down", handleServiceDown);

  browser.on("error", (err: any) => {
    log("error", `Bonjour error: ${err.message}`);
  });
}

/* ───────── START PRESENCE ───────── */

export function startLanPresence() {
  if (started) return;
  started = true;

  bonjour.publish({
    name: DEVICE_NAME,
    type: "p2p-transfer",
    protocol: "tcp",
    port: HTTP_PORT,
    txt: {
      deviceId: DEVICE_ID,
      uptime: "0",
    },
  });

  startDiscovery();
}

/* ───────── CLEAN SHUTDOWN ───────── */

function shutdownPresence() {
  log("info", "Unpublishing Bonjour service...");

  try {
    bonjour.unpublishAll(() => {
      bonjour.destroy();
      log("info", "Bonjour service stopped cleanly.");
    });
  } catch (err: any) {
    log("error", `Shutdown error: ${err.message}`);
  }
}

// Handle Node process signals
process.on("SIGINT", () => {
  shutdownPresence();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdownPresence();
  process.exit(0);
});

/* ───────── ACCESSORS ───────── */

export function getLanDevices(): DeviceInfo[] {
  return Array.from(devices.values());
}

export function getPeerByName(name: string): DeviceInfo | null {
  for (const device of devices.values()) {
    if (device.name === name) {
      return device;
    }
  }
  return null;
}