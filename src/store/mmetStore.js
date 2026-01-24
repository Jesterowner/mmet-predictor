// src/store/mmetStore.js
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import { parseCoaPdf } from "../utils/coaPdfParser";
import { normalizeTerpName, getTop6Terpenes, roundPct } from "../utils/terpenes";

// (These are currently unused in your snippet, but keeping them if other parts rely on them)
import { extractTextFromPdfFile } from "../utils/pdfText";
import { normalizePdfCoaToStandard } from "../utils/coaNormalize";

// Configure PDF worker for production (kept as a no-op placeholder)
if (typeof window !== "undefined") {
  // Worker handled inside your pdf parser utils
}

const uuid = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
};

const toNumber = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function firstNonEmptyLine(text) {
  return (
    String(text || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "Unknown Product"
  );
}

function extractProductName(text) {
  const t = String(text || "");

  // Try Trulieve format: "Product Name: Roll One - Sativa Crmbl"
  let m = t.match(/Product\s*Name:\s*([^\n]+)/i);
  if (m) return m[1].trim();

  // Try cultivar: "Cultivar: Dream Queen"
  m = t.match(/Cultivar:\s*([^\n]+)/i);
  if (m) {
    const cultivar = m[1].trim();
    const formMatch = t.match(/Sample\s*Matrix:\s*([^\n]+)/i);
    if (formMatch) return `${cultivar} ${formMatch[1].trim()}`;
    return cultivar;
  }

  // Try HAZE format
  m = t.match(/(HAZE[\sA-Z0-9#-]+\([IHS]\)[^\n]{0,80}\b\d+(?:\.\d+)?\s*g\b)/i);
  if (m) return m[1].trim();

  return firstNonEmptyLine(t);
}

function extractForm(text) {
  const t = String(text || "");

  // Try "Sample Matrix: Crumble"
  let m = t.match(/Sample\s*Matrix:\s*([^\n]+)/i);
  if (m) return m[1].trim();

  // Try "Form: Live Badder"
  m = t.match(/Form:\s*([^\n]+)/i);
  if (m) return m[1].trim();

  const formTypes = [
    "Live Badder",
    "Live Rosin",
    "Live Sugar",
    "Live Resin",
    "Live Sauce",
    "Diamonds",
    "Flower",
    "Cart",
    "Vape",
    "Wax",
    "Jam",
    "Extract",
    "Crumble",
  ];
  for (const ft of formTypes) {
    if (new RegExp(ft, "i").test(t)) return ft;
  }
  return null;
}

function extractTotalTHC(text) {
  const t = String(text || "");

  // Preferred: explicit Total THC %
  let m = t.match(/Total\s+THC[:\s]+([0-9.]+)\s*%/i);
  if (m) return toNumber(m[1]);

  // Alternate: "Total THC\n82.1% (821 mg)"
  m = t.match(/Total\s+THC[\s\n]+([0-9.]+)\s*%/i);
  if (m) return toNumber(m[1]);

  // Fallback: compute Total THC from THCa and Delta-9 when only components are listed
  // Total THC = Δ9 THC + (THCa * 0.877)
  const thcaMatch =
    t.match(/\bTHCa\b[:\s]+([0-9.]+)\s*%/i) || t.match(/\bTHC-A\b[:\s]+([0-9.]+)\s*%/i);

  const d9Match =
    t.match(/\b(Delta[-\s]*9\s*THC|Δ9\s*THC|D9\s*THC)\b[:\s]+([0-9.]+)\s*%/i) ||
    t.match(/\bDelta\s*9\b[\s\S]{0,30}?([0-9.]+)\s*%/i);

  const thca = thcaMatch ? toNumber(thcaMatch[1]) : null;
  const d9 = d9Match ? toNumber(d9Match[d9Match.length - 1]) : null;

  if (thca != null || d9 != null) {
    const total = (d9 || 0) + (thca || 0) * 0.877;
    if (total > 0) return roundPct(total);
  }

  return null;
}

function extractTotalTerpenes(text) {
  const t = String(text || "");

  // Format 1: "Total Terpenes: 3.78%"
  let m = t.match(/Total\s+Terpenes[:\s]+([0-9.]+)\s*%/i);
  if (m) return toNumber(m[1]);

  // Format 2: "3.78%\nTotal Terpenes"
  m = t.match(/([0-9.]+)%[\s\n]+Total\s+Terpenes/i);
  if (m) return toNumber(m[1]);

  // Format 3: "Total Terpenes 80.9 mg/g" (convert mg/g -> % by /10)
  m = t.match(/Total\s+Terpenes[:\s]+([0-9.]+)\s*(mg\/g|mg\s*\/\s*g)/i);
  if (m) return roundPct(toNumber(m[1]) / 10);

  // Format 4: "Total Terpenes 809.00" (unit missing; normalize to plausible %)
  m = t.match(/Total\s+Terpenes[:\s]+([0-9.]+)(?:\s|$)/i);
  if (m) {
    const v = toNumber(m[1]);
    if (v == null) return null;
    if (v > 300) return roundPct(v / 100);
    if (v > 30) return roundPct(v / 10);
    if (v > 0) return roundPct(v);
  }

  return null;
}

function extractTerpenePairs(text) {
  const t = String(text || "");
  const pairs = [];
  const seen = new Set();

  // Find TERPENES section
  const terpMatch = t.match(/TERPENES[\s\S]+?(?=POTENCY|ANALYSIS|Copyright|Page|$)/i);
  const terpSection = terpMatch ? terpMatch[0] : t;

  const lines = terpSection.split(/\r?\n/);

  for (const line of lines) {
    if (line.match(/Analyte|Result|Top Ten|Total Terpenes|SUMMARY/i)) continue;

    // Pattern 1: "beta-Caryophyllene 1.77" (NO percent sign)
    let match = line.match(/^([A-Za-z][A-Za-z0-9\-\s]+?)\s+([0-9]+\.[0-9]+)(?:\s|$)/);
    if (match) {
      const name = match[1].trim();
      const pct = parseFloat(match[2]);
      const key = name.toLowerCase().replace(/[^a-z]/g, "");

      if (pct > 0 && pct < 50 && !seen.has(key)) {
        pairs.push({ name, pct });
        seen.add(key);
        continue;
      }
    }

    // Pattern 2: "Caryophyllene 2.26%" (WITH percent sign)
    match = line.match(/([A-Za-z][A-Za-z0-9\-\s]+?)\s+([0-9]+\.[0-9]+)%/);
    if (match) {
      const name = match[1].trim();
      const pct = parseFloat(match[2]);
      const key = name.toLowerCase().replace(/[^a-z]/g, "");

      if (pct > 0 && pct < 50 && !seen.has(key)) {
        pairs.push({ name, pct });
        seen.add(key);
      }
    }
  }

  return pairs;
}

function normalizeAndCombineTerps(pairs) {
  const map = new Map();
  for (const t of pairs) {
    const name = normalizeTerpName(t.name);
    const pct = Number(t.pct);
    if (!name) continue;
    if (!Number.isFinite(pct) || pct <= 0) continue;
    map.set(name, (map.get(name) || 0) + pct);
  }

  return Array.from(map.entries())
    .map(([name, pct]) => ({ name, pct: roundPct(pct) }))
    .sort((a, b) => b.pct - a.pct);
}

function parseCoaTextToProduct(coaText, meta = {}) {
  const text = String(coaText || "").trim();
  if (!text) return null;

  const name = extractProductName(text);
  const form = extractForm(text);
  const totalTHC = extractTotalTHC(text);
  const totalTerpenes = extractTotalTerpenes(text);

  if (!totalTHC) {
    console.warn("No THC found in COA:", name);
    return null;
  }

  const rawPairs = extractTerpenePairs(text);
  const normalizedTerpenes = normalizeAndCombine
