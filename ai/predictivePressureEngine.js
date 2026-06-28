// ==========================================
// AI LAYER — predictivePressureEngine.js
// ==========================================
// Source: index.html lines 9987–10199
// Extracted: AI Cluster Extraction
//
// Dependencies: State, TimeEngine (external)
// Inter-AI: ProjectionScoringEngine, RecoverySustainabilityEngine,
//           EscalationForecastEngine, PressureNarrativeEngine, IntelligenceMemoryEngine
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// V6 STEP 8: PREDICTIVE PRESSURE ENGINE
// ==========================================
/**
 * PredictivePressureEngine (PPE)
 * Deterministic, explainable, rule-based forecast layer for FMCG operations.
 * Uses historical snapshots (IME) + current KPI state to project
 * risk trajectory, pace finish range, and escalation probability.
 *
 * Philosophy: transparent business-rule heuristics, not black-box ML.
 * Every number is traceable to a specific formula documented in each method.
 *
 * Pipeline position:
 *   KPIEngine → AlertEngine → IME → PatternRecognitionEngine
 *   → PredictivePressureEngine → NarrativeRouter → InfographicEngine
 *
 * Called by:
 *   IntelligenceMemoryEngine.getSignals() — appends forecastSignals
 *   NarrativeRouter.route()              — consumes forecastSignals
 *   composeExecutiveBriefingCard()       — optional forecast bullets
 */
