// src/components/ManualInput.jsx
import { useState } from "react";

export default function ManualInput({ onCreateProduct }) {
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [thc, setThc] = useState("");
  const [terpenes, setTerpenes] = useState("");
  const [totalTerpenes, setTotalTerpenes] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    // Parse terpenes from textarea
    const terpeneLines = terpenes.split('\n').filter(line => line.trim());
    const parsedTerpenes = [];

    for (const line of terpeneLines) {
      // Match patterns like "Caryophyllene 2.26%" or "- Linalool 1.12%"
      const match = line.match(/[-•]?\s*([A-Za-z\-\s]+?)\s+([0-9.]+)\s*%?/);
      if (match) {
        parsedTerpenes.push({
          name: match[1].trim(),
          pct: parseFloat(match[2]),
        });
      }
    }

    const product = {
      name: name.trim(),
      form: form.trim(),
      metrics: {
        totalTHC: parseFloat(thc) || 0,
        totalTerpenes: parseFloat(totalTerpenes) || 0,
      },
      terpenes: parsedTerpenes,
      top6: parsedTerpenes.slice(0, 6),
      isManual: true,
    };

    onCreateProduct(product);

    // Reset form
    setName("");
    setForm("");
    setThc("");
    setTerpenes("");
    setTotalTerpenes("");
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">✍️</div>
        <h2 className="text-xl font-bold text-gray-800">Manual Product Entry</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Blue Dream Live Badder 1g"
            className="w-full p-2 border border-gray-300 rounded-lg"
            required
          />
        </div>

        {/* Form */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Form *</label>
          <input
            type="text"
            value={form}
            onChange={(e) => setForm(e.target.value)}
            placeholder="e.g., Live Badder, Flower, Cart"
            className="w-full p-2 border border-gray-300 rounded-lg"
            required
          />
        </div>

        {/* THC and Total Terpenes */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Total THC (%) *</label>
            <input
              type="number"
              step="0.01"
              value={thc}
              onChange={(e) => setThc(e.target.value)}
              placeholder="e.g., 74.8"
              className="w-full p-2 border border-gray-300 rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Total Terpenes (%)</label>
            <input
              type="number"
              step="0.01"
              value={totalTerpenes}
              onChange={(e) => setTotalTerpenes(e.target.value)}
              placeholder="e.g., 5.86"
              className="w-full p-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {/* Terpenes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Terpenes (one per line)
          </label>
          <textarea
            value={terpenes}
            onChange={(e) => setTerpenes(e.target.value)}
            placeholder="Caryophyllene 2.26%
Linalool 1.12%
Limonene 0.775%
Humulene 0.774%"
            className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm"
            rows={6}
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: "TerpName percentage%" (one per line)
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          ➕ Add Product Manually
        </button>
      </form>
    </div>
  );
}
