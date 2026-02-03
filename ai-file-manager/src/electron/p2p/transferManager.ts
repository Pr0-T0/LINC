import { app, BrowserWindow } from "electron";
import { TransferOffer, TransferItem } from "./types.js";
import path from "path";
import fs from "fs";
import { log } from "../logger.js";
import http from "http";

export class TransferManager {
  constructor(private win: BrowserWindow) {}

  async start(offer: TransferOffer) {
    const baseDir = path.join(
      app.getPath("downloads"),
      "LINC",
      offer.from.name
    );

    fs.mkdirSync(baseDir, { recursive: true });

    for (const item of offer.items) {
      if (item.type !== "file") continue;
      if (!item.path) {
        log("warn", `Skipping file without path: ${item.name}`);
        continue;
      }

      await this.downloadFile(offer, item, baseDir);
    }

    this.win.webContents.send(
      "p2p:transfer-complete",
      offer.transferId
    );

    log("info", `Transfer ${offer.transferId} completed`);
  }

  private downloadFile(
    offer: TransferOffer,
    item: TransferItem,
    baseDir: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const targetPath = path.join(baseDir, item.name);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      const url = `http://${offer.sender.ip}:${offer.sender.port}/download?path=${encodeURIComponent(
        item.path!
      )}`;

      const file = fs.createWriteStream(targetPath);

      http
        .get(url, (res) => {
          let received = 0;

          res.on("data", (chunk) => {
            received += chunk.length;

            this.win.webContents.send("p2p:transfer-progress", {
              transferId: offer.transferId,
              file: item.name,
              received,
              total: item.size,
            });
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve();
          });
        })
        .on("error", (err) => {
          log("error", `Download failed: ${item.name}`);
          reject(err);
        });
    });
  }
}
