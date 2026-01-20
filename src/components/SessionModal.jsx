import React, { useMemo, useState } from "react";
import { DIMS } from "../utils/scoring";

export default function SessionModal({ open, onClose, onSave, productName }) {
  const initial = useMemo(() => Object.fromEntries(DIMS.map((d) => [d, 0])), []);
  const [vals, setVals] = useState(initial);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const setDim = (dim, v) => {
    setVals((s) => ({ ...s, [dim]: Number(v) }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Log Session (After Use)</div>
            <div className="text-xs text-gray-600">{productName || "Selected product"}</div>
          </div>
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm">
            Close
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DIMS.map((dim) => (
              <div key={dim} className="p-3 rounded-xl border border-gray-200">
                <div className="flex justify-between text-sm font-semibold">
                  <span>{dim}</span>
                  <span className="font-mono">{Number(vals[dim] || 0).toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={vals[dim]}
                  onChange={(e) => setDim(dim, e.target.value)}
                  className="w-full mt-2"
                />
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="text-sm font-semibold">Notes</div>
            <textarea
              className="mt-2 w-full min-h-[90px] p-2 rounded-lg border border-gray-300 bg-white text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any context: dose, time, mood, food, etc."
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={() => { setVals(initial); setNotes(""); }}
            className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm"
          >
            Reset
          </button>
          <button
            onClick={() => onSave(vals, notes)}
            className="px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm"
          >
            Save Session
          </button>
        </div>
      </div>
    </div>
  );
}
