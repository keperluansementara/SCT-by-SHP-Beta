// ==========================================
// AI LAYER — recoverySustainabilityEngine.js
// ==========================================
// Source: index.html lines 10286–10345
// Extracted: AI Cluster Extraction
//
// Dependencies: NONE
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// RECOVERY SUSTAINABILITY ENGINE
// ==========================================
/**
 * RecoverySustainabilityEngine
 * Scores the structural durability of a current recovery signal.
 * Exposes fragility score (0-100) and sustainability label.
 */
const RecoverySustainabilityEngine = {

  /**
   * score(persistence, patterns, kpi) → { fragility, label, drivers }
   *
   * Fragility score (higher = more fragile):
   *   +30 recovery streak ≤ 2 HK (unproven)
   *   +25 overall vsLM negative (structural headwind)
   *   +20 WS allTrend.vsLM < 0  (execution channel drag)
   *   +15 worst CA channel delta > -5% (coverage erosion)
   *   +10 high volatility (unstable trajectory)
   */
  score: (persistence, patterns, kpi) => {
    const recStreak = persistence.recoveryStreak || 0;
    const volatile  = (persistence.volatilityScore || 0) > 50;
    const drivers   = [];
    let fragility   = 0;

    if (recStreak <= 2) {
      fragility += 30;
      drivers.push('recovery terlalu singkat untuk dikonfirmasi');
    }
    if ((kpi?.perf?.vsLM ?? 0) < 0) {
      fragility += 25;
      drivers.push('momentum vs LM masih negatif');
    }
    if ((kpi?.ws?.allTrend?.vsLM ?? 0) < 0) {
      fragility += 20;
      drivers.push('channel WS masih melemah');
    }
    const worstCh = kpi?.ca?.byCh?.[0];
    if (worstCh && worstCh.delta < -5) {
      fragility += 15;
      drivers.push('coverage CA tergerus di channel utama');
    }
    if (volatile) {
      fragility += 10;
      drivers.push('volatilitas tinggi — lintasan tidak stabil');
    }
    if (patterns.falseRecovery) {
      fragility += 20;
      drivers.push('pola false recovery terdeteksi sebelumnya');
    }

    fragility = Math.min(100, fragility);
    const label = fragility >= 70 ? 'fragile'
      : fragility >= 40 ? 'uncertain'
      : 'stabilizing';

    return { fragility, label, drivers };
  },
};
