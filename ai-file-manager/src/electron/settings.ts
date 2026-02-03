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
};

// Path Resolution 
let SETTINGS_PATH: string | null = null;

//settings cache
let SETTINGS_CACHE: AppSettings | null = null;

function resolveSettingsPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  if (isDev()) {
    // Development → project-root/data/settings.json
    const projectRoot = path.resolve(__dirname, "../");
    const devDataDir = path.join(projectRoot, "data");
    fs.mkdirSync(devDataDir, { recursive: true });
    return path.join(devDataDir, "settings.json");
  } else {
    // Production → userData/data/settings.json
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

// ---------------- Load / Save ----------------
export function loadSettings(): AppSettings {
  if (SETTINGS_CACHE) {
    return SETTINGS_CACHE;
  }


  const settingsPath = getSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(DEFAULT_SETTINGS, null, 2)
    );
    SETTINGS_CACHE = DEFAULT_SETTINGS;
    console.log("[settings] created");
    return SETTINGS_CACHE;
  }

  try {
    // SETTINGS_CACHE = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    // return SETTINGS_CACHE;
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
  };

  return SETTINGS_CACHE;
  } catch {
    // Corrupt settings recovery
    fs.writeFileSync(
      settingsPath,
      JSON.stringify(DEFAULT_SETTINGS, null, 2)
    );
    console.warn("[settings] corrupted file reset");
    SETTINGS_CACHE = DEFAULT_SETTINGS;
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  const settingsPath = getSettingsPath();
  SETTINGS_CACHE = settings;
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(settings, null, 2)
  );
}

export function getSettings(): AppSettings {
  if (!SETTINGS_CACHE) {
    throw new Error(
      "Settings not loaded. Call loadSettings() once in main()."
    )
  }
  return SETTINGS_CACHE;
}
