// src/utils/mmetBaselineFormulas.js
// MMET Baseline Engine (THC-primary + form shaping + terp modifiers + anxiety rules)
//
// Design goals:
// - THC is primary driver (65%), Terpenes (25%), Form (10% direct + shaping).
// - No strain needed.
// - Avoid saturation (no "everything becomes 5").
// - Forms must feel different (flower vs vape vs concentrate vs edible).
//
// Special rules preserved:
//   * Myrcene > 0.5% => couch-lock boost
//   * Limonene > 0.3% => reduces anxiety risk
//   * Terpinolene > 0.3% => increases anxiety risk
//   * Low terpene retention (<50%) => increases anxiety risk
//
// Inputs expected:
// {
//   totalTHC: number (percent, e.g. 74.8),
//   totalTerpenes: number (percent, e.g. 5.86),
//   form: string,
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

// NOTE: THC bands were originally "flower-like" ranges.
// We keep them for anxiety baseline behavior, but we DO NOT let form "intensity"
// multiply effects into saturation anymore.
export const THC_BANDS = [
  { key: "micro", min: 0, max: 10, label: "Micro", anxietyRisk: 0.15, potency: 0.20 },
  { key: "low", min: 10, max: 15, label: "Low", anxietyRisk: 0.25, potency: 0.35 },
  { key: "medium", min: 15, max: 20, label: "Medium", anxietyRisk: 0.40, potency: 0.50 },
  { key: "high", min: 20, max: 25, label: "High", anxietyRisk: 0.55, potency: 0.65 },
  { key: "very_high", min: 25, max: 35, label: "Very High", anxietyRisk: 0.70, potency: 0.80 },
  { key: "extreme", min: 35, max: Infinity, label: "Extreme", anxietyRisk: 0.85, potency: 0.95 },
];

