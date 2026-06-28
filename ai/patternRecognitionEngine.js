// ==========================================
// AI LAYER — patternRecognitionEngine.js
// ==========================================
// Source: index.html lines 9656–9781
// Extracted: AI Cluster Extraction
//
// Dependencies: TrendPersistenceEngine (inter-AI)
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// PATTERN RECOGNITION ENGINE
// ==========================================
/**
 * PatternRecognitionEngine
 * Detects recurring, false, and structural patterns over the snapshot window.
 * Pure functions — no side effects.
 */
const PatternRecognitionEngine = {

  /**
   * detect(snapshots) — main entry point
   * Uses last 5-10 snapshots for pattern detection.
   * @returns {object} pattern signal object
   */
  detect: (snaps) => {
    if (!snaps || snaps.length < 2) {
      return PatternRecognitionEngine._empty();
    }

    const window5  = snaps.slice(-5);
    const window10 = snaps;   // already limited to 10 by caller

    return {
      recurringAnomalies:  PatternRecognitionEngine._findRecurringAnomalies(window5),
      persistentWeakPrins: PatternRecognitionEngine._findPersistentWeakPrins(window5),
      temporaryBounce:     PatternRecognitionEngine._isTemporaryBounce(snaps),
      falseRecovery:       PatternRecognitionEngine._isFalseRecovery(snaps),
      sustainedRecovery:   PatternRecognitionEngine._isSustainedRecovery(snaps),
      acceleratingCollapse:PatternRecognitionEngine._isAcceleratingCollapse(snaps),
      volatilePersistence: PatternRecognitionEngine._isVolatilePersistent(window10),
      stableHighPerformer: PatternRecognitionEngine._isStableHigh(window5),
    };
  },

  _empty: () => ({
    recurringAnomalies: [], persistentWeakPrins: [],
    temporaryBounce: false, falseRecovery: false,
    sustainedRecovery: false, acceleratingCollapse: false,
    volatilePersistence: false, stableHighPerformer: false,
  }),

  // Anomaly IDs appearing in >= 3 of last 5 snapshots
  _findRecurringAnomalies: (window5) => {
    const freq = {};
    window5.forEach(s => (s.anomalyIds || []).forEach(id => {
      freq[id] = (freq[id] || 0) + 1;
    }));
    return Object.entries(freq)
      .filter(([, count]) => count >= 3)
      .map(([id]) => id);
  },

  // Principles in DANGER status in >= 3 of last 5 snapshots
  _findPersistentWeakPrins: (window5) => {
    const freq = {};
    window5.forEach(s => {
      Object.entries(s.principles || {}).forEach(([name, data]) => {
        if (data.status === 'DANGER') freq[name] = (freq[name] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .filter(([, count]) => count >= 3)
      .map(([name]) => name);
  },

  // Recovery in latest HK but 3+ prior declines
  _isTemporaryBounce: (snaps) => {
    if (snaps.length < 4) return false;
    const last4 = snaps.slice(-4);
    const lastDelta  = last4[3].ach - last4[2].ach;
    const priorDeclines = [
      last4[2].ach - last4[1].ach,
      last4[1].ach - last4[0].ach,
    ].filter(d => d < -0.3).length;
    return lastDelta > 0.3 && priorDeclines >= 2;
  },

  // Short recovery streak (1-2) after a long decline streak (>=4)
  _isFalseRecovery: (snaps) => {
    if (snaps.length < 5) return false;
    const achVals = snaps.map(s => s.ach);
    const priorDecline = TrendPersistenceEngine._countStreak(
      achVals.slice(0, -2), 'down'
    );
    const currentRecovery = TrendPersistenceEngine._countStreak(achVals, 'up');
    return priorDecline >= 4 && currentRecovery >= 1 && currentRecovery <= 2;
  },

  // Recovery streak >= 3 AND riskTrend improving
  _isSustainedRecovery: (snaps) => {
    const achVals = snaps.map(s => s.ach);
    const riskVals = snaps.map(s => s.riskScore);
    const recStreak = TrendPersistenceEngine._countStreak(achVals, 'up');
    const riskTrend = TrendPersistenceEngine._detectRiskTrend(riskVals);
    return recStreak >= 3 && (riskTrend === 'improving' || riskTrend === 'stable');
  },

  // Decline streak >= 3 AND each step worse than previous
  _isAcceleratingCollapse: (snaps) => {
    if (snaps.length < 4) return false;
    const achVals = snaps.map(s => s.ach);
    const decStreak = TrendPersistenceEngine._countStreak(achVals, 'down');
    if (decStreak < 3) return false;
    // Check if deltas are increasingly negative
    const recent = achVals.slice(-4);
    const deltas = recent.slice(1).map((v, i) => v - recent[i]);
    return deltas[0] > deltas[1] && deltas[1] > deltas[2]; // each step worse
  },

  // High volatility score persisting over >= 5 snapshots
  _isVolatilePersistent: (window10) => {
    if (window10.length < 5) return false;
    const achVals = window10.map(s => s.ach);
    return TrendPersistenceEngine._calcVolatility(achVals) > 50;
  },

  // Ach >= 85% in all of last 5 snapshots and no DANGER principles
  _isStableHigh: (window5) => {
    if (window5.length < 3) return false;
    return window5.every(s => {
      const noDanger = Object.values(s.principles || {}).every(p => p.status !== 'DANGER');
      return s.ach >= 85 && noDanger;
    });
  },
};
