import React from "react";
import { DIMS } from "../utils/scoring";

export default function ProductCard({ product, scores, modeLabel, onLog }) {
  const s = scores || {};
  const terpsCount = product?.terpenes?.length || 0;

  return (
    <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
      <div className="p-4">
        <div className="text-base font-semibold">{product?.name || "Unknown Product"}</div>
        <div className="text-xs text-gray-600 mt-1">
          Form: {product?.form || "—"} • THC: {product?.metrics?.totalTHC ?? "—"}% • Terps: {product?.metrics?.totalTerpenes ?? "—"}% • Terpenes parsed: {terpsCount}
        </div>

        <div className="mt-3 text-xs font-semibold text-gray-700">{modeLabel}</div>

        <div className="mt-2 space-y-2">
          {DIMS.map((dim) => {
            const v = Number(s?.[dim] ?? 0);
            const pct = Math.max(0, Math.min(100, (v / 5) * 100));
            return (
              <div key={dim}>
                <div className="flex justify-between text-xs text-gray-700">
                  <span>{dim}</span>
                  <span className="font-mono">{v.toFixed(1)}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-2 rounded-full bg-gray-700" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky footer button so you ALWAYS see it */}
      <div className="sticky bottom-0 bg-white p-3 border-t border-gray-100 flex justify-end">
        <button
          onClick={onLog}
          className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm"
        >
          Log Session (After Use)
        </button>
      </div>
    </div>
  );
}
