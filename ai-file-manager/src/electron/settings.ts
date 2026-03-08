// main/settings.ts
import path from "path";
import fs from "fs";
import { app } from "electron";
import { fileURLToPath } from "url";
import { isDev } from "./util.js";

// ---------------- Types ----------------
export interface AppSettings {
  scan: {
    roots: string[];
    exclude: string[];
  };

  ui: {
    showTerminal: boolean;
  };

  device: {
    name: string;
  };
}

// ---------------- Defaults ----------------
const DEFAULT_SETTINGS: AppSettings = {
  scan: {
    roots: [],
    exclude: [
      ".cache",
      ".local",
      ".npm",
      ".cargo",
      ".rustup",
      ".var",
      ".config",
      ".mozilla",
      "node_modules",
      ".git",
      "__pycache__",
      ".vscode",
    ],
  },

  ui: {
    showTerminal: true,
  },

  device: {
    name: "My Device",
  },
};

// ---------------- Paths ----------------
let SETTINGS_PATH: string | null = null;

// ---------------- Cache ----------------
let SETTINGS_CACHE: AppSettings | null = null;

// ---------------- Resolve path ----------------
function resolveSettingsPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (isDev()) {
    const projectRoot = path.resolve(__dirname, "../");
    const devDataDir = path.join(projectRoot, "data");
    fs.mkdirSync(devDataDir, { recursive: true });
    return path.join(devDataDir, "settings.json");
  } else {
    const userDataPath = app.isReady()
      ? app.getPath("userData")
      : path.join(process.cwd(), "userdata_fallback");

    const dataDir = path.join(userDataPath, "data");
    fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, "settings.json");
  }
}

function getSettingsPath(): string {
  if (!SETTINGS_PATH) {
    SETTINGS_PATH = resolveSettingsPath();
    console.log("[settings] path:", SETTINGS_PATH);
  }
  return SETTINGS_PATH;
}

// ---------------- Load ----------------
export function loadSettings(): AppSettings {
  if (SETTINGS_CACHE) {
    return SETTINGS_CACHE;
  }

  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    SETTINGS_CACHE = DEFAULT_SETTINGS;
    console.log("[settings] created");
    return SETTINGS_CACHE;
  }

  try {
    const parsed = JSON.parse(
      fs.readFileSync(settingsPath, "utf-8")
    ) as Partial<AppSettings>;

    SETTINGS_CACHE = {
      scan: {
        roots: Array.isArray(parsed.scan?.roots)
          ? parsed.scan!.roots
          : DEFAULT_SETTINGS.scan.roots,

        exclude: Array.isArray(parsed.scan?.exclude)
          ? parsed.scan!.exclude
          : DEFAULT_SETTINGS.scan.exclude,
      },

      ui: {
        showTerminal:
          typeof parsed.ui?.showTerminal === "boolean"
            ? parsed.ui.showTerminal
            : DEFAULT_SETTINGS.ui.showTerminal,
      },

      device: {
        name:
          typeof parsed.device?.name === "string"
            ? parsed.device.name
            : DEFAULT_SETTINGS.device.name,
      },
    };

    return SETTINGS_CACHE;
  } catch {
    fs.writeFileSync(settingsPath, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    console.warn("[settings] corrupted file reset");

    SETTINGS_CACHE = DEFAULT_SETTINGS;
    return SETTINGS_CACHE;
  }
}

// ---------------- Save ----------------
export function saveSettings(settings: AppSettings) {
  const settingsPath = getSettingsPath();

  SETTINGS_CACHE = {
    scan: {
      ...DEFAULT_SETTINGS.scan,
      ...settings.scan,
    },

    ui: {
      ...DEFAULT_SETTINGS.ui,
      ...settings.ui,
    },

    device: {
      ...DEFAULT_SETTINGS.device,
      ...settings.device,
    },
  };

  fs.writeFileSync(settingsPath, JSON.stringify(SETTINGS_CACHE, null, 2));
}

// ---------------- Getter ----------------
export function getSettings(): AppSettings {
  if (!SETTINGS_CACHE) {
    throw new Error(
      "Settings not loaded. Call loadSettings() once in main()."
    );
  }

  return SETTINGS_CACHE;
}