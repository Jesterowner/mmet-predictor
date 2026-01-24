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
  const normalizedTerpenes = normalizeAndCombineTerps(rawPairs);
  const top6 = getTop6Terpenes(normalizedTerpenes);

  return {
    id: uuid(),
    name,
    form,
    metrics: {
      totalTHC,
      totalTerpenes,
      totalCannabinoids: null,
      thcPerUnitMg: null,
    },
    terpenes: normalizedTerpenes,
    top6,
    coa: {
      rawText: text.length > 5000 ? text.substring(0, 5000) + "..." : text,
      sourceFileName: meta.sourceFileName || null,
      parsedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

async function readFileAsText(file) {
  const name = (file?.name || "").toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".csv") || name.endsWith(".md") || file?.type?.startsWith("text/")) {
    return await file.text();
  }

  if (name.endsWith(".pdf") || file?.type === "application/pdf") {
    try {
      const parsed = await parseCoaPdf(file);

      // LAB_FIXUPS_V1: Lab-specific PDF normalization for Kaycha + Modern Canna formats.
      try {
        const raw = String(parsed?.rawText || "");
        const lines = raw
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        // ---- Kaycha Labs
        const isKaycha =
          /Kaycha\s+Labs/i.test(raw) ||
          lines.some((l) => /\bTESTED\b/i.test(l) && /TOTAL\s+TERPENES/i.test(l));

        if (isKaycha) {
          const totalLine = lines.find((l) => /TOTAL\s+TERPENES/i.test(l) && /\bTESTED\b/i.test(l));
          if (totalLine) {
            const nums = totalLine.match(/[0-9]+(?:\.[0-9]+)?/g) || [];
            const candidate = nums.length >= 2 ? Number(nums[nums.length - 2]) : null;
            if (candidate != null && isFinite(candidate) && candidate > 0.1 && candidate < 40) {
              if (!parsed.totalTerpenes || parsed.totalTerpenes < 0.2) parsed.totalTerpenes = candidate;
            }
          }

          const terpRows = [];
          for (const l of lines) {
            const m = l.match(
              /^([A-Z0-9\-\/ ]{3,})\s+[0-9.]+\s+[0-9.]+\s+TESTED\s+([0-9]+(?:\.[0-9]+)?)\s+[0-9]+(?:\.[0-9]+)?$/i
            );
            if (!m) continue;
            const nm = m[1].trim();
            if (/^TOTAL\s+TERPENES$/i.test(nm)) continue;
            const pct = Number(m[2]);
            if (!isFinite(pct) || pct <= 0 || pct > 40) continue;
            terpRows.push({ name: nm, pct });
          }
          if ((parsed?.terpenes || []).length === 0 && terpRows.length) {
            parsed.terpenes = terpRows;
          }
        }

        // ---- Modern Canna / Trulieve
        const isModern =
          /Modern\s+Canna|moderncanna\.com/i.test(raw) ||
          raw.toLowerCase().includes("total cbd total thc total cannabinoids total terpenes");

        if (isModern) {
          const idx = raw.toLowerCase().indexOf("total cbd total thc total cannabinoids total terpenes");
          if (idx >= 0) {
            const slice = raw.slice(idx, idx + 900);
            const perc = slice.match(/[0-9]+(?:\.[0-9]+)?%/g) || [];
            if (perc.length >= 4) {
              const thc = Number(perc[1].replace("%", ""));
              const terps = Number(perc[3].replace("%", ""));
              if (isFinite(thc) && thc > 1 && thc < 110) parsed.totalTHC = thc;
              if (isFinite(terps) && terps > 0.05 && terps < 40) parsed.totalTerpenes = terps;
            }
          }

          if ((parsed?.terpenes || []).length === 0) {
            const terpRows = [];
            for (const l of lines) {
              const m = l.match(/^([A-Za-z][A-Za-z0-9\- ]{2,})\s+([0-9]+(?:\.[0-9]+)?)$/);
              if (!m) continue;
              const nm = m[1].trim();
              const pct = Number(m[2]);
              if (/^(thca|delta|cbg|cbga|cbd|cbda|cbn|thcv|cbc|cbdv|thcva)$/i.test(nm)) continue;
              if (!isFinite(pct) || pct <= 0 || pct > 40) continue;
              terpRows.push({ name: nm, pct });
            }
            if (terpRows.length) parsed.terpenes = terpRows;
          }
        }
      } catch (e) {
        console.warn("[MMET PDF] lab fixups failed:", e?.message || e);
      }

      // Convert parsed PDF object into the text format your text parser expects
      const lines = [];
      lines.push(parsed.displayName || file?.name || "Unknown Product");
      lines.push(`Form: ${parsed.form || "Concentrate"}`);

      if (typeof parsed.totalTHC === "number") lines.push(`Total THC: ${parsed.totalTHC.toFixed(1)}%`);
      if (typeof parsed.totalTerpenes === "number") lines.push(`Total Terpenes: ${parsed.totalTerpenes.toFixed(2)}%`);

      if (Array.isArray(parsed.terpenes) && parsed.terpenes.length) {
        lines.push("Top Terpenes:");
        for (const tp of parsed.terpenes) {
          if (!tp?.name || typeof tp.pct !== "number") continue;
          lines.push(`- ${tp.name} ${tp.pct.toFixed(3)}%`);
        }
      }

      return lines.join("\n");
    } catch (err) {
      console.error("PDF parsing error:", err);
      throw new Error(`PDF parsing failed: ${err?.message || err}`);
    }
  }

  throw new Error(`Unsupported file type: ${file?.name || "unknown"}`);
}

