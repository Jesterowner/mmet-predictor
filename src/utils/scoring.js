// src/utils/scoring.js - Cannabis Effect Prediction Model v1.0
// WITH SMART PERSONALIZATION (learns user patterns across all products)
//
// UPDATED: Baseline now uses the Advanced Baseline Engine (mmetBaselineFormulas)
// - No strain needed
// - Uses full terp list (product.terpenes) + totalTerpenes + form + THC
// - Outputs your UI dims (0..5, rounded to 0.5)
//
// FIX (this commit): stop “Head Effect = 5.0 on everything”
// - Advanced engine returns 0..1 signals that can cluster high for potent concentrates
// - We now:
//   1) derive HEAD from a balance of head + clarity minus sedation/couch
//   2) apply per-dimension scaling (lo/hi) + gamma curve so values don’t peg at 5
//   3) rescale anxietyRisk so it doesn’t default to max for high-THC concentrates

import { calculateBaseline as calculateAdvancedBaseline } from "./mmetBaselineFormulas";

export const DIMS = ["pain", "head", "couch", "clarity", "duration", "functionality", "anxiety"];

const BAND_THRESHOLDS = {
  PRIMARY: 0.80,
  DOMINANT: 0.30,
  SUPPORTING: 0.10,
};

// Kept for backward compatibility (not used in advanced baseline path anymore)
function getTerpeneBand(pct) {
  if (pct >= BAND_THRESHOLDS.PRIMARY) return "primary";
  if (pct >= BAND_THRESHOLDS.DOMINANT) return "dominant";
  if (pct >= BAND_THRESHOLDS.SUPPORTING) return "supporting";
  return "trace";
}

// Kept for backward compatibility (not used in advanced baseline path anymore)
const TERPENE_EFFECTS = {
  myrcene: {
    primary: { couch: +2, pain: +1.0, clarity: -1, duration: +1 },
    dominant: { couch: +1, pain: +0.5, clarity: -0.5, duration: +0.5 },
  },
  caryophyllene: {
    primary: { pain: +1.5, anxiety: -1, couch: +0.5 },
    dominant: { pain: +0.5, anxiety: -0.5 },
  },
  limonene: {
    primary: { head: +1.5, anxiety: +1.5 },
    dominant: { head: +1, anxiety: +1 },
  },
  pinene: {
    primary: { clarity: +1.5, functionality: +1, couch: -1 },
    dominant: { clarity: +1, functionality: +0.5, couch: -0.5 },
  },
  linalool: {
    primary: { anxiety: -1, couch: +0.5, head: -0.5 },
    dominant: { anxiety: -0.5, couch: +0.5, head: -0.5 },
  },
  humulene: {
    primary: { pain: +1.0, duration: +1 },
    dominant: { pain: +0.5, duration: +0.5 },
  },
  bisabolol: {
    primary: { anxiety: -1, clarity: +0.5 },
    dominant: { anxiety: -0.5 },
  },
  ocimene: {
    primary: { head: +1, couch: -0.5 },
    dominant: { head: +0.5, couch: -0.5 },
  },
  terpinolene: {
    primary: { head: +1.5, anxiety: +1, clarity: -1 },
    dominant: { head: +1, anxiety: +0.5, clarity: -0.5 },
  },
};

// -------- Advanced baseline mapping helpers --------
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const toHalf = (v) => Math.round(v * 2) / 2;

/**
 * Map a 0..1 signal into a 0..5 UI score with:
 * - lo/hi rescale (prevents “everything is high” from pegging)
 * - gamma curve (compresses the high end if gamma > 1)
 */
function toScore5Scaled(x01, { lo = 0, hi = 1, gamma = 1 } = {}) {
  const x = clamp01(Number(x01 || 0));
  const denom = Math.max(1e-9, hi - lo);
  const t = clamp01((x - lo) / denom);
  const curved = Math.pow(t, gamma);
  return toHalf(5 * curved);
}

/**
 * Advanced Baseline -> UI Scores (0..5, rounded to 0.5)
 */
