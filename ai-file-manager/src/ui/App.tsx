import { useEffect, useState } from "react";
import Sidebar from "./componants/sideBar";
import MainContent from "./componants/mainContent";
import FloatingTextBar from "./componants/floatingTextBar";
import FilesScreen from "./screens/fileScreen";
import TerminalLogger from "./componants/terminalLogger";
import OfferPopup from "./componants/offerPopup";
import type { TransferOffer } from "../electron/p2p/types";

function App() {
  const [currentView, setCurrentView] = useState<
    "overview" | "files" | "peers" | "settings"
  >("overview");

  const [aiResult, setAIResult] = useState<any>(null);

  //  GLOBAL OFFER STATE
  const [incomingOffer, setIncomingOffer] =
    useState<TransferOffer | null>(null);

  useEffect(() => {
    // listen once, globally
    //@ts-ignore
    window.p2p.onOffer((offer) => {
      setIncomingOffer(offer);
    });
  }, []);

  const handleAIOutput = (response: any) => {
    setAIResult(response);
    if (response?.kind === "files") {
      setCurrentView("files");
    }
  };

  return (
    <div className="h-screen w-screen flex bg-zinc-950 text-gray-200 overflow-hidden">
      {/* LEFT SIDEBAR */}
      <Sidebar setCurrentView={setCurrentView} />

      {/* CENTER + RIGHT */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {currentView === "files" ? (
            <FilesScreen aiResult={aiResult} />
          ) : (
            <MainContent currentView={currentView} />
          )}
        </div>

        <div className="w-70 border-l border-zinc-800 flex flex-col">
          <TerminalLogger />
        </div>
      </div>

      {/* FLOATING INPUT */}
      <FloatingTextBar onAICommand={handleAIOutput} />

      {/* 🔴 GLOBAL OFFER POPUP */}
      {incomingOffer && (
        <OfferPopup
          offer={incomingOffer}
          onAccept={() => {
            //@ts-ignore
            window.p2p.acceptOffer(incomingOffer.transferId);
            setIncomingOffer(null);
          }}
          onReject={() => {
            //@ts-ignore
            window.p2p.rejectOffer(incomingOffer.transferId);
            setIncomingOffer(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
