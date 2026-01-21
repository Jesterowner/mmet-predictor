// src/components/COAUploader.jsx - Clean version without legacy sections
import { useRef, useState } from "react";
import { useMmetStore } from "../store/mmetStore";

export default function COAUploader() {
  const { handleCoaFiles } = useMmetStore();
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    setStatus({ type: "loading", message: "Processing files..." });

    const result = await handleCoaFiles(files);

    if (result.errors && result.errors.length > 0) {
      setStatus({
        type: "error",
        message: `Added ${result.added} product(s). Errors: ${result.errors.length}`,
        details: result.errors,
      });
    } else if (result.added > 0) {
      setStatus({
        type: "success",
        message: `✓ Successfully added ${result.added} product(s)`,
      });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({
        type: "error",
        message: "No products could be parsed from the files",
      });
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer?.files;
    if (files) handleFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleFileInput = (e) => {
    const files = e.target?.files;
    if (files) handleFiles(files);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">📤</div>
        <h2 className="text-xl font-bold text-gray-800">Upload COA</h2>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? "border-green-500 bg-green-50"
            : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
        }`}
      >
        <div className="text-5xl mb-3">📄</div>
        <p className="text-lg font-semibold text-gray-700 mb-1">
          Drop PDF/TXT files here or click to browse
        </p>
        <p className="text-sm text-gray-500">
          Supports single or batch upload (.pdf, .txt, .csv, .md)
        </p>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.csv,.md"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Status Messages */}
      {status && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            status.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : status.type === "error"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-blue-50 border border-blue-200 text-blue-800"
          }`}
        >
          <p className="font-semibold">{status.message}</p>
          {status.details && status.details.length > 0 && (
            <div className="mt-2 text-sm space-y-1">
              {status.details.map((err, i) => (
                <div key={i}>
                  • {err.file}: {err.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>• Upload dispensary COA files (PDF or text format)</p>
        <p>• Multiple files will be processed automatically</p>
        <p>• Each COA will create a new product with baseline predictions</p>
      </div>
    </div>
  );
}
