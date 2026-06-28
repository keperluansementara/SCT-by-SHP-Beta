/**
 * constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All named constants extracted from Config and inline magic numbers.
 * No functions. No dependencies.
 *
 * Source: Config object (SCT-by-SHP.html lines 847–867)
 *         Inline thresholds scattered across Utils, TrendEngine, KPIEngine
 *
 * Consumers (after integration):
 *   formatter.js  — COLORS, ACH_GREEN, ACH_AMBER
 *   helpers.js    — FOCUS_CHANNELS, ACH_GREEN, ACH_AMBER, WARN_GAP_DEFAULT
 *   config.js     — SHEET_ALIASES, FOCUS_CHANNELS (replaces Config object)
 *   kpiEngine.js  — All threshold constants
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CONSTANTS = {

  // ── Color palette — mirrors Config.COLORS ──────────────────────────────────
  // Used by: Formatter.progColor(), TrendEngine.hexColor(), InfographicEngine
  COLORS: {
    green: '#1E8449',
    amber: '#D35400',
    red:   '#C0392B',
    blue:  '#1A5276',
    gray:  '#E5E5EA',
    dark:  '#1C1C1E'
  },

  // ── CA Channel whitelist — mirrors Config.FOCUS_CHANNELS ──────────────────
  // Only these channels appear in CA charts, rankings, traffic light, insights.
  // Governance rule: do not add channels without product team sign-off.
  FOCUS_CHANNELS: [
    'WHOLESALER', 'RETAIL', 'MTI', 'NKA', 'PS',
    'SPECIALTY CHANNEL', 'FOOD SERVICE',
    'MTI FS', 'RETAIL FS', 'WHOLESALER FS'
  ],

  // ── Sheet name aliases — mirrors Config.SHEET_ALIASES ─────────────────────
  // Parser.findSheet() uses fuzzy matching against these alias lists.
  // Order matters: first match wins.
  SHEET_ALIASES: {
    dimdate:    ['DimDate', 'Dim Date', 'dimdate', 'HK', 'WorkingDay', 'WorkingDays', 'Hari Kerja'],
    perf:       ['Perfomance', 'Performance', 'performance'],
    arjuna:     ['ITG_Arjuna', 'ITG Arjuna', 'Arjuna'],
    bima:       ['ITG_Bima', 'ITG Bima', 'Bima'],
    supercup:   ['ITG_Supercup', 'ITG Supercup', 'Supercup'],
    ps:         ['PS_Achiever', 'PS Achiever', 'PSAchiever'],
    caMaster:   ['CA_Master', 'CA Master', 'CAMaster', 'ca_master'],
    wholesaler: ['Wholesaler', 'wholesaler', 'WS', 'Wholeseler']
  },

  // ── Achievement thresholds ─────────────────────────────────────────────────
  // Used by: Formatter.pillClass(), Formatter.textClass(), Formatter.progColor()
  //          getPillClass(), getTextClass(), getProgColor()
  ACH_GREEN: 90,   // ach >= 90 → green
  ACH_AMBER: 60,   // ach >= 60 → amber; below 60 → red

  // ── Performance status — pace tolerance ───────────────────────────────────
  // Used by: Utils.getPerformanceStatus(), TimeEngine.evalStatus()
  // pp below pace before status escalates from WARNING to DANGER
  WARN_GAP_DEFAULT: 5,

  // ── Trend status thresholds (vsLM %) ──────────────────────────────────────
  // Used by: TrendEngine.calc(), TrendEngine.colorClass(), TrendEngine.hexColor()
  TREND_GROWING:   5,    // vsLM >= 5  → GROWING
  TREND_STABLE:    0,    // vsLM >= 0  → STABLE   (flat or small positive)
  TREND_DECLINING: -15,  // vsLM >= -15 → DECLINING; below → CRITICAL

  // ── TimeEngine sentinel defaults ──────────────────────────────────────────
  // Populated into State.timeEngine when DimDate sheet is absent.
  // Sentinel values (hkTot=1, hkPass=0) produce visible 0% pace output,
  // alerting the operator instead of silently showing plausible-but-wrong numbers.
  TIME_SENTINEL: {
    hkTot:    1,
    hkPass:   0,
    hkRem:    1,
    timeGone: 0,
    source:   'fallback-sentinel',
    valid:    false,
    warnings: ['DimDate belum dimuat. Data Working Days menggunakan sentinel. Upload file dengan sheet DimDate untuk hasil akurat.']
  },

  // ── Section 5 — Executive Decision Center ─────────────────────────────────
  // Used by: KPIEngine.buildRisk(), buildOpportunity(), buildAction(), buildImpact()
  // Do NOT change these without a corresponding spec update in
  //   docs/Section5_ExecutiveDecisionCenter_Spec.md
  EXEC_DECISION: {

    // CA Opportunity: territory qualification thresholds (0–1 active rate)
    CA_ACTIVE_RATE_QUALIFIED:  0.80,  // ≥80% → territory qualifies for executional recovery
    CA_ACTIVE_RATE_PARTIAL:    0.60,  // ≥60% → partial qualification; <60% → structural issue

    // Recovery value decay: inactive outlets self-activate at 10%/day (opportunity cost)
    DECAY_RATE_PER_DAY: 0.10,

    // Call capacity planning
    CALLS_PER_DAY:      8,   // realistic daily call target per supervisor
    MAX_EXPECTED_CALLS: 15,  // max calls used for expectedRevenueToday estimate

    // Role assignment thresholds (IDR) — who owns the recovery action
    ROLE_NSM_THRESHOLD: 5_000_000_000,  // >5B IDR → NSM responsibility
    ROLE_AGM_THRESHOLD: 2_000_000_000,  // 2–5B IDR → AGM; <2B → Supervisor

    // Escalation business rules
    ESCALATION_THRESHOLD:   70,  // achievement % floor — below this triggers escalation
    ESCALATION_WINDOW_DAYS:  2,  // days from today before escalation triggers

    // Action deadline (daily call campaign window)
    ACTION_DEADLINE_TIME: '10:00',

    // Viability threshold: recovery opportunity below this (IDR) no longer justifies AGM time
    MIN_VIABLE_RECOVERY: 1_000_000_000  // 1B IDR floor
  }

};

// RC1.4: expose to window so external guards (if (window.CONSTANTS)) resolve correctly
window.CONSTANTS = CONSTANTS;