// src/utils/mmetBaselineFormulas.js
// MMET Baseline Engine (THC-primary + form multipliers + terp modifiers + anxiety rules)
//
// Design goals:
// - Never touch PDF parsing. This module consumes already-parsed product fields.
// - THC is primary driver (65%), Terpenes (25%), Form (10% direct + multipliers).
// - Special rules preserved:
//   * Myrcene > 0.5% => couch-lock boost
//   * Limonene > 0.3% => reduces anxiety risk
//   * Terpinolene > 0.3% => increases anxiety risk
//   * Low terpene retention (<50%) => increases anxiety risk
//
// Inputs expected:
// {
//   totalTHC: number (percent, e.g. 74.8),
//   totalTerpenes: number (percent, e.g. 5.86),
//   form: string (raw or normalized),
//   terpenes: [{ name: string, pct: number }]  // pct in percent units (e.g. 2.14)
// }

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export const THC_WEIGHT = 0.65;
export const TERP_WEIGHT = 0.25;
export const FORM_WEIGHT = 0.10;

// Anxiety risk by THC potency band (per your spec)
export const THC_BANDS = [
  { key: "micro", min: 0, max: 10, label: "Micro", anxietyRisk: 0.15, potency: 0.20 },
  { key: "low", min: 10, max: 15, label: "Low", anxietyRisk: 0.25, potency: 0.35 },
  { key: "medium", min: 15, max: 20, label: "Medium", anxietyRisk: 0.40, potency: 0.50 },
  { key: "high", min: 20, max: 25, label: "High", anxietyRisk: 0.55, potency: 0.65 },
  { key: "very_high", min: 25, max: 35, label: "Very High", anxietyRisk: 0.70, potency: 0.80 },
  { key: "extreme", min: 35, max: Infinity, label: "Extreme", anxietyRisk: 0.85, potency: 0.95 },
];

/**
 * IMPORTANT TUNING NOTES (Fix for "Head Effect pegged at 5"):
 * - Your old intensityMod values (2.0–2.5) caused head/couch/anxiety to clamp at 1.0
 * - These values are intentionally more realistic and allow terp profile to matter.
 * - Edibles get LONG duration + heavier sedation/couch via form vector and duration metadata,
 *   not by cranking intensityMod to 2.5.
 */
export const FORM_MODIFIERS = {
  edible: {
    key: "edible",
    intensityMod: 1.25,
    durationMod: 1.40,
    anxietyRiskAdd: 0.12,
    terpeneRetention: 0.25,
    onsetMinutes: 60,
    baseDurationHours: 6,
  },
  concentrate: {
    key: "concentrate",
    intensityMod: 1.35,
    durationMod: 1.00,
    anxietyRiskAdd: 0.06,
    terpeneRetention: 0.70,
    onsetMinutes: 5,
    baseDurationHours: 2,
  },
  live_resin: {
    key: "live_resin",
    intensityMod: 1.30,
    durationMod: 1.00,
    anxietyRiskAdd: 0.04,
    terpeneRetention: 0.85,
    onsetMinutes: 5,
    baseDurationHours: 2,
  },
  flower: {
    key: "flower",
    intensityMod: 1.00,
    durationMod: 1.00,
    anxietyRiskAdd: 0.00,
    terpeneRetention: 0.95,
    onsetMinutes: 8,
    baseDurationHours: 2,
  },
  topical: {
    key: "topical",
    intensityMod: 0.00,
    durationMod: 0.00,
    anxietyRiskAdd: 0.00,
    terpeneRetention: 1.00,
    onsetMinutes: 0,
    baseDurationHours: 0,
  },
};

