// ==========================================
// UI LAYER — dashboardView.js
// ==========================================
// Extracted from SCT-by-SHP.html
//   RenderEngine : lines 5078–6611
//
// Dependencies (globals resolved at runtime):
//   State, Config, Utils, DOM, Components,
//   TimeEngine, TrendEngine, ChartEngine,
//   KPIEngine, AlertEngine, AnomalyEngine,
//   ExecSummaryEngine, PrincipleCommentaryEngine
//
// Pure rendering layer — writes to DOM only.
// No KPI calculations, no business rules.
// ==========================================

const RenderEngine = {
  execAll: () => {
    const k = State.kpi;
    // Empty-state guard: show "No Data Available" banner when the active filter
    // combination yields no Performance rows. Renderers still run (degrade to 0/—).
    RenderEngine.toggleEmptyState(!State.filtered.perf.length);
    RenderEngine.renderPrincipleExecutiveSummary(k.principleExec);
    RenderEngine.header(k);
    RenderEngine.performance(k.perf);
    RenderEngine.caMonitoring(k.ca);
    RenderEngine.wholesaler(k.ws);
    RenderEngine.renderITGTimegone(k);
    RenderEngine.renderWholesalerClassPerformance(k.wsClass);
    RenderEngine.bb4ClassAnalysis(k);
    RenderEngine.psAchiever(k.ps);
    RenderEngine.priorityAction(k);
    RenderEngine.executiveSummary(k);
    RenderEngine.charts(k);
    // Anomaly detection strip — runs last (reads complete k)
    AnomalyEngine.render(k.anomalies);
  },

  header: (k) => {
    const now = new Date();
    DOM.setTxt('header-date', 'MTD REPORTING');
    DOM.setTxt('header-time', `Updated: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')} WIB`);

    // ── Use TimeEngine.fmt() — no inline formatting of WD values ──
    const tf = TimeEngine.fmt();
    let fStr = [];
    if (State.filters.regions.size   < State.options.regions.length)    fStr.push(`${State.filters.regions.size} Regions`);
    if (State.filters.principles.size < State.options.principles.length) fStr.push(`${State.filters.principles.size} Principles`);

    DOM.setTxt('header-subtitle',
      `${now.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}` +
      ` | ${tf.hkLabel} | ${tf.timeGoneLabel}` +
      (fStr.length ? ` · Filtered: [${fStr.join(', ')}]` : ' · ALL DATA')
    );

    // Critical principle count from scored alerts
    const critPrin = k.perf.byPrin.filter(p => p.tgStatus.status === 'DANGER').length;
    DOM.setTxt('badge-critical-principle', `${critPrin} Principle DANGER`);
    DOM.setTxt('badge-zero-ws', `${k.ws.allZero} WS Zero Transaction`);
    DOM.setTxt('action-date', now.toLocaleDateString('id-ID', {day:'numeric', month:'short'}));

    // ── Alert banner — driven by AlertEngine, never hardcoded ──
    DOM.setTxt('alert-message', AlertEngine.bannerSentence(k.alerts, k));
  },

  performance: (p) => {
    // ── All WD display strings sourced from TimeEngine.fmt() ──
    const tf = TimeEngine.fmt();

    DOM.setTxt('perf-target', Utils.fmtCompact(p.totTgt));
    DOM.setTxt('perf-actual', Utils.fmtCompact(p.totAct));
    DOM.setTxt('perf-hk', tf.hkLabel);
    DOM.setTxt('perf-pace-target', tf.timeGoneLabel);    DOM.setTxt('perf-gap', `▼ Gap: ${Utils.fmtCompact(p.gap)}`);
    // Trend insight replaces raw "vs LM: X%" — more readable for management
    DOM.setTxt('perf-vslm', TrendEngine.insight(p.trend));
    DOM.setClass('perf-vslm', `kpi-sub ${TrendEngine.colorClass(p.trend.vsLM)}`);

    const achEl = document.getElementById('perf-ach');
    achEl.textContent = Utils.fmtPct(p.ach);
    achEl.className   = `kpi-value ${Utils.getTextClass(p.ach)}`;

    // Section header status badge — shows Ach% + PerformanceStatus label
    // e.g. "72.3% Achieved — 🔴 DANGER"
    const sectBadge = document.getElementById('perf-status-badge');
    if (sectBadge) {
      sectBadge.textContent = `${Utils.fmtPct(p.ach)} Achieved — ${p.tgStatus.label}`;
      // Keep bg-red base class; override color for non-danger states
      const bgMap = { GOOD: 'bg-green', WARNING: 'bg-amber', DANGER: 'bg-red' };
      sectBadge.className = `badge ${bgMap[p.tgStatus.status]}`;
    }

    DOM.setTxt('perf-pace-need', tf.timeGoneLabel);
    DOM.setTxt('perf-req-runrate', `${Utils.fmtCompact(p.reqRR)}/HK`);
    DOM.setTxt('perf-hk-remain', tf.hkRemLabel);
    DOM.setTxt('perf-act-runrate', `Actual pace: ${Utils.fmtCompact(p.actRR)}/HK`);

    // Achievement progress bar — pace marker driven by TimeEngine
    DOM.setStyle('perf-prog-fill',   'width', `${Math.min(p.ach, 100)}%`);
    DOM.setClass('perf-prog-fill',   `runrate-fill ${Utils.getPillClass(p.ach)}`);
    DOM.setStyle('perf-prog-marker', 'left',  `${Math.min(p.timeGone, 100)}%`);
    DOM.setStyle('perf-prog-label',  'left',  `${Math.min(p.timeGone, 100)}%`);

    // ── Time Gone Analysis Card ──
    const tg = p.tgStatus;
    const tgCard = document.getElementById('perf-timegone-card');
    if (tgCard) {
      const borderColors = { GOOD: 'var(--green-main)', WARNING: 'var(--amber-main)', DANGER: 'var(--red-main)' };
      tgCard.style.borderTop = `3px solid ${borderColors[tg.status]}`;
    }

    const tgValEl = document.getElementById('perf-timegone-pct');
    if (tgValEl) {
      tgValEl.textContent = Utils.fmtPct(p.timeGone);
      tgValEl.className   = `kpi-value ${tg.status === 'GOOD' ? 'text-green' : tg.status === 'WARNING' ? 'text-amber' : 'text-red'}`;
      tgValEl.style.fontSize = '22px';
    }

    DOM.setTxt('perf-ach-vs-tg', Utils.fmtPct(p.ach));

    const gapEl = document.getElementById('perf-gap-tg');
    if (gapEl) {
      const gStr = `${tg.gap >= 0 ? '+' : ''}${tg.gap.toFixed(1)}%`;
      gapEl.textContent  = gStr;
      gapEl.className    = `font-mono ${tg.status === 'GOOD' ? 'text-green' : tg.status === 'WARNING' ? 'text-amber' : 'text-red'}`;
      gapEl.style.fontSize   = '11px';
      gapEl.style.fontWeight = '700';
    }

    const tgBadge = document.getElementById('perf-tg-status-badge');
    if (tgBadge) {
      // Use statBadge via innerHTML — solid fill, full label, optional source warn
      const srcTag = p.wdValid ? '' : ` · ${TimeEngine.fmt().sourceTag}`;
      tgBadge.innerHTML = Components.statBadge(tg) + (srcTag ? `<span style="font-size:9px;color:var(--gray-500);margin-left:4px">${srcTag}</span>` : '');
      tgBadge.className = ''; // badge class handled by stat-badge itself
    }

    // Region progress bars removed — chart now carries inline metrics (chart-region)
    // Depot ranking — compact TOP/BOTTOM 5 below region chart
    const depotEl = DOM.el('perf-depot-ranking');
    if (depotEl) {
      depotEl.innerHTML = Components.generateDepotRanking(p.byDepo, 5, TimeEngine.get());
    }

    // ── Principle table — expandable rows with PrincipleCommentaryEngine ──
    // Each principle row: click to toggle commentary panel (delegated event in App.bindGlobalEvents)
    const rows = p.byPrin.map((pr, idx) => {
      const statHtml   = Components.statBadge(pr.tgStatus, { showGap: true });
      const trendHtml  = TrendEngine.pill(pr.trend.vsLM);
      // Build commentary blocks for this principle
      const blocks     = PrincipleCommentaryEngine.build(pr, p.timeGone);
      const subtitle   = PrincipleCommentaryEngine.subtitle(blocks);
      const panel      = PrincipleCommentaryEngine.panelHtml(pr, blocks, p.timeGone, p.byCategory);
      const rowId      = `prin-row-${idx}`;
      const panelId    = `prin-panel-${idx}`;

      const dataRow = `
        <tr class="prin-row" id="${rowId}" data-panel="${panelId}">
          <td style="min-width:140px">
            <div style="display:flex;align-items:flex-start;gap:0">
              <span class="prin-chevron">▶</span>
              <div>
                <strong>${pr.principle}</strong>
                <span class="prin-commentary">${subtitle}</span>
              </div>
            </div>
          </td>
          <td class="font-mono text-xs">${Utils.fmtCompact(pr.tgt)}</td>
          <td class="font-mono text-xs">${Utils.fmtCompact(pr.act)}</td>
          <td class="font-mono text-xs ${pr.gap >= 0 ? 'text-green' : 'text-red'}">${Utils.fmtCompact(pr.gap)}</td>
          <td><span class="pill ${Utils.getPillClass(pr.ach)}">${Utils.fmtPct(pr.ach)}</span></td>
          <td>${statHtml}</td>
          <td>${trendHtml}</td>
          <td>${TrendEngine.pill(pr.trend.vsLY)}</td>
        </tr>`;

      const panelRow = `
        <tr class="prin-commentary-row" id="${panelId}">
          <td colspan="8" style="padding:0">${panel}</td>
        </tr>`;

      return dataRow + panelRow;
    });

    DOM.setHtml('perf-table-principle', rows.join(''));

    // Category Analysis — renders into #perf-category container
    RenderEngine.categoryAnalysis(p);
  },

  /**
   * categoryAnalysis(p) — renders Performance by Category with expandable rows.
   *
   * Table uses same .prin-row / .prin-commentary-row / .prin-chevron pattern
   * as the Principle table — the existing delegated click handler in
   * bindGlobalEvents() handles expand/collapse automatically (no new JS needed).
   *
   * Expandable panel per row contains:
   *   Performance · Trend · Issue · Recommendation · Region Breakdown · SKU Issue Analysis
   *
   * Helpers (pure functions, defined inside this method):
   *   generateCategoryAnalysis(cat, timeGone) → panel HTML (4 commentary blocks)
   *   generateSKUIssueAnalysis(skuIssues)     → SKU issue list HTML
   */
  categoryAnalysis: (p) => {
    const container = DOM.el('perf-category');
    if (!container) return;

    if (!p.byCategory || !p.byCategory.length) {
      container.innerHTML = '';
      return;
    }

    const cats     = p.byCategory;
    const timeGone = p.timeGone;

    // ── Status badge (cat-stat classes from CSS) ──
    const statHtml = (ts) => {
      const cls = ts.status === 'GOOD' ? 'cat-stat-good'
                : ts.status === 'WARNING' ? 'cat-stat-warning'
                : 'cat-stat-danger';
      return `<span class="cat-stat ${cls}">${ts.icon} ${ts.status}</span>`;
    };

    // ── generateCategoryTimeGoneAnalysis(cat, tg, td) ──
    // NEW: Time Gone gap block — amber highlight.
    // Uses existing TimeEngine values; no new calculations.
    const generateCategoryTimeGoneAnalysis = (cat, tg, td) => {
      const gapPP   = cat.ach - tg;                          // pp vs pace (negative = behind)
      const gapSign = gapPP >= 0 ? '+' : '';
      const gapCl   = gapPP >= 0 ? 'var(--green-main)' : 'var(--red-main)';

      // Value gap: how much additional actual is needed to match pace
      const achNeeded   = (tg / 100) * cat.tgt;             // actual needed at current pace
      const valueGap    = achNeeded - cat.act;               // additional value needed
      const valueGapFmt = valueGap > 0 ? `+${Utils.fmtCompact(valueGap)}` : Utils.fmtCompact(valueGap);

      // Required run-rate to close gap in remaining HK
      const rrNeeded    = td.hkRem > 0 && valueGap > 0
        ? Utils.fmtCompact(valueGap / td.hkRem) + '/HK'
        : '—';

      const statusTxt = gapPP >= 0
        ? `Ach ${Utils.fmtPct(cat.ach)} melampaui pace ${Utils.fmtPct(tg)}.`
        : `Ach ${Utils.fmtPct(cat.ach)} masih tertinggal:`;

      return `
        <div class="cat-tg-block">
          <div class="cat-tg-block-title">⏱ TIME GONE ANALYSIS</div>
          <div style="margin-bottom:6px;font-size:11px;color:var(--amber-main);font-weight:600">${statusTxt}</div>
          ${gapPP < 0 ? `<div style="font-size:16px;font-family:var(--font-mono);font-weight:800;color:var(--red-main);margin-bottom:8px">${gapSign}${gapPP.toFixed(1)}pp vs Time Gone ${Utils.fmtPct(tg)}</div>` : ''}
          <div class="cat-tg-row">
            <span class="cat-tg-label">Achievement saat ini</span>
            <span class="cat-tg-value" style="color:${gapCl}">${Utils.fmtPct(cat.ach)}</span>
          </div>
          <div class="cat-tg-row">
            <span class="cat-tg-label">Time Gone (Pace)</span>
            <span class="cat-tg-value">${Utils.fmtPct(tg)}</span>
          </div>
          <div class="cat-tg-row">
            <span class="cat-tg-label">Gap vs Pace</span>
            <span class="cat-tg-value" style="color:${gapCl}">${gapSign}${gapPP.toFixed(1)}pp</span>
          </div>
          ${valueGap > 0 ? `
          <div class="cat-tg-row">
            <span class="cat-tg-label">Nilai catch-up dibutuhkan</span>
            <span class="cat-tg-value text-red">${valueGapFmt}</span>
          </div>
          <div class="cat-tg-row">
            <span class="cat-tg-label">Required RR (${td.hkRem} HK tersisa)</span>
            <span class="cat-tg-value text-amber">${rrNeeded}</span>
          </div>` : `
          <div class="cat-tg-row">
            <span class="cat-tg-label">Sisa HK</span>
            <span class="cat-tg-value">${td.hkRem} HK</span>
          </div>`}
        </div>`;
    };

    // ── generateCategorySKUIssue(skuIssues) ──
    // Replaces old generateSKUIssueAnalysis.
    // New format per SKU card: name / Gap BP / vs LM / Weakest Regions top 3.
    const generateCategorySKUIssue = (skuIssues) => {
      if (!skuIssues || !skuIssues.length) {
        return `<div style="font-size:10px;color:var(--gray-400);font-style:italic;padding:4px 0">Data SKU tidak tersedia — pastikan kolom SKU ada di sheet Perfomance.</div>`;
      }
      return skuIssues.map(s => {
        const gapBP  = s.gap;
        const gapBPFmt = (gapBP >= 0 ? '+' : '') + Utils.fmtCompact(gapBP);
        const gapBPCl  = gapBP  >= 0 ? 'pos' : 'neg';

        const vsLMFmt  = s.vsLM !== null
          ? (s.vsLM >= 0 ? '+' : '') + s.vsLM.toFixed(1) + '% vs LM'
          : null;
        const vsLMCl   = s.vsLM !== null && s.vsLM < 0 ? 'neg' : 'pos';

        // Weakest 3 regions: already sorted by gap ascending (most negative first)
        const regLines = s.weakestRegs.length
          ? s.weakestRegs.map(r =>
              `<strong>${r.region}</strong> (${(r.gap >= 0 ? '+' : '')}${Utils.fmtCompact(r.gap)})`
            ).join(' · ')
          : null;

        return `
          <div class="cat-sku-card">
            <div class="cat-sku-name">${s.sku}</div>
            <div class="cat-sku-bullet">
              <span>↓</span>
              <span>Gap BP: <span class="${gapBPCl}">${gapBPFmt}</span></span>
            </div>
            ${vsLMFmt ? `<div class="cat-sku-bullet"><span>↓</span><span><span class="${vsLMCl}">${vsLMFmt}</span></span></div>` : ''}
            ${regLines ? `<div class="cat-sku-regions">Weakest Region: ${regLines}</div>` : ''}
          </div>`;
      }).join('');
    };

    // ── generateCategoryAnalysis(cat, timeGone) ──
    const generateCategoryAnalysis = (cat, tg) => {
      const paceGap  = cat.ach - tg;
      const td       = TimeEngine.get();
      const gapAbs   = Utils.fmtCompact(Math.abs(cat.gap));
      const rrNeed   = td.hkRem > 0 && cat.gap < 0 ? Utils.fmtCompact(Math.abs(cat.gap) / td.hkRem) : '—';

      // Block 1: Performance
      let perfTxt, perfTone;
      if (paceGap >= 5) {
        perfTxt  = `Ach ${Utils.fmtPct(cat.ach)} melampaui pace ${Utils.fmtPct(tg)} (+${paceGap.toFixed(1)}pp) — kategori ini on track.`;
        perfTone = 'tone-good';
      } else if (paceGap >= -5) {
        perfTxt  = `Ach ${Utils.fmtPct(cat.ach)} hampir sesuai pace — gap target ${gapAbs}, perlu akselerasi.`;
        perfTone = 'tone-warning';
      } else {
        perfTxt  = `Ach ${Utils.fmtPct(cat.ach)} tertinggal ${Math.abs(paceGap).toFixed(1)}pp dari pace — gap ${gapAbs} harus dikejar.`;
        perfTone = 'tone-critical';
      }

      // Block 2: Trend
      let trendTxt = '—', trendTone = '';
      if (cat.trend.hasLM) {
        const lmPct = `${cat.trend.vsLM >= 0 ? '+' : ''}${cat.trend.vsLM.toFixed(1)}%`;
        const lmGap = `${cat.trend.gapLM >= 0 ? '+' : ''}${Utils.fmtCompact(cat.trend.gapLM)}`;
        const lyPart = cat.trend.hasLY ? ` | vs LY: ${cat.trend.vsLY >= 0 ? '+' : ''}${cat.trend.vsLY.toFixed(1)}%` : '';
        if (cat.trend.vsLM <= -15) {
          trendTxt  = `Turun kritis ${lmPct} vs LM (${lmGap})${lyPart} — investigasi segera.`;
          trendTone = 'tone-critical';
        } else if (cat.trend.vsLM <= -5) {
          trendTxt  = `Turun ${lmPct} vs LM (${lmGap})${lyPart} — perlu perhatian.`;
          trendTone = 'tone-warning';
        } else if (cat.trend.vsLM >= 10) {
          trendTxt  = `Tumbuh kuat ${lmPct} vs LM (${lmGap})${lyPart} — momentum positif.`;
          trendTone = 'tone-good';
        } else {
          trendTxt  = `Flat vs LM (${lmGap})${lyPart} — tidak ada pertumbuhan signifikan.`;
        }
      }

      // Block 3: Issue (region-based)
      let issueTxt = null, issueTone = '';
      if (cat.byReg && cat.byReg.length >= 2) {
        const avgAch  = cat.byReg.reduce((s, r) => s + r.ach, 0) / cat.byReg.length;
        const worst   = cat.byReg[0];
        const rgap    = avgAch - worst.ach;
        if (rgap >= 10) {
          issueTxt  = `Region ${worst.region} (${Utils.fmtPct(worst.ach)}) tertinggal ${rgap.toFixed(1)}pp dari rata-rata — titik lemah terbesar kategori ini.`;
          issueTone = 'tone-critical';
        } else if (rgap >= 5) {
          issueTxt  = `Region ${worst.region} (${Utils.fmtPct(worst.ach)}) di bawah rata-rata — perlu pendampingan.`;
          issueTone = 'tone-warning';
        }
      }
      if (!issueTxt && cat.trend.hasLM && cat.trend.vsLM <= -10) {
        issueTxt  = `Penurunan ${Math.abs(cat.trend.vsLM).toFixed(1)}% vs LM mengindikasikan masalah distribusi atau demand SKU.`;
        issueTone = 'tone-warning';
      }

      // Block 4: Recommendation
      let recTxt;
      if (paceGap <= -10) {
        recTxt = `Butuh ${rrNeed}/HK untuk menutup gap ${gapAbs} — eskalasi program akselerasi di ${td.hkRem} HK tersisa.`;
      } else if (cat.trend.hasLM && cat.trend.vsLM <= -10) {
        recTxt = `Audit daftar outlet aktif dan pastikan SKU tersedia — recovery vs LM harus dimulai minggu ini.`;
      } else if (paceGap >= 5) {
        recTxt = `Pertahankan run rate — amankan distribusi di ${td.hkRem} HK tersisa agar target terjaga.`;
      } else {
        recTxt = `Tambah frekuensi kunjungan dan pastikan stok SKU tersedia — gap ${gapAbs} bisa dikejar dalam ${td.hkRem} HK.`;
      }

      // KPI chips
      const achCls = cat.tgStatus.status === 'GOOD' ? 'bg-green' : cat.tgStatus.status === 'WARNING' ? 'bg-amber' : 'bg-red';
      const lmCls  = cat.trend.hasLM ? (cat.trend.vsLM >= 0 ? 'bg-green' : 'bg-red') : '';
      const gapCls = cat.gap >= 0 ? 'bg-green' : 'bg-red';
      const chips  = [
        `<span class="prin-com-chip ${achCls}">Ach: ${Utils.fmtPct(cat.ach)}</span>`,
        cat.trend.hasLM ? `<span class="prin-com-chip ${lmCls}">vs LM: ${cat.trend.vsLM >= 0 ? '+' : ''}${cat.trend.vsLM.toFixed(1)}%</span>` : '',
        cat.trend.hasLY ? `<span class="prin-com-chip ${cat.trend.vsLY >= 0 ? 'bg-green' : 'bg-red'}">vs LY: ${cat.trend.vsLY >= 0 ? '+' : ''}${cat.trend.vsLY.toFixed(1)}%</span>` : '',
        `<span class="prin-com-chip bg-blue">Pace: ${Utils.fmtPct(tg)}</span>`,
        `<span class="prin-com-chip ${gapCls}">Gap: ${Utils.fmtCompact(cat.gap)}</span>`,
        `<span class="prin-com-chip bg-amber">Contrib: ${cat.contrib.toFixed(0)}%</span>`,
      ].filter(Boolean).join('');

      // Region chips
      const regChips = cat.byReg.length ? `
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border-color)">
          <div class="prin-com-label" style="margin-bottom:4px">Breakdown Regional</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${cat.byReg.map(r => {
              const cls = r.ach >= 90 ? 'bg-green' : r.ach >= TimeEngine.pace() ? 'bg-amber' : 'bg-red';
              return `<span class="prin-com-chip ${cls}">${r.region}: ${Utils.fmtPct(r.ach)}</span>`;
            }).join('')}
          </div>
        </div>` : '';

      // SKU issue section — new cat-sku-block style
      const skuSection = `
        <div class="cat-sku-block">
          <div class="cat-sku-block-title">⚠ SKU ISSUE ANALYSIS — Top Negative Contributors</div>
          ${generateCategorySKUIssue(cat.skuIssues)}
        </div>`;

      // Time Gone analysis block — amber, uses generateCategoryTimeGoneAnalysis
      const tgSection = generateCategoryTimeGoneAnalysis(cat, tg, td);

      // Commentary blocks (4)
      const blocks = [
        { label: 'Performance',  text: perfTxt,  tone: perfTone  },
        { label: 'Trend',        text: trendTxt, tone: trendTone },
        ...(issueTxt ? [{ label: 'Issue', text: issueTxt, tone: issueTone }] : []),
        { label: 'Rekomendasi',  text: recTxt,   tone: ''        }
      ];
      const gridBlocks = blocks.map(b =>
        `<div class="prin-com-block">
          <span class="prin-com-label">${b.label}</span>
          <span class="prin-com-text ${b.tone}">${b.text}</span>
        </div>`
      ).join('');

      return `
        <div class="prin-commentary-panel">
          <div class="prin-com-chips">${chips}</div>
          <div class="prin-commentary-grid">${gridBlocks}</div>
          ${tgSection}
          ${regChips}
          ${skuSection}
        </div>`;
    };

    // ── TABLE ROWS — expandable using existing prin-row accordion pattern ──
    const tableRows = cats.map((c, idx) => {
      const rowId   = `cat-row-${idx}`;
      const panelId = `cat-panel-${idx}`;

      // Subtitle: 1 sentence from performance commentary
      const paceGap = c.ach - timeGone;
      const subtitle = paceGap >= 0
        ? `On track vs pace — Ach ${Utils.fmtPct(c.ach)}`
        : `Tertinggal ${Math.abs(paceGap).toFixed(1)}pp dari pace`;

      const vsLMHtml = c.trend.hasLM
        ? `<span style="font-weight:700;color:${c.trend.vsLM >= 0 ? 'var(--green-main)' : 'var(--red-main)'}">
            ${c.trend.vsLM >= 0 ? '+' : ''}${c.trend.vsLM.toFixed(1)}%</span>`
        : `<span style="color:var(--gray-300)">—</span>`;

      const contribHtml = `
        <div class="cat-contrib-wrap">
          <span style="font-size:10px;font-weight:700;font-family:var(--font-mono);min-width:32px">${c.contrib.toFixed(0)}%</span>
          <div class="cat-contrib-track"><div class="cat-contrib-fill" style="width:${Math.min(c.contrib,100)}%"></div></div>
        </div>`;

      const panel = generateCategoryAnalysis(c, timeGone);

      const dataRow = `
        <tr class="prin-row" id="${rowId}" data-panel="${panelId}">
          <td style="min-width:160px;max-width:220px">
            <div style="display:flex;align-items:flex-start;gap:0">
              <span class="prin-chevron">▶</span>
              <div style="min-width:0">
                <div style="font-weight:600;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.category}">${c.category}</div>
                <span class="prin-commentary">${subtitle}</span>
              </div>
            </div>
          </td>
          <td class="font-mono" style="font-size:10px">${Utils.fmtCompact(c.tgt)}</td>
          <td class="font-mono" style="font-size:10px">${Utils.fmtCompact(c.act)}</td>
          <td class="font-mono" style="font-size:10px;color:${c.gap >= 0 ? 'var(--green-main)' : 'var(--red-main)'}">${Utils.fmtCompact(c.gap)}</td>
          <td><span class="pill ${Utils.getPillClass(c.ach)}">${Utils.fmtPct(c.ach)}</span></td>
          <td>${vsLMHtml}</td>
          <td style="min-width:80px">${contribHtml}</td>
          <td>${statHtml(c.tgStatus)}</td>
        </tr>`;

      const panelRow = `
        <tr class="prin-commentary-row" id="${panelId}">
          <td colspan="8" style="padding:0">${panel}</td>
        </tr>`;

      return dataRow + panelRow;
    });

    // ── MINI INSIGHTS (max 3) ──
    const best     = cats[0];
    const topAch   = [...cats].sort((a, b) => b.ach - a.ach)[0];
    const worst    = [...cats].sort((a, b) => a.ach - b.ach)[0];
    const declining = cats.filter(c => c.trend.hasLM && c.trend.vsLM < -5)
                         .sort((a, b) => a.trend.vsLM - b.trend.vsLM)[0];
    const insightItems = [];
    if (best) insightItems.push(`🏆 <strong>${best.category}</strong> kontributor terbesar — ${best.contrib.toFixed(0)}% share aktual, Ach ${Utils.fmtPct(best.ach)}.`);
    if (worst && worst.tgStatus.status === 'DANGER') {
      insightItems.push(`🔴 <strong>${worst.category}</strong> tertinggal — Ach ${Utils.fmtPct(worst.ach)} vs Pace ${Utils.fmtPct(timeGone)}.`);
    } else if (topAch && topAch.tgStatus.status === 'GOOD' && topAch !== best) {
      insightItems.push(`✅ <strong>${topAch.category}</strong> melampaui pace — on track.`);
    }
    if (declining) insightItems.push(`📉 <strong>${declining.category}</strong> turun ${Math.abs(declining.trend.vsLM).toFixed(1)}% vs LM — perlu diwaspadai.`);

    const insightHtml = insightItems.length ? `
      <div class="cat-insight-strip" style="margin-top:8px">
        ${insightItems.slice(0, 3).map(t =>
          `<div class="cat-insight-row"><span class="cat-insight-icon"></span><span>${t}</span></div>`
        ).join('')}
      </div>` : '';

    // ── RENDER FULL CONTAINER ──
    container.innerHTML = `
      <div class="sub-section">
        <div class="sub-section-title">📊 PERFORMANCE BY CATEGORY ANALYSIS
          <span style="font-size:9px;color:var(--gray-400);font-weight:400;margin-left:8px">Source: Perfomance Sheet | SubCategory [MainCategory - Principle] | Klik baris untuk detail</span>
        </div>
        <div class="grid-2" style="align-items:start">
          <div class="kpi-card" style="padding:10px;height:660px;display:flex;flex-direction:column;overflow:hidden">
            <div class="kpi-label" style="margin-bottom:6px;flex-shrink:0">📋 Category Performance — Sorted by Actual</div>
            <div class="cat-scroll-wrap">
              <table class="cat-tbl">
                <thead><tr>
                  <th style="min-width:170px">Category</th>
                  <th>Target</th><th>Actual</th><th>Gap</th>
                  <th>Ach%</th><th>vs LM</th><th>Contrib%</th><th>Status</th>
                </tr></thead>
                <tbody>${tableRows.join('')}</tbody>
              </table>
            </div>
          </div>
          <div class="kpi-card" style="padding:10px;height:660px;display:flex;flex-direction:column;overflow:hidden">
            <div class="kpi-label" style="margin-bottom:6px;flex-shrink:0">📈 Achievement % per Category — Sorted by Actual</div>
            <div class="cat-chart-scroll-wrap">
              <div style="height:${Math.max(200, cats.length * 34)}px;position:relative">
                <canvas id="chart-category"></canvas>
              </div>
            </div>
          </div>
        </div>
        ${insightHtml}
      </div>`;

    // ── CHART HELPERS ────────────────────────────────────────────────────────

    /**
     * buildCategoryChartLabel(c) — single-line y-axis label, truncated.
     * Returns string array so Chart.js can handle it consistently.
     */
    const buildCategoryChartLabel = (c) => {
      const full = c.category;
      return full.length > 26 ? full.substring(0, 26) + '…' : full;
    };

    /**
     * buildInlineCategoryMetrics(c, td) — compact single-line annotation.
     * Format: "Ach XX% | Act XXB | Gap ±XXB | vs LM ±X% | CatchUp/Need X/HK"
     * Drawn as ONE text line right of the bar — no vertical stacking.
     *
     * Color: derived from Ach% threshold for the full string.
     * Individual metric colors are not applied (single fillStyle per call
     * keeps canvas rendering fast for many rows).
     */
    const buildInlineCategoryMetrics = (c, td) => {
      const achStr  = `Ach ${c.ach.toFixed(1)}%`;
      const actStr  = `Act ${Utils.fmtCompact(c.act)}`;
      const gapStr  = `Gap ${c.gap >= 0 ? '+' : ''}${Utils.fmtCompact(c.gap)}`;
      const lmStr   = c.trend.hasLM
        ? ` | vs LM ${c.trend.vsLM >= 0 ? '+' : ''}${c.trend.vsLM.toFixed(1)}%`
        : '';
      const catchStr = c.gap < 0 && td.hkRem > 0
        ? ` | Need ${Utils.fmtCompact(Math.abs(c.gap) / td.hkRem)}/HK`
        : ' | CatchUp 0';

      const text = `${achStr} | ${actStr} | ${gapStr}${lmStr}${catchStr}`;

      // Single color for the whole label — driven by Ach% status
      const color = c.ach >= 100 ? Config.COLORS.green
                  : c.ach >= 80  ? '#B7770D'   // dark amber — readable on white bg
                  : Config.COLORS.red;
      return { text, color };
    };

    const td = TimeEngine.get();

    // ── CHART ────────────────────────────────────────────────────────────────
    // Row height = 34px (14px bar + 20px spacing) — compact, no vertical stacking.
    // Annotation: single inline text line drawn at bar.x + 5, bar.y.
    // layout.padding.right = 180 gives room for the inline metrics string.
    const colors = cats.map(c =>
      c.ach >= 100 ? Config.COLORS.green :
      c.ach >= 80  ? Config.COLORS.amber :
                     Config.COLORS.red
    );

    ChartEngine.create('chart-category', 'bar', {
      labels:   cats.map(c => buildCategoryChartLabel(c)),
      datasets: [{
        label: 'Ach%',
        data:  cats.map(c => +c.ach.toFixed(1)),
        backgroundColor: colors,
        borderRadius: 3,
        barThickness: 12
      }]
    }, {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 5, top: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const c = cats[ctx.dataIndex];
              const lines = [`Ach: ${c.ach.toFixed(1)}%`, `Actual: ${Utils.fmtCompact(c.act)}`, `Gap: ${(c.gap >= 0 ? '+' : '')}${Utils.fmtCompact(c.gap)}`];
              if (c.trend.hasLM) lines.push(`vs LM: ${(c.trend.vsLM >= 0 ? '+' : '')}${c.trend.vsLM.toFixed(1)}%`);
              return lines;
            }
          }
        }
      },
      scales: {
        x: {
          min: 0,
          max: Math.max(...cats.map(c => c.ach), 100) + 5,
          ticks: { callback: v => v + '%', font: { size: 9 } },
          grid: { color: '#F2F2F7' }
        },
        y: {
          ticks: {
            font:       { size: 9, weight: '600' },
            color:      '#545456',
            autoSkip:   false,
            crossAlign: 'far'
          },
          grid: { display: false }
        }
      },
      animation: {
        onComplete: function() {
          const chart = this;
          const ctx2  = chart.ctx;
          const chartW = chart.chartArea?.right ?? chart.width;
          ctx2.save();
          ctx2.textAlign    = 'left';
          ctx2.textBaseline = 'middle';
          ctx2.font         = '600 8.5px "IBM Plex Mono"';

          chart.getDatasetMeta(0).data.forEach((bar, idx) => {
            const { text, color } = buildInlineCategoryMetrics(cats[idx], td);
            // Draw inline to the right of the bar, vertically centred
            ctx2.fillStyle = color;
            ctx2.fillText(text, bar.x + 5, bar.y);
          });

          ctx2.restore();
        }
      }
    });
  },

  caMonitoring: (c) => {
    DOM.setTxt('ca-total', Utils.fmtCompact(c.tot));
    DOM.setTxt('ca-lm', `CA LM: ${Utils.fmtCompact(c.lm)}`);
    DOM.setTxt('ca-delta', `▼ ${c.delta.toFixed(1)}% vs LM`);
    DOM.setTxt('ca-zero', c.zero.toLocaleString('id'));
    DOM.setTxt('ca-zero-pct', `${(c.zero/c.lm*100).toFixed(1)}% dari LM`);

    const botCh = c.byCh[0];
    DOM.setTxt('ca-drop-ch-name', botCh?.name || '—');
    DOM.setTxt('ca-drop-ch-val', `TM: ${Utils.fmtCompact(botCh?.ca)} | LM: ${Utils.fmtCompact(botCh?.lm)}`);
    DOM.setTxt('ca-drop-ch-pct', `▼ ${(botCh?.delta||0).toFixed(1)}% vs LM`);

    const topCh = [...c.byCh].sort((a,b)=>b.ca-a.ca)[0];
    DOM.setTxt('ca-top-ch-name', topCh?.name || '—');
    DOM.setTxt('ca-top-ch-val', `TM: ${Utils.fmtCompact(topCh?.ca)}`);
    DOM.setTxt('ca-top-ch-pct', `${(topCh?.delta||0).toFixed(1)}% vs LM`);

    DOM.setHtml('ca-channel-tl', c.byCh.map(ch => {
      // Format: CHANNEL NAME (CA TM) | Growth% vs LM | Gap CA vs LM
      const caActual = ch.ca.toLocaleString('id-ID');
      const growthStr = `${ch.delta >= 0 ? '+' : ''}${ch.delta.toFixed(1)}%`;
      const gapStr = `${ch.gap >= 0 ? '+' : ''}${ch.gap.toLocaleString('id-ID')}`;
      const colorClass = ch.delta < -20 ? 'text-red' : ch.delta < 0 ? 'text-amber' : 'text-green';
      const dotColor = ch.delta < -20 ? Config.COLORS.red : ch.delta < 0 ? Config.COLORS.amber : Config.COLORS.green;

      return `
        <div class="tl-row">
          <div class="tl-dot" style="background-color:${dotColor}"></div>
          <div class="tl-name" title="${ch.name}">${ch.name} <span style="color:var(--gray-500);font-weight:400">(${caActual})</span></div>
          <div style="display:flex;align-items:center;gap:16px;flex-shrink:0">
            <span class="font-mono text-xs ${colorClass}" style="min-width:52px;text-align:right;font-weight:700">${growthStr}</span>
            <span class="font-mono text-xs" style="min-width:80px;text-align:right;color:var(--gray-500)">| <strong class="${colorClass}">${gapStr}</strong></span>
          </div>
        </div>`;
    }).join(''));

    // NEW CA BY REGION RENDER
    DOM.setHtml('ca-table-region', c.byReg.map(r => `
      <tr>
        <td style="font-weight:600">${r.name}</td>
        <td class="font-mono">${Utils.fmtCompact(r.ca)}</td>
        <td class="font-mono text-gray-500">${Utils.fmtCompact(r.lm)}</td>
        <td class="font-mono ${r.gap<0?'text-red':'text-green'}">${Utils.fmtCompact(r.gap)}</td>
        <td><span class="pill ${r.delta<0?'bg-red':'bg-green'}">${r.delta>0?'+':''}${r.delta.toFixed(1)}%</span></td>
      </tr>
    `).join(''));

    DOM.setHtml('ca-region-tl', c.byReg.map((r, i) =>
      Components.trafficLight(`${i+1}. ${r.name}`, r.delta+50,
      `<span class="font-mono text-xs ${r.delta<0?'text-red':'text-green'}">Gap: ${Utils.fmtCompact(r.gap)}</span>`)
    ).join(''));
  },

  wholesaler: (w) => {
    // ── BB1: Card 1 — Target Wholesaler ──
    DOM.setTxt('ws-all-total', Utils.fmtCompact(w.allTgt));
    DOM.setTxt('ws-all-sub', `Source: Perfomance | Channel Wholesaler`);

    // ── BB1: Card 2 — Actual Wholesaler ──
    DOM.setTxt('ws-all-active', Utils.fmtCompact(w.allAct));
    DOM.setTxt('ws-all-act-pct', `Gap vs Target: ${Utils.fmtCompact(w.allAct - w.allTgt)}`);

    // ── BB1: Card 3 — Achievement % ──
    const achEl = document.getElementById('ws-all-zero');
    if (achEl) {
      achEl.textContent = Utils.fmtPct(w.allAch);
      achEl.className = `kpi-value ${Utils.getTextClass(w.allAch)}`;
    }
    DOM.setTxt('ws-all-zero-pct', `Target: ${Utils.fmtCompact(w.allTgt)} | Actual: ${Utils.fmtCompact(w.allAct)}`);

    // ── BB1: Card 4 — Growth Performance (LM + LY) — via TrendEngine ──
    const gwthEl = document.getElementById('ws-all-growth');
    if (gwthEl) {
      gwthEl.textContent = w.allTrend.hasLM
        ? `${w.allGwth >= 0 ? '+' : ''}${w.allGwth.toFixed(1)}%`
        : '—';
      gwthEl.className = `kpi-value ${TrendEngine.colorClass(w.allTrend.vsLM)}`;
    }
    // Grid uses TrendEngine.gridHtml — no manual color logic
    DOM.setHtml('ws-all-lm', TrendEngine.gridHtml(w.allTrend));

    DOM.setTxt('ws-badge-zero', `WS Ach ${Utils.fmtPct(w.allAch)}`);
    DOM.setHtml('ws-all-regions', w.regAll.map(r => Components.progRow(r.reg, r.ach, true)).join(''));

    const setProg = (id, d, isQty) => {
      DOM.setTxt(`ws-${id}-ach`, Utils.fmtPct(d.ach));
      DOM.setClass(`ws-${id}-ach`, `kpi-value ${d.ach>=60?'text-amber':'text-red'}`);
      DOM.setTxt(`ws-${id}-val`, `T: ${isQty?d.tgt.toLocaleString('id'):Utils.fmtCompact(d.tgt)} | A: ${isQty?d.act.toLocaleString('id'):Utils.fmtCompact(d.act)}`);
      // Trend insight replaces raw "vs LM: X%"
      DOM.setTxt(`ws-${id}-vslm`, TrendEngine.insight(d.trend, isQty));
      DOM.setClass(`ws-${id}-vslm`, `kpi-delta ${TrendEngine.colorClass(d.trend.vsLM)}`);
      DOM.setTxt(`ws-${id}-t`, d.t); DOM.setTxt(`ws-${id}-a`, d.actv); DOM.setTxt(`ws-${id}-z`, d.zro);
    };
    setProg('arj', w.arj, false); setProg('bim', w.bim, false); setProg('sc', w.sc, true);

    // Pareto Builders
    const bPar = (title, color, data, isQty) => `
      <div class="mb-8">
        <div style="font-size:11px;font-weight:700;color:var(--${color}-main);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;background:var(--${color}-bg);padding:6px 12px;border-radius:4px;border-left:4px solid var(--${color}-main)">
          📦 ${title} — ${isQty?'Qty (Unit)':'Value (Rp)'}
        </div>
        <div class="grid-2">
          <div class="kpi-card"><div class="kpi-label">🏆 Top 10 Outlet</div><div class="table-auto-height"><table class="data-table"><thead><tr><th>#</th><th>Outlet</th><th>Reg</th><th>Tgt</th><th>Act</th><th>Ach%</th></tr></thead><tbody>${Components.paretoTable(data.top, isQty)}</tbody></table></div></div>
          <div class="kpi-card"><div class="kpi-label">⚠ Bottom 10 Outlet</div><div class="table-auto-height"><table class="data-table"><thead><tr><th>#</th><th>Outlet</th><th>Reg</th><th>Tgt</th><th>Act</th><th>Ach%</th></tr></thead><tbody>${Components.paretoTable(data.bot, isQty)}</tbody></table></div></div>
        </div>
      </div>`;

    DOM.setHtml('ws-pareto-container',
      `<div class="sub-section-title">📊 BB3 — Pareto Outlet per Program</div>` +
      bPar('ITG ARJUNA', 'amber', w.arjT, false) +
      bPar('ITG BIMA', 'red', w.bimT, false) +
      bPar('ITG SUPERCUP', 'blue', w.scT, true)
    );
  },

  /**
   * toggleEmptyState(isEmpty) — additive global empty-state banner.
   * Shows "No Data Available" at the top of the dashboard when the active filter
   * combination returns no Performance rows. Does not alter any calculation.
   */
  toggleEmptyState: (isEmpty) => {
    let banner = DOM.el('global-empty-state');
    if (!banner) {
      const main = document.querySelector('.dashboard-wrap');
      if (!main) return;
      banner = document.createElement('div');
      banner.id = 'global-empty-state';
      banner.style.cssText = 'display:none;margin:0 0 12px;padding:18px 20px;border:1px dashed var(--gray-300);border-radius:8px;background:var(--gray-50);color:var(--gray-600);font-weight:700;text-align:center;font-size:13px';
      banner.innerHTML = '🔍 No Data Available — tidak ada data untuk kombinasi filter yang dipilih. Sesuaikan filter Region / Principle / Channel / Kategori / Depo.';
      main.insertBefore(banner, main.firstChild);
    }
    banner.style.display = isEmpty ? 'block' : 'none';
  },

  /**
   * renderPrincipleExecutiveSummary — Executive Summary Layer renderer.
   * Consumes k.principleExec. Fixed 5-card order (GPPJ, GEN, GBS, MBR, ALL PRINCIPLE).
   * Empty-data & missing-principle safe. No effect on Section 1 or other modules.
   */
  renderPrincipleExecutiveSummary: (pe) => {
    if (!DOM.el('pexec-cards')) return;
    const fmtBio = (v) => Utils.fmtCompact(Utils.safeNum(v));
    const sgnPct = (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const pol = (v) => v == null ? 'mut' : v >= 0 ? 'pos' : 'neg';

    if (!pe || !pe.hasData) {
      DOM.setHtml('pexec-summary', `<div class="s-item"><span class="s-k">Status</span><span class="s-v">Data belum tersedia</span></div>`);
      DOM.setHtml('pexec-cards', `<div class="kpi-card pexec-missing">Data Perfomance belum dimuat.</div>`);
      DOM.setHtml('pexec-insight', `<div class="insight-item"><span class="insight-icon">ℹ️</span><span class="insight-text neutral">Upload data untuk menampilkan ringkasan principle.</span></div>`);
      return;
    }

    // ── Top summary bar ──
    const s = pe.summary;
    const sItem = (k, v) => `<div class="s-item"><span class="s-k">${k}</span><span class="s-v">${v}</span></div>`;
    DOM.setHtml('pexec-summary',
      sItem('Principles', s.count) +
      sItem('Best',  s.best  ? `${s.best.name} (${Utils.fmtPct(s.best.ach)})`   : '—') +
      sItem('Worst', s.worst ? `${s.worst.name} (${Utils.fmtPct(s.worst.ach)})` : '—') +
      sItem('Average', s.avg != null ? Utils.fmtPct(s.avg) : '—') +
      sItem('Time Gone', Utils.fmtPct(pe.timeGone))
    );

    // ── Cards (fixed order) ──
    const cardHtml = (c) => {
      if (c.missing) {
        return `<div class="kpi-card pexec-card">
          <span class="badge solid-amber pexec-badge">N/A</span>
          <div class="pexec-title">${c.name}</div>
          <div class="pexec-missing">Principle tidak tersedia pada filter saat ini.</div>
        </div>`;
      }
      const badge = c.isArea
        ? `<span class="badge solid-navy pexec-badge">AREA SUMMARY</span>`
        : `<span class="badge ${c.status.badge} pexec-badge">${c.status.icon} ${c.status.label}</span>`;
      const areaCls = c.isArea ? ' st-area' : ` ${c.status.cls}`;
      const reqRRtxt = c.reqRR > 0 ? `${fmtBio(c.reqRR)}/HK` : '✓ Tercapai';
      return `<div class="kpi-card pexec-card${areaCls}">
        ${badge}
        <div class="pexec-title">${c.name}</div>
        <div class="pexec-row"><span class="k">Tgt</span><span class="v">${fmtBio(c.tgt)}</span></div>
        <div class="pexec-row"><span class="k">Gap</span><span class="v ${pol(c.gap)}">${fmtBio(c.gap)}</span></div>
        <div class="pexec-row"><span class="k">Act</span><span class="v">${fmtBio(c.act)}</span></div>
        <div class="pexec-row"><span class="k">Act Pace</span><span class="v">${fmtBio(c.actRR)}/HK</span></div>
        <div class="pexec-row"><span class="k">Req RR</span><span class="v">${reqRRtxt}</span></div>
        <div class="pexec-row"><span class="k">LM / LY</span><span class="v"><span class="${pol(c.vsLM)}">${sgnPct(c.vsLM)}</span> / <span class="${pol(c.vsLY)}">${sgnPct(c.vsLY)}</span></span></div>
        <div class="pexec-row"><span class="k">Ach</span><span class="v pexec-ach ${pol(c.gapVsPace)}">${Utils.fmtPct(c.ach)}</span></div>
        <div class="pexec-row"><span class="k">Gap vs Pace</span><span class="v ${pol(c.gapVsPace)}">${sgnPct(c.gapVsPace)}</span></div>
      </div>`;
    };
    DOM.setHtml('pexec-cards', pe.cards.map(cardHtml).join(''));

    // ── Executive insights ──
    DOM.setHtml('pexec-insight', pe.insights.map(i =>
      `<div class="insight-item"><span class="insight-icon">${i.tone === 'positive' ? '✅' : i.tone === 'negative' ? '🔻' : i.tone === 'warning' ? '⚠' : 'ℹ️'}</span><span class="insight-text ${i.tone}">${i.text}</span></div>`
    ).join(''));
  },

  /**
   * renderWholesalerClassPerformance — BB5 renderer.
   * Consumes k.wsClass (KPIEngine.calcWholesalerClass). Renders:
   *   (1) Class summary table + total footer  → #bb5-class-tbl / #bb5-class-tfoot
   *   (2) Dual-axis combo chart (bar=Sales TM, line=Growth LM%/LY%) → #chart-bb5-class
   *   (3) Executive insight card → #bb5-insight
   * Container hidden when no Wholesaler sheet present. No effect on other modules.
   */
  renderWholesalerClassPerformance: (wc) => {
    const wrap = DOM.el('ws-bb5-container');
    if (!wrap) return;
    if (!wc || !wc.hasData || !wc.classes.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    const C = Config.COLORS;
    const fmtG = (v) => v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    const gTxtCls = (v) => v === null ? '' : v >= 0 ? 'text-green' : 'text-red';

    // ── (1) Class Summary Table ──
    DOM.setHtml('bb5-class-tbl', wc.classes.map(c => `
      <tr>
        <td style="font-weight:700">${c.cls}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${Utils.fmtCompact(c.tm)}</td>
        <td style="text-align:right;font-family:var(--font-mono)">${c.contrib.toFixed(1)}%</td>
        <td style="text-align:right;font-family:var(--font-mono)" class="${gTxtCls(c.gLM)}">${fmtG(c.gLM)}</td>
        <td style="text-align:right;font-family:var(--font-mono)" class="${gTxtCls(c.gLY)}">${fmtG(c.gLY)}</td>
        <td><span class="badge ${c.status.badge}">${c.status.icon} ${c.status.label}</span></td>
      </tr>`).join(''));

    const totLM = wc.classes.reduce((s, c) => s + c.lm, 0);
    const totLY = wc.classes.reduce((s, c) => s + c.ly, 0);
    const gLMall = Utils.safeDiv(wc.totalTM - totLM, totLM);
    const gLYall = Utils.safeDiv(wc.totalTM - totLY, totLY);
    DOM.setHtml('bb5-class-tfoot', `
      <tr style="border-top:2px solid var(--gray-300);font-weight:700;background:var(--gray-50)">
        <td>TOTAL</td>
        <td style="text-align:right;font-family:var(--font-mono)">${Utils.fmtCompact(wc.totalTM)}</td>
        <td style="text-align:right;font-family:var(--font-mono)">100.0%</td>
        <td style="text-align:right;font-family:var(--font-mono)" class="${gTxtCls(gLMall === null ? null : gLMall * 100)}">${fmtG(gLMall === null ? null : gLMall * 100)}</td>
        <td style="text-align:right;font-family:var(--font-mono)" class="${gTxtCls(gLYall === null ? null : gLYall * 100)}">${fmtG(gLYall === null ? null : gLYall * 100)}</td>
        <td></td>
      </tr>`);

    // ── (2) Combo Chart — bars = Sales TM (left axis), lines = Growth LM%/LY% (right %-axis) ──
    // NOTE: Implemented as vertical dual-axis combo (executive standard) instead of a horizontal
    // bar; Chart.js cannot cleanly overlay line series on a horizontal bar. Sorted by Sales TM desc.
    const labels = wc.classes.map(c => c.cls);
    ChartEngine.create('chart-bb5-class', 'bar', {
      labels,
      datasets: [
        { label: 'Sales TM', data: wc.classes.map(c => c.tm), backgroundColor: '#0F2744',
          borderRadius: 4, yAxisID: 'y', order: 3, barThickness: 30 },
        { label: 'Growth LM%', data: wc.classes.map(c => c.gLM === null ? null : +c.gLM.toFixed(1)),
          type: 'line', borderColor: '#10B981', backgroundColor: 'transparent', fill: false, tension: 0.25,
          pointRadius: 4, pointBackgroundColor: '#10B981', pointBorderColor: '#fff', pointBorderWidth: 2,
          yAxisID: 'y1', order: 1, spanGaps: true },
        { label: 'Growth LY%', data: wc.classes.map(c => c.gLY === null ? null : +c.gLY.toFixed(1)),
          type: 'line', borderColor: '#F59E0B', backgroundColor: 'transparent', fill: false, tension: 0.25,
          pointRadius: 4, pointBackgroundColor: '#F59E0B', pointBorderColor: '#fff', pointBorderWidth: 2,
          borderDash: [5, 3], yAxisID: 'y1', order: 2, spanGaps: true }
      ]
    }, {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.yAxisID === 'y1'
          ? ` ${ctx.dataset.label}: ${ctx.parsed.y === null ? '—' : (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y + '%'}`
          : ` ${ctx.dataset.label}: ${Utils.fmtCompact(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { font: { size: 10, weight: '700' } }, grid: { display: false } },
        y: { position: 'left', beginAtZero: true, title: { display: true, text: 'Sales TM (Rp)', font: { size: 9 } },
             ticks: { callback: v => Utils.fmtCompact(v), font: { size: 9 } }, grid: { color: '#F2F2F7' } },
        y1: { position: 'right', title: { display: true, text: 'Growth %', font: { size: 9 } },
              ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { drawOnChartArea: false } }
      },
      animation: {
        onComplete: function() {
          const chart = this, ctx = chart.ctx;
          ctx.save();
          ctx.textAlign = 'center';
          // di=0 Sales TM (bar, navy, above bar) · di=1 Growth LM% (green, above point) · di=2 Growth LY% (orange, below point → anti-overlap)
          const draw = (di, color, baseline, dy, isPct) => {
            ctx.fillStyle = color;
            ctx.textBaseline = baseline;
            ctx.font = (di === 0 ? '700 9px' : '700 8.5px') + ' "IBM Plex Mono", monospace';
            chart.getDatasetMeta(di).data.forEach((el, idx) => {
              const v = chart.data.datasets[di].data[idx];
              if (v === null || v === undefined) return;
              const txt = isPct ? ((v >= 0 ? '+' : '') + v.toFixed(1) + '%') : Utils.fmtCompact(v);
              ctx.fillText(txt, el.x, el.y + dy);
            });
          };
          draw(0, '#0F2744', 'bottom', -4, false);
          draw(1, '#10B981', 'bottom', -7, true);
          draw(2, '#F59E0B', 'top',     7, true);
          ctx.restore();
        }
      }
    });

    // ── (3) Executive Insight Card ──
    const ins = wc.insight;
    const item = (icon, tone, html) =>
      `<div class="insight-item"><span class="insight-icon">${icon}</span><span class="insight-text ${tone}">${html}</span></div>`;
    const b = (t) => `<strong>${t}</strong>`;
    const rows = [];
    if (ins.largest)
      rows.push(item('🏆', 'neutral',
        `Largest Contributor: ${b(ins.largest.cls)} menyumbang ${b(ins.largest.contrib.toFixed(1) + '%')} dari total Sales TM (${Utils.fmtCompact(ins.largest.tm)}).`));
    if (ins.fastestLM)
      rows.push(item('📈', 'positive',
        `Fastest Growth vs LM: ${b(ins.fastestLM.cls)} ${b(fmtG(ins.fastestLM.gLM))} month-on-month.`));
    if (ins.fastestLY)
      rows.push(item('📅', 'positive',
        `Fastest Growth vs LY: ${b(ins.fastestLY.cls)} ${b(fmtG(ins.fastestLY.gLY))} year-on-year.`));
    if (ins.biggestDrop)
      rows.push(item('🔻', 'negative',
        `Biggest Decline: ${b(ins.biggestDrop.cls)} (LM ${fmtG(ins.biggestDrop.gLM)} · LY ${fmtG(ins.biggestDrop.gLY)}) — kontribusi ${ins.biggestDrop.contrib.toFixed(1)}%.`));
    else
      rows.push(item('✅', 'positive', `Tidak ada class yang menurun vs LM maupun LY.`));
    if (ins.focus)
      rows.push(item('🎯', 'warning',
        `Recommended Focus: prioritaskan ${b(ins.focus.cls)} (${ins.focus.status.label}) — bobot ${ins.focus.contrib.toFixed(1)}% terhadap total, ${ins.focus.status.key === 'critical' ? 'turun di kedua periode' : 'butuh penguatan momentum'}.`));
    DOM.setHtml('bb5-insight', rows.join(''));
  },

  psAchiever: (ps) => {
    if (!ps.hasData) {
      DOM.setTxt('ps-status-badge', '⚠ Data PS Kosong / Tidak Tersedia');
      return;
    }

    DOM.setTxt('ps-si-ach', Utils.fmtPct(ps.siAch));
    DOM.setClass('ps-si-ach', `kpi-value ${Utils.getTextClass(ps.siAch)}`);
    DOM.setTxt('ps-si-val', `T: ${Utils.fmtCompact(ps.sit)} | A: ${Utils.fmtCompact(ps.sia)}`);
    DOM.setTxt('ps-si-gap', `▼ Gap: ${Utils.fmtCompact(ps.sia - ps.sit)}`);

    DOM.setTxt('ps-so-ach', Utils.fmtPct(ps.soAch));
    DOM.setClass('ps-so-ach', `kpi-value ${Utils.getTextClass(ps.soAch)}`);
    DOM.setTxt('ps-so-val', `T: ${Utils.fmtCompact(ps.sot)} | A: ${Utils.fmtCompact(ps.soa)}`);
    const gap = ps.soAch - ps.siAch;
    DOM.setTxt('ps-so-gap', gap > 3 ? '⚠ SO > SI (Stok Tipis)' : gap < -3 ? '📦 SI > SO (Stok Numpuk)' : '✅ Balance');

    // SO vs LM card — use TrendEngine for display + coloring
    DOM.setTxt('ps-so-vslm-val', ps.soTrend.hasLM ? `${ps.soVslm>=0?'+':''}${ps.soVslm.toFixed(1)}%` : '—');
    DOM.setClass('ps-so-vslm-val', `kpi-value ${TrendEngine.colorClass(ps.soTrend.vsLM)}`);
    DOM.setTxt('ps-so-lm-sub', `SO LM: ${Utils.fmtCompact(ps.solm)}`);
    DOM.setTxt('ps-si-lm-sub', TrendEngine.insight(ps.siTrend));

    // CA card
    DOM.setTxt('ps-ca-tm', Utils.fmtCompact(ps.cat));
    DOM.setClass('ps-ca-tm', `kpi-value ${TrendEngine.colorClass(ps.caTrend.vsLM)}`);
    DOM.setTxt('ps-ca-lm', `CA LM: ${Utils.fmtCompact(ps.calm)}`);
    DOM.setTxt('ps-ca-delta', TrendEngine.insight(ps.caTrend));

    DOM.setHtml('ps-si-regions', ps.reg.map(r => Components.progRow(r.reg, r.sia)).join(''));
    DOM.setHtml('ps-so-regions', ps.reg.map(r => Components.progRow(r.reg, r.soa)).join(''));

    // ── PS TOP/BOTTOM RANKING — uses generatePSTopBottomTable helper ──
    // Rendered into #ps-ranking container added in Section 4 HTML.
    // byPS array computed in calcPSAchiever — no duplicate calculation here.
    const byPS = ps.byPS || [];
    if (byPS.length) {
      DOM.setHtml('ps-ranking', `
        <div class="sub-section" style="margin-top:12px">
          <div class="sub-section-title">📊 PS RANKING — TOP &amp; BOTTOM ACHIEVER</div>
          <div class="grid-2 mb-8">
            ${Components.generatePSTopBottomTable(byPS, 'si', 'top')}
            ${Components.generatePSTopBottomTable(byPS, 'si', 'bot')}
          </div>
          <div class="grid-2">
            ${Components.generatePSTopBottomTable(byPS, 'so', 'top')}
            ${Components.generatePSTopBottomTable(byPS, 'so', 'bot')}
          </div>
        </div>`);
    } else {
      DOM.setHtml('ps-ranking', '');
    }
  },

  /**
   * renderITGTimegone(k) ← NEW (BB2.5). Computes via KPIEngine.calcITGTimegone (pure)
   * and injects the shared header, 3 program cards, and executive insight.
   * Read-only on k.ws + TimeEngine — no existing KPI/state touched.
   */
  renderITGTimegone: (k) => {
    if (!DOM.el('tg-cards')) return;
    const tg = KPIEngine.calcITGTimegone(k.ws, TimeEngine.get());
    const fmtSigned = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
    const fmtReq = (c) => c.reqDailySales === null ? '—'
      : c.isQty ? `${Math.round(c.reqDailySales).toLocaleString('id-ID')} u/HK`
                : `${Utils.fmtCompact(c.reqDailySales)}/HK`;

    const h = tg.header;
    DOM.setHtml('tg-header',
      `<div class="h-item"><span class="h-k">Timegone</span><span class="h-v">${Utils.fmtPct(h.timeGone)}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Passed</span><span class="h-v">${h.hkPass}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Total</span><span class="h-v">${h.hkTot}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Remaining</span><span class="h-v">${h.hkRem}</span></div>`
    );

    const fmtGap = (v, isQty) => isQty ? `${Math.round(v).toLocaleString('id-ID')} u` : Utils.fmtCompact(v);
    DOM.setHtml('tg-cards', tg.cards.map(c => {
      if (!c.hasData) return `<div class="kpi-card bdr-top-${c.color} tg-card"><div class="tg-head"><span class="tg-name">${c.name}</span></div><div class="tg-mini"><span class="tg-mini-l">Data tidak tersedia pada filter saat ini.</span></div></div>`;
      const gapCls   = c.gapVsTG >= 0 ? 'pos' : 'neg';
      const recovTxt = (c.recovNeed === null || c.recovNeed <= 0) ? '—' : `+${c.recovNeed.toFixed(1)}%`;
      const recovCls = (c.recovNeed === null || c.recovNeed <= 0) ? 'mut' : 'neg';
      const projCls  = c.proj === null ? 'mut' : c.proj >= 100 ? 'pos' : c.proj >= 90 ? '' : 'neg';
      return `<div class="kpi-card bdr-top-${c.color} tg-card">
        <div class="tg-head">
          <span class="tg-name">${c.name}</span>
          <span class="tg-badge ${c.status.cls}">${c.status.icon} ${c.status.label}</span>
        </div>
        <div class="tg-grid">
          <div class="tg-mini tg-hero">
            <div class="tg-mini-v">${Utils.fmtPct(c.ach)}</div>
            <div class="tg-mini-l">Achievement</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${gapCls}">${fmtSigned(c.gapVsTG)}</div>
            <div class="tg-mini-l">Gap vs Timegone</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v">${fmtGap(c.remainGap, c.isQty)}</div>
            <div class="tg-mini-l">Remaining Gap</div>
            <div class="tg-mini-s">≈ ${fmtReq(c)}</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${recovCls}">${recovTxt}</div>
            <div class="tg-mini-l">Recovery Need</div>
            <div class="tg-mini-s"><span class="rn-badge ${c.recovInterp.cls}">${c.recovInterp.label}</span></div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${projCls}">${c.proj === null ? '—' : Utils.fmtPct(c.proj)}</div>
            <div class="tg-mini-l">Projected ME</div>
          </div>
        </div>
      </div>`;
    }).join(''));

    const i = tg.insight, bullets = [];
    if (i.worstGap)  bullets.push(`Worst gap vs timegone: <strong>${i.worstGap.name}</strong> (${fmtSigned(i.worstGap.gapVsTG)}).`);
    if (i.highRecov) bullets.push(`Highest recovery need: <strong>${i.highRecov.name}</strong> (+${i.highRecov.recovNeed.toFixed(1)}% pace uplift — ${i.highRecov.recovInterp.label}).`);
    else             bullets.push(`Tidak ada program yang memerlukan recovery — semua on pace atau lebih cepat.`);
    if (i.bestProj)  bullets.push(`Best projected finish: <strong>${i.bestProj.name}</strong> (${Utils.fmtPct(i.bestProj.proj)}).`);
    DOM.setHtml('tg-insight',
      `<div class="kpi-label">🧭 Executive Insight — Timegone</div><ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>`);
  },

  bb4ClassAnalysis: (k) => {
    const C = Config.COLORS;

    // ── Helpers ──
    const fmtVal = (v, isQty) => isQty ? Math.round(v).toLocaleString('id-ID') : Utils.fmtCompact(v);
    // growthPill now delegates to TrendEngine.pill — consistent coloring across all sections
    const growthPill = (v) => TrendEngine.pill(v);
    const achPill = (v) => {
      const cls = v >= 90 ? 'bg-green' : v >= 60 ? 'bg-amber' : 'bg-red';
      return `<span class="pill ${cls}">${v.toFixed(1)}%</span>`;
    };
    const trxPill = (v) => {
      const cls = v >= 80 ? 'bg-green' : v >= 50 ? 'bg-amber' : 'bg-red';
      return `<span class="pill ${cls}">${v.toFixed(1)}%</span>`;
    };

    // ── KPI summary cards for a program ──
    const renderKPICards = (containerId, rows, isQty) => {
      const total   = rows.reduce((s, r) => s + r.participants, 0);
      const totTgt  = rows.reduce((s, r) => s + r.target, 0);
      const totAct  = rows.reduce((s, r) => s + r.actual, 0);
      const totLM   = rows.reduce((s, r) => s + r.lm,     0);
      const avgAch  = Utils.calcAch(totAct, totTgt);
      const avgTrx  = total > 0 ? (rows.reduce((s, r) => s + r.trx, 0) / total * 100) : 0;
      const achCls  = avgAch >= 90 ? 'text-green' : avgAch >= 60 ? 'text-amber' : 'text-red';
      const trxCls  = avgTrx >= 80 ? 'text-green' : avgTrx >= 50 ? 'text-amber' : 'text-red';
      // Aggregate trend across all classes
      const aggTrend = TrendEngine.calc(totAct, totLM, null);

      DOM.setHtml(containerId, `
        <div class="kpi-card bdr-top-blue">
          <div class="kpi-label">👥 Total Peserta</div>
          <div class="kpi-value">${total.toLocaleString('id-ID')}</div>
          <div class="kpi-sub">${rows.length} Class</div>
        </div>
        <div class="kpi-card bdr-top-amber">
          <div class="kpi-label">🎯 Total Target</div>
          <div class="kpi-value text-amber" style="font-size:20px">${fmtVal(totTgt, isQty)}</div>
          <div class="kpi-sub">${isQty ? 'Qty' : 'Value'}</div>
        </div>
        <div class="kpi-card bdr-top-red">
          <div class="kpi-label">📊 Total Actual</div>
          <div class="kpi-value ${achCls}" style="font-size:20px">${fmtVal(totAct, isQty)}</div>
          <div class="kpi-sub">Ach: ${avgAch.toFixed(1)}%</div>
          <div class="kpi-delta ${TrendEngine.colorClass(aggTrend.vsLM)}" style="font-size:10px">${TrendEngine.insight(aggTrend, isQty)}</div>
        </div>
        <div class="kpi-card bdr-top-green">
          <div class="kpi-label">✅ Avg Outlet Trx%</div>
          <div class="kpi-value ${trxCls}" style="font-size:20px">${avgTrx.toFixed(1)}%</div>
          <div class="kpi-sub">Outlet bertransaksi</div>
        </div>
      `);
    };

    // ── Table rows ──
    const renderTable = (tbodyId, rows, isQty) => {
      DOM.setHtml(tbodyId, rows.map(r => `
        <tr>
          <td><strong>${r.cls}</strong></td>
          <td class="font-mono">${r.participants.toLocaleString('id-ID')}</td>
          <td class="font-mono text-xs">${fmtVal(r.target, isQty)}</td>
          <td class="font-mono text-xs">${fmtVal(r.actual, isQty)}</td>
          <td>${achPill(r.ach)}</td>
          <td>${growthPill(r.vsLM)}</td>
          <td>${growthPill(r.vsLY)}</td>
          <td>${trxPill(r.outletTrxPct)}</td>
        </tr>`).join(''));
    };

    // ── Horizontal bar chart with labels ──
    const renderChart = (chartId, rows) => {
      const colors = rows.map(r => r.ach >= 90 ? C.green : r.ach >= 60 ? C.amber : C.red);
      ChartEngine.create(chartId, 'bar', {
        labels: rows.map(r => r.cls),
        datasets: [{ label: 'Ach%', data: rows.map(r => +r.ach.toFixed(1)), backgroundColor: colors, borderRadius: 4 }]
      }, {
        indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(1)}%` } } },
        scales: {
          x: { min: 0, max: Math.max(...rows.map(r => r.ach), 100) + 15, ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#F2F2F7' } },
          y: { ticks: { font: { size: 10, weight: '600' } }, grid: { display: false } }
        },
        animation: {
          onComplete: function() {
            const chart = this;
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = '700 10px "IBM Plex Mono"';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            chart.getDatasetMeta(0).data.forEach((bar, idx) => {
              const val = rows[idx].ach.toFixed(1) + '%';
              ctx.fillStyle = '#fff';
              ctx.fillText(val, bar.x - ctx.measureText(val).width - 6, bar.y);
              // Also show actual vs target below class name
              ctx.font = '500 9px "IBM Plex Mono"';
              ctx.fillStyle = '#9CA3AF';
            });
            ctx.restore();
          }
        }
      });
    };

    // ── Render all 3 programs ──
    renderKPICards('bb4-arj-kpi', k.clsArj, false);
    renderTable('bb4-arj-tbl', k.clsArj, false);
    renderChart('chart-bb4-arj', k.clsArj);

    renderKPICards('bb4-bim-kpi', k.clsBim, false);
    renderTable('bb4-bim-tbl', k.clsBim, false);
    renderChart('chart-bb4-bim', k.clsBim);

    renderKPICards('bb4-sc-kpi', k.clsSc, true);
    renderTable('bb4-sc-tbl', k.clsSc, true);
    renderChart('chart-bb4-sc', k.clsSc);
  },

  priorityAction: (k) => {
    const alerts  = k.alerts;

    // ── Action list — top 5 issues from AlertEngine, sorted by severityScore ──
    // Each item's badge, headline, and action are entirely data-driven (no hardcoded strings)
    DOM.setHtml('action-list', alerts.top5.length
      ? alerts.top5.map((issue, i) => {
          // Severity bar width: score → 0–100% capped
          const barW   = Math.min(100, issue.severityScore);
          const barClr = issue.severityScore >= 70 ? 'var(--red-main)'
                       : issue.severityScore >= 45 ? 'var(--red-main)'
                       : issue.severityScore >= 20 ? 'var(--amber-main)'
                       : 'var(--blue-main)';
          const numBg  = issue.severityScore >= 45 ? 'var(--red-main)' : 'var(--amber-main)';
          return `
            <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-color)">
              <div style="flex-shrink:0">
                <div style="width:24px;height:24px;background:${numBg};color:white;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;box-shadow:var(--shadow-sm)">${i + 1}</div>
                <div style="font-size:9px;color:var(--gray-500);text-align:center;margin-top:3px;font-family:var(--font-mono)">${issue.severityScore.toFixed(0)}</div>
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                  <span class="badge ${issue.badgeCls}" style="font-size:9px;padding:2px 6px">${issue.badgeLabel}</span>
                  <span style="font-size:9px;color:var(--gray-400);font-family:var(--font-mono)">${issue.domain}</span>
                </div>
                <div style="font-size:12px;font-weight:700;color:var(--gray-900);line-height:1.35">${issue.headline}</div>
                <div style="font-size:11px;color:var(--blue-main);font-weight:600;margin-top:3px">→ ${issue.action}</div>
                <div style="height:3px;background:var(--gray-100);border-radius:2px;margin-top:5px;overflow:hidden">
                  <div style="height:100%;width:${barW}%;background:${barClr};border-radius:2px;transition:width .4s"></div>
                </div>
              </div>
            </div>`;
        }).join('')
      : '<div style="padding:16px;text-align:center;color:var(--green-main);font-weight:600">✅ Tidak ada issue kritis terdeteksi</div>'
    );

    // ── Region sidebar — worst regions by ach (unchanged visual) ──
    DOM.setHtml('action-regions', k.perf.byReg.slice(0, 4).map(r => Components.trafficLight(r.region, r.ach)).join(''));

    // ── Principle sidebar — sort by combined severity (tgStatus + trend) ──
    const sortedPrin = [...k.perf.byPrin].sort((a, b) => {
      const order = { DANGER: 0, WARNING: 1, GOOD: 2 };
      const diff  = order[a.tgStatus.status] - order[b.tgStatus.status];
      return diff !== 0 ? diff : b.tgStatus.severityScore - a.tgStatus.severityScore;
    }).slice(0, 4);

    DOM.setHtml('action-principles', sortedPrin.map(p => {
      const extra = Components.statBadgeCompact(p.tgStatus);
      return Components.trafficLight(p.principle, p.ach, extra);
    }).join(''));

    // ── Bottom line — top insight sentence (management-friendly) ──
    const topInsight  = k.insights[0];
    const overallPS   = TimeEngine.evalStatus(k.perf.ach);
    const tf          = TimeEngine.fmt();
    DOM.setHtml('action-bottom-line',
      `<span style="color:var(--amber-main)">${overallPS.label}</span> ` +
      `| Gap ${overallPS.gap >= 0 ? '+' : ''}${overallPS.gap.toFixed(1)}pp. ` +
      `${tf.hkRemLabel}. — ` +
      `<span style="color:var(--gray-200)">${topInsight?.sentence ?? 'Pantau run rate dan eksekusi CA Zero.'}</span>`
    );
  },

  /**
   * executiveSummary — renders structured 5-slot morning briefing.
   * Uses ExecSummaryEngine.render() which also writes context line + filter tag.
   * Called on every filter change via execAll() — fully reactive.
   */
  executiveSummary: (k) => {
    DOM.setHtml('exec-summary-list', ExecSummaryEngine.render(k.execSlots, k));
  },

  charts: (k) => {
    const C = Config.COLORS;
    const getCls = ach => ach>=90 ? C.green : ach>=60 ? C.amber : C.red;

    // ── Shared datalabels style helpers ──
    const labelFont = { size: 10, weight: '700', family: "'IBM Plex Mono', monospace" };
    const labelFontSm = { size: 9, weight: '600', family: "'IBM Plex Mono', monospace" };

    // ── CHART 1: Region Achievement (horizontal bar) with inline metrics ──
    // Inline label format: "Ach XX% | Act XXB | Gap ±XXB | vs LM ±X% | Need X/HK"
    // Drawn via onComplete canvas annotation — one text line per bar at bar.x + 5.
    const tdChart = TimeEngine.get();
    ChartEngine.create('chart-region', 'bar', {
      labels: k.perf.byReg.map(r => r.region),
      datasets: [{
        label: 'Ach%',
        data: k.perf.byReg.map(r => +r.ach.toFixed(1)),
        backgroundColor: k.perf.byReg.map(r => getCls(r.ach)),
        borderRadius: 4,
        barThickness: 14
      }]
    }, {
      indexAxis: 'y',
      layout: { padding: { right: 5 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {
          label: ctx => {
            const r = k.perf.byReg[ctx.dataIndex];
            const lines = [`Ach: ${r.ach.toFixed(1)}%`, `Act: ${Utils.fmtCompact(r.act)}`, `Gap: ${(r.gap >= 0 ? '+' : '')}${Utils.fmtCompact(r.gap)}`];
            if (r.trend?.hasLM) lines.push(`vs LM: ${(r.trend.vsLM >= 0 ? '+' : '')}${r.trend.vsLM.toFixed(1)}%`);
            return lines;
          }
        }}
      },
      scales: {
        x: { min: 0, max: Math.max(...k.perf.byReg.map(r => r.ach), 100) + 5,
             ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#F2F2F7' } },
        y: { ticks: { font: { size: 10, weight: '600' } }, grid: { display: false } }
      },
      animation: {
        onComplete: function() {
          const chart = this;
          const ctx   = chart.ctx;
          ctx.save();
          ctx.font          = '600 8.5px "IBM Plex Mono"';
          ctx.textAlign     = 'left';
          ctx.textBaseline  = 'middle';
          chart.getDatasetMeta(0).data.forEach((bar, idx) => {
            const r        = k.perf.byReg[idx];
            const achStr   = `Ach ${r.ach.toFixed(1)}%`;
            const actStr   = `Act ${Utils.fmtCompact(r.act)}`;
            const gapStr   = `Gap ${r.gap >= 0 ? '+' : ''}${Utils.fmtCompact(r.gap)}`;
            const lmStr    = r.trend?.hasLM
              ? ` | vs LM ${r.trend.vsLM >= 0 ? '+' : ''}${r.trend.vsLM.toFixed(1)}%`
              : '';
            const needStr  = r.gap < 0 && tdChart.hkRem > 0
              ? ` | Need ${Utils.fmtCompact(Math.abs(r.gap) / tdChart.hkRem)}/HK`
              : ' | On Track';
            const label    = `${achStr} | ${actStr} | ${gapStr}${lmStr}${needStr}`;
            const color    = r.ach >= 100 ? C.green : r.ach >= 80 ? '#B7770D' : C.red;
            ctx.fillStyle  = color;
            ctx.fillText(label, bar.x + 5, bar.y);
          });
          ctx.restore();
        }
      }
    });

    // ── CHART 2: CA per Channel TM vs LM (focus channels only, sorted by CA TM desc) ──
    const chData = [...k.ca.byCh].sort((a, b) => b.ca - a.ca).slice(0, 8);
    ChartEngine.create('chart-ca-channel', 'bar', {
      labels: chData.map(c => c.name),
      datasets: [
        { label: 'CA TM', data: chData.map(c => c.ca), backgroundColor: C.blue, borderRadius: 3 },
        { label: 'CA LM', data: chData.map(c => c.lm), backgroundColor: C.gray, borderRadius: 3 }
      ]
    }, {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('id-ID')}` } }
      },
      scales: {
        x: { ticks: { font: { size: 9 } }, grid: { display: false } },
        y: { ticks: { callback: v => Utils.fmtCompact(v), font: { size: 9 } }, grid: { color: '#F2F2F7' } }
      },
      animation: {
        onComplete: function() {
          const chart = this;
          const ctx = chart.ctx;
          ctx.save();
          ctx.font = `600 9px "IBM Plex Mono"`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          chart.data.datasets.forEach((dataset, di) => {
            chart.getDatasetMeta(di).data.forEach((bar, idx) => {
              const val = dataset.data[idx];
              if (val === 0) return;
              const label = Utils.fmtCompact(val);
              const x = bar.x;
              const y = bar.y - 3;
              // Background pill
              const tw = ctx.measureText(label).width + 6;
              ctx.fillStyle = di === 0 ? C.blue : '#9CA3AF';
              ctx.beginPath();
              ctx.roundRect(x - tw/2, y - 13, tw, 13, 3);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.fillText(label, x, y - 1);
            });
          });
          ctx.restore();
        }
      }
    });

    // ── CHART 3: BB1 — All WS Target vs Actual vs LM per Region (Source: Perfomance) ──
    ChartEngine.create('chart-ws-all', 'bar', {
      labels: k.ws.regAll.map(r => r.reg),
      datasets: [
        { label: 'Target', data: k.ws.regAll.map(r => r.tgt), backgroundColor: C.gray, borderRadius: 3 },
        { label: 'LM',     data: k.ws.regAll.map(r => r.lm),  backgroundColor: '#0F1B3F', borderRadius: 3 },
        { label: 'Actual', data: k.ws.regAll.map(r => r.act), backgroundColor: C.amber, borderRadius: 3 }
      ]
    }, {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${Utils.fmtCompact(ctx.parsed.y)}` } }
      },
      scales: {
        x: { ticks: { font: { size: 10, weight: '600' } }, grid: { display: false } },
        y: { ticks: { callback: v => Utils.fmtCompact(v), font: { size: 9 } }, grid: { color: '#F2F2F7' } }
      },
      animation: {
        onComplete: function() {
          const chart = this;
          const ctx = chart.ctx;
          ctx.save();
          // Labels for bar datasets (Target & Actual)
          [0, 1].forEach(di => {
            const meta = chart.getDatasetMeta(di);
            const ds = chart.data.datasets[di];
            const isActual = di === 1;
            ctx.font = `700 10px "IBM Plex Mono"`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            meta.data.forEach((bar, idx) => {
              const val = ds.data[idx];
              if (!val) return;
              const label = Utils.fmtCompact(val);
              const x = bar.x;
              const y = bar.y - 4;
              ctx.fillStyle = isActual ? C.amber : '#9CA3AF';
              ctx.fillText(label, x, y);
            });
          });
          // Labels for LM line points
          const lmMeta = chart.getDatasetMeta(2);
          const lmDs = chart.data.datasets[2];
          ctx.font = `600 9px "IBM Plex Mono"`;
          ctx.fillStyle = C.blue;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          lmMeta.data.forEach((pt, idx) => {
            const val = lmDs.data[idx];
            if (!val) return;
            ctx.fillText(Utils.fmtCompact(val), pt.x, pt.y - 8);
          });
          ctx.restore();
        }
      }
    });

    // ── CHART 4: BB2 — Achievement % per Region per Program (Grouped Bar) ──
    const bb2Regions = [...new Set([
      ...k.ws.regArj.map(r => r.reg),
      ...k.ws.regBim.map(r => r.reg),
      ...(k.ws.regSc || []).map(r => r.reg)
    ])].sort();

    const getRegAch = (arr, reg) => {
      const f = arr.find(r => r.reg === reg);
      return f ? +f.ach.toFixed(1) : 0;
    };

    const bb2Arj = bb2Regions.map(r => getRegAch(k.ws.regArj, r));
    const bb2Bim = bb2Regions.map(r => getRegAch(k.ws.regBim, r));
    const bb2Sc  = bb2Regions.map(r => getRegAch(k.ws.regSc || [], r));
    const bb2Colors = [C.amber, C.red, C.blue];

    ChartEngine.create('chart-bb2-program', 'bar', {
      labels: bb2Regions,
      datasets: [
        { label: 'Arjuna — Value (%)',   data: bb2Arj, backgroundColor: C.amber, borderRadius: 3 },
        { label: 'Bima — Value (%)',     data: bb2Bim, backgroundColor: C.red,   borderRadius: 3 },
        { label: 'Supercup — Qty (%)',   data: bb2Sc,  backgroundColor: C.blue,  borderRadius: 3 }
      ]
    }, {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%` } }
      },
      scales: {
        x: { ticks: { font: { size: 10, weight: '600' } }, grid: { display: false } },
        y: { min: 0, max: 130, ticks: { callback: v => v + '%', font: { size: 9 } }, grid: { color: '#F2F2F7' } }
      },
      animation: {
        onComplete: function() {
          const chart = this;
          const ctx2 = chart.ctx;
          ctx2.save();
          chart.data.datasets.forEach((dataset, di) => {
            chart.getDatasetMeta(di).data.forEach((bar, idx) => {
              const val = dataset.data[idx];
              if (!val) return;
              const label = val.toFixed(1) + '%';
              ctx2.font = `700 10px "IBM Plex Mono"`;
              ctx2.textAlign = 'center';
              ctx2.textBaseline = 'bottom';
              const x = bar.x;
              const y = bar.y - 3;
              const tw = ctx2.measureText(label).width + 8;
              ctx2.fillStyle = bb2Colors[di];
              ctx2.globalAlpha = 0.88;
              ctx2.beginPath();
              if (ctx2.roundRect) ctx2.roundRect(x - tw/2, y - 14, tw, 14, 3);
              else ctx2.rect(x - tw/2, y - 14, tw, 14);
              ctx2.fill();
              ctx2.globalAlpha = 1;
              ctx2.fillStyle = '#ffffff';
              ctx2.fillText(label, x, y - 1);
            });
          });
          ctx2.restore();
        }
      }
    });
  }
};
