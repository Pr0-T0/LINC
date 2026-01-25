export type FileMeta = {
    id: string;
    relativePath: string;
    size: number;
};

export type MetaMessage = {
    type: "meta";
    files: FileMeta[];
};

export type ChunkMessage = {
    type: "chunk";
    fileId: string;
    data: ArrayBuffer;
};

export type EndMessage = {
    type: "end";
    fileId: string;
}

export type TransferMessage = 
    | MetaMessage
    | ChunkMessage
    | EndMessage;
