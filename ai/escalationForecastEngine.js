// ==========================================
// AI LAYER — escalationForecastEngine.js
// ==========================================
// Source: index.html lines 10347–10388
// Extracted: AI Cluster Extraction
//
// Dependencies: NONE
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// ESCALATION FORECAST ENGINE
// ==========================================
/**
 * EscalationForecastEngine
 * Calculates the probability that current WARNING/STABLE
 * will escalate to CRITICAL within 3 HK.
 * Formula is transparent, weighted, rule-based.
 */
const EscalationForecastEngine = {

  /**
   * calcProbability(topScore, persistence, patterns, td, rrRatio) → 0.0–0.97
   *
   * Base = topScore / 100
   * Modifiers: persistence streaks, pattern signals, time pressure
   */
  calcProbability: (topScore, persistence, patterns, td, rrRatio) => {
    let prob = (topScore || 0) / 100;

    // Persistence amplifiers
    if ((persistence.declineStreak || 0) >= 3)    prob += 0.15;
    if ((persistence.declineStreak || 0) >= 5)    prob += 0.08;   // extra for long streaks
    if (patterns.acceleratingCollapse)            prob += 0.10;

    // Time pressure
    const hkRem = td.hkRem || 99;
    if (hkRem <= 5)  prob += 0.10;
    else if (hkRem <= 8) prob += 0.05;

    // RR impossibility
    if (rrRatio >= 2.5) prob += 0.10;
    else if (rrRatio >= 1.8) prob += 0.06;

    // Recovery dampers
    if (patterns.sustainedRecovery)           prob -= 0.15;
    if ((persistence.recoveryStreak || 0) >= 2) prob -= 0.08;
    if (patterns.stableHighPerformer)         prob -= 0.20;

    return Math.max(0, Math.min(0.97, parseFloat(prob.toFixed(2))));
  },
};
