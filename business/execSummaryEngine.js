// ==========================================
// BUSINESS LAYER — execSummaryEngine.js
// ==========================================
// Source: index.html lines 5249–5529
// Extracted: Commentary Layer Extraction
//
// Exposes global: ExecSummaryEngine
// Dependencies: State, TimeEngine, Utils (all lazy)
// ==========================================

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
