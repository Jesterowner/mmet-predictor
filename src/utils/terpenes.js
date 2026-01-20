// src/utils/terpenes.js

/**
* Terpene helpers for MMET Predictor v2
* - normalizeTerpName(): canonicalizes terp names (Greek letters, alpha/beta, A-/B-, D-)
* - getTop6Terpenes(): normalizes + merges duplicates + returns top 6 by %
* - terpBandFromPct(): band classification (none/supporting/dominant/primary)
* - getTerpeneBand(): simplified band for UI display (Very High/High/Medium/Low/Very Low)
*/

export const DEFAULT_BAND_THRESHOLDS = {
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
*/
export function normalizeTerpName(rawName) {
  if (rawName == null) return "";

  let s = String(rawName).trim().toLowerCase();
  if (!s) return "";

  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/β/g, "beta").replace(/α/g, "alpha");
  s = s.replace(/[_/]+/g, " ");
  s = s.replace(/-/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^(alpha|beta|d)\s+/g, "");
  s = s.replace(/^(a|b)\s+/g, "");
  s = s.replace(/^(alpha|beta|d)\s+/g, "");
  s = s.replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

  if (s === "ocimenes") s = "ocimene";
  if (s === "terpineol") s = "terpinolene";

  if (s === "alpha pinene" || s === "beta pinene" || s === "a pinene" || s === "b pinene") {
    s = "pinene";
  }

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

  const lastToken = s.split(" ").filter(Boolean).pop() || "";
  return known.has(lastToken) ? lastToken : (lastToken || s);
}

/**
* Round terp % for stable display/storage.
*/
export function roundPct(x) {
  return Math.round(Number(x) * 1000) / 1000;
}

/**
* Combine duplicate terpenes (after normalization) and return top N by pct.
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
  const top6 = getTopTerpenes(terpArray, 6);
  // Add band to each terpene
  return top6.map(t => ({
    ...t,
    band: getTerpeneBand(t.pct)
  }));
}

/**
* Band classification for terpene % - original system.
*/
export function terpBandFromPct(pct, thresholds = DEFAULT_BAND_THRESHOLDS) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0) return "none";
  if (p >= thresholds.primary) return "primary";
  if (p >= thresholds.dominant) return "dominant";
  if (p >= thresholds.supporting) return "supporting";
  return "none";
}

/**
* Simplified band classification for UI display.
* Used by ProductCard component.
*/
export function getTerpeneBand(pct) {
  const p = Number(pct);
  if (!Number.isFinite(p) || p <= 0) return null;
  if (p >= 2.0) return 'Very High';
  if (p >= 1.0) return 'High';
  if (p >= 0.5) return 'Medium';
  if (p >= 0.25) return 'Low';
  return 'Very Low';
}
