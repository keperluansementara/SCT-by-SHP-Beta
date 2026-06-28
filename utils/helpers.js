// ==========================================
// UTILITY LAYER — helpers.js
// ==========================================
// Source: index.html lines 2070–2213
// Extracted: Utility Extraction Phase A
//
// Exposes global: Utils
// Dependencies: TimeEngine (lazy — resolved at call time via getPaceClass)
// ==========================================

const Utils = {
  safeNum: (v) => typeof v === 'number' && !isNaN(v) ? v : 0,

  // safeDiv — guarded division. Returns `fallback` when denominator is 0/invalid.
  // Used by BB5 Class growth/contribution math to avoid Infinity/NaN.
  safeDiv: (num, den, fallback = null) => {
    const n = Utils.safeNum(num), d = Utils.safeNum(den);
    return d === 0 ? fallback : n / d;
  },
  
  fmtCompact: (v) => {
    if (typeof v !== 'number') return '—';
    const abs = Math.abs(v);
    if (abs >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (v / 1e6).toFixed(0) + 'M';
    if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'K';
    return v.toFixed(0);
  },

  fmtPct: (v) => v === null || isNaN(v) ? '—' : v.toFixed(1) + '%',
  
  calcAch: (act, tgt) => tgt > 0 ? (act / tgt) * 100 : 0,
  calcGrowth: (act, lm) => lm !== 0 ? ((act - lm) / Math.abs(lm)) * 100 : 0,

  getPillClass: (ach) => ach >= 90 ? 'bg-green' : ach >= 60 ? 'bg-amber' : 'bg-red',
  // Item 2: pace-aware region achievement coloring (Gap vs Timegone). Region chart only.
  getPaceClass: (ach) => {
    const gap = ach - TimeEngine.pace();
    return gap >= 10 ? 'bg-green' : gap >= -5 ? 'bg-navy' : gap >= -15 ? 'bg-amber' : 'bg-red';
  },
  getTextClass: (ach) => ach >= 90 ? 'text-green' : ach >= 60 ? 'text-amber' : 'text-red',
  getProgColor: (ach) => ach >= 90 ? Config.COLORS.green : ach >= 60 ? Config.COLORS.amber : Config.COLORS.red,

  groupBy: (arr, keyStr, sumCols) => {
    return arr.reduce((acc, row) => {
      const k = (row[keyStr] || 'Unknown').toString().trim();
      if (!acc[k]) { acc[k] = {}; sumCols.forEach(c => acc[k][c] = 0); }
      sumCols.forEach(c => acc[k][c] += Utils.safeNum(row[c]));
      return acc;
    }, {});
  },

  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => { clearTimeout(timeout); func(...args); };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * getPerformanceStatus — Centralized Performance Status Engine
   *
   * Single reusable evaluator for all Ach% vs TimeGone% comparisons.
   * Consumed by: TimeEngine.evalStatus(), KPIEngine (per-principle),
   *              RenderEngine (Stat col, TG card, alert banner, priority action).
   *
   * Rules (fixed thresholds, warnGap configurable, default = 5pp):
   *   GOOD    → ach >= timeGone           (on pace or ahead)
   *   WARNING → ach >= timeGone - warnGap (within tolerance, falling behind)
   *   DANGER  → ach <  timeGone - warnGap (significantly behind pace)
   *
   * @param {number} ach      Achievement % (0–100+)
   * @param {number} timeGone Time Gone / Pace benchmark % (0–100)
   * @param {number} [warnGap=5]  pp below pace before escalating to DANGER
   *
   * @returns {{
   *   status:       'GOOD' | 'WARNING' | 'DANGER',
   *   icon:         string,   — emoji traffic light  🟢 🟠 🔴
   *   label:        string,   — display-ready full label e.g. "🟢 GOOD"
   *   color:        string,   — hex color for use in charts / canvas drawing
   *   gap:          number,   — ach - timeGone (positive = ahead, negative = behind)
   *   severityScore: number,  — 0 (best) to 100 (worst); continuous scale for sorting
   *   statCls:      string,   — solid badge CSS class  (stat-good / stat-warning / stat-danger)
   *   statMutedCls: string,   — muted badge CSS class  (stat-good-muted / …)
   *   cssClass:     string,   — legacy: tg-good / tg-warn / tg-danger (backward compat)
   *   badgeCls:     string,   — legacy: bg-green / bg-amber / bg-red   (backward compat)
   * }}
   */
  getPerformanceStatus: (ach, timeGone, warnGap = 5) => {
    const gap = ach - timeGone; // positive = ahead of pace

    // ── Severity score: 0 = perfectly on target, 100 = catastrophically behind ──
    // GOOD zone:    score 0   (no severity — on or ahead of pace)
    // WARNING zone: score linearly 1–49 based on depth within warning band
    // DANGER zone:  score linearly 50–100 based on depth beyond DANGER threshold
    let severityScore;
    if (gap >= 0) {
      severityScore = 0;
    } else if (gap >= -warnGap) {
      // 0 at boundary (gap = 0), 49 at warning edge (gap = -warnGap)
      severityScore = Math.round((Math.abs(gap) / warnGap) * 49);
    } else {
      // 50 at danger boundary, 100 at gap = -(warnGap + 50pp)
      const depth = Math.abs(gap) - warnGap;
      severityScore = Math.min(100, 50 + Math.round((depth / 50) * 50));
    }

    if (gap >= 0) {
      return {
        status:        'GOOD',
        icon:          '🟢',
        label:         '🟢 GOOD',
        color:         '#1E8449',
        gap,
        severityScore,
        statCls:       'stat-good',
        statMutedCls:  'stat-good-muted',
        // ── backward compat ──
        cssClass:  'tg-good',
        badgeCls:  'bg-green'
      };
    } else if (gap >= -warnGap) {
      return {
        status:        'WARNING',
        icon:          '🟠',
        label:         '🟠 WARNING',
        color:         '#D35400',
        gap,
        severityScore,
        statCls:       'stat-warning',
        statMutedCls:  'stat-warning-muted',
        // ── backward compat ──
        cssClass:  'tg-warn',
        badgeCls:  'bg-amber'
      };
    } else {
      return {
        status:        'DANGER',
        icon:          '🔴',
        label:         '🔴 DANGER',
        color:         '#C0392B',
        gap,
        severityScore,
        statCls:       'stat-danger',
        statMutedCls:  'stat-danger-muted',
        // ── backward compat ──
        cssClass:  'tg-danger',
        badgeCls:  'bg-red'
      };
    }
  }
};
