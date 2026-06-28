// ==========================================
// AI LAYER — intelligenceMemoryEngine.js
// ==========================================
// Source: index.html lines 9279–9534
// Extracted: AI Cluster Extraction
//
// Dependencies: State, KPIEngine, TimeEngine (external)
// Inter-AI: calls TrendPersistenceEngine, PatternRecognitionEngine,
//           NarrativeMemoryEngine, PredictivePressureEngine, NarrativeRouter
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// V6 STEP 7.5: INTELLIGENCE MEMORY LAYER
// ==========================================
/**
 * IntelligenceMemoryEngine
 * Temporal intelligence: captures daily KPI snapshots into localStorage,
 * exposes trend persistence and pattern signals to NarrativeRouter.
 * Zero dependencies on InfographicEngine or canvas layer.
 *
 * Architecture:
 *   capture(kpi)  — called after KPIEngine.runAll() — serializes a compact
 *                   snapshot keyed by date+hkPass+filterKey
 *   getSignals()  — returns {persistence, patterns, narrativeFragments}
 *                   consumed by NarrativeRouter.route() as historySignals
 *   load()        — reads localStorage with corruption recovery
 *   prune()       — trims to MAX_SNAPSHOTS, removes schema-incompatible entries
 *
 * Storage budget: 30 snapshots × ~600 bytes ≈ 18KB (localStorage limit: 5MB)
 */
