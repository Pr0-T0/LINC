// src/webrtc/fileSender.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileMeta } from "../webrtc/protocol/types.js";
import { CHUNK_SIZE } from "../webrtc/protocol/constants.js";
import type { DataConnection } from "peerjs";


function walk(dir: string, base = dir): FileMeta[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: FileMeta[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(full, base));
    } else {
      files.push({
        id: crypto.randomUUID(),
        relativePath: path.relative(base, full),
        size: fs.statSync(full).size,
      });
    }
  }

  return files;
}

export async function sendFiles(
  conn: DataConnection,
  paths: string[]
) {
  let allFiles: { meta: FileMeta; fullPath: string }[] = [];

  for (const p of paths) {
    if (fs.statSync(p).isDirectory()) {
      for (const meta of walk(p)) {
        allFiles.push({
          meta,
          fullPath: path.join(p, meta.relativePath),
        });
      }
    } else {
      allFiles.push({
        meta: {
          id: crypto.randomUUID(),
          relativePath: path.basename(p),
          size: fs.statSync(p).size,
        },
        fullPath: p,
      });
    }
  }

  // Send metadata first
  conn.send({
    type: "meta",
    files: allFiles.map(f => f.meta),
  });

  // Send file data
  for (const { meta, fullPath } of allFiles) {
    const stream = fs.createReadStream(fullPath, {
      highWaterMark: CHUNK_SIZE,
    });

    for await (const chunk of stream) {
      conn.send({
        type: "chunk",
        fileId: meta.id,
        data: chunk.buffer,
      });
    }

    conn.send({ type: "end", fileId: meta.id });
  }
}
