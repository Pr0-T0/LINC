export type TransferItem = {
    id: string;
    name: string;
    size: number;
    type: "file" | "folder";
    path?: string; 
};

export type TransferOffer = {
  transferId: string;
  items: TransferItem[];
  from: {
    deviceId: string;
    name: string;
  };
  sender: {
    ip: string;
    port: number;
  };
  timestamp: number;
};
