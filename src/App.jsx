// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMmetStore } from "./store/mmetStore";
import {
  getTop6Terpenes,
  terpBandFromPct,
  BAND_WEIGHTS,
} from "./utils/terpenes";

/**
 * MMET Predictor v2 – App.jsx
 *
 * Requirements met:
 * - Uses Zustand store for products + parsing actions
 * - Keeps local UI state: sortBy, showManualEntry, pasteText, dragActive
 * - calculateMMET uses TOP 6 (getTop6Terpenes) + band classification for all 6
 * - Uses effect vectors for specified terps
 * - UI polish:
 *   * Button text: "Parse COA(s) & Score"
 *   * Add "Clear All Products"
 *   * Auto-scroll to results after parsing/upload
 *   * Display "Total Terpenes: X.XX% (COA)" from metrics.totalTerpenes
 *   * Display "Top 6 Used:" with 6 terps
 */

// ----------------------
// Effect vectors (replace numeric values if you already have canonical ones)
// ----------------------
const TERPENE_EFFECT_VECTORS = {
  myrcene: { relax: 1.0, sleep: 0.8, pain: 0.4, energy: -0.4, focus: -0.1, mood: 0.1, anxiety: 0.2 },
  caryophyllene: { relax: 0.6, pain: 0.8, anxiety: 0.4, focus: 0.2, mood: 0.2, energy: -0.1, sleep: 0.2 },
  limonene: { mood: 0.9, energy: 0.7, focus: 0.5, relax: -0.2, anxiety: -0.2, sleep: -0.2, pain: 0.0 },
  pinene: { focus: 0.9, energy: 0.4, mood: 0.2, relax: -0.2, sleep: -0.2, anxiety: -0.1, pain: 0.0 },
  linalool: { relax: 0.9, sleep: 0.7, anxiety: 0.7, mood: 0.2, energy: -0.3, focus: -0.2, pain: 0.1 },
  humulene: { focus: 0.4, mood: 0.2, relax: 0.2, energy: 0.0, pain: 0.2, anxiety: 0.1, sleep: 0.1 },
  bisabolol: { relax: 0.5, pain: 0.4, mood: 0.2, focus: 0.0, energy: 0.0, anxiety: 0.2, sleep: 0.2 },
  ocimene: { energy: 0.6, mood: 0.3, focus: 0.2, relax: -0.1, anxiety: -0.1, sleep: -0.1, pain: 0.0 },
  terpinolene: { energy: 0.5, mood: 0.3, relax: 0.2, focus: 0.2, anxiety: 0.0, sleep: 0.0, pain: 0.0 },
};

const SCORE_DIMENSIONS = ["energy", "focus", "mood", "relax", "sleep", "pain", "anxiety"];

function initScore() {
  return Object.fromEntries(SCORE_DIMENSIONS.map((k) => [k, 0]));
}

/**
 * calculateMMET(product)
 * - Uses top 6 normalized terpenes
 * - Applies band classification to all 6
 * - Applies effect vectors for the terp names listed
 *
 * Product expected format:
 * {
 *  id, name, form,
 *  metrics: { totalTHC, totalTerpenes },
 *  terpenes: [{ name:"caryophyllene", pct:2.26 }, ...]
 * }
 */
function calculateMMET(product) {
  const terps = Array.isArray(product?.terpenes) ? product.terpenes : [];

  // ✅ Requirement: use top 6 (not top 3)
  const top6 = getTop6Terpenes(terps);

  const scores = initScore();

  // Apply vectors
  const used = top6.map((t) => {
    const band = terpBandFromPct(t.pct);
    const bandWeight = BAND_WEIGHTS[band] ?? 0;

    const vec = TERPENE_EFFECT_VECTORS[t.name] || {};

    // Weight by band + magnitude (pct). This keeps bigger terps mattering more.
    const magnitude = bandWeight * Number(t.pct);

    for (const dim of SCORE_DIMENSIONS) {
      const v = Number(vec[dim] || 0);
      scores[dim] += v * magnitude;
    }

    return { ...t, band };
  });

  // Normalize to a friendly-ish range for UI
  // (keeps behavior stable and prevents tiny decimals)
  const out = {};
  for (const dim of SCORE_DIMENSIONS) {
    out[dim] = Math.max(0, Math.round(scores[dim] * 10) / 10);
  }

  return { scores: out, topUsed: used };
}