const IntelligenceMemoryEngine = {

  SCHEMA_VERSION: 1,
  MAX_SNAPSHOTS:  30,
  STORAGE_KEY:    'sct_v6_snapshots',
  SCHEMA_KEY:     'sct_v6_schema_v',

  // ── State.history reference (initialized by init()) ─────────────────
  _snapshots: [],   // in-memory mirror of localStorage

  // ════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ════════════════════════════════════════════════════════════════════

  /** Initialize: load from localStorage, prune stale/corrupt entries */
  init: () => {
    IntelligenceMemoryEngine._snapshots = IntelligenceMemoryEngine.load();
    // Attach to State for dashboard inspection
    if (typeof State !== 'undefined') {
      State.history = {
        snapshots:      IntelligenceMemoryEngine._snapshots,
        lastSignals:    null,
      };
    }
    console.log(`[IME] init — ${IntelligenceMemoryEngine._snapshots.length} snapshots loaded`);
  },

  /**
   * capture(kpi) — serialize a compact snapshot from current KPI state.
   * Called after KPIEngine.runAll(). Fast (<1ms). Keyed by date+hk+filter.
   * Same-day same-hk same-filter = overwrite (idempotent).
   */
  capture: (kpi) => {
    if (!kpi || !kpi.perf) return;

    const td    = (typeof TimeEngine !== 'undefined') ? TimeEngine.get() : { hkPass: 0, hkRem: 1, hkTot: 1, timeGone: 0 };
    const now   = new Date();
    const date  = now.toISOString().slice(0, 10);
    const fKey  = IntelligenceMemoryEngine._filterKey();

    // Compact principle snapshot (only name + ach + status + vsLM)
    const principles = {};
    (kpi.perf.byPrin || []).forEach(pr => {
      principles[pr.principle] = {
        ach:    parseFloat((pr.ach || 0).toFixed(1)),
        vsLM:   pr.trend?.vsLM ?? null,
        status: pr.tgStatus?.status || 'UNKNOWN',
      };
    });

    // Compact anomaly IDs (type+domain, no bulky data objects)
    const anomalyIds = (kpi.alerts?.issues || [])
      .slice(0, 10)
      .map(i => `${i.domain || 'x'}-${i.type || 'x'}`.toLowerCase().replace(/\s+/g, '-'));

    // Compute riskScore inline (mirrors composeExecutiveBriefingCard logic)
    const achGap   = kpi.perf.ach - td.timeGone;
    const rrRatio  = kpi.perf.actRR > 0 ? kpi.perf.reqRR / kpi.perf.actRR : 1;
    const topScore = kpi.alerts?.topIssue?.severityScore ?? 0;
    const hkUrg    = td.hkRem <= 5 ? 30 : td.hkRem <= 8 ? 15 : 0;
    const riskScore = Math.round(
      topScore * 0.45 +
      Math.max(0, Math.min(100, -achGap * 4)) * 0.30 +
      Math.max(0, Math.min(100, (rrRatio - 1) * 50)) * 0.15 +
      hkUrg * 0.10
    );

    const severity = riskScore >= 65 ? 'critical'
      : riskScore >= 35 ? 'warning'
      : achGap >= 10    ? 'opportunity'
      : 'stable';

    const snapshot = {
      _schema:      IntelligenceMemoryEngine.SCHEMA_VERSION,
      date,
      timestamp:    now.toISOString().slice(0, 16),
      hk:           td.hkPass,
      hkRem:        td.hkRem,
      ach:          parseFloat((kpi.perf.ach || 0).toFixed(2)),
      gap:          parseFloat(((kpi.perf.gap || 0) / 1e9).toFixed(1)), // in B
      rrReq:        parseFloat(((kpi.perf.reqRR || 0) / 1e6).toFixed(1)), // M/HK
      rrAct:        parseFloat(((kpi.perf.actRR || 0) / 1e6).toFixed(1)),
      riskScore,
      severity,
      achGap:       parseFloat(achGap.toFixed(2)),
      topIssueScore: topScore,
      principles,
      anomalyIds,
      filterKey:    fKey,
    };

    const snaps = IntelligenceMemoryEngine._snapshots;
    // Overwrite if same date+hk+filter, else append
    const existIdx = snaps.findIndex(s =>
      s.date === date && s.hk === td.hkPass && s.filterKey === fKey
    );
    if (existIdx >= 0) {
      snaps[existIdx] = snapshot;
    } else {
      snaps.push(snapshot);
    }

    IntelligenceMemoryEngine.prune();
    IntelligenceMemoryEngine._save();

    // Update State.history reference
    if (typeof State !== 'undefined' && State.history) {
      State.history.snapshots = snaps;
    }
  },

  /**
   * load() — read snapshots from localStorage with full corruption recovery.
   * Returns [] on any error.
   */
  load: () => {
    try {
      const raw = localStorage.getItem(IntelligenceMemoryEngine.STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Filter out schema-incompatible entries
      return parsed.filter(s =>
        s && typeof s === 'object' &&
        s._schema === IntelligenceMemoryEngine.SCHEMA_VERSION &&
        typeof s.ach === 'number' &&
        typeof s.date === 'string'
      );
    } catch (_) {
      console.warn('[IME] localStorage read failed — resetting history');
      return [];
    }
  },

  /** prune() — trim to MAX_SNAPSHOTS, sort by date+hk ascending */
  prune: () => {
    const snaps = IntelligenceMemoryEngine._snapshots;
    // Sort by date then hk
    snaps.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.hk - b.hk;
    });
    if (snaps.length > IntelligenceMemoryEngine.MAX_SNAPSHOTS) {
      IntelligenceMemoryEngine._snapshots = snaps.slice(-IntelligenceMemoryEngine.MAX_SNAPSHOTS);
    }
  },

  /** clearHistory() — wipe all stored snapshots (for testing / manual reset) */
  clearHistory: () => {
    IntelligenceMemoryEngine._snapshots = [];
    if (typeof State !== 'undefined' && State.history) State.history.snapshots = [];
    try { localStorage.removeItem(IntelligenceMemoryEngine.STORAGE_KEY); } catch (_) {}
    console.log('[IME] History cleared');
  },

  _save: () => {
    try {
      localStorage.setItem(
        IntelligenceMemoryEngine.STORAGE_KEY,
        JSON.stringify(IntelligenceMemoryEngine._snapshots)
      );
    } catch (e) {
      // localStorage quota exceeded or unavailable — degrade gracefully
      console.warn('[IME] localStorage write failed:', e.message);
    }
  },

  _filterKey: () => {
    if (typeof State === 'undefined' || !State.filters || !State.options) return 'ALL';
    const rSz = State.filters.regions?.size    || 0;
    const pSz = State.filters.principles?.size || 0;
    const rTt = State.options.regions?.length  || 0;
    const pTt = State.options.principles?.length || 0;
    const parts = [];
    if (rSz > 0 && rSz < rTt) parts.push('R' + rSz);
    if (pSz > 0 && pSz < pTt) parts.push('P' + pSz);
    return parts.length ? parts.join('_') : 'ALL';
  },

  // ════════════════════════════════════════════════════════════════════
  // SIGNAL AGGREGATION — main output for NarrativeRouter
  // ════════════════════════════════════════════════════════════════════

  /**
   * getSignals(filterKey) — returns combined signals from all sub-engines.
   * This is the primary interface consumed by NarrativeRouter.route().
   */
  getSignals: (filterKey) => {
    const fKey = filterKey || IntelligenceMemoryEngine._filterKey();
    const snaps = IntelligenceMemoryEngine._snapshots
      .filter(s => s.filterKey === fKey)
      .slice(-10);  // use last 10 snapshots for signal computation

    if (snaps.length < 2) {
      return { available: false, snapshotCount: snaps.length };
    }

    const persistence = TrendPersistenceEngine.analyze(snaps);
    const patterns    = PatternRecognitionEngine.detect(snaps);
    const fragments   = NarrativeMemoryEngine.compose(persistence, patterns);

    // V6 Step 8: run predictive pressure analysis
    const forecast = (typeof PredictivePressureEngine !== 'undefined')
      ? PredictivePressureEngine.analyze(
          typeof State !== 'undefined' ? State.kpi : null,
          { available: true, persistence, patterns, fragments }
        )
      : null;

    const signals = {
      available:      true,
      snapshotCount:  snaps.length,
      persistence,
      patterns,
      fragments,
      forecast,
      // Convenience accessors for NarrativeRouter
      riskTrend:              persistence.riskTrend,
      persistenceSeverity:    persistence.persistenceSeverity,
      declineStreak:          persistence.declineStreak,
      recoveryStreak:         persistence.recoveryStreak,
      contradictionSignal:    patterns.temporaryBounce || patterns.falseRecovery,
      primaryFragment:        fragments.primary || null,
      // Forecast convenience accessors
      projectedSeverity:      forecast?.projectedSeverity  || null,
      escalationProbability:  forecast?.escalationProbability || 0,
      dominantRisk:           forecast?.dominantRisk || null,
    };

    // Cache on State.history
    if (typeof State !== 'undefined' && State.history) {
      State.history.lastSignals = signals;
    }

    return signals;
  },
};