export function normalizeFormType(raw) {
  const s = String(raw || "").toLowerCase();

  if (!s) return "flower";

  // Topical
  if (s.includes("topical") || s.includes("salve") || s.includes("cream") || s.includes("lotion")) {
    return "topical";
  }

  // Edible
  if (
    s.includes("edible") ||
    s.includes("gummy") ||
    s.includes("cookie") ||
    s.includes("brownie") ||
    s.includes("chocolate") ||
    s.includes("capsule") ||
    s.includes("tincture") ||
    s.includes("drink") ||
    s.includes("beverage")
  ) {
    return "edible";
  }

  // Live Resin / Live product forms
  if (
    s.includes("live") &&
    (s.includes("resin") || s.includes("badder") || s.includes("sugar") || s.includes("sauce") || s.includes("diamonds"))
  ) {
    return "live_resin";
  }
  if (s.includes("live resin")) return "live_resin";

  // Concentrates (wax, shatter, rosin, crumble, badder, etc.)
  if (
    s.includes("concentrate") ||
    s.includes("wax") ||
    s.includes("shatter") ||
    s.includes("rosin") ||
    s.includes("crumble") ||
    s.includes("badder") ||
    s.includes("sugar") ||
    s.includes("sauce") ||
    s.includes("diamonds") ||
    s.includes("distillate")
  ) {
    return "concentrate";
  }

  // Flower
  return "flower";
}

export function getTHCBand(thcPct) {
  const t = num(thcPct, 0);
  for (const b of THC_BANDS) {
    if (t >= b.min && t < b.max) return b;
  }
  return THC_BANDS[0];
}

function normalizeTerpName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/β/g, "beta")
    .replace(/α/g, "alpha")
    .replace(/\s+/g, " ")
    .trim();
}

function buildTerpMap(terpenes) {
  const map = new Map();
  (terpenes || []).forEach((t) => {
    const n = normalizeTerpName(t?.name);
    const pct = num(t?.pct, 0);
    if (!n) return;
    map.set(n, (map.get(n) || 0) + pct);
  });
  return map;
}

// Baseline effect dimensions (0..1):
// - head: cerebral uplift/mental stimulation
// - clarity: clear-headedness (opposite of fogginess)
// - sedation: calming/sedating
// - couch: body heaviness/couch-lock tendency
// - pain: analgesic / body relief
//
// anxietyRisk is separate (0..1, higher = worse).
function thcBaseVector(potency) {
  // potency: 0..1
  const p = clamp01(potency);

  // TUNING: reduce head aggressiveness so high-THC doesn’t automatically mean "max head high"
  // while keeping sedation/couch meaningful at higher potency.
  return {
    head: clamp01(0.18 + 0.52 * p),
    clarity: clamp01(0.88 - 0.58 * p),
    sedation: clamp01(0.10 + 0.72 * p),
    couch: clamp01(0.06 + 0.56 * p),
    pain: clamp01(0.22 + 0.46 * p),
  };
}

