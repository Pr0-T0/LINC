import crypto from "crypto";
import os from "os";
import { getSettings } from "../settings.js";

export const DEVICE_ID = crypto.randomUUID();

export function getDeviceName(): string {
  const settings = getSettings();

  if (settings.device?.name && settings.device.name.trim() !== "") {
    return settings.device.name;
  }

  return os.hostname();
}

// export const DEVICE_INFO = {
//   id: DEVICE_ID,
//   name: getDeviceName(),
// };