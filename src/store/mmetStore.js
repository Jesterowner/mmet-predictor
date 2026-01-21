// src/store/mmetStore.js
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import * as pdfjsLib from "pdfjs-dist";
import { normalizeTerpName, getTop6Terpenes, roundPct } from "../utils/terpenes";

// Configure PDF worker for production
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
}

const uuid = () => {
  try { return crypto.randomUUID(); }
  catch { return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
};

const toNumber = (v) => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function firstNonEmptyLine(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0) || "Unknown Product";
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
    // Try to add form if available
    const formMatch = t.match(/Sample\s*Matrix:\s*([^\n]+)/i);
    if (formMatch) {
      return `${cultivar} ${formMatch[1].trim()}`;
    }
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
    "Live Badder","Live Rosin","Live Sugar","Live Resin","Live Sauce",
    "Diamonds","Flower","Cart","Vape","Wax","Jam","Extract","Crumble"
  ];
  for (const ft of formTypes) if (new RegExp(ft, "i").test(t)) return ft;
  return null;
}

function extractTotalTHC(text) {
  const t = String(text || "");
  
  // Format 1: "Total THC: 82.1%"
  let m = t.match(/Total\s+THC[:\s]+([0-9.]+)\s*%/i);
  if (m) return toNumber(m[1]);
  
  // Format 2: "Total THC\n82.1% (821 mg)"
  m = t.match(/Total\s+THC[\s\n]+([0-9.]+)%/i);
  if (m) return toNumber(m[1]);
  
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
  
  return null;
}

/**
 * ENHANCED: Extract terpenes in MULTIPLE formats
 * Handles both "name percentage" and "name number" (no % sign)
 */
function extractTerpenePairs(text) {
  const t = String(text || "");
  const pairs = [];
  const seen = new Set();
  
  // Find TERPENES section
  const terpMatch = t.match(/TERPENES[\s\S]+?(?=POTENCY|ANALYSIS|Copyright|Page|$)/i);
  const terpSection = terpMatch ? terpMatch[0] : t;
  
  const lines = terpSection.split(/\r?\n/);
  
  for (const line of lines) {
    // Skip headers
    if (line.match(/Analyte|Result|Top Ten|Total Terpenes|SUMMARY/i)) continue;
    
    // Pattern 1: "beta-Caryophyllene 1.77" (NO percent sign)
    let match = line.match(/^([A-Za-z][A-Za-z0-9\-\s]+?)\s+([0-9]+\.[0-9]+)(?:\s|$)/);
    if (match) {
      const name = match[1].trim();
      const pct = parseFloat(match[2]);
      const key = name.toLowerCase().replace(/[^a-z]/g, '');
      
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
      const key = name.toLowerCase().replace(/[^a-z]/g, '');
      
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
    console.warn('No THC found in COA:', name);
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
      rawText: text.length > 5000 ? text.substring(0, 5000) + '...' : text,
      sourceFileName: meta.sourceFileName || null,
      parsedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

async function readFileAsText(file) {
  const name = (file?.name || "").toLowerCase();

  if (
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md") ||
    file?.type?.startsWith("text/")
  ) {
    return await file.text();
  }

  if (name.endsWith(".pdf") || file?.type === "application/pdf") {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      let out = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items.map((it) => it.str);
        out += items.join(" ") + "\n\n";
      }
      return out.trim();
    } catch (err) {
      console.error('PDF parsing error:', err);
      throw new Error(`PDF parsing failed: ${err.message}`);
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
            products: state.products.filter(p => p.id !== productId),
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
          if (!productId) { set({ lastError: "addSessionEntry requires productId" }); return false; }
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