function applyTerpModifiers(vec, terpMap, totalTerpenesPct) {
  const out = { ...vec };

  const get = (...keys) => {
    for (const k of keys) {
      if (terpMap.has(k)) return terpMap.get(k);
    }
    return 0;
  };

  // Common terps
  const caryo = get("beta-caryophyllene", "beta caryophyllene", "caryophyllene");
  const linalool = get("linalool");
  const limonene = get("d-limonene", "limonene");
  const myrcene = get("myrcene", "beta-myrcene", "β-myrcene");
  const humulene = get("alpha-humulene", "humulene");
  const bisabolol = get("alpha-bisabolol", "bisabolol");
  const terpinolene = get("terpinolene");
  const pinene = get("alpha-pinene", "beta-pinene", "pinene");
  const ocimene = get("ocimene", "ocimenes");

  // Scale terp effect strength by total terpenes (softly)
  const terpStrength = clamp01(num(totalTerpenesPct, 0) / 10); // 0..1-ish, 10% terps -> 1

  // beta-caryophyllene: pain relief + body calm
  if (caryo > 0) {
    out.pain = clamp01(out.pain + 0.10 * terpStrength + 0.06 * clamp01(caryo / 3));
    out.sedation = clamp01(out.sedation + 0.04 * terpStrength);
    out.couch = clamp01(out.couch + 0.03 * terpStrength);
    out.head = clamp01(out.head - 0.02 * terpStrength); // slightly less "heady" when body-forward
  }

  // linalool: sedation + sleep support
  if (linalool > 0) {
    out.sedation = clamp01(out.sedation + 0.10 * terpStrength + 0.06 * clamp01(linalool / 1.5));
    out.clarity = clamp01(out.clarity - 0.04 * terpStrength);
    out.couch = clamp01(out.couch + 0.05 * terpStrength);
    out.head = clamp01(out.head - 0.04 * terpStrength);
  }

  // limonene: uplift + clarity
  if (limonene > 0) {
    out.head = clamp01(out.head + 0.08 * terpStrength + 0.05 * clamp01(limonene / 1.2));
    out.clarity = clamp01(out.clarity + 0.07 * terpStrength);
    out.sedation = clamp01(out.sedation - 0.03 * terpStrength);
  }

  // myrcene: body heaviness / sedation; special couch-lock rule handled outside
  if (myrcene > 0) {
    out.sedation = clamp01(out.sedation + 0.08 * terpStrength + 0.04 * clamp01(myrcene / 1.5));
    out.couch = clamp01(out.couch + 0.10 * terpStrength + 0.05 * clamp01(myrcene / 1.5));
    out.clarity = clamp01(out.clarity - 0.06 * terpStrength);
    out.head = clamp01(out.head - 0.05 * terpStrength);
  }

  // humulene: supporting body relief
  if (humulene > 0) {
    out.pain = clamp01(out.pain + 0.05 * terpStrength);
    out.sedation = clamp01(out.sedation + 0.02 * terpStrength);
  }

  // bisabolol: calm + body relief
  if (bisabolol > 0) {
    out.pain = clamp01(out.pain + 0.04 * terpStrength);
    out.sedation = clamp01(out.sedation + 0.03 * terpStrength);
    out.head = clamp01(out.head - 0.02 * terpStrength);
  }

  // terpinolene: often more “heady”
  if (terpinolene > 0) {
    out.head = clamp01(out.head + 0.07 * terpStrength);
    out.clarity = clamp01(out.clarity - 0.03 * terpStrength);
  }

  // pinene: clarity/focus leaning
  if (pinene > 0) {
    out.clarity = clamp01(out.clarity + 0.07 * terpStrength);
    out.sedation = clamp01(out.sedation - 0.03 * terpStrength);
    out.head = clamp01(out.head + 0.02 * terpStrength);
  }

  // ocimene: lightly uplifting
  if (ocimene > 0) {
    out.head = clamp01(out.head + 0.03 * terpStrength);
  }

  return out;
}

function formDirectVector(formKey) {
  // Direct effect contribution (the 10% "Form" weight).
  // Keeps it conservative—multipliers do the heavy lifting.
  const f = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.flower;

  // Topical: no high
  if (f.intensityMod === 0) {
    return { head: 0, clarity: 0, sedation: 0, couch: 0, pain: 0 };
  }

  // Higher intensity tends to increase sedation/couch and reduce clarity.
  const intensityLift = clamp01((f.intensityMod - 1) / 2); // 0..~0.25 with tuned mods

  let vec = {
    head: clamp01(0.10 + 0.12 * intensityLift),
    clarity: clamp01(0.12 - 0.10 * intensityLift),
    sedation: clamp01(0.10 + 0.22 * intensityLift),
    couch: clamp01(0.08 + 0.18 * intensityLift),
    pain: clamp01(0.10 + 0.18 * intensityLift),
  };

  // ✅ FORM SHAPING (this is what you asked for):
  // Edibles: not a spiky head high; heavier body + lower clarity, long duration handled in meta
  if (formKey === "edible") {
    vec.head = clamp01(vec.head * 0.70);
    vec.sedation = clamp01(vec.sedation + 0.18);
    vec.couch = clamp01(vec.couch + 0.18);
    vec.clarity = clamp01(vec.clarity * 0.70);
  }

  // Concentrates: more intensity / body weight, but DO NOT force head to max
  if (formKey === "concentrate" || formKey === "live_resin") {
    vec.sedation = clamp01(vec.sedation + 0.06);
    vec.couch = clamp01(vec.couch + 0.05);
    vec.head = clamp01(vec.head + 0.03);
  }

  return vec;
}

function mixWeighted(a, b, wA, wB) {
  return {
    head: clamp01(a.head * wA + b.head * wB),
    clarity: clamp01(a.clarity * wA + b.clarity * wB),
    sedation: clamp01(a.sedation * wA + b.sedation * wB),
    couch: clamp01(a.couch * wA + b.couch * wB),
    pain: clamp01(a.pain * wA + b.pain * wB),
  };
}

