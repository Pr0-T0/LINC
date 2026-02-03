import { DEVICE_ID, DEVICE_NAME } from "./deviceIdentity.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { log } from "../logger.js";
import { TransferOffer } from "./types.js";
import { BrowserWindow, ipcMain } from "electron";
import { TransferManager } from "./transferManager.js";

// allow server → UI communication
let mainWindowRef: BrowserWindow | null = null;
export function setMainWindow(win: BrowserWindow) {
  mainWindowRef = win;
}

const pendingOffers = new Map<string, TransferOffer>();

const HTTP_PORT = 8080;
let started = false;

export function startHttpServer() {
  if (started) return;
  started = true;

  const app = express();

  app.use(cors());
  app.use(express.json());

  // info endpoint
  app.get("/info", (_req, res) => {
    res.json({
      deviceId: DEVICE_ID,
      name: DEVICE_NAME,
      capabilities: ["send", "receive"],
      timestamp: Date.now(),
    });
  });

  // ping endpoint
  app.get("/ping", (_req, res) => {
    res.send("simon says ping..");
  });

  // file download endpoint
  app.get("/download", (req, res) => {
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).send("Missing file path");
      return;
    }

    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).send("File not found");
      return;
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      res.status(400).send("Not a file");
      return;
    }

    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${path.basename(resolvedPath)}"`
    );
    res.setHeader("Content-Type", "application/octet-stream");

    log("info", `Sending file: ${resolvedPath}`);

    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);

    stream.on("error", (err) => {
      console.error("File stream error:", err);
      res.end();
    });
  });

  // transfer offer endpoint
  app.post("/offer", async (req, res) => {
    const { transferId, items, from } = req.body;

    // validate payload
    if (
      !transferId ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !from?.deviceId ||
      !from?.name
    ) {
      res.status(400).json({ error: "Invalid offer payload" });
      return;
    }

    for (const item of items) {
      if (
        !item.id ||
        !item.name ||
        typeof item.size !== "number" ||
        !["file", "folder"].includes(item.type)
      ) {
        res.status(400).json({ error: "Invalid item in offer" });
        return;
      }
    }

    const senderIp = 
      req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
      req.socket.remoteAddress ||
      "";
    const normalizedIp = senderIp.replace("::ffff:","");

    const offer: TransferOffer = {
      transferId,
      items,
      from,
      sender: {
        ip: normalizedIp,
        port: HTTP_PORT,
      },
      timestamp: Date.now(),
    };

    pendingOffers.set(transferId, offer);

    log(
      "info",
      `Incoming offer with ${items.length} items from ${from.name}`
    );

    // notify frontend
    if (mainWindowRef) {
      mainWindowRef.webContents.send("p2p:offer-received", offer);
    }

    // wait for user decision with timeout
    const decision = await new Promise<"accept" | "reject">((resolve) => {
      const acceptChannel = `p2p:offer-accept:${transferId}`;
      const rejectChannel = `p2p:offer-reject:${transferId}`;

      const cleanup = () => {
        ipcMain.removeAllListeners(acceptChannel);
        ipcMain.removeAllListeners(rejectChannel);
      };

      const timeout = setTimeout(() => {
        cleanup();
        log("info", `Offer ${transferId} timed out`);
        resolve("reject");
      }, 30_000); // 30 seconds

      ipcMain.once(acceptChannel, () => {
        clearTimeout(timeout);
        cleanup();
        resolve("accept");
      });

      ipcMain.once(rejectChannel, () => {
        clearTimeout(timeout);
        cleanup();
        resolve("reject");
      });
    });

    if (decision === "reject") {
      pendingOffers.delete(transferId);
      res.json({ accepted: false });
      return;
    }

    res.json({ accepted: true });
    //start transfer
    if (mainWindowRef) {
      const tm = new TransferManager(mainWindowRef);
      tm.start(offer).catch((err) => {
        log("error",`Transfer failed: ${err.message}`);
      });
    }
  });

  app.listen(HTTP_PORT, "0.0.0.0", () => {
    log("info", `HTTP server listening on port ${HTTP_PORT}`);
  });
}
