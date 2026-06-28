/**
 * state.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all runtime application state.
 * This object is the shared mutable store read and written by every engine.
 *
 * Source: State object (SCT-by-SHP.html lines 872–919)
 *
 * Dependencies:
 *   none at load time — State holds plain data; all engines import into it at runtime
 *
 * State shape overview:
 *
 *   State.raw        — raw parsed data arrays from Parser (8 sheets)
 *   State.filtered   — active filtered view of raw data
 *   State.options    — dropdown option arrays (one per filter dimension)
 *   State.filters    — active filter Sets (one per dimension)
 *   State.timeEngine — working-day / pace data from DimDate sheet (see sentinel note)
 *   State.kpi        — flat KPI result object (~60+ keys)
 *   State.history    — memory snapshots & signals written by IntelligenceMemoryEngine
 *
 * ⚠ CRITICAL: State.kpi shape must never change.
 *   ~60 keys are destructured by name in the render layer.
 *   Any key rename or removal breaks rendering silently (undefined, not an error).
 *
 * ⚠ CRITICAL: State.timeEngine sentinel values (hkTot=1, hkPass=0) are intentional.
 *   They produce visible 0% pace output when DimDate is absent, alerting the operator.
 *   Do NOT change sentinel defaults to "safe-looking" values.
 *
 * Write rules:
 *   State.raw        → written once by Parser after successful file parse
 *   State.filtered   → reset by App.initDashboardData(), then updated on each filter change
 *   State.options    → written once during filter initialization
 *   State.filters    → mutated by App.bindGlobalEvents() click/change handlers
 *   State.timeEngine → written once by Parser.parseDimDate()
 *   State.kpi        → overwritten on each KPI recalculation
 *   State.history    → appended by IntelligenceMemoryEngine.capture()
 * ─────────────────────────────────────────────────────────────────────────────
 */

const State = {
  raw: { perf: [], arjuna: [], bima: [], sc: [], ps: [], caMaster: [], dimdate: [], wholesaler: [], mt: [] },
  filtered: { perf: [], arjuna: [], bima: [], sc: [], ps: [], caMaster: [], wholesaler: [], mt: [] },
  options: { regions: [], principles: [], channels: [], kategoris: [], depos: [] },
  filters: {
    regions: new Set(),
    principles: new Set(),
    channels: new Set(),
    kategoris: new Set(),
    depos: new Set()
  },
  /**
   * timeEngine — Single Source of Truth for all working-day & pace data.
   * Populated exclusively by Parser.parseDimDate() from the DimDate sheet.
   * Safe sentinel fallbacks used when DimDate is absent or unreadable.
   *
   * SENTINEL DEFAULTS: hkTot=1, hkPass=0 → timeGone=0%, hkRem=1.
   * Any KPI consuming these values will show 0% pace / infinite RR,
   * which is visibly wrong — alerting the operator rather than silently
   * showing plausible-but-incorrect numbers.
   *
   * Fields:
   *   hkTot    — Total working days in the period
   *   hkPass   — Working days elapsed (berjalan)
   *   hkRem    — Remaining working days (sisa); auto-derived if absent from sheet
   *   timeGone — % of period elapsed (0–100). Supplied by DimDate if available;
   *              otherwise derived as (hkPass / hkTot) × 100
   *   source   — 'DimDate' | 'DimDate-partial' | 'fallback-sentinel'
   *   valid    — true only when DimDate supplied at minimum hkTot + hkPass
   *   warnings — string[] of human-readable diagnostic messages
   */
  timeEngine: {
    hkTot:    1,
    hkPass:   0,
    hkRem:    1,
    timeGone: 0,
    source:   'fallback-sentinel',
    valid:    false,
    warnings: ['DimDate belum dimuat. Data Working Days menggunakan sentinel. Upload file dengan sheet DimDate untuk hasil akurat.']
  },
  kpi: null,
  history: {
    snapshots:      [],   // populated by IntelligenceMemoryEngine.init()
    lastSignals:    null, // last getSignals() output
    forecastSignals:null, // last PredictivePressureEngine.analyze() forecast
    lastForecast:   null, // full forecast result,
  }
};