export function calculateBaseline(input) {
  const totalTHC = num(input?.totalTHC, 0);
  const totalTerpenes = num(input?.totalTerpenes, 0);
  const formKey = normalizeFormType(input?.form);
  const terps = Array.isArray(input?.terpenes) ? input.terpenes : [];

  const thcBand = getTHCBand(totalTHC);
  const form = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.flower;

  // THC base vector + terp modifiers
  const thcVec = thcBaseVector(thcBand.potency);
  const terpMap = buildTerpMap(terps);
  const terpVec = applyTerpModifiers(thcVec, terpMap, totalTerpenes);

  // Blend THC + terps (THC primary; terps are modifiers)
  const thcTerpBlend = mixWeighted(thcVec, terpVec, 1 - TERP_WEIGHT, TERP_WEIGHT);

  // Form direct vector (10% weight)
  const formVec = formDirectVector(formKey);
  const baselineVec = mixWeighted(thcTerpBlend, formVec, 1 - FORM_WEIGHT, FORM_WEIGHT);

  // Apply intensity multiplier to “felt” effects (but keep topical at 0)
  const intensity = num(form.intensityMod, 1);

  // TUNING: do NOT scale head as aggressively as sedation/couch
  const headScale = 0.92 + 0.12 * intensity;      // ~1.04 max at intensity=1.0, ~1.08 at 1.35
  const sedScale = 0.85 + 0.30 * intensity;       // stronger
  const couchScale = 0.85 + 0.30 * intensity;     // stronger
  const painScale = 0.90 + 0.20 * intensity;

  const scaled =
    intensity === 0
      ? { head: 0, clarity: 0, sedation: 0, couch: 0, pain: 0 }
      : {
          head: clamp01(baselineVec.head * headScale),
          clarity: clamp01(baselineVec.clarity * (1.0 - 0.12 * (intensity - 1))),
          sedation: clamp01(baselineVec.sedation * sedScale),
          couch: clamp01(baselineVec.couch * couchScale),
          pain: clamp01(baselineVec.pain * painScale),
        };

  // Anxiety risk: THC band baseline + form add + terp rules + retention rule
  let anxietyRisk = clamp01(thcBand.anxietyRisk + num(form.anxietyRiskAdd, 0));

  const limonenePct = num(terpMap.get("limonene") || terpMap.get("d-limonene") || 0, 0);
  const terpinolenePct = num(terpMap.get("terpinolene") || 0, 0);
  const myrcenePct = num(terpMap.get("myrcene") || terpMap.get("beta-myrcene") || 0, 0);

  // Limonene > 0.3% reduces anxiety risk
  if (limonenePct > 0.3) anxietyRisk = clamp01(anxietyRisk - 0.08);

  // Terpinolene > 0.3% increases anxiety risk
  if (terpinolenePct > 0.3) anxietyRisk = clamp01(anxietyRisk + 0.08);

  // Low terpene retention (<50%) increases anxiety risk
  const retention = num(form.terpeneRetention, 0.9);
  if (retention < 0.5) anxietyRisk = clamp01(anxietyRisk * 1.15);

  // Myrcene > 0.5% couch-lock boost (effect, not risk)
  let couch = scaled.couch;
  if (myrcenePct > 0.5) couch = clamp01(couch + 0.12);

  // Duration / onset metadata
  const durationHours = num(form.baseDurationHours, 2) * num(form.durationMod, 1);
  const onsetMinutes = num(form.onsetMinutes, 10);

  return {
    head: scaled.head,
    clarity: scaled.clarity,
    sedation: scaled.sedation,
    couch,
    pain: scaled.pain,
    anxietyRisk,
    _meta: {
      thcPct: totalTHC,
      thcBand: thcBand.label,
      form: form.key,
      intensityMod: intensity,
      durationHours,
      onsetMinutes,
      terpeneRetention: retention,
      totalTerpenesPct: totalTerpenes,
    },
  };
}

// Convenience default export
const baselineEngine = {
  THC_WEIGHT,
  TERP_WEIGHT,
  FORM_WEIGHT,
  THC_BANDS,
  FORM_MODIFIERS,
  normalizeFormType,
  getTHCBand,
  calculateBaseline,
};

export default baselineEngine;
