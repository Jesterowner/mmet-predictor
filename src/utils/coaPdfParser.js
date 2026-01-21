// src/utils/coaPdfParser.js
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * PDF -> text with simple line reconstruction (x/y bucketing).
 * Many COA PDFs come out scrambled if you just join items in order.
 */
export async function extractPdfText(file) {
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;

  let fullText = "";

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();

    // Group glyph runs into lines by rounded Y, then sort by X within each line
    const lines = new Map(); // yKey -> [{x,str}]
    for (const it of tc.items || []) {
      const str = (it && typeof it.str === "string" ? it.str : "").trim();
      if (!str) continue;

      const t = it.transform || [];
      const x = Number(t[4] ?? 0);
      const y = Number(t[5] ?? 0);
      const yKey = Math.round(y); // bucket

      if (!lines.has(yKey)) lines.set(yKey, []);
      lines.get(yKey).push({ x, str });
    }

    // PDF Y usually increases upward; sort descending to read top->bottom
    const ordered = [...lines.entries()].sort((a, b) => b[0] - a[0]);

    let pageText = "";
    for (const [, parts] of ordered) {
      parts.sort((a, b) => a.x - b.x);
      const row = parts.map((p2) => p2.str).join(" ").replace(/\s+/g, " ").trim();
      if (row) pageText += row + "\n";
    }

    fullText += `\n--- page ${p} ---\n${pageText}`;
  }

  return fullText.trim();
}

/** ---------- helpers ---------- */

