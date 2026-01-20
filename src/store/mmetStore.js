// src/store/mmetStore.js
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import * as pdfjsLib from "pdfjs-dist";
import { normalizeTerpName, getTop6Terpenes, roundPct } from "../utils/terpenes";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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
  let m = t.match(/(HAZE[\sA-Z0-9#-]+\([IHS]\)[^\n]{0,80}\b\d+(?:\.\d+)?\s*g\b)/i);
  if (m) return m[1].trim();
  m = t.match(/Product\s*Name:\s*([^\n]+)/i);
  if (m) return m[1].trim();
  return firstNonEmptyLine(t);
}

function extractForm(text) {
  const t = String(text || "");
  let m = t.match(/Form:\s*([^\n]+)/i);
  if (m) return m[1].trim();

  const formTypes = [
    "Live Badder","Live Rosin","Live Sugar","Live Resin","Live Sauce",
    "Diamonds","Flower","Cart","Vape","Wax","Jam","Extract"
  ];
  for (const ft of formTypes) if (new RegExp(ft, "i").test(t)) return ft;
  return null;
}

function extractTotalTHC(text) {
  const t = String(text || "");

  let m = t.match(/Total\s*THC[\s\S]{0,80}?([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (m) return toNumber(m[1]);

  m = t.match(/Total\s*THC[\s\S]{0,80}?([0-9]+(?:\.[0-9]+)?)\s*mg\s*\/\s*g/i);
  if (m) {
    const mgPerG = toNumber(m[1]);
    if (mgPerG != null) return roundPct(mgPerG / 10);
  }

  const mUnit = t.match(/Total\s*THC\s*\/\s*Unit\s*([0-9]+(?:\.[0-9]+)?)\s*mg/i);
  const mGUnit = t.match(/Product\s*g\s*\/\s*unit\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (mUnit) {
    const thcMg = toNumber(mUnit[1]);
    const gUnit = mGUnit ? toNumber(mGUnit[1]) : 1.0;
    if (thcMg != null && gUnit != null && gUnit > 0) return roundPct((thcMg / gUnit) / 10);
  }

  return null;
}

function extractTotalTerpenes(text) {
  const t = String(text || "");
  let m = t.match(/Total\s*Terpenes[\s:]+([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (m) return toNumber(m[1]);
  m = t.match(/Total[\s\n]*Terpenes[\s\n]*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (m) return toNumber(m[1]);
  return null;
}

function extractTerpenePairs(text) {
  const t = String(text || "");
  const pairs = [];
  const seen = new Set();

  const add = (name, pct) => {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 50) return;
    if (seen.has(key)) return;
    pairs.push({ name: String(name).trim(), pct });
    seen.add(key);
  };

  const up = t.toUpperCase();
  const sIdx = up.indexOf("TERPENES SUMMARY");
  if (sIdx >= 0) {
    const tail = t.slice(sIdx);
    const stop = tail.match(/(Total\s+Terpenes\s*:|Showing\s+top|POTENCY\s+SUMMARY|MYCOTOXINS|MICROBIALS|PESTICIDES|RESIDUAL\s+SOLVENTS|HEAVY\s+METALS|Order\s*#|Certificate\s+of\s+Analysis)/i);
    const block = stop ? tail.slice(0, stop.index) : tail;

    const re = /([A-Za-z][A-Za-z\-]*(?:\s+[A-Za-z][A-Za-z\-]*)*)\s+([0-9]+\.[0-9]+)\s+([0-9]{2,6})/g;
    for (const m of block.matchAll(re)) {
      const name = m[1].trim();
      if (/Analyte|Result|ug\/g|SUMMARY/i.test(name)) continue;
      const pct = toNumber(m[2]);
      if (pct != null) add(name, pct);
    }
  }

  for (const m of t.matchAll(/([A-Za-z][A-Za-z0-9\-\s]+?)\s+([0-9]+(?:\.[0-9]+)?)\s*%/g)) {
    const name = m[1].trim();
    if (/Total\s+Terpenes/i.test(name)) continue;
    const pct = toNumber(m[2]);
    if (pct != null) add(name, pct);
  }

  return pairs;
}

function normalizeAndCombineTerps(pairs) {
  const map = new Map();
  for (const tt of pairs || []) {
    const name = normalizeTerpName(tt.name);
    const pct = Number(tt.pct);
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

  if (totalTHC == null) return null;

  const rawPairs = extractTerpenePairs(text);
  const terpenes = normalizeAndCombineTerps(rawPairs);
  const top6 = getTop6Terpenes(terpenes);

  return {
    id: uuid(),
    name,
    form,
    metrics: { totalTHC, totalTerpenes },
    terpenes,
    top6,
    coa: {
      rawText: text.length > 5000 ? text.slice(0, 5000) + "..." : text,
      sourceFileName: meta.sourceFileName || null,
      parsedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

async function readFileAsText(file) {
  const name = (file?.name || "").toLowerCase();

  if (name.endsWith(".txt") || name.endsWith(".csv") || file?.type?.startsWith("text/")) {
    return await file.text();
  }

  if (name.endsWith(".pdf") || file?.type === "application/pdf") {
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
        lastError: null,

        // debug
        lastFileName: null,
        lastFileTextPreview: null,
        lastTerpeneProbe: null,

        clearProducts: () => set({ products: [], lastError: null }),

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

        handleCoaFiles: async (files) => {
          const fileArr = Array.from(files || []);
          if (fileArr.length === 0) return { added: 0, errors: [] };

          const errors = [];
          let added = 0;

          for (const f of fileArr) {
            try {
              const text = await readFileAsText(f);

              const upper = String(text || "").toUpperCase();
              const idx = upper.indexOf("TERPEN");
              const probe = idx >= 0 ? String(text || "").slice(Math.max(0, idx - 200), idx + 1200) : null;

              set({
                lastFileName: f.name,
                lastFileTextPreview: String(text || "").slice(0, 4000),
                lastTerpeneProbe: probe,
              });

              const result = get().parseCoaText(text, { sourceFileName: f.name });
              if (result) added += Array.isArray(result) ? result.length : 1;
            } catch (e) {
              errors.push({ file: f?.name || "unknown", error: e?.message || String(e) });
            }
          }

          set({ lastError: errors[0]?.error || null });
          return { added, errors };
        },

        applyTerpenePaste: ({ productId, terpText } = {}) => {
          if (!productId) { set({ lastError: "applyTerpenePaste requires productId" }); return false; }
          const raw = String(terpText || "").trim();
          if (!raw) { set({ lastError: "No terp text provided" }); return false; }

          const rawPairs = extractTerpenePairs(raw);
          const terpenes = normalizeAndCombineTerps(rawPairs);
          const top6 = getTop6Terpenes(terpenes);

          set((state) => ({
            products: state.products.map((p) => {
              if (p.id !== productId) return p;
              const metrics = { ...(p.metrics || {}) };
              if (!metrics.totalTerpenes || metrics.totalTerpenes === 0) {
                const sum = terpenes.reduce((a, t) => a + (Number(t.pct) || 0), 0);
                metrics.totalTerpenes = roundPct(sum);
              }
              return { ...p, metrics, terpenes, top6 };
            }),
            lastError: null,
          }));

          return true;
        },

        // After-use rating log (this is your calibration loop)
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

        // Profile export/import (upload before each use)
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
