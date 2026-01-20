// src/store/mmetStore.js
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { normalizeTerpName, getTop6Terpenes, roundPct } from "../utils/terpenes";

/**
 * MMET Predictor v2 Zustand Store
 *
 * Key fixes integrated:
 * - parseCoaTextToProduct normalizes ALL terpene names before storing
 * - Stores COA "Total Terpenes: X.XX%" as metrics.totalTerpenes (separate from terp array)
 * - Parses all terpene lines it can find (bullets + inline "Name (X%)" patterns)
 *
 * State (required):
 * - products[]
 * - sessionLog[]
 * - profileName
 * - scoreMode
 * - scoreSource
 *
 * Actions (required):
 * - importLog()
 * - exportLog()
 * - parseCoaText()
 * - handleCoaFiles()
 * - clearProducts()
 * - logActuals()
 * - saveSession()
 */

// ---------- small utilities ----------
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
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0) || "Unknown Product";
}

function extractLabeledValue(text, labelRegex) {
  const m = String(text || "").match(labelRegex);
  if (!m) return null;
  return m[1]?.trim() ?? null;
}

/**
 * Parse terpene pairs from a COA text.
 *
 * Supports:
 * - Bullet lines: "- beta-Caryophyllene 2.14%"
 * - Inline parenthetical: "D-Limonene (1.44%); β-Caryophyllene (1.24%)"
 * - Inline bare: "Linalool 0.70%"
 *
 * Excludes obvious metric lines (THC/cannabinoids/total terpenes).
 */
