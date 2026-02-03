import type { TransferOffer } from "../../electron/p2p/types";


type Props = {
  offer: TransferOffer;
  onAccept: () => void;
  onReject: () => void;
};

export default function OfferPopup({ offer, onAccept, onReject }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-105 rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl p-5">
        <h3 className="text-lg font-semibold mb-2">
          Incoming files
        </h3>

        <p className="text-sm text-zinc-400 mb-3">
          <span className="font-medium text-zinc-200">
            {offer.from.name}
          </span>{" "}
          wants to send:
        </p>

        <div className="max-h-48 overflow-y-auto mb-4 space-y-1">
          {offer.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between text-sm bg-zinc-800 rounded px-2 py-1"
            >
              <span>
                {item.type === "folder" ? "📁" : "📄"} {item.name}
              </span>
              <span className="text-zinc-400">
                {item.size} bytes
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onReject}
            className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-black"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
