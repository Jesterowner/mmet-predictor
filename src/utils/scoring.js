// src/utils/scoring.js - Cannabis Effect Prediction Model v1.0
// WITH SMART PERSONALIZATION (learns user patterns across all products)

export const DIMS = ["pain", "head", "couch", "clarity", "duration", "functionality", "anxiety"];

const BAND_THRESHOLDS = {
  PRIMARY: 0.80,
  DOMINANT: 0.30,
  SUPPORTING: 0.10,
};

function getTerpeneBand(pct) {
  if (pct >= BAND_THRESHOLDS.PRIMARY) return 'primary';
  if (pct >= BAND_THRESHOLDS.DOMINANT) return 'dominant';
  if (pct >= BAND_THRESHOLDS.SUPPORTING) return 'supporting';
  return 'trace';
}

const TERPENE_EFFECTS = {
  myrcene: {
    primary:   { couch: +2, pain: +1.0, clarity: -1, duration: +1 },
    dominant:  { couch: +1, pain: +0.5, clarity: -0.5, duration: +0.5 },
  },
  caryophyllene: {
    primary:   { pain: +1.5, anxiety: -1, couch: +0.5 },
    dominant:  { pain: +0.5, anxiety: -0.5 },
  },
  limonene: {
    primary:   { head: +1.5, anxiety: +1.5 },
    dominant:  { head: +1, anxiety: +1 },
  },
  pinene: {
    primary:   { clarity: +1.5, functionality: +1, couch: -1 },
    dominant:  { clarity: +1, functionality: +0.5, couch: -0.5 },
  },
  linalool: {
    primary:   { anxiety: -1, couch: +0.5, head: -0.5 },
    dominant:  { anxiety: -0.5, couch: +0.5, head: -0.5 },
  },
  humulene: {
    primary:   { pain: +1.0, duration: +1 },
    dominant:  { pain: +0.5, duration: +0.5 },
  },
  bisabolol: {
    primary:   { anxiety: -1, clarity: +0.5 },
    dominant:  { anxiety: -0.5 },
  },
  ocimene: {
    primary:   { head: +1, couch: -0.5 },
    dominant:  { head: +0.5, couch: -0.5 },
  },
  terpinolene: {
    primary:   { head: +1.5, anxiety: +1, clarity: -1 },
    dominant:  { head: +1, anxiety: +0.5, clarity: -0.5 },
  },
};

function getBaseline(thc, form) {
  const scores = {};
  
  if (thc >= 70) {
    scores.pain = 2;
    scores.head = 3;
    scores.couch = 2;
    scores.clarity = 3;
    scores.duration = 3;
    scores.functionality = 3;
    scores.anxiety = 2;
  }
  else if (thc >= 50) {
    scores.pain = 1;
    scores.head = 2.5;
    scores.couch = 2;
    scores.clarity = 3;
    scores.duration = 2.5;
    scores.functionality = 3;
    scores.anxiety = 2;
  }
  else {
    scores.pain = 0.5;
    scores.head = 2;
    scores.couch = 1;
    scores.clarity = 3;
    scores.duration = 2;
    scores.functionality = 3.5;
    scores.anxiety = 2;
  }
  
  const formLower = (form || '').toLowerCase();
  if (formLower.includes('badder') || formLower.includes('wax') || 
      formLower.includes('shatter') || formLower.includes('sugar') ||
      formLower.includes('sauce') || formLower.includes('diamond') ||
      formLower.includes('resin') || formLower.includes('rosin')) {
    scores.head += 0.5;
    scores.duration += 0.5;
    scores.functionality -= 0.5;
  }
  
  return scores;
}

function applyTerpeneEffects(scores, terpenes, thc) {
  const deltas = {
    pain: 0, head: 0, couch: 0, clarity: 0, 
    duration: 0, functionality: 0, anxiety: 0
  };
  
  for (const terp of terpenes) {
    const name = terp.name.toLowerCase();
    const pct = terp.pct;
    const band = getTerpeneBand(pct);
    
    if (band === 'supporting' || band === 'trace') continue;
    
    const effects = TERPENE_EFFECTS[name];
    if (!effects) continue;
    
    const bandEffects = effects[band];
    if (!bandEffects) continue;
    
    if (name === 'terpinolene' && thc <= 70) continue;
    
    for (const [dim, delta] of Object.entries(bandEffects)) {
      deltas[dim] += delta;
    }
  }
  
  const final = {};
  for (const dim of DIMS) {
    final[dim] = scores[dim] + deltas[dim];
  }
  
  return final;
}

function softCap(value, cap = 5, knee = 4) {
  if (value <= knee) return value;
  const excess = value - knee;
  const range = cap - knee;
  // Diminishing returns after the knee (smooth, monotonic, never exceeds cap)
  return knee + range * (1 - Math.exp(-excess / range));
}

function roundAndClamp(scores, thc, terpenes) {
  const output = {};
  
  for (const dim of DIMS) {
    let val = scores[dim];
    if (dim === "pain") val = softCap(val, 5, 4);
    val = Math.round(val * 2) / 2;
    val = Math.max(0, Math.min(5, val));
    output[dim] = val;
  }
  
  if (thc > 70) {
    const hasLimonene = terpenes.some(t => 
      t.name.toLowerCase() === 'limonene' && t.pct >= BAND_THRESHOLDS.DOMINANT
    );
    if (hasLimonene && output.anxiety < 2) {
      output.anxiety = 2;
    }
  }
  
  return output;
}

export function calculateBaselineScores(product) {
  const thc = product.metrics?.totalTHC || 0;
  const form = product.form || '';
  const terpenes = product.top6 || [];
  
  const baseline = getBaseline(thc, form);
  const withTerpenes = applyTerpeneEffects(baseline, terpenes, thc);
  const final = roundAndClamp(withTerpenes, thc, terpenes);
  
  return final;
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
      
      if (actualValue == null || typeof actualValue !== 'number') continue;
      
      // Find the product to get its baseline prediction
      const product = allProducts.find(p => p.id === productId);
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
