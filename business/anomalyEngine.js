/**
 * anomalyEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Statistical anomaly detection engine.
 * Scans KPI snapshot for statistical outliers across all business domains
 * using z-score and IQR methods. Also owns the anomaly DOM renderer.
 *
 * Source: AnomalyEngine (SCT-by-SHP.html lines 3477–3787)
 *
 * Dependencies:
 *   utils/helpers.js  — Utils.fmtPct(), Utils.fmtCompact()
 *   state.js          — (no direct read; k = State.kpi passed as parameter)
 *
 * ── Detection methods (5 detectors) ─────────────────────────────────────────
 *   _detectSuddenDrop(k)          — z < −1.5 on principle vsLM distribution
 *   _detectAbnormalGrowth(k)      — z > 2.5 on principle vsLM distribution
 *   _detectCACollapse(k)          — z < −1.5 AND delta < −10% on CA region deltas
 *   _detectZeroTrxSpike(k)        — z > 1.5 on WS zero-trx ratios (floor: 20%)
 *   _detectInconsistentRegion(k)  — IQR Tukey fence on per-principle region ach%
 *
 * ── Severity model ───────────────────────────────────────────────────────────
 *   |z| >= 2.0 → 'critical'
 *   |z|  < 2.0 → 'warning'
 *   Special: ABNORMAL_GROWTH always 'info' (positive deviation)
 *
 * ── Sort order (detect result) ───────────────────────────────────────────────
 *   critical first → warning → info; within same tier by |z| descending
 *
 * Public API:
 *   AnomalyEngine.detect(k)          → Anomaly[]  (sorted)
 *   AnomalyEngine.render(anomalies)  → void (writes to DOM)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const AnomalyEngine = {

  // ── Statistical primitives ────────────────────────────────────────

  /**
   * Stats — pure math helpers, no side effects.
   */
  Stats: {
    mean: (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0,

    variance: (arr) => {
      if (arr.length < 2) return 0;
      const m = AnomalyEngine.Stats.mean(arr);
      return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1);
    },

    stddev: (arr) => Math.sqrt(AnomalyEngine.Stats.variance(arr)),

    /**
     * zscore(val, arr) — z-score of val within population arr.
     * Returns 0 if stddev = 0 (uniform distribution — no anomaly possible).
     */
    zscore: (val, arr) => {
      const sd = AnomalyEngine.Stats.stddev(arr);
      if (sd === 0) return 0;
      return (val - AnomalyEngine.Stats.mean(arr)) / sd;
    },

    /**
     * iqrFenceLow(arr) — lower Tukey fence: Q1 − 1.5 × IQR.
     * Values below this are outliers.
     */
    iqrFenceLow: (arr) => {
      if (arr.length < 4) return -Infinity;
      const s   = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      const q1  = AnomalyEngine.Stats.mean(s.slice(0, mid));
      const q3  = AnomalyEngine.Stats.mean(s.slice(s.length % 2 === 0 ? mid : mid + 1));
      return q1 - 1.5 * (q3 - q1);
    },

    /**
     * pctDev(val, ref) — percentage deviation of val from ref.
     * Returns null if ref = 0.
     */
    pctDev: (val, ref) => ref !== 0 ? ((val - ref) / Math.abs(ref)) * 100 : null,
  },

  // ── Anomaly badge + severity helpers ──────────────────────────────
  _sev: (z) => Math.abs(z) >= 2.0 ? 'critical' : 'warning',
  _label: {
    SUDDEN_DROP:          'Sudden Drop',
    ABNORMAL_GROWTH:      'Abnormal Growth',
    CA_COLLAPSE:          'CA Collapse',
    ZERO_TRX_SPIKE:       'Zero Trx Spike',
    INCONSISTENT_REGION:  'Region Outlier',
  },

  // ── Detector 1: SUDDEN DROP ───────────────────────────────────────
  /**
   * Detects principles whose vsLM is a statistical outlier on the
   * negative tail of the principle-vsLM population.
   * Threshold: z < −1.5 (warning) | z < −2.0 (critical)
   * Min population: 3 principles with LM data.
   */
  _detectSuddenDrop: (k) => {
    const pops = k.perf.byPrin.filter(p => p.trend.hasLM);
    if (pops.length < 3) return [];
    const vsLMs = pops.map(p => p.trend.vsLM);
    const S = AnomalyEngine.Stats;

    return pops
      .map(p => ({ p, z: S.zscore(p.trend.vsLM, vsLMs) }))
      .filter(({ z }) => z < -1.5)
      .map(({ p, z }) => ({
        id:   `drop-${p.principle}`,
        type: 'SUDDEN_DROP',
        severity: AnomalyEngine._sev(z),
        label: AnomalyEngine._label.SUDDEN_DROP,
        area:  `Principle · ${p.principle}`,
        description: `${p.principle} mengalami penurunan abnormal ${p.trend.vsLM.toFixed(1)}% vs LM — jauh di luar pola normal semua principle.`,
        stat:  `z = ${z.toFixed(2)} | vsLM: ${p.trend.vsLM.toFixed(1)}% | Mean: ${S.mean(vsLMs).toFixed(1)}% | σ: ${S.stddev(vsLMs).toFixed(1)}%`,
        zScore: z
      }));
  },

  // ── Detector 2: ABNORMAL GROWTH ───────────────────────────────────
  /**
   * Detects principles with vsLM far above population mean.
   * High growth can indicate data entry errors or channel stuffing.
   * Threshold: z > 2.5 (flag as anomalous, not necessarily bad).
   */
  _detectAbnormalGrowth: (k) => {
    const pops = k.perf.byPrin.filter(p => p.trend.hasLM);
    if (pops.length < 3) return [];
    const vsLMs = pops.map(p => p.trend.vsLM);
    const S = AnomalyEngine.Stats;

    return pops
      .map(p => ({ p, z: S.zscore(p.trend.vsLM, vsLMs) }))
      .filter(({ z }) => z > 2.5)
      .map(({ p, z }) => ({
        id:   `growth-${p.principle}`,
        type: 'ABNORMAL_GROWTH',
        severity: 'info',
        label: AnomalyEngine._label.ABNORMAL_GROWTH,
        area:  `Principle · ${p.principle}`,
        description: `${p.principle} tumbuh ${p.trend.vsLM.toFixed(1)}% vs LM — pertumbuhan di luar batas normal, verifikasi data direkomendasikan.`,
        stat:  `z = ${z.toFixed(2)} | vsLM: +${p.trend.vsLM.toFixed(1)}% | Mean: ${S.mean(vsLMs).toFixed(1)}% | σ: ${S.stddev(vsLMs).toFixed(1)}%`,
        zScore: z
      }));
  },

  // ── Detector 3: CA COLLAPSE ───────────────────────────────────────
  /**
   * Detects CA regions whose delta % is a negative outlier
   * vs the CA-region-delta population.
   * Also enforces absolute threshold: delta < −10% to avoid
   * flagging noise from tiny regions.
   */
  _detectCACollapse: (k) => {
    const regions = k.ca.byReg.filter(r => r.lm > 0);
    if (regions.length < 3) return [];
    const deltas = regions.map(r => r.delta);
    const S = AnomalyEngine.Stats;

    return regions
      .map(r => ({ r, z: S.zscore(r.delta, deltas) }))
      .filter(({ r, z }) => z < -1.5 && r.delta < -10)
      .map(({ r, z }) => ({
        id:   `ca-${r.name}`,
        type: 'CA_COLLAPSE',
        severity: AnomalyEngine._sev(z),
        label: AnomalyEngine._label.CA_COLLAPSE,
        area:  `CA · Region ${r.name}`,
        description: `CA di region ${r.name} turun ${Math.abs(r.delta).toFixed(1)}% vs LM — penurunan ekstrem yang tidak normal dibanding region lain.`,
        stat:  `z = ${z.toFixed(2)} | delta: ${r.delta.toFixed(1)}% | Gap: ${Utils.fmtCompact(r.gap)} | Mean δ: ${S.mean(deltas).toFixed(1)}%`,
        zScore: z
      }));
  },

  // ── Detector 4: ZERO TRX SPIKE ────────────────────────────────────
  /**
   * Detects WS programs where zero-transaction ratio deviates
   * abnormally vs the cross-program expected rate.
   * Cross-program expected: mean of [arj, bim, sc] zero ratios.
   * Also enforces hard floor: zeroRatio > 20% to suppress noise.
   */
  _detectZeroTrxSpike: (k) => {
    const programs = [
      { name: 'Arjuna', d: k.ws.arj },
      { name: 'Bima',   d: k.ws.bim },
      { name: 'Supercup', d: k.ws.sc }
    ].filter(p => p.d.t > 0);

    const ratios = programs.map(p => p.d.t > 0 ? p.d.zro / p.d.t : 0);
    const S = AnomalyEngine.Stats;
    const anomalies = [];

    programs.forEach((p, i) => {
      const ratio = ratios[i];
      if (ratio < 0.2) return;   // hard floor — suppress trivial rates
      const z = S.zscore(ratio, ratios);
      if (z < 1.5) return;       // not an outlier
      anomalies.push({
        id:   `zero-${p.name}`,
        type: 'ZERO_TRX_SPIKE',
        severity: AnomalyEngine._sev(z),
        label: AnomalyEngine._label.ZERO_TRX_SPIKE,
        area:  `WS Program · ${p.name}`,
        description: `${(ratio * 100).toFixed(0)}% WS program ${p.name} belum bertransaksi — proporsi zero-trx ini tidak normal dibanding program lain.`,
        stat:  `z = ${z.toFixed(2)} | zero: ${p.d.zro}/${p.d.t} (${(ratio*100).toFixed(0)}%) | Mean: ${(S.mean(ratios)*100).toFixed(0)}%`,
        zScore: z
      });
    });

    return anomalies;
  },

  // ── Detector 5: INCONSISTENT REGION ──────────────────────────────
  /**
   * Within each principle, detects regions whose ach% falls below
   * the IQR lower fence (Tukey outlier) of that principle's region distribution.
   * Min 4 regions per principle to compute meaningful IQR.
   * Reports max 1 outlier per principle (the worst one).
   */
  _detectInconsistentRegion: (k) => {
    const anomalies = [];
    const S = AnomalyEngine.Stats;

    k.perf.byPrin.forEach(pr => {
      if (!pr.byReg || pr.byReg.length < 4) return;
      const achs  = pr.byReg.map(r => r.ach);
      const fence = S.iqrFenceLow(achs);
      const outliers = pr.byReg.filter(r => r.ach < fence);
      if (!outliers.length) return;

      const worst = outliers.sort((a, b) => a.ach - b.ach)[0];
      const mean  = S.mean(achs);
      const z     = S.zscore(worst.ach, achs);

      anomalies.push({
        id:   `ireg-${pr.principle}-${worst.region}`,
        type: 'INCONSISTENT_REGION',
        severity: Math.abs(z) >= 2 ? 'critical' : 'warning',
        label: AnomalyEngine._label.INCONSISTENT_REGION,
        area:  `${pr.principle} · Region ${worst.region}`,
        description: `Region ${worst.region} (${Utils.fmtPct(worst.ach)}) menjadi outlier dalam distribusi ${pr.principle} — capaiannya secara statistik tidak konsisten dengan region lain.`,
        stat:  `z = ${z.toFixed(2)} | ach: ${Utils.fmtPct(worst.ach)} | Avg: ${Utils.fmtPct(mean)} | IQR fence: ${Utils.fmtPct(fence)}`,
        zScore: z
      });
    });

    return anomalies;
  },

  // ── Main entry: detect(k) ─────────────────────────────────────────

  /**
   * detect(k) — run all 5 detectors, merge, sort by severity.
   * @param {object} k  State.kpi
   * @returns {Anomaly[]}  sorted: critical first, then warning, then info
   */
  detect: (k) => {
    const all = [
      ...AnomalyEngine._detectSuddenDrop(k),
      ...AnomalyEngine._detectAbnormalGrowth(k),
      ...AnomalyEngine._detectCACollapse(k),
      ...AnomalyEngine._detectZeroTrxSpike(k),
      ...AnomalyEngine._detectInconsistentRegion(k),
    ];

    // Deduplicate by id
    const seen = new Set();
    const unique = all.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });

    // Sort: critical > warning > info; within same tier by |z| desc
    const sevOrder = { critical: 0, warning: 1, info: 2 };
    return unique.sort((a, b) => {
      const sd = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
      return sd !== 0 ? sd : Math.abs(b.zScore ?? 0) - Math.abs(a.zScore ?? 0);
    });
  },

  // ── Render: write anomalies to DOM ────────────────────────────────

  /**
   * render(anomalies) — writes to the anomaly strip DOM.
   * Shows/hides strip, writes count badge, tags, and full card list.
   * Called by RenderEngine.anomalies(k) on every filter change.
   */
  render: (anomalies) => {
    const strip    = document.getElementById('anomaly-strip');
    const countEl  = document.getElementById('anomaly-count-badge');
    const tagsEl   = document.getElementById('anomaly-tags');
    const listEl   = document.getElementById('anomaly-list');
    const badgeEl  = document.getElementById('perf-anomaly-badge');

    if (!strip) return;

    if (!anomalies.length) {
      strip.style.display = 'none';
      if (badgeEl) badgeEl.style.display = 'none';
      return;
    }

    strip.style.display = 'block';

    // Count badge
    if (countEl) countEl.textContent = `${anomalies.length} anomaly`;

    // Section 1 badge
    if (badgeEl) {
      const crit = anomalies.filter(a => a.severity === 'critical').length;
      badgeEl.textContent = `🔬 ${anomalies.length} Anomaly${crit ? ` (${crit} kritis)` : ''}`;
      badgeEl.style.display = 'inline-block';
    }

    // Tags row — one pill per anomaly type present
    const types = [...new Set(anomalies.map(a => a.label))];
    if (tagsEl) {
      tagsEl.innerHTML = types.map(t => {
        const hasCrit = anomalies.some(a => a.label === t && a.severity === 'critical');
        const clr     = hasCrit ? 'var(--red-main)' : 'var(--amber-main)';
        return `<span style="font-size:9px;background:rgba(255,255,255,.08);color:${clr};padding:2px 7px;border-radius:10px;font-weight:700;white-space:nowrap">${t}</span>`;
      }).join('');
    }

    // Full card list
    if (listEl) {
      listEl.innerHTML = anomalies.map(a => {
        const sevCls   = a.severity;
        const lblCls   = a.severity === 'info' ? 'info' : a.severity === 'critical' ? 'critical' : 'warning';
        const zBarW    = Math.min(100, Math.abs(a.zScore ?? 0) / 3 * 100);
        const zBarClr  = a.severity === 'critical' ? 'var(--red-main)' : a.severity === 'warning' ? 'var(--amber-main)' : '#7C3AED';
        return `
          <div class="anomaly-card sev-${sevCls}">
            <div class="anomaly-card-header">
              <span class="anomaly-label ${lblCls}">${a.label}</span>
              <span class="anomaly-area" title="${a.area}">${a.area}</span>
            </div>
            <div class="anomaly-desc">${a.description}</div>
            <div class="anomaly-stat"><strong>${a.stat}</strong></div>
            <div style="height:3px;background:rgba(255,255,255,.08);border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${zBarW}%;background:${zBarClr};border-radius:2px;transition:width .4s"></div>
            </div>
          </div>`;
      }).join('');
    }
  }
};