function toNum(x) {
  if (x == null) return null;
  const n = Number(String(x).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function normName(raw) {
  if (!raw) return null;
  let s = String(raw)
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[(),]/g, "")
    .trim();

  // normalize greek letter prefixes
  s = s.replace(/^β[\s-]?/g, "beta-").replace(/^α[\s-]?/g, "alpha-");

  // normalize common variants
  if (s === "d limonene" || s === "d-limonene") s = "limonene";
  if (s === "e-caryophyllene") s = "beta-caryophyllene";
  return s;
}

function findFirst(reList, text) {
  for (const re of reList) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

// For the PDF type we “already know”: Modern Canna / Trulieve style blocks
function isModernCannaStyle(text) {
  const t = text.toLowerCase();
  return (
    t.includes("terpenes summary") ||
    t.includes("moderncanna.com") ||
    t.includes("modern canna") ||
    t.includes("cultivar:") ||
    t.includes("sample matrix:")
  );
}

function findTotalTHC(fullText) {
  const t = String(fullText || "");

  // 1) Same-line: Total THC ... 77.1%
  let m = t.match(/Total\s+THC[^\n%]{0,120}?([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (m) {
    const v = toNum(m[1]);
    if (v != null && v >= 5) return v;
  }

  // 2) Label then value on next line(s)
  const idx = t.toLowerCase().indexOf("total thc");
  if (idx >= 0) {
    const after = t.slice(idx, idx + 300);
    const m2 = after.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (m2) {
      const v2 = toNum(m2[1]);
      if (v2 != null && v2 >= 5) return v2;
    }
  }

  // 3) Compute from THCa + Delta-9 when Total THC not explicit
  const thcaMatch =
    t.match(/\bTHC[-\s]*A\b[^\n%]*?([0-9]+(?:\.[0-9]+)?)\s*%/i) ||
    t.match(/\bTHCa\b[^\n%]*?([0-9]+(?:\.[0-9]+)?)\s*%/i);

  const d9Match =
    t.match(/\b(Delta[-\s]*9\s*THC|Δ9\s*THC|D9\s*THC)\b[^\n%]*?([0-9]+(?:\.[0-9]+)?)\s*%/i);

  const thca = thcaMatch ? toNum(thcaMatch[1]) : null;
  const d9 = d9Match ? toNum(d9Match[d9Match.length - 1]) : null;

  if (thca != null || d9 != null) {
    const total = (d9 || 0) + ((thca || 0) * 0.877);
    if (total > 0) return Number(total.toFixed(1));
  }

  // 4) Potency Summary block: take max plausible %
  const pot = (t.match(/POTENCY SUMMARY[\s\S]{0,1600}/i) || [""])[0];
  const pcts = [...pot.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%/g)]
    .map(mm => Number(mm[1]))
    .filter(x => x >= 5 && x <= 99);
  if (pcts.length) return Number(Math.max(...pcts).toFixed(1));

  return null;
}

function findTotalTerpenes(text) {
  const t = String(text || "");

  // Explicit percent
  let m = t.match(/Total\s+Terpenes[^\n%]*?([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (m) {
    const v = toNum(m[1]);
    if (v != null && v > 0 && v < 50) return Number(v.toFixed(2));
  }

  // mg/g -> % (divide by 10)
  m = t.match(/Total\s+Terpenes[^\n]*?([0-9]+(?:\.[0-9]+)?)\s*(mg\/g|mg\s*\/\s*g)/i);
  if (m) {
    const v = toNum(m[1]);
    if (v != null && v > 0) return Number((v / 10).toFixed(2));
  }

  // Sometimes “Total Terpenes” is followed by a bare number (units missing)
  m = t.match(/Total\s+Terpenes[:\s]+([0-9]+(?:\.[0-9]+)?)(?:\s|$)/i);
  if (m) {
    const v = toNum(m[1]);
    if (v == null) return null;

    // normalize insane values (e.g., 809.00 should not be 809%)
    if (v > 300) return Number((v / 100).toFixed(2)); // 809 -> 8.09
    if (v > 30) return Number((v / 10).toFixed(2));   // 80.9 -> 8.09
    if (v > 0 && v < 50) return Number(v.toFixed(2));
  }

  return null;
}

function extractTerps_ModernCanna(text) {
  const section =
    findFirst(
      [
        /TERPENES SUMMARY\s*\(Top Ten\)([\s\S]*?)(?:Total\s+CBD|Total\s+THC|POTENCY SUMMARY|Page\s+\d+|$)/i,
        /TERPENES SUMMARY([\s\S]*?)(?:Total\s+CBD|Total\s+THC|POTENCY SUMMARY|Page\s+\d+|$)/i,
      ],
      text
    ) || "";

  const lines = section.split("\n").map((s) => s.trim()).filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const line of lines) {
    // Examples:
    // "beta-Caryophyllene 1.77"
    // "Linalool 0.695"
    // "D-Limonene 0.507"
    // Sometimes: "Caryophyllene Oxide 0.123%"
    let m = line.match(/^([A-Za-zαβ0-9\-\s]+?)\s+([0-9]+(?:\.[0-9]+)?)\s*%?$/);
    if (!m) continue;

    const name = normName(m[1]);
    const pct = toNum(m[2]);

    if (!name || pct == null) continue;
    if (pct <= 0 || pct > 50) continue;

    const key = name.replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name, pct });
  }

  out.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  return out;
}

export async function parseCoaPdf(file) {
  const fullText = await extractPdfText(file);

  // For now: ONLY support the style we know (Modern Canna-like).
  // If it isn’t detected, we still attempt terp extraction from any text, but we don’t do lab-specific tables yet.
  const modern = isModernCannaStyle(fullText);

  const productName =
    findFirst([/Product Name:\s*([^\n]+)/i], fullText) ||
    findFirst([/Cultivar:\s*([^\n]+)/i], fullText) ||
    null;

  const sampleMatrix = findFirst([/Sample Matrix:\s*([^\n]+)/i], fullText) || null;
  const sizeG = toNum(findFirst([/Batch Unit Size:\s*([0-9.]+)\s*g/i], fullText)) ?? 1;

  const totalTHC = findTotalTHC(fullText);
  const totalTerpenes = findTotalTerpenes(fullText);

  const terpenes = modern ? extractTerps_ModernCanna(fullText) : extractTerps_ModernCanna(fullText);

  const formGuess = (sampleMatrix || "").trim() || "Concentrate";
  const displayName = productName || file?.name || `COA Product ${sizeG}g`;

  return {
    displayName,
    form: formGuess,
    sizeG,
    totalTHC,
    totalTerpenes,
    terpenes,
    rawText: fullText,
  };
}
