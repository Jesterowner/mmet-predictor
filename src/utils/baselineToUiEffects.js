const clamp01 = (x) => Math.max(0, Math.min(1, x));
const to5 = (x) => Math.round(clamp01(x) * 50) / 10; // 0.0–5.0 (1 decimal)

/**
 * Converts baseline engine output into UI effect scores.
 * baseline.anxietyRisk is "risk" (higher = worse).
 * UI "Anxiety" is "relief" (higher = better), so we invert it.
 */
export function baselineToUiEffects(baseline) {
  const pain = clamp01(baseline?.pain ?? 0);
  const sedation = clamp01(baseline?.sedation ?? 0);
  const couch = clamp01(baseline?.couch ?? 0);
  const head = clamp01(baseline?.head ?? 0);
  const clarity = clamp01(baseline?.clarity ?? 0);
  const anxietyRisk = clamp01(baseline?.anxietyRisk ?? 0);

  const anxietyRelief = clamp01(1 - anxietyRisk);

  const energy = clamp01((0.55 * head) + (0.35 * clarity) - (0.55 * sedation) - (0.35 * couch));
  const focus = clamp01((0.70 * clarity) + (0.40 * anxietyRelief) - (0.35 * head) - (0.25 * sedation));
  const mood = clamp01((0.65 * head) + (0.55 * anxietyRelief) - (0.15 * sedation));
  const relax = clamp01((0.60 * sedation) + (0.55 * couch) + (0.30 * anxietyRelief));
  const sleep = clamp01((0.75 * sedation) + (0.65 * couch) + (0.15 * anxietyRelief));

  return {
    Energy: to5(energy),
    Focus: to5(focus),
    Mood: to5(mood),
    Relax: to5(relax),
    Sleep: to5(sleep),
    Pain: to5(pain),
    Anxiety: to5(anxietyRelief),
    _risk: { anxietyRisk: Math.round(anxietyRisk * 100) },
    _meta: baseline?._meta || {},
  };
}
