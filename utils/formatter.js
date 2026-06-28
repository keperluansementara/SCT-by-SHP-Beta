/**
 * formatter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure display functions: take a value, return a string, CSS class, or hex color.
 * Zero side effects. Zero state reads. Zero DOM access.
 *
 * Source: Utils object (SCT-by-SHP.html lines 924–1067)
 *         Specific methods: fmtCompact, fmtPct, getPillClass, getTextClass,
 *         getProgColor
 *
 * Dependencies:
 *   constants.js  — CONSTANTS.COLORS, CONSTANTS.ACH_GREEN, CONSTANTS.ACH_AMBER
 *
 * Consumers (after integration):
 *   helpers.js        — fmtCompact (used inside TrendEngine.insight, gridHtml)
 *   components.js     — fmtPct, getPillClass, getTextClass, progColor
 *   kpiEngine.js      — fmtPct, fmtCompact
 *   chartEngine.js    — progColor
 *   renderEngine.js   — fmtCompact, fmtPct, getPillClass, getTextClass
 *   infographicEngine.js — fmtCompact, fmtPct
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Formatter = {

  /**
   * fmtCompact(v)
   * Format a large number into compact K / M / B notation.
   * Returns '—' for non-numeric input.
   *
   * Examples:
   *   1_500_000 → "1M"
   *   23_400    → "23K"
   *   875       → "875"
   *   null      → "—"
   *
   * Source: Utils.fmtCompact
   */
  fmtCompact: (v) => {
    if (typeof v !== 'number') return '—';
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toFixed(0);
  },

  /**
   * fmtPct(v)
   * Format a number as a percentage string with 1 decimal place.
   * Returns '—' for null or NaN input.
   *
   * Examples:
   *   87.5  → "87.5%"
   *   null  → "—"
   *   NaN   → "—"
   *
   * Source: Utils.fmtPct
   */
  fmtPct: (v) => v === null || isNaN(v) ? '—' : v.toFixed(1) + '%',

  /**
   * getPillClass(ach)
   * Map an achievement % to its background CSS class.
   * Used for progress bar fills, badge backgrounds.
   *
   * Thresholds (source: Utils.getPillClass):
   *   >= ACH_GREEN (90) → 'bg-green'
   *   >= ACH_AMBER (60) → 'bg-amber'
   *   <  ACH_AMBER      → 'bg-red'
   *
   * Source: Utils.getPillClass
   */
  getPillClass: (ach) => {
    if (ach >= CONSTANTS.ACH_GREEN) return 'bg-green';
    if (ach >= CONSTANTS.ACH_AMBER) return 'bg-amber';
    return 'bg-red';
  },

  /**
   * getTextClass(ach)
   * Map an achievement % to its text color CSS class.
   * Used for KPI value text, table cells.
   *
   * Source: Utils.getTextClass
   */
  getTextClass: (ach) => {
    if (ach >= CONSTANTS.ACH_GREEN) return 'text-green';
    if (ach >= CONSTANTS.ACH_AMBER) return 'text-amber';
    return 'text-red';
  },

  /**
   * getProgColor(ach)
   * Map an achievement % to a hex color string.
   * Used for Chart.js dataset colors and canvas drawing in InfographicEngine.
   *
   * Source: Utils.getProgColor
   * Dependency: CONSTANTS.COLORS
   */
  getProgColor: (ach) => {
    if (ach >= CONSTANTS.ACH_GREEN) return CONSTANTS.COLORS.green;
    if (ach >= CONSTANTS.ACH_AMBER) return CONSTANTS.COLORS.amber;
    return CONSTANTS.COLORS.red;
  }

};
