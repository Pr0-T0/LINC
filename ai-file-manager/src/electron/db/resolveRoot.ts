// config/resolveRootPath.ts
import path from "path";
import { getSettings } from "../settings.js";

let CACHED_ROOTS: string[] | null = null;

function getRoots(): string[] {
  if (CACHED_ROOTS) return CACHED_ROOTS;

  const settings = getSettings();
  const roots = settings.scan.roots;

  CACHED_ROOTS = roots
    .map(r => path.resolve(r))
    .sort((a, b) => b.length - a.length); // deepest first

  return CACHED_ROOTS;
}

export function resolveRootPath(fullPath: string): string {
  const resolved = path.resolve(fullPath);

  for (const root of getRoots()) {
    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return root;
    }
  }

  throw new Error(`Path outside indexed roots: ${resolved}`);
}
