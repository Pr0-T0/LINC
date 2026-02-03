import path from "path";
import { log } from "../logger.js";
import { getSettings } from "../settings.js";
import { deleteRoot, getIndexedRoots } from "./db.js";
import { manualScan } from "./scanner.js";

export async function reconcileRoots() {
  const { scan } = getSettings();

  const settingsRoots = scan.roots.map(r => path.normalize(r));
  const indexedRoots = getIndexedRoots();

  // Delete roots that no longer exist in settings
  for (const dbRoot of indexedRoots) {
    if (!settingsRoots.includes(dbRoot)) {
      log("info", `Deleting removed root: ${dbRoot}`);
      deleteRoot(dbRoot);
    }
  }

  // Scan active roots
  for (const root of settingsRoots) {
    try {
      await manualScan(root);
    } catch (err) {
      console.error("Error scanning root:", root, err);
    }
  }
}
