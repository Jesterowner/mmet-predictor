// src/utils/terpenes.js

/**
 * Terpene helpers for MMET Predictor v2
 * - normalizeTerpName(): canonicalizes terp names (Greek letters, alpha/beta, A-/B-, D-)
 * - getTop6Terpenes(): normalizes + merges duplicates + returns top 6 by %
 * - terpBandFromPct(): band classification (none/supporting/dominant/primary)
 */

export const DEFAULT_BAND_THRESHOLDS = {
  // Keep these aligned with your existing band logic if you already have it elsewhere.
  primary: 1.0,
  dominant: 0.5,
  supporting: 0.2,
};

export const BAND_WEIGHTS = {
  none: 0.0,
  supporting: 0.4,
  dominant: 0.7,
  primary: 1.0,
};

/**
 * Normalize terpene names into a single lowercase canonical key.
 *
 * Normalizes:
 * - β-Caryophyllene, beta-Caryophyllene, B-Caryophyllene → "caryophyllene"
 * - α-Humulene, alpha-Humulene, A-Humulene → "humulene"
 * - D-Limonene, d-Limonene → "limonene"
 * - β-Myrcene, beta-Myrcene → "myrcene"
 * - α/β-Pinene, Alpha Pinene, Beta Pinene → "pinene"
 * - α-Bisabolol → "bisabolol"
 * - Ocimenes/Ocimene → "ocimene"
 * - Terpinolene/Terpineol → "terpinolene" (forced per spec)
 * - Linalool → "linalool"
 * - Guaiol → "guaiol"
 *
 * @param {string} rawName
 * @returns {string} canonical terpene name (lowercase) or "" if invalid
 */
export function normalizeTerpName(rawName) {
  if (rawName == null) return "";

  let s = String(rawName).trim().toLowerCase();
  if (!s) return "";

  // Normalize unicode (handles odd variants / combining marks)
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Replace Greek letters with alpha/beta words
  s = s.replace(/β/g, "beta").replace(/α/g, "alpha");

  // Convert separators to spaces
  s = s.replace(/[_/]+/g, " ");
  s = s.replace(/-/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  // Strip common leading prefix markers
  // Handles: alpha/beta, a/b shorthand, d- (for D-limonene)
  s = s.replace(/^(alpha|beta|d)\s+/g, "");
  s = s.replace(/^(a|b)\s+/g, "");
  s = s.replace(/^(alpha|beta|d)\s+/g, ""); // run again (safe)

  // Remove non-letters (keep spaces for multiword)
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

  // Plurals
  if (s === "ocimenes") s = "ocimene";

  // Force terpineol -> terpinolene (per your spec)
  if (s === "terpineol") s = "terpinolene";

  // Combine alpha/beta pinene -> pinene (after prefix stripping it becomes "pinene")
  if (s === "alpha pinene" || s === "beta pinene" || s === "a pinene" || s === "b pinene") {
    s = "pinene";
  }

  // Known canonical set
  const known = new Set([
    "caryophyllene",
    "humulene",
    "limonene",
    "myrcene",
    "pinene",
    "bisabolol",
    "ocimene",
    "linalool",
    "terpinolene",
    "guaiol",
  ]);

  if (known.has(s)) return s;

  // If multiword remains (e.g., "endo fenchyl alcohol"), use last token (deterministic)
  const lastToken = s.split(" ").filter(Boolean).pop() || "";
  return known.has(lastToken) ? lastToken : (lastToken || s);
}

/**
 * Round terp % for stable display/storage.
 * @param {number} x
 */
export function roundPct(x) {
  return Math.round(Number(x) * 1000) / 1000;
}

/**
 * Combine duplicate terpenes (after normalization) and return top N by pct.
 *
 * @param {{name:string,pct:number}[]} terpArray
 * @param {number} [limit=6]
 * @returns {{name:string,pct:number}[]}
 */
export function getTopTerpenes(terpArray, limit = 6) {
  if (!Array.isArray(terpArray) || terpArray.length === 0) return [];

  const totals = new Map();

  for (const t of terpArray) {
    if (!t) continue;

    const name = normalizeTerpName(t.name);
    if (!name) continue;

    const pct = Number(t.pct);
    if (!Number.isFinite(pct) || pct <= 0) continue;

    totals.set(name, (totals.get(name) || 0) + pct);
  }

  return Array.from(totals.entries())
    .map(([name, pct]) => ({ name, pct: roundPct(pct) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, limit);
}

/** Convenience wrapper for top 6. */
export function getTop6Terpenes(terpArray) {
  return getTopTerpenes(terpArray, 6);
}

/**
 * Band classification for terpene %.
 * Keeps the same band labels you already use: none/supporting/dominant/primary.
 *
 * @param {number} pct
 * @param {{primary:number, dominant:number, supporting:number}} [thresholds]
 * @returns {"none"|"supporting"|"dominant"|"primary"}
 */
export function terpBandFromPct(pct, thresholds = DEFAULT_BAND_THRESHOLDS) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0) return "none";
  if (p >= thresholds.primary) return "primary";
  if (p >= thresholds.dominant) return "dominant";
  if (p >= thresholds.supporting) return "supporting";
  return "none";
}
