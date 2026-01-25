// src/utils/scoring.js - Cannabis Effect Prediction Model v1.0
// WITH SMART PERSONALIZATION (learns user patterns across all products)
//
// UPDATED: Baseline now uses the Advanced Baseline Engine (mmetBaselineFormulas)
// - No strain needed
// - Uses full terp list (product.terpenes) + totalTerpenes + form + THC
// - Outputs your UI dims (0..5, rounded to 0.5)

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
const toScore5 = (x01) => toHalf(clamp01(x01) * 5);

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
    totalTerpenes: totalTerpenes,
    form,
    terpenes,
  });

  // Direct mappings from advanced engine (0..1)
  const pain = toScore5(adv.pain);
  const head = toScore5(adv.head);
  const couch = toScore5(adv.couch);
  const clarity = toScore5(adv.clarity);

  // Duration uses metadata hours; map 0..18h => 0..5
  const durHours = Number(adv?._meta?.durationHours || 0);
  const duration = toHalf(Math.max(0, Math.min(5, (durHours / 18) * 5)));

  // Functionality derived from clarity + inverse sedation/couch
  const sedation = clamp01(Number(adv.sedation || 0));
  const couch01 = clamp01(Number(adv.couch || 0));
  const clarity01 = clamp01(Number(adv.clarity || 0));
  const functionality01 = clamp01(
    0.55 * clarity01 + 0.45 * (1 - (0.6 * sedation + 0.4 * couch01))
  );
  const functionality = toScore5(functionality01);

  // Anxiety: advanced anxietyRisk is 0..1 (higher = worse)
  const anxiety = toScore5(Number(adv.anxietyRisk || 0));

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
        confidence: confidence,
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
