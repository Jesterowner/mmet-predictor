import React, { useEffect, useState } from "react";
import { DIMS } from "../utils/scoring";

// Default color config if not provided
const DEFAULT_DIM_CONFIG = {
  pain: { label: "Pain Relief", color: "bg-red-500", hoverColor: "hover:bg-red-600", textColor: "text-red-500", barColor: "bg-red-500" },
  head: { label: "Head Effect", color: "bg-purple-500", hoverColor: "hover:bg-purple-600", textColor: "text-purple-500", barColor: "bg-purple-500" },
  couch: { label: "Couch Lock", color: "bg-orange-500", hoverColor: "hover:bg-orange-600", textColor: "text-orange-500", barColor: "bg-orange-500" },
  clarity: { label: "Clarity", color: "bg-blue-500", hoverColor: "hover:bg-blue-600", textColor: "text-blue-500", barColor: "bg-blue-500" },
  duration: { label: "Duration", color: "bg-green-500", hoverColor: "hover:bg-green-600", textColor: "text-green-500", barColor: "bg-green-500" },
  functionality: { label: "Functionality", color: "bg-teal-500", hoverColor: "hover:bg-teal-600", textColor: "text-teal-500", barColor: "bg-teal-500" },
  anxiety: { label: "Anxiety Risk", color: "bg-yellow-500", hoverColor: "hover:bg-yellow-600", textColor: "text-yellow-500", barColor: "bg-yellow-500" },
};

export default function ProductCard({
  product,
  scores,
  dimConfig,
  modeLabel,
  onLog,
  onRemove,
  onRename, // ✅ NEW
}) {
  const s = scores || {};
  const terpsCount = product?.terpenes?.length || 0;
  const config = dimConfig || DEFAULT_DIM_CONFIG;

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(product?.name || "");

  useEffect(() => {
    setNameDraft(product?.name || "");
  }, [product?.name]);

  const handleRemove = () => {
    if (window.confirm(`Remove "${product?.name}"?`)) {
      onRemove(product.id);
    }
  };

  const commitRename = () => {
    const next = String(nameDraft || "").trim();
    if (!next) return alert("Name cannot be blank.");
    if (typeof onRename === "function") onRename(product.id, next);
    setIsEditingName(false);
  };

  const cancelRename = () => {
    setNameDraft(product?.name || "");
    setIsEditingName(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden border border-gray-100">
      <div className="p-5">
        {/* Product Name + Actions */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {!isEditingName ? (
              <div className="flex items-start gap-2">
                <h3 className="text-lg font-bold text-gray-900 break-words">
                  {product?.name || "Unknown Product"}
                </h3>

                <button
                  onClick={() => setIsEditingName(true)}
                  className="mt-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-700 transition-colors"
                  title="Rename product"
                >
                  ✏️
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  placeholder="Enter product name…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={commitRename}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelRename}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold"
                  >
                    Cancel
                  </button>
                </div>
                <div className="text-xs text-gray-500">Tip: Enter = Save • Esc = Cancel</div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-2 text-xs">
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                {product?.form || "—"}
              </span>
              {product?.isBlend && (
                <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-medium">
                  🌪️ Blend
                </span>
              )}
              {product?.isManual && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                  ✍️ Manual
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleRemove}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Remove product"
          >
            🗑️
          </button>
        </div>

        {/* COA Info */}
        <div className="text-xs text-gray-600 mb-4 space-y-1">
          <div>
            THC:{" "}
            <span className="font-semibold">
              {product?.metrics?.totalTHC?.toFixed(1) || "—"}%
            </span>
          </div>
          <div>
            Terpenes:{" "}
            <span className="font-semibold">
              {product?.metrics?.totalTerpenes?.toFixed(2) || "—"}%
            </span>
          </div>
          <div>
            Terpenes parsed: <span className="font-semibold">{terpsCount}</span>
          </div>
        </div>

        {/* Mode Label */}
        <div className="text-xs font-semibold text-gray-500 mb-3">{modeLabel}</div>

        {/* Effect Bars */}
        <div className="space-y-2.5">
          {DIMS.map((dim) => {
            const v = Number(s?.[dim] ?? 0);
            const pct = Math.max(0, Math.min(100, (v / 5) * 100));
            const dc = config[dim];

            return (
              <div key={dim}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-medium ${dc.textColor}`}>{dc.label}</span>
                  <span className="font-mono font-semibold text-gray-700">{v.toFixed(1)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full ${dc.barColor} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Log Button */}
        <button
          onClick={onLog}
          className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg"
        >
          📝 Log Session (After Use)
        </button>
      </div>
    </div>
  );
}