export function calculateBaselineScores(product) {
  const thc = Number(product?.metrics?.totalTHC || 0);
  const totalTerpenes = Number(product?.metrics?.totalTerpenes || 0);

  // Advanced engine should use full terp list, not top6
  const terpenes = Array.isArray(product?.terpenes) ? product.terpenes : [];
  const form = product?.form || "";

  const adv = calculateAdvancedBaseline({
    totalTHC: thc,
    totalTerpenes,
    form,
    terpenes,
  });

  // Normalize raw signals (0..1 expected)
  const headRaw = clamp01(adv?.head);
  const clarityRaw = clamp01(adv?.clarity);
  const sedationRaw = clamp01(adv?.sedation);
  const couchRaw = clamp01(adv?.couch);
  const painRaw = clamp01(adv?.pain);
  const anxietyRaw = clamp01(adv?.anxietyRisk);

  // ---- Key fix: Head Effect should NOT be maxed for most concentrates
  // Head is a balance: “headiness” + clarity minus sedation/couch.
  const head01 = clamp01(
    0.78 * headRaw +
      0.22 * clarityRaw -
      0.28 * sedationRaw -
      0.12 * couchRaw
  );

  // Clarity gets slightly pulled down by sedation (small, not a cliff)
  const clarity01 = clamp01(clarityRaw * (1 - 0.18 * sedationRaw));

  // Couch tracks couch + some sedation reinforcement
  const couch01 = clamp01(couchRaw + 0.18 * sedationRaw);

  // Pain can stay closer to raw (it tends to be less “pegged”)
  const pain01 = clamp01(painRaw);

  // Duration uses metadata hours; map 0..18h => 0..5 (and round to 0.5)
  const durHours = Number(adv?._meta?.durationHours || 0);
  const duration = toHalf(Math.max(0, Math.min(5, (durHours / 18) * 5)));

  // Functionality derived from clarity + inverse sedation/couch
  const functionality01 = clamp01(
    0.60 * clarity01 + 0.40 * (1 - (0.62 * sedationRaw + 0.38 * couch01))
  );

  // Anxiety: rescale so it doesn’t default to “max” at high THC
  // (advanced engine’s anxietyRisk baseline can sit high for concentrates)
  const anxiety01 = clamp01((anxietyRaw - 0.22) / 0.78);

  // ---- Per-dimension scaling tuned to reduce “everything = 5”
  const pain = toScore5Scaled(pain01, { lo: 0.10, hi: 0.80, gamma: 1.10 });
  const head = toScore5Scaled(head01, { lo: 0.15, hi: 0.85, gamma: 1.35 });
  const couch = toScore5Scaled(couch01, { lo: 0.10, hi: 0.88, gamma: 1.25 });
  const clarity = toScore5Scaled(clarity01, { lo: 0.12, hi: 0.88, gamma: 1.05 });
  const functionality = toScore5Scaled(functionality01, { lo: 0.12, hi: 0.90, gamma: 1.10 });
  const anxiety = toScore5Scaled(anxiety01, { lo: 0.00, hi: 1.00, gamma: 1.20 });

  return {
    pain: Math.max(0, Math.min(5, pain)),
    head: Math.max(0, Math.min(5, head)),
    couch: Math.max(0, Math.min(5, couch)),
    clarity: Math.max(0, Math.min(5, clarity)),
    duration: Math.max(0, Math.min(5, duration)),
    functionality: Math.max(0, Math.min(5, functionality)),
    anxiety: Math.max(0, Math.min(5, anxiety)),
  };
}

/**
 * Calculate user's personal calibration factors
 * Learns how user responds compared to baseline predictions
 */
function calculateUserCalibration(sessionLog, allProducts) {
  const calibration = {};

  for (const dim of DIMS) {
    const dataPoints = [];

    // Go through all sessions
    for (const session of sessionLog) {
      const productId = session.productId;
      const actualValue = session.actuals?.[dim];

      if (actualValue == null || typeof actualValue !== "number") continue;

      // Find the product to get its baseline prediction
      const product = (allProducts || []).find((p) => p.id === productId);
      if (!product) continue;

      const baselineScores = calculateBaselineScores(product);
      const predictedValue = baselineScores[dim];

      // Calculate the delta (how much user differs from baseline)
      const delta = actualValue - predictedValue;
      dataPoints.push(delta);
    }

    if (dataPoints.length > 0) {
      // Average delta for this dimension
      const avgDelta = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;

      // Confidence based on number of data points
      const confidence = Math.min(dataPoints.length / 10, 0.8); // Max 80% confidence

      calibration[dim] = {
        adjustment: avgDelta,
        confidence,
        dataPoints: dataPoints.length,
      };
    } else {
      calibration[dim] = {
        adjustment: 0,
        confidence: 0,
        dataPoints: 0,
      };
    }
  }

  return calibration;
}

/**
 * Calculate personalized scores using learned user patterns
 * Applies personal calibration to ALL products, not just rated ones
 */
export function calculatePersonalizedScores(baselineScores, sessionLog, productId, allProducts) {
  if (!sessionLog || sessionLog.length === 0) {
    return baselineScores;
  }

  // Calculate user's personal calibration from ALL their sessions
  const calibration = calculateUserCalibration(sessionLog, allProducts || []);

  const personalizedScores = { ...baselineScores };

  for (const dim of DIMS) {
    const cal = calibration[dim];

    if (cal && cal.confidence > 0) {
      // Apply the learned adjustment weighted by confidence
      const adjustment = cal.adjustment * cal.confidence;
      personalizedScores[dim] = baselineScores[dim] + adjustment;

      // Round to 0.5
      personalizedScores[dim] = Math.round(personalizedScores[dim] * 2) / 2;

      // Clamp to 0-5
      personalizedScores[dim] = Math.max(0, Math.min(5, personalizedScores[dim]));
    }
  }

  return personalizedScores;
}
