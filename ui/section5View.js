/**
 * section5View.js — v5 (Sprint 16 · Opportunity Context + Design Token Cleanup)
 * ─────────────────────────────────────────────────────────────────────────────
 * Section 5 — Executive Decision Center
 *
 * Sprint 15 changes (4 approved fixes — no KPI/formula/layout changes):
 *   FIX 1 (MAJOR) — Risk badge now uses ED Contract risk.classification as
 *                   single source of truth. _classifyRisk() added; _riskLevel()
 *                   retained as fallback when ED contract not yet loaded.
 *   FIX 2 (MAJOR) — Opportunity context note shown when totalRecoveryValue=0
 *                   and State.filters.principles.size > 0 (principle filter active).
 *   FIX 3 (MINOR) — deltaFmt + delta count-up use Math.max(0,…) to prevent
 *                   the '+-0.0pp' display artifact.
 *   FIX 4 (MINOR) — Negative totAct shows '⚠ Data Anomaly' in hero area;
 *                   displayAnomalyFlags prepends context flag; count-up guarded.
 * Also: trailing garbage from Sprint 13 bash append removed (lines 991–1014).
 *
 * Layout (Editorial Tier — Concept 5):
 *   Row 1: Risk headline  — full width, NO border, status-tinted bg, left accent bar
 *   Row 2: Opportunity    | Action — 2 columns (white card | gray card)
 *   Row 3: Impact footer  — full width, dark bg (#2C2C2A), 3-col arrow narrative
 *
 * OODA Loop mapping:
 *   Observe  → 🚨 Risiko Terbesar  — "The Situation"
 *   Orient   → 🎯 Peluang Terbesar — "The Business Potential"
 *   Decide   → ⚡ Keputusan        — "The Decision"
 *   Act      → 💰 Dampak           — "The Consequence"
 *
 * Data contract (Sprint 13 — live binding):
 *   Reads from State.kpi.executiveDecision for all new fields.
 *   Reads State.kpi.perf and State.kpi.ca for existing display fields (backward compat).
 *   NEVER reads State.filtered.* or calls KPIEngine directly.
 *   NEVER performs business calculations (KPI Principle P2).
 *   Uses TimeEngine.evalStatus() for display classification ONLY.
 *
 * Fields consumed:
 *   k.executiveDecision — { meta, risk, opportunity, action, impact }
 *   k.perf              — ach, gap, actRR, reqRR, totAct, totTgt  (existing)
 *   k.ca                — zero, tot, lm, delta  (guarded: may be null)
 *   td = TimeEngine.get() — hkPass, hkRem, hkTot, timeGone
 *
 * Design System compliance (SCT v6 DesignSystem.md):
 *   Typography: 400 labels · 500 values/heroes · 700 badges/pills ONLY
 *   Headline Zone: no card border · left accent bar · status-tinted bg at 8%
 *   Badges: light-bg + dark-text (§3.2)
 *   Zone gap: 8px
 *   Card border-radius: 12px
 *   Impact footer: 3-col arrow narrative
 *   Animations: count-up 800ms ease-out once · badge pulse 300ms once
 *
 * Dependencies: State, Utils, TimeEngine (runtime globals)
 * Entry point:  Section5View.render(k) via RenderEngine._safeRender()
 * DOM target:   #s5-container — innerHTML replaced on every render
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Section5View = {

  // ══════════════════════════════════════════════════════════════════════════
  // MODULE STATE
  // ══════════════════════════════════════════════════════════════════════════

  /** Prevents count-up animation from re-firing on filter changes */
  _mounted: false,

  // ══════════════════════════════════════════════════════════════════════════
  // STYLE INJECTION — idempotent, runs once per session
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * _injectStyles() — appends s5-* CSS classes to <head> once.
   * Centralises design tokens, eliminates repeated inline style duplication.
   */
  _injectStyles: () => {
    if (document.getElementById('s5-styles')) return;
    const style = document.createElement('style');
    style.id = 's5-styles';
    style.textContent = `
      /* ── Labels ─────────────────────────────────────────────────────────── */
      .s5-label {
        font-size: 10px; font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.08em;
        color: var(--gray-500);
      }
      .s5-row-lbl {
        font-size: 9px; font-weight: 400;
        text-transform: uppercase; letter-spacing: 0.04em;
        color: var(--gray-400); margin-bottom: 3px;
      }
      .s5-row-lbl-dark {
        font-size: 9px; font-weight: 400;
        text-transform: uppercase; letter-spacing: 0.04em;
        color: #888780; margin-bottom: 4px;
      }

      /* ── Mono numerics ───────────────────────────────────────────────────── */
      .s5-mono {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
      }

      /* ── Cards ───────────────────────────────────────────────────────────── */
      .s5-card {
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 16px;
        box-shadow: var(--shadow-sm);
        transition: border-color 150ms ease;
      }
      .s5-card:hover    { border-color: var(--gray-300); }
      .s5-card-white    { background: var(--white); }
      .s5-card-gray     { background: var(--gray-50); }

      /* ── Badges — light-bg + dark-text (DesignSystem §3.2) ──────────────── */
      .s5-badge {
        display: inline-block;
        font-size: 9px; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.10em;
        padding: 2px 8px; border-radius: 4px;
      }
      .s5-badge-critical { background: var(--s5-critical-bg); color: var(--s5-critical-color); }
      .s5-badge-atrisk   { background: var(--s5-atrisk-bg); color: var(--s5-atrisk-color); }
      .s5-badge-ontrack  { background: var(--s5-ontrack-bg); color: var(--s5-ontrack-color); }
      .s5-badge-actnow   { background: var(--s5-ontrack-bg); color: var(--s5-ontrack-color); }
      .s5-badge-proceed  { background: var(--s5-atrisk-bg); color: var(--s5-atrisk-color); }
      .s5-badge-escalate { background: var(--s5-critical-bg); color: var(--s5-critical-color); }
      .s5-badge-info     { background: var(--s5-note-bg); color: var(--s5-note-color); }

      /* ── Dividers ────────────────────────────────────────────────────────── */
      .s5-divider      { height: 0.5px; background: var(--border-color); margin: 8px 0; }
      .s5-divider-dark { height: 1px;   background: #444441;             margin: 8px 0; }

      /* ── Progress bar (Risk zone) ────────────────────────────────────────── */
      .s5-progress-track {
        position: relative; height: 4px;
        background: rgba(0,0,0,0.12); border-radius: 2px;
        overflow: visible; margin: 8px 0 14px;
      }
      .s5-progress-fill {
        position: absolute; left: 0; top: 0;
        height: 100%; border-radius: 2px; max-width: 100%;
        transition: width 400ms ease-out;
      }
      .s5-progress-tick {
        position: absolute; top: -3px;
        width: 1px; height: 10px;
        background: rgba(0,0,0,0.3);
        transform: translateX(-50%);
      }
      .s5-progress-labels {
        display: flex; justify-content: space-between;
        font-size: 9px; font-weight: 400; color: var(--gray-400);
      }

      /* ── Territory table ─────────────────────────────────────────────────── */
      .s5-terr-table { width: 100%; border-collapse: collapse; }
      .s5-terr-table th {
        font-size: 8px; font-weight: 500;
        text-transform: uppercase; letter-spacing: 0.06em;
        color: var(--gray-400); padding-bottom: 4px;
      }
      .s5-terr-table td { padding: 2px 0; }

      /* ── Animations — once on mount only ────────────────────────────────── */
      @keyframes s5-badge-pulse {
        0%, 100% { transform: scale(1); }
        50%       { transform: scale(1.05); }
      }
      .s5-badge-pulse-once { animation: s5-badge-pulse 300ms ease-in-out 1; }

      /* ── Tooltip (CSS-only, no JS) ───────────────────────────────────────── */
      [data-s5-tip]         { position: relative; cursor: help; }
      [data-s5-tip]::after  {
        content: attr(data-s5-tip);
        display: none;
        position: absolute; bottom: calc(100% + 4px); left: 50%;
        transform: translateX(-50%);
        background: #2C2C2A; color: #D3D1C7;
        font-size: 11px; font-weight: 400; line-height: 1.5;
        padding: 6px 10px; border-radius: 6px;
        max-width: 220px; width: max-content;
        z-index: 999; pointer-events: none;
      }
      [data-s5-tip]:hover::after { display: block; }

      /* -- Section 5 Status Design Tokens (Sprint 16) ----------------------- */
      :root {
        /* CRITICAL status - UNREACHABLE shares these same tokens */
        --s5-critical-color:  #A32D2D;
        --s5-critical-accent: #E24B4A;
        --s5-critical-bg:     #FCEBEB;
        --s5-critical-zone:   rgba(226,75,74,0.08);
        /* AT_RISK status */
        --s5-atrisk-color:    #633806;
        --s5-atrisk-accent:   #BA7517;
        --s5-atrisk-bg:       #FAEEDA;
        --s5-atrisk-zone:     rgba(186,117,23,0.08);
        /* ON_TRACK status */
        --s5-ontrack-color:   #27500A;
        --s5-ontrack-accent:  #639922;
        --s5-ontrack-bg:      #EAF3DE;
        --s5-ontrack-zone:    rgba(99,153,34,0.08);
        /* Opportunity card */
        --s5-opp-color:       #3B6D11;
        /* Info / context note (also used by .s5-badge-info) */
        --s5-note-bg:         #E6F1FB;
        --s5-note-color:      #185FA5;
      }

      /* ── States ──────────────────────────────────────────────────────────── */
      .s5-pending { color: var(--gray-300); font-size: 10px; font-style: italic; }

      /* ── Impact footer ───────────────────────────────────────────────────── */
      .s5-impact-footer {
        background: #2C2C2A;
        border-radius: 12px;
        padding: 14px 20px;
        box-shadow: var(--shadow-sm);
      }
    `;
    document.head.appendChild(style);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMATIONS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * _countUp(elementId, targetNum, unit, decimals, duration)
   * Counts from 0 → targetNum over <duration>ms with cubic ease-out.
   * Fires ONCE on first mount — guarded by _mounted flag in render().
   *
   * @param {string} elementId   Target element id
   * @param {number} targetNum   Final numeric value (e.g. 87.3)
   * @param {string} unit        Suffix appended to formatted value (e.g. '%')
   * @param {number} decimals    Decimal places for toFixed
   * @param {number} duration    Animation duration in ms
   */
  _countUp: (elementId, targetNum, unit = '%', decimals = 1, duration = 800) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = performance.now();
    const update = (now) => {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out
      el.textContent = (ease * targetNum).toFixed(decimals) + unit;
      if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  /**
   * _countUpFmt(elementId, targetNum, formatter, duration)
   * Like _countUp but accepts a custom formatter function.
   * Used for compact IDR recovery value animation.
   *
   * @param {string}   elementId  Target element id
   * @param {number}   targetNum  Final numeric value
   * @param {function} formatter  v => string — converts intermediate value to display text
   * @param {number}   duration   Animation duration in ms
   */
  _countUpFmt: (elementId, targetNum, formatter, duration = 800) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = performance.now();
    const update = (now) => {
      const t    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      el.textContent = formatter(ease * targetNum);
      if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * _riskLevel(ach) — maps TimeEngine.evalStatus() to design-system tokens.
   * Reuses existing business logic via TimeEngine — no new thresholds defined here.
   *
   * Accent bar (lighter):   CRITICAL #E24B4A | AT_RISK #BA7517 | ON_TRACK #639922
   * Hero / badge text (darker): CRITICAL #A32D2D | AT_RISK #633806 | ON_TRACK #27500A
   *
   * @param  {number} ach  Achievement % (0–100+)
   * @returns {{ label, badgeCls, color, accent, zoneBg }}
   */
  _riskLevel: (ach) => {
    const ev = TimeEngine.evalStatus(ach);
    if (ev.status === 'DANGER') return {
      label: 'CRITICAL', badgeCls: 's5-badge-critical',
      color: 'var(--s5-critical-color)',  accent: 'var(--s5-critical-accent)',
      zoneBg: 'var(--s5-critical-zone)'
    };
    if (ev.status === 'WARNING') return {
      label: 'AT_RISK', badgeCls: 's5-badge-atrisk',
      color: 'var(--s5-atrisk-color)', accent: 'var(--s5-atrisk-accent)',
      zoneBg: 'var(--s5-atrisk-zone)'
    };
    return {
      label: 'ON_TRACK', badgeCls: 's5-badge-ontrack',
      color: 'var(--s5-ontrack-color)',  accent: 'var(--s5-ontrack-accent)',
      zoneBg: 'var(--s5-ontrack-zone)'
    };
  },

  /**
   * _classifyRisk(classification) — Sprint 15 FIX 1.
   * Single source of truth: maps ExecutiveDecision Contract risk.classification
   * directly to design-system tokens.  Replaces independent TimeEngine.evalStatus()
   * call that was previously used for the Risk Zone header badge.
   *
   * Accepted values (from ExecutiveDecision Contract v1.0.0):
   *   'UNREACHABLE' — mult > 2.00  → CRITICAL visual tokens + UNREACHABLE label
   *   'CRITICAL'    — mult > 1.50  → CRITICAL visual tokens
   *   'AT_RISK'     — mult > 1.20  → AT_RISK  visual tokens
   *   'ON_TRACK'    — mult ≤ 1.20  → ON_TRACK visual tokens
   *   null          — ED not loaded → graceful fallback (no tokens)
   *
   * @param  {string|null} classification  risk.classification from ED Contract
   * @returns {{ label, badgeCls, color, accent, zoneBg }}
   */
  _classifyRisk: (classification) => {
    if (classification === 'UNREACHABLE') return {
      label: 'UNREACHABLE', badgeCls: 's5-badge-critical',
      color: 'var(--s5-critical-color)',     accent: 'var(--s5-critical-accent)',
      zoneBg: 'var(--s5-critical-zone)'
    };
    if (classification === 'CRITICAL') return {
      label: 'CRITICAL',   badgeCls: 's5-badge-critical',
      color: 'var(--s5-critical-color)',    accent: 'var(--s5-critical-accent)',
      zoneBg: 'var(--s5-critical-zone)'
    };
    if (classification === 'AT_RISK') return {
      label: 'AT_RISK',   badgeCls: 's5-badge-atrisk',
      color: 'var(--s5-atrisk-color)',   accent: 'var(--s5-atrisk-accent)',
      zoneBg: 'var(--s5-atrisk-zone)'
    };
    // Default: ON_TRACK (also handles null / unknown values)
    return {
      label: 'ON_TRACK',  badgeCls: 's5-badge-ontrack',
      color: 'var(--s5-ontrack-color)',   accent: 'var(--s5-ontrack-accent)',
      zoneBg: 'var(--s5-ontrack-zone)'
    };
  },

  /**
   * _actionBadge(severity) — severity badge for Action card.
   * Light-bg + dark-text pattern per Design System §3.2.
   *
   * @param  {string} severity  'critical' | 'warning' | 'good' | 'neutral'
   * @returns {string} HTML
   */
  _actionBadge: (severity) => {
    const MAP = {
      critical: { label: 'ESCALATE',  cls: 's5-badge-escalate' },
      warning:  { label: 'PERHATIAN', cls: 's5-badge-proceed'  },
      good:     { label: 'LANJUTKAN', cls: 's5-badge-actnow'   },
      neutral:  { label: 'INFO',      cls: 's5-badge-info'     },
    };
    const s = MAP[severity] || MAP.neutral;
    return `<span class="s5-badge ${s.cls}">${s.label}</span>`;
  },

  /**
   * _pending(note) — kept as fallback helper, not used in active render paths.
   * @param  {string} [note]
   * @returns {string} HTML
   */
  _pending: (note = 'Menunggu KPIEngine contract') =>
    `<span class="s5-pending">${note}</span>`,

  /**
   * _rowLabel(text) — consistent secondary metric label.
   * @param  {string} text
   * @returns {string} HTML
   */
  _rowLabel: (text) =>
    `<div class="s5-row-lbl">${text}</div>`,

  // ══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * renderEmpty() — shown when no KPI data is available (k === null / !k.perf).
   * @returns {string} HTML
   */
  renderEmpty: () => `
    <div style="display:flex;align-items:center;justify-content:center;height:220px;
                background:var(--white);border:1px solid var(--border-color);border-radius:12px">
      <div style="text-align:center">
        <div style="font-size:32px;margin-bottom:10px">🎯</div>
        <div style="font-size:13px;font-weight:500;color:var(--gray-700)">Executive Decision Center</div>
        <div style="font-size:11px;font-weight:400;color:var(--gray-400);margin-top:4px">
          Upload MonitorDaily.xlsx untuk mengaktifkan Decision Center
        </div>
      </div>
    </div>`,

  // ══════════════════════════════════════════════════════════════════════════
  // CARD RENDERERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * renderRisk(k, td) — 🚨 The Situation (full width, Headline Zone)
   *
   * Headline Zone rules (DesignSystem §3.1):
   *   • NO card border, NO border-radius
   *   • Left accent bar: 4px solid accent color
   *   • Background: status-tinted at 8% opacity
   *
   * Hero type: 48px · 500 · tabular-nums · status color (DesignSystem L2)
   * Progress bar: 4px height, D-tick at timeGone%
   *
   * Sprint 13 additions (from State.kpi.executiveDecision.risk):
   *   monthEndProj, requiredMultiplier, worstTerritory, anomalyFlags, classification
   *
   * @param {object} k   State.kpi
   * @param {object} td  TimeEngine.get() result (passed from render)
   * @returns {string} HTML
   */
  renderRisk: (k, td) => {
    const p    = k.perf;
    const ed   = k.executiveDecision;
    const risk = ed ? ed.risk : null;

    // FIX 4 (Sprint 15) — data anomaly guard: negative actual = returns/adjustments
    const isDataAnomaly = p.totAct < 0;

    // FIX 1 (Sprint 15) — single source of truth: ED Contract risk.classification
    // replaces independent TimeEngine.evalStatus() that caused badge/ED discrepancy.
    // Falls back to _riskLevel() only when ED contract is not yet loaded.
    const rv = risk
      ? Section5View._classifyRisk(risk.classification)
      : Section5View._riskLevel(p.ach);

    // Display formatting — no calculations
    const achNum   = p.ach;
    const achFmt   = isDataAnomaly ? '—' : Utils.fmtPct(achNum);
    const paceFmt  = Utils.fmtPct(td.timeGone);
    const gapPp    = (p.ach - td.timeGone).toFixed(1);
    const gapSign  = parseFloat(gapPp) >= 0 ? '+' : '';
    const gapColor = parseFloat(gapPp) >= 0 ? 'var(--green-main)' : rv.color;
    const actRR    = Utils.fmtCompact(p.actRR);
    const reqRR    = Utils.fmtCompact(p.reqRR);
    const actFmt   = Utils.fmtCompact(Math.abs(p.totAct));
    const tgtFmt   = Utils.fmtCompact(p.totTgt);
    const gapAbs   = Utils.fmtCompact(Math.abs(p.gap));
    const hkLabel  = `WD ${td.hkPass}/${td.hkTot}`;
    const achPct   = Math.min(Math.max(achNum, 0), 100);
    const timePct  = Math.min(td.timeGone, 100);
    const isCrit   = rv.label === 'CRITICAL' || rv.label === 'UNREACHABLE';

    // ExecutiveDecision — risk fields (Sprint 13)
    const monthEndProj  = risk ? risk.monthEndProj.toFixed(1) + '%' : '—';
    const reqMultiplier = risk ? risk.requiredMultiplier.toFixed(2) + '×' : '—';
    const worstTerr     = risk ? risk.worstTerritory : null;
    const anomalyFlags  = risk ? (risk.anomalyFlags || []) : [];

    // FIX 4 (Sprint 15) — prepend data anomaly flag when actual is negative
    const displayAnomalyFlags = isDataAnomaly
      ? [`Aktual negatif (${Utils.fmtCompact(Math.abs(p.totAct))}) — kemungkinan retur atau penyesuaian. Verifikasi data sebelum mengambil tindakan.`, ...anomalyFlags]
      : anomalyFlags;

    // Required multiplier color: mirrors risk classification design tokens
    const multColor = !risk                             ? 'var(--gray-500)'
      : risk.requiredMultiplier > 1.50                  ? 'var(--s5-critical-color)'
      : risk.requiredMultiplier > 1.20                  ? 'var(--s5-atrisk-color)'
      :                                                   'var(--s5-ontrack-color)';

    // Worst territory pill (inline, no new sections)
    const worstTerrHtml = worstTerr ? `
      <div style="margin-top:4px;padding:5px 8px;background:rgba(0,0,0,0.04);border-radius:6px">
        ${Section5View._rowLabel('Wilayah Terburuk')}
        <span class="s5-mono"
              style="font-size:11px;font-weight:500;color:${rv.color}">${worstTerr.territoryName}</span>
        <span style="font-size:9px;font-weight:400;color:var(--gray-400);margin-left:6px">
          ${worstTerr.requiredMultiplier.toFixed(2)}× mult · Proj ${worstTerr.monthEndProj.toFixed(1)}%
        </span>
      </div>` : '';

    // Anomaly flags (max 3 shown) — FIX 4: uses displayAnomalyFlags (may include negative-actual flag)
    const anomalyHtml = displayAnomalyFlags.length > 0 ? `
      <div style="margin-top:4px">
        ${displayAnomalyFlags.slice(0, 3).map(f =>
          `<div style="font-size:9px;font-weight:400;color:var(--s5-critical-color);margin-bottom:1px">⚠ ${f}</div>`
        ).join('')}
      </div>` : '';

    // UNREACHABLE override badge
    const unreachableBadge = risk && risk.classification === 'UNREACHABLE'
      ? `<span class="s5-badge s5-badge-critical" style="margin-left:6px">UNREACHABLE</span>`
      : '';

    return `
      <div style="background:${rv.zoneBg};border-left:4px solid ${rv.accent};padding:16px 20px">

        <!-- Zone header -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:12px">🚨</span>
          <span class="s5-label">The Situation</span>
          <span class="s5-badge ${rv.badgeCls}${isCrit ? ' s5-badge-pulse-once' : ''}"
                data-s5-tip="Status berdasarkan Required Multiplier (Executive Decision Contract v1.0.0)">${rv.label}</span>
        </div>

        <div style="display:grid;grid-template-columns:auto 1px 1fr;gap:0 20px;align-items:start">

          <!-- Hero block — left column -->
          <div style="min-width:120px">
            ${isDataAnomaly ? `
            <div style="font-size:20px;font-weight:700;color:var(--s5-critical-color);line-height:1.2;margin-bottom:4px">⚠ Data Anomaly</div>
            <div style="font-size:10px;font-weight:400;color:var(--gray-500);line-height:1.5">
              Aktual negatif — kemungkinan<br>retur atau penyesuaian data
            </div>` : `
            <div id="s5-risk-hero"
                 class="s5-mono"
                 style="font-size:48px;font-weight:500;color:${rv.color};line-height:1">
              ${achFmt}
            </div>
            <div style="font-size:11px;font-weight:400;color:var(--gray-500);margin-top:5px">
              Pencapaian vs pace
              <strong style="color:var(--gray-700);font-family:var(--font-mono)">${paceFmt}</strong>
            </div>`}

            <!-- Progress bar: achievement fill + time-gone tick -->
            <div class="s5-progress-track"
                 data-s5-tip="Bar biru: achievement · Garis: time gone (${paceFmt})">
              <div class="s5-progress-fill"
                   style="width:${achPct}%;background:${rv.accent}"></div>
              <div class="s5-progress-tick"
                   style="left:${timePct}%"></div>
            </div>
            <div class="s5-progress-labels">
              <span>0%</span>
              <span>Pace ${paceFmt}</span>
              <span>100%</span>
            </div>
          </div>

          <!-- Vertical divider -->
          <div style="background:${rv.accent};opacity:0.25;align-self:stretch"></div>

          <!-- Metrics grid — right column -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px 20px">

            <div>
              ${Section5View._rowLabel('Gap vs Pace')}
              <div class="s5-mono"
                   style="font-size:22px;font-weight:500;color:${gapColor};font-variant-numeric:tabular-nums"
                   data-s5-tip="Achievement % dikurangi Time Gone %">${gapSign}${gapPp}<span style="font-size:12px;font-weight:400">pp</span></div>
            </div>

            <div>
              ${Section5View._rowLabel('Shortfall')}
              <div class="s5-mono"
                   style="font-size:22px;font-weight:500;color:${rv.color};font-variant-numeric:tabular-nums"
                   data-s5-tip="Gap absolut: Target dikurangi Aktual">${gapAbs}</div>
              <div style="font-size:10px;font-weight:400;color:var(--gray-400);margin-top:1px">${actFmt} / ${tgtFmt}</div>
            </div>

            <div>
              ${Section5View._rowLabel('Run Rate Aktual')}
              <div class="s5-mono"
                   style="font-size:16px;font-weight:500;color:var(--gray-900);font-variant-numeric:tabular-nums"
                   data-s5-tip="Rata-rata penjualan per Hari Kerja aktual">${actRR}<span style="font-size:9px;font-weight:400;color:var(--gray-400)">/HK</span></div>
              <div style="font-size:10px;font-weight:400;color:var(--gray-400);margin-top:1px">
                Need: <strong style="color:${rv.color};font-family:var(--font-mono)">${reqRR}/HK</strong>
              </div>
            </div>

            <div>
              ${Section5View._rowLabel(hkLabel)}
              <div class="s5-mono"
                   style="font-size:16px;font-weight:500;color:var(--gray-900)">
                ${td.hkRem} <span style="font-size:10px;font-weight:400;color:var(--gray-400)">HK sisa</span>
              </div>
            </div>

       
            <!-- Row 2: Proyeksi Akhir Bulan + Required Multiplier (Sprint 13 — from ExecutiveDecision) -->
            <div style="grid-column:span 2">
              <div class="s5-divider" style="margin:4px 0 8px"></div>
              ${Section5View._rowLabel('Proyeksi Akhir Bulan')}
              <div class="s5-mono"
                   style="font-size:20px;font-weight:500;color:${rv.color};font-variant-numeric:tabular-nums"
                   data-s5-tip="(Run rate harian × total HK) ÷ target">${monthEndProj}</div>
            </div>

            <div style="grid-column:span 2">
              <div class="s5-divider" style="margin:4px 0 8px"></div>
              ${Section5View._rowLabel('Required Multiplier')}
              <div style="display:flex;align-items:center;gap:6px">
                <span class="s5-mono"
                      style="font-size:20px;font-weight:500;color:${multColor};font-variant-numeric:tabular-nums"
                      data-s5-tip="Seberapa keras tim harus bekerja dibanding pace saat ini">${reqMultiplier}</span>
                ${unreachableBadge}
              </div>
            </div>

            <!-- Row 3: Worst territory + anomaly flags (Sprint 13 / FIX 4 Sprint 15) -->
            ${worstTerr || displayAnomalyFlags.length > 0 ? `
            <div style="grid-column:span 4">
              ${worstTerrHtml}
              ${anomalyHtml}
            </div>` : ''}

          </div>
        </div>
      </div>`;
  },

  /**
   * renderOpportunity(k) — 🎯 The Business Potential (white card, left column)
   *
   * Sprint 13: recovery value hero now live from ed.opportunity.totalRecoveryValue.
   * Time decay now live from ed.impact.decayPerDay.
   * Territory table (top 5 qualified) now live from ed.opportunity.qualifiedTerritories.
   * Qualification badge from ed.opportunity.qualificationStatus.
   *
   * Existing k.ca stats (CA TM/LM comparison) retained — complementary display.
   *
   * @param {object} k  State.kpi
   * @returns {string} HTML
   */
  renderOpportunity: (k) => {
    const ca  = k.ca || { zero: 0, tot: 0, lm: 0, delta: 0 };
    const ed  = k.executiveDecision;
    const opp = ed ? ed.opportunity : null;
    const imp = ed ? ed.impact     : null;

    // Existing CA stats (k.ca — backward compatible display)
    const caZero   = ca.zero  || 0;
    const caTot    = ca.tot   || 0;
    const caLM     = ca.lm    || 0;
    const caDelta  = ca.delta || 0;
    const zeroPct    = caTot > 0 ? Math.round((caZero / caTot) * 100) : 0;
    const deltaColor = caDelta >= 0 ? 'var(--green-main)' : 'var(--red-main)';
    const deltaSign  = caDelta >= 0 ? '+' : '';
    const heroColor  = 'var(--s5-opp-color)';

    // ExecutiveDecision opportunity fields (Sprint 13)
    const hasEd         = opp != null;
    const recoveryFmt   = hasEd ? Utils.fmtCompact(opp.totalRecoveryValue)   : '—';
    const inactiveCount = hasEd ? opp.totalInactiveCA                         : '—';
    const avgTicketFmt  = hasEd ? 'Rp ' + Utils.fmtCompact(opp.avgTicketLM)  : '—';
    const activeRatePct = hasEd ? Math.round(opp.caActiveRateOverall * 100)   : '—';
    const decayFmt      = imp   ? 'Rp ' + Utils.fmtCompact(imp.decayPerDay)   : '—';
    const qualStatus    = hasEd ? opp.qualificationStatus  : null;
    const qualReason    = hasEd ? (opp.qualificationReason || '') : '';
    const territories   = hasEd ? opp.qualifiedTerritories.slice(0, 5) : [];
    const hasQualified  = territories.length > 0;

    // FIX 2 (Sprint 15) — context note when recovery value is 0 and principle filter active.
    // Opportunity is computed at Territory level; principle-scoped LM revenue dilutes
    // avgTicketLM to near-zero, making recovery appear zero — correct math, misleading display.
    const principleActive = typeof State !== 'undefined'
      && State.filters
      && State.filters.principles instanceof Set
      && State.filters.principles.size > 0;
    const showZeroRvNote = hasEd && opp.totalRecoveryValue === 0 && principleActive;
    // Sprint 16 Item 1 - context note when no territory meets CA Active Rate >= 80%.
    // Distinct from showZeroRvNote: shown only when principle filter is NOT active,
    // so the cause is structural (all territories disqualified), not a filter artifact.
    const showNoQualNote = hasEd && opp.qualifiedTerritories.length === 0 && !principleActive;

    // Qualification badge
    const QUAL_BADGE = {
      'QUALIFIED':    `<span class="s5-badge s5-badge-ontrack">QUALIFIED</span>`,
      'PARTIAL':      `<span class="s5-badge s5-badge-atrisk">PARTIAL</span>`,
      'DISQUALIFIED': `<span class="s5-badge s5-badge-critical">STRUCTURAL</span>`,
    };
    const qualBadge = qualStatus ? (QUAL_BADGE[qualStatus] || '') : '';

    // Territory table rows (top 5 qualified by recovery value)
    const terrRows = hasQualified
      ? territories.map(t => `
          <tr>
            <td style="font-size:10px;font-weight:400;color:var(--gray-700)">${t.territoryName}</td>
            <td style="font-size:10px;font-weight:500;color:${heroColor};font-family:var(--font-mono);text-align:right">Rp ${Utils.fmtCompact(t.recoveryValue)}</td>
            <td style="font-size:10px;font-weight:400;color:var(--gray-500);text-align:right">${t.inactiveCA}</td>
            <td style="font-size:9px;font-weight:400;color:var(--gray-400);text-align:right">${Math.round(t.caActiveRate * 100)}%</td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="font-size:9px;font-style:italic;color:var(--gray-400);padding:6px 0">
           Tidak ada territory yang memenuhi syarat (CA active rate ≥80%)
         </td></tr>`;

    return `
      <div class="s5-card s5-card-white">

        <!-- Card header -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
          <span style="font-size:12px">🎯</span>
          <span class="s5-label">The Business Potential</span>
          ${qualBadge}
        </div>

        <!-- Hero: Recovery Value (Sprint 13 — live from executiveDecision) -->
        <div style="margin-bottom:10px">
          ${Section5View._rowLabel('Potensi Recovery Value')}
          <div class="s5-mono"
               style="font-size:34px;font-weight:500;color:${heroColor};line-height:1"
               data-s5-tip="inactive_CA × avg_ticket_LM per territory yang qualified">
            Rp <span id="s5-opp-hero">${recoveryFmt}</span>
          </div>
          <div style="font-size:10px;font-weight:400;color:var(--gray-400);margin-top:3px">
            ${inactiveCount} CA tidak aktif · avg tiket LM ${avgTicketFmt}
          </div>
          ${showZeroRvNote ? `
          <div style="margin-top:8px;padding:7px 10px;background:var(--s5-note-bg);
                      border-radius:6px;border-left:3px solid var(--s5-note-color)">
            <div style="font-size:9px;font-weight:700;color:var(--s5-note-color);
                        text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">ℹ Catatan</div>
            <div style="font-size:10px;font-weight:400;color:var(--s5-note-color);line-height:1.5">
              Peluang Recovery dihitung di level <strong>Territory</strong>, bukan per Principle.
              Pilih <strong>All Principle</strong> untuk melihat estimasi nilai recovery.
            </div>
          </div>` : ''}
          ${showNoQualNote ? `
          <div style="margin-top:8px;padding:7px 10px;background:var(--s5-note-bg);
                      border-radius:6px;border-left:3px solid var(--s5-note-color)">
            <div style="font-size:9px;font-weight:700;color:var(--s5-note-color);
                        text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px">ℹ Catatan</div>
            <div style="font-size:10px;font-weight:400;color:var(--s5-note-color);line-height:1.5">
              Tidak ada Territory yang memenuhi syarat <strong>CA Active Rate ≥ 80%</strong>.
              Recovery Value Rp 0 karena tidak ada territory yang qualified untuk diprioritaskan.
            </div>
          </div>` : ''}
        </div>

        <div class="s5-divider"></div>

        <!-- CA active rate + qualification reason -->
        <div style="margin-bottom:10px">
          ${Section5View._rowLabel('CA Active Rate')}
          <div style="display:flex;align-items:baseline;gap:6px">
            <div class="s5-mono"
                 style="font-size:17px;font-weight:500;color:${heroColor};font-variant-numeric:tabular-nums">${activeRatePct}%</div>
            <div style="font-size:10px;font-weight:400;color:var(--gray-400)">${qualReason}</div>
          </div>
        </div>

        <div class="s5-divider"></div>

        <!-- CA inactive count (from k.ca — existing display) -->
        <div style="margin-bottom:10px">
          ${Section5View._rowLabel('CA Tidak Aktif Bulan Ini')}
          <div style="display:flex;align-items:baseline;gap:6px">
            <div class="s5-mono"
                 style="font-size:20px;font-weight:500;color:${heroColor};font-variant-numeric:tabular-nums">${caZero}</div>
            <div style="font-size:10px;font-weight:400;color:var(--gray-400)">${zeroPct}% dari ${caTot} CA</div>
          </div>
        </div>

        <div class="s5-divider"></div>

        <!-- CA comparison stats (from k.ca — existing display) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:10px">

          <div>
            ${Section5View._rowLabel('CA Aktif TM')}
            <div class="s5-mono"
                 style="font-size:17px;font-weight:500;color:var(--gray-900);font-variant-numeric:tabular-nums">${caTot}</div>
          </div>

          <div>
            ${Section5View._rowLabel('CA Aktif LM')}
            <div class="s5-mono"
                 style="font-size:17px;font-weight:500;color:var(--gray-900);font-variant-numeric:tabular-nums">${caLM}</div>
          </div>

          <div style="grid-column:span 2">
            ${Section5View._rowLabel('Delta vs LM')}
            <div class="s5-mono"
                 style="font-size:15px;font-weight:500;color:${deltaColor};font-variant-numeric:tabular-nums">${deltaSign}${caDelta.toFixed(1)}%</div>
          </div>

        </div>

        <div class="s5-divider"></div>

        <!-- Territory table — top 5 qualified (Sprint 13) -->
        <div style="margin-bottom:10px">
          ${Section5View._rowLabel('Top Territory by Recovery Value')}
          <table class="s5-terr-table">
            <thead>
              <tr>
                <th style="text-align:left">Wilayah</th>
                <th style="text-align:right">Recovery</th>
                <th style="text-align:right">Inactive</th>
                <th style="text-align:right">Rate</th>
              </tr>
            </thead>
            <tbody>${terrRows}</tbody>
          </table>
        </div>

        <div class="s5-divider"></div>

        <!-- Time decay (Sprint 13 — live from executiveDecision.impact) -->
        <div>
          ${Section5View._rowLabel('Time Decay (10%/hari)')}
          <div class="s5-mono"
               style="font-size:13px;font-weight:500;color:var(--s5-critical-color);font-variant-numeric:tabular-nums"
               data-s5-tip="Nilai recovery turun 10% per hari karena outlet self-activate tanpa intervensi">
            −${decayFmt}/hari
          </div>
        </div>

      </div>`;
  },

  /**
   * renderAction(k) — ⚡ The Decision (gray card, right column)
   *
   * Sprint 13: all fields now live from State.kpi.executiveDecision.action.
   * Executive sentence generated deterministically from ED data (no AI text).
   * Urgency signal mapped to badge severity.
   *
   * @param {object} k  State.kpi
   * @returns {string} HTML
   */
  renderAction: (k) => {
    const ed     = k.executiveDecision;
    const action = ed ? ed.action : null;

    // Map urgency signal → badge severity
    const URGENCY_MAP = { 'ACT_NOW': 'critical', 'PROCEED': 'warning', 'MONITOR': 'good' };
    const severity = action ? (URGENCY_MAP[action.urgencySignal] || 'neutral') : 'neutral';

    // Deterministic executive sentence from ED action fields
    const sentence = action
      ? `${action.primaryRole}: Aktivasi ${action.callTarget} CA tidak aktif di ${action.primaryTerritory}. Fokus brand: ${action.brandFocus || 'semua'}. Target revenue hari ini Rp ${Utils.fmtCompact(action.expectedRevenueToday)}. Deadline: ${action.deadlineTime} ${action.deadlineDate}.`
      : 'Data aksi belum tersedia — pastikan file MonitorDaily.xlsx sudah di-upload.';

    // Display values
    const callTargetFmt  = action ? action.callTarget + ' outlet'                         : '—';
    const revenueToday   = action ? 'Rp ' + Utils.fmtCompact(action.expectedRevenueToday) : '—';
    const primaryRoleFmt = action ? action.primaryRole                                     : '—';
    const primaryTerrFmt = action ? action.primaryTerritory                                : '—';
    const brandFmt       = action ? (action.brandFocus || 'Semua brand')                   : '—';
    const urgencyLabel   = action ? action.urgencySignal.replace('_', ' ')                 : '—';
    const escalationFmt  = action ? action.escalationCondition                             : '—';
    const deadlineFmt    = action ? `${action.deadlineTime} · ${action.deadlineDate}`      : '—';

    return `
      <div class="s5-card s5-card-gray">

        <!-- Card header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px">⚡</span>
            <span class="s5-label">The Decision</span>
          </div>
          ${Section5View._actionBadge(severity)}
        </div>

        <!-- Executive sentence — deterministic from ExecutiveDecision (Sprint 13) -->
        <div style="font-size:13px;font-weight:500;color:var(--gray-900);
                    line-height:1.55;margin-bottom:14px;min-height:56px">${sentence}</div>

        <div class="s5-divider"></div>

        <!-- Structured action fields — live from executiveDecision.action (Sprint 13) -->
        <div style="display:flex;flex-direction:column;gap:8px">

          <div>
            ${Section5View._rowLabel('Target Hari Ini')}
            <div style="display:flex;align-items:baseline;gap:8px">
              <span class="s5-mono"
                    style="font-size:15px;font-weight:500;color:var(--gray-900);font-variant-numeric:tabular-nums">${callTargetFmt}</span>
              <span style="font-size:10px;font-weight:400;color:var(--gray-400)">${revenueToday}</span>
            </div>
          </div>

          <div>
            ${Section5View._rowLabel('Penanggung Jawab')}
            <div style="display:flex;align-items:baseline;gap:6px">
              <span class="s5-mono"
                    style="font-size:15px;font-weight:500;color:var(--gray-900)">${primaryRoleFmt}</span>
              <span style="font-size:10px;font-weight:400;color:var(--gray-400)">· ${primaryTerrFmt}</span>
            </div>
            <div style="font-size:10px;font-weight:400;color:var(--gray-400);margin-top:2px">
              Brand fokus: <strong style="color:var(--gray-700)">${brandFmt}</strong>
            </div>
          </div>

          <div>
            ${Section5View._rowLabel('Tingkat Urgensi')}
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span class="s5-mono"
                    style="font-size:13px;font-weight:500;color:var(--gray-900)">${urgencyLabel}</span>
              <span style="font-size:10px;font-weight:400;color:var(--gray-400)">· Deadline ${deadlineFmt}</span>
            </div>
            <div style="font-size:10px;font-weight:400;color:var(--gray-400);line-height:1.5">${escalationFmt}</div>
          </div>

        </div>
      </div>`;
  },

  /**
   * renderImpact(k, td) — 💰 The Consequence (full width, dark footer)
   *
   * 3-column arrow narrative (DesignSystem §3.9):
   *   [do-nothing % | → delta | with-action %]
   *
   * Sprint 13: all three columns now live from ed.impact.
   *   LEFT  — doNothingProjection  (month-end if no change)
   *   CENTER — deltaProjection (pp) + deltaValue (IDR)
   *   RIGHT  — withActionProjection
   *   Footer — viabilityDays, viabilityDate, decayPerDay
   *
   * Animated: #s5-impact-proj-action, #s5-impact-delta
   *
   * @param {object} k   State.kpi
   * @param {object} td  TimeEngine.get() result
   * @returns {string} HTML
   */
  renderImpact: (k, td) => {
    const p   = k.perf;
    const ed  = k.executiveDecision;
    const imp = ed ? ed.impact : null;

    // Existing display fields (backward compat)
    const actFmt = Utils.fmtCompact(p.totAct);
    const tgtFmt = Utils.fmtCompact(p.totTgt);

    // Sprint 13 — ExecutiveDecision impact fields
    // FIX 3 (Sprint 15) — Math.max(0, ...) prevents '-0.0pp' display artifact
    const doNothingFmt  = imp ? imp.doNothingProjection.toFixed(1) + '%'                      : Utils.fmtPct(p.ach);
    const withActionFmt = imp ? imp.withActionProjection.toFixed(1) + '%'                      : '—';
    const deltaFmt      = imp ? '+' + Math.max(0, imp.deltaProjection).toFixed(1) + 'pp'       : '+•••';
    const deltaValueFmt = imp ? 'Rp ' + Utils.fmtCompact(imp.deltaValue)                       : '—';
    const viabilityFmt  = imp && imp.viabilityDays > 0
      ? `${imp.viabilityDays} hari (s/d ${imp.viabilityDate})`
      : 'Tidak terbatas';
    const decayFmt      = imp ? 'Rp ' + Utils.fmtCompact(imp.decayPerDay) + '/hari'  : '—';

    return `
      <div class="s5-impact-footer">

        <!-- Footer header -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
          <span style="font-size:12px">💰</span>
          <span style="font-size:10px;font-weight:500;color:#888780;
                       text-transform:uppercase;letter-spacing:0.08em">The Consequence</span>
          <span style="margin-left:auto;font-size:10px;font-weight:400;color:#888780">
            ${td.hkRem} HK tersisa
          </span>
        </div>

        <div class="s5-divider-dark"></div>

        <!-- 3-column narrative: do-nothing → delta → with-action -->
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;
                    align-items:center;margin-top:10px">

          <!-- LEFT: do-nothing trajectory -->
          <div>
            <div class="s5-row-lbl-dark">Proyeksi Saat Ini</div>
            <div class="s5-mono"
                 style="font-size:30px;font-weight:500;color:#F09595;line-height:1"
                 data-s5-tip="Proyeksi akhir bulan jika tidak ada perubahan run rate">${doNothingFmt}</div>
            <div style="font-size:10px;font-weight:400;color:#888780;margin-top:3px">
              Tanpa perubahan
            </div>
            <div style="margin-top:6px">
              <span style="font-size:9px;font-weight:400;color:#888780">Aktual: </span>
              <span class="s5-mono"
                    style="font-size:11px;font-weight:500;color:#D3D1C7">${actFmt} / ${tgtFmt}</span>
            </div>
          </div>

          <!-- CENTER: arrow + delta -->
          <div style="text-align:center">
            <div id="s5-impact-delta"
                 style="font-size:11px;font-weight:500;color:#9FE1CB;margin-bottom:2px"
                 data-s5-tip="Potensi uplift dari recovery action">${deltaFmt}</div>
            <div style="font-size:22px;font-weight:500;color:#5F5E5A">→</div>
            <div style="font-size:9px;font-weight:400;color:#888780;margin-top:2px">
              ${deltaValueFmt}
            </div>
          </div>

          <!-- RIGHT: with-action projection -->
          <div style="text-align:right">
            <div class="s5-row-lbl-dark" style="text-align:right">Dengan Aksi</div>
            <div id="s5-impact-proj-action"
                 class="s5-mono"
                 style="font-size:30px;font-weight:500;color:#9FE1CB;line-height:1"
                 data-s5-tip="Proyeksi akhir bulan jika recovery CA berhasil dieksekusi">${withActionFmt}</div>
            <div style="font-size:10px;font-weight:400;color:#888780;margin-top:3px">
              Dengan recovery
            </div>
          </div>

        </div>

        <!-- Viability + decay row -->
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid #444441;
                    display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:9px;font-weight:400;color:#888780">
            Window aksi efektif: <strong style="color:#D3D1C7">${viabilityFmt}</strong>
          </div>
          <div style="font-size:9px;font-weight:400;color:#888780">
            Decay: <strong style="color:#F09595">${decayFmt}</strong>
          </div>
        </div>

      </div>`;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MAIN ENTRY POINT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * render(k) — main entry point called by RenderEngine._safeRender().
   *
   * Strategy: replace-all — replaces #s5-container innerHTML on every call.
   * TimeEngine.get() called ONCE here and passed down to sub-renderers.
   * Count-up fires ONCE on first mount (guarded by _mounted flag).
   *
   * Sprint 13 animations:
   *   s5-opp-hero           — recovery value compact IDR (via _countUpFmt)
   *   s5-impact-proj-action — withActionProjection % (via _countUp)
   *   s5-impact-delta       — deltaProjection pp (via _countUpFmt)
   *
   * Sprint 15 changes:
   *   - Risk hero count-up guarded against data anomaly (totAct < 0)
   *   - Delta count-up uses Math.max(0, v) to prevent '-0.0pp' (FIX 3)
   *
   * @param {object|null} k  State.kpi — null when no data loaded yet
   */
  render: (k) => {
    Section5View._injectStyles();

    const el = document.getElementById('s5-container');
    if (!el) return;

    // No data guard
    if (!k || !k.perf) {
      el.innerHTML = Section5View.renderEmpty();
      return;
    }

    // TimeEngine called ONCE — result passed to all sub-renderers
    const td = TimeEngine.get();
    const hasCA = k.ca != null;
    const ed    = k.executiveDecision;

    try {
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px">

          <!-- Row 1: 🚨 The Situation — full width, headline zone -->
          ${Section5View.renderRisk(k, td)}

          <!-- Row 2: 🎯 The Business Potential | ⚡ The Decision — 2 columns -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start">
            ${(hasCA || ed)
              ? Section5View.renderOpportunity(k)
              : `<div class="s5-card s5-card-white">
                   <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
                     <span style="font-size:12px">🎯</span>
                     <span class="s5-label">The Business Potential</span>
                   </div>
                   <span class="s5-pending">Data CA tidak tersedia</span>
                 </div>`}
            ${Section5View.renderAction(k)}
          </div>

          <!-- Row 3: 💰 The Consequence — full width dark footer -->
          ${Section5View.renderImpact(k, td)}

        </div>`;

      // Update section timestamp
      const tsEl = document.getElementById('s5-timestamp');
      if (tsEl) tsEl.textContent = `D${td.hkPass} / ${td.hkTot} · Live data`;

      // Count-up animations — first mount only
      if (!Section5View._mounted) {
        Section5View._mounted = true;

        // Risk hero — current achievement % (FIX 4: skip when data anomaly)
        if (k.perf.totAct >= 0) {
          Section5View._countUp('s5-risk-hero', k.perf.ach, '%', 1, 800);
        }

        // Opportunity hero — recovery value (compact IDR)
        if (ed && ed.opportunity) {
          Section5View._countUpFmt(
            's5-opp-hero',
            ed.opportunity.totalRecoveryValue,
            v => Utils.fmtCompact(Math.round(v)),
            800
          );
        }

        // Impact projections
        if (ed && ed.impact) {
          Section5View._countUp('s5-impact-proj-action', ed.impact.withActionProjection, '%', 1, 800);
          // FIX 3 (Sprint 15) — Math.max(0, v) prevents '-0.0pp' during animation
          Section5View._countUpFmt(
            's5-impact-delta',
            ed.impact.deltaProjection,
            v => '+' + Math.max(0, v).toFixed(1) + 'pp',
            800
          );
        }
      }

    } catch (err) {
      console.error('[Section5View] render failed:', String(err));
      el.innerHTML = `
        <div style="padding:16px;background:var(--red-bg);border:1px solid var(--red-bdr);
                    border-radius:12px;color:var(--red-main);font-size:11px">
          <strong>Section 5 render error:</strong> ${String(err)}
        </div>`;
    }
  }

};
