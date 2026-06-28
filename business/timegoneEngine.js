// ==========================================
// BUSINESS LAYER — timegoneEngine.js
// ==========================================
// Source: index.html
//   TimeEngine  — lines 2232–2331
//   TrendEngine — lines 2350–2510
// Extracted: Utility Extraction Phase B
//
// Exposes globals: TimeEngine, TrendEngine
// Dependencies:
//   State  (TimeEngine.get() reads State.timeEngine — lazy)
//   Config (TimeEngine uses Config.COLORS — lazy)
//   Utils  (TrendEngine uses Utils.safeNum, Utils.fmtCompact, Utils.fmtPct — lazy)
// ==========================================

const TimeEngine = {

  /**
   * get() — returns a clean, validated snapshot of all time/pace data.
   * Safe to destructure in KPI calculations.
   * @returns {{
   *   hkTot: number, hkPass: number, hkRem: number,
   *   timeGone: number, source: string, valid: boolean, warnings: string[]
   * }}
   */
  get: () => {
    const te = State.timeEngine;
    // Defensive: ensure derived fields are always consistent
    const hkTot  = Math.max(1, Math.round(te.hkTot  || 1));
    const hkPass = Math.max(0, Math.round(te.hkPass || 0));
    const hkRem  = Math.max(0, Math.round(te.hkRem  != null ? te.hkRem : Math.max(0, hkTot - hkPass)));
    // timeGone: prefer DimDate-supplied value; derive as fallback
    const timeGone = (typeof te.timeGone === 'number' && te.timeGone >= 0 && te.timeGone <= 100)
      ? te.timeGone
      : (hkTot > 0 ? (hkPass / hkTot) * 100 : 0);

    return {
      hkTot,
      hkPass,
      hkRem,
      timeGone,
      source:   te.source   || 'fallback-sentinel',
      valid:    te.valid    || false,
      warnings: te.warnings || []
    };
  },

  /**
   * pace() — the canonical "pace benchmark" %.
   * This is the number all achievement % values are compared against.
   * Formula: timeGone (% of period elapsed based on working days)
   * @returns {number} 0–100
   */
  pace: () => TimeEngine.get().timeGone,

  /**
   * evalStatus() — evaluate achievement vs pace with configurable tolerance.
   * GOOD    → ach >= pace
   * WARNING → ach < pace AND gap >= -warnGap (within tolerance)
   * DANGER  → ach < pace AND gap < -warnGap
   *
   * Delegates to Utils.getPerformanceStatus() for consistent CSS class mapping.
   * @param {number} ach       Achievement % (0–100+)
   * @param {number} [warnGap=5]  pp below pace before DANGER threshold
   * @returns {{ status: string, cssClass: string, badgeCls: string, icon: string, gap: number }}
   */
  evalStatus: (ach, warnGap = 5) => Utils.getPerformanceStatus(ach, TimeEngine.pace(), warnGap),

  /**
   * runRate() — required run-rate per remaining working day to close a gap.
   * @param {number} gap     Absolute gap value (target - actual, positive)
   * @param {number} [hkRem] Override remaining HK (defaults to TimeEngine.get().hkRem)
   * @returns {number}
   */
  runRate: (gap, hkRem) => {
    const rem = hkRem != null ? hkRem : TimeEngine.get().hkRem;
    return rem > 0 ? Math.abs(gap) / rem : 0;
  },

  /**
   * actualRR() — actual run-rate per elapsed working day.
   * @param {number} actual   Cumulative actual value
   * @param {number} [hkPass] Override elapsed HK (defaults to TimeEngine.get().hkPass)
   * @returns {number}
   */
  actualRR: (actual, hkPass) => {
    const pass = hkPass != null ? hkPass : TimeEngine.get().hkPass;
    return pass > 0 ? actual / pass : 0;
  },

  /**
   * fmt() — pre-formatted display strings for UI rendering.
   * Keeps display logic out of RenderEngine and KPIEngine.
   * @returns {{
   *   hkLabel: string,       e.g. "WD 15/23 ✓"
   *   timeGoneLabel: string, e.g. "Time Gone: 65.2%"
   *   hkRemLabel: string,    e.g. "Sisa 8 HK"
   *   sourceTag: string,     e.g. "DimDate ✓" or "⚠ Fallback"
   *   warnTag: string        e.g. "" or " ⚠"
   * }}
   */
  fmt: () => {
    const { hkTot, hkPass, hkRem, timeGone, source, valid } = TimeEngine.get();
    const isReal   = source === 'DimDate' || source === 'DimDate-partial';
    const checkMark = isReal ? ' ✓' : ' (default)';
    const warnTag   = valid  ? ''   : ' ⚠';
    return {
      hkLabel:       `Working Day ${hkPass} / ${hkTot}${checkMark}`,
      timeGoneLabel: `Time Gone: ${Utils.fmtPct(timeGone)}`,
      hkRemLabel:    `Sisa ${hkRem} HK`,
      sourceTag:     isReal ? `DimDate ✓` : `⚠ Fallback (default)`,
      warnTag
    };
  }
};

