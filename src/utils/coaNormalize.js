// src/utils/coaNormalize.js

const NUM = String.raw`([0-9]+(?:\.[0-9]+)?)`;

function clean(s = "") {
  return s
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstMatch(text, re) {
  const m = text.match(re);
  return m?.[1]?.trim() || "";
}

function firstNumber(text, re) {
  const v = firstMatch(text, re);
  return v ? Number(v) : null;
}

function guessForm(text, fallback = "") {
  const t = text.toLowerCase();
  const keywords = [
    "live badder","badder","live sugar","sugar","crumble","wax","live rosin","rosin",
    "diamonds","sauce","shatter","vape","cart","flower"
  ];
  for (const k of keywords) {
    if (t.includes(k)) return k.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return fallback || "Unknown";
}

function extractTerpenes(text) {
  const lines = clean(text).split("\n").map((l) => l.trim()).filter(Boolean);

  let start = lines.findIndex((l) => /terpenes summary|terpenes tested|terpenes\s+summary/i.test(l));
  if (start === -1) start = lines.findIndex((l) => /^terpenes$/i.test(l));
  if (start === -1) start = 0;

  const out = [];

  for (let i = start; i < Math.min(lines.length, start + 220); i++) {
    const line = lines[i];

    if (/potency|pesticide|mycotoxin|microbial|solvent|heavy metals|analysis summary/i.test(line)) {
      if (out.length) break;
    }
    if (/total terpenes/i.test(line)) continue;
    if (!/[a-z]/i.test(line)) continue;

    if (/certificate|laboratory|license|batch|order|sample|client|address|completed|received/i.test(line)) continue;

    const nameMatch = line.match(/^([A-Za-z][A-Za-z \-\/]+?)\s+/);
    if (!nameMatch) continue;

    const name = nameMatch[1].trim();
    if (name.length < 3) continue;

    const nums = [...line.matchAll(new RegExp(NUM, "g"))].map((m) => Number(m[1]));
    if (!nums.length) continue;

    const pctCandidates = nums.filter((n) => n > 0.01 && n <= 20);
    if (!pctCandidates.length) continue;

    const pct = pctCandidates[pctCandidates.length - 1];
    if (/total|pass|nd|loq|lod/i.test(name.toLowerCase())) continue;

    out.push({ name, pct });
    if (out.length >= 12) break;
  }

  const map = new Map();
  for (const t of out) {
    const key = t.name.toLowerCase();
    if (!map.has(key) || map.get(key).pct < t.pct) map.set(key, t);
  }

  return [...map.values()].sort((a, b) => b.pct - a.pct).slice(0, 20);
}

export function normalizePdfCoaToStandard(text, filename = "") {
  const t = clean(text);
  const fileBase = (filename || "").replace(/\.pdf$/i, "").trim();

  let productName =
    firstMatch(t, /Product Name:\s*(.+)/i) ||
    firstMatch(t, /Cultivar:\s*(.+)/i) ||
    "";

  const cultivar = firstMatch(t, /Cultivar:\s*(.+)/i);
  const matrix = firstMatch(t, /Sample Matrix:\s*(.+)/i) || firstMatch(t, /Matrix:\s*(.+)/i) || "";

  if (!productName && fileBase) productName = fileBase;
  if (cultivar && (!productName || productName.length < 3)) productName = fileBase || cultivar;

  const formFromDoc = matrix || firstMatch(t, /Type:\s*(.+)/i) || "";
  const form = guessForm(t + "\n" + productName, formFromDoc);

  let totalThcPct = firstNumber(t, new RegExp(`Total THC\s*:?\s*${NUM}\s*%`, "i"));
  
  // Fallback: some PDFs list labels first, then % values later (grab first % from POTENCY SUMMARY block)
  if (totalThcPct == null) {
    const pot = (t.match(/POTENCY SUMMARY[\s\S]{0,400}/i) || [""])[0];
    const pcts = [...pot.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*%/g)].map(m => Number(m[1]));
    if (pcts.length) totalThcPct = pcts[0];
  }
  
  const totalCannabinoidsPct = firstNumber(t, new RegExp(`Total Cannabinoids\s*:?\s*${NUM}\s*%`, "i"));
  
  let totalTerpenesPct = firstNumber(t, new RegExp(`Total Terpenes\s*:?\s*${NUM}\s*%`, "i"));
  if (totalTerpenesPct == null) {
    const m = t.match(/TOTAL TERPENES.*?\s([0-9]+(?:\.[0-9]+)?)\s+/i);
    if (m) totalTerpenesPct = Number(m[1]);
  }
  
  // Fallback: Total Terpenes followed by a bare number (no % sign)
  if (totalTerpenesPct == null) {
    const m2 = t.match(/Total\s+Terpenes[\s\S]{0,120}\b([0-9]+(?:\.[0-9]+)?)\b/i);
    if (m2) totalTerpenesPct = Number(m2[1]);
  }

  const thcMg =
    firstNumber(t, new RegExp(`Total\\s*THC\\/Unit\\s*${NUM}\\s*mg`, "i")) ??
    firstNumber(t, new RegExp(`Total\\s*THC\\s*:?\\s*${NUM}\\s*mg`, "i"));

  const terps = extractTerpenes(t);

  const lines = [];
  lines.push(productName || fileBase || "Unknown Product");
  lines.push(`Form: ${form}`);

  if (typeof totalThcPct === "number") lines.push(`Total THC: ${totalThcPct.toFixed(1)}%`);
  if (typeof thcMg === "number") lines.push(`THC per unit: ${Math.round(thcMg)} mg`);
  if (typeof totalCannabinoidsPct === "number") lines.push(`Total Cannabinoids: ${totalCannabinoidsPct.toFixed(1)}%`);
  if (typeof totalTerpenesPct === "number") lines.push(`Total Terpenes: ${totalTerpenesPct.toFixed(2)}%`);

  if (terps.length) {
    lines.push(`Top Terpenes:`);
    for (const tp of terps) lines.push(`- ${tp.name} ${tp.pct.toFixed(3)}%`);
  }

  return lines.join("\n");
}
