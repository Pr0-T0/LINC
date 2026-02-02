import {DEVICE_ID, DEVICE_NAME} from "./deviceIdentity.js"
import express from "express";
import cors from "cors";
import { timeStamp } from "console";
import { log } from "../logger.js";


const HTTP_PORT = 8080;

let started = false;

export function startHttpServer() {
    if (started) return;
    started = true;

    const app = express();

    app.use(cors());
    app.use(express.json());

    // health/handshake endpoint
    app.get("/info", (_req, res) => {
        res.json({
            deviceId: DEVICE_ID,
            name: DEVICE_NAME,
            capabilities: ["send","receive"],
            timeStamp: Date.now(),
        });
    });
    
    // simple health check
    app.get("/ping", (_req, res) => {
        res.send("simon says ping..");
    });

    app.listen(HTTP_PORT, "0.0.0.0", () => {
        log("info",`listening on port ${HTTP_PORT}`);
    });
}