import React, { useMemo, useState } from "react";
import { BUILD_INFO } from "./utils/buildInfo";
import COAUploader from "./components/COAUploader";
import ProductCard from "./components/ProductCard";
import SessionModal from "./components/SessionModal";
import Blender from "./components/Blender";
import ManualInput from "./components/ManualInput";
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

// Color-coded dimension labels
const DIM_CONFIG = {
  pain: { label: "Pain Relief", color: "bg-red-500", textColor: "text-red-600", barColor: "bg-red-500", lightBg: "bg-red-100" },
  head: { label: "Head Effect", color: "bg-purple-500", textColor: "text-purple-600", barColor: "bg-purple-500", lightBg: "bg-purple-100" },
  couch: { label: "Couch Lock", color: "bg-orange-500", textColor: "text-orange-600", barColor: "bg-orange-500", lightBg: "bg-orange-100" },
  clarity: { label: "Clarity", color: "bg-blue-500", textColor: "text-blue-600", barColor: "bg-blue-500", lightBg: "bg-blue-100" },
  duration: { label: "Duration", color: "bg-green-500", textColor: "text-green-600", barColor: "bg-green-500", lightBg: "bg-green-100" },
  functionality: { label: "Functionality", color: "bg-teal-500", textColor: "text-teal-600", barColor: "bg-teal-500", lightBg: "bg-teal-100" },
  anxiety: { label: "Anxiety Risk", color: "bg-yellow-500", textColor: "text-yellow-600", barColor: "bg-yellow-500", lightBg: "bg-yellow-100" },
};

export default function App() {
  const { products, sessionLog, addSessionEntry, addProduct, removeProduct, exportProfileJson, importProfileJson } = useMmetStore();

  const [mode, setMode] = useState("baseline");
  const [sortBy, setSortBy] = useState(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [activeProductId, setActiveProductId] = useState(null);

  const scoresById = useMemo(() => {
    const out = {};
    for (const p of products) {
      if (p.customScores) {
        out[p.id] = p.customScores;
      } else {
        const baseline = calculateBaselineScores(p);
        out[p.id] = mode === "personalized" 
          ? calculatePersonalizedScores(baseline, sessionLog, p.id, products)
          : baseline;
      }
    }
    return out;
  }, [products, sessionLog, mode]);

  const sortedProducts = useMemo(() => {
    if (!sortBy) return products;
    
    return [...products].sort((a, b) => {
      const scoreA = scoresById[a.id]?.[sortBy] || 0;
      const scoreB = scoresById[b.id]?.[sortBy] || 0;
      return scoreB - scoreA;
    });
  }, [products, scoresById, sortBy]);

  const handleExport = () => {
    const json = exportProfileJson();
    const filename = `mmet-profile-${new Date().toISOString().split("T")[0]}.json`;
    downloadText(filename, json);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        importProfileJson(evt.target?.result);
        alert("Profile imported successfully!");
      } catch (err) {
        alert("Failed to import profile: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCreateManualProduct = (product) => {
    addProduct(product);
    alert("✓ Product added successfully!");
  };

  const handleCreateBlend = (blend) => {
    addProduct(blend);
    alert("✓ Blend saved to products!");
    setActiveTab("upload");
  };

  const handleRemoveProduct = (productId) => {
    removeProduct(productId);
  };

  const handleLogSession = (productId) => {
    setActiveProductId(productId);
  };

  const handleSaveSession = (data) => {
    addSessionEntry(data);
    setActiveProductId(null);
  };

  const activeProduct = activeProductId ? products.find(p => p.id === activeProductId) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {/* Medical Cross + Leaf Logo */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-16 bg-white rounded-md opacity-90"></div>
                <div className="absolute w-16 h-8 bg-white rounded-md opacity-90"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-4xl">
                🌿
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">MMET Predictor</h1>
              <p className="text-green-100 text-sm">COA → baseline • After-use ratings → personalized calibration • Export/import profile</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Mode Toggle + Export/Import */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode("baseline")}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  mode === "baseline"
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Baseline
              </button>
              <button
                onClick={() => setMode("personalized")}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  mode === "personalized"
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Personalized {sessionLog.length > 0 && `(${sessionLog.length})`}
              </button>
            </div>

            <div className="flex-1" />

            <button
              onClick={handleExport}
              disabled={products.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors"
            >
              📥 Export Profile
            </button>
            
            <label className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold cursor-pointer transition-colors">
              📤 Import Profile
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Sorting Pills - COLOR CODED */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-700">🔀 Sort by:</span>
            <button
              onClick={() => setSortBy(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                sortBy === null
                  ? "bg-gray-700 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Newest First
            </button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {DIMS.map((dim) => {
              const config = DIM_CONFIG[dim];
              return (
                <button
                  key={dim}
                  onClick={() => setSortBy(dim)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    sortBy === dim
                      ? `${config.color} text-white shadow-md`
                      : `${config.lightBg} ${config.textColor} hover:${config.color} hover:text-white`
                  }`}
                >
                  {config.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("upload")}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "upload"
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              📤 Upload COA
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "manual"
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ✍️ Manual Entry
            </button>
            <button
              onClick={() => setActiveTab("blend")}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === "blend"
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              🌪️ Blend Products
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mb-8">
          {activeTab === "upload" && <COAUploader />}
          {activeTab === "manual" && <ManualInput onCreateProduct={handleCreateManualProduct} />}
          {activeTab === "blend" && <Blender products={products} onCreateBlend={handleCreateBlend} />}
        </div>

        {/* Products Grid */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Products ({products.length})
            {sortBy && <span className="text-lg font-normal text-gray-600 ml-2">- Sorted by {DIM_CONFIG[sortBy].label}</span>}
          </h2>
          
          {sortedProducts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="text-6xl mb-4">🍃</div>
              <p className="text-gray-600">No products yet. Upload a COA, enter manually, or create a blend!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  scores={scoresById[p.id]}
                  dimConfig={DIM_CONFIG}
                  modeLabel={mode === "baseline" ? "Baseline (from COA terpenes)" : "Personalized (baseline adjusted by your history)"}
                  onLog={() => handleLogSession(p.id)}
                  onRemove={handleRemoveProduct}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session Modal */}
      {activeProduct && (
        <SessionModal
          product={activeProduct}
          onClose={() => setActiveProductId(null)}
          onSave={handleSaveSession}
        />
      )}

      <div className="mt-6 text-xs opacity-60">
        Build: {BUILD_INFO.mode} • {BUILD_INFO.commit}
      </div>
    </div>
  );
}
