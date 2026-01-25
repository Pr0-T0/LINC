export const CHUNK_SIZE = 64 * 1024; // 64 KB

export const MESSAGE_TYPES = {
  META: "meta",
  CHUNK: "chunk",
  END: "end",
} as const;
