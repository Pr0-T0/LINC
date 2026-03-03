import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import { TransferItem, TransferOffer } from "./types.js";
import { DEVICE_ID, DEVICE_NAME } from "./deviceIdentity.js";
import { getPeerByName } from "./presence.js";
import os from "os";



// helper to get lan ip ; defaults to localhost
function getLocalLanIp(): string {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (
        iface.family === "IPv4" &&
        !iface.internal 
      ) {
        return iface.address;
      }
    }
  }

  return "127.0.0.1";
}

const LOCAL_IP = getLocalLanIp();



export async function sendFilesTool(input: {
  peerName: string;
  filePaths: string[];
}) {
  try {
    if (!input.filePaths.length) {
      return { success: false, error: "No files provided" };
    }

    // 1. Resolve peer
    const peer = getPeerByName(input.peerName);
    if (!peer) {
      return { success: false, error: "Peer not found" };
    }
  //   const peer = {
  //     address: "127.0.0.1",
  //     httpPort: 8088,
  // };

    // 2. Validate files
    const validatedPaths: string[] = [];

    for (const p of input.filePaths) {
      const resolved = path.resolve(p);

      if (!fs.existsSync(resolved)) {
        return {
          success: false,
          error: `File not found: ${resolved}`,
        };
      }

      validatedPaths.push(resolved);
    }

    // 3. Build transfer items
    const transferId = crypto.randomUUID();

    const items: TransferItem[] = validatedPaths.map((filePath) => ({
      id: crypto.randomUUID(),
      name: path.basename(filePath),
      type: "file",
      path: filePath,
      size: fs.statSync(filePath).size,
    }));

    const offer: TransferOffer = {
        transferId,
        items,
        from: {
            deviceId: DEVICE_ID,
            name: DEVICE_NAME,
        },
        sender: {
            ip: LOCAL_IP,
            port: peer.httpPort,
        },
        timestamp: Date.now(),
    };

    // 4. Send HTTP offer
    const accepted = await sendOffer(
        peer.address,
        peer.httpPort,
        offer
    );

    return {
      success: true,
      accepted,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
    };
  }
}

function sendOffer(
  ip: string,
  port: number,
  offer: TransferOffer
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(offer);

    const req = http.request(
      {
        hostname: ip,
        port,
        path: "/offer",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let body = "";

        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            return reject(new Error("Offer failed"));
          }

          const parsed = JSON.parse(body);
          resolve(parsed.accepted === true);
        });
      }
    );

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}