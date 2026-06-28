/**
 * commentaryEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Three commentary/insight engines in one file.
 * Definition order: InsightEngine → PrincipleCommentaryEngine → ExecSummaryEngine.
 * (InsightEngine.principleComment() calls PrincipleCommentaryEngine at runtime, so
 * definition order does not matter for correctness, but HTML order is preserved.)
 *
 * Sources:
 *   InsightEngine             — SCT-by-SHP.html lines 3817–4129
 *   PrincipleCommentaryEngine — SCT-by-SHP.html lines 4149–4764
 *   ExecSummaryEngine         — SCT-by-SHP.html lines 4793–5073
 *
 * Dependencies:
 *   state.js                   — State.filters, State.options (ExecSummaryEngine.render)
 *   business/timegoneEngine.js — TimeEngine.get(), .pace(), .actualRR(), .runRate()
 *   utils/helpers.js           — Utils.safeNum(), Utils.safeDiv(), Utils.calcAch(),
 *                                Utils.fmtPct(), Utils.fmtCompact()
 *
 * ── What these engines do ────────────────────────────────────────────────────
 *   InsightEngine.generateInsights(k)         → scored insight array (sorted by priority)
 *   InsightEngine.render(insights, n)         → HTML for insight strip
 *   InsightEngine.principleComment(pr, tg)    → thin delegate → PrincipleCommentaryEngine
 *
 *   PrincipleCommentaryEngine.build(pr, tg)          → Block[4]
 *   PrincipleCommentaryEngine.subtitle(blocks)        → string (≤2 sentences)
 *   PrincipleCommentaryEngine.panelHtml(pr,blks,tg,byCat) → full deep-dive HTML
 *
 *   ExecSummaryEngine.build(k)          → Slot[5] array
 *   ExecSummaryEngine.render(slots, k)  → HTML for exec-summary-list
 *
 * ── What these engines do NOT do ─────────────────────────────────────────────
 *   - No KPI aggregation (reads k = State.kpi passed as parameter)
 *   - No alert scoring (→ rankingEngine.js)
 *   - No anomaly detection (→ anomalyEngine.js)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ==========================================
// 1. INSIGHT ENGINE
// ==========================================

const InsightEngine = {

  // ── Sentence templates — parameterized, never concatenated ad-hoc ──
  // Each fn receives exact values and returns a complete sentence.
  // Word-count discipline enforced by design (no long chains).

  _T: {
    positiveGrowth: (subject, pct, abs) =>
      `${subject} mencatat pertumbuhan ${pct}% vs bulan lalu, menambah ${abs} ke total aktual.`,

    positiveGrowthStrong: (subject, pct) =>
      `${subject} tumbuh kuat +${pct}% vs LM — momentum ini perlu dipertahankan hingga akhir periode.`,

    positiveLY: (subject, pct) =>
      `${subject} melampaui capaian tahun lalu sebesar +${pct}%, menunjukkan tren tahunan yang sehat.`,

    majorDecline: (subject, pct, abs) =>
      `${subject} turun ${pct}% vs bulan lalu (${abs}), perlu investigasi segera sebelum gap melebar.`,

    criticalDecline: (subject, pct) =>
      `${subject} mengalami penurunan kritis ${pct}% vs LM — eskalasi ke manajemen diperlukan hari ini.`,

    belowPace: (subject, achPct, pacePct) =>
      `${subject} baru ${achPct}% sementara waktu sudah ${pacePct}% berjalan — tertinggal dari target pace.`,

    belowPaceSevere: (subject, gap) =>
      `${subject} tertinggal ${gap}pp dari pace — dibutuhkan akselerasi signifikan di sisa hari kerja.`,

    topContributor: (subject, sharePct) =>
      `${subject} menjadi kontributor terbesar dengan ${sharePct}% share aktual, menopang performance keseluruhan.`,

    biggestDragger: (subject, achPct) =>
      `${subject} dengan capaian ${achPct}% menjadi beban terbesar yang menghambat target keseluruhan.`,

    regionIssue: (region, achPct, gap) =>
      `Region ${region} (${achPct}%) tertinggal jauh dari rata-rata, gap ${gap}pp perlu perhatian khusus segera.`,

    regionLeading: (region, achPct) =>
      `Region ${region} memimpin dengan capaian ${achPct}%, dapat dijadikan benchmark untuk region lain.`,

    channelIssue: (channel, deltaPct) =>
      `Channel ${channel} kehilangan ${Math.abs(deltaPct)}% CA vs bulan lalu — risiko penurunan coverage distributor.`,

    channelGrowth: (channel, deltaPct) =>
      `Channel ${channel} mencatat pertumbuhan CA +${deltaPct}% vs LM, indikasi ekspansi coverage positif.`,

    zeroTrxWS: (program, count, total) =>
      `${count} dari ${total} WS program ${program} belum transaksi — penetrasi awal harus dimulai hari ini.`,

    runRatePressure: (rrReq, rrAct, hkRem) =>
      `Run rate dibutuhkan ${rrReq}/HK vs realisasi ${rrAct}/HK — tekanan tinggi di sisa ${hkRem} hari kerja.`,

    caZeroRisk: (count, pct) =>
      `${count} CA aktif bulan lalu kini zero transaksi (${pct}% dari LM) — potensi churn perlu ditangani.`,

    overallHealthy: (achPct, pacePct) =>
      `Overall ${achPct}% melampaui pace ${pacePct}% — seluruh tim on track menuju target akhir periode.`,

    psBalance: (soAch, siAch) =>
      `Sell Out (${soAch}%) lebih tinggi dari Sell In (${siAch}%) — waspadai risiko kehabisan stok di PS.`,

    psStockHeavy: (siAch, soAch) =>
      `Sell In (${siAch}%) jauh melampaui Sell Out (${soAch}%) — stok menumpuk di PS, dorong sell-through.`,
  },

  // ── Priority score for each insight type (higher = more important) ──
  _PRIORITY: {
    CRITICAL_DECLINE: 100,
    BELOW_PACE_SEVERE: 90,
    MAJOR_DECLINE: 80,
    ZERO_TRX_WS: 75,
    BELOW_PACE: 70,
    BIGGEST_DRAGGER: 65,
    CA_ZERO_RISK: 60,
    CHANNEL_ISSUE: 55,
    RUN_RATE_PRESSURE: 50,
    REGION_ISSUE: 45,
    PS_IMBALANCE: 40,
    TOP_CONTRIBUTOR: 30,
    POSITIVE_GROWTH: 25,
    REGION_LEADING: 20,
    CHANNEL_GROWTH: 15,
    OVERALL_HEALTHY: 10,
  },

  // ── Sentiment → CSS class mapping for insight-text ──
  _sentimentCls: (type) => {
    const neg = ['CRITICAL_DECLINE','MAJOR_DECLINE','BELOW_PACE_SEVERE','BELOW_PACE',
                 'BIGGEST_DRAGGER','ZERO_TRX_WS','CA_ZERO_RISK','CHANNEL_ISSUE','RUN_RATE_PRESSURE'];
    const pos = ['POSITIVE_GROWTH','TOP_CONTRIBUTOR','REGION_LEADING','CHANNEL_GROWTH','OVERALL_HEALTHY'];
    const wrn = ['REGION_ISSUE','PS_IMBALANCE'];
    if (neg.includes(type)) return 'negative';
    if (pos.includes(type)) return 'positive';
    if (wrn.includes(type)) return 'warning';
    return 'neutral';
  },

  // ── Icon per type ──
  _icon: (type) => {
    const map = {
      CRITICAL_DECLINE: '🔻', MAJOR_DECLINE: '📉', BELOW_PACE_SEVERE: '⚠️',
      BELOW_PACE: '🟠', BIGGEST_DRAGGER: '🔴', ZERO_TRX_WS: '⛔',
      CA_ZERO_RISK: '👥', CHANNEL_ISSUE: '📣', RUN_RATE_PRESSURE: '⏱',
      REGION_ISSUE: '🗺', PS_IMBALANCE: '📦', TOP_CONTRIBUTOR: '🏆',
      POSITIVE_GROWTH: '📈', REGION_LEADING: '✅', CHANNEL_GROWTH: '🟢',
      OVERALL_HEALTHY: '✅',
    };
    return map[type] || '💡';
  },

  /**
   * generateInsights(k) — scan all KPI domains and produce scored insights.
   * Returns array sorted by priority descending.
   *
   * @param {object} k  State.kpi — full snapshot
   * @returns {Array<{type, sentence, priority, sentimentCls, icon}>}
   */
  generateInsights: (k) => {
    const insights = [];
    const T  = InsightEngine._T;
    const P  = InsightEngine._PRIORITY;
    const td = TimeEngine.get();
    const pace = td.timeGone;

    // Helper: push one insight object
    const add = (type, sentence) => insights.push({
      type,
      sentence,
      priority:     P[type] ?? 0,
      sentimentCls: InsightEngine._sentimentCls(type),
      icon:         InsightEngine._icon(type)
    });

    // ── A. OVERALL PERFORMANCE ──────────────────────────────────────
    const p = k.perf;
    const overallGap = p.ach - pace;   // pp vs pace

    if (overallGap >= 5) {
      add('OVERALL_HEALTHY', T.overallHealthy(Utils.fmtPct(p.ach), Utils.fmtPct(pace)));
    } else if (overallGap < -10) {
      add('BELOW_PACE_SEVERE', T.belowPaceSevere('Overall sales', Math.abs(overallGap).toFixed(1)));
    } else if (overallGap < -5) {
      add('BELOW_PACE', T.belowPace('Overall sales', Utils.fmtPct(p.ach), Utils.fmtPct(pace)));
    }

    // Overall trend vs LM
    if (p.trend.hasLM) {
      if (p.trend.vsLM <= -20) {
        add('CRITICAL_DECLINE', T.criticalDecline('Total penjualan', Math.abs(p.trend.vsLM).toFixed(1)));
      } else if (p.trend.vsLM <= -8) {
        add('MAJOR_DECLINE', T.majorDecline('Total penjualan', Math.abs(p.trend.vsLM).toFixed(1), Utils.fmtCompact(p.trend.gapLM)));
      } else if (p.trend.vsLM >= 10) {
        add('POSITIVE_GROWTH', T.positiveGrowthStrong('Total penjualan', p.trend.vsLM.toFixed(1)));
      } else if (p.trend.vsLM >= 5) {
        add('POSITIVE_GROWTH', T.positiveGrowth('Total penjualan', p.trend.vsLM.toFixed(1), Utils.fmtCompact(p.trend.gapLM)));
      }
    }

    // Run-rate pressure
    if (p.actRR > 0 && p.reqRR > p.actRR * 1.4 && td.hkRem > 0) {
      add('RUN_RATE_PRESSURE', T.runRatePressure(
        Utils.fmtCompact(p.reqRR), Utils.fmtCompact(p.actRR), td.hkRem
      ));
    }

    // ── B. PRINCIPLE — top contributor & biggest dragger ───────────
    if (p.byPrin.length) {
      // Top contributor: highest actual
      const topPrin = p.byPrin[0];
      const totalAct = p.totAct || 1;
      const topShare = ((topPrin.act / totalAct) * 100).toFixed(0);
      if (topPrin.act > 0) {
        add('TOP_CONTRIBUTOR', T.topContributor(topPrin.principle, topShare));
      }

      // Biggest dragger: worst ach% with target > 0, min 10% share of total target
      const draggers = [...p.byPrin]
        .filter(pr => pr.tgt > 0 && (pr.tgt / (p.totTgt || 1)) > 0.08)
        .sort((a, b) => a.ach - b.ach);
      if (draggers.length) {
        const drag = draggers[0];
        if (drag.tgStatus.status === 'DANGER') {
          add('BIGGEST_DRAGGER', T.biggestDragger(drag.principle, Utils.fmtPct(drag.ach)));
        }
      }

      // Principle decline vs LM
      const prinDecline = [...p.byPrin]
        .filter(pr => pr.trend?.hasLM && pr.trend.vsLM <= -15)
        .sort((a, b) => a.trend.vsLM - b.trend.vsLM)[0];
      if (prinDecline) {
        add('MAJOR_DECLINE', T.majorDecline(
          prinDecline.principle,
          Math.abs(prinDecline.trend.vsLM).toFixed(1),
          Utils.fmtCompact(prinDecline.trend.gapLM)
        ));
      }

      // Principle positive growth
      const prinGrowing = [...p.byPrin]
        .filter(pr => pr.trend?.hasLM && pr.trend.vsLM >= 12)
        .sort((a, b) => b.trend.vsLM - a.trend.vsLM)[0];
      if (prinGrowing) {
        add('POSITIVE_GROWTH', T.positiveGrowth(
          prinGrowing.principle,
          prinGrowing.trend.vsLM.toFixed(1),
          Utils.fmtCompact(prinGrowing.trend.gapLM)
        ));
      }
    }

    // ── C. REGION ───────────────────────────────────────────────────
    if (p.byReg.length >= 2) {
      const worst  = p.byReg[0];          // sorted asc — worst first
      const best   = p.byReg[p.byReg.length - 1];
      const avgAch = p.byReg.reduce((s, r) => s + r.ach, 0) / p.byReg.length;

      if (worst.ach < avgAch - 8) {
        add('REGION_ISSUE', T.regionIssue(
          worst.region, Utils.fmtPct(worst.ach), (avgAch - worst.ach).toFixed(1)
        ));
      }
      if (best.ach > pace + 5) {
        add('REGION_LEADING', T.regionLeading(best.region, Utils.fmtPct(best.ach)));
      }
    }

    // ── D. CHANNEL (CA) ─────────────────────────────────────────────
    if (k.ca.byCh?.length) {
      // Worst channel CA decline
      const worstCh = k.ca.byCh[0];   // sorted delta asc
      if (worstCh.delta <= -15) {
        add('CHANNEL_ISSUE', T.channelIssue(worstCh.name, worstCh.delta.toFixed(1)));
      }
      // Best channel CA growth
      const bestCh = [...k.ca.byCh].sort((a, b) => b.delta - a.delta)[0];
      if (bestCh.delta >= 10) {
        add('CHANNEL_GROWTH', T.channelGrowth(bestCh.name, bestCh.delta.toFixed(1)));
      }
    }

    // CA zero-trx risk
    if (k.ca.zero > 0 && k.ca.lm > 0) {
      const zeroPct = ((k.ca.zero / k.ca.lm) * 100).toFixed(1);
      if (parseFloat(zeroPct) >= 5) {
        add('CA_ZERO_RISK', T.caZeroRisk(k.ca.zero, zeroPct));
      }
    }

    // ── E. WHOLESALER ZERO TRX ──────────────────────────────────────
    if (k.ws.bim.zro > 0) {
      add('ZERO_TRX_WS', T.zeroTrxWS('Bima', k.ws.bim.zro, k.ws.bim.t));
    }
    if (k.ws.arj.zro > 0 && (k.ws.arj.zro / k.ws.arj.t) > 0.2) {
      add('ZERO_TRX_WS', T.zeroTrxWS('Arjuna', k.ws.arj.zro, k.ws.arj.t));
    }

    // ── F. PS STOCK BALANCE ─────────────────────────────────────────
    if (k.ps?.hasData) {
      const siAch = k.ps.siAch, soAch = k.ps.soAch;
      const gap   = soAch - siAch;
      if (gap > 6) {
        add('PS_IMBALANCE', T.psBalance(Utils.fmtPct(soAch), Utils.fmtPct(siAch)));
      } else if (gap < -8) {
        add('PS_IMBALANCE', T.psStockHeavy(Utils.fmtPct(siAch), Utils.fmtPct(soAch)));
      }
    }

    // ── Sort by priority descending; deduplicate by sentence similarity ──
    insights.sort((a, b) => b.priority - a.priority);

    // Deduplicate: same type only once (keep highest priority = already first)
    const seen = new Set();
    return insights.filter(ins => {
      if (seen.has(ins.type)) return false;
      seen.add(ins.type);
      return true;
    });
  },

  /**
   * render(insights, n) — builds HTML for the executive summary list.
   * Shows at most `n` insights (default 6).
   * @param {Array} insights  Result of generateInsights()
   * @param {number} [n=6]
   * @returns {string} HTML
   */
  render: (insights, n = 6) => {
    if (!insights.length) {
      return `<div class="insight-item">
        <span class="insight-icon">✅</span>
        <span class="insight-text positive">Semua indikator dalam kondisi normal — tidak ada issue kritis terdeteksi saat ini.</span>
      </div>`;
    }
    return insights.slice(0, n).map(ins => `
      <div class="insight-item">
        <span class="insight-icon">${ins.icon}</span>
        <span class="insight-text ${ins.sentimentCls}">${ins.sentence}</span>
      </div>`).join('');
  },

  /**
   * principleComment — superseded by PrincipleCommentaryEngine.subtitle().
   * Kept as thin delegation for any external callers.
   * @param {object} pr       Principle object
   * @param {number} timeGone Pace %
   * @returns {string}
   */
  principleComment: (pr, timeGone) => {
    const blocks = PrincipleCommentaryEngine.build(pr, timeGone);
    return PrincipleCommentaryEngine.subtitle(blocks);
  }
};