// ---- OPTIONAL sample COAs (safe starter) ----
const SAMPLE_COAS = [
  `HAZE JLS CKE (I) Live Badder 1g
Form: Live Badder
Total THC: 74.8%
THC per unit: 748 mg
Total Cannabinoids: 88.3%
Total Terpenes: 5.86%
Top Terpenes:
- beta-Caryophyllene 2.26%
- Linalool 1.12%
- D-Limonene 0.775%
- alpha-Humulene 0.774%
- Ocimenes 0.268%
- Terpineol 0.212%`,
];

export default function App() {
  // ✅ Local UI-only state
  const [sortBy, setSortBy] = useState("relax");
  const [showManualEntry, setShowManualEntry] = useState(false); // kept for your existing UI expansion
  const [pasteText, setPasteText] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // ✅ Zustand store state/actions
  const products = useMmetStore((s) => s.products);
  const lastError = useMmetStore((s) => s.lastError);

  const parseCoaText = useMmetStore((s) => s.parseCoaText);
  const handleCoaFiles = useMmetStore((s) => s.handleCoaFiles);
  const clearProducts = useMmetStore((s) => s.clearProducts);

  // Auto-scroll to results after parsing/upload
  const resultsRef = useRef(null);
  const prevCountRef = useRef(products.length);

  useEffect(() => {
    if (products.length > prevCountRef.current && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    prevCountRef.current = products.length;
  }, [products.length]);

  const rankKeys = [
    { key: "energy", label: "Energy" },
    { key: "focus", label: "Focus" },
    { key: "mood", label: "Mood" },
    { key: "relax", label: "Relax" },
    { key: "sleep", label: "Sleep" },
    { key: "pain", label: "Pain" },
    { key: "anxiety", label: "Anxiety" },
  ];

  // Compute scores for products based on new format (top 6 + bands)
  const scoredProducts = useMemo(() => {
    return products.map((p) => {
      const r = calculateMMET(p);
      return { ...p, _mmet: r };
    });
  }, [products]);

  // Sort by selected dimension
  const sortedProducts = useMemo(() => {
    const arr = [...scoredProducts];
    arr.sort((a, b) => {
      const av = Number(a?._mmet?.scores?.[sortBy] ?? 0);
      const bv = Number(b?._mmet?.scores?.[sortBy] ?? 0);
      if (bv !== av) return bv - av;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
    return arr;
  }, [scoredProducts, sortBy]);

  const onLoadSampleProducts = () => {
    for (const coa of SAMPLE_COAS) {
      parseCoaText(coa, { sourceFileName: "sample" });
    }
  };

  const onParseCoasAndScore = () => {
    const text = pasteText.trim();
    if (!text) return;

    // Split into blocks if user pastes multiple COAs (triple newline = safer separator)
    const blocks = text.split(/\n\s*\n\s*\n+/g).map((b) => b.trim()).filter(Boolean);

    for (const b of blocks) {
      parseCoaText(b, { sourceFileName: "pasted" });
    }

    setPasteText("");
  };

  const onFileUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    await handleCoaFiles(files);
    e.target.value = "";
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    await handleCoaFiles(files);
  };

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ marginBottom: 8 }}>MMET Predictor v2</h1>

      {lastError ? (
        <div style={{ padding: 10, border: "1px solid #f99", background: "#fff5f5", marginBottom: 12 }}>
          <strong>Error:</strong> {lastError}
        </div>
      ) : null}

      {/* Top controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={onLoadSampleProducts}>Load Sample Products</button>

        {/* ✅ Requirement: Clear button */}
        <button onClick={clearProducts}>Clear All Products</button>

        {/* Upload COAs */}
        <label style={{ display: "inline-block" }}>
          <input
            type="file"
            multiple
            onChange={onFileUpload}
            style={{ display: "none" }}
            accept=".txt,.md,.csv,text/plain,application/pdf"
          />
          <span
            style={{
              display: "inline-block",
              padding: "6px 10px",
              border: "1px solid #ccc",
              borderRadius: 6,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            Upload COA Files
          </span>
        </label>

        {/* Manual entry placeholder toggle (kept for your existing UI paths) */}
        <button onClick={() => setShowManualEntry((v) => !v)}>
          {showManualEntry ? "Hide Manual Entry" : "Show Manual Entry"}
        </button>
      </div>

      {/* Paste + Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragActive ? "#444" : "#bbb"}`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          background: dragActive ? "#fafafa" : "transparent",
        }}
      >
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          Paste COA Text (or drag & drop COA files here)
        </div>

        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste one or multiple COAs here..."
          rows={8}
          style={{ width: "100%", resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          {/* ✅ Requirement: Rename button */}
          <button onClick={onParseCoasAndScore}>Parse COA(s) &amp; Score</button>
        </div>
      </div>

      {/* Rank-by */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Rank by:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {rankKeys.map((rk) => (
            <button
              key={rk.key}
              onClick={() => setSortBy(rk.key)}
              style={{
                border: sortBy === rk.key ? "2px solid #111" : "1px solid #ccc",
                borderRadius: 999,
                padding: "6px 10px",
                background: sortBy === rk.key ? "#f0f0f0" : "white",
              }}
            >
              {rk.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div ref={resultsRef}>
        <h2 style={{ marginTop: 18, marginBottom: 8 }}>Products ({products.length})</h2>

        {sortedProducts.length === 0 ? (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            No products yet. Load samples, paste COA text, or upload COA files.
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12 }}>
          {sortedProducts.map((p) => {
            const totalTerp = p?.metrics?.totalTerpenes;

            const topUsed = p?._mmet?.topUsed || [];
            const scores = p?._mmet?.scores || {};

            return (
              <div key={p.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{p.name}</div>
                <div style={{ opacity: 0.85, marginBottom: 10 }}>
                  {p.form ? `Form: ${p.form}` : "Form: —"}
                </div>

                {/* ✅ Requirement: show COA Total Terpenes */}
                <div style={{ marginBottom: 8 }}>
                  <strong>Total Terpenes:</strong>{" "}
                  {Number.isFinite(Number(totalTerp)) ? `${Number(totalTerp).toFixed(2)}% (COA)` : "—"}
                </div>

                {/* ✅ Requirement: show Top 6 used */}
                <div style={{ marginBottom: 10 }}>
                  <strong>Top 6 Used:</strong>
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {topUsed.length ? (
                      topUsed.map((t) => (
                        <span
                          key={`${p.id}_${t.name}`}
                          style={{
                            border: "1px solid #ccc",
                            borderRadius: 999,
                            padding: "3px 8px",
                            fontSize: 12,
                          }}
                        >
                          {t.name} {Number(t.pct).toFixed(3)}% • {t.band}
                        </span>
                      ))
                    ) : (
                      <span style={{ opacity: 0.8 }}>—</span>
                    )}
                  </div>
                </div>

                {/* Score cards */}
                <div style={{ marginTop: 6 }}>
                  <strong>MMET Score:</strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
                    {rankKeys.map((rk) => (
                      <div key={rk.key} style={{ border: "1px solid #eee", borderRadius: 10, padding: 8 }}>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>{rk.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800 }}>
                          {Number(scores[rk.key] ?? 0).toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer" }}>Show parsed terpenes (normalized)</summary>
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    {(p.terpenes || []).slice(0, 24).map((t) => (
                      <div key={`${p.id}_${t.name}_full`}>
                        {t.name}: {Number(t.pct).toFixed(3)}%
                      </div>
                    ))}
                    {(p.terpenes || []).length > 24 ? <div>…</div> : null}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
