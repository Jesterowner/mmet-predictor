import React, { useMemo, useState } from "react";
import COAUploader from "./components/COAUploader";
import ProductCard from "./components/ProductCard";
import SessionModal from "./components/SessionModal";
import { useMmetStore } from "./store/mmetStore";
import { calculateBaselineScores, calculatePersonalizedScores, DIMS } from "./utils/scoring";

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { products, sessionLog, addSessionEntry, exportProfileJson, importProfileJson } = useMmetStore();

  const [mode, setMode] = useState("baseline"); // baseline | personalized
  const [logOpen, setLogOpen] = useState(false);
  const [activeProductId, setActiveProductId] = useState(null);

  const scoresById = useMemo(() => {
    const out = {};
    for (const p of products) {
      const baseline = calculateBaselineScores(p);
      out[p.id] = mode === "personalized"
        ? calculatePersonalizedScores(baseline, sessionLog, p.id)
        : baseline;
    }
    return out;
  }, [products, sessionLog, mode]);

  const activeProduct = useMemo(() => {
    if (!activeProductId) return products[0] || null;
    return products.find((p) => p.id === activeProductId) || products[0] || null;
  }, [products, activeProductId]);

  function openLog(productId) {
    setActiveProductId(productId);
    setLogOpen(true);
  }

  function saveLog(vals, notes) {
    if (!activeProduct) return;
    addSessionEntry({ productId: activeProduct.id, actuals: vals, notes });
    setLogOpen(false);
  }

  async function onImportFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    importProfileJson(txt);
    e.target.value = "";
  }

  const modeLabel = mode === "personalized"
    ? "Personalized (baseline adjusted by your history)"
    : "Baseline (from COA terpenes)";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-2xl font-bold">MMET</div>
            <div className="text-sm text-gray-600">COA → baseline • After-use ratings → personalized calibration • Export/import profile</div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl overflow-hidden border border-gray-200 bg-white">
              <button
                onClick={() => setMode("baseline")}
                className={`px-3 py-2 text-sm ${mode === "baseline" ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}
              >
                Baseline
              </button>
              <button
                onClick={() => setMode("personalized")}
                className={`px-3 py-2 text-sm ${mode === "personalized" ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}
              >
                Personalized
              </button>
            </div>

            <button
              onClick={() => downloadText(`mmet-profile-${new Date().toISOString().slice(0,10)}.json`, exportProfileJson())}
              className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-sm"
            >
              Export Profile (JSON)
            </button>

            <label className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-100 text-sm cursor-pointer">
              Import Profile
              <input type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
            </label>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <COAUploader />

            <div className="mt-4 bg-white rounded-2xl shadow p-4 border border-gray-100">
              <div className="text-sm font-semibold">Session History</div>
              <div className="mt-1 text-xs text-gray-600">
                Sessions logged: <span className="font-semibold">{sessionLog.length}</span>
              </div>

              <div className="mt-3 max-h-64 overflow-auto space-y-2">
                {sessionLog.slice(0, 12).map((s) => (
                  <div key={s.id} className="p-2 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="text-xs font-semibold">
                      {new Date(s.at).toLocaleString()}
                    </div>
                    <div className="text-[11px] text-gray-700">
                      Product: {products.find(p => p.id === s.productId)?.name || s.productId}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-700 grid grid-cols-2 gap-x-2">
                      {DIMS.map((d) => (
                        <div key={d} className="flex justify-between">
                          <span>{d}</span>
                          <span className="font-mono">{Number(s.actuals?.[d] ?? 0).toFixed(1)}</span>
                        </div>
                      ))}
                    </div>
                    {s.notes ? <div className="mt-1 text-[11px] text-gray-600">{s.notes}</div> : null}
                  </div>
                ))}
                {sessionLog.length === 0 && (
                  <div className="text-xs text-gray-600">No sessions yet. Use “Log Session (After Use)” on a product.</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="text-sm font-semibold text-gray-700 mb-2">{modeLabel}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  scores={scoresById[p.id]}
                  modeLabel={modeLabel}
                  onLog={() => openLog(p.id)}
                />
              ))}
              {products.length === 0 && (
                <div className="bg-white rounded-2xl shadow p-6 border border-gray-100 text-gray-700">
                  Upload a COA PDF to create your first product.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SessionModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onSave={saveLog}
        productName={activeProduct?.name}
      />
    </div>
  );
}
