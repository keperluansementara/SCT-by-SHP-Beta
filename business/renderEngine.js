/**
 * renderEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Render Engine — all dashboard section rendering.
 * Reads State.kpi and writes directly to the DOM.
 *
 * Source: index.html (inline block) — lines 2989–4522 (verbatim extraction).
 *
 * Dependencies (all runtime globals, lazy-resolved):
 *   State, Config, Utils, DOM, TimeEngine, TrendEngine, ChartEngine, Components,
 *   KPIEngine, AnomalyEngine, AlertEngine, PrincipleCommentaryEngine,
 *   InsightEngine, ExecSummaryEngine, App
 */

const RenderEngine = {
  execAll: () => {
    const k = State.kpi;

    // ── Production Hardening: per-section render isolation ─────────────────────
    // Each renderer runs in its own try/catch. A crash in one section leaves the
    // rest of the dashboard intact. Errors are recorded in SCTHealth.errors.
    const _safeRender = (name, fn) => {
      try { fn(); }
      catch (err) {
        console.error('[RenderEngine] ' + name + ' failed:', String(err));
        if (window.SCTHealth) SCTHealth.errors.push({ engine: 'RenderEngine.' + name, time: new Date().toISOString(), message: String(err) });
      }
    };

    // Empty-state guard: show "No Data Available" banner when the active filter
    // combination yields no Performance rows. Renderers still run (degrade to 0/—).
    try { RenderEngine.toggleEmptyState(!State.filtered.perf.length); } catch (_) {}
    _safeRender('renderPrincipleExecutiveSummary', () => RenderEngine.renderPrincipleExecutiveSummary(k.principleExec));
    _safeRender('header',                          () => RenderEngine.header(k));
    _safeRender('performance',                     () => RenderEngine.performance(k.perf));
    _safeRender('caMonitoring',                    () => RenderEngine.caMonitoring(k.ca));
    _safeRender('wholesaler',                      () => RenderEngine.wholesaler(k.ws));
    _safeRender('renderITGTimegone',               () => RenderEngine.renderITGTimegone(k));
    _safeRender('renderWholesalerClassPerformance',() => RenderEngine.renderWholesalerClassPerformance(k.wsClass));
    _safeRender('bb4ClassAnalysis',                () => RenderEngine.bb4ClassAnalysis(k));
    // Cross Section — Sprint 22 (additive; after BB4, before MT)
    _safeRender('renderCrossSection',            () => RenderEngine.renderCrossSection(k));
    // MT Analysis — Sprint 18 (additive; after BB4/Wholesaler, before PS Achiever)
    _safeRender('renderMT',                        () => RenderEngine.renderMT(k.mt));
    // MT5 Timegone — Sprint 19A (additive; after renderMT)
    _safeRender('renderMTDecision',               () => RenderEngine.renderMTDecision(k.mt));
    _safeRender('renderMTTimegone',                () => RenderEngine.renderMTTimegone(k.mt));
    _safeRender('psAchiever',                      () => RenderEngine.psAchiever(k.ps));
    _safeRender('priorityAction',                  () => RenderEngine.priorityAction(k));
    _safeRender('executiveSummary',                () => RenderEngine.executiveSummary(k));
    _safeRender('charts',                          () => RenderEngine.charts(k));
    // Anomaly detection strip — runs last (reads complete k)
    _safeRender('AnomalyEngine.render',            () => AnomalyEngine.render(k.anomalies));
    // Section 5 — Executive Decision Center
    _safeRender('Section5View.render',             () => Section5View.render(k));
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

    // ── generateSKUIssueAnalysis(skuIssues) ──
    // Renders top SKU issues for a category in the expandable panel.
    // Priority: biggest negative gap + worst LM decline + zero transaction.
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
   * renderPrincipleExecutiveSummary — Executive Summary Layer renderer.
   * Consumes k.principleExec. Fixed 5-card order (GPPJ, GEN, GBS, MBR, ALL PRINCIPLE).
   * Empty-data & missing-principle safe. No effect on Section 1 or other modules.
   */
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

  /**
   * renderMT — MT Analysis: MT1–MT4 blocks.
   *
   * MT1: Headline KPI cards (total revenue, NKA, MTI, CA)
   * MT2: Channel breakdown table (MTI vs NKA) + combo chart
   * MT3: Sub-Channel Type table + insight
   * MT4: CLASS performance table + combo chart + insight
   *
   * Container: #section-mt (hidden when no data).
   * No modification to any existing DOM element.
   */
  renderMT: (mt) => {
    const wrap = DOM.el('section-mt');
    if (!wrap) return;
    if (!mt || !mt.hasData || !mt.overview) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    const ov  = mt.overview;
    const fmtC = (v) => Utils.fmtCompact(v);
    const fmtG = (v) => v === null || v === undefined ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    const gCls = (v) => v === null || v === undefined ? '' : v >= 0 ? 'text-green' : 'text-red';

    // ── P1-D: MT Status Badge (reuses existing mt-status-badge element) ──
    const upLM = (ov.growVsLM ?? 0) >= 0, upLY = (ov.growVsLY ?? 0) >= 0;
    const mtStatus = upLM && upLY  ? { key: 'growth',   label: 'GROWTH',        icon: '\u{1F7E2}', cls: 'bg-blue'  }
                   : upLM && !upLY ? { key: 'recovery', label: 'RECOVERY',       icon: '\u{1F7E0}', cls: 'bg-amber' }
                   : !upLM && upLY ? { key: 'momentum', label: 'MOMENTUM LOSS',  icon: '\u{1F7E1}', cls: 'bg-amber' }
                   :                 { key: 'critical',  label: 'CRITICAL',       icon: '\u{1F534}', cls: 'bg-red'   };
    DOM.setHtml('mt-status-badge', mtStatus.icon + ' ' + mtStatus.label);
    DOM.setClass('mt-status-badge', 'badge ' + mtStatus.cls);

    // ── P1-E: Executive Summary Card ──
    const execCard = DOM.el('mt-exec-summary');
    if (execCard) {
      execCard.style.display = '';
      // Dynamic border color based on status (P1-D)
      const borderClr = { growth: 'var(--blue-main)', recovery: 'var(--amber-main)', momentum: 'var(--amber-main)', critical: 'var(--red-main)' };
      execCard.style.borderLeftColor = borderClr[mtStatus.key] || 'var(--blue-main)';
      // Status chip
      const chip = DOM.el('mt-exec-status-chip');
      if (chip) {
        chip.textContent = mtStatus.icon + ' ' + mtStatus.label;
        const chipColors = {
          growth:   'background:var(--blue-bg);color:var(--blue-main)',
          recovery: 'background:var(--amber-bg);color:var(--amber-main)',
          momentum: 'background:var(--amber-bg);color:var(--amber-main)',
          critical: 'background:var(--red-bg);color:var(--red-main)'
        };
        chip.style.cssText = (chipColors[mtStatus.key] || '') + ';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px';
      }
      // KPI row
      const tgInfo = (mt.timegone && mt.timegone.hasData && mt.timegone.header)
        ? ' · Timegone: ' + Utils.fmtPct(mt.timegone.header.timeGone) : '';
      const recov = (ov.recoveryPotential && ov.recoveryPotential > 0)
        ? ' · Recovery Opp: <strong>' + fmtC(ov.recoveryPotential) + '</strong>' : '';
      DOM.setHtml('mt-exec-kpi-row',
        '<span style="font-size:12px;color:var(--gray-600)">Revenue TM: <strong>' + fmtC(ov.totalActTM) + '</strong></span>' +
        '<span style="font-size:12px;color:var(--gray-600)">vs LM: <strong class="' + gCls(ov.growVsLM) + '">' + fmtG(ov.growVsLM) + '</strong></span>' +
        '<span style="font-size:12px;color:var(--gray-600)">vs LY: <strong class="' + gCls(ov.growVsLY) + '">' + fmtG(ov.growVsLY) + '</strong></span>' +
        (mt.timegone && mt.timegone.hasData ? '<span style="font-size:12px;color:var(--gray-600)">Timegone: <strong>' + Utils.fmtPct(mt.timegone.header.timeGone) + '</strong></span>' : '') +
        (ov.recoveryPotential > 0 ? '<span style="font-size:12px;color:var(--amber-main)">Recovery Opp: <strong>' + fmtC(ov.recoveryPotential) + '</strong></span>' : '')
      );
      // Narrative (template-based, no AI)
      const recovLine = (ov.recoveryPotential && ov.recoveryPotential > 0 && ov.caChurn && ov.caChurn > 0)
        ? ' Recovery Opportunity senilai <strong>' + fmtC(ov.recoveryPotential) + '</strong> teridentifikasi dari ' + ov.caChurn + ' outlet churn — fokus utama adalah percepatan win-back.'
        : '';
      const tgLine = (mt.timegone && mt.timegone.hasData)
        ? ' Pace vs LM: ' + (mt.timegone.cards || []).map(c => c.hasData ? c.channel + ' ' + (c.status ? c.status.label : '') : '').filter(Boolean).join(', ') + '.'
        : '';
      const narratives = {
        growth:   'Modern Trade berada pada fase <strong>GROWTH</strong>. Pertumbuhan positif baik terhadap LM maupun LY.' + tgLine + recovLine,
        recovery: 'Modern Trade berada pada fase <strong>RECOVERY</strong>. Pertumbuhan sudah positif terhadap LM namun masih tertinggal dibanding LY.' + tgLine + recovLine,
        momentum: 'Modern Trade mengalami <strong>Momentum Loss</strong>. Performa vs LY masih positif namun tren LM mulai melemah — monitoring ketat diperlukan.' + tgLine + recovLine,
        critical: 'Modern Trade dalam kondisi <strong>CRITICAL</strong>. Penurunan terjadi baik terhadap LM maupun LY. Eskalasi dan action plan segera diperlukan.' + tgLine + recovLine
      };
      DOM.setHtml('mt-exec-narrative', narratives[mtStatus.key] || '');
    }

    // ── MT1: Headline KPI Cards ──
    // Card 1: Total MT Revenue
    DOM.setTxt('mt-total-rev', fmtC(ov.totalActTM));
    DOM.setTxt('mt-total-sub',
      'vs LM: ' + fmtG(ov.growVsLM) + ' · vs LY: ' + fmtG(ov.growVsLY));
    const totalGapVsLM = ov.gapVsLM !== null ? ov.gapVsLM : null;
    DOM.setTxt('mt-total-delta',
      totalGapVsLM !== null
        ? (totalGapVsLM >= 0 ? '+' : '') + fmtC(Math.abs(totalGapVsLM)) + ' vs LM'
        : '—');
    DOM.setClass('mt-total-delta', 'kpi-delta ' + gCls(totalGapVsLM));

    // Cards 2 & 3: NKA + MTI channels
    const nka = (mt.byChannel || []).find(c => c.channel === 'NKA');
    const mti = (mt.byChannel || []).find(c => c.channel === 'MTI');
    if (nka) {
      DOM.setTxt('mt-nka-rev',   fmtC(nka.actTM));
      DOM.setTxt('mt-nka-sub',   nka.share.toFixed(1) + '% share · vs LM: ' + fmtG(nka.growVsLM));
      DOM.setTxt('mt-nka-delta', 'vs LY: ' + fmtG(nka.growVsLY));
    }
    if (mti) {
      DOM.setTxt('mt-mti-rev',   fmtC(mti.actTM));
      DOM.setTxt('mt-mti-sub',   mti.share.toFixed(1) + '% share · vs LM: ' + fmtG(mti.growVsLM));
      DOM.setTxt('mt-mti-delta', 'vs LY: ' + fmtG(mti.growVsLY));
    }

    // Card 4: CA Active
    DOM.setTxt('mt-ca-rev', fmtC(ov.totalCAT));
    DOM.setTxt('mt-ca-sub', 'LM: ' + (ov.totalCALM || 0).toLocaleString('id-ID') + ' outlet');
    // F-07 fix: display net outlet change (caT - caLM) so positive = gained = green.
    // State.kpi.mt.caChurn (caLM - caT) is intentionally unchanged — used by insight/recovery.
    const caNetChange = (ov.totalCAT || 0) - (ov.totalCALM || 0);
    DOM.setTxt('mt-ca-delta',
      (caNetChange >= 0 ? '+' : '') + caNetChange.toLocaleString('id-ID') + ' outlet vs LM');
    DOM.setClass('mt-ca-delta', 'kpi-delta ' + (caNetChange >= 0 ? 'text-green' : 'text-red'));
    // P1-C: Surface Recovery Potential (computed in kpiEngine, rendered here for first time)
    const recEl = DOM.el('mt-ca-recovery');
    if (recEl) {
      if (ov.recoveryPotential && ov.recoveryPotential > 0) {
        recEl.textContent = '\u26A0 Recovery Opp: ' + fmtC(ov.recoveryPotential);
        recEl.style.display = '';
      } else {
        recEl.style.display = 'none';
      }
    }

    // ── MT2: Executive Channel Analysis (Sprint 20) ──
    const chRows = mt.byChannel || [];

    // Health Score — render-layer only. Combines 4 dimensions: growth LM (35), growth LY (25),
    // CA retention (10), revenue contribution (30). Max = 100.
    const calcCHHealth = (c) => {
      const gLM = c.growVsLM ?? 0;
      const gLY = c.growVsLY ?? 0;
      const churnRate = c.caLM > 0 ? c.caChurn / c.caLM : 0;
      const sLM  = gLM >= 10 ? 35 : gLM >= 5 ? 28 : gLM >= 0 ? 20 : gLM >= -5 ? 10 : 0;
      const sLY  = gLY >= 10 ? 25 : gLY >= 5 ? 20 : gLY >= 0 ? 15 : gLY >= -5 ? 8  : 0;
      const sCA  = churnRate <= 0 ? 10 : churnRate <= 0.05 ? 8 : churnRate <= 0.1 ? 5 : 2;
      const sCon = Math.min(30, Math.round(c.share * 0.6));
      return Math.min(100, sLM + sLY + sCA + sCon);
    };
    const healthBar = (score) => {
      const pct  = score + '%';
      const col  = score >= 75 ? 'var(--green-main)' : score >= 50 ? 'var(--blue-main)' : score >= 30 ? 'var(--amber-main)' : 'var(--red-main)';
      return '<div style="display:flex;align-items:center;gap:6px">' +
        '<div style="flex:1;height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden">' +
        '<div style="width:' + pct + ';height:6px;background:' + col + ';border-radius:3px"></div></div>' +
        '<span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:' + col + ';min-width:28px">' + score + '</span></div>';
    };

    // Channel badge labels (executive-grade, more specific than status.label)
    const chBadge = (c) => {
      const k = c.status.key;
      return k === 'growth'   ? { label: 'Strong Growth',   cls: 'bg-blue'  }
           : k === 'recovery' ? { label: 'Recovery',        cls: 'bg-amber' }
           : k === 'momentum' ? { label: 'Watch',           cls: 'bg-amber' }
           :                    { label: 'Critical',        cls: 'bg-red'   };
    };

    // ── Executive Channel Cards ──
    const chColors = { NKA: 'blue', MTI: 'green' };
    DOM.setHtml('mt-ch-rank-cards', chRows.map((c, idx) => {
      const score  = calcCHHealth(c);
      const badge  = chBadge(c);
      const caGrow = c.caLM > 0 ? ((c.caT - c.caLM) / c.caLM * 100) : null;
      const col    = chColors[c.channel] || 'navy';
      return '<div class="kpi-card bdr-top-' + col + '" style="padding:16px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">' +
          '<div>' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--gray-500);text-transform:uppercase">Rank #' + (idx + 1) + '</div>' +
            '<div style="font-size:18px;font-weight:800;color:var(--gray-900)">' + c.channel + '</div>' +
          '</div>' +
          '<span class="badge ' + badge.cls + '" style="font-size:10px">' + badge.label + '</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">' +
          '<div><div class="kpi-label" style="font-size:9px">Sales TM</div><div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">' + fmtC(c.actTM) + '</div></div>' +
          '<div><div class="kpi-label" style="font-size:9px">Contribution</div><div style="font-size:16px;font-weight:700;font-family:var(--font-mono)">' + c.share.toFixed(1) + '%</div></div>' +
          '<div><div class="kpi-label" style="font-size:9px">vs LM</div><div style="font-size:14px;font-weight:700;font-family:var(--font-mono)" class="' + gCls(c.growVsLM) + '">' + fmtG(c.growVsLM) + '</div></div>' +
          '<div><div class="kpi-label" style="font-size:9px">vs LY</div><div style="font-size:14px;font-weight:700;font-family:var(--font-mono)" class="' + gCls(c.growVsLY) + '">' + fmtG(c.growVsLY) + '</div></div>' +
          '<div><div class="kpi-label" style="font-size:9px">CA TM</div><div style="font-size:13px;font-weight:600;font-family:var(--font-mono)">' + (c.caT || 0).toLocaleString('id-ID') + '</div></div>' +
          '<div><div class="kpi-label" style="font-size:9px">CA Growth</div><div style="font-size:13px;font-weight:600;font-family:var(--font-mono)" class="' + gCls(caGrow) + '">' + fmtG(caGrow) + '</div></div>' +
        '</div>' +
        '<div class="kpi-label" style="font-size:9px;margin-bottom:4px">Channel Health</div>' +
        healthBar(score) +
      '</div>';
    }).join(''));

    // ── Detailed Ranking Table ──
    const totLMch = chRows.reduce((s, c) => s + (c.lmHK || 0), 0);
    const totLYch = chRows.reduce((s, c) => s + (c.lyHK || 0), 0);
    const totCAT  = chRows.reduce((s, c) => s + (c.caT  || 0), 0);
    const totCALM = chRows.reduce((s, c) => s + (c.caLM || 0), 0);
    const m = 'font-family:var(--font-mono);text-align:right';
    DOM.setHtml('mt-ch-rank-tbl', chRows.map((c, idx) => {
      const score = calcCHHealth(c);
      const caGrow = c.caLM > 0 ? ((c.caT - c.caLM) / c.caLM * 100) : null;
      const badge  = chBadge(c);
      return '<tr>' +
        '<td style="font-weight:700;color:var(--gray-500);width:28px">' + (idx + 1) + '</td>' +
        '<td style="font-weight:800">' + c.channel + '</td>' +
        '<td style="' + m + '">' + fmtC(c.actTM) + '</td>' +
        '<td style="' + m + '">' + c.share.toFixed(1) + '%</td>' +
        '<td style="' + m + '" class="' + gCls(c.growVsLM) + '">' + fmtG(c.growVsLM) + '</td>' +
        '<td style="' + m + '" class="' + gCls(c.growVsLY) + '">' + fmtG(c.growVsLY) + '</td>' +
        '<td style="' + m + '">' + (c.caT || 0).toLocaleString('id-ID') + '</td>' +
        '<td style="' + m + '" class="' + gCls(caGrow) + '">' + fmtG(caGrow) + '</td>' +
        '<td style="min-width:120px">' + healthBar(score) + '</td>' +
        '<td><span class="badge ' + badge.cls + '" style="font-size:10px">' + badge.label + '</span></td>' +
        '</tr>';
    }).join(''));

    const gLMall_ch = Utils.safeDiv(ov.totalActTM - totLMch, totLMch);
    const gLYall_ch = Utils.safeDiv(ov.totalActTM - totLYch, totLYch);
    const caGrowAll = totCALM > 0 ? (totCAT - totCALM) / totCALM * 100 : null;
    DOM.setHtml('mt-ch-rank-tfoot',
      '<tr style="border-top:2px solid var(--gray-300);font-weight:700;background:var(--gray-50)">' +
      '<td></td><td>TOTAL</td>' +
      '<td style="' + m + '">' + fmtC(ov.totalActTM) + '</td>' +
      '<td style="' + m + '">100.0%</td>' +
      '<td style="' + m + '" class="' + gCls(gLMall_ch === null ? null : gLMall_ch * 100) + '">' + fmtG(gLMall_ch === null ? null : gLMall_ch * 100) + '</td>' +
      '<td style="' + m + '" class="' + gCls(gLYall_ch === null ? null : gLYall_ch * 100) + '">' + fmtG(gLYall_ch === null ? null : gLYall_ch * 100) + '</td>' +
      '<td style="' + m + '">' + totCAT.toLocaleString('id-ID') + '</td>' +
      '<td style="' + m + '" class="' + gCls(caGrowAll) + '">' + fmtG(caGrowAll) + '</td>' +
      '<td></td><td></td></tr>');

    // ── MT2 Chart: Combo with data labels ──
    const CH_COLORS = { NKA: '#0F2744', MTI: '#10B981' };
    ChartEngine.create('chart-mt-channel', 'bar', {
      labels: chRows.map(c => c.channel),
      datasets: [
        { label: 'Sales TM',
          data: chRows.map(c => c.actTM),
          backgroundColor: chRows.map(c => CH_COLORS[c.channel] || '#0F2744'),
          borderRadius: 6, yAxisID: 'y', order: 3, barThickness: 50 },
        { label: 'Growth vs LM%',
          data: chRows.map(c => c.growVsLM === null ? null : +c.growVsLM.toFixed(1)),
          type: 'line', borderColor: '#10B981', backgroundColor: 'transparent', fill: false,
          tension: 0, pointRadius: 7, pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff', pointBorderWidth: 2, yAxisID: 'y1', order: 1, spanGaps: true },
        { label: 'Growth vs LY%',
          data: chRows.map(c => c.growVsLY === null ? null : +c.growVsLY.toFixed(1)),
          type: 'line', borderColor: '#F59E0B', backgroundColor: 'transparent', fill: false,
          tension: 0, pointRadius: 7, pointBackgroundColor: '#F59E0B',
          pointBorderColor: '#fff', pointBorderWidth: 2, borderDash: [5,3],
          yAxisID: 'y1', order: 2, spanGaps: true }
      ]
    }, {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.yAxisID === 'y1'
          ? ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y === null ? '\u2014' : (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y + '%')
          : ' ' + ctx.dataset.label + ': ' + Utils.fmtCompact(ctx.parsed.y) } }
      },
      scales: {
        x: { ticks: { font: { size: 12, weight: '800' } }, grid: { display: false } },
        y:  { position: 'left', beginAtZero: true,
              title: { display: true, text: 'Sales TM (Rp)', font: { size: 9 } },
              ticks: { callback: v => Utils.fmtCompact(v), font: { size: 9 } },
              grid: { color: '#F2F2F7' } },
        y1: { position: 'right', title: { display: true, text: 'Growth %', font: { size: 9 } },
              ticks: { callback: v => v + '%', font: { size: 9 } },
              grid: { drawOnChartArea: false } }
      },
      animation: {
        onComplete: function() {
          const chart = this, ctx = chart.ctx;
          ctx.save(); ctx.textAlign = 'center';
          const drawDL = (di, color, baseline, dy, isPct) => {
            ctx.fillStyle = color;
            ctx.textBaseline = baseline;
            ctx.font = (di === 0 ? '700 10px' : '700 9px') + ' "IBM Plex Mono", monospace';
            chart.getDatasetMeta(di).data.forEach((el, idx) => {
              const v = chart.data.datasets[di].data[idx];
              if (v === null || v === undefined) return;
              const txt = isPct ? ((v >= 0 ? '+' : '') + v.toFixed(1) + '%') : Utils.fmtCompact(v);
              ctx.fillText(txt, el.x, el.y + dy);
            });
          };
          drawDL(0, '#0F2744', 'bottom', -6, false);
          drawDL(1, '#059669', 'bottom', -9, true);
          drawDL(2, '#D97706', 'top',    +9, true);
          ctx.restore();
        }
      }
    });

    // ── MT2 Executive Insight (4 bullets) ──
    const ins2 = mt.insight || {};
    const itemI = (icon, tone, html) =>
      '<div class="insight-item"><span class="insight-icon">' + icon + '</span>' +
      '<span class="insight-text ' + tone + '">' + html + '</span></div>';
    const bI = (t) => '<strong>' + t + '</strong>';
    const ch2rows = [];

    // 1. Largest Contributor
    const largest = chRows[0] || null;
    if (largest)
      ch2rows.push(itemI('\u{1F3C6}', 'neutral',
        'Largest Contributor: ' + bI(largest.channel) + ' — ' + bI(fmtC(largest.actTM)) +
        ' (' + bI(largest.share.toFixed(1) + '%') + ' share).'));

    // 2. Fastest Growing vs LM
    const chWithLM = chRows.filter(c => c.growVsLM !== null);
    const fastest  = chWithLM.length ? chWithLM.reduce((m, c) => c.growVsLM > m.growVsLM ? c : m) : null;
    if (fastest && (fastest.growVsLM ?? 0) > 0)
      ch2rows.push(itemI('\u{1F4C8}', 'positive',
        'Fastest Growing: ' + bI(fastest.channel) + ' — ' + bI(fmtG(fastest.growVsLM)) + ' vs LM.'));
    else if (fastest)
      ch2rows.push(itemI('\u{1F4C9}', 'negative',
        'Best LM Performance: ' + bI(fastest.channel) + ' at ' + bI(fmtG(fastest.growVsLM)) + ' vs LM — semua channel dalam tren penurunan.'));

    // 3. Weakest Channel
    const weakest = chWithLM.length ? chWithLM.reduce((m, c) => c.growVsLM < m.growVsLM ? c : m) : null;
    if (weakest && weakest !== fastest)
      ch2rows.push(itemI('\u26A0', (weakest.growVsLM ?? 0) < 0 ? 'negative' : 'neutral',
        'Weakest Channel: ' + bI(weakest.channel) + ' — ' + bI(fmtG(weakest.growVsLM)) + ' vs LM · ' +
        bI(fmtG(weakest.growVsLY)) + ' vs LY.'));

    // 4. Highest CA Decline
    const chWithChurn = chRows.filter(c => c.caLM > 0);
    const highestChurn = chWithChurn.length
      ? chWithChurn.reduce((m, c) => (c.caChurn / c.caLM) > (m.caChurn / m.caLM) ? c : m)
      : null;
    if (highestChurn && highestChurn.caChurn > 0) {
      const churnPct = (highestChurn.caChurn / highestChurn.caLM * 100).toFixed(1);
      ch2rows.push(itemI('\u{1F6A8}', 'negative',
        'Highest CA Churn: ' + bI(highestChurn.channel) + ' — ' +
        bI(highestChurn.caChurn + ' outlet') + ' lost (' + bI(churnPct + '% churn rate') + ').'));
    } else {
      ch2rows.push(itemI('\u2705', 'positive', 'CA Retention: Semua channel MT mempertahankan atau menumbuhkan outlet aktif.'));
    }

    DOM.setHtml('mt-ch-insight', ch2rows.join(''));

    // ── MT2 Executive Recommendations ──
    const recItems = [];
    const itemR = (icon, html) =>
      '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--gray-100)">' +
      '<span style="font-size:16px;line-height:1.2">' + icon + '</span>' +
      '<span style="font-size:12px;color:var(--gray-800);line-height:1.5">' + html + '</span></div>';

    chRows.forEach(c => {
      const k = c.status.key;
      if (k === 'critical')
        recItems.push(itemR('\u{1F6A8}',
          '<strong>Eskalasi ' + c.channel + ':</strong> Double down on outlet coverage dan frekuensi order — channel dalam kondisi Critical (LM ' + fmtG(c.growVsLM) + ', LY ' + fmtG(c.growVsLY) + ').'));
      else if (k === 'momentum')
        recItems.push(itemR('\u{1F6E1}',
          '<strong>Protect ' + c.channel + ' Momentum:</strong> Pertumbuhan LY positif namun LM melemah ' + fmtG(c.growVsLM) + ' — prioritaskan retensi program dan distribusi agar tidak berlanjut.'));
      else if (k === 'recovery')
        recItems.push(itemR('\u{1F501}',
          '<strong>Accelerate ' + c.channel + ' Recovery:</strong> Growth LM sudah positif ' + fmtG(c.growVsLM) + ' — percepat momentum untuk menutup gap vs LY ' + fmtG(c.growVsLY) + '.'));
      else
        recItems.push(itemR('\u{1F680}',
          '<strong>Amplify ' + c.channel + ' Momentum:</strong> Growth solid (' + fmtG(c.growVsLM) + ' vs LM · ' + fmtG(c.growVsLY) + ' vs LY) — alokasikan additional budget untuk mempercepat pertumbuhan.'));
    });

    if (highestChurn && highestChurn.caChurn > 0)
      recItems.push(itemR('\u{1F3AF}',
        '<strong>Recover CA Loss ' + highestChurn.channel + ':</strong> ' + highestChurn.caChurn + ' outlet churn. Jalankan program win-back: kunjungan sales, insentif aktivasi, monitoring mingguan per depo.'));

    if (recItems.length)
      DOM.setHtml('mt-ch-recommendation',
        '<div class="kpi-label" style="margin-bottom:6px">\u{1F4CB} Executive Recommendations — MT Channel</div>' +
        recItems.join(''));
    else
      DOM.setHtml('mt-ch-recommendation', '');

    // ── MT3: Sub-Channel Type Table ──
    const typeRows = mt.byType || [];
    DOM.setHtml('mt-type-tbl', typeRows.map(t => '<tr>' +
      '<td style="font-weight:600">' + t.label + '</td>' +
      '<td style="font-size:10px;color:var(--gray-600)">' + (t.channels || []).join(' / ') + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">' + fmtC(t.actTM) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">' + t.share.toFixed(1) + '%</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(t.growVsLM) + '">' + fmtG(t.growVsLM) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(t.growVsLY) + '">' + fmtG(t.growVsLY) + '</td>' +
      '<td><span class="badge ' + t.status.badge + '">' + t.status.icon + ' ' + t.status.label + '</span></td>' +
      '</tr>').join(''));

    // MT3 Insight
    const ins3 = mt.insight || {};
    const item = (icon, tone, html) =>
      '<div class="insight-item"><span class="insight-icon">' + icon + '</span>' +
      '<span class="insight-text ' + tone + '">' + html + '</span></div>';
    const b = (t) => '<strong>' + t + '</strong>';
    const type3rows = [];
    if (ins3.fastestGrowingLY)
      type3rows.push(item('\u{1F4C8}', 'positive',
        'Fastest Growth vs LY: ' + b(ins3.fastestGrowingLY.label) + ' ' + b(fmtG(ins3.fastestGrowingLY.growVsLY)) + ' year-on-year.'));
    if (ins3.fastestGrowingLM)
      type3rows.push(item('\u{1F4C5}', 'positive',
        'Fastest Growth vs LM: ' + b(ins3.fastestGrowingLM.label) + ' ' + b(fmtG(ins3.fastestGrowingLM.growVsLM)) + ' month-on-month.'));
    if (ins3.biggestDecliner)
      type3rows.push(item('\u{1F53B}', 'negative',
        'Critical: ' + b(ins3.biggestDecliner.label) +
        ' (LM ' + fmtG(ins3.biggestDecliner.growVsLM) +
        ' · LY ' + fmtG(ins3.biggestDecliner.growVsLY) + ') — ' +
        (ins3.biggestDecliner.share || 0).toFixed(1) + '% share.'));
    if (mt.concentration && mt.concentration.isConcentrated)
      type3rows.push(item('\u26A0', 'warning',
        'Concentration: ' + b(mt.concentration.topSubChannel) + ' menyumbang ' +
        b(mt.concentration.topSubChannelShare.toFixed(1) + '%') + ' dari total MT.'));
    DOM.setHtml('mt-type-insight', type3rows.join(''));

    // ── MT4: CLASS Performance Table + Chart ──
    const CLS_NAMES = { SPRBIG: 'Super Big', BIG: 'Big', MEDIUM: 'Medium', SMALL: 'Small' };
    const clsLabel  = (k) => CLS_NAMES[k] ? CLS_NAMES[k] + ' <span style="font-size:9px;font-weight:400;color:var(--gray-500)">(' + k + ')</span>' : k;
    const clsRows = mt.byClass || [];
    DOM.setHtml('mt-class-tbl', clsRows.map(c => '<tr>' +
      '<td style="font-weight:700">' + clsLabel(c.cls) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">' + fmtC(c.actTM) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">' + c.share.toFixed(1) + '%</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(c.growVsLM) + '">' + fmtG(c.growVsLM) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(c.growVsLY) + '">' + fmtG(c.growVsLY) + '</td>' +
      '<td><span class="badge ' + c.status.badge + '">' + c.status.icon + ' ' + c.status.label + '</span></td>' +
      '</tr>').join(''));

    const totLMcls = clsRows.reduce((s, c) => s + (c.lmHK || 0), 0);
    const totLYcls = clsRows.reduce((s, c) => s + (c.lyHK || 0), 0);
    const gLMallCls = Utils.safeDiv(ov.totalActTM - totLMcls, totLMcls);
    const gLYallCls = Utils.safeDiv(ov.totalActTM - totLYcls, totLYcls);
    DOM.setHtml('mt-class-tfoot',
      '<tr style="border-top:2px solid var(--gray-300);font-weight:700;background:var(--gray-50)">' +
      '<td>TOTAL</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">' + fmtC(ov.totalActTM) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)">100.0%</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(gLMallCls === null ? null : gLMallCls * 100) + '">' + fmtG(gLMallCls === null ? null : gLMallCls * 100) + '</td>' +
      '<td style="text-align:right;font-family:var(--font-mono)" class="' + gCls(gLYallCls === null ? null : gLYallCls * 100) + '">' + fmtG(gLYallCls === null ? null : gLYallCls * 100) + '</td>' +
      '<td></td></tr>');

    // MT4 Chart: mirrors BB5 combo chart exactly (bars = Sales TM, lines = Growth %)
    ChartEngine.create('chart-mt-class', 'bar', {
      labels: clsRows.map(c => CLS_NAMES[c.cls] || c.cls),
      datasets: [
        { label: 'Sales TM', data: clsRows.map(c => c.actTM), backgroundColor: '#0F2744',
          borderRadius: 4, yAxisID: 'y', order: 3, barThickness: 30 },
        { label: 'Growth LM%', data: clsRows.map(c => c.growVsLM === null ? null : +c.growVsLM.toFixed(1)),
          type: 'line', borderColor: '#10B981', backgroundColor: 'transparent', fill: false,
          tension: 0.25, pointRadius: 4, pointBackgroundColor: '#10B981',
          pointBorderColor: '#fff', pointBorderWidth: 2, yAxisID: 'y1', order: 1, spanGaps: true },
        { label: 'Growth LY%', data: clsRows.map(c => c.growVsLY === null ? null : +c.growVsLY.toFixed(1)),
          type: 'line', borderColor: '#F59E0B', backgroundColor: 'transparent', fill: false,
          tension: 0.25, pointRadius: 4, pointBackgroundColor: '#F59E0B',
          pointBorderColor: '#fff', pointBorderWidth: 2, borderDash: [5, 3],
          yAxisID: 'y1', order: 2, spanGaps: true }
      ]
    }, {
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ctx.dataset.yAxisID === 'y1'
          ? ' ' + ctx.dataset.label + ': ' + (ctx.parsed.y === null ? '—' : (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y + '%')
          : ' ' + ctx.dataset.label + ': ' + Utils.fmtCompact(ctx.parsed.y) } }
      },
      scales: {
        x: { ticks: { font: { size: 10, weight: '700' } }, grid: { display: false } },
        y:  { position: 'left', beginAtZero: true,
              title: { display: true, text: 'Sales TM (Rp)', font: { size: 9 } },
              ticks: { callback: v => Utils.fmtCompact(v), font: { size: 9 } },
              grid: { color: '#F2F2F7' } },
        y1: { position: 'right', title: { display: true, text: 'Growth %', font: { size: 9 } },
              ticks: { callback: v => v + '%', font: { size: 9 } },
              grid: { drawOnChartArea: false } }
      },
      animation: {
        onComplete: function() {
          const chart = this, ctx = chart.ctx;
          ctx.save(); ctx.textAlign = 'center';
          const draw = (di, color, baseline, dy, isPct) => {
            ctx.fillStyle = color; ctx.textBaseline = baseline;
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

    // MT4 Insight — CLASS only (P1-A: region data removed)
    const ins4 = mt.insight || {};
    const cls4rows = [];
    // Lead insight: top CLASS by revenue
    const clsRows4 = mt.byClass || [];
    const topCls = clsRows4[0] || null;
    if (topCls)
      cls4rows.push(item('\u{1F3C6}', 'neutral',
        'Largest Class: ' + b(CLS_NAMES[topCls.cls] || topCls.cls) + ' — ' +
        b(fmtC(topCls.actTM)) + ' (' + b(topCls.share.toFixed(1) + '%') + ' share) ' +
        (topCls.growVsLM !== null ? '· vs LM: ' + b(fmtG(topCls.growVsLM)) : '') + '.'));
    // Declining class: worst gLM among classes with data
    const clsWithLM4 = clsRows4.filter(c => c.growVsLM !== null);
    const worstCls = clsWithLM4.length
      ? clsWithLM4.reduce((m, c) => c.growVsLM < m.growVsLM ? c : m)
      : null;
    if (worstCls && (worstCls.growVsLM ?? 0) < 0)
      cls4rows.push(item('\u{1F53B}', 'negative',
        'Declining Class: ' + b(CLS_NAMES[worstCls.cls] || worstCls.cls) + ' ' + b(fmtG(worstCls.growVsLM)) +
        ' vs LM — ' + worstCls.share.toFixed(1) + '% of MT revenue.'));
    // Priority (from kpiEngine critical type/class focus)
    if (ins4.focus)
      cls4rows.push(item('\u{1F3AF}', 'warning',
        'Priority: ' + b(ins4.focus.area) + ' — ' + ins4.focus.reason + '.'));
    // If no insights available, show a neutral message
    if (!cls4rows.length)
      cls4rows.push(item('\u2139', 'neutral', 'Class data insufficient for detailed breakdown.'));
    DOM.setHtml('mt-class-insight', cls4rows.join(''));
  },

  /**
   * renderMTTimegone(mt) — Sprint 19A: MT5 Timegone Analysis.
   *
   * Reads mt.timegone (computed by calcMTTimegone). Reuses all BB2.5 CSS:
   *   .tg-header, .tg-card, .tg-grid, .tg-mini, .tg-hero, .rn-badge, .tg-badge
   *
   * Layout:
   *   mt5-header  — Shared timegone header strip (Timegone%, HK Passed, HK Rem, HK Total)
   *   mt5-cards   — Channel cards (NKA blue, MTI green) — grid-2
   *   mt5-insight — Executive summary (max 4 bullets)
   *
   * Container guard: returns early if mt5-cards not in DOM.
   * Section guard: hides mt5-wrap if no timegone data.
   */
  renderMTTimegone: (mt) => {
    if (!DOM.el('mt5-cards')) return;

    const wrap = DOM.el('mt5-wrap');
    if (!mt || !mt.timegone || !mt.timegone.hasData) {
      if (wrap) wrap.style.display = 'none';
      return;
    }
    if (wrap) wrap.style.display = '';

    const tg = mt.timegone;
    const h  = tg.header;

    // ── Shared Timegone Header ──
    DOM.setHtml('mt5-header',
      `<div class="h-item"><span class="h-k">Timegone</span><span class="h-v">${Utils.fmtPct(h.timeGone)}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Passed</span><span class="h-v">${h.hkPass}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Remaining</span><span class="h-v">${h.hkRem}</span></div>` +
      `<div class="h-item"><span class="h-k">HK Total</span><span class="h-v">${h.hkTot}</span></div>`
    );

    const fmtSigned = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
    const fmtReq    = (c) => c.reqDailySales === null ? '\u2014'
      : Utils.fmtCompact(c.reqDailySales) + '/HK';

    // ── Channel Cards ──
    DOM.setHtml('mt5-cards', tg.cards.map(c => {
      if (!c.hasData) {
        return `<div class="kpi-card bdr-top-${c.color} tg-card">
          <div class="tg-head"><span class="tg-name">${c.channel}</span></div>
          <div class="tg-mini"><span class="tg-mini-l">LM data tidak tersedia untuk channel ini.</span></div>
        </div>`;
      }
      const gapCls   = c.gapVsTG >= 0 ? 'pos' : 'neg';
      const projCls  = c.proj === null ? 'mut' : c.proj >= 100 ? 'pos' : c.proj >= 90 ? '' : 'neg';
      const recovTxt = (c.recovNeed === null || c.recovNeed <= 0)
        ? '\u2014' : `+${c.recovNeed.toFixed(1)}%`;
      const recovCls = (c.recovNeed === null || c.recovNeed <= 0) ? 'mut' : 'neg';
      const remainTxt = c.remainGap <= 0
        ? '<span style="color:var(--green-main)">\u2713 LM Surpassed</span>'
        : Utils.fmtCompact(c.remainGap);

      return `<div class="kpi-card bdr-top-${c.color} tg-card">
        <div class="tg-head">
          <span class="tg-name">${c.channel}</span>
          <span class="tg-badge ${c.status.cls}">${c.status.icon} ${c.status.label}</span>
        </div>
        <div class="tg-grid">
          <div class="tg-mini tg-hero">
            <div class="tg-mini-v">${Utils.fmtPct(c.ach)}</div>
            <div class="tg-mini-l">vs LM Pace</div>
            <div class="tg-mini-s">Ref LM: ${Utils.fmtCompact(c.ref)}</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${gapCls}">${fmtSigned(c.gapVsTG)}</div>
            <div class="tg-mini-l">Gap vs Timegone</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v">${remainTxt}</div>
            <div class="tg-mini-l">To Match LM</div>
            <div class="tg-mini-s">${c.remainGap > 0 ? '\u2248\u00a0' + fmtReq(c) : ''}</div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${recovCls}">${recovTxt}</div>
            <div class="tg-mini-l">Recovery Need</div>
            <div class="tg-mini-s"><span class="rn-badge ${c.recovInterp.cls}">${c.recovInterp.label}</span></div>
          </div>
          <div class="tg-mini">
            <div class="tg-mini-v ${projCls}">${c.proj === null ? '\u2014' : Utils.fmtPct(c.proj)}</div>
            <div class="tg-mini-l">Projected ME vs LM</div>
          </div>
        </div>
      </div>`;
    }).join(''));

    // ── Executive Summary — max 4 bullets ──
    const ins = tg.insight;
    const bullets = [];
    if (ins.worstGap)
      bullets.push(`Worst gap vs timegone: <strong>${ins.worstGap.channel}</strong> (${fmtSigned(ins.worstGap.gapVsTG)}pp vs timegone).`);
    if (ins.highRecov)
      bullets.push(`Highest recovery need: <strong>${ins.highRecov.channel}</strong> (+${ins.highRecov.recovNeed.toFixed(1)}% pace uplift \u2014 ${ins.highRecov.recovInterp.label}).`);
    else
      bullets.push('Semua channel MT on pace atau di atas last month.');
    if (ins.bestProj && ins.bestProj.proj !== null)
      bullets.push(`Best projected finish: <strong>${ins.bestProj.channel}</strong> (${Utils.fmtPct(ins.bestProj.proj)} vs LM).`);
    if (ins.bestChannel)
      bullets.push(`Best performing channel: <strong>${ins.bestChannel.channel}</strong> \u2014 ${Utils.fmtPct(ins.bestChannel.ach)} vs LM achievement.`);

    DOM.setHtml('mt5-insight',
      `<div class="kpi-label">\u{1F9ED} Executive Insight \u2014 MT Timegone</div>` +
      `<ul>${bullets.slice(0, 4).map(b => `<li>${b}</li>`).join('')}</ul>`);
  },



  /**
   * renderCrossSection(k) — Sprint 22: Dashboard Harmonization.
   * Reads State.kpi (all sections) and renders unified Executive cross-view
   * above the Wholesaler section. Pure render layer — no new KPIs.
   */
  renderCrossSection: (k) => {
    const wrap = DOM.el('cross-section-wrap');
    if (!wrap) return;

    // Guard — need at least perf + one of (ws or mt)
    const perf = k.perf || {};
    const ws   = k.ws   || {};
    const mt   = k.mt   || {};
    const ps   = k.ps   || {};
    const ca   = k.ca   || {};

    const hasWS = !!(ws.allAct > 0);
    const hasMT = !!(mt.hasData && mt.overview);
    const hasPS = !!(ps.hasData);
    const hasAny = hasWS || hasMT || hasPS;

    if (!hasAny) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    // ── Shared helpers ──
    const fmtC = (v) => Utils.fmtCompact(v);
    const fmtG = (v) => (v === null || v === undefined) ? '—'
                       : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    const fmtP = (v) => (v === null || v === undefined) ? '—' : v.toFixed(1) + '%';

    const gClr = (v) => (v === null || v === undefined) ? 'var(--gray-700)'
                       : v >= 0 ? 'var(--green-main)' : 'var(--red-main)';

    const mkChip = (text, cls) =>
      '<span class="badge ' + cls + '" style="font-size:10px">' + text + '</span>';

    const mkKV = (label, val, col) =>
      '<div>' +
      '<div style="font-size:9px;color:var(--gray-500);text-transform:uppercase;letter-spacing:.06em">' + label + '</div>' +
      '<div style="font-size:13px;font-weight:700;color:' + (col || 'var(--gray-900)') + '">' + val + '</div>' +
      '</div>';

    // ── 1. Derived aggregates ──
    const wsRev  = ws.allAct  || 0;
    const mtRev  = hasMT ? (mt.overview.totalActTM || 0) : 0;
    const totalRev = wsRev + mtRev;

    const wsGrLM = ws.allGwth  ?? null;
    const mtGrLM = hasMT ? (mt.overview.growVsLM ?? null) : null;
    const wsGrLY = ws.allGwthLY ?? null;
    const mtGrLY = hasMT ? (mt.overview.growVsLY ?? null) : null;

    const wsCA   = ws.allAct && ca.tot ? ca.byCh?.find(c => c.name === 'Wholesaler')?.ca ?? ca.tot : (ca.tot || 0);
    const mtCA   = hasMT ? (mt.overview.totalCAT || 0) : 0;

    const wsRecov = 0; // WS doesn't surface recoveryPotential directly
    const mtRecov = hasMT ? (mt.overview.recoveryPotential || 0) : 0;

    // Timegone achievement (unified label)
    const tgPct   = perf.timeGone ?? null;
    const wsAch   = ws.allAch  || 0;
    const perfAch = perf.ach   || 0;

    // ── 2. Overall Business Status ──
    const overallUp = ((wsGrLM ?? 0) + (mtGrLM ?? 0)) / (hasWS && hasMT ? 2 : 1) >= 0;
    const overallStatus = overallUp ? 'GROWING' : 'DECLINING';
    const overallCls    = overallUp ? 'bg-blue'  : 'bg-red';

    // ── 3. Biggest Revenue Driver ──
    const biggestDriver = wsRev >= mtRev ? 'Wholesaler' : 'Modern Trade';
    const biggestRev    = Math.max(wsRev, mtRev);
    const biggestShare  = totalRev > 0 ? (biggestRev / totalRev * 100).toFixed(1) : '—';

    // ── 4. Biggest Risk ──
    const riskItems = [];
    // WS region risk
    if (ws.regAll && ws.regAll.length) {
      const worstWS = ws.regAll[0]; // sorted ach asc = worst first
      if (worstWS && worstWS.ach < 100) {
        riskItems.push({ label: 'WS ' + worstWS.reg, score: 100 - worstWS.ach, detail: 'Ach ' + fmtP(worstWS.ach) });
      }
    }
    // MT channel risk
    if (hasMT && mt.byChannel) {
      const critMT = mt.byChannel.filter(c => c.status && c.status.key === 'critical');
      critMT.forEach(c => {
        riskItems.push({ label: 'MT ' + c.channel, score: Math.abs(c.growVsLM ?? 0) + c.share, detail: fmtG(c.growVsLM) + ' vs LM' });
      });
      const momentumMT = mt.byChannel.filter(c => c.status && c.status.key === 'momentum');
      momentumMT.forEach(c => {
        riskItems.push({ label: 'MT ' + c.channel, score: Math.abs(c.growVsLM ?? 0), detail: fmtG(c.growVsLM) + ' LM, momentum loss' });
      });
    }
    // PS risk
    if (hasPS && ps.soAch < 90) {
      riskItems.push({ label: 'PS Sell Out', score: 90 - ps.soAch, detail: 'Ach ' + fmtP(ps.soAch) });
    }
    riskItems.sort((a, b) => b.score - a.score);
    const topRisk = riskItems[0] || null;

    // ── 5. Highest Opportunity ──
    const oppItems = [];
    if (mtRecov > 0) oppItems.push({ label: 'MT CA Recovery', value: mtRecov, detail: (mt.overview.caChurn || 0) + ' outlet churn' });
    if (ws.allGapLM < 0) oppItems.push({ label: 'WS Revenue Gap', value: Math.abs(ws.allGapLM || 0), detail: 'Gap vs LM: ' + fmtC(Math.abs(ws.allGapLM || 0)) });
    if (hasPS && ps.sia < ps.sit) oppItems.push({ label: 'PS Sell In Gap', value: ps.sit - ps.sia, detail: 'Selisih vs target' });
    oppItems.sort((a, b) => b.value - a.value);
    const topOpp = oppItems[0] || null;

    // ── 6. Immediate Action (from worst risk + opportunity) ──
    const immediateAction = topRisk
      ? 'Fokus pada ' + topRisk.label + ' (' + topRisk.detail + ') — prioritas eskalasi segera.'
      : 'Pertahankan momentum — review run rate seluruh channel.';

    // ── 7. Executive Score per section (same formula as Sprint 21) ──
    const calcExecScore = (grLM, grLY, caChurnR, achVsTG) => {
      const s1 = (grLM ?? 0) >= 10 ? 35 : (grLM ?? 0) >= 5 ? 28 : (grLM ?? 0) >= 0 ? 20 : (grLM ?? 0) >= -5 ? 10 : 0;
      const s2 = (grLY ?? 0) >= 10 ? 25 : (grLY ?? 0) >= 5 ? 20 : (grLY ?? 0) >= 0 ? 14 : (grLY ?? 0) >= -5 ? 7  : 0;
      const s3 = caChurnR <= 0 ? 20 : caChurnR <= 0.05 ? 16 : caChurnR <= 0.1 ? 12 : caChurnR <= 0.2 ? 8 : 4;
      const s4 = achVsTG >= 5 ? 20 : achVsTG >= -5 ? 15 : achVsTG >= -15 ? 8 : 4;
      return Math.min(100, s1 + s2 + s3 + s4);
    };

    const wsTGDiff  = tgPct !== null ? wsAch - tgPct : 0;
    const mtTGDiff  = tgPct !== null && mt.timegone && mt.timegone.cards
      ? (mt.timegone.cards.filter(c => c.hasData).reduce((s, c) => s + c.ach, 0) / (mt.timegone.cards.filter(c => c.hasData).length || 1)) - tgPct
      : 0;
    const wsCAChurnR = ca.tot > 0 ? (ca.zero || 0) / ca.tot : 0;
    const mtCAChurnR = (hasMT && mt.overview.totalCALM > 0) ? (mt.overview.caChurn || 0) / mt.overview.totalCALM : 0;

    const wsScore = hasWS ? calcExecScore(wsGrLM, wsGrLY, wsCAChurnR, wsTGDiff) : null;
    const mtScore = hasMT ? calcExecScore(mtGrLM, mtGrLY, mtCAChurnR, mtTGDiff) : null;

    const scoreBar = (score, col) => score === null ? '—' :
      '<div style="display:flex;align-items:center;gap:6px">' +
      '<div style="flex:1;height:6px;background:var(--gray-100);border-radius:3px;overflow:hidden">' +
      '<div style="height:6px;width:' + score + '%;background:' + col + ';border-radius:3px"></div></div>' +
      '<span style="font-size:12px;font-weight:700;color:' + col + ';min-width:28px">' + score + '</span>' +
      '</div>';

    const scoreColor = (s) => s >= 70 ? 'var(--green-main)' : s >= 50 ? 'var(--blue-main)' : s >= 30 ? 'var(--amber-main)' : 'var(--red-main)';

    // ── RENDER ──

    // (A) Cross Exec Summary — 5 points
    DOM.setHtml('cross-exec-summary',
      '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">' +
      // 1. Overall Status
      '<div style="background:var(--gray-50);border-radius:6px;padding:10px;border:1px solid var(--border-color)">' +
        '<div style="font-size:9px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Overall Status</div>' +
        '<div>' + mkChip(overallUp ? '🟢 ' + overallStatus : '🔴 ' + overallStatus, overallCls) + '</div>' +
        '<div style="font-size:11px;color:var(--gray-600);margin-top:6px">Rev: <strong>' + fmtC(totalRev) + '</strong></div>' +
      '</div>' +
      // 2. Revenue Driver
      '<div style="background:var(--gray-50);border-radius:6px;padding:10px;border:1px solid var(--border-color)">' +
        '<div style="font-size:9px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Biggest Driver</div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--blue-main)">' + biggestDriver + '</div>' +
        '<div style="font-size:11px;color:var(--gray-600);margin-top:4px">' + fmtC(biggestRev) + ' · ' + biggestShare + '% share</div>' +
      '</div>' +
      // 3. Biggest Risk
      '<div style="background:var(--red-bg);border-radius:6px;padding:10px;border:1px solid var(--red-bdr)">' +
        '<div style="font-size:9px;font-weight:700;color:var(--red-main);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Biggest Risk</div>' +
        '<div style="font-size:12px;font-weight:700;color:var(--gray-900)">' + (topRisk ? topRisk.label : '—') + '</div>' +
        '<div style="font-size:11px;color:var(--gray-600);margin-top:4px">' + (topRisk ? topRisk.detail : 'Tidak ada risiko signifikan') + '</div>' +
      '</div>' +
      // 4. Highest Opportunity
      '<div style="background:var(--green-bg);border-radius:6px;padding:10px;border:1px solid var(--green-bdr)">' +
        '<div style="font-size:9px;font-weight:700;color:var(--green-main);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Highest Opportunity</div>' +
        '<div style="font-size:12px;font-weight:700;color:var(--gray-900)">' + (topOpp ? topOpp.label : '—') + '</div>' +
        '<div style="font-size:11px;color:var(--gray-600);margin-top:4px">' + (topOpp ? fmtC(topOpp.value) : '—') + '</div>' +
      '</div>' +
      // 5. Immediate Action
      '<div style="background:var(--amber-bg);border-radius:6px;padding:10px;border:1px solid var(--amber-bdr)">' +
        '<div style="font-size:9px;font-weight:700;color:var(--amber-main);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Immediate Action</div>' +
        '<div style="font-size:11px;color:var(--gray-800);line-height:1.4">' + immediateAction + '</div>' +
      '</div>' +
      '</div>'
    );

    // (B) Cross KPI Highlight — WS vs MT
    const tgLabel = tgPct !== null ? fmtP(tgPct) + ' elapsed' : 'N/A';
    const mkSectionKPI = (title, rows) =>
      '<div style="margin-bottom:0">' +
      '<div style="font-size:10px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--border-color)">' + title + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' +
      rows.map(([label, val, col]) => mkKV(label, val, col)).join('') +
      '</div>' +
      '</div>';

    const wsRows = [
      ['Revenue TM',    hasWS ? fmtC(wsRev) : '—',         'var(--gray-900)'],
      ['Growth vs LM',  fmtG(wsGrLM),                       gClr(wsGrLM)],
      ['Growth vs LY',  fmtG(wsGrLY),                       gClr(wsGrLY)],
      ['CA Active',     hasWS ? (ws.allActv || 0) + ' depo' : '—', 'var(--gray-900)'],
      ['Timegone',      tgLabel,                              'var(--gray-700)'],
      ['Exec Score',    wsScore !== null ? scoreBar(wsScore, scoreColor(wsScore)) : '—', null],
    ];
    const mtRows = [
      ['Revenue TM',    hasMT ? fmtC(mtRev) : '—',          'var(--gray-900)'],
      ['Growth vs LM',  fmtG(mtGrLM),                        gClr(mtGrLM)],
      ['Growth vs LY',  fmtG(mtGrLY),                        gClr(mtGrLY)],
      ['CA Active',     hasMT ? (mt.overview.totalCAT || 0) + ' outlet' : '—', 'var(--gray-900)'],
      ['Recovery Opp',  hasMT && mtRecov > 0 ? fmtC(mtRecov) : '—', 'var(--amber-main)'],
      ['Exec Score',    mtScore !== null ? scoreBar(mtScore, scoreColor(mtScore)) : '—', null],
    ];

    const crossKpiEl = DOM.el('cross-kpi-highlight');
    if (crossKpiEl) crossKpiEl.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      '<div class="kpi-card" style="padding:14px 16px;border-left:4px solid var(--amber-main)">' +
        mkSectionKPI('🏭 Wholesaler', wsRows) +
      '</div>' +
      '<div class="kpi-card" style="padding:14px 16px;border-left:4px solid var(--blue-main)">' +
        mkSectionKPI('🏬 Modern Trade', mtRows) +
      '</div>' +
      '</div>';

    // (C) Opportunity Ranking
    oppItems.sort((a, b) => b.value - a.value);
    const oppEl = DOM.el('cross-opportunity-ranking');
    if (oppEl) {
      if (!oppItems.length) {
        oppEl.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:8px">Tidak ada opportunity teridentifikasi saat ini.</div>';
      } else {
        oppEl.innerHTML = oppItems.slice(0, 5).map((o, i) => {
          const barW  = Math.min(100, (o.value / oppItems[0].value) * 100).toFixed(0);
          const col   = i === 0 ? 'var(--green-main)' : i === 1 ? 'var(--blue-main)' : 'var(--amber-main)';
          return '<div style="margin-bottom:10px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
              '<span style="font-size:11px;font-weight:700;color:var(--gray-900)">' + (i + 1) + '. ' + o.label + '</span>' +
              '<span style="font-size:12px;font-weight:700;color:' + col + '">' + fmtC(o.value) + '</span>' +
            '</div>' +
            '<div style="font-size:10px;color:var(--gray-500);margin-bottom:4px">' + o.detail + '</div>' +
            '<div style="height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden">' +
              '<div style="height:4px;width:' + barW + '%;background:' + col + ';border-radius:2px"></div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    // (D) Unified Risk Ranking
    const riskEl = DOM.el('cross-risk-ranking');
    if (riskEl) {
      if (!riskItems.length) {
        riskEl.innerHTML = '<div style="font-size:12px;color:var(--gray-400);padding:8px">Tidak ada risiko signifikan teridentifikasi.</div>';
      } else {
        riskEl.innerHTML = riskItems.slice(0, 5).map((r, i) => {
          const sev = i === 0 ? 'var(--red-main)' : i <= 1 ? 'var(--amber-main)' : 'var(--blue-main)';
          const sevLabel = i === 0 ? '🔴 CRITICAL' : i <= 1 ? '🟠 HIGH' : '🔵 WATCH';
          return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color)">' +
            '<div style="font-size:16px;font-weight:900;color:' + sev + ';min-width:24px;text-align:center">#' + (i + 1) + '</div>' +
            '<div style="flex:1">' +
              '<div style="font-size:12px;font-weight:700;color:var(--gray-900)">' + r.label + '</div>' +
              '<div style="font-size:10px;color:var(--gray-500)">' + r.detail + '</div>' +
            '</div>' +
            '<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:12px;background:' + sev + ';color:var(--white)">' + sevLabel + '</span>' +
          '</div>';
        }).join('');
      }
    }

    // (E) Executive Recommendation — Top 5 Actions
    const buildRecs = () => {
      const recs = [];
      // From risk items (high priority)
      riskItems.slice(0, 2).forEach((r, i) => {
        recs.push({
          priority: recs.length + 1,
          action: 'Atasi ' + r.label,
          reason: r.detail,
          impact: 'Risk mitigation',
          col: i === 0 ? 'var(--red-main)' : 'var(--amber-main)'
        });
      });
      // From opportunity items
      oppItems.slice(0, 2).forEach(o => {
        recs.push({
          priority: recs.length + 1,
          action: 'Realisasikan ' + o.label,
          reason: o.detail,
          impact: fmtC(o.value),
          col: 'var(--green-main)'
        });
      });
      // PS if underperforming
      if (hasPS && ps.soAch < 90 && recs.length < 5) {
        recs.push({
          priority: recs.length + 1,
          action: 'Dorong PS Sell Out',
          reason: 'Ach ' + fmtP(ps.soAch) + ' — perlu akselerasi sebelum tutup bulan.',
          impact: fmtC(Math.abs(ps.sot - ps.soa)),
          col: 'var(--blue-main)'
        });
      }
      // Fallback sustain action if all green
      if (!recs.length) {
        recs.push({ priority: 1, action: 'Sustain Current Momentum', reason: 'Seluruh channel performa baik.', impact: '—', col: 'var(--green-main)' });
      }
      return recs;
    };

    const recEl = DOM.el('cross-exec-recommendation');
    if (recEl) {
      const recs = buildRecs();
      recEl.innerHTML =
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">' +
        recs.slice(0, 5).map(r =>
          '<div style="border-left:3px solid ' + r.col + ';padding:10px 12px;background:var(--white);border-radius:4px;border:1px solid var(--border-color)">' +
            '<div style="font-size:9px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Action ' + r.priority + '</div>' +
            '<div style="font-size:13px;font-weight:700;color:var(--gray-900);margin-bottom:3px">' + r.action + '</div>' +
            '<div style="font-size:11px;color:var(--gray-600);margin-bottom:6px">' + r.reason + '</div>' +
            '<div style="font-size:11px;color:' + r.col + ';font-weight:600">Impact: ' + r.impact + '</div>' +
          '</div>'
        ).join('') +
        '</div>';
    }
  },

  /**
   * renderMTDecision(mt) — Sprint 21: Executive Decision Layer.
   * Adds Decision Summary, Risk Matrix, Priority Ranking, Recommendation,
   * Executive Action, Impact Estimation, and Confidence above MT section.
   * Pure render layer — no new KPIs.
   */
  renderMTDecision: (mt) => {
    const wrap = DOM.el('mt-decision-wrap');
    if (!wrap) return;
    if (!mt || !mt.hasData) { wrap.style.display = 'none'; return; }
    wrap.style.display = '';

    const ov   = mt.overview;
    const fmtC = (v) => Utils.fmtCompact(v);
    const fmtG = (v) => (v === null || v === undefined) ? '—'
                      : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
    const fmtP = (v) => (v === null || v === undefined) ? '—' : v.toFixed(1) + '%';

    // ── Shared helpers ──
    const mkKpiChip = (label, value) =>
      '<div style="background:var(--gray-50);border:1px solid var(--border-color);border-radius:4px;padding:8px 10px">' +
      '<div style="font-size:9px;color:var(--gray-500);text-transform:uppercase;letter-spacing:.06em">' + label + '</div>' +
      '<div style="font-size:12px;font-weight:700;color:var(--gray-900);margin-top:2px">' + value + '</div>' +
      '</div>';

    const mkScoreGauge = (score, col) => {
      const circ = (score / 100 * 201).toFixed(1);
      return '<div style="position:relative;width:80px;height:80px;margin:0 auto">' +
        '<svg viewBox="0 0 80 80" style="transform:rotate(-90deg);width:80px;height:80px">' +
        '<circle cx="40" cy="40" r="32" fill="none" stroke="var(--gray-100)" stroke-width="8"/>' +
        '<circle cx="40" cy="40" r="32" fill="none" stroke="' + col + '" stroke-width="8" ' +
        'stroke-dasharray="' + circ + ' 201" stroke-linecap="round"/>' +
        '</svg>' +
        '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:20px;font-weight:700;color:' + col + '">' + score + '</div>' +
        '</div>';
    };

    // ── 1. Executive Score (0–100, render-layer only) ──
    const gLM = ov.growVsLM ?? 0;
    const gLY = ov.growVsLY ?? 0;
    const caChurnRate = ov.totalCALM > 0 ? (ov.caChurn || 0) / ov.totalCALM : 0;

    const sLM = gLM >= 10 ? 35 : gLM >= 5 ? 28 : gLM >= 0 ? 20 : gLM >= -5 ? 10 : 0;
    const sLY = gLY >= 10 ? 25 : gLY >= 5 ? 20 : gLY >= 0 ? 14 : gLY >= -5 ? 7  : 0;
    const sCA = caChurnRate <= 0 ? 20 : caChurnRate <= 0.05 ? 16 : caChurnRate <= 0.1 ? 12 : caChurnRate <= 0.2 ? 8 : 4;

    let sTG = 10;
    if (mt.timegone && mt.timegone.hasData && mt.timegone.cards) {
      const valid = mt.timegone.cards.filter(c => c.hasData);
      if (valid.length && mt.timegone.header) {
        const tgPct  = mt.timegone.header.timeGone ?? 0;
        const avgAch = valid.reduce((s, c) => s + c.ach, 0) / valid.length;
        sTG = avgAch >= tgPct + 5 ? 20 : avgAch >= tgPct - 5 ? 15 : avgAch >= tgPct - 15 ? 8 : 4;
      }
    }

    const execScore  = Math.min(100, sLM + sLY + sCA + sTG);
    const scoreColor = execScore >= 70 ? 'var(--green-main)'
                     : execScore >= 50 ? 'var(--blue-main)'
                     : execScore >= 30 ? 'var(--amber-main)'
                     :                   'var(--red-main)';

    // ── 2. Risk Level ──
    const riskLevel = (!( gLM >= 0) && !(gLY >= 0)) || caChurnRate > 0.2 || gLM < -10
      ? { label: 'HIGH RISK',   cls: 'bg-red',   icon: '🔴' }
      : (gLM < 0 || gLY < 0) || caChurnRate > 0.1 || gLM < -5
      ? { label: 'MEDIUM RISK', cls: 'bg-amber', icon: '🟠' }
      : { label: 'LOW RISK',    cls: 'bg-blue',  icon: '🟢' };

    // ── 3. MT Overall Status chip ──
    const upLM = gLM >= 0, upLY = (ov.growVsLY ?? 0) >= 0;
    const mtStatusCls = upLM && upLY ? 'bg-blue' : (!upLM && !upLY) ? 'bg-red' : 'bg-amber';
    const mtStatusTxt = upLM && upLY ? '🟢 GROWTH' : upLM ? '🟠 RECOVERY' : !upLM && upLY ? '🟡 MOMENTUM LOSS' : '🔴 CRITICAL';

    // ── 4. Timegone Status ──
    let tgStatusTxt = 'N/A';
    if (mt.timegone && mt.timegone.hasData && mt.timegone.insight) {
      const wg = mt.timegone.insight.worstGap;
      tgStatusTxt = wg ? wg.channel + ': ' + wg.status.label : 'ON TRACK';
    }

    // ── 5. Decision Confidence ──
    const dataOk = [
      ov.totalActTM > 0,
      ov.growVsLM !== null,
      ov.growVsLY !== null,
      (mt.byChannel || []).length > 0,
      mt.timegone && mt.timegone.hasData,
      ov.totalCALM > 0,
    ].filter(Boolean).length;
    const confidence = dataOk >= 5 ? { label: 'HIGH CONFIDENCE',   cls: 'bg-blue'  }
                     : dataOk >= 3 ? { label: 'MEDIUM CONFIDENCE', cls: 'bg-amber' }
                     :               { label: 'LOW CONFIDENCE',    cls: 'bg-red'   };

    // ── 6. Decision Summary Card (mt-decision-summary) ──
    DOM.setHtml('mt-decision-summary',
      '<div style="display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start">' +
      '<div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' +
          '<span class="badge ' + mtStatusCls + '">' + mtStatusTxt + '</span>' +
          '<span class="badge ' + riskLevel.cls + '">' + riskLevel.icon + ' ' + riskLevel.label + '</span>' +
          '<span class="badge ' + confidence.cls + '">📊 ' + confidence.label + '</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">' +
          mkKpiChip('Timegone Status', tgStatusTxt) +
          mkKpiChip('Recovery Priority', ov.recoveryPotential > 0 ? fmtC(ov.recoveryPotential) : '—') +
          mkKpiChip('CA Churn TM', (ov.caChurn || 0) + ' outlet') +
          mkKpiChip('Avg Rev / CA', ov.avgRevPerCA > 0 ? fmtC(ov.avgRevPerCA) : '—') +
        '</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        mkScoreGauge(execScore, scoreColor) +
        '<div style="font-size:9px;color:var(--gray-500);margin-top:4px;text-transform:uppercase;letter-spacing:.05em">Executive Score</div>' +
      '</div>' +
      '</div>'
    );

    // ── 7. Risk Matrix (mt-risk-matrix) ──
    const tgCardMap = {};
    if (mt.timegone && mt.timegone.cards) {
      mt.timegone.cards.forEach(c => { tgCardMap[c.channel] = c; });
    }

    const quadData = {
      tl: { label: '🔵 Stable',         desc: 'Growing · Behind Pace', bdr: 'var(--blue-bdr)',  bg: 'var(--blue-bg)',  items: [] },
      tr: { label: '🟢 Growth Leader',  desc: 'Growing · On Pace',     bdr: 'var(--green-bdr)', bg: 'var(--green-bg)', items: [] },
      bl: { label: '🔴 Critical',       desc: 'Declining · Behind',    bdr: 'var(--red-bdr)',   bg: 'var(--red-bg)',   items: [] },
      br: { label: '🟠 Recovery',       desc: 'On Pace · Declining',   bdr: 'var(--amber-bdr)', bg: 'var(--amber-bg)', items: [] },
    };
    (mt.byChannel || []).forEach(c => {
      const tgCard = tgCardMap[c.channel];
      const tgGap  = (tgCard && tgCard.hasData) ? tgCard.gapVsTG : 0;
      const grow   = c.growVsLM ?? 0;
      const q = grow >= 0 && tgGap >= 0 ? 'tr'
              : grow >= 0 && tgGap <  0 ? 'tl'
              : grow <  0 && tgGap >= 0 ? 'br'
              :                            'bl';
      quadData[q].items.push({ name: c.channel, grow, tgGap });
    });

    const mkQuad = (q) => {
      const d = quadData[q];
      const chips = d.items.map(it =>
        '<span style="display:inline-block;background:' + d.bdr + ';color:var(--white);font-size:10px;font-weight:700;padding:2px 8px;border-radius:12px;margin:2px 2px 0 0">' +
        it.name + ' ' + fmtG(it.grow) + '</span>'
      ).join('');
      return '<div style="background:' + d.bg + ';border:1px solid ' + d.bdr + ';border-radius:6px;padding:10px;min-height:88px">' +
        '<div style="font-size:11px;font-weight:700;color:var(--gray-900)">' + d.label + '</div>' +
        '<div style="font-size:9px;color:var(--gray-600);margin-bottom:6px">' + d.desc + '</div>' +
        (chips || '<span style="font-size:10px;color:var(--gray-300)">No channels</span>') +
        '</div>';
    };

    const matrixEl = DOM.el('mt-risk-matrix');
    if (matrixEl) matrixEl.innerHTML =
      '<div style="display:grid;grid-template-columns:auto 1fr 1fr;grid-template-rows:auto 1fr 1fr;gap:4px">' +
      '<div style="grid-area:1/1/4/2;display:flex;align-items:center;justify-content:center">' +
        '<div style="writing-mode:vertical-rl;transform:rotate(180deg);font-size:9px;color:var(--gray-500);white-space:nowrap">↑ Growth vs LM</div>' +
      '</div>' +
      '<div style="grid-area:1/2/2/4;text-align:center;font-size:9px;color:var(--gray-500);padding:0 0 4px">Timegone Gap →</div>' +
      '<div style="grid-area:2/2">' + mkQuad('tl') + '</div>' +
      '<div style="grid-area:2/3">' + mkQuad('tr') + '</div>' +
      '<div style="grid-area:3/2">' + mkQuad('bl') + '</div>' +
      '<div style="grid-area:3/3">' + mkQuad('br') + '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:4px">' +
      '<span style="font-size:9px;color:var(--gray-400)">← Behind Pace</span>' +
      '<span style="font-size:9px;color:var(--gray-400)">Ahead of Pace →</span>' +
      '</div>';

    // ── 8. Priority Ranking (mt-priority-cards) ──
    const ranked = (mt.byChannel || []).map(c => {
      const tgCard  = tgCardMap[c.channel];
      const tgGap   = (tgCard && tgCard.hasData) ? tgCard.gapVsTG : 0;
      const churnR  = c.caLM > 0 ? c.caChurn / c.caLM : 0;
      const score   = (c.share * 0.3) - (c.growVsLM ?? 0) * 0.5 + churnR * 30 - tgGap * 0.3;
      return { ...c, tgGap, churnR, _ps: score };
    }).sort((a, b) => b._ps - a._ps);

    const actionWord = (c) =>
      c.status.key === 'critical'  ? 'Recover'
      : c.status.key === 'momentum' ? 'Protect'
      : c.status.key === 'recovery' ? 'Accelerate'
      : 'Sustain';

    const genReason = (c) =>
      c.status.key === 'critical'  ? 'Revenue & momentum keduanya turun — eskalasi segera diperlukan.'
      : c.status.key === 'momentum' ? 'Growth mulai melemah vs LM — intervensi sebelum menjadi critical.'
      : c.status.key === 'recovery' ? 'Positif vs LY namun LM melemah — jaga execution pace.'
      : 'Performa kuat — pertahankan eksekusi & program aktivasi.';

    const pBdr = (c) =>
      c.status.key === 'critical'  ? 'var(--red-main)'
      : c.status.key === 'momentum' ? 'var(--amber-main)'
      : c.status.key === 'recovery' ? 'var(--blue-main)'
      : 'var(--green-main)';

    DOM.setHtml('mt-priority-cards',
      ranked.slice(0, 4).map((c, i) => {
        const impact = (c.caChurn > 0 && ov.avgRevPerCA > 0)
          ? '<div style="font-size:11px;color:var(--green-main);font-weight:600;margin-top:4px">💰 Est. Recovery: ' + fmtC(c.caChurn * ov.avgRevPerCA) + '</div>' : '';
        return '<div style="border-left:3px solid ' + pBdr(c) + ';padding:8px 12px;background:var(--white);border-radius:4px;border:1px solid var(--border-color)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
            '<span style="font-size:9px;font-weight:700;color:var(--gray-500);text-transform:uppercase;letter-spacing:.08em">Priority ' + (i + 1) + '</span>' +
            '<span style="font-size:11px;font-weight:700;color:' + (c.growVsLM >= 0 ? 'var(--green-main)' : 'var(--red-main)') + '">' + fmtG(c.growVsLM) + '</span>' +
          '</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--gray-900);margin-bottom:2px">' + actionWord(c) + ' <span style="color:var(--blue-main)">' + c.channel + '</span></div>' +
          '<div style="font-size:11px;color:var(--gray-600)">' + genReason(c) + '</div>' +
          impact +
        '</div>';
      }).join('')
    );

    // ── 9. Executive Action (mt-exec-action-content) ──
    const worst = ranked[0];
    const best  = ranked[ranked.length - 1];
    const hasTG = mt.timegone && mt.timegone.hasData;

    const actionItems = {
      immediate: [
        worst ? (worst.status.key === 'critical'
          ? 'Eskalasi ' + worst.channel + ' ke Sales Head — declining ' + fmtG(worst.growVsLM) + ' vs LM.'
          : 'Monitor ' + worst.channel + ' (' + worst.status.label + ') — siapkan action plan.')
          : null,
        (ov.caChurn > 0)
          ? 'Aktifkan win-back program untuk ' + ov.caChurn + ' outlet churn TM ini.' : null,
        (hasTG && mt.timegone.insight && mt.timegone.insight.worstGap)
          ? 'Push daily sales ' + mt.timegone.insight.worstGap.channel + ' — timegone ' + mt.timegone.insight.worstGap.status.label + '.' : null,
      ].filter(Boolean).slice(0, 3),
      thisWeek: [
        ranked.length >= 2 ? 'Review program aktivasi ' + ranked[0].channel + ' & ' + ranked[1].channel + '.' : null,
        ov.recoveryPotential > 0 ? 'Identifikasi top ' + Math.min(ov.caChurn, 20) + ' outlet churn untuk win-back prioritas.' : null,
        best ? 'Replikasi best practice ' + best.channel + ' (' + fmtG(best.growVsLM) + ' LM) ke channel lain.' : null,
      ].filter(Boolean).slice(0, 3),
      thisMonth: [
        'Review kontribusi sub-channel & optimalkan alokasi resources.',
        (mt.concentration && mt.concentration.isConcentrated)
          ? 'Diversifikasi dari ' + mt.concentration.topSubChannel + ' (' + fmtP(mt.concentration.topSubChannelShare) + ' share).'
          : 'Pertahankan distribusi channel yang seimbang.',
        'Tutup gap vs LY ' + fmtG(ov.growVsLY) + ' — review bersama Regional Sales Team.',
      ].slice(0, 3),
    };

    const mkLi = (items) => items.map(a =>
      '<li style="font-size:11px;color:var(--gray-700);margin-bottom:4px;line-height:1.5">' + a + '</li>'
    ).join('');

    const mkActionSection = (icon, label, col, items) =>
      '<div style="margin-bottom:10px">' +
      '<div style="font-size:9px;font-weight:700;color:' + col + ';text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">' + icon + ' ' + label + '</div>' +
      '<ul style="margin:0;padding-left:16px">' + mkLi(items) + '</ul>' +
      '</div>';

    const actionEl = DOM.el('mt-exec-action-content');
    if (actionEl) actionEl.innerHTML =
      mkActionSection('⚡', 'Immediate', 'var(--red-main)',   actionItems.immediate) +
      mkActionSection('📅', 'This Week',  'var(--amber-main)', actionItems.thisWeek) +
      mkActionSection('🗓', 'This Month', 'var(--blue-main)',  actionItems.thisMonth);

    // ── 10. Impact Estimation (mt-impact-estimation-content) ──
    const revRecovery  = (ov.caChurn > 0 && ov.avgRevPerCA > 0) ? ov.caChurn * ov.avgRevPerCA : null;
    const growthScen   = ov.totalLMHK > 0 ? ov.totalLMHK * 0.05 : null;

    const mkImpactCard = (label, val, sub, col) =>
      '<div class="kpi-card" style="text-align:center;padding:12px 8px">' +
      '<div style="font-size:9px;color:var(--gray-500);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">' + label + '</div>' +
      '<div style="font-size:20px;font-weight:700;color:' + col + ';margin-bottom:2px">' + val + '</div>' +
      '<div style="font-size:10px;color:var(--gray-500)">' + sub + '</div>' +
      '</div>';

    const impEl = DOM.el('mt-impact-estimation-content');
    if (impEl) impEl.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' +
      mkImpactCard('Revenue Recovery', revRecovery ? fmtC(revRecovery) : '—',
        'Dari ' + (ov.caChurn || 0) + ' outlet churn × avg rev/CA', 'var(--green-main)') +
      mkImpactCard('CA Win-Back Target', (ov.caChurn || 0) + ' outlet',
        'Seluruh CA churn TM ini', 'var(--blue-main)') +
      mkImpactCard('+5% Growth Scenario', growthScen ? fmtC(growthScen) : '—',
        'Inkremental dari LM pace', 'var(--amber-main)') +
      '</div>';
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
      `<span style="color:var(--gray-600)">${topInsight?.sentence ?? 'Pantau run rate dan eksekusi CA Zero.'}</span>`
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
