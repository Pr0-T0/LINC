import os from "os";
import crypto from "crypto";

// created ONCE when app starts
export const DEVICE_ID = crypto.randomUUID();
export const DEVICE_NAME = os.hostname();

// optional future use
export const DEVICE_INFO = {
  id: DEVICE_ID,
  name: DEVICE_NAME,
};
