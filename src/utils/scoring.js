// src/utils/scoring.js
// Baseline scoring from terpene profile + personalized adjustments from session history.
// Dimensions match the "after use" rating system:
export const DIMS = ["Pain", "Head", "Couch", "Clarity", "Duration", "Function", "Anxiety"];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Weight map (tweak later). Values ~0–2.
// These are *not* medical claims—just heuristic scoring knobs.
const W = {
  "caryophyllene": { Pain: 2.0, Anxiety: 0.6, Couch: 0.3 },
  "humulene":      { Pain: 1.2, Head: 0.2, Duration: 0.3 },
  "myrcene":       { Couch: 1.8, Duration: 0.8, Head: 0.4 },
  "linalool":      { Anxiety: 1.8, Couch: 0.8, Duration: 0.4 },
  "limonene":      { Clarity: 1.6, Head: 1.0, Function: 0.6 },
  "pinene":        { Clarity: 1.5, Function: 1.2, Anxiety: -0.2 },
  "terpineol":     { Couch: 1.0, Anxiety: 0.6, Duration: 0.4 },
  "bisabolol":     { Pain: 0.9, Anxiety: 0.6, Duration: 0.2 },
  "ocimene":       { Head: 1.0, Clarity: 0.6, Function: 0.4 },
  "fenchyl alcohol": { Clarity: 0.4, Function: 0.4, Head: 0.2 },
};

// A little extra lift so baselines don't look like tiny decimals
const BASE_MULTIPLIER = 3.5; // raise/lower later after you see results

function keyFor(name) {
  const s = String(name || "").toLowerCase().trim();
  if (!s) return "";
  if (s.includes("caryophyllene")) return "caryophyllene";
  if (s.includes("humulene")) return "humulene";
  if (s.includes("myrcene")) return "myrcene";
  if (s.includes("linalool")) return "linalool";
  if (s.includes("limonene")) return "limonene";
  if (s.includes("bisabolol")) return "bisabolol";
  if (s.includes("ocimene")) return "ocimene";
  if (s.includes("terpineol")) return "terpineol";
  if (s.includes("pinene")) return "pinene";
  if (s.includes("fenchyl")) return "fenchyl alcohol";
  return s; // fallback
}

export function calculateBaselineScores(product) {
  const out = Object.fromEntries(DIMS.map((d) => [d, 0]));
  const terps = Array.isArray(product?.terpenes) ? product.terpenes : [];
  if (!terps.length) return out;

  const total = Number(product?.metrics?.totalTerpenes) || terps.reduce((a, t) => a + (Number(t.pct) || 0), 0) || 0.0001;

  // Weighted contribution by terpene pct
  for (const t of terps) {
    const pct = Number(t.pct) || 0;
    if (pct <= 0) continue;
    const k = keyFor(t.name);
    const ww = W[k];
    if (!ww) continue;

    for (const dim of DIMS) {
      const w = Number(ww[dim] || 0);
      if (!w) continue;
      out[dim] += pct * w;
    }
  }

  // Normalize by total terps and scale to 0..5
  for (const dim of DIMS) {
    const normalized = (out[dim] / total) * BASE_MULTIPLIER;
    out[dim] = clamp(Number(normalized.toFixed(1)), 0, 5);
  }

  return out;
}

// Personalized = baseline nudged toward your logged actuals for that product
export function calculatePersonalizedScores(baselineScores, sessionLog, productId) {
  const base = baselineScores || Object.fromEntries(DIMS.map((d) => [d, 0]));
  const logs = Array.isArray(sessionLog) ? sessionLog : [];
  const relevant = logs.filter((s) => s?.productId === productId);

  if (!relevant.length) return base;

  // Average actuals per dimension
  const sums = Object.fromEntries(DIMS.map((d) => [d, 0]));
  const counts = Object.fromEntries(DIMS.map((d) => [d, 0]));

  for (const s of relevant) {
    const a = s?.actuals || {};
    for (const dim of DIMS) {
      const v = Number(a[dim]);
      if (Number.isFinite(v)) {
        sums[dim] += v;
        counts[dim] += 1;
      }
    }
  }

  const alpha = 0.6; // how strongly history adjusts baseline
  const out = {};
  for (const dim of DIMS) {
    const avg = counts[dim] ? (sums[dim] / counts[dim]) : null;
    const b = Number(base[dim] || 0);
    if (avg == null) out[dim] = b;
    else out[dim] = clamp(Number((b + alpha * (avg - b)).toFixed(1)), 0, 5);
  }
  return out;
}

// Utility: sort products by a chosen dimension
export function sortProductsByScore(products, scoresById, dim = "Pain") {
  const arr = Array.isArray(products) ? [...products] : [];
  return arr.sort((a, b) => {
    const sa = Number(scoresById?.[a.id]?.[dim] ?? 0);
    const sb = Number(scoresById?.[b.id]?.[dim] ?? 0);
    return sb - sa;
  });
}
