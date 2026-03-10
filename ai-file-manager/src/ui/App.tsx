import { useEffect, useState } from "react";
import Sidebar from "./componants/sideBar";
import MainContent from "./componants/mainContent";
import FloatingTextBar from "./componants/floatingTextBar";
import FilesScreen from "./screens/fileScreen";
import TerminalLogger from "./componants/terminalLogger";
import OfferPopup from "./componants/offerPopup";
import type { TransferOffer } from "../electron/p2p/types";

type Settings = {
  ui?: {
    showTerminal?: boolean;
  };
};



function App() {
  const [currentView, setCurrentView] = useState<
    "overview" | "files" | "peers" | "settings"
  >("overview");

  const [aiResult, setAIResult] = useState<any>(null);
  const [incomingOffer, setIncomingOffer] =
    useState<TransferOffer | null>(null);

  const [resultVersion, setResultVersion] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    //@ts-ignore
    window.p2p.onOffer((offer) => {
      setIncomingOffer(offer);
    });
  }, []);

  useEffect(() => {
    //@ts-ignore
    window.settingsAPI.get().then((data: Settings) => {
      setSettings(data);
    });
  }, []);

  const handleAIOutput = (response: any) => {

    if(!response) return;

    const data = response.result ?? response;

    setAIResult(data);
    setResultVersion(v => v + 1);
    if (data) {
      setCurrentView("files");
    }
  };

  const showTerminal = settings?.ui?.showTerminal ?? false;

  return (
    <div className="h-screen w-screen flex bg-zinc-950 text-gray-200 overflow-hidden">
      <Sidebar setCurrentView={setCurrentView} />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {currentView === "files" ? (
            <FilesScreen key={resultVersion} aiResult={aiResult} />
          ) : (
            <MainContent currentView={currentView} />
          )}
        </div>

        {showTerminal && (
          <div className="w-70 border-l border-zinc-800 flex flex-col">
            <TerminalLogger />
          </div>
        )}
      </div>

      <FloatingTextBar onAICommand={handleAIOutput} />

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