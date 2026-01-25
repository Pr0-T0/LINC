// src/electron/main.ts
import { app, BrowserWindow, ipcMain, dialog, Menu} from "electron";
import path, { join } from "path";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
import { deleteRoot, getIndexedRoots, initDB, resetDB } from "./db/db.js";
import { runAgent } from "./api/functionCall.js";
import { getLanDevices, getSelfHostInfo, isSelfHost, startLanPresence } from "./webrtc/presence.js";
import { loadSettings, saveSettings, getSettings } from "./settings.js";
import { log } from "./logger.js";
import { reconcileRoots } from "./db/reconcileRoots.js";
import { startHostElection } from "./webrtc/hostElection.js";
import os from "os"
import { createPeerClient } from "./webrtc/peerClient.js";
// Disable GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("force-device-scale-factor", "1");
// Menu.setApplicationMenu(null);

function getDeviceId() {
  return os.hostname();
}

app.whenReady().then(async () => {
  // Settings 
  const settings = loadSettings(); // <-- creates settings.json
  console.log("[Settings] Loaded:", settings);

  //Database 
  initDB();
  console.log("[DB] Ready and connected.");

  //File Indexing 
  
  await reconcileRoots();

  // LAN Presence — START ONCE
  startLanPresence();

  // Host election — depends on presence
  startHostElection(() => {
    return Math.floor(process.uptime());
  });

  



  //Window 
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: getPreloadPath(),

      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });


  if (isDev()) {
    await mainWindow.loadURL("http://localhost:5432");
  } else {
    await mainWindow.loadFile(join(app.getAppPath(), "/dist-react/index.html"));
  }

  console.log("[App] Main window loaded!");
  log("info","App started");

  // ---------------- IPC: AI ----------------
  ipcMain.handle("ai:chat-sql", async (_event, userQuery: string) => {
    try {
      const finalResponse = await runAgent(userQuery);
      return { success: true, result: finalResponse };
    } catch (err: any) {
      return { success: false, error: err.message ?? "Unknown AI error" };
    }
  });

  // ---------------- IPC: Settings ----------------
  ipcMain.handle("settings:get", () => {
    return JSON.parse(JSON.stringify(getSettings()));
  });

  ipcMain.handle("settings:set", (_event, settings) => {
    saveSettings(JSON.parse(JSON.stringify(settings)));
  });

  ipcMain.handle("settings:pickFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  //rescan IPC 
  ipcMain.handle("scan:rescan", async () => {
  console.log("Manual Rescan");
  log("info","Reindexing Roots")

  await reconcileRoots();
    log("info","Reindexing Successfull")
  });

  //UDP presence IPC
  ipcMain.handle("lan:getDevices", () => {
    return getLanDevices();
  });


});

ipcMain.handle("lan:getHost", () => {
  if (isSelfHost()) {
    return getSelfHostInfo();
  }

  return getLanDevices().find(d => d.role === "host") ?? null;
});


// Graceful Shutdown
app.on("before-quit", () => {
  try {
    const { closeDB } = require("./db/db.js");
    closeDB();
    console.log("[DB] Closed cleanly.");
  } catch {
    console.warn("[DB] Failed to close cleanly");
  }
});

