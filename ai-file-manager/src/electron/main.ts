// src/electron/main.ts
import { app, BrowserWindow, ipcMain, dialog, Menu} from "electron";
import { join } from "path";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
import { initDB, resetDB } from "./db/db.js";
import { scanDirectory } from "./db/scanner.js";
import { runAgent } from "./api/functionCall.js";
import { getLanDevices, startLanPresence } from "./p2p/presence.js";
import { loadSettings, saveSettings } from "./settings.js";
import { log } from "./logger.js";
import { startHttpServer, setMainWindow } from "./p2p/httpServer.js";

// Disable GPU
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("force-device-scale-factor", "1");
// Menu.setApplicationMenu(null);

app.whenReady().then(async () => {
  // Settings 
  const settings = loadSettings(); // <-- creates settings.json
  console.log("[Settings] Loaded:", settings);

  // Database 
  initDB();
  console.log("[DB] Ready and connected.");

  // File Indexing 
  const roots = settings.scan.roots;
  console.log("[Scan] Starting file indexing:", roots);

  for (const root of roots) {
    try {
      console.log(`[Scan] Scanning root: ${root}`);
      await scanDirectory(root);
    } catch (err) {
      console.error(`[Scan] Error scanning root ${root}:`, err);
    }
  }

  // LAN Presence 
  startLanPresence();
  startHttpServer();

  // Window 
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

  //for pop up
  setMainWindow(mainWindow);

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
    return JSON.parse(JSON.stringify(loadSettings()));
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
  log("info","Reindexing..")

  const settings = loadSettings();
  const roots = settings.scan.roots;

  resetDB();

  for (const root of roots) {
    try {
      await scanDirectory(root);
    } catch (err) {
      console.error("Error scanning Root : ",root, err)
    }
  }
  });

  //UDP presence IPC
  ipcMain.handle("lan:getDevices", () => {
    return getLanDevices();
  });


});


// ---------------- Graceful Shutdown ----------------
app.on("before-quit", () => {
  try {
    const { closeDB } = require("./db/db.js");
    closeDB();
    console.log("[DB] Closed cleanly.");
  } catch {
    console.warn("[DB] Failed to close cleanly");
  }
});
