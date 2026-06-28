// ==========================================
// BUSINESS LAYER — insightEngine.js
// ==========================================
// Source: index.html lines 4273–4585
// Extracted: Commentary Layer Extraction
//
// Exposes global: InsightEngine
// Dependencies: PrincipleCommentaryEngine, TimeEngine, Utils (all lazy)
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