// ==========================================
// MEMORY LAYER TEST FUNCTION — testMemoryLayer
// ==========================================
// Source: index.html lines 9878–9984
// Co-extracted with IntelligenceMemoryEngine
// ==========================================
// ==========================================
// MEMORY LAYER TEST ENGINE
// ==========================================
/**
 * testMemoryLayer()
 * Simulates 8 scenarios by injecting synthetic snapshot sequences
 * and verifying the resulting signals. Console-only output.
 */
const testMemoryLayer = () => {

  // ── Helper: build a synthetic snapshot ──────────────────────────────
  const mkSnap = (date, hk, ach, riskScore, anomalyIds, principles) => ({
    _schema: 1, date, timestamp: date + 'T08:00', hk,
    ach, gap: -((100 - ach) * 2), rrReq: 12, rrAct: 9,
    riskScore, severity: riskScore >= 65 ? 'critical' : riskScore >= 35 ? 'warning' : 'stable',
    achGap: ach - 70, topIssueScore: riskScore,
    anomalyIds: anomalyIds || [],
    principles: principles || {},
    filterKey: 'TEST',
  });

  // ── Scenario runner ────────────────────────────────────────────────
  const run = (label, snaps) => {
    const persistence = TrendPersistenceEngine.analyze(snaps);
    const patterns    = PatternRecognitionEngine.detect(snaps);
    const fragments   = NarrativeMemoryEngine.compose(persistence, patterns);

    console.group(`  ${label}`);
    console.log('    persistence:', persistence.riskTrend, '|',
      'dec:', persistence.declineStreak, 'rec:', persistence.recoveryStreak,
      '| sev:', persistence.persistenceSeverity);
    console.log('    patterns: bounce=', patterns.temporaryBounce,
      'false=', patterns.falseRecovery,
      'sustained=', patterns.sustainedRecovery,
      'accel=', patterns.acceleratingCollapse);
    console.log('    fragment:', fragments.primary || '(none)');
    console.groupEnd();
    return { persistence, patterns, fragments };
  };

  console.group('[testMemoryLayer] 8 scenarios');

  // 1. Persistent decline
  run('1. Persistent decline (5 HK down)', [
    mkSnap('2025-04-18',11,79,40), mkSnap('2025-04-19',12,76,48),
    mkSnap('2025-04-20',13,73,55), mkSnap('2025-04-21',14,70,62),
    mkSnap('2025-04-22',15,66,70),
  ]);

  // 2. Temporary bounce
  run('2. Temporary bounce (3 down, 1 up)', [
    mkSnap('2025-04-19',12,76,48), mkSnap('2025-04-20',13,73,55),
    mkSnap('2025-04-21',14,70,62), mkSnap('2025-04-22',15,67,68),
    mkSnap('2025-04-23',16,70,55),
  ]);

  // 3. Recurring anomaly
  run('3. Recurring anomaly (ws-zero in 4 of 5)', [
    mkSnap('2025-04-18',11,72,45,['ws-zero-bima']),
    mkSnap('2025-04-19',12,71,46,['ws-zero-bima','ca-drop']),
    mkSnap('2025-04-20',13,73,42,[]),
    mkSnap('2025-04-21',14,70,48,['ws-zero-bima']),
    mkSnap('2025-04-22',15,69,52,['ws-zero-bima']),
  ]);

  // 4. Sustained recovery
  run('4. Sustained recovery (4 HK up, risk improving)', [
    mkSnap('2025-04-18',11,62,70), mkSnap('2025-04-19',12,65,62),
    mkSnap('2025-04-20',13,68,55), mkSnap('2025-04-21',14,71,45),
    mkSnap('2025-04-22',15,74,38),
  ]);

  // 5. False recovery
  run('5. False recovery (5 down, 2 up)', [
    mkSnap('2025-04-16',9,82,35),  mkSnap('2025-04-17',10,79,42),
    mkSnap('2025-04-18',11,76,50), mkSnap('2025-04-19',12,72,58),
    mkSnap('2025-04-20',13,69,65), mkSnap('2025-04-21',14,66,72),
    mkSnap('2025-04-22',15,69,62), mkSnap('2025-04-23',16,71,55),
  ]);

  // 6. Accelerating collapse
  run('6. Accelerating collapse (each step worse)', [
    mkSnap('2025-04-19',12,76,42), mkSnap('2025-04-20',13,73,50),
    mkSnap('2025-04-21',14,69,60), mkSnap('2025-04-22',15,64,72),
    mkSnap('2025-04-23',16,57,85),
  ]);

  // 7. Stable high performer
  run('7. Stable high performer', [
    mkSnap('2025-04-19',12,88,12,[], {GGBI:{ach:90,vsLM:5,status:'GOOD'}}),
    mkSnap('2025-04-20',13,87,14,[], {GGBI:{ach:89,vsLM:6,status:'GOOD'}}),
    mkSnap('2025-04-21',14,89,11,[], {GGBI:{ach:91,vsLM:5,status:'GOOD'}}),
    mkSnap('2025-04-22',15,88,13,[], {GGBI:{ach:90,vsLM:5,status:'GOOD'}}),
    mkSnap('2025-04-23',16,90,10,[], {GGBI:{ach:92,vsLM:6,status:'GOOD'}}),
  ]);

  // 8. Volatility persistence
  run('8. Volatility persistence', [
    mkSnap('2025-04-17',10,72,45), mkSnap('2025-04-18',11,78,38),
    mkSnap('2025-04-19',12,70,52), mkSnap('2025-04-20',13,76,40),
    mkSnap('2025-04-21',14,68,56), mkSnap('2025-04-22',15,74,42),
    mkSnap('2025-04-23',16,66,60),
  ]);

  console.log('[testMemoryLayer] All 8 scenarios complete');
  console.groupEnd();
};