// Form modifiers (tuned to avoid pegged outputs and to differentiate forms)
export const FORM_MODIFIERS = {
  edible: {
    key: "edible",
    // edibles feel strong, but not "everything=5"
    intensityMod: 1.25,
    durationMod: 3.2,
    anxietyRiskAdd: 0.18,
    terpeneRetention: 0.25,
    onsetMinutes: 60,
    baseDurationHours: 6,
  },
  vape: {
    key: "vape",
    // carts hit fast, less "full-spectrum" than flower/live resin
    intensityMod: 1.15,
    durationMod: 1.25,
    anxietyRiskAdd: 0.12,
    terpeneRetention: 0.55,
    onsetMinutes: 4,
    baseDurationHours: 2,
  },
  concentrate: {
    key: "concentrate",
    // strong but avoid saturation
    intensityMod: 1.35,
    durationMod: 1.35,
    anxietyRiskAdd: 0.16,
    terpeneRetention: 0.45,
    onsetMinutes: 5,
    baseDurationHours: 2,
  },
  live_resin: {
    key: "live_resin",
    // usually more terp-rich and balanced than generic concentrate
    intensityMod: 1.25,
    durationMod: 1.35,
    anxietyRiskAdd: 0.10,
    terpeneRetention: 0.80,
    onsetMinutes: 5,
    baseDurationHours: 2,
  },
  flower: {
    key: "flower",
    intensityMod: 1.0,
    durationMod: 1.0,
    anxietyRiskAdd: 0.0,
    terpeneRetention: 0.95,
    onsetMinutes: 8,
    baseDurationHours: 2,
  },
  topical: {
    key: "topical",
    intensityMod: 0.0,
    durationMod: 0.0,
    anxietyRiskAdd: 0.0,
    terpeneRetention: 1.0,
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

  // Edible / ingestible
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

  // Vape / cart
  if (
    s.includes("vape") ||
    s.includes("cart") ||
    s.includes("cartridge") ||
    s.includes("distillate") ||
    s.includes("pod")
  ) {
    return "vape";
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
    s.includes("diamonds")
  ) {
    return "concentrate";
  }

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
// head: cerebral uplift/mental stimulation
// clarity: clear-headedness
// sedation: calming/sedating
// couch: body heaviness/couch-lock tendency
// pain: analgesic/body relief
function thcBaseVector(potency) {
  // IMPORTANT: prior version made head too high at high potency.
  const p = clamp01(potency);
  return {
    head: clamp01(0.18 + 0.50 * p),      // was 0.25 + 0.65*p (too high)
    clarity: clamp01(0.86 - 0.46 * p),   // soften the drop
    sedation: clamp01(0.08 + 0.55 * p),  // was 0.10 + 0.70*p (too high)
    couch: clamp01(0.05 + 0.45 * p),     // was 0.05 + 0.55*p
    pain: clamp01(0.18 + 0.40 * p),      // was 0.20 + 0.45*p
  };
}

// Apply terps as modifiers (still scaled by total terps)
function applyTerpModifiers(vec, terpMap, totalTerpenesPct) {
  const out = { ...vec };

  const get = (...keys) => {
    for (const k of keys) if (terpMap.has(k)) return terpMap.get(k);
    return 0;
  };

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
  const terpStrength = clamp01(num(totalTerpenesPct, 0) / 10); // 10% -> 1

  if (caryo > 0) {
    out.pain = clamp01(out.pain + 0.10 * terpStrength + 0.06 * clamp01(caryo / 3));
    out.sedation = clamp01(out.sedation + 0.04 * terpStrength);
    out.couch = clamp01(out.couch + 0.03 * terpStrength);
  }

  if (linalool > 0) {
    out.sedation = clamp01(out.sedation + 0.10 * terpStrength + 0.06 * clamp01(linalool / 1.5));
    out.clarity = clamp01(out.clarity - 0.03 * terpStrength);
    out.couch = clamp01(out.couch + 0.04 * terpStrength);
  }

  if (limonene > 0) {
    out.head = clamp01(out.head + 0.07 * terpStrength + 0.05 * clamp01(limonene / 1.2));
    out.clarity = clamp01(out.clarity + 0.07 * terpStrength);
    out.sedation = clamp01(out.sedation - 0.03 * terpStrength);
  }

  if (myrcene > 0) {
    out.sedation = clamp01(out.sedation + 0.08 * terpStrength + 0.04 * clamp01(myrcene / 1.5));
    out.couch = clamp01(out.couch + 0.10 * terpStrength + 0.05 * clamp01(myrcene / 1.5));
    out.clarity = clamp01(out.clarity - 0.05 * terpStrength);
  }

  if (humulene > 0) {
    out.pain = clamp01(out.pain + 0.05 * terpStrength);
    out.sedation = clamp01(out.sedation + 0.02 * terpStrength);
  }

  if (bisabolol > 0) {
    out.pain = clamp01(out.pain + 0.04 * terpStrength);
    out.sedation = clamp01(out.sedation + 0.03 * terpStrength);
  }

  if (terpinolene > 0) {
    out.head = clamp01(out.head + 0.06 * terpStrength);
    out.clarity = clamp01(out.clarity - 0.03 * terpStrength);
  }

  if (pinene > 0) {
    out.clarity = clamp01(out.clarity + 0.07 * terpStrength);
    out.sedation = clamp01(out.sedation - 0.03 * terpStrength);
  }

  if (ocimene > 0) {
    out.head = clamp01(out.head + 0.03 * terpStrength);
  }

  return out;
}

function formDirectVector(formKey) {
  // Conservative direct contribution (the 10% "Form" weight).
  const f = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.flower;

  if (f.intensityMod === 0) {
    return { head: 0, clarity: 0, sedation: 0, couch: 0, pain: 0 };
  }

  // Small bias by form — NOT huge.
  if (formKey === "edible") {
    return { head: 0.08, clarity: 0.06, sedation: 0.14, couch: 0.12, pain: 0.10 };
  }
  if (formKey === "vape") {
    return { head: 0.12, clarity: 0.10, sedation: 0.08, couch: 0.08, pain: 0.08 };
  }
  if (formKey === "live_resin") {
    return { head: 0.10, clarity: 0.10, sedation: 0.10, couch: 0.10, pain: 0.10 };
  }
  if (formKey === "concentrate") {
    return { head: 0.10, clarity: 0.06, sedation: 0.14, couch: 0.12, pain: 0.10 };
  }
  return { head: 0.08, clarity: 0.12, sedation: 0.08, couch: 0.08, pain: 0.10 };
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

// NEW: gentle intensity shaping (NO saturation)
function applyIntensityShaping(vec, intensity) {
  const i = Math.max(0, num(intensity, 1) - 1); // 0..(some)
  if (i <= 0) return vec;

  // head should NOT rocket; sedation/couch/pain should move more.
  return {
    head: clamp01(vec.head + 0.05 * i),
    clarity: clamp01(vec.clarity - 0.10 * i),
    sedation: clamp01(vec.sedation + 0.18 * i),
    couch: clamp01(vec.couch + 0.14 * i),
    pain: clamp01(vec.pain + 0.10 * i),
  };
}

export function calculateBaseline(input) {
  const totalTHC = num(input?.totalTHC, 0);
  const totalTerpenes = num(input?.totalTerpenes, 0);
  const formKey = normalizeFormType(input?.form);
  const terps = Array.isArray(input?.terpenes) ? input.terpenes : [];

  const thcBand = getTHCBand(totalTHC);
  const form = FORM_MODIFIERS[formKey] || FORM_MODIFIERS.flower;

  // THC base + terp modifiers
  const thcVec = thcBaseVector(thcBand.potency);
  const terpMap = buildTerpMap(terps);
  const terpVec = applyTerpModifiers(thcVec, terpMap, totalTerpenes);

  // Blend THC + terps
  const thcTerpBlend = mixWeighted(thcVec, terpVec, 1 - TERP_WEIGHT, TERP_WEIGHT);

  // Form direct vector (10%)
  const formVec = formDirectVector(formKey);
  const baselineVec = mixWeighted(thcTerpBlend, formVec, 1 - FORM_WEIGHT, FORM_WEIGHT);

  // Apply gentle intensity shaping (instead of multiply+clamp)
  const intensity = num(form.intensityMod, 1);
  const scaled =
    intensity === 0
      ? { head: 0, clarity: 0, sedation: 0, couch: 0, pain: 0 }
      : applyIntensityShaping(baselineVec, intensity);

  // Anxiety risk: THC band baseline + form add + terp rules + retention rule
  let anxietyRisk = clamp01(thcBand.anxietyRisk + num(form.anxietyRiskAdd, 0));

  const limonenePct = num(terpMap.get("limonene") || terpMap.get("d-limonene") || 0, 0);
  const terpinolenePct = num(terpMap.get("terpinolene") || 0, 0);
  const myrcenePct = num(terpMap.get("myrcene") || terpMap.get("beta-myrcene") || 0, 0);

  if (limonenePct > 0.3) anxietyRisk = clamp01(anxietyRisk - 0.08);
  if (terpinolenePct > 0.3) anxietyRisk = clamp01(anxietyRisk + 0.08);

  const retention = num(form.terpeneRetention, 0.9);
  if (retention < 0.5) anxietyRisk = clamp01(anxietyRisk * 1.15);

  // Myrcene > 0.5% couch-lock boost (effect, not risk)
  let couch = scaled.couch;
  if (myrcenePct > 0.5) couch = clamp01(couch + 0.12);

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
