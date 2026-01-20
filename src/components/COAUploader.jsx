import React, { useMemo, useState } from "react";
import { useMmetStore } from "../store/mmetStore";

export default function COAUploader() {
  const {
    products,
    lastError,
    lastFileName,
    lastFileTextPreview,
    lastTerpeneProbe,
    handleCoaFiles,
    clearProducts,
    applyTerpenePaste,
  } = useMmetStore();

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [terpPaste, setTerpPaste] = useState("");

  const selected = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  async function onFiles(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus("");
    try {
      const res = await handleCoaFiles(files);
      setStatus(`Added ${res.added} product(s). Errors: ${res.errors?.length || 0}`);
      if (!selectedProductId && products?.[0]?.id) setSelectedProductId(products[0].id);
    } catch (err) {
      setStatus(err?.message || String(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  function onClear() {
    clearProducts();
    setSelectedProductId("");
    setStatus("Cleared products.");
  }

  function onApplyTerps() {
    if (!selected) return setStatus("No product selected.");
    const ok = applyTerpenePaste({ productId: selected.id, terpText: terpPaste });
    setStatus(ok ? "Applied terpenes to product." : "Failed to apply terpenes (see error).");
  }

  return (
    <div className="bg-white rounded-2xl shadow p-4 border border-gray-100">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-lg font-semibold">COA Upload</div>
        <button
          onClick={onClear}
          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
        >
          Clear Products
        </button>
      </div>

      <div className="mt-3">
        <input
          type="file"
          accept=".pdf,.txt,.csv,text/plain,application/pdf"
          multiple
          onChange={onFiles}
          disabled={busy}
        />
        <div className="mt-2 text-sm text-gray-700">
          {busy ? "Working..." : status || (lastError ? `Error: ${lastError}` : "")}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="text-sm font-semibold">Select product to update</div>
          <select
            className="mt-2 w-full p-2 rounded-lg border border-gray-300 bg-white"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">(Auto: newest)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.id}
              </option>
            ))}
          </select>

          {selected && (
            <div className="mt-3 text-sm">
              <div className="font-semibold">{selected.name}</div>
              <div className="text-gray-700">
                Form: {selected.form || "—"}{" "}
                | THC: {selected.metrics?.totalTHC ?? "—"}%{" "}
                | Terps: {selected.metrics?.totalTerpenes ?? "—"}%
              </div>
              <div className="mt-1 text-gray-700">
                Terpenes parsed: <span className="font-semibold">{selected.terpenes?.length || 0}</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
          <div className="text-sm font-semibold">Paste terpenes (pipeline test)</div>
          <textarea
            className="mt-2 w-full min-h-[140px] p-2 rounded-lg border border-gray-300 bg-white font-mono text-xs"
            value={terpPaste}
            onChange={(e) => setTerpPaste(e.target.value)}
            placeholder={`beta-Caryophyllene 2.26%\nLinalool 1.12%\nD-Limonene 0.775%\nalpha-Humulene 0.774%`}
          />
          <button
            onClick={onApplyTerps}
            className="mt-2 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm"
          >
            Apply Terpenes to Product
          </button>

          <div className="mt-3 text-xs text-gray-600">
            Expected: terp count becomes &gt; 0 and scores update.
          </div>
        </div>
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-800">
          Extracted PDF Text Debug
        </summary>

        <div className="mt-2 text-xs text-gray-700">
          Last file: <span className="font-mono">{lastFileName || "—"}</span>
        </div>

        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-800">Terpene probe (near “TERPEN” if found)</div>
          <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 p-2 rounded max-h-56 overflow-auto whitespace-pre-wrap">
{lastTerpeneProbe || "No 'TERPEN' substring found in extracted text preview."}
          </pre>
        </div>

        <div className="mt-3">
          <div className="text-xs font-semibold text-gray-800">First 4000 chars of extracted text</div>
          <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 p-2 rounded max-h-56 overflow-auto whitespace-pre-wrap">
{lastFileTextPreview || "No preview captured yet. Upload a PDF again."}
          </pre>
        </div>
      </details>
    </div>
  );
}