export const useMmetStore = create(
  devtools(
    persist(
      (set, get) => ({
        products: [],
        sessionLog: [],
        profileName: "Default",
        scoreMode: "standard",
        scoreSource: "coa",
        lastError: null,
        lastParseAt: null,

        showManualEntry: false,
        setShowManualEntry: (v) => set({ showManualEntry: !!v }),

        setProfileName: (name) => set({ profileName: String(name || "Default") }),
        setScoreMode: (mode) => set({ scoreMode: mode }),
        setScoreSource: (source) => set({ scoreSource: source }),

        parseCoaText: (coaText, meta = {}) => {
          try {
            const product = parseCoaTextToProduct(coaText, meta);
            if (!product) return null;
            set((state) => ({ products: [product, ...state.products], lastError: null }));
            return [product];
          } catch (e) {
            set({ lastError: e?.message || "Failed to parse COA text" });
            return null;
          }
        },

        addProduct: (product) => {
          const newProduct = {
            ...product,
            id: product.id || uuid(),
            createdAt: product.createdAt || new Date().toISOString(),
          };
          set((state) => ({
            products: [newProduct, ...state.products],
            lastError: null,
          }));
          return newProduct;
        },

        removeProduct: (productId) => {
          set((state) => ({
            products: state.products.filter((p) => p.id !== productId),
            // also clear any saved sessions for this product so Personalized count stays accurate
            sessionLog: state.sessionLog.filter((s) => s.productId !== productId),
            lastError: null,
          }));
        },

        // ✅ Clear all products AND sessions (so Personalized count resets too)
        clearProducts: () => {
          set({ products: [], sessionLog: [], lastError: null });
        },

        // ✅ Rename product after parse (fix mis-captured names)
        renameProduct: (productId, newName) => {
          const name = String(newName || "").trim();
          if (!productId || !name) return;

          set((state) => ({
            products: state.products.map((p) => (p.id === productId ? { ...p, name } : p)),
            lastError: null,
          }));
        },

        handleCoaFiles: async (files) => {
          const fileArr = Array.from(files || []);
          if (fileArr.length === 0) return { added: 0, errors: [] };

          const errors = [];
          let added = 0;

          for (const f of fileArr) {
            try {
              const text = await readFileAsText(f);
              const result = get().parseCoaText(text, { sourceFileName: f.name });
              if (result) added += Array.isArray(result) ? result.length : 1;
            } catch (e) {
              errors.push({ file: f?.name || "unknown", error: e?.message || String(e) });
            }
          }

          set({ lastError: errors[0]?.error || null });
          return { added, errors };
        },

        addSessionEntry: ({ productId, actuals, notes } = {}) => {
          if (!productId) {
            set({ lastError: "addSessionEntry requires productId" });
            return false;
          }
          const entry = {
            id: uuid(),
            at: new Date().toISOString(),
            productId,
            actuals: actuals || {},
            notes: notes || "",
          };
          set((state) => ({ sessionLog: [entry, ...state.sessionLog], lastError: null }));
          return true;
        },

        // ✅ NEW: delete a mistaken session log entry
        removeSessionEntry: (sessionId) => {
          if (!sessionId) return false;
          set((state) => ({
            sessionLog: state.sessionLog.filter((s) => s.id !== sessionId),
            lastError: null,
          }));
          return true;
        },

        // ✅ OPTIONAL: delete all sessions for a specific product
        removeSessionsForProduct: (productId) => {
          if (!productId) return false;
          set((state) => ({
            sessionLog: state.sessionLog.filter((s) => s.productId !== productId),
            lastError: null,
          }));
          return true;
        },

        exportProfileJson: () => {
          const s = get();
          const payload = {
            app: "MMET Predictor",
            version: 2,
            exportedAt: new Date().toISOString(),
            profileName: s.profileName,
            products: s.products,
            sessionLog: s.sessionLog,
          };
          return JSON.stringify(payload, null, 2);
        },

        importProfileJson: (input) => {
          try {
            const data = typeof input === "string" ? JSON.parse(input) : input || {};
            const products = Array.isArray(data.products) ? data.products : [];
            const sessionLog = Array.isArray(data.sessionLog) ? data.sessionLog : [];
            set((s) => ({
              profileName: data.profileName ?? s.profileName,
              products,
              sessionLog,
              lastError: null,
            }));
            return { ok: true, products: products.length, sessions: sessionLog.length };
          } catch (e) {
            set({ lastError: e?.message || "Import failed" });
            return { ok: false, error: e?.message || "Import failed" };
          }
        },
      }),
      {
        name: "mmet-predictor-v2",
        version: 2,
        partialize: (s) => ({
          products: s.products,
          sessionLog: s.sessionLog,
          profileName: s.profileName,
        }),
      }
    ),
    { name: "MMET Predictor Store v2" }
  )
);
