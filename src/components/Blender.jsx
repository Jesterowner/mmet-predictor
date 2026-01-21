// src/components/Blender.jsx
import { useState, useMemo } from "react";
import { calculateBaselineScores, DIMS } from "../utils/scoring";

const RATIOS = [
  { label: "50/50", ratioA: 0.5, ratioB: 0.5 },
  { label: "70/30", ratioA: 0.7, ratioB: 0.3 },
  { label: "30/70", ratioA: 0.3, ratioB: 0.7 },
];

export default function Blender({ products, onCreateBlend }) {
  const [productA, setProductA] = useState("");
  const [productB, setProductB] = useState("");
  const [ratio, setRatio] = useState(RATIOS[0]);

  const blendedScores = useMemo(() => {
    if (!productA || !productB) return null;

    const pA = products.find(p => p.id === productA);
    const pB = products.find(p => p.id === productB);
    if (!pA || !pB) return null;

    const scoresA = calculateBaselineScores(pA);
    const scoresB = calculateBaselineScores(pB);

    const blended = {};
    for (const dim of DIMS) {
      blended[dim] = (scoresA[dim] * ratio.ratioA) + (scoresB[dim] * ratio.ratioB);
      blended[dim] = Math.round(blended[dim] * 2) / 2; // Round to 0.5
    }

    return { blended, productA: pA, productB: pB };
  }, [productA, productB, ratio, products]);

  const handleSaveBlend = () => {
    if (!blendedScores) return;

    const blend = {
      name: `${blendedScores.productA.name} + ${blendedScores.productB.name} (${ratio.label})`,
      form: "Blend",
      isBlend: true,
      blendDetails: {
        productA: blendedScores.productA.id,
        productB: blendedScores.productB.id,
        ratio: ratio.label,
      },
      metrics: {
        totalTHC: (blendedScores.productA.metrics.totalTHC * ratio.ratioA) + 
                  (blendedScores.productB.metrics.totalTHC * ratio.ratioB),
        totalTerpenes: (blendedScores.productA.metrics.totalTerpenes * ratio.ratioA) + 
                       (blendedScores.productB.metrics.totalTerpenes * ratio.ratioB),
      },
      top6: [], // Blend doesn't have individual terpenes tracked
      customScores: blendedScores.blended, // Store the blended scores
    };

    onCreateBlend(blend);
    setProductA("");
    setProductB("");
  };

  if (products.length < 2) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <div className="text-4xl mb-2">🌪️</div>
        <p className="text-amber-800 font-medium">Need at least 2 products to blend</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">🌪️</div>
        <h2 className="text-xl font-bold text-gray-800">Blend Products</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Product A */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Product A</label>
          <select
            value={productA}
            onChange={(e) => setProductA(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select product...</option>
            {products.filter(p => !p.isBlend).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Product B */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Product B</label>
          <select
            value={productB}
            onChange={(e) => setProductB(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg"
          >
            <option value="">Select product...</option>
            {products.filter(p => !p.isBlend && p.id !== productA).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Ratio Selector */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Mix Ratio</label>
        <div className="flex gap-2">
          {RATIOS.map((r) => (
            <button
              key={r.label}
              onClick={() => setRatio(r)}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                ratio.label === r.label
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Blended Preview */}
      {blendedScores && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-green-900 mb-3">Blended Effect Prediction</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {DIMS.map((dim) => (
              <div key={dim} className="text-center">
                <div className="text-gray-600 capitalize">{dim}</div>
                <div className="text-2xl font-bold text-green-700">{blendedScores.blended[dim].toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSaveBlend}
        disabled={!blendedScores}
        className={`w-full py-3 rounded-lg font-semibold transition-all ${
          blendedScores
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
        💾 Save Blend to Products
      </button>
    </div>
  );
}
