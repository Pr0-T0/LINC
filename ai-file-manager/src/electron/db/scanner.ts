// hashing takes a lot of time
// only implement hashing when creating the crawler
// hashing is used to check for changes in files

import fs from "fs";
import path from "path";
import { upsertMany } from "./db.js";

interface FileMeta {
  path: string;
  name: string;
  parent: string; // folder name only (unchanged)
  type: "file" | "directory";
  extension?: string;
  size?: number;
  created_at?: number;
  modified_at?: number;
  root_path: string;
  last_seen_at: number;
}

const BATCH_SIZE = 400;
let batch: FileMeta[] = [];

// folders to skip
const IGNORE_DIRS = new Set([
  ".cache", ".local", ".npm", ".cargo", ".rustup",
  ".var", ".config", ".mozilla", "node_modules",
  ".git", "__pycache__", ".vscode"
]);

function shouldIgnore(name: string): boolean {
  if (name.startsWith(".")) return true;
  if (IGNORE_DIRS.has(name)) return true;
  return false;
}

// ---------------- PRODUCTION-SAFE SCANNER ----------------
export async function scanDirectory(
  root: string,
  dir: string = root,
  realRoot: string = fs.realpathSync(root),
  scanTime: number
): Promise<void> {
  let realDir: string;

  // Enforce boundary on every recursion
  try {
    realDir = fs.realpathSync(dir);
    if (!realDir.startsWith(realRoot)) {
      console.warn("[SCAN] Escaped root, skipping:", realDir);
      return;
    }
  } catch {
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  // Add current directory itself
  try {
    const dirStat = fs.statSync(dir);
    batch.push({
      path: dir,
      name: path.basename(dir),
      parent: path.basename(path.dirname(dir)),
      type: "directory",
      size: 0,
      created_at: dirStat.birthtimeMs,
      modified_at: dirStat.mtimeMs,
      root_path: root,
      last_seen_at: scanTime
    });
  } catch {
    // ignore unreadable folder
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    // Skip symlinks completely (important)
    if (entry.isSymbolicLink()) continue;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      if (shouldIgnore(entry.name)) continue;

      batch.push({
        path: full,
        name: entry.name,
        parent: path.basename(dir),
        type: "directory",
        size: 0,
        created_at: stat.birthtimeMs,
        modified_at: stat.mtimeMs,
        root_path: root,
        last_seen_at: scanTime
      });

      await scanDirectory(root, full, realRoot, scanTime);

    } else if (entry.isFile()) {
      if (shouldIgnore(entry.name)) continue;

      batch.push({
        path: full,
        name: entry.name,
        parent: path.basename(dir),
        type: "file",
        extension: path.extname(entry.name),
        size: stat.size,
        created_at: stat.birthtimeMs,
        modified_at: stat.mtimeMs,
        root_path: root,
        last_seen_at:scanTime
      });
    }

    // Flush batch
    if (batch.length >= BATCH_SIZE) {
      upsertMany(batch);
      batch = [];
    }
  }

  // Flush leftovers only once (root call)
  if (dir === root && batch.length > 0) {
    upsertMany(batch);
    batch = [];
  }
}

import { markRootUnseen, deleteUnseenInRoot } from "./db.js";

export async function manualScan(root: string) {
  const normalizedRoot = path.normalize(root);
  const scanTime = Date.now();
  const realRoot = fs.realpathSync(normalizedRoot);

  // 1. mark old entries as unseen
  markRootUnseen(normalizedRoot);

  // 2. scan filesystem
  await scanDirectory(normalizedRoot, normalizedRoot, realRoot, scanTime);

  // 3. delete missing entries
  deleteUnseenInRoot(normalizedRoot);
}