// ==========================================
// 2. PRINCIPLE COMMENTARY ENGINE
// ==========================================
/**
 * PrincipleCommentaryEngine
 * Generates dynamic, 4-block commentary per principle.
 * Each block = 1 sentence max. Table subtitle shows ≤2 sentences.
 * Full 4 blocks in expandable panel (click to expand row).
 *
 * 4 Blocks: PERFORMANCE · TREND · ISSUE · REKOMENDASI
 *
 * Data consumed: ach, gap, trend (vsLM/vsLY), tgStatus, byReg[]
 *
 * Public API:
 *   PrincipleCommentaryEngine.build(pr, timeGone)           → Block[4]
 *   PrincipleCommentaryEngine.subtitle(blocks)              → string (≤2 sentences)
 *   PrincipleCommentaryEngine.panelHtml(pr, blocks, timeGone) → HTML
 */
const PrincipleCommentaryEngine = {

  _blockPerformance: (pr, timeGone) => {
    const achFmt  = Utils.fmtPct(pr.ach);
    const tgFmt   = Utils.fmtPct(timeGone);
    const gap     = pr.tgStatus.gap;
    const gapAbs  = Utils.fmtCompact(Math.abs(pr.gap));
    let sentence, tone;
    if (gap >= 10) {
      sentence = `Capaian ${achFmt} unggul ${gap.toFixed(1)}pp dari pace — performa terkuat, gap target tinggal ${gapAbs}.`;
      tone = 'tone-good';
    } else if (gap >= 2) {
      sentence = `Capaian ${achFmt} di atas pace ${tgFmt} — on track, jaga konsistensi hingga akhir periode.`;
      tone = 'tone-good';
    } else if (gap >= -5) {
      sentence = `Capaian ${achFmt} hampir sesuai pace — gap ${gapAbs}, risiko miss jika tidak ada akselerasi segera.`;
      tone = 'tone-warning';
    } else if (gap >= -15) {
      sentence = `Capaian ${achFmt} tertinggal ${Math.abs(gap).toFixed(1)}pp dari pace ${tgFmt} — gap ${gapAbs} harus dikejar aktif.`;
      tone = 'tone-warning';
    } else {
      sentence = `Capaian ${achFmt} jauh di bawah pace — gap ${gapAbs} kritis, eskalasi strategi diperlukan segera.`;
      tone = 'tone-critical';
    }
    return { label: 'Performance', sentence, tone };
  },

  _blockTrend: (pr) => {
    const t = pr.trend;
    if (!t.hasLM) return null;
    const lmPct  = `${t.vsLM >= 0 ? '+' : ''}${t.vsLM.toFixed(1)}%`;
    const lmGap  = `${t.gapLM >= 0 ? '+' : ''}${Utils.fmtCompact(t.gapLM)}`;
    const lyPart = t.hasLY
      ? ` | vs LY: ${t.vsLY >= 0 ? '+' : ''}${t.vsLY.toFixed(1)}%`
      : '';
    let sentence, tone;
    if (t.vsLM >= 15) {
      sentence = `Tumbuh kuat ${lmPct} vs LM (${lmGap})${lyPart} — momentum pertumbuhan sangat positif.`;
      tone = 'tone-good';
    } else if (t.vsLM >= 5) {
      sentence = `Naik ${lmPct} vs LM (${lmGap})${lyPart} — tren positif yang perlu dipertahankan.`;
      tone = 'tone-good';
    } else if (t.vsLM >= -3) {
      sentence = `Relatif flat vs LM (${lmGap})${lyPart} — tidak ada penurunan, namun pertumbuhan belum terlihat.`;
      tone = '';
    } else if (t.vsLM >= -10) {
      sentence = `Turun ${lmPct} vs LM (${lmGap})${lyPart} — tren menurun, perlu investigasi penyebabnya.`;
      tone = 'tone-warning';
    } else {
      sentence = `Penurunan tajam ${lmPct} vs LM (${lmGap})${lyPart} — sinyal kritis yang harus segera ditindaklanjuti.`;
      tone = 'tone-critical';
    }
    return { label: 'Trend', sentence, tone };
  },

  _blockIssue: (pr, timeGone) => {
    const issues = [];
    // Region drag
    if (pr.byReg && pr.byReg.length >= 2) {
      const avgAch = pr.byReg.reduce((s, r) => s + r.ach, 0) / pr.byReg.length;
      const worst  = pr.byReg[0];
      const rgap   = avgAch - worst.ach;
      if (rgap >= 12) {
        issues.push({ score: 80 + Math.min(20, rgap), label: 'Issue', tone: 'tone-critical',
          sentence: `Region ${worst.region} tertinggal ${rgap.toFixed(1)}pp dari rata-rata — titik lemah terbesar principle ini.` });
      } else if (rgap >= 5) {
        issues.push({ score: 50 + rgap, label: 'Issue', tone: 'tone-warning',
          sentence: `Region ${worst.region} (${Utils.fmtPct(worst.ach)}) di bawah rata-rata — perlu pendampingan khusus untuk menutup gap.` });
      }
    }
    // Severe pace gap
    const paceGap = timeGone - pr.ach;
    if (paceGap >= 20) {
      issues.push({ score: 75, label: 'Issue', tone: 'tone-critical',
        sentence: `Tertinggal ${paceGap.toFixed(1)}pp dari pace — dengan sisa HK yang ada, kejar target akan sangat berat.` });
    }
    // LM decline
    if (pr.trend.hasLM && pr.trend.vsLM <= -15) {
      issues.push({ score: 70, label: 'Issue', tone: 'tone-critical',
        sentence: `Penurunan ${Math.abs(pr.trend.vsLM).toFixed(1)}% vs LM mengindikasikan masalah distribusi atau demand.` });
    } else if (pr.trend.hasLM && pr.trend.vsLM <= -8) {
      issues.push({ score: 55, label: 'Issue', tone: 'tone-warning',
        sentence: `Turun ${Math.abs(pr.trend.vsLM).toFixed(1)}% vs LM — audit outlet aktif dan pastikan coverage tidak berkurang.` });
    }
    // Double decline (LM + LY)
    if (pr.trend.hasLY && pr.trend.vsLY <= -10 && pr.trend.hasLM && pr.trend.vsLM < 0) {
      issues.push({ score: 45, label: 'Issue', tone: 'tone-warning',
        sentence: `Turun vs LM dan vs LY sekaligus — tren penurunan berlanjut year-over-year, review strategi diperlukan.` });
    }
    if (!issues.length) return null;
    issues.sort((a, b) => b.score - a.score);
    const { score, ...block } = issues[0];
    return block;
  },

  _blockRecommendation: (pr, timeGone, issueBlock) => {
    const td      = TimeEngine.get();
    const paceGap = timeGone - pr.ach;
    const gapAbs  = Utils.fmtCompact(Math.abs(pr.gap));
    const hkRem   = td.hkRem;
    const rrNeed  = hkRem > 0 ? Utils.fmtCompact(Math.abs(pr.gap) / hkRem) : '—';
    let sentence;

    if (issueBlock?.sentence.includes('Region') && pr.byReg?.[0]) {
      const worst = pr.byReg[0];
      sentence = `Fokus sumber daya di ${worst.region} — angkat capaian ${Utils.fmtPct(worst.ach)} minimal sesuai pace dalam ${hkRem} HK ke depan.`;
    } else if (paceGap >= 15) {
      sentence = `Butuh ${rrNeed}/HK untuk menutup gap ${gapAbs} dalam ${hkRem} HK — aktifkan program akselerasi dan eskalasi ke manajemen.`;
    } else if (pr.trend.hasLM && pr.trend.vsLM <= -10) {
      sentence = `Audit daftar outlet aktif dan recovery vs LM harus dimulai minggu ini — jangan biarkan penurunan berlanjut.`;
    } else if (paceGap <= 0) {
      sentence = `Pertahankan run rate saat ini — amankan distribusi di ${hkRem} HK tersisa untuk memastikan target tercapai.`;
    } else {
      sentence = `Tambah frekuensi kunjungan outlet — gap ${gapAbs} masih bisa dikejar dalam ${hkRem} HK dengan eksekusi konsisten.`;
    }
    return { label: 'Rekomendasi', sentence, tone: '' };
  },

  // ── Public API ──────────────────────────────────────────────────

  build: (pr, timeGone) => {
    const perf  = PrincipleCommentaryEngine._blockPerformance(pr, timeGone);
    const trend = PrincipleCommentaryEngine._blockTrend(pr);
    const issue = PrincipleCommentaryEngine._blockIssue(pr, timeGone);
    const rec   = PrincipleCommentaryEngine._blockRecommendation(pr, timeGone, issue);
    // CA influence on Recommendation (additive — appends a CA-driven clause when concerning)
    if (rec) {
      const ca = PrincipleCommentaryEngine.generateCAAnalysis(pr);
      if (ca.scenario === 'contraction')
        rec.sentence += ` CA juga menurun ${Math.abs(ca.caGrowth).toFixed(1)}% — prioritaskan recovery outlet inaktif.`;
      else if (ca.scenario === 'productivity_issue')
        rec.sentence += ` CA tumbuh ${ca.caGrowth.toFixed(1)}% namun sales tertekan — fokus pada produktivitas outlet aktif.`;
      else if (ca.scenario === 'productivity_gain')
        rec.sentence += ` Pertumbuhan ditopang produktivitas (CA ${ca.caGrowth.toFixed(1)}%) — jaga basis outlet aktif.`;
    }
    return [perf, trend, issue, rec].filter(Boolean);
  },

  subtitle: (blocks) => {
    const perf  = blocks.find(b => b.label === 'Performance');
    const issue = blocks.find(b => b.label === 'Issue');
    const trend = blocks.find(b => b.label === 'Trend' && (b.tone || '').includes('critical'));
    const second = issue || trend;
    if (!perf) return '';
    return second ? `${perf.sentence} ${second.sentence}` : perf.sentence;
  },

  /**
   * generateSubCategoryIssue(byCategory, principle, timeGone) ← NEW HELPER
   * Finds the top-3 worst-performing Sub Kategori within this principle.
   * Source: k.perf.byCategory[] — already aggregated, zero extra loop.
   * Priority: worst gap vs BP → worst vsLM → furthest below pace.
   *
   * @param {Array}  byCategory  k.perf.byCategory
   * @param {string} principle   principle name to filter
   * @param {number} timeGone    pace % from TimeEngine
   * @returns {string} HTML — amber chip list, or '' if no data
   */
  generateSubCategoryIssue: (byCategory, principle, timeGone) => {
    if (!byCategory?.length) return '';

    // Filter: only entries belonging to this principle, with negative gap
    const prinCats = byCategory
      .filter(c => c.prin === principle && c.gap < 0)
      .map(c => ({
        display:  c.subCat ? `${c.subCat} [${c.mainCat}]` : c.mainCat,
        gap:      c.gap,
        vsLM:     c.trend.hasLM ? c.trend.vsLM : null,
        paceGap:  c.ach - timeGone,
        // composite score: biggest gap + worst LM + furthest below pace
        score: Math.abs(c.gap) / 1e8
             + (c.trend.hasLM && c.trend.vsLM < 0 ? Math.abs(c.trend.vsLM) : 0)
             + (c.ach < timeGone ? timeGone - c.ach : 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (!prinCats.length) return '';

    const items = prinCats.map(c => {
      const gapFmt = Utils.fmtCompact(c.gap);
      const lmTxt  = c.vsLM !== null ? ` | vs LM ${c.vsLM.toFixed(1)}%` : '';
      return `<span class="prin-com-chip bg-amber" style="margin:2px 2px;max-width:100%">${c.display}: ${gapFmt}${lmTxt}</span>`;
    }).join('');

    return `
      <div style="margin-top:8px">
        <div class="prin-com-label" style="margin-bottom:4px;color:var(--amber-main)">Sub Kategori dengan masalah terbesar:</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${items}</div>
      </div>`;
  },

  /**
   * generateSKUIssue(byCategory, principle, td) ← NEW HELPER
   * Finds top-3 to 5 worst SKUs within this principle using skuIssues[]
   * already computed per byCategory entry — zero extra aggregation.
   * Priority: worst score (biggest gap + worst vsLM) → pre-sorted in skuIssues.
   *
   * @param {Array}  byCategory  k.perf.byCategory
   * @param {string} principle   principle name to filter
   * @param {object} td          TimeEngine.get() snapshot
   * @returns {string} HTML — soft-red SKU cards, or '' if no data
   */
  generateSKUIssue: (byCategory, principle, td) => {
    if (!byCategory?.length) return '';

    // Collect all SKU issues from this principle's sub-categories
    const allSKUs = byCategory
      .filter(c => c.prin === principle)
      .flatMap(c => c.skuIssues || [])
      .filter(s => s.gap < 0 || (s.vsLM !== null && s.vsLM < -5));

    // Deduplicate by SKU name, keep worst score
    const skuMap = {};
    allSKUs.forEach(s => {
      if (!skuMap[s.sku] || s.score > skuMap[s.sku].score) skuMap[s.sku] = s;
    });

    const top = Object.values(skuMap)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (!top.length) return '';

    const cards = top.map(s => {
      const gapBP  = `Gap ${s.gap >= 0 ? '+' : ''}${Utils.fmtCompact(s.gap)}`;
      const lmTxt  = s.vsLM !== null ? `vs LM ${s.vsLM.toFixed(1)}%` : null;
      const weakReg = s.weakestRegs?.length
        ? `Weakest: ${s.weakestRegs.slice(0, 2).map(r => `${r.region} (${Utils.fmtCompact(r.gap)})`).join(', ')}`
        : null;

      return `
        <div class="dd-issue-card" style="background:rgba(192,57,43,.07);border:1px solid var(--red-bdr)">
          <div class="t">${s.sku}</div>
          <div class="m text-red">↓ ${gapBP}${lmTxt ? ` | ${lmTxt}` : ''}</div>
          ${PrincipleCommentaryEngine.renderSKUCAAnalysis(s)}
          ${weakReg ? `<div class="s">${weakReg}</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="margin-top:8px">
        <div class="prin-com-label" style="margin-bottom:4px;color:var(--red-main)">SKU Issue Utama:</div>
        ${cards}
      </div>`;
  },

  /**
   * generateChannelIssueAnalysis(pr, timeGone) ← NEW HELPER
   * Shows top-3 to 5 channels with worst gap performance for this principle.
   * Source: pr.byChannel[] — aggregated once in calcPerformance, zero extra loop.
   *
   * Scoring per channel (combined negative signals):
   *   score = |gap|/1e8          ← absolute gap weight (biggest gap = worst)
   *         + |vsLM| (if <0)     ← LM decline weight
   *         + (timeGone-ach)     ← pace gap weight (how far below pace)
   *
   * @param {object} pr         principle object (has pr.byChannel[])
   * @param {number} timeGone   pace % from TimeEngine
   * @returns {string} HTML — soft-blue channel cards, or '' if no negative channels
   */
  generateChannelIssueAnalysis: (pr, timeGone) => {
    if (!pr.byChannel?.length) return '';

    // Only channels with a negative gap — worst first (already sorted)
    const worst = pr.byChannel
      .filter(c => c.gap < 0)
      .map(c => ({
        ...c,
        score: Math.abs(c.gap) / 1e8
             + (c.vsLM !== null && c.vsLM < 0 ? Math.abs(c.vsLM) : 0)
             + (c.ach < timeGone ? timeGone - c.ach : 0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (!worst.length) return '';

    const cards = worst.map(c => {
      const gapFmt = Utils.fmtCompact(c.gap);
      const lmTxt  = c.vsLM !== null ? ` | vs LM ${c.vsLM.toFixed(1)}%` : '';
      const achTxt = ` | Ach ${c.ach.toFixed(1)}%`;
      const weakStr = c.weakReg?.length
        ? `<div class="s">Weakest: ${
            c.weakReg.map(r => `${r.region} (${Utils.fmtCompact(r.gap)})`).join(', ')
          }</div>`
        : '';
      const cac = PrincipleCommentaryEngine.renderChannelCAAnalysis(c);
      return `
        <div class="dd-issue-card" style="background:rgba(26,82,118,.06);border:1px solid var(--blue-bdr)">
          <div class="t" style="color:var(--blue-main)">${c.channel}${cac.badge}</div>
          <div class="m text-red">↓ Gap ${gapFmt}${lmTxt}${achTxt}</div>
          ${cac.body}
          ${weakStr}
        </div>`;
    }).join('');

    return `
      <div style="margin-top:8px">
        <div class="prin-com-label" style="margin-bottom:4px;color:var(--blue-main)">Channel Issue Utama:</div>
        ${cards}
      </div>`;
  },

  /**
   * generateCAAnalysis(pr) ← NEW
   * Customer-Active diagnosis from the Perfomance sheet (pr.caTM / pr.caLM — NOT CA_Master).
   * Classifies the sales↔CA relationship into 4 cases and derives regional CA best/worst.
   * @returns {{hasCA, caTM, caLM, caGrowth, salesG, scenario, narrative, regCA, best, worst}}
   */
  generateCAAnalysis: (pr) => {
    const caTM = Utils.safeNum(pr.caTM), caLM = Utils.safeNum(pr.caLM);
    const hasCA = caLM > 0 || caTM > 0;
    const caGrowth = caLM > 0 ? ((caTM - caLM) / caLM) * 100 : null;
    const salesG = pr.trend ? pr.trend.vsLM : null;   // sales growth vs LM (%)

    let scenario = null, narrative = '';
    if (!hasCA || caGrowth === null) {
      scenario = 'no_data';
      narrative = 'Data Customer Active tidak tersedia untuk principle ini.';
    } else {
      const sUp = (salesG ?? 0) >= 0, cUp = caGrowth >= 0;
      if (sUp && cUp)        { scenario = 'expansion';          narrative = 'Sales dan customer active tumbuh bersamaan — indikasi ekspansi distribusi yang sehat.'; }
      else if (sUp && !cUp)  { scenario = 'productivity_gain';  narrative = 'Pertumbuhan sales didorong peningkatan produktivitas meski customer active menurun.'; }
      else if (!sUp && cUp)  { scenario = 'productivity_issue'; narrative = 'Customer active tumbuh namun sales masih tertekan — indikasi tantangan produktivitas outlet.'; }
      else                   { scenario = 'contraction';        narrative = 'Sales dan customer active sama-sama menurun — indikasi kontraksi distribusi, recovery segera diperlukan.'; }
    }

    // Regional CA context (best/worst by CA growth)
    const regCA = (pr.byReg || []).filter(r => r.caGrowth !== null);
    const byCAdesc = [...regCA].sort((a, b) => b.caGrowth - a.caGrowth);
    const best  = byCAdesc[0] || null;
    const worst = byCAdesc.length ? byCAdesc[byCAdesc.length - 1] : null;

    return { hasCA, caTM, caLM, caGrowth, salesG, scenario, narrative, regCA: byCAdesc, best, worst };
  },

  generateActionPlan: (pr, blocks, timeGone) => {
    const td     = TimeEngine.get();
    const hkRem  = td.hkRem;
    const issue  = blocks.find(b => b.label === 'Issue');
    const issueText = issue ? issue.sentence : '';
    const gapAbs = Utils.fmtCompact(Math.abs(pr.gap));
    const rrNeed = hkRem > 0 ? Utils.fmtCompact(Math.abs(pr.gap) / hkRem) : '—';

    const worstReg  = (pr.byReg && pr.byReg.length) ? pr.byReg[0] : null;
    const worstChan = (pr.byChannel && pr.byChannel.length && pr.byChannel[0].gap < 0) ? pr.byChannel[0] : null;

    // Dominant issue classification (priority: channel → region → decline → pace)
    const isChannel = !!worstChan && Math.abs(worstChan.gap) >= Math.abs(pr.gap) * 0.25;
    const isRegion  = !!worstReg && (issueText.includes('Region') || (pr.byReg && pr.byReg.length > 1));
    const isDecline = pr.trend.hasLM && pr.trend.vsLM < 0;

    const actions = [];

    // ── CA-driven actions take priority (CA analysis influences the Action Plan) ──
    const ca = PrincipleCommentaryEngine.generateCAAnalysis(pr);
    const worstCAReg = ca.worst && ca.worst.caGrowth < 0 ? ca.worst : (worstReg || null);
    if (ca.scenario === 'contraction' || (ca.caGrowth !== null && ca.caGrowth < 0)) {
      // Sales & CA declining (or CA declining): recover outlets, chase CA loss, activate
      actions.push(`Recover outlet inaktif di region terlemah${worstCAReg ? ` ${worstCAReg.region}` : ''}.`);
      actions.push(`Fokus follow-up pada channel dengan CA loss terbesar.`);
      actions.push(`Tingkatkan aktivasi outlet sebelum akhir bulan.`);
      return actions.slice(0, 3);
    }
    if (ca.scenario === 'productivity_issue') {
      // CA grows but sales decline: lift productivity, premium mix, repeat transactions
      actions.push(`Tingkatkan produktivitas outlet aktif (CA naik ${ca.caGrowth.toFixed(1)}% namun sales turun).`);
      actions.push(`Fokus eksekusi pada SKU mix bernilai tinggi.`);
      actions.push(`Dorong repeat transaction di channel utama.`);
      return actions.slice(0, 3);
    }

    if (isChannel) {
      actions.push(`Fokus recovery di channel ${worstChan.channel} yang menyumbang gap terbesar (${Utils.fmtCompact(worstChan.gap)}).`);
      if (worstChan.weakReg && worstChan.weakReg[0])
        actions.push(`Amankan eksekusi depo utama di ${worstChan.weakReg[0].region} pada ${hkRem} HK tersisa.`);
      actions.push(`Jalankan program aktivasi spesifik channel untuk mengangkat penetrasi.`);
    } else if (isRegion && worstReg) {
      actions.push(`Recover outlet inaktif prioritas di region terlemah ${worstReg.region} (${Utils.fmtPct(worstReg.ach)}).`);
      actions.push(`Prioritaskan ketersediaan stok untuk SKU dengan gap tertinggi.`);
      actions.push(`Intensifkan follow-up distributor selama ${hkRem} HK tersisa.`);
    } else if (isDecline) {
      actions.push(`Prioritaskan replenishment SKU dengan penurunan terbesar (vs LM ${pr.trend.vsLM.toFixed(1)}%).`);
      actions.push(`Eksekusi akselerasi sell-out di outlet kunci.`);
      actions.push(`Tingkatkan visibility dan coverage stok untuk menahan penurunan.`);
    } else {
      actions.push(`Tambah frekuensi kunjungan outlet untuk mengejar gap ${gapAbs}.`);
      actions.push(`Butuh run rate ${rrNeed}/HK pada ${hkRem} HK tersisa — pantau capaian harian.`);
      actions.push(`Kunci eksekusi distribusi di region & channel kontributor utama.`);
    }
    return actions.slice(0, 3);
  },

  /**
   * renderCAAnalysis(ca) ← NEW — dedicated "CA Analysis" block for the Deep Dive panel.
   * Shows CA TM / CA LM / Growth (green↑ red↓), the case narrative, and CA Growth by Region
   * with best (▲) / worst (▼) highlighted. Positioned between Trend and Recommendation.
   */
  renderCAAnalysis: (ca) => {
    if (!ca || !ca.hasCA || ca.caGrowth === null) {
      return `<div class="dd-cell"><div class="dd-sec-label">CA Analysis</div>
        <span class="prin-com-text" style="font-size:10px;color:var(--gray-500)">Data Customer Active tidak tersedia.</span></div>`;
    }
    const g = ca.caGrowth;
    const gCls = g >= 0 ? 'bg-green' : 'bg-red';
    const gTxt = `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`;
    const tone = ca.scenario === 'expansion' ? 'tone-good'
               : ca.scenario === 'contraction' ? 'tone-critical' : 'tone-warning';
    return `<div class="dd-cell">
        <div class="dd-sec-label" style="color:var(--blue-main)">CA Analysis</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          <span class="prin-com-chip">CA TM: ${Utils.fmtCompact(ca.caTM)}</span>
          <span class="prin-com-chip">CA LM: ${Utils.fmtCompact(ca.caLM)}</span>
          <span class="prin-com-chip ${gCls}">Growth: ${gTxt}</span>
        </div>
        <span class="prin-com-text ${tone}">${ca.narrative}</span>
      </div>`;
  },

  // CA Growth by Region — right-cell partner of CA Analysis (best ▲ / worst ▼)
  renderCAGrowthByRegion: (ca) => {
    if (!ca || !ca.regCA || !ca.regCA.length) {
      return `<div class="dd-cell"><div class="dd-sec-label">CA Growth by Region</div>
        <span class="prin-com-text" style="font-size:10px;color:var(--gray-500)">Tidak ada data regional CA.</span></div>`;
    }
    const chips = ca.regCA.map(r => {
      const cls  = r.caGrowth >= 0 ? 'bg-green' : 'bg-red';
      const mark = (ca.best && r.region === ca.best.region) ? '▲ '
                 : (ca.worst && r.region === ca.worst.region) ? '▼ ' : '';
      return `<span class="prin-com-chip ${cls}">${mark}${r.region}: ${r.caGrowth >= 0 ? '+' : ''}${r.caGrowth.toFixed(1)}%</span>`;
    }).join('');
    const bw = (ca.best && ca.worst) ? `<div style="font-size:9px;color:var(--gray-500);margin-top:4px">
        Best: ${ca.best.region} (${ca.best.caGrowth >= 0 ? '+' : ''}${ca.best.caGrowth.toFixed(1)}%) · Worst: ${ca.worst.region} (${ca.worst.caGrowth.toFixed(1)}%)</div>` : '';
    return `<div class="dd-cell">
        <div class="dd-sec-label">CA Growth by Region</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">${chips}</div>
        ${bw}
      </div>`;
  },

  // Per-SKU CA snippet (injected into each compact SKU card)
  renderSKUCAAnalysis: (s) => {
    if (s.caGrowth === null || s.caGrowth === undefined) return '';
    const loss = s.caGrowth < 0;
    const interp = loss ? 'Penurunan didorong berkurangnya customer aktif.'
                        : 'Penurunan lebih dipengaruhi produktivitas outlet.';
    return `<div class="s"><span class="${loss ? 'text-red' : 'text-green'}" style="font-weight:700">CA ${s.caGrowth >= 0 ? '+' : ''}${s.caGrowth.toFixed(1)}%</span> — ${interp}</div>`;
  },

  // Per-channel CA snippet + CA LOSS / CA RECOVERY badge
  renderChannelCAAnalysis: (c) => {
    if (c.caGrowth === null || c.caGrowth === undefined) return { badge: '', body: '' };
    const loss = c.caGrowth < 0;
    const badge = `<span class="dd-ca-badge ${loss ? 'dd-ca-loss' : 'dd-ca-recovery'}">${loss ? '🔴 CA LOSS' : '🟢 CA RECOVERY'}</span>`;
    const interp = loss ? 'Customer active menurun sehingga memperbesar gap channel.'
                        : 'Sales pressure terjadi meskipun customer active bertumbuh.';
    const body = `<div class="s"><span class="${loss ? 'text-red' : 'text-green'}" style="font-weight:700">CA ${c.caGrowth >= 0 ? '+' : ''}${c.caGrowth.toFixed(1)}%</span> — ${interp}</div>`;
    return { badge, body };
  },

  // Key Driver Summary — 3 executive bullets synthesizing sales↔CA, worst region, worst channel
  renderCAIssueInsight: (pr, ca) => {
    const bullets = [];
    if (ca.hasCA && ca.caGrowth !== null) {
      if (ca.scenario === 'productivity_gain')
        bullets.push(`Sales growth masih positif meskipun CA turun ${ca.caGrowth.toFixed(1)}%, menunjukkan pertumbuhan berasal dari peningkatan produktivitas outlet.`);
      else if (ca.scenario === 'contraction')
        bullets.push(`Sales dan CA sama-sama menurun (CA ${ca.caGrowth.toFixed(1)}%) — kontraksi distribusi, recovery outlet mendesak.`);
      else if (ca.scenario === 'productivity_issue')
        bullets.push(`CA tumbuh ${ca.caGrowth.toFixed(1)}% namun sales tertekan — fokus pada kualitas eksekusi dan produktivitas outlet.`);
      else
        bullets.push(`Sales dan CA tumbuh bersamaan (CA +${ca.caGrowth.toFixed(1)}%) — indikasi ekspansi distribusi yang sehat.`);
    }
    if (ca.worst && ca.worst.caGrowth < 0)
      bullets.push(`${ca.worst.region} menjadi area dengan penurunan CA terdalam (${ca.worst.caGrowth.toFixed(1)}%).`);
    const worstCh = (pr.byChannel || []).filter(c => c.gap < 0).sort((a, b) => a.gap - b.gap)[0];
    if (worstCh) {
      const caStr = (worstCh.caGrowth !== null && worstCh.caGrowth !== undefined)
        ? ` dengan CA ${worstCh.caGrowth < 0 ? 'loss' : 'recovery'} ${worstCh.caGrowth.toFixed(1)}%` : '';
      bullets.push(`${worstCh.channel} menjadi channel dengan kontribusi gap terbesar (${Utils.fmtCompact(worstCh.gap)})${caStr}.`);
    }
    if (!bullets.length) return '';
    return `<div class="dd-keydriver">
        <div class="dd-sec-label" style="color:var(--exec-navy)">🔑 Key Driver Summary</div>
        <ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>`;
  },

  // Assemble the compact two-column Deep Dive layout from prepared parts.
  renderDeepDiveCompactLayout: (p) => {
    const issueStrip = p.issueBlock ? `
      <div style="margin-top:10px">
        <div class="dd-sec-label" style="color:var(--red-main)">${p.issueBlock.label}</div>
        <span class="prin-com-text ${p.issueBlock.tone ?? ''}">${p.issueBlock.sentence}</span>
      </div>` : '';
    const issueDetail = (p.regInner || p.subCatIssueHtml) ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-color)">
        <div class="dd-sec-label">Issue Detail — Breakdown Regional &amp; Sub Kategori</div>
        ${p.regInner}
        ${p.subCatIssueHtml}
      </div>` : '';
    const skuChan = (p.skuIssueHtml || p.channelIssueHtml) ? `
      <div class="dd-row" style="padding-top:8px;border-top:1px solid var(--border-color)">
        <div class="dd-cell">${p.skuIssueHtml || ''}</div>
        <div class="dd-cell">${p.channelIssueHtml || ''}</div>
      </div>` : '';
    return `
      <div class="prin-commentary-panel">
        <div class="prin-com-chips">${p.chips}</div>
        <div class="dd-row">${p.perfCell}${p.trendCell}</div>
        ${issueStrip}
        <div class="dd-row">${p.recCell}${p.actionPlanCell}</div>
        <div class="dd-row">${p.caCell}${p.caRegionCell}</div>
        ${issueDetail}
        ${skuChan}
        ${p.keyDriver}
      </div>`;
  },

  panelHtml: (pr, blocks, timeGone, byCategory) => {
    const td = TimeEngine.get();
    // KPI chips
    const achCls  = pr.tgStatus.status === 'GOOD' ? 'bg-green' : pr.tgStatus.status === 'WARNING' ? 'bg-amber' : 'bg-red';
    const lmCls   = pr.trend.hasLM ? (pr.trend.vsLM >= 0 ? 'bg-green' : 'bg-red') : '';
    const lyCls   = pr.trend.hasLY ? (pr.trend.vsLY >= 0 ? 'bg-green' : 'bg-red') : '';
    const gapCls  = pr.gap >= 0 ? 'bg-green' : 'bg-red';
    const rrVal   = td.hkRem > 0 && pr.gap < 0 ? Utils.fmtCompact(Math.abs(pr.gap) / td.hkRem) : null;

    const chips = [
      `<span class="prin-com-chip ${achCls}">Ach: ${Utils.fmtPct(pr.ach)}</span>`,
      pr.trend.hasLM ? `<span class="prin-com-chip ${lmCls}">vs LM: ${pr.trend.vsLM >= 0 ? '+' : ''}${pr.trend.vsLM.toFixed(1)}%</span>` : null,
      pr.trend.hasLY ? `<span class="prin-com-chip ${lyCls}">vs LY: ${pr.trend.vsLY >= 0 ? '+' : ''}${pr.trend.vsLY.toFixed(1)}%</span>` : null,
      `<span class="prin-com-chip bg-blue">Pace: ${Utils.fmtPct(timeGone)}</span>`,
      `<span class="prin-com-chip ${gapCls}">Gap: ${Utils.fmtCompact(pr.gap)}</span>`,
      rrVal ? `<span class="prin-com-chip bg-amber">RR need: ${rrVal}/HK</span>` : null,
    ].filter(Boolean).join('');

    // Commentary grid (4 blocks, 2-column)
    const grid = blocks.map(b => `
      <div class="prin-com-block">
        <span class="prin-com-label">${b.label}</span>
        <span class="prin-com-text ${b.tone ?? ''}">${b.sentence}</span>
      </div>`).join('');

    // Action Plan (Enhancement #2): 2–3 execution items, placed after Recommendation
    const actionItems = PrincipleCommentaryEngine.generateActionPlan(pr, blocks, timeGone);
    const actionPlanHtml = (actionItems && actionItems.length) ? `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-color)">
        <div class="prin-com-label" style="margin-bottom:4px;color:var(--blue-main)">Action Plan</div>
        <ul style="margin:0;padding-left:18px;font-size:11px;line-height:1.6;color:var(--gray-700)">
          ${actionItems.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>` : '';

    // Breakdown Regional (Enhancement #3): nested inside ISSUE DETAIL, above Sub Kategori
    const regInner = (pr.byReg && pr.byReg.length > 1) ? `
      <div style="margin-bottom:8px">
        <div class="prin-com-label" style="margin-bottom:4px">Breakdown Regional</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${pr.byReg.map(r => {
            const cls = r.ach >= 90 ? 'bg-green' : r.ach >= TimeEngine.pace() ? 'bg-amber' : 'bg-red';
            return `<span class="prin-com-chip ${cls}">${r.region}: ${Utils.fmtPct(r.ach)}</span>`;
          }).join('')}
        </div>
      </div>` : '';

    // ── Sub Category, SKU & Channel Issue sections ──
    const subCatIssueHtml = PrincipleCommentaryEngine.generateSubCategoryIssue(
      byCategory, pr.principle, timeGone
    );
    const skuIssueHtml = PrincipleCommentaryEngine.generateSKUIssue(
      byCategory, pr.principle, TimeEngine.get()
    );
    const channelIssueHtml = PrincipleCommentaryEngine.generateChannelIssueAnalysis(
      pr, timeGone
    );

    // ── Build labeled cells for the compact 2-column Deep Dive layout ──
    const findBlk = (label) => blocks.find(b => b.label === label) || null;
    const blkCell = (b) => b
      ? `<div class="dd-cell"><div class="dd-sec-label">${b.label}</div><span class="prin-com-text ${b.tone ?? ''}">${b.sentence}</span></div>`
      : `<div class="dd-cell"></div>`;

    const perfCell  = blkCell(findBlk('Performance'));
    const trendCell = blkCell(findBlk('Trend'));
    const recCell   = blkCell(findBlk('Rekomendasi'));
    const actionPlanCell = `<div class="dd-cell">
        <div class="dd-sec-label" style="color:var(--blue-main)">Action Plan</div>
        ${(actionItems && actionItems.length)
          ? `<ul style="margin:0;padding-left:16px;font-size:11px;line-height:1.55;color:var(--gray-700)">${actionItems.map(a => `<li>${a}</li>`).join('')}</ul>`
          : '<span class="prin-com-text" style="font-size:10px;color:var(--gray-500)">—</span>'}
      </div>`;

    const ca = PrincipleCommentaryEngine.generateCAAnalysis(pr);

    return PrincipleCommentaryEngine.renderDeepDiveCompactLayout({
      chips,
      perfCell, trendCell,
      issueBlock: findBlk('Issue'),
      recCell, actionPlanCell,
      caCell:       PrincipleCommentaryEngine.renderCAAnalysis(ca),
      caRegionCell: PrincipleCommentaryEngine.renderCAGrowthByRegion(ca),
      regInner, subCatIssueHtml,
      skuIssueHtml, channelIssueHtml,
      keyDriver:    PrincipleCommentaryEngine.renderCAIssueInsight(pr, ca)
    });
  }
};

// ==========================================
// 3. EXEC SUMMARY ENGINE — Structured Morning Briefing
// ==========================================
/**
 * ExecSummaryEngine
 * Generates a structured 5-slot executive summary — one sentence per slot,
 * auto-updating on filter change. Pure rule-based, no external API.
 *
 * Design contract per slot sentence:
 *   - Max 25 words, Indonesian
 *   - Management/business tone (not data-analyst tone)
 *   - Action-oriented where the slot demands it
 *   - Severity-aware: label color + body tone follow the situation
 *
 * Fixed 5 slots (always present, never omitted):
 *   1. PERFORMANCE   — overall achievement vs pace; sets the mood
 *   2. BIGGEST ISSUE — highest-severity problem from AlertEngine
 *   3. BIGGEST GROWTH— most positive signal across all principles/programs
 *   4. CHANNEL WATCH — CA channel with most concerning trend
 *   5. ACTION TODAY  — one concrete instruction the field team must execute
 *
 * Severity levels per slot: 'critical' | 'warning' | 'good' | 'neutral'
 *
 * Public API:
 *   ExecSummaryEngine.build(k)      → Slot[5] array
 *   ExecSummaryEngine.render(slots, k) → HTML string for exec-summary-list
 */
const ExecSummaryEngine = {

  // ── Slot 1: PERFORMANCE ─────────────────────────────────────────────
  _slotPerformance: (k) => {
    const p    = k.perf;
    const td   = TimeEngine.get();
    const gap  = p.ach - td.timeGone;
    const hkR  = td.hkRem;
    const rrMult = p.actRR > 0 ? (p.reqRR / p.actRR) : null;

    let sentence, severity;

    if (gap >= 10) {
      sentence = `Capaian ${Utils.fmtPct(p.ach)} melampaui pace ${Utils.fmtPct(td.timeGone)} — tim berada dalam posisi kuat menuju target akhir periode.`;
      severity = 'good';
    } else if (gap >= 2) {
      sentence = `Capaian ${Utils.fmtPct(p.ach)} sedikit di atas pace ${Utils.fmtPct(td.timeGone)} — pertahankan momentum dan jangan turun di sisa ${hkR} HK.`;
      severity = 'good';
    } else if (gap >= -5) {
      sentence = `Capaian ${Utils.fmtPct(p.ach)} hampir sesuai pace — risiko miss target meningkat jika tidak ada akselerasi minggu ini.`;
      severity = 'warning';
    } else if (gap >= -15) {
      sentence = `Capaian ${Utils.fmtPct(p.ach)} tertinggal ${Math.abs(gap).toFixed(1)}pp dari pace — dibutuhkan run rate ${Utils.fmtCompact(p.reqRR)}/HK di sisa ${hkR} hari kerja.`;
      severity = 'warning';
    } else {
      sentence = `Capaian ${Utils.fmtPct(p.ach)} jauh di bawah pace — gap ${Utils.fmtCompact(Math.abs(p.gap))} harus ditutup dalam ${hkR} HK, eskalasi strategi diperlukan.`;
      severity = 'critical';
    }

    return { slot: 'PERFORMANCE', icon: '📊', label: 'Overall\nPerformance', sentence, severity };
  },

  // ── Slot 2: BIGGEST ISSUE ────────────────────────────────────────────
  _slotBiggestIssue: (k) => {
    const top = k.alerts?.topIssue;

    if (!top) {
      return {
        slot: 'ISSUE', icon: '✅', label: 'Biggest\nIssue',
        sentence: 'Tidak ada issue kritis terdeteksi — semua domain dalam kondisi operasional normal.',
        severity: 'good'
      };
    }

    // Translate AlertEngine headline into management tone
    const domain = top.domain;
    const score  = top.severityScore;
    let sentence;

    if (domain === 'WHOLESALER' && top.type === 'zero-trx') {
      const d = top.data;
      const pct = d.total > 0 ? ((d.zro / d.total) * 100).toFixed(0) : '?';
      sentence = `${pct}% WS belum transaksi di program ${top.id.includes('bima') ? 'Bima' : 'Arjuna'} — ini issue eksekusi lapangan yang harus diselesaikan hari ini.`;
    } else if (domain === 'PERFORMANCE' && top.type === 'principle-pace') {
      const pr = top.data?.principle ?? 'Principle';
      sentence = `${pr} tertinggal signifikan dari pace — dampaknya langsung mempengaruhi pencapaian target bulan ini.`;
    } else if (domain === 'CA' && top.type === 'zero-trx') {
      const d = top.data;
      sentence = `${d.zero} CA yang aktif bulan lalu kini zero transaksi — risiko churn dan penurunan coverage coverage nyata.`;
    } else if (top.type === 'runrate') {
      sentence = `Tekanan run rate sangat tinggi — dibutuhkan akselerasi ${Utils.fmtCompact(top.data.reqRR)}/HK vs realisasi ${Utils.fmtCompact(top.data.actRR)}/HK saat ini.`;
    } else {
      // Generic: use headline but trim to management tone
      sentence = top.headline.length <= 100 ? top.headline : top.headline.substring(0, 97) + '…';
    }

    const severity = score >= 70 ? 'critical' : score >= 40 ? 'warning' : 'neutral';
    return { slot: 'ISSUE', icon: '⚠️', label: 'Biggest\nIssue', sentence, severity };
  },

  // ── Slot 3: BIGGEST GROWTH ───────────────────────────────────────────
  _slotBiggestGrowth: (k) => {
    const p = k.perf;

    // Find best-performing principle by trend OR ach vs pace
    const candidates = [...p.byPrin]
      .filter(pr => pr.act > 0)
      .map(pr => ({
        name:   pr.principle,
        ach:    pr.ach,
        vsLM:   pr.trend?.vsLM ?? null,
        share:  p.totAct > 0 ? (pr.act / p.totAct) * 100 : 0,
        tgGap:  pr.tgStatus?.gap ?? 0
      }))
      .sort((a, b) => {
        // Score: combine trend + ach vs pace
        const scoreA = (a.vsLM ?? 0) * 0.6 + a.tgGap * 0.4;
        const scoreB = (b.vsLM ?? 0) * 0.6 + b.tgGap * 0.4;
        return scoreB - scoreA;
      });

    // Also check WS overall growth and PS sell-in as candidates
    const wsGrowth = k.ws?.allTrend?.vsLM;
    const bestPrin = candidates[0];

    let sentence, severity;

    if (!bestPrin && (wsGrowth === null || wsGrowth === undefined)) {
      return {
        slot: 'GROWTH', icon: '📈', label: 'Biggest\nGrowth',
        sentence: 'Data pertumbuhan tidak tersedia — pastikan data LMHK terisi di file upload.',
        severity: 'neutral'
      };
    }

    // Prefer principle growth if strong; else fall back to WS or overall
    if (bestPrin && bestPrin.vsLM !== null && bestPrin.vsLM >= 5) {
      const shareFmt = bestPrin.share >= 10 ? ` (${bestPrin.share.toFixed(0)}% dari total aktual)` : '';
      sentence = `${bestPrin.name} tumbuh +${bestPrin.vsLM.toFixed(1)}% vs LM${shareFmt} — menjadi motor pertumbuhan terkuat periode ini.`;
      severity = bestPrin.vsLM >= 15 ? 'good' : 'good';
    } else if (bestPrin && bestPrin.tgGap >= 5) {
      sentence = `${bestPrin.name} melampaui pace ${bestPrin.tgGap.toFixed(1)}pp — capaian terbaik di antara semua principle aktif saat ini.`;
      severity = 'good';
    } else if (wsGrowth !== null && wsGrowth !== undefined && wsGrowth >= 5) {
      sentence = `Channel Wholesaler tumbuh +${wsGrowth.toFixed(1)}% vs bulan lalu — sinyal positif dari penetrasi program ITG.`;
      severity = 'good';
    } else if (bestPrin) {
      sentence = `${bestPrin.name} menunjukkan performa relatif terbaik dengan Ach ${Utils.fmtPct(bestPrin.ach)} — tetap perlu dijaga hingga akhir periode.`;
      severity = 'neutral';
    } else {
      sentence = 'Pertumbuhan merata di semua lini — tidak ada principle yang menonjol signifikan vs bulan lalu.';
      severity = 'neutral';
    }

    return { slot: 'GROWTH', icon: '📈', label: 'Biggest\nGrowth', sentence, severity };
  },

  // ── Slot 4: CHANNEL WATCH ────────────────────────────────────────────
  _slotChannelWatch: (k) => {
    const ca = k.ca;

    // Primary: worst CA channel delta
    const worstCh = ca.byCh?.[0];    // sorted delta asc
    const bestCh  = ca.byCh ? [...ca.byCh].sort((a, b) => b.delta - a.delta)[0] : null;

    let sentence, severity;

    if (!worstCh) {
      return {
        slot: 'CHANNEL', icon: '📣', label: 'Channel\nWatch',
        sentence: 'Data channel tidak tersedia — pastikan kolom Channel terisi di CA_Master.',
        severity: 'neutral'
      };
    }

    if (worstCh.delta <= -20) {
      const gapFmt = Utils.fmtCompact(Math.abs(worstCh.gap));
      sentence = `Channel ${worstCh.name} kehilangan ${Math.abs(worstCh.delta).toFixed(0)}% CA vs LM (${gapFmt} outlet) — membutuhkan program retensi darurat segera.`;
      severity = 'critical';
    } else if (worstCh.delta <= -10) {
      sentence = `${worstCh.name} turun ${Math.abs(worstCh.delta).toFixed(0)}% CA vs LM — investigasi penyebab churn dan aktifkan program retensi di channel ini.`;
      severity = 'warning';
    } else if (worstCh.delta < 0) {
      const note = bestCh && bestCh.delta > 5
        ? ` Sementara ${bestCh.name} tumbuh +${bestCh.delta.toFixed(0)}%.`
        : '';
      sentence = `Channel ${worstCh.name} turun tipis ${Math.abs(worstCh.delta).toFixed(0)}% — pantau tren ini agar tidak berlanjut ke bulan depan.${note}`;
      severity = 'warning';
    } else {
      // All channels growing
      if (bestCh && bestCh.delta >= 10) {
        sentence = `Channel ${bestCh.name} tumbuh +${bestCh.delta.toFixed(0)}% CA vs LM — ekspansi coverage berjalan positif, pertahankan momentum ini.`;
        severity = 'good';
      } else {
        sentence = 'Semua channel menunjukkan CA stabil atau tumbuh vs bulan lalu — tidak ada warning coverage saat ini.';
        severity = 'good';
      }
    }

    return { slot: 'CHANNEL', icon: '📣', label: 'Channel\nWatch', sentence, severity };
  },

  // ── Slot 5: ACTION TODAY ─────────────────────────────────────────────
  _slotActionToday: (k) => {
    const td      = TimeEngine.get();
    const p       = k.perf;
    const alerts  = k.alerts;
    const top     = alerts?.topIssue;

    // Action sentence hierarchy:
    // 1. If critical issue exists — address it directly
    // 2. If behind pace — run rate focus
    // 3. If CA zero — retention focus
    // 4. If WS zero — penetration focus
    // 5. Healthy — sustain focus

    let sentence, severity;
    const overallGap = p.ach - td.timeGone;

    const hasCritical = alerts?.issues?.some(i => i.badgeLabel?.includes('CRITICAL'));
    const hasCAZero   = k.ca.zero > 0;
    const hasBimaZero = k.ws.bim.zro > 0;

    if (hasCritical && top) {
      // Direct action from top issue
      sentence = top.action.length <= 120
        ? top.action
        : `Prioritas hari ini: atasi ${top.domain} issue — ${top.action.substring(0, 80)}…`;
      severity = 'critical';
    } else if (overallGap < -10) {
      const worstPrin = p.byPrin.find(pr => pr.tgStatus.status === 'DANGER');
      const fokus = worstPrin ? ` dengan fokus utama di ${worstPrin.principle}` : '';
      sentence = `Dorong run rate ke ${Utils.fmtCompact(p.reqRR)}/HK${fokus} — sisa ${td.hkRem} HK tidak memberi ruang untuk hari tanpa progress.`;
      severity = 'critical';
    } else if (hasCAZero && k.ca.zero >= 5) {
      const worstReg = k.ca.byReg?.[0];
      const regStr = worstReg ? ` dimulai dari region ${worstReg.name}` : '';
      sentence = `Follow up ${k.ca.zero} CA zero transaksi${regStr} — retensi lebih murah dari akuisisi CA baru.`;
      severity = 'warning';
    } else if (hasBimaZero) {
      sentence = `Eksekusi penetrasi ${k.ws.bim.zro} WS Bima yang belum transaksi — setiap hari delay mempersulit akselerasi akhir bulan.`;
      severity = 'warning';
    } else if (overallGap >= 5) {
      const bestReg = p.byReg[p.byReg.length - 1];
      sentence = `Pertahankan momentum — replikasi praktek baik ${bestReg?.region ?? 'region terbaik'} ke region lain agar capaian terjaga hingga akhir periode.`;
      severity = 'good';
    } else {
      sentence = `Jaga run rate harian, monitor CA aktif, dan pastikan program ITG berjalan sesuai rencana di semua depo.`;
      severity = 'neutral';
    }

    return { slot: 'ACTION', icon: '⚡', label: 'Action\nToday', sentence, severity };
  },

  /**
   * build(k) — assemble all 5 slots into ordered array.
   * @param {object} k  State.kpi
   * @returns {Array<{slot, icon, label, sentence, severity}>}
   */
  build: (k) => [
    ExecSummaryEngine._slotPerformance(k),
    ExecSummaryEngine._slotBiggestIssue(k),
    ExecSummaryEngine._slotBiggestGrowth(k),
    ExecSummaryEngine._slotChannelWatch(k),
    ExecSummaryEngine._slotActionToday(k),
  ],

  /**
   * render(slots, k) — builds HTML for the structured exec-summary-list container.
   * Also writes context line and filter tag (auto-updated on filter change).
   *
   * @param {Array}  slots  Result of ExecSummaryEngine.build(k)
   * @param {object} k      State.kpi (for filter context)
   * @returns {string}      HTML for exec-summary-list
   */
  render: (slots, k) => {
    // ── Update context line (filter-aware) ──
    const td   = TimeEngine.get();
    const now  = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const wdStr   = `WD ${td.hkPass}/${td.hkTot} · ${Utils.fmtPct(td.timeGone)} Elapsed`;

    const filterParts = [];
    if (State.filters.regions.size    < State.options.regions.length)    filterParts.push(`${State.filters.regions.size} Region`);
    if (State.filters.principles.size < State.options.principles.length) filterParts.push(`${State.filters.principles.size} Principle`);
    if (State.filters.channels.size   < State.options.channels.length)   filterParts.push(`${State.filters.channels.size} Channel`);
    const filterStr  = filterParts.length ? `Filter aktif: ${filterParts.join(', ')}` : 'Semua data';
    const filterTag  = filterParts.length ? `🔽 ${filterParts.join(', ')}` : 'ALL';

    const ctxEl = document.getElementById('exec-context-line');
    if (ctxEl) ctxEl.textContent = `${dateStr} · ${wdStr} · ${filterStr}`;
    const tagEl = document.getElementById('exec-filter-tag');
    if (tagEl) tagEl.textContent = filterTag;

    // ── Render 5 slots ──
    return slots.map(sl => {
      const sevClass  = `sev-${sl.severity}`;
      const toneClass = `tone-${sl.severity}`;
      const labelLines = sl.label.split('\n');
      return `
        <div class="exec-slot ${sevClass}">
          <div class="exec-slot-label">
            <span class="exec-slot-label-icon">${sl.icon}</span>
            <span>${labelLines[0]}</span>
            ${labelLines[1] ? `<span>${labelLines[1]}</span>` : ''}
          </div>
          <div class="exec-slot-body ${toneClass}">${sl.sentence}</div>
        </div>`;
    }).join('');
  }
};
