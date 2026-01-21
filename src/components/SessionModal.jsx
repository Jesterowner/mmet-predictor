import React, { useState } from "react";
import { DIMS } from "../utils/scoring";

const DIM_LABELS = {
  pain: "Pain Relief",
  head: "Head Effect", 
  couch: "Couch Lock",
  clarity: "Clarity",
  duration: "Duration",
  functionality: "Functionality",
  anxiety: "Anxiety Risk",
};

export default function SessionModal({ product, onClose, onSave }) {
  const [ratings, setRatings] = useState(
    Object.fromEntries(DIMS.map((d) => [d, 0]))
  );
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    onSave({
      productId: product.id,
      actuals: ratings,
      notes: notes.trim(),
    });
    setRatings(Object.fromEntries(DIMS.map((d) => [d, 0])));
    setNotes("");
  };

  const setRating = (dim, value) => {
    setRatings((prev) => ({ ...prev, [dim]: Number(value) }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6">
          <h2 className="text-2xl font-bold mb-2">Log Session (After Use)</h2>
          <p className="text-sm text-green-100">{product.name}</p>
          <p className="text-xs text-green-200 mt-1">
            {product.form} • THC: {product.metrics?.totalTHC?.toFixed(1)}%
          </p>
        </div>

        {/* Ratings Grid */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIMS.map((dim) => (
              <div key={dim} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    {DIM_LABELS[dim]}
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {ratings[dim].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.5"
                  value={ratings[dim]}
                  onChange={(e) => setRating(dim, e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span>
                  <span>5</span>
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="mt-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dose, time of day, mood, food intake, setting, etc."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            💾 Save Session
          </button>
        </div>
      </div>
    </div>
  );
}
