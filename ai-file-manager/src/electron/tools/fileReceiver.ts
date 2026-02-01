import path from "path";
import { MESSAGE_TYPES } from "../webrtc/protocol/constants.js";
import { FileMeta, TransferMessage } from "../webrtc/protocol/types.js";
import fs from "fs";

type ActiveFile = { //later move it to types
  meta: FileMeta;
  stream: fs.WriteStream;
  received: number;
};


// backend/fileReceiver.ts
export function createFileReceiver(outputDir: string) {
  const files = new Map<string, ActiveFile>();

  function ensureDir(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  return function handleMessage(msg: TransferMessage) {
    switch (msg.type) {
      case MESSAGE_TYPES.META: {
        for (const meta of msg.files) {
          const fullPath = path.join(outputDir, meta.relativePath);
          ensureDir(fullPath);

          files.set(meta.id, {
            meta,
            stream: fs.createWriteStream(fullPath),
            received: 0,
          });
        }
        break;
      }

      case MESSAGE_TYPES.CHUNK: {
        const file = files.get(msg.fileId);
        if (!file) return;

        const buffer = Buffer.from(msg.data);
        file.received += buffer.length;
        file.stream.write(buffer);
        break;
      }

      case MESSAGE_TYPES.END: {
        const file = files.get(msg.fileId);
        if (!file) return;

        file.stream.end();
        files.delete(msg.fileId);
        break;
      }
    }
  };
}