const PredictivePressureEngine = {

  // ════════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ════════════════════════════════════════════════════════════════════

  /**
   * analyze(kpi, historySignals) → forecast object
   *
   * @param {object} kpi            — State.kpi
   * @param {object} historySignals — output of IntelligenceMemoryEngine.getSignals()
   * @returns {object} full forecast result
   */
  analyze: (kpi, historySignals) => {
    if (!kpi || !kpi.perf) return PredictivePressureEngine._empty();

    const td  = (typeof TimeEngine !== 'undefined') ? TimeEngine.get()
              : { hkRem: 8, hkPass: 15, hkTot: 23, timeGone: 65 };
    const p   = kpi.perf;
    const hs  = historySignals || {};
    const per = hs.persistence  || {};
    const pat = hs.patterns     || {};
    const snaps = (hs.available && IntelligenceMemoryEngine?._snapshots)
      ? IntelligenceMemoryEngine._snapshots.filter(s => s.filterKey === IntelligenceMemoryEngine._filterKey()).slice(-10)
      : [];

    const achGap   = p.ach - td.timeGone;
    const rrRatio  = p.actRR > 0 ? p.reqRR / p.actRR : 1.0;
    const topScore = kpi.alerts?.topIssue?.severityScore ?? 0;

    // ── Sub-engine results ────────────────────────────────────────────
    const paceProj    = ProjectionScoringEngine.projectPace(p.ach, snaps, td);
    const escProb     = EscalationForecastEngine.calcProbability(topScore, per, pat, td, rrRatio);
    const recSust     = RecoverySustainabilityEngine.score(per, pat, kpi);
    const hkPressure  = PredictivePressureEngine._calcHKPressure(achGap, td, rrRatio);
    const execPressure = PredictivePressureEngine._calcExecutionPressure(kpi, pat);
    const detected    = PredictivePressureEngine._detectConditions(per, pat, td, rrRatio, achGap, hkPressure, topScore);

    // ── Projected risk score at T+3HK ────────────────────────────────
    const projectedRisk = ProjectionScoringEngine.projectRiskScore(snaps, topScore, achGap, rrRatio, td);
    const projSeverity  = projectedRisk >= 70 ? 'critical'
      : projectedRisk >= 40 ? 'warning'
      : (paceProj.midpoint >= 90 ? 'opportunity' : 'stable');

    // ── Dominant risk / opportunity ───────────────────────────────────
    const dominantRisk = PredictivePressureEngine._dominantRisk(detected, per, hkPressure, escProb);
    const dominantOpp  = PredictivePressureEngine._dominantOpportunity(kpi, per, paceProj);

    // ── Forecast narratives ───────────────────────────────────────────
    const narratives   = PressureNarrativeEngine.compose(
      detected, paceProj, recSust, escProb, hkPressure, per, td, kpi
    );

    // ── Forecast signals (for NarrativeRouter) ────────────────────────
    const forecastSignals = {
      projectedRiskScore:    projectedRisk,
      projectedSeverity:     projSeverity,
      severityEscalating:    projectedRisk > topScore + 10,
      escalationProbability: escProb,
    };

    const result = {
      projectedRiskScore:    projectedRisk,
      projectedSeverity:     projSeverity,
      escalationProbability: escProb,
      paceProjection:        paceProj,
      projectedFinishRange:  `${paceProj.low.toFixed(1)}%–${paceProj.high.toFixed(1)}%`,
      recoverySustainability:recSust,
      executionPressure:     execPressure,
      hkPressure,
      dominantRisk,
      dominantOpportunity:   dominantOpp,
      detectedConditions:    detected,
      forecastNarratives:    narratives,
      forecastSignals,
      forecastMeta: {
        generatedAt:   new Date().toISOString(),
        snapshotCount: snaps.length,
        hkRem:         td.hkRem,
        projectionHorizon: Math.min(3, td.hkRem),
        dataQuality:   snaps.length >= 3 ? 'good' : snaps.length >= 1 ? 'limited' : 'insufficient',
      }
    };

    // Cache on State.history
    if (typeof State !== 'undefined' && State.history) {
      State.history.forecastSignals = forecastSignals;
      State.history.lastForecast    = result;
    }

    return result;
  },

  _empty: () => ({
    projectedRiskScore: 0, projectedSeverity: 'stable',
    escalationProbability: 0, paceProjection: { midpoint:0, low:0, high:0, slope:0 },
    projectedFinishRange: '—', recoverySustainability: { label:'unknown', fragility:0 },
    executionPressure: { score:0, label:'low' }, hkPressure: { score:0, label:'normal' },
    dominantRisk: null, dominantOpportunity: null,
    detectedConditions: [], forecastNarratives: [], forecastSignals: {},
    forecastMeta: { dataQuality: 'insufficient' }
  }),

  // ── HK Pressure Score (0-100) ─────────────────────────────────────
  // Formula: weighted combination of pace gap, RR pressure, and time urgency.
  // Transparent, traceable to three FMCG operational metrics.
  _calcHKPressure: (achGap, td, rrRatio) => {
    const hkRem = td.hkRem;
    let score = 0;
    // Pace-gap component: negative achGap × intensity by HK remaining
    if (achGap < 0) {
      const intensity = hkRem <= 5 ? 6 : hkRem <= 8 ? 4 : 2;
      score += Math.min(40, Math.abs(achGap) * intensity);
    }
    // RR pressure component
    if (rrRatio > 1) score += Math.min(35, (rrRatio - 1) * 25);
    // Time urgency component
    score += hkRem <= 3 ? 25 : hkRem <= 5 ? 18 : hkRem <= 8 ? 10 : 0;

    score = Math.max(0, Math.min(100, Math.round(score)));
    const label = score >= 70 ? 'critical' : score >= 45 ? 'elevated' : score >= 20 ? 'moderate' : 'normal';
    return { score, label };
  },

  // ── Execution Pressure Score (0-100) ─────────────────────────────
  _calcExecutionPressure: (kpi, patterns) => {
    let score = 0;
    // WS zero-trx contribution
    const ws = kpi.ws;
    if (ws) {
      const wsRatio = ws.allTotal > 0 ? ws.allZero / ws.allTotal : 0;
      score += Math.round(wsRatio * 40);
    }
    // Recurring anomaly contribution
    if (patterns.recurringAnomalies?.length > 0) score += 20;
    // CA drop contribution
    const worstCh = kpi.ca?.byCh?.[0];
    if (worstCh && worstCh.delta <= -10) score += 20;
    else if (worstCh && worstCh.delta < 0) score += 10;
    // Persistent weak principles
    if (patterns.persistentWeakPrins?.length >= 2) score += 20;
    else if (patterns.persistentWeakPrins?.length === 1) score += 10;

    score = Math.min(100, score);
    const label = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'moderate' : 'low';
    return { score, label };
  },

  // ── 10 Detected Conditions ───────────────────────────────────────
  _detectConditions: (per, pat, td, rrRatio, achGap, hkPressure, topScore) => {
    const conditions = [];
    const add = (id, confidence) => conditions.push({ id, confidence });

    if (pat.acceleratingCollapse)                      add('accelerating_collapse', 0.90);
    if (pat.falseRecovery)                             add('fragile_recovery', 0.85);
    if (pat.temporaryBounce)                           add('temporary_rebound', 0.80);
    if (per.declineStreak >= 4 || per.riskTrend === 'worsening')
                                                       add('sustained_deterioration', Math.min(0.95, 0.60 + per.declineStreak * 0.07));
    if (pat.sustainedRecovery && per.recoveryStreak >= 3)
                                                       add('recovery_stabilization', 0.75);
    if (pat.recurringAnomalies?.length > 0)            add('recurring_execution_anomaly', 0.85);
    if (rrRatio >= 2.5)                                add('runrate_impossibility', 0.92);
    if (hkPressure.score >= 70 && td.hkRem <= 6)      add('hk_pressure_escalation', 0.88);
    if (td.hkRem <= 5 && topScore >= 55 && per.declineStreak >= 2)
                                                       add('late_month_panic_risk', 0.82);
    if (per.recoveryStreak >= 3 && per.momentumDirection === 'accelerating')
                                                       add('momentum_exhaustion', 0.70);

    // Sort by confidence descending
    conditions.sort((a, b) => b.confidence - a.confidence);
    return conditions;
  },

  _dominantRisk: (conditions, per, hkPressure, escProb) => {
    if (!conditions.length) return null;
    const top = conditions[0];
    const confPct = Math.round(top.confidence * 100);
    return { id: top.id, confidence: top.confidence, confLabel: `${confPct}%` };
  },

  _dominantOpportunity: (kpi, per, paceProj) => {
    if (paceProj.midpoint >= 95) return { type: 'strong_finish', label: 'Proyeksi close ≥95%' };
    if (per.recoveryStreak >= 3 && per.momentumDirection !== 'accelerating')
      return { type: 'sustained_recovery', label: 'Recovery berlanjut dan stabil' };
    // Best principle above pace
    const bestPrin = (kpi.perf.byPrin || [])
      .filter(pr => pr.tgStatus?.status === 'GOOD')
      .sort((a, b) => (b.ach - b.ach) || (b.trend?.vsLM ?? 0) - (a.trend?.vsLM ?? 0))[0];
    if (bestPrin) return { type: 'principle_strength', label: `${bestPrin.principle} overpace` };
    return null;
  },
};