// ==========================================
// 5. TREND ENGINE — Centralized Growth Analysis
// ==========================================
/**
 * TrendEngine
 * Single source of truth for all growth / vs-LM / vs-LY calculations.
 * Eliminates duplicate calcGrowth() calls scattered across KPIEngine
 * and RenderEngine. ALL trend math and coloring flows through here.
 *
 * Public API:
 *   TrendEngine.calc(current, lm, ly)   → full trend object
 *   TrendEngine.pill(pct)               → colored pill HTML
 *   TrendEngine.insight(trend, label)   → mini narrative string
 *   TrendEngine.colorClass(pct)         → CSS text color class
 *   TrendEngine.hexColor(pct)           → hex string for canvas use
 *   TrendEngine.gridHtml(trend)         → 2×2 LM/LY grid HTML block
 */
const TrendEngine = {

  /**
   * calc(current, lm, ly) — compute full trend snapshot.
   *
   * trendStatus rules (based on vsLM):
   *   GROWING   vsLM >=  5%
   *   STABLE    vsLM >=  0%  (flat or small positive)
   *   DECLINING vsLM >= -15% (moderate decline)
   *   CRITICAL  vsLM <  -15% (severe decline)
   *
   * @param {number}      current  Current period actual value
   * @param {number|null} lm       Last month HK-adjusted actual (0 or null = no data)
   * @param {number|null} ly       Last year HK-adjusted actual  (0 or null = no data)
   *
   * @returns {{
   *   vsLM:        number|null,   — % growth vs LM (null if lm unavailable)
   *   vsLY:        number|null,   — % growth vs LY (null if ly unavailable)
   *   gapLM:       number|null,   — absolute gap vs LM (current - lm)
   *   gapLY:       number|null,   — absolute gap vs LY (current - ly)
   *   trendStatus: string,        — 'GROWING' | 'STABLE' | 'DECLINING' | 'CRITICAL'
   *   trendIcon:   string,        — emoji prefix for the status
   *   hasLM:       boolean,
   *   hasLY:       boolean
   * }}
   */
  calc: (current, lm, ly) => {
    const cur = Utils.safeNum(current);

    // ── vs LM ──
    const hasLM  = lm != null && lm !== 0;
    const vsLM   = hasLM  ? ((cur - lm)  / Math.abs(lm))  * 100 : null;
    const gapLM  = hasLM  ? cur - lm  : null;

    // ── vs LY ──
    const hasLY  = ly != null && ly !== 0;
    const vsLY   = hasLY  ? ((cur - ly)  / Math.abs(ly))  * 100 : null;
    const gapLY  = hasLY  ? cur - ly  : null;

    // ── Trend status — driven by vsLM (primary signal) ──
    let trendStatus, trendIcon;
    if (vsLM === null) {
      trendStatus = 'NO_DATA'; trendIcon = '⬜';
    } else if (vsLM >= 5) {
      trendStatus = 'GROWING';  trendIcon = '📈';
    } else if (vsLM >= 0) {
      trendStatus = 'STABLE';   trendIcon = '➡️';
    } else if (vsLM >= -15) {
      trendStatus = 'DECLINING'; trendIcon = '📉';
    } else {
      trendStatus = 'CRITICAL'; trendIcon = '🔻';
    }

    return { vsLM, vsLY, gapLM, gapLY, trendStatus, trendIcon, hasLM, hasLY };
  },

  /**
   * colorClass(pct) — returns CSS text color class for a growth %.
   * Consistent coloring used across pills, grid values, and inline text.
   *   >= 5%   → text-green
   *   >= 0%   → text-amber   (flat / small positive)
   *   >= -15% → text-amber   (moderate decline — warning, not red)
   *   <  -15% → text-red     (severe)
   * @param {number|null} pct
   * @returns {string}
   */
  colorClass: (pct) => {
    if (pct === null || pct === undefined) return 'text-gray-500';
    if (pct >= 5)   return 'text-green';
    if (pct >= 0)   return 'text-amber';
    if (pct >= -15) return 'text-amber';
    return 'text-red';
  },

  /**
   * hexColor(pct) — hex color for canvas / chart rendering.
   * @param {number|null} pct
   * @returns {string}
   */
  hexColor: (pct) => {
    if (pct === null || pct === undefined) return Config.COLORS.gray;
    if (pct >= 5)   return Config.COLORS.green;
    if (pct >= -15) return Config.COLORS.amber;
    return Config.COLORS.red;
  },

  /**
   * pill(pct) — renders a colored pill badge for a growth %.
   * Replaces the scattered inline growthPill() helpers.
   * @param {number|null} pct
   * @returns {string} HTML
   */
  pill: (pct) => {
    if (pct === null || pct === undefined) {
      return '<span style="color:var(--gray-300);font-size:10px">—</span>';
    }
    const cls = pct >= 5 ? 'bg-green' : pct >= 0 ? 'bg-amber' : pct >= -15 ? 'bg-amber' : 'bg-red';
    return `<span class="pill ${cls}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>`;
  },

  /**
   * insight(trend, label, isQty) — one-line narrative about trend momentum.
   * Used in kpi-delta / kpi-sub slots to give quick context.
   *
   * Examples:
   *   "📈 +12% vs LM (+45M)"
   *   "🔻 Actual masih -14B vs LM"
   *   "📉 Turun -8.2% vs LM (-3.2M)"
   *   "➡️ Flat vs LM (+0.3%)"
   *
   * @param {object}  trend    Result of TrendEngine.calc()
   * @param {boolean} [isQty=false]  Format gap as integer qty if true
   * @returns {string}  Plain text — safe to use with setTxt()
   */
  insight: (trend, isQty = false) => {
    if (!trend.hasLM) return '— LM tidak tersedia';

    const pct     = trend.vsLM;
    const gap     = trend.gapLM;
    const gapFmt  = isQty
      ? (gap >= 0 ? '+' : '') + Math.round(gap).toLocaleString('id-ID') + ' unit'
      : (gap >= 0 ? '+' : '') + Utils.fmtCompact(gap);

    if (pct >= 5) {
      return `${trend.trendIcon} +${pct.toFixed(1)}% vs LM (${gapFmt})`;
    } else if (pct >= 0) {
      return `${trend.trendIcon} Flat vs LM (${gapFmt})`;
    } else if (pct >= -15) {
      return `${trend.trendIcon} Turun ${pct.toFixed(1)}% vs LM (${gapFmt})`;
    } else {
      return `${trend.trendIcon} Actual masih ${gapFmt} vs LM`;
    }
  },

  /**
   * gridHtml(trend) — renders the standardized 2×2 LM/LY comparison grid.
   * Used in the Wholesaler Growth card and anywhere vs-LM + vs-LY are shown together.
   * Eliminates the duplicate inline grid HTML in RenderEngine.wholesaler().
   * @param {object} trend  Result of TrendEngine.calc()
   * @returns {string} HTML
   */
  gridHtml: (trend) => {
    const vsLMStr  = trend.hasLM  ? `${trend.vsLM  >= 0 ? '+' : ''}${trend.vsLM.toFixed(1)}%`        : '—';
    const gapLMStr = trend.hasLM  ? `${trend.gapLM >= 0 ? '+' : ''}${Utils.fmtCompact(trend.gapLM)}` : '—';
    const vsLYStr  = trend.hasLY  ? `${trend.vsLY  >= 0 ? '+' : ''}${trend.vsLY.toFixed(1)}%`        : '—';
    const gapLYStr = trend.hasLY  ? `${trend.gapLY >= 0 ? '+' : ''}${Utils.fmtCompact(trend.gapLY)}` : '—';
    const lmCls    = TrendEngine.colorClass(trend.vsLM);
    const lyCls    = TrendEngine.colorClass(trend.vsLY);
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;font-size:10px">
        <span style="color:var(--gray-500)">vs LM</span>
        <span style="color:var(--gray-500)">Gap LM</span>
        <span class="font-mono ${lmCls}" style="font-weight:700">${vsLMStr}</span>
        <span class="font-mono ${lmCls}" style="font-weight:700">${gapLMStr}</span>
        <span style="color:var(--gray-500);margin-top:4px">vs LY</span>
        <span style="color:var(--gray-500);margin-top:4px">Gap LY</span>
        <span class="font-mono ${lyCls}" style="font-weight:700">${vsLYStr}</span>
        <span class="font-mono ${lyCls}" style="font-weight:700">${gapLYStr}</span>
      </div>`;
  }
};
