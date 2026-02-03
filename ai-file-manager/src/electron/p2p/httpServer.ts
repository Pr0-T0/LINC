import { DEVICE_ID, DEVICE_NAME } from "./deviceIdentity.js";
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { log } from "../logger.js";
import { TransferOffer } from "./types.js";



const pendingOfferrs = new Map<string, TransferOffer>();

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

  //  FILE DOWNLOAD ENDPOINT
  app.get("/download", (req, res) => {
    const filePath = req.query.path as string;

    if (!filePath) {
      res.status(400).send("Missing file path");
      return;
    }

    // normalize path 
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

  //offer endpoint
  app.post("/offer", (req,res) => {
    const {transferId, items, from} = req.body;

    //validation
    if (
        !transferId || 
        !Array.isArray(items) ||
        items.length === 0 ||
        !from?.deviceId ||
        !from?.name
    ){
        res.status(400).json({error: "invalid offer payload"});
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

    //store offer
    const offer: TransferOffer = {
        transferId,
        items,
        from,
        timestamp: Date.now(),
    };

    pendingOfferrs.set(transferId, offer);
    log(
        "info",`Incoming offer with ${items.length} items from ${from.name}`
    );

    //always accept no conformation for now later add an IPC
    const accepted = true;

    if (!accepted) {
        pendingOfferrs.delete(transferId);
        res.json({accepted: false});
        return;
    }

    res.json({accepted:true});
  });

  app.listen(HTTP_PORT, "0.0.0.0", () => {
    log("info", `HTTP server listening on port ${HTTP_PORT}`);
  });
}
