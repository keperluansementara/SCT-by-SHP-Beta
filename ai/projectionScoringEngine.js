// ==========================================
// AI LAYER — projectionScoringEngine.js
// ==========================================
// Source: index.html lines 10201–10284
// Extracted: AI Cluster Extraction
//
// Dependencies: TrendPersistenceEngine (inter-AI)
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// PROJECTION SCORING ENGINE
// ==========================================
/**
 * ProjectionScoringEngine
 * Deterministic linear projection of achievement and risk score.
 * All math is documented inline.
 */
const ProjectionScoringEngine = {

  /**
   * projectPace(currentAch, snapshots, td) → { midpoint, low, high, slope, method }
   *
   * Linear projection based on historical ach slope.
   * If insufficient history: extrapolate from current ach / timeGone ratio.
   * Formula: projected = currentAch + slope × hkRem
   * Confidence band: ± (1 + volatilityScore/20) pp around midpoint
   */
  projectPace: (currentAch, snaps, td) => {
    const hkRem = td.hkRem || 1;
    let slope = 0;
    let method = 'linear_extrapolation';
    let volatility = 0;

    if (snaps && snaps.length >= 3) {
      // Linear regression slope over ach values
      const achVals  = snaps.map(s => s.ach);
      const hkVals   = snaps.map(s => s.hk);
      const n        = achVals.length;
      const sumHK    = hkVals.reduce((a, b) => a + b, 0);
      const sumAch   = achVals.reduce((a, b) => a + b, 0);
      const sumHK2   = hkVals.reduce((a, b) => a + b * b, 0);
      const sumHKAch = hkVals.reduce((s, hk, i) => s + hk * achVals[i], 0);
      const denom    = n * sumHK2 - sumHK * sumHK;
      slope  = denom !== 0 ? (n * sumHKAch - sumHK * sumAch) / denom : 0;
      method = 'regression';
      volatility = TrendPersistenceEngine._calcVolatility(achVals);
    } else {
      // Current pace extrapolation: ach/timeGone × 100
      const paceRatio = td.timeGone > 0 ? currentAch / td.timeGone : 1;
      const projFinish = paceRatio * 100;
      slope = (projFinish - currentAch) / Math.max(hkRem, 1);
      method = 'pace_ratio';
    }

    const midpoint = Math.min(105, Math.max(0, currentAch + slope * hkRem));
    const band     = Math.max(1.5, 1.0 + volatility / 20);
    return {
      midpoint: parseFloat(midpoint.toFixed(1)),
      low:      parseFloat(Math.max(0, midpoint - band).toFixed(1)),
      high:     parseFloat(Math.min(105, midpoint + band).toFixed(1)),
      slope:    parseFloat(slope.toFixed(3)),
      method,
      volatility,
    };
  },

  /**
   * projectRiskScore(snapshots, currentTopScore, achGap, rrRatio, td) → 0-100
   *
   * Extrapolates riskScore at T+3HK using slope of last 3 risk values.
   * Adds execution contribution: persistent anomaly + time urgency.
   */
  projectRiskScore: (snaps, currentTopScore, achGap, rrRatio, td) => {
    const hkRem    = td.hkRem || 8;
    const horizon  = Math.min(3, hkRem);
    let   baseRisk = currentTopScore;

    if (snaps && snaps.length >= 3) {
      const risks = snaps.map(s => s.riskScore).slice(-3);
      const slope = (risks[2] - risks[0]) / 2;   // simple 2-step slope
      baseRisk    = Math.max(0, Math.min(100, currentTopScore + slope * horizon));
    }

    // Add structural pressure at T+horizon
    const futureHkRem  = Math.max(0, hkRem - horizon);
    const futureUrgency= futureHkRem <= 5 ? 15 : futureHkRem <= 8 ? 8 : 0;
    const rrContrib    = Math.min(20, (rrRatio - 1) * 15);
    const gapContrib   = achGap < 0 ? Math.min(15, Math.abs(achGap) * 1.5) : 0;

    const projected = Math.min(100, Math.round(baseRisk + futureUrgency + rrContrib + gapContrib));
    return projected;
  },
};
