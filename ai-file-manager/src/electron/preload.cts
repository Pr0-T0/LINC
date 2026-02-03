// src/electron/preload.ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  aiQuery: async (userQuery: string) => {
    try {
      return await ipcRenderer.invoke("ai:chat-sql", userQuery);
    } catch (error: any) {
      console.error("[Preload] aiQuery error:", error);
      return {
        kind: "aggregate",
        metric: "error",
        value: error.message ?? "Unknown error",
      };
    }
  },
});


contextBridge.exposeInMainWorld("settingsAPI", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (settings: any) => ipcRenderer.invoke("settings:set", settings),
  pickFolder: () => ipcRenderer.invoke("settings:pickFolder"),
});

contextBridge.exposeInMainWorld("rescanAPI", {
  rescan: () => ipcRenderer.invoke("scan:rescan"),
});

contextBridge.exposeInMainWorld("lanAPI", {
  getDevices: () => ipcRenderer.invoke("lan:getDevices"),
});

contextBridge.exposeInMainWorld("fsAPI", {
  toFileURL: (absolutePath: string) => {
    const normalized = absolutePath.replace(/\\/g, "/");

    //linux/mac
    if (normalized.startsWith("/")) {
      return `file://${encodeURI(normalized)}`;
    }

    //windows
    return `file:///${encodeURI(normalized)}`;
  }
});

//logger IPC

contextBridge.exposeInMainWorld("logger", {
  onLog: (callback: (log: any) => void) => {
    ipcRenderer.on("log:event", (_, log) => callback(log));
  },
  offLog: (callback: any) => {
    ipcRenderer.removeListener("log:event", callback);
  },
});


//file receive IPC
contextBridge.exposeInMainWorld("p2p", {
  // listen for incoming offers
  onOffer: (callback: (offer: any) => void) => {
    ipcRenderer.on("p2p:offer-received", (_event, offer) => {
      callback(offer);
    });
  },

  // user actions
  acceptOffer: (transferId: string) => {
    ipcRenderer.send(`p2p:offer-accept:${transferId}`);
  },

  rejectOffer: (transferId: string) => {
    ipcRenderer.send(`p2p:offer-reject:${transferId}`);
  },
});