// src/store/mmetStore.js
import { create } from "zustand";
import { normalizeTerpName, getTop6Terpenes } from "../utils/terpenes";

/**
 * MMET Predictor v2 – Zustand Store
 *
 * State:
 * - products[]: parsed COA products
 * - sessionLog[]: user calibration sessions (actuals)
 * - profileName: current user/profile
 * - scoreMode: "raw" | "calibrated" (future-ready)
 * - scoreSource: "coa" | "coa+log" (future-ready)
 * - lastError: last UI-visible error
 *
 * Actions:
 * - importLog(payload)
 * - exportLog()
 * - parseCoaText(text, meta?)
 * - handleCoaFiles(fileList)
 * - clearProducts()
 * - logActuals(session)
 * - saveSession(session)
 */

// ------------------------------
// Helpers
// ------------------------------
function safeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : null;
}

function makeId(prefix = "p") {
  // Use browser crypto if available (Vercel/modern browsers)
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  // Fallback
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Try to extract a single numeric percent from a line like:
 * "Total Terpenes: 5.86%" or "Total THC: 74.8%"
 */
function extractPercentAfterLabel(text, label) {
  const re = new RegExp(`${label}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)\\s*%`, "i");
  const m = text.match(re);
  return m ? safeNumber(m[1]) : null;
}

/**
 * COA terpene line parsing:
 * Supports common formats:
 * - "- beta-Caryophyllene 2.26%"
 * - "β-Caryophyllene (0.75%)"
 * - "Primary: D-Limonene (1.44%); β-Caryophyllene (1.24%)"
 * - "Supporting: Pinene (α+β ≈ 0.37%)"  -> extracts 0.37 for "pinene"
 *
 * Returns array of { name, pct } in raw (not normalized) form.
 */
function parseTerpeneLines(text) {
  const out = [];

  const lines = String(text || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // 1) Bullet/line style: "- Name 0.123%" or "Name (0.123%)"
  // We'll scan every line and extract any (name, pct) pairs.
  for (const line of lines) {
    // Ignore obvious non-terp metrics lines
    if (/^total\s+(thc|cannabinoids|terpenes)\b/i.test(line)) continue;
    if (/^thc\s+per\s+unit\b/i.test(line)) continue;

    // Capture patterns like:
    // "- beta-Caryophyllene 2.26%"
    // "alpha-Humulene 0.774%"
    let m = line.match(/^[\-•\s]*([A-Za-zαβΑΒ0-9\-\s]+?)\s+([0-9]+(?:\.[0-9]+)?)\s*%/);
    if (m) {
      out.push({ name: m[1].trim(), pct: safeNumber(m[2]) });
      continue;
    }

    // Capture patterns like:
    // "β-Caryophyllene (0.75%)"
    // "D-Limonene (1.44%)"
    m = line.match(/([A-Za-zαβΑΒ0-9\-\s]+?)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*\)/);
    if (m) {
      out.push({ name: m[1].trim(), pct: safeNumber(m[2]) });
      continue;
    }

    // Inline band lists on one line, e.g.:
    // "Primary: D-Limonene (1.44%); β-Caryophyllene (1.24%)"
    // We extract all "(x.xx%)" occurrences paired with name immediately before it.
    const inline = [...line.matchAll(/([A-Za-zαβΑΒ0-9\-\s]+?)\s*\(\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*\)/g)];
    if (inline.length) {
      for (const mm of inline) {
        out.push({ name: mm[1].trim(), pct: safeNumber(mm[2]) });
      }
      continue;
    }

    // Special case: "Pinene (α+β ≈ 0.37%)" — grab the number if present
    m = line.match(/([A-Za-zαβΑΒ0-9\-\s]+?)\s*\([^)]*?([0-9]+(?:\.[0-9]+)?)\s*%\s*\)/);
    if (m) {
      out.push({ name: m[1].trim(), pct: safeNumber(m[2]) });
      continue;
    }
  }

  // Drop null/invalid pct entries
  return out.filter((t) => t && t.name && Number.isFinite(Number(t.pct)) && Number(t.pct) > 0);
}

/**
 * Normalize terpene names + combine duplicates
 */
function normalizeAndCombineTerpenes(terpsRaw) {
  const totals = new Map();
  for (const t of terpsRaw || []) {
    const norm = normalizeTerpName(t.name);
    const pct = safeNumber(t.pct);
    if (!norm || !Number.isFinite(pct) || pct <= 0) continue;
    totals.set(norm, (totals.get(norm) || 0) + pct);
  }

  return Array.from(totals.entries())
    .map(([name, pct]) => ({
      name,
      // keep tidy precision for storage
      pct: Math.round(pct * 1000) / 1000,
    }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Parse a COA text block into a product object:
 * {
 *  id, name, form,
 *  metrics: { totalTHC, totalTerpenes },
 *  terpenes: [{ name: "caryophyllene", pct: 2.26 }, ...]
 * }
 */
function parseCoaTextToProduct(text, meta = {}) {
  const raw = String(text || "").trim();
  if (!raw) return null;

  // Attempt to extract name: usually first non-empty line
  const firstLine = raw.replace(/\r/g, "").split("\n").map((l) => l.trim()).find(Boolean) || "Unknown Product";

  // Attempt to extract form (e.g., "Form: Live Badder")
  const formMatch = raw.match(/^\s*Form\s*:\s*(.+)\s*$/im);
  const form = formMatch ? formMatch[1].trim() : null;

  const totalTHC = extractPercentAfterLabel(raw, "Total\\s*THC");
  const totalTerpenes = extractPercentAfterLabel(raw, "Total\\s*Terpenes");

  // Extract terpenes from all lines we can recognize
  const terpsRaw = parseTerpeneLines(raw);
  const terpenes = normalizeAndCombineTerpenes(terpsRaw);

  // If no terpenes found, still return product so UI shows something
  const product = {
    id: makeId("prod"),
    name: firstLine,
    form: form || "",
    metrics: {
      totalTHC: totalTHC ?? null,
      totalTerpenes: totalTerpenes ?? null, // ✅ COA value stored separately
      sourceFileName: meta?.sourceFileName || "",
      parsedAt: new Date().toISOString(),
    },
    terpenes, // ✅ full normalized array
  };

  return product;
}

/**
 * Split multi-COA pasted text into blocks.
 * Heuristic: split on 3+ newlines, or lines that look like a new product header.
 */
function splitIntoCoaBlocks(text) {
  const raw = String(text || "").replace(/\r/g, "").trim();
  if (!raw) return [];

  // First try triple newline split (your existing convention)
  const triple = raw.split(/\n\s*\n\s*\n+/g).map((b) => b.trim()).filter(Boolean);
  if (triple.length > 1) return triple;

  // Fallback: if user pasted multiple products with a blank line between each
  const dbl = raw.split(/\n\s*\n+/g).map((b) => b.trim()).filter(Boolean);
  if (dbl.length > 1) return dbl;

  return [raw];
}

// ------------------------------
// Zustand Store
// ------------------------------
export const useMmetStore = create((set, get) => ({
  // ---- State
  products: [],
  sessionLog: [],
  profileName: "Default",
  scoreMode: "raw", // future: "calibrated"
  scoreSource: "coa", // future: "coa+log"
  lastError: null,

  // ---- Actions

  clearProducts: () => {
    set({ products: [], lastError: null });
  },

  /**
   * Parse COA text (single or multiple blocks) and add products to store.
   */
  parseCoaText: (text, meta = {}) => {
    try {
      const blocks = splitIntoCoaBlocks(text);
      if (!blocks.length) return;

      const newProducts = [];
      for (const block of blocks) {
        const p = parseCoaTextToProduct(block, meta);
        if (p) newProducts.push(p);
      }

      if (!newProducts.length) {
        set({ lastError: "No products could be parsed from that COA text." });
        return;
      }

      set((state) => ({
        products: [...newProducts, ...state.products],
        lastError: null,
      }));
    } catch (err) {
      console.error(err);
      set({ lastError: `Parse failed: ${err?.message || String(err)}` });
    }
  },

  /**
   * Handle uploaded COA files (TXT/MD/CSV supported).
   * PDFs are not parsed in this version; we surface a clear error.
   */
  handleCoaFiles: async (fileList) => {
    try {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      const supportedTextExt = /\.(txt|md|csv)$/i;

      for (const file of files) {
        const name = file?.name || "uploaded";
        const isPdf = /\.pdf$/i.test(name);

        if (isPdf) {
          // Production-safe: avoid pretending we parsed a PDF
          set({
            lastError:
              "PDF upload detected. PDF parsing isn't enabled yet in this build. Please export the COA text to .txt or paste the COA text.",
          });
          continue;
        }

        const isText = supportedTextExt.test(name) || file.type?.startsWith("text/");
        if (!isText) {
          set({ lastError: `Unsupported file type: ${name}. Use .txt/.md/.csv or paste text.` });
          continue;
        }

        const text = await file.text();
        get().parseCoaText(text, { sourceFileName: name });
      }

      set({ lastError: null });
    } catch (err) {
      console.error(err);
      set({ lastError: `File parse failed: ${err?.message || String(err)}` });
    }
  },

  /**
   * Add an "actuals" record (calibration entry) to sessionLog.
   * session = {
   *  sessionId?, date?, productId?, productName?, form?,
   *  metrics?, topTerpenes?, ratings: { pain, head, couch, clarity, duration, functionality, anxiety },
   *  note?
   * }
   */
  logActuals: (session) => {
    const entry = {
      sessionId: session?.sessionId || makeId("sess"),
      date: session?.date || new Date().toISOString().slice(0, 10),
      profileName: get().profileName,
      ...session,
    };

    set((state) => ({
      sessionLog: [entry, ...state.sessionLog],
      lastError: null,
    }));
  },

  /**
   * Alias for logActuals (kept because your requirement lists both).
   */
  saveSession: (session) => {
    get().logActuals(session);
  },

  /**
   * Import calibration/session log data.
   * Supports:
   * - JSON string
   * - Parsed object { sessionLog: [...] } or [...]
   */
  importLog: (payload) => {
    try {
      let data = payload;

      if (typeof payload === "string") {
        data = JSON.parse(payload);
      }

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.sessionLog)
          ? data.sessionLog
          : null;

      if (!list) {
        set({ lastError: "Import failed: expected JSON array or { sessionLog: [...] }." });
        return;
      }

      set((state) => ({
        sessionLog: [...list, ...state.sessionLog],
        lastError: null,
      }));
    } catch (err) {
      console.error(err);
      set({ lastError: `Import failed: ${err?.message || String(err)}` });
    }
  },

  /**
   * Export session log as a downloadable JSON file.
   * Returns string JSON as well (useful for debugging/tests).
   */
  exportLog: () => {
    const state = get();
    const payload = {
      exportedAt: new Date().toISOString(),
      profileName: state.profileName,
      scoreMode: state.scoreMode,
      scoreSource: state.scoreSource,
      sessionLog: state.sessionLog,
    };

    const json = JSON.stringify(payload, null, 2);

    try {
      // Browser download
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mmet_session_log_${state.profileName || "default"}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      set({ lastError: null });
    } catch (err) {
      console.error(err);
      set({ lastError: `Export failed: ${err?.message || String(err)}` });
    }

    return json;
  },

  /**
   * Convenience getter (not required but useful):
   * returns top6 for a product id using normalized terp list.
   */
  getTop6ForProduct: (productId) => {
    const p = get().products.find((x) => x.id === productId);
    if (!p) return [];
    return getTop6Terpenes(p.terpenes || []);
  },

  // Settings setters (useful later)
  setProfileName: (profileName) => set({ profileName: profileName || "Default" }),
  setScoreMode: (scoreMode) => set({ scoreMode }),
  setScoreSource: (scoreSource) => set({ scoreSource }),
}));
