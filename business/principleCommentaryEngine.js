// ==========================================
// BUSINESS LAYER — principleCommentaryEngine.js
// ==========================================
// Source: index.html lines 4605–5220
// Extracted: Commentary Layer Extraction
//
// Exposes global: PrincipleCommentaryEngine
// Dependencies: TimeEngine, Utils (all lazy)
// ==========================================

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
   * generateActionPlan(pr, blocks, timeGone) ← NEW (Enhancement #2)
   * Derives 2–3 concise, execution-ready action items from the detected Issue +
   * Recommendation, using real principle data (worst region, largest-gap channel,
   * LM/LY decline, pace gap). Reuses byReg/byChannel/trend already on `pr`.
   * @returns {string[]} max 3 bullet sentences (Indonesian, sales-execution tone)
   */
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
