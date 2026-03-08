import { useEffect, useState } from "react";

type Settings = {
  scan: {
    roots: string[];
    exclude: string[];
  };
  ui?: {
    showTerminal?: boolean;
  };
  device?: {
    name?: string;
  };
};

function generateName(): string {
  const techAdjectives = [
    "Quantum","Binary","Neon","Cyber","Silent","Vector",
    "Photon","Nano","Hyper","Digital","Virtual","Secure",
    "Rapid","Dynamic","Parallel"
  ];

  const techNouns = [
    "Node","Kernel","Circuit","Server","Router","Engine",
    "Matrix","Core","System","Cluster","Protocol",
    "Processor","Gateway","Daemon","Terminal"
  ];

  const adj = techAdjectives[Math.floor(Math.random() * techAdjectives.length)];
  const noun = techNouns[Math.floor(Math.random() * techNouns.length)];

  return `${adj}${noun}`;
}

export default function SettingsScreen() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // @ts-ignore
    window.settingsAPI.get().then((data: Settings) => {

      const deviceName =
        !data.device?.name || data.device.name === "My Device"
          ? generateName()
          : data.device.name;

      const normalized: Settings = {
        scan: data.scan ?? { roots: [], exclude: [] },
        ui: {
          showTerminal: data.ui?.showTerminal ?? false,
        },
        device: {
          name: deviceName,
        },
      };

      setSettings(normalized);
    });
  }, []);

  const addFolder = async () => {
    if (!settings) return;

    // @ts-ignore
    const folder = await window.settingsAPI.pickFolder();
    if (!folder || settings.scan.roots.includes(folder)) return;

    setSettings({
      ...settings,
      scan: {
        ...settings.scan,
        roots: [...settings.scan.roots, folder],
      },
    });
  };

  const removeFolder = (folder: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      scan: {
        ...settings.scan,
        roots: settings.scan.roots.filter((f) => f !== folder),
      },
    });
  };

  const handleRescan = async () => {
    if (scanning) return;

    setScanning(true);

    try {
      // @ts-ignore
      await window.rescanAPI.rescan();
    } catch (err) {
      console.error("Rescan failed", err);
    } finally {
      setScanning(false);
    }
  };

  const toggleTerminal = () => {
    if (!settings) return;

    setSettings({
      ...settings,
      ui: {
        showTerminal: !settings.ui?.showTerminal,
      },
    });
  };

  const updateDeviceName = (name: string) => {
    if (!settings) return;

    setSettings({
      ...settings,
      device: {
        name,
      },
    });
  };

  const generateRandomDeviceName = () => {
    if (!settings) return;

    setSettings({
      ...settings,
      device: {
        name: generateName(),
      },
    });
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);

    try {
      // @ts-ignore
      await window.settingsAPI.set(settings);

      // optional reload
      // @ts-ignore
      if (window.settingsAPI.reload) {
        // @ts-ignore
        await window.settingsAPI.reload();
      }
    } catch (err) {
      console.error("Saving settings failed", err);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="h-full w-full p-6 text-gray-200 overflow-y-auto max-w-xl">
      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="space-y-8">

        <div>
          <h2 className="text-lg font-medium mb-3">Device</h2>

          <label className="text-sm text-gray-400 block mb-1">
            Device Name
          </label>

          <div className="flex gap-2">
            <input
              value={settings.device?.name ?? ""}
              onChange={(e) => updateDeviceName(e.target.value)}
              className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm outline-none"
            />

            <button
              onClick={generateRandomDeviceName}
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm"
            >
              Random
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-3">Interface</h2>

          <div className="flex items-center justify-between">
            <span className="text-sm">Show Terminal</span>

            <button
              onClick={toggleTerminal}
              className={`w-12 h-6 rounded-full transition ${
                settings.ui?.showTerminal ? "bg-green-600" : "bg-zinc-700"
              }`}
            >
              <div
                className={`h-6 w-6 bg-white rounded-full transition transform ${
                  settings.ui?.showTerminal ? "translate-x-6" : ""
                }`}
              />
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-medium mb-3">File Indexing</h2>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {settings.scan.roots.length === 0 && (
              <div className="text-sm text-gray-500">
                No folders selected.
              </div>
            )}

            {settings.scan.roots.map((folder) => (
              <div
                key={folder}
                className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded"
              >
                <span className="truncate text-sm">{folder}</span>

                <button
                  onClick={() => removeFolder(folder)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={addFolder}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm"
            >
              + Add Folder
            </button>

            <button
              onClick={handleRescan}
              disabled={scanning}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded text-sm"
            >
              {scanning ? "Re-indexing…" : "Re-scan files"}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-5 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-sm"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

      </div>
    </div>
  );
}