import { useState, useEffect } from "react";
import { File, FileText, Folder } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  file_type: "image" | "pdf" | "doc" | "excel" | "folder" | "other";
  path: string;
  src?: string;
  size?: string;
  date?: string;
}

interface AIResult {
  kind: "files" | "aggregate" | "conversation";
  items?: any[];
  message?: string;
}

export default function FilesScreen({
  aiResult,
}: {
  aiResult: AIResult | null;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [message, setMessage] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [visible, setVisible] = useState(false);

  // Safe Typewriter Animation
  useEffect(() => {
    if (!message) {
      setTypedMessage("");
      return;
    }

    let index = 0;
    setTypedMessage("");
    setVisible(false);

    const interval = setInterval(() => {
      index++;
      setTypedMessage(message.slice(0, index));
      if (index >= message.length) {
        clearInterval(interval);
      }
    }, 18);

    setTimeout(() => setVisible(true), 50);

    return () => clearInterval(interval);
  }, [message]);

  const getFileIcon = (fileType: FileItem["file_type"]) => {
    if (fileType === "folder")
      return <Folder className="text-yellow-400" size={36} />;
    if (fileType === "pdf")
      return <File className="text-red-500" size={36} />;
    if (fileType === "excel")
      return <File className="text-green-500" size={36} />;
    if (fileType === "doc")
      return <File className="text-blue-500" size={36} />;
    return <FileText size={36} />;
  };

  const mapAIItemToFileItem = (item: any): FileItem => ({
    id: item.id,
    name: item.name,
    type: item.type,
    file_type: item.file_type,
    path: item.path,
    size: item.size
      ? `${(item.size / 1024 / 1024).toFixed(2)} MB`
      : undefined,
    date: item.modified_at,
    src:
      item.file_type === "image"
        ? // @ts-ignore
          window.fsAPI.toFileURL(item.path)
        : undefined,
  });

  useEffect(() => {
    if (!aiResult) return;

    setMessage(aiResult.message ?? "");

    if (aiResult.kind === "files" && Array.isArray(aiResult.items)) {
      setFiles(aiResult.items.map(mapAIItemToFileItem));
    } else {
      setFiles([]);
    }
  }, [aiResult]);

  const isEmpty = files.length === 0;

  return (
    <div
      className={`h-full w-full bg-zinc-950 text-gray-200 p-6 font-sans ${
        isEmpty
          ? "flex flex-col items-center justify-center"
          : "overflow-y-auto custom-scroll"
      }`}
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* AI Message */}
      <div
        className={`text-gray-200 text-lg font-medium mb-6 transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        } ${isEmpty ? "text-center" : ""}`}
      >
        {typedMessage || "Ask the AI to find files"}
        <span className="typing-cursor">|</span>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="text-gray-500 text-center animate-fadeIn">
          No files to display
        </div>
      )}

      {/* Files Grid */}
      {!isEmpty && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {files.map((file, idx) => (
            <div
              key={file.id}
              className="flex flex-col items-center p-2 rounded-lg cursor-pointer
                         hover:bg-zinc-800 transition opacity-0 scale-90 animate-appear"
              style={{
                animationDelay: `${idx * 80}ms`,
                animationFillMode: "forwards",
              }}
            >
              {file.file_type === "image" && file.src ? (
                <img
                  src={file.src}
                  alt={file.name}
                  className="w-full h-40 object-cover rounded"
                />
              ) : (
                <div className="w-full h-40 flex items-center justify-center bg-zinc-700 rounded">
                  {getFileIcon(file.file_type)}
                </div>
              )}

              <div className="text-sm text-center truncate w-full mt-1">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>
        {`
          @keyframes appear {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
          }
          .animate-appear { animation: appear 260ms forwards; }

          .typing-cursor {
            animation: blink 1s infinite;
            margin-left: 2px;
          }

          @keyframes blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0; }
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn { animation: fadeIn 400ms ease-out; }

          .custom-scroll::-webkit-scrollbar { width: 10px; }
          .custom-scroll::-webkit-scrollbar-track { background: #1f1f1f; }
          .custom-scroll::-webkit-scrollbar-thumb {
            background: #4b5563;
            border-radius: 6px;
          }
        `}
      </style>
    </div>
  );
}