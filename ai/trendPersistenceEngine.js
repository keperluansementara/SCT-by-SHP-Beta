// ==========================================
// AI LAYER — trendPersistenceEngine.js
// ==========================================
// Source: index.html lines 9536–9654
// Extracted: AI Cluster Extraction
//
// Dependencies: NONE
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// TREND PERSISTENCE ENGINE
// ==========================================
/**
 * TrendPersistenceEngine
 * Analyzes a time-ordered array of snapshots and returns persistence signals.
 * All methods are pure functions (no side effects, no storage).
 */
const TrendPersistenceEngine = {

  /**
   * analyze(snapshots) — main entry point
   * @param {object[]} snaps — time-ordered array of IME snapshots
   * @returns {object} persistence signal object
   */
  analyze: (snaps) => {
    if (!snaps || snaps.length < 2) {
      return TrendPersistenceEngine._empty();
    }

    const achValues  = snaps.map(s => s.ach);
    const riskValues = snaps.map(s => s.riskScore);

    const declineStreak  = TrendPersistenceEngine._countStreak(achValues, 'down');
    const recoveryStreak = TrendPersistenceEngine._countStreak(achValues, 'up');
    const volatilityScore = TrendPersistenceEngine._calcVolatility(achValues);
    const anomalyFreq    = TrendPersistenceEngine._calcAnomalyFrequency(snaps);
    const riskTrend      = TrendPersistenceEngine._detectRiskTrend(riskValues);
    const momentumDir    = TrendPersistenceEngine._detectMomentum(achValues);
    const persistSev     = TrendPersistenceEngine._classifyPersistence(declineStreak, recoveryStreak, snaps.length);

    return {
      declineStreak,
      recoveryStreak,
      volatilityScore,
      anomalyFrequency: anomalyFreq,
      riskTrend,
      momentumDirection: momentumDir,
      persistenceSeverity: persistSev,
      snapshotCount: snaps.length,
    };
  },

  _empty: () => ({
    declineStreak: 0, recoveryStreak: 0, volatilityScore: 0,
    anomalyFrequency: 0, riskTrend: 'stable', momentumDirection: 'stable',
    persistenceSeverity: 'transient', snapshotCount: 0,
  }),

  // Count consecutive changes in direction from the MOST RECENT end
  _countStreak: (values, dir) => {
    if (values.length < 2) return 0;
    let streak = 0;
    for (let i = values.length - 1; i >= 1; i--) {
      const delta = values[i] - values[i - 1];
      if (dir === 'down' && delta < -0.3) streak++;
      else if (dir === 'up' && delta > 0.3) streak++;
      else break;
    }
    return streak;
  },

  // Standard deviation of ach changes, normalized to 0-100
  _calcVolatility: (values) => {
    if (values.length < 3) return 0;
    const deltas = values.slice(1).map((v, i) => v - values[i]);
    const mean   = deltas.reduce((s, v) => s + v, 0) / deltas.length;
    const variance = deltas.reduce((s, v) => s + (v - mean) ** 2, 0) / deltas.length;
    const stdDev   = Math.sqrt(variance);
    // Normalize: stdDev of 5pp → score 50, stdDev of 10pp → score 100
    return Math.min(100, Math.round(stdDev * 10));
  },

  // Average anomaly count per snapshot
  _calcAnomalyFrequency: (snaps) => {
    const total = snaps.reduce((s, sn) => s + (sn.anomalyIds?.length || 0), 0);
    return parseFloat((total / snaps.length).toFixed(1));
  },

  // Trend in riskScore values
  _detectRiskTrend: (riskValues) => {
    if (riskValues.length < 3) return 'stable';
    const n     = riskValues.length;
    const last3 = riskValues.slice(-3);
    const first3 = riskValues.slice(0, 3);
    const avgLast  = last3.reduce((s, v) => s + v, 0) / 3;
    const avgFirst = first3.reduce((s, v) => s + v, 0) / 3;
    const delta = avgLast - avgFirst;
    const vol   = TrendPersistenceEngine._calcVolatility(riskValues);

    if (vol > 60) return 'volatile';
    if (delta > 8)  return 'worsening';
    if (delta < -8) return 'improving';
    return 'stable';
  },

  // Is momentum accelerating, decelerating, or stable?
  _detectMomentum: (values) => {
    if (values.length < 4) return 'stable';
    const deltas = values.slice(1).map((v, i) => v - values[i]);
    const recent = deltas.slice(-2);
    const prior  = deltas.slice(-4, -2);
    if (!recent.length || !prior.length) return 'stable';
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const priorAvg  = prior.reduce((s, v) => s + v, 0) / prior.length;
    const diff = recentAvg - priorAvg;
    if (diff < -1) return 'accelerating';  // declining faster
    if (diff >  1) return 'decelerating';  // recovering faster
    return 'stable';
  },

  // Classify how persistent the current state is
  _classifyPersistence: (declineStreak, recoveryStreak, n) => {
    const dominant = Math.max(declineStreak, recoveryStreak);
    if (dominant >= 4) return 'persistent';
    if (dominant >= 2) return 'recent';
    return 'transient';
  },
};
