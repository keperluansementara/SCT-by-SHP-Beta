// ==========================================
// BUSINESS LAYER — alertEngine.js
// ==========================================
// Source: index.html lines 3532–3901
// Extracted: Commentary Layer Extraction
//
// Exposes global: AlertEngine
// Dependencies: State, TimeEngine, TrendEngine, Utils (all lazy)
// ==========================================

const AlertEngine = {

  // ── Scoring helpers (pure functions, no side effects) ──────────────

  /**
   * scoreAchVsPace — Dimension A (0–40 pts)
   * Gap between achievement% and time gone% (pace).
   * 0pp gap → 0pts | −40pp gap → 40pts (capped)
   */
  _scoreAchVsPace: (ach, timeGone) => {
    const gap = timeGone - ach;   // positive = behind pace
    return Math.min(40, Math.max(0, gap));
  },

  /**
   * scoreVsLM — Dimension B (0–25 pts)
   * Penalizes negative vs-LM growth.
   * 0% or positive → 0pts | −25% or worse → 25pts
   */
  _scoreVsLM: (vsLM) => {
    if (vsLM === null || vsLM === undefined || vsLM >= 0) return 0;
    return Math.min(25, Math.abs(vsLM));
  },

  /**
   * scoreVsLY — Dimension C (0–10 pts)
   * Secondary signal. Only penalizes negative vs-LY.
   */
  _scoreVsLY: (vsLY) => {
    if (vsLY === null || vsLY === undefined || vsLY >= 0) return 0;
    return Math.min(10, Math.abs(vsLY) / 3);
  },

  /**
   * scoreZeroTrx — Dimension D (0–15 pts)
   * Zero-transaction ratio among total outlets/participants.
   * 0% zero → 0pts | 50%+ zero → 15pts
   */
  _scoreZeroTrx: (zeroCount, totalCount) => {
    if (!totalCount || totalCount === 0) return 0;
    const ratio = zeroCount / totalCount;
    return Math.min(15, ratio * 30);
  },

  /**
   * scoreRRPressure — Dimension E (0–10 pts)
   * How many times larger required RR is vs actual RR.
   * ≤1× → 0pts | ≥2× → 10pts
   */
  _scoreRRPressure: (reqRR, actRR) => {
    if (!actRR || actRR === 0) return reqRR > 0 ? 10 : 0;
    const ratio = reqRR / actRR;
    if (ratio <= 1) return 0;
    return Math.min(10, (ratio - 1) * 10);
  },

  /**
   * _badge — derives badge class + label from severity score.
   * 70+  → CRITICAL (solid-red)
   * 45+  → DANGER   (solid-red)
   * 20+  → WARNING  (solid-amber)
   * <20  → INFO     (bg-blue)
   */
  _badge: (score) => {
    if (score >= 70) return { cls: 'solid-red',   label: '🔴 CRITICAL' };
    if (score >= 45) return { cls: 'solid-red',   label: '🔴 DANGER'   };
    if (score >= 20) return { cls: 'solid-amber', label: '🟠 WARNING'  };
    return              { cls: 'bg-blue',       label: '🔵 INFO'     };
  },

  // ── Issue builders (one per domain / dimension) ────────────────────

  /**
   * _issueOverallPerf — Overall sales performance vs pace
   */
  _issueOverallPerf: (k) => {
    const p   = k.perf;
    const td  = TimeEngine.get();
    const sA  = AlertEngine._scoreAchVsPace(p.ach, td.timeGone);
    const sB  = AlertEngine._scoreVsLM(p.trend.vsLM);
    const sC  = AlertEngine._scoreVsLY(p.trend.vsLY);
    const sE  = AlertEngine._scoreRRPressure(p.reqRR, p.actRR);
    const score = Math.min(100, sA + sB + sC + sE);
    if (score < 5) return null;   // healthy — suppress

    const tgGap  = p.tgStatus.gap;
    const lmStr  = p.trend.hasLM ? ` | ${TrendEngine.insight(p.trend)}` : '';
    const rrMult = p.actRR > 0 ? (p.reqRR / p.actRR).toFixed(1) : '∞';
    const bdg    = AlertEngine._badge(score);

    return {
      id: 'perf-overall', domain: 'PERFORMANCE', type: 'ach-vs-pace',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `Overall Ach ${Utils.fmtPct(p.ach)} — ${tgGap >= 0 ? '+' : ''}${tgGap.toFixed(1)}pp vs Pace${lmStr}`,
      action: `Naikkan run rate ke ${Utils.fmtCompact(p.reqRR)}/HK (${rrMult}× pace saat ini). Fokus akselerasi di sisa ${td.hkRem} HK.`,
      data: { ach: p.ach, timeGone: td.timeGone, gap: p.gap, reqRR: p.reqRR, actRR: p.actRR }
    };
  },

  /**
   * _issuesByPrinciple — One issue per DANGER/WARNING principle, scored individually
   */
  _issuesByPrinciple: (k) => {
    const td = TimeEngine.get();
    return k.perf.byPrin
      .filter(p => p.tgStatus.status !== 'GOOD')
      .map(p => {
        const sA  = AlertEngine._scoreAchVsPace(p.ach, td.timeGone);
        const sB  = AlertEngine._scoreVsLM(p.trend.vsLM);
        const score = Math.min(100, sA + sB);
        const bdg   = AlertEngine._badge(score);
        const trendStr = p.trend.hasLM ? ` (${TrendEngine.insight(p.trend)})` : '';
        return {
          id: `perf-prin-${p.principle}`, domain: 'PERFORMANCE', type: 'principle-pace',
          severityScore: score,
          badgeCls: bdg.cls, badgeLabel: bdg.label,
          headline: `${p.principle} — Ach ${Utils.fmtPct(p.ach)} vs Pace ${Utils.fmtPct(td.timeGone)}${trendStr}`,
          action: `Akselerasi ${p.principle}: butuh tambahan ${Utils.fmtCompact(Math.abs(p.gap))} untuk menutup gap.`,
          data: { principle: p.principle, ach: p.ach, gap: p.gap, tgStatus: p.tgStatus }
        };
      });
  },

  /**
   * _issueWsBimaZero — Bima zero-transaction wholesalers (historically critical)
   */
  _issueWsBimaZero: (k) => {
    const d = k.ws.bim;
    if (!d.zro || d.zro === 0) return null;
    const sD  = AlertEngine._scoreZeroTrx(d.zro, d.t);
    const sA  = AlertEngine._scoreAchVsPace(d.ach, TimeEngine.pace());
    const score = Math.min(100, sD * 2.5 + sA);   // zero-trx weighted heavier for WS
    const bdg   = AlertEngine._badge(score);
    return {
      id: 'ws-bima-zero', domain: 'WHOLESALER', type: 'zero-trx',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `ITG Bima — ${d.zro} dari ${d.t} WS belum transaksi (${((d.zro/d.t)*100).toFixed(0)}%)`,
      action: `Push penetrasi Bima: target minimal transaksi pertama di ${d.zro} WS kosong hari ini.`,
      data: { zro: d.zro, total: d.t, ach: d.ach }
    };
  },

  /**
   * _issueWsArjZero — Arjuna zero-transaction
   */
  _issueWsArjZero: (k) => {
    const d = k.ws.arj;
    if (!d.zro || d.zro === 0) return null;
    const sD  = AlertEngine._scoreZeroTrx(d.zro, d.t);
    const score = Math.min(100, sD * 2);
    if (score < 10) return null;
    const bdg = AlertEngine._badge(score);
    return {
      id: 'ws-arj-zero', domain: 'WHOLESALER', type: 'zero-trx',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `ITG Arjuna — ${d.zro} WS belum transaksi dari ${d.t} total`,
      action: `Follow up ${d.zro} WS Arjuna yang belum transaksi — risiko miss target program.`,
      data: { zro: d.zro, total: d.t, ach: d.ach }
    };
  },

  /**
   * _issueWsOverall — Overall wholesaler achievement vs pace
   */
  _issueWsOverall: (k) => {
    const w  = k.ws;
    const td = TimeEngine.get();
    const sA = AlertEngine._scoreAchVsPace(w.allAch, td.timeGone);
    const sB = AlertEngine._scoreVsLM(w.allTrend.vsLM);
    const score = Math.min(100, sA + sB);
    if (score < 15) return null;
    const bdg    = AlertEngine._badge(score);
    const lmStr  = w.allTrend.hasLM ? ` | ${TrendEngine.insight(w.allTrend)}` : '';
    return {
      id: 'ws-overall', domain: 'WHOLESALER', type: 'ach-vs-pace',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `WS Overall Ach ${Utils.fmtPct(w.allAch)} vs Pace ${Utils.fmtPct(td.timeGone)}${lmStr}`,
      action: `Dorong volume WS: gap vs target ${Utils.fmtCompact(w.allAct - w.allTgt)}. Fokus outlet besar.`,
      data: { ach: w.allAch, trend: w.allTrend }
    };
  },

  /**
   * _issueCAZero — CA with zero transactions
   */
  _issueCAZero: (k) => {
    const c = k.ca;
    if (!c.zero || c.zero === 0) return null;
    const sD  = AlertEngine._scoreZeroTrx(c.zero, c.lm);
    const score = Math.min(100, sD * 3);
    if (score < 10) return null;
    const bdg     = AlertEngine._badge(score);
    const pct     = c.lm > 0 ? ((c.zero / c.lm) * 100).toFixed(1) : '—';
    const worstReg = k.ca.byReg[0];
    const regHint  = worstReg ? ` — terbesar di ${worstReg.name}` : '';
    return {
      id: 'ca-zero', domain: 'CA', type: 'zero-trx',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `${c.zero} CA zero transaksi (${pct}% dari LM)${regHint}`,
      action: `Follow up CA zero — retensi prioritas. Cek availability & coverage di region Terendah.`,
      data: { zero: c.zero, lm: c.lm, worstReg }
    };
  },

  /**
   * _issueCATrend — CA count declining vs LM
   */
  _issueCATrend: (k) => {
    const c   = k.ca;
    const pct = c.lm > 0 ? ((c.tot - c.lm) / c.lm) * 100 : 0;
    const sB  = AlertEngine._scoreVsLM(pct);
    const score = Math.min(100, sB * 1.5);
    if (score < 10) return null;
    const bdg    = AlertEngine._badge(score);
    const gapStr = Utils.fmtCompact(c.tot - c.lm);
    return {
      id: 'ca-trend', domain: 'CA', type: 'vs-lm',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `CA Aktif ${Utils.fmtCompact(c.tot)} — turun ${Math.abs(pct).toFixed(1)}% vs LM (${gapStr})`,
      action: `Investigasi penyebab churn CA. Program retensi harus diaktifkan segera.`,
      data: { tot: c.tot, lm: c.lm, delta: c.delta }
    };
  },

  /**
   * _issuePSSellIn — PS Sell In under-achievement
   */
  _issuePSSellIn: (k) => {
    if (!k.ps?.hasData) return null;
    const ps = k.ps;
    const td = TimeEngine.get();
    const sA = AlertEngine._scoreAchVsPace(ps.siAch, td.timeGone);
    const sB = AlertEngine._scoreVsLM(ps.siTrend.vsLM);
    const score = Math.min(100, sA + sB);
    if (score < 15) return null;
    const bdg    = AlertEngine._badge(score);
    const lmStr  = ps.siTrend.hasLM ? ` | ${TrendEngine.insight(ps.siTrend)}` : '';
    return {
      id: 'ps-sell-in', domain: 'PS', type: 'ach-vs-pace',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `PS Sell In Ach ${Utils.fmtPct(ps.siAch)} vs Pace ${Utils.fmtPct(td.timeGone)}${lmStr}`,
      action: `Dorong pengisian stok PS. Pastikan SI cukup untuk mendukung target SO.`,
      data: { siAch: ps.siAch, soAch: ps.soAch }
    };
  },

  /**
   * _issueRunRatePressure — High RR multiplier (near-impossible pace)
   */
  _issueRunRatePressure: (k) => {
    const p  = k.perf;
    const td = TimeEngine.get();
    if (td.hkRem <= 0 || p.actRR === 0) return null;
    const rrRatio = p.reqRR / p.actRR;
    if (rrRatio < 1.3) return null;   // suppress if gap is manageable
    const sE  = AlertEngine._scoreRRPressure(p.reqRR, p.actRR);
    const score = Math.min(100, sE * 5);
    const bdg   = AlertEngine._badge(score);
    return {
      id: 'perf-runrate', domain: 'PERFORMANCE', type: 'runrate',
      severityScore: score,
      badgeCls: bdg.cls, badgeLabel: bdg.label,
      headline: `Required Run Rate ${Utils.fmtCompact(p.reqRR)}/HK — ${rrRatio.toFixed(1)}× pace aktual (${Utils.fmtCompact(p.actRR)}/HK)`,
      action: `Sisa ${td.hkRem} HK. Perlu eskalasi strategi jika run rate tidak naik signifikan minggu ini.`,
      data: { reqRR: p.reqRR, actRR: p.actRR, hkRem: td.hkRem }
    };
  },

  /**
   * _issueSystemNoData — DimDate not loaded (operational risk)
   */
  _issueSystemNoData: () => {
    if (State.timeEngine.valid) return null;
    return {
      id: 'system-dimdate', domain: 'SYSTEM', type: 'data-quality',
      severityScore: 30,   // fixed — always visible but not top
      badgeCls: 'solid-amber', badgeLabel: '🟠 DATA WARN',
      headline: `Working Days dari fallback sentinel — DimDate belum dimuat`,
      action: `Upload file dengan sheet DimDate agar pace & run rate dihitung akurat.`,
      data: { source: State.timeEngine.source }
    };
  },

  // ── Main entry point ──────────────────────────────────────────────

  /**
   * generate(k) — scan all domains, score & sort issues.
   *
   * @param {object} k  State.kpi — full KPI snapshot from KPIEngine.runAll()
   * @returns {{
   *   issues:   Issue[],  — all issues, sorted by severityScore desc
   *   top5:     Issue[],  — first 5 issues (for priority action list)
   *   topIssue: Issue|null — highest-severity issue (for alert banner)
   * }}
   */
  generate: (k) => {
    const candidates = [
      AlertEngine._issueOverallPerf(k),
      ...AlertEngine._issuesByPrinciple(k),
      AlertEngine._issueWsBimaZero(k),
      AlertEngine._issueWsArjZero(k),
      AlertEngine._issueWsOverall(k),
      AlertEngine._issueCAZero(k),
      AlertEngine._issueCATrend(k),
      AlertEngine._issuePSSellIn(k),
      AlertEngine._issueRunRatePressure(k),
      AlertEngine._issueSystemNoData()
    ].filter(Boolean);   // remove nulls (healthy / suppressed issues)

    // Sort: severity descending, then domain order as tiebreak
    const domainOrder = { PERFORMANCE: 0, WHOLESALER: 1, CA: 2, PS: 3, SYSTEM: 99 };
    const issues = candidates.sort((a, b) => {
      if (b.severityScore !== a.severityScore) return b.severityScore - a.severityScore;
      return (domainOrder[a.domain] ?? 50) - (domainOrder[b.domain] ?? 50);
    });

    return {
      issues,
      top5:     issues.slice(0, 5),
      topIssue: issues[0] ?? null
    };
  },

  // ── Alert banner sentence builder ─────────────────────────────────

  /**
   * bannerSentence(alerts, k) — generates the alert banner text from scored issues.
   * Top issue drives the lead sentence. Secondary issues appended as summary counts.
   * Never hardcoded — every word comes from live data.
   *
   * @param {{ issues, top5, topIssue }} alerts
   * @param {object} k  State.kpi
   * @returns {string}
   */
  bannerSentence: (alerts, k) => {
    const tf  = TimeEngine.fmt();
    const top = alerts.topIssue;

    // DimDate warning prefix
    const sysWarn = !State.timeEngine.valid
      ? `⚠ ${tf.sourceTag} | `
      : '';

    if (!top) {
      return `${sysWarn}✅ Semua KPI dalam kondisi normal. Overall ${Utils.fmtPct(k.perf.ach)} vs Pace ${tf.timeGoneLabel}.`;
    }

    // Lead: top issue headline
    const lead = `${top.badgeLabel}: ${top.headline}`;

    // Summary: count issues by badge tier
    const critCount = alerts.issues.filter(i => i.badgeLabel.includes('CRITICAL')).length;
    const dangCount = alerts.issues.filter(i => i.badgeLabel.includes('DANGER')).length;
    const warnCount = alerts.issues.filter(i => i.badgeLabel.includes('WARNING')).length;
    const parts = [];
    if (critCount) parts.push(`${critCount} CRITICAL`);
    if (dangCount) parts.push(`${dangCount} DANGER`);
    if (warnCount) parts.push(`${warnCount} WARNING`);
    const summary = parts.length > 1 ? ` [Total: ${parts.join(', ')}]` : '';

    return `${sysWarn}${lead}${summary}`;
  }
};