function extractTerpenePairs(coaText) {
  const text = String(coaText || "");
  const lines = text.split(/\r?\n/);

  const out = [];

  const shouldSkipLine = (l) => {
    const s = l.toLowerCase();
    return (
      s.includes("total thc") ||
      s.includes("thc per unit") ||
      s.includes("total cannabinoids") ||
      s.includes("total terpenes") ||
      s.startsWith("form:")
    );
  };

  // One-per-line pattern: "- Name 0.123%" or "Name 0.123%"
  const lineRegex =
    /(?:^|[-•]\s*)([A-Za-z0-9+./()' \-βααββ]+?)\s+(\d+(\.\d+)?)\s*%/i;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (shouldSkipLine(line)) continue;

    // Multi-terp inline pattern: "Name (1.23%)"
    const parenGlobal =
      /([A-Za-z0-9+./' \-βααββ]+?)\s*\(\s*(\d+(\.\d+)?)\s*%\s*\)/gi;

    let pm;
    let foundParen = false;
    while ((pm = parenGlobal.exec(line)) !== null) {
      foundParen = true;
      out.push({ name: pm[1].trim(), pct: Number(pm[2]) });
    }
    if (foundParen) continue;

    const m = line.match(lineRegex);
    if (m) {
      out.push({ name: m[1].trim(), pct: Number(m[2]) });
    }
  }

  return out;
}

/**
 * Normalize and combine duplicate terpenes.
 * Stores full terpene array with normalized names.
 */
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

/**
 * Parse a COA text block into a product object in the required format.
 * - Normalized terpenes
 * - COA Total Terpenes stored in metrics.totalTerpenes (separate from terp array)
 */
function parseCoaTextToProduct(coaText, meta = {}) {
  const text = String(coaText || "").trim();
  if (!text) return null;

  const nameLine = firstNonEmptyLine(text);

  const form =
    extractLabeledValue(text, /(?:^|\n)\s*form:\s*(.+?)\s*(?:\n|$)/i) || null;

  const totalTHC = toNumber(
    extractLabeledValue(
      text,
      /(?:^|\n)\s*total thc:\s*([0-9.]+)\s*%\s*(?:\n|$)/i
    )
  );

  // ✅ COA Total Terpenes (separate from terp array; do not sum terps for this)
  const totalTerpenes = toNumber(
    extractLabeledValue(
      text,
      /(?:^|\n)\s*total terpenes:\s*([0-9.]+)\s*%\s*(?:\n|$)/i
    )
  );

  const totalCannabinoids = toNumber(
    extractLabeledValue(
      text,
      /(?:^|\n)\s*total cannabinoids:\s*([0-9.]+)\s*%\s*(?:\n|$)/i
    )
  );

  const thcPerUnitMg = toNumber(
    extractLabeledValue(
      text,
      /(?:^|\n)\s*thc per unit:\s*([0-9.]+)\s*mg\s*(?:\n|$)/i
    )
  );

  // ✅ Parse all terpene lines then normalize names before storing
  const rawPairs = extractTerpenePairs(text);
  const normalizedTerpenes = normalizeAndCombineTerps(rawPairs);

  // Useful derived field (top 6 normalized/combined) for display/scoring elsewhere
  const top6 = getTop6Terpenes(normalizedTerpenes);

  return {
    id: uuid(),
    name: nameLine,
    form,
    metrics: {
      totalTHC,
      totalTerpenes, // ✅ COA value
      totalCannabinoids,
      thcPerUnitMg,
    },
    // ✅ Full terp array, already normalized + combined
    terpenes: normalizedTerpenes,
    // Optional convenience
    top6,
    coa: {
      rawText: text,
      sourceFileName: meta.sourceFileName || null,
      parsedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

// ---------- file reading (txt + optional pdf) ----------
async function readFileAsText(file) {
  const name = (file?.name || "").toLowerCase();

  // Plain text
  if (
    name.endsWith(".txt") ||
    name.endsWith(".csv") ||
    name.endsWith(".md") ||
    file?.type?.startsWith("text/")
  ) {
    return await file.text();
  }

  // Optional PDF support (only if pdfjs-dist is installed & worker configured)
  if (name.endsWith(".pdf") || file?.type === "application/pdf") {
    try {
      const pdfjsLib = await import("pdfjs-dist");

      // NOTE: In Vite, configure workerSrc once in app init if needed:
      // pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      //   "pdfjs-dist/build/pdf.worker.min.mjs",
      //   import.meta.url
      // ).toString();

      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;

      let out = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        out += content.items.map((it) => it.str).join(" ") + "\n";
      }
      return out.trim();
    } catch {
      throw new Error(
        "PDF upload requires pdfjs-dist and worker configuration. Install it or convert PDFs to text first."
      );
    }
  }

  throw new Error(`Unsupported file type: ${file?.name || "unknown"}`);
}

// ---------- store ----------
export const useMmetStore = create(
  devtools(
    persist(
      (set, get) => ({
        // ---- state ----
        products: [],
        sessionLog: [],
        profileName: "Default",
        scoreMode: "standard",
        scoreSource: "coa",
        lastError: null,
        lastParseAt: null,

        // ---- actions ----
        clearProducts: () => set({ products: [], lastError: null }),

        parseCoaText: (coaText, meta = {}) => {
          try {
            const product = parseCoaTextToProduct(coaText, meta);
            if (!product) return null;

            set((state) => ({
              products: [product, ...state.products],
              lastError: null,
              lastParseAt: new Date().toISOString(),
            }));

            return product;
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
              const p = get().parseCoaText(text, { sourceFileName: f.name });
              if (p) added += 1;
            } catch (e) {
              errors.push({
                file: f?.name || "unknown",
                error: e?.message || String(e),
              });
            }
          }

          set({ lastError: errors[0]?.error || null });
          return { added, errors };
        },

        exportLog: () => {
          const state = get();
          const payload = {
            app: "MMET Predictor",
            version: 2,
            exportedAt: new Date().toISOString(),
            profileName: state.profileName,
            scoreMode: state.scoreMode,
            scoreSource: state.scoreSource,
            sessionLog: state.sessionLog,
          };
          return JSON.stringify(payload, null, 2);
        },

        importLog: (input) => {
          try {
            const data =
              typeof input === "string" ? JSON.parse(input) : input || {};
            const nextSessionLog = Array.isArray(data.sessionLog)
              ? data.sessionLog
              : [];

            set((state) => ({
              profileName: data.profileName ?? state.profileName,
              scoreMode: data.scoreMode ?? state.scoreMode,
              scoreSource: data.scoreSource ?? state.scoreSource,
              sessionLog: nextSessionLog,
              lastError: null,
            }));

            return { ok: true, sessions: nextSessionLog.length };
          } catch (e) {
            set({ lastError: e?.message || "Import failed" });
            return { ok: false, error: e?.message || "Import failed" };
          }
        },

        logActuals: ({ sessionId, productId, actuals, notes } = {}) => {
          if (!sessionId || !productId) {
            set({ lastError: "logActuals requires sessionId and productId" });
            return false;
          }

          const entry = {
            id: uuid(),
            at: new Date().toISOString(),
            productId,
            actuals: actuals || {},
            notes: notes || "",
          };

          set((state) => ({
            sessionLog: state.sessionLog.map((s) => {
              if (s.sessionId !== sessionId) return s;
              return {
                ...s,
                actuals: Array.isArray(s.actuals)
                  ? [...s.actuals, entry]
                  : [entry],
              };
            }),
            lastError: null,
          }));

          return true;
        },

        saveSession: ({ label } = {}) => {
          const state = get();
          const session = {
            sessionId: uuid(),
            createdAt: new Date().toISOString(),
            label: label || `Session ${state.sessionLog.length + 1}`,
            profileName: state.profileName,
            scoreMode: state.scoreMode,
            scoreSource: state.scoreSource,
            productsSnapshot: state.products,
            actuals: [],
          };

          set((s) => ({
            sessionLog: [session, ...s.sessionLog],
            lastError: null,
          }));

          return session.sessionId;
        },
      }),
      {
        name: "mmet-predictor-v2",
        version: 2,
        partialize: (s) => ({
          products: s.products,
          sessionLog: s.sessionLog,
          profileName: s.profileName,
          scoreMode: s.scoreMode,
          scoreSource: s.scoreSource,
        }),
      }
    ),
    { name: "MMET Predictor Store v2" }
  )
);
