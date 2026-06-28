/**
 * kpiEngine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * KPI Engine — Core Business Logic.
 * Reads State.filtered, aggregates all business metrics, writes to State.kpi.
 *
 * Source: index.html (inline block) — lines 2586–3491 (verbatim extraction).
 *
 * Dependencies (all runtime globals, lazy-resolved):
 *   State, Utils, TimeEngine, TrendEngine, AlertEngine, AnomalyEngine, InsightEngine, ExecSummaryEngine, Config
 */

// ==========================================
// 7. KPI ENGINE (Core Business Logic)
// ==========================================
const KPIEngine = {
  runAll: () => {
    // SECURITY: Double Counting Guard.
    // Performance → State.filtered.perf (Target & Actual only)
    // CA Monitoring → State.filtered.caMaster (CA_Master sheet = single source of truth)
    //                 Fallback to perf if CA_Master not present.
    // BB1 Wholesaler → State.filtered.perf filtered by Channel=WHOLESALER (no double count)
    // BB2-BB4 ITG sub-programs → strictly isolated, never added to master totals.
    const perfWS = State.filtered.perf.filter(r => {
      const ch = (r['Channel'] || '').toString().toUpperCase();
      return ch === 'WHOLESALER' || ch === 'WHOLESALER FS';
    });

    // ── Production Hardening: section-level isolation ──────────────────────────
    // Each calc section runs in its own try/catch. A crash in one section
    // degrades that section to safe defaults without killing the entire dashboard.
    const _section = (name, fn, fallback = {}) => {
      try { return fn(); }
      catch (err) {
        console.error('[KPIEngine] ' + name + ' failed:', String(err));
        if (window.SCTHealth) SCTHealth.errors.push({ engine: 'KPIEngine.' + name, time: new Date().toISOString(), message: String(err) });
        return fallback;
      }
    };

    State.kpi = {
      ..._section('calcPerformance',  () => KPIEngine.calcPerformance(State.filtered.perf)),
      ..._section('calcCAMonitoring', () => KPIEngine.calcCAMonitoring(State.filtered.perf)),
      ..._section('calcWholesaler',   () => KPIEngine.calcWholesaler(perfWS, State.filtered.arjuna, State.filtered.bima, State.filtered.sc)),
      ..._section('calcPSAchiever',   () => KPIEngine.calcPSAchiever(State.filtered.ps)),
      ..._section('calcClassAnalysis',() => KPIEngine.calcClassAnalysis(State.filtered.arjuna, State.filtered.bima, State.filtered.sc))
    };
    // BB5: Wholesaler Performance by Class (Wholesaler sheet → CLASS field). Isolated namespace.
    State.kpi.wsClass       = _section('calcWholesalerClass',             () => KPIEngine.calcWholesalerClass(State.filtered.wholesaler), {});
    // MT Analysis (Sprint 18) — isolated namespace, additive only
    State.kpi.mt            = _section('calcMT',                          () => KPIEngine.calcMT(State.filtered.mt), {});
    // MT5 Timegone (Sprint 19A) — reads State.kpi.mt.byChannel + TimeEngine. No new state.
    State.kpi.mt.timegone   = _section('calcMTTimegone',                  () => KPIEngine.calcMTTimegone(State.kpi.mt, TimeEngine.get()), null);
    // Executive Summary Layer: Sales Performance by Principle (reuses perf.byPrin + totals).
    State.kpi.principleExec = _section('calculatePrincipleExecutiveSummary', () => KPIEngine.calculatePrincipleExecutiveSummary(State.kpi), []);
    // Smart Alert Prioritization
    State.kpi.alerts        = _section('AlertEngine.generate',    () => AlertEngine.generate(State.kpi), []);
    // Anomaly Detection — statistical outliers across all domains
    State.kpi.anomalies     = _section('AnomalyEngine.detect',    () => AnomalyEngine.detect(State.kpi), []);
    // Auto Insight Generator
    State.kpi.insights      = _section('InsightEngine.generateInsights', () => InsightEngine.generateInsights(State.kpi), []);
    // Executive Summary
    State.kpi.execSlots     = _section('ExecSummaryEngine.build', () => ExecSummaryEngine.build(State.kpi), []);
    // Section 5 — Executive Decision Center (must be LAST: depends on perf, ca, anomalies, alerts)
    State.kpi.executiveDecision = _section('calculateExecutiveDecision', () => KPIEngine.calculateExecutiveDecision(), null);
  },

  calcPerformance: (data) => {
    // ── Working Days: exclusively from TimeEngine (single source of truth) ──
    // No direct State.timeEngine access — always go through TimeEngine.get()
    const td = TimeEngine.get();

    const res = {
      totTgt: 0, totAct: 0, totLM: 0,
      // Working day values from centralized engine
      hkPass:   td.hkPass,
      hkTot:    td.hkTot,
      hkRem:    td.hkRem,
      timeGone: td.timeGone,   // % of period elapsed — the canonical pace benchmark
      wdSource: td.source,
      wdValid:  td.valid,
      wdWarnings: td.warnings
    };

    data.forEach(r => {
      res.totTgt += Utils.safeNum(r['Target TM']);
      res.totAct += Utils.safeNum(r['Act TM']);
      res.totLM  += Utils.safeNum(r['LMHK']);
    });

    res.ach      = Utils.calcAch(res.totAct, res.totTgt);
    res.gap      = res.totAct - res.totTgt;
    // Trend — single TrendEngine call replaces inline calcGrowth + manual gapLM
    res.trend    = TrendEngine.calc(res.totAct, res.totLM, null);
    res.vsLM     = res.trend.vsLM ?? 0;   // keep for backward compat (charts etc.)
    res.paceTgt  = td.timeGone;

    // Run-rate: use TimeEngine helpers (no inline math)
    res.reqRR    = TimeEngine.runRate(Math.abs(res.gap));
    res.actRR    = TimeEngine.actualRR(res.totAct);

    // Time Gone status — compare ach vs pace via TimeEngine
    res.tgStatus = TimeEngine.evalStatus(res.ach);

    // Region breakdown — extended with tgt, act, lm, ly for inline chart labels
    const bReg = Utils.groupBy(data, 'Region', ['Target TM', 'Act TM', 'LMHK', 'LYHK']);
    res.byReg = Object.entries(bReg).map(([r, v]) => {
      const act = v['Act TM'], tgt = v['Target TM'], lm = v['LMHK'];
      const ach = Utils.calcAch(act, tgt);
      return {
        region: r, ach, tgt, act, lm,
        gap:    act - tgt,
        trend:  TrendEngine.calc(act, lm > 0 ? lm : null, null)
      };
    }).sort((a, b) => a.ach - b.ach);

    // Depo ranking — aggregated in one pass; used by generateDepotRanking() helper
    const depoMap = {};
    data.forEach(r => {
      const depo   = ((r['Depo'] || r['PSName'] || '') + '').trim();
      const region = ((r['Region'] || '') + '').trim();
      if (!depo) return;
      if (!depoMap[depo]) depoMap[depo] = { depo, region, tgt: 0, act: 0, lm: 0, ly: 0 };
      depoMap[depo].tgt += Utils.safeNum(r['Target TM']);
      depoMap[depo].act += Utils.safeNum(r['Act TM']);
      depoMap[depo].lm  += Utils.safeNum(r['LMHK']);
      depoMap[depo].ly  += Utils.safeNum(r['LYHK']);
      if (region && !depoMap[depo].region) depoMap[depo].region = region;
    });
    const td2 = TimeEngine.get();   // alias — td already used above
    res.byDepo = Object.values(depoMap)
      .filter(d => d.tgt > 0)
      .map(d => {
        const ach = Utils.calcAch(d.act, d.tgt);
        return {
          depo:    d.depo,
          region:  d.region || '—',
          tgt:     d.tgt, act: d.act, lm: d.lm,
          gap:     d.act - d.tgt,
          ach,
          trend:   TrendEngine.calc(d.act, d.lm > 0 ? d.lm : null, d.ly > 0 ? d.ly : null),
          needHK:  d.act < d.tgt && td2.hkRem > 0
                     ? (d.tgt - d.act) / td2.hkRem : 0,
          tgStatus: TimeEngine.evalStatus(ach)
        };
      });

    // Principle breakdown — sorted by Actual descending; each principle carries its own TG status + trend
    // LYHK included for vs-LY signal in commentary engine
    const bPrin = Utils.groupBy(
      data.filter(r => Utils.safeNum(r['Target TM']) > 0 || Utils.safeNum(r['Act TM']) > 0),
      'Principle', ['Target TM', 'Act TM', 'LMHK', 'LYHK', 'CA', 'CA LM']
    );
    res.byPrin = Object.entries(bPrin).map(([p, v]) => {
      const prinAch = Utils.calcAch(v['Act TM'], v['Target TM']);
      const lyVal   = v['LYHK'] > 0 ? v['LYHK'] : null;   // null = no LY data, suppress
      return {
        principle: p,
        tgt:       v['Target TM'],
        act:       v['Act TM'],
        lm:        v['LMHK'],
        ly:        lyVal,
        gap:       v['Act TM'] - v['Target TM'],
        ach:       prinAch,
        trend:     TrendEngine.calc(v['Act TM'], v['LMHK'], lyVal),
        tgStatus:  TimeEngine.evalStatus(prinAch),
        caTM:      Utils.safeNum(v['CA']),     // CA from Perfomance sheet (NOT CA_Master)
        caLM:      Utils.safeNum(v['CA LM'])
      };
    }).sort((a, b) => b.act - a.act);

    // Per-principle region + channel breakdown — single pass, piggyback both maps
    const prinRegMap  = {};
    const prinChanMap = {};   // { prin → { channel → { tgt, act, lm, regMap{} } } }
    data.forEach(r => {
      const prin    = (r['Principle'] || '').trim();
      const reg     = (r['Region']    || '').trim();
      const channel = (r['Channel']   || '').trim();
      const tgt     = Utils.safeNum(r['Target TM']);
      const act     = Utils.safeNum(r['Act TM']);
      const lm      = Utils.safeNum(r['LMHK']);

      if (!prin) return;

      // Region map
      if (reg) {
        if (!prinRegMap[prin]) prinRegMap[prin] = {};
        if (!prinRegMap[prin][reg]) prinRegMap[prin][reg] = { tgt: 0, act: 0, ca: 0, caLM: 0 };
        prinRegMap[prin][reg].tgt += tgt;
        prinRegMap[prin][reg].act += act;
        prinRegMap[prin][reg].ca   += Utils.safeNum(r['CA']);
        prinRegMap[prin][reg].caLM += Utils.safeNum(r['CA LM']);
      }

      // Channel map — includes per-region breakdown per channel for weakest region
      if (channel) {
        if (!prinChanMap[prin]) prinChanMap[prin] = {};
        if (!prinChanMap[prin][channel]) prinChanMap[prin][channel] = { tgt: 0, act: 0, lm: 0, ca: 0, caLM: 0, regMap: {} };
        const cm = prinChanMap[prin][channel];
        cm.tgt += tgt; cm.act += act; cm.lm += lm;
        cm.ca   += Utils.safeNum(r['CA']);
        cm.caLM += Utils.safeNum(r['CA LM']);
        if (reg) {
          if (!cm.regMap[reg]) cm.regMap[reg] = { tgt: 0, act: 0 };
          cm.regMap[reg].tgt += tgt;
          cm.regMap[reg].act += act;
        }
      }
    });

    // Attach byReg to each principle object
    res.byPrin.forEach(pr => {
      const regData  = prinRegMap[pr.principle]  || {};
      const chanData = prinChanMap[pr.principle] || {};

      pr.byReg = Object.entries(regData)
        .filter(([, v]) => v.tgt > 0 || v.act > 0)
        .map(([reg, v]) => ({ region: reg, ach: Utils.calcAch(v.act, v.tgt),
                              caTM: v.ca, caLM: v.caLM,
                              caGrowth: v.caLM > 0 ? ((v.ca - v.caLM) / v.caLM) * 100 : null }))
        .sort((a, b) => a.ach - b.ach);   // worst first

      // byChannel — sorted worst gap first for channel issue analysis
      pr.byChannel = Object.entries(chanData)
        .filter(([, v]) => v.tgt > 0)
        .map(([ch, v]) => {
          const ach   = Utils.calcAch(v.act, v.tgt);
          const vsLM  = v.lm > 0 ? ((v.act - v.lm) / Math.abs(v.lm)) * 100 : null;
          // weakest region by gap
          const weakReg = Object.entries(v.regMap)
            .map(([reg, rv]) => ({ region: reg, gap: rv.act - rv.tgt }))
            .sort((a, b) => a.gap - b.gap)
            .slice(0, 2);
          return { channel: ch, tgt: v.tgt, act: v.act, lm: v.lm,
                   gap: v.act - v.tgt, ach, vsLM, weakReg,
                   caTM: v.ca, caLM: v.caLM,
                   caGrowth: v.caLM > 0 ? ((v.ca - v.caLM) / v.caLM) * 100 : null };
        })
        .sort((a, b) => a.gap - b.gap);   // worst gap (most negative) first
    });

    // ── Category Analysis — calculateCategoryPerformance() ──────────────────
    // Groups by composite key: "SubKategori [Kategori - Principle]"
    // Single pass over data — aggregates Target, Actual, LM, LY per group.
    // Also builds bySKU[] per group (for SKU Issue Analysis) and byReg[].
    //
    // Column detection (flexible matching) — Indonesian names FIRST:
    //   Sub Kategori:  'Sub Kategori', 'SubKategori', 'sub kategori',
    //                  'Sub Category', 'SubCategory', 'sub_category', 'SKU Category'
    //   Kategori:      'Kategori', 'kategori', 'Main Category', 'MainCategory', 'Category'
    //   SKU:           'SKU', 'Nama Produk', 'Product', 'Item', 'Produk'
    //   Principle:     r['Principle'] — already resolved by FilterEngine

    const findCol = (sample, ...candidates) => {
      if (!sample) return null;
      const keys = Object.keys(sample);
      for (const cand of candidates) {
        const found = keys.find(k => k.trim().toLowerCase() === cand.toLowerCase())
                   || keys.find(k => k.trim().toLowerCase().replace(/[\s_]/g,'') === cand.toLowerCase().replace(/[\s_]/g,''));
        if (found) return found;
      }
      return null;
    };

    const sampleRow  = data.find(r => r) || {};
    // Indonesian column names listed FIRST so they match before English fallbacks
    const subCatCol  = findCol(sampleRow,
      'Sub Kategori', 'SubKategori', 'sub kategori', 'subkategori',
      'Sub Category', 'SubCategory', 'sub category', 'sub_category', 'SKU Category'
    );
    const mainCatCol = findCol(sampleRow,
      'Kategori', 'kategori',
      'Main Category', 'MainCategory', 'Category'
    ) || 'Kategori';
    const skuCol     = findCol(sampleRow, 'SKU', 'Nama Produk', 'Product', 'Item', 'Produk');

    // ── One-pass aggregation ──
    const catMap  = {};   // composite key → aggregated totals
    const skuMap  = {};   // composite key → { skuName → { tgt, act, lm, ly, regions: {} } }

    data.forEach(r => {
      const subCat  = subCatCol  ? ((r[subCatCol]  || '') + '').trim() : '';
      const mainCat = ((r[mainCatCol] || '') + '').trim() || 'Lainnya';
      const prin    = ((r['Principle'] || '') + '').trim() || '—';
      const region  = ((r['Region']    || '') + '').trim();
      const sku     = skuCol ? ((r[skuCol] || '') + '').trim() : '';

      // Composite display key
      const displayKey = subCat
        ? `${subCat} [${mainCat} - ${prin}]`
        : `${mainCat} [${prin}]`;

      // Category aggregation
      if (!catMap[displayKey]) {
        catMap[displayKey] = { displayKey, subCat, mainCat, prin, tgt: 0, act: 0, lm: 0, ly: 0, regMap: {} };
      }
      const cm = catMap[displayKey];
      cm.tgt += Utils.safeNum(r['Target TM']);
      cm.act += Utils.safeNum(r['Act TM']);
      cm.lm  += Utils.safeNum(r['LMHK']);
      cm.ly  += Utils.safeNum(r['LYHK']);

      // Per-region inside this category (for region breakdown)
      if (region) {
        if (!cm.regMap[region]) cm.regMap[region] = { tgt: 0, act: 0 };
        cm.regMap[region].tgt += Utils.safeNum(r['Target TM']);
        cm.regMap[region].act += Utils.safeNum(r['Act TM']);
      }

      // SKU aggregation per category (for SKU issue analysis)
      if (sku) {
        if (!skuMap[displayKey]) skuMap[displayKey] = {};
        if (!skuMap[displayKey][sku]) skuMap[displayKey][sku] = {
          sku, tgt: 0, act: 0, lm: 0, ly: 0, ca: 0, caLM: 0,
          regMap: {}   // per-region: { tgt, act, lm } — for weakest-region analysis
        };
        const sm = skuMap[displayKey][sku];
        const rowTgt = Utils.safeNum(r['Target TM']);
        const rowAct = Utils.safeNum(r['Act TM']);
        const rowLm  = Utils.safeNum(r['LMHK']);
        sm.tgt += rowTgt;
        sm.act += rowAct;
        sm.lm  += rowLm;
        sm.ly  += Utils.safeNum(r['LYHK']);
        sm.ca   += Utils.safeNum(r['CA']);     // CA from Perfomance sheet
        sm.caLM += Utils.safeNum(r['CA LM']);
        // Region-level aggregation for SKU (used in weakest-region ranking)
        if (region) {
          if (!sm.regMap[region]) sm.regMap[region] = { tgt: 0, act: 0, lm: 0 };
          sm.regMap[region].tgt += rowTgt;
          sm.regMap[region].act += rowAct;
          sm.regMap[region].lm  += rowLm;
        }
      }
    });

    const totalAct = res.totAct || 1;

    res.byCategory = Object.values(catMap)
      .filter(v => v.tgt > 0 || v.act > 0)
      .map(v => {
        const ach   = Utils.calcAch(v.act, v.tgt);
        const lyVal = v.ly > 0 ? v.ly : null;
        const lmVal = v.lm > 0 ? v.lm : null;

        // Build region breakdown (worst first)
        const byReg = Object.entries(v.regMap)
          .filter(([, rv]) => rv.tgt > 0 || rv.act > 0)
          .map(([reg, rv]) => ({ region: reg, ach: Utils.calcAch(rv.act, rv.tgt), tgt: rv.tgt, act: rv.act }))
          .sort((a, b) => a.ach - b.ach);

        // Build SKU issue list: top negative contributors — worst first
        const skus = Object.values(skuMap[v.displayKey] || {});
        const skuIssues = skus
          .filter(s => s.lm > 0 || s.act > 0)
          .map(s => {
            // Build weakest region list: sort regions by (act - tgt) ascending (biggest gap first)
            const weakestRegs = Object.entries(s.regMap)
              .map(([reg, rv]) => ({
                region:  reg,
                gap:     rv.act - rv.tgt,       // gap vs BP (target)
                gapLM:   rv.lm > 0 ? rv.act - rv.lm : null   // gap vs LM
              }))
              .sort((a, b) => a.gap - b.gap)     // most negative gap first
              .slice(0, 3);
            return {
              sku:        s.sku,
              tgt:        s.tgt,
              act:        s.act,
              lm:         s.lm,
              gap:        s.act - s.tgt,
              gapLM:      s.lm > 0 ? s.act - s.lm : null,
              vsLM:       s.lm > 0 ? ((s.act - s.lm) / Math.abs(s.lm)) * 100 : null,
              isZero:     s.act === 0,
              caTM:       s.ca,
              caLM:       s.caLM,
              caGrowth:   s.caLM > 0 ? ((s.ca - s.caLM) / s.caLM) * 100 : null,
              weakestRegs,
              score: (s.lm > 0 ? -(((s.act - s.lm) / Math.abs(s.lm)) * 100) : 0)
                    + (s.tgt > 0 ? (-(s.act - s.tgt) / s.tgt * 50) : 0)
                    + (s.act === 0 ? 30 : 0)
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        return {
          category:  v.displayKey,   // "Waferstick [Biscuit - GPPJ]"
          subCat:    v.subCat,
          mainCat:   v.mainCat,
          prin:      v.prin,
          tgt:       v.tgt,
          act:       v.act,
          gap:       v.act - v.tgt,
          ach,
          contrib:   (v.act / totalAct) * 100,
          trend:     TrendEngine.calc(v.act, lmVal, lyVal),
          tgStatus:  TimeEngine.evalStatus(ach),
          byReg,
          skuIssues
        };
      })
      .sort((a, b) => b.act - a.act);

    return { perf: res };
  },

  calcCAMonitoring: (perfData) => {
    // ═══════════════════════════════════════════════════════════════
    // SINGLE SOURCE OF TRUTH: CA_Master
    // If CA_Master is available → use it exclusively (no double counting).
    // Fallback → Performance sheet (legacy, may have double counting).
    // ═══════════════════════════════════════════════════════════════
    const caData = State.filtered.caMaster.length > 0
      ? State.filtered.caMaster
      : perfData;

    const caKey   = State.filtered.caMaster.length > 0 ? 'CA TM' : 'CA';
    const caLMKey = 'CA LM';

    const res = { tot: 0, lm: 0, zero: 0, source: State.filtered.caMaster.length > 0 ? 'CA_Master' : 'Perfomance (fallback)' };

    caData.forEach(r => {
      const tm = Utils.safeNum(r[caKey]);
      const lm = Utils.safeNum(r[caLMKey]);
      res.tot += tm;
      res.lm  += lm;
      if (tm === 0 && lm > 0) res.zero++;
    });
    res.delta = Utils.calcGrowth(res.tot, res.lm);

    // CA By Channel — GOVERNED: only strategic focus channels (Config.FOCUS_CHANNELS).
    // Hidden channels (Others, E-COM, PDE, HEALTH & BEAUTY, …) are excluded from every
    // downstream channel widget (chart, ranking, traffic light, insight, commentary).
    const bCh = Utils.groupBy(caData, 'Channel', [caKey, caLMKey]);
    res.byCh = Object.entries(bCh)
      .filter(([c,v]) => v[caLMKey] > 0 && Config.isFocusChannel(c))
      .map(([c,v]) => ({
        name: c, ca: v[caKey], lm: v[caLMKey],
        gap: v[caKey] - v[caLMKey],
        delta: Utils.calcGrowth(v[caKey], v[caLMKey])
      })).sort((a,b) => a.delta - b.delta);

    // CA By Region
    const bReg = Utils.groupBy(caData, 'Region', [caKey, caLMKey]);
    res.byReg = Object.entries(bReg)
      .filter(([,v]) => v[caLMKey] > 0)
      .map(([r,v]) => ({
        name: r, ca: v[caKey], lm: v[caLMKey],
        gap: v[caKey] - v[caLMKey],
        delta: Utils.calcGrowth(v[caKey], v[caLMKey])
      })).sort((a,b) => a.delta - b.delta);

    return { ca: res };
  },

  calcWholesaler: (perfWS, arj, bim, sc) => {
    // ══════════════════════════════════════════════════════
    // BB1: Pure from Performance sheet (Channel = Wholesaler)
    // BB2-BB4: From ITG sub-program sheets
    // ══════════════════════════════════════════════════════
    const res = {};

    // ── BB1: Overall from Perfomance sheet ──
    const bb1Tgt  = perfWS.reduce((s,r) => s + Utils.safeNum(r['Target TM']), 0);
    const bb1Act  = perfWS.reduce((s,r) => s + Utils.safeNum(r['Act TM']), 0);
    const bb1LM   = perfWS.reduce((s,r) => s + Utils.safeNum(r['LMHK']), 0);
    const bb1LY   = perfWS.reduce((s,r) => s + Utils.safeNum(r['LYHK']), 0);
    const bb1CA   = perfWS.reduce((s,r) => s + Utils.safeNum(r['CA']), 0);
    const bb1CALM = perfWS.reduce((s,r) => s + Utils.safeNum(r['CA LM']), 0);
    const bb1Active = perfWS.filter(r => Utils.safeNum(r['CA']) > 0).length;
    const bb1Zero   = perfWS.filter(r => Utils.safeNum(r['CA']) === 0 && Utils.safeNum(r['CA LM']) > 0).length;
    const bb1Total  = perfWS.length;

    res.allTgt   = bb1Tgt;
    res.allAct   = bb1Act;
    res.allLM    = bb1LM;
    res.allLY    = bb1LY;
    res.allTot   = bb1Total;
    res.allActv  = bb1Active;
    res.allZero  = bb1Zero;
    res.allAch   = Utils.calcAch(bb1Act, bb1Tgt);
    // Trend — single TrendEngine call replaces allGwth, allGwthLY, allGapLM, allGapLY
    res.allTrend  = TrendEngine.calc(bb1Act, bb1LM, bb1LY || null);
    // Backward-compat aliases (charts + existing renders reference these)
    res.allGwth   = res.allTrend.vsLM   ?? 0;
    res.allGwthLY = res.allTrend.vsLY;
    res.allGapLM  = res.allTrend.gapLM  ?? 0;
    res.allGapLY  = res.allTrend.gapLY;

    // BB1 regions — from Perfomance sheet
    const bRegAll = Utils.groupBy(perfWS, 'Region', ['Target TM', 'Act TM', 'LMHK']);
    res.regAll = Object.entries(bRegAll).map(([r,v]) => ({
      reg: r, tgt: v['Target TM'], act: v['Act TM'], lm: v['LMHK'],
      ach: Utils.calcAch(v['Act TM'], v['Target TM'])
    })).sort((a,b) => a.ach - b.ach);

    // ── BB2-BB4: ITG sub-program aggregates ──
    const agg = (data) => {
      const a = {
        t:    data.length,
        actv: data.filter(r => Utils.safeNum(r['Act TM']) > 0).length,
        tgt: 0, act: 0, lm: 0
      };
      data.forEach(r => {
        a.tgt += Utils.safeNum(r['Target TM']);
        a.act += Utils.safeNum(r['Act TM']);
        a.lm  += Utils.safeNum(r['LMHK']);
      });
      a.ach   = Utils.calcAch(a.act, a.tgt);
      a.trend = TrendEngine.calc(a.act, a.lm, null);
      a.vslm  = a.trend.vsLM ?? 0;   // backward compat
      a.zro   = a.t - a.actv;
      return a;
    };
    res.arj = agg(arj);
    res.bim = agg(bim);
    res.sc  = agg(sc);

    // Region ach per ITG program (for BB2 chart)
    const calcRegAch = (d) => {
      const g = Utils.groupBy(d.filter(r => Utils.safeNum(r['Target TM']) > 0), 'Region', ['Target TM', 'Act TM']);
      return Object.entries(g).map(([r,v]) => ({ reg: r, ach: Utils.calcAch(v['Act TM'], v['Target TM']) }));
    };
    res.regArj = calcRegAch(arj);
    res.regBim = calcRegAch(bim);
    res.regSc  = calcRegAch(sc);

    // Pareto top/bot for BB3
    const getTopBot = (data) => {
      const f = data.filter(r => Utils.safeNum(r['Target TM']) > 0);
      f.forEach(r => r._ach = Utils.calcAch(Utils.safeNum(r['Act TM']), Utils.safeNum(r['Target TM'])));
      return {
        top: [...f].sort((a,b) => Utils.safeNum(b['Act TM']) - Utils.safeNum(a['Act TM'])).slice(0, 10),
        bot: [...f.filter(r => Utils.safeNum(r['Act TM']) > 0)].sort((a,b) => a._ach - b._ach).slice(0, 10)
      };
    };
    res.arjT = getTopBot(arj);
    res.bimT = getTopBot(bim);
    res.scT  = getTopBot(sc);

    return { ws: res };
  },

  /**
   * calcITGTimegone(ws, td) ← NEW (BB2.5) — PURE, additive, no State writes.
   * Timegone from DimDate (td = TimeEngine.get()); Achievement reuses ws.arj/.bim/.sc
   * (already computed by calcWholesaler — unchanged). Returns header + 3 cards + insight.
   */
  calcITGTimegone: (ws, td) => {
    const tg = td.timeGone, hkRem = td.hkRem, hkPass = td.hkPass;

    const mk = (name, prog, isQty, color) => {
      if (!prog || !prog.tgt) return { name, isQty, color, hasData: false };
      const ach     = prog.ach;                                   // existing Achievement %
      const gapVsTG = ach - tg;
      const reqDailySales = hkRem > 0 ? (prog.tgt - prog.act) / hkRem : null;
      const remainGap = prog.tgt - prog.act;   // Remaining Gap Value (headline of slot 3)
      const proj    = tg > 0 ? (ach / tg) * 100 : null;
      const curRate = hkPass > 0 ? ach / hkPass : 0;
      const reqRate = hkRem > 0 ? (100 - ach) / hkRem : null;
      const recovNeed = (curRate > 0 && reqRate !== null) ? ((reqRate / curRate) - 1) * 100 : null;

      const status = gapVsTG >= -5  ? { key: 'ontrack',  label: 'ON TRACK', icon: '🟢', cls: 'tg-ahead' }
                   : gapVsTG >= -15 ? { key: 'recovery', label: 'RECOVERY', icon: '🟠', cls: 'tg-ontrack' }
                   :                  { key: 'critical', label: 'CRITICAL', icon: '🔴', cls: 'tg-behind' };

      const rn = recovNeed;
      const recovInterp = (rn === null || rn <= 0) ? { label: 'On Pace',                    cls: 'rn-onpace' }
                        : rn <= 25  ? { label: 'Low Recovery Required',      cls: 'rn-low' }
                        : rn <= 75  ? { label: 'Moderate Recovery Required', cls: 'rn-moderate' }
                        : rn <= 125 ? { label: 'High Recovery Required',     cls: 'rn-high' }
                        :             { label: 'Critical Recovery Required', cls: 'rn-critical' };

      return { name, isQty, color, hasData: true, ach, gapVsTG, remainGap, reqDailySales, proj, recovNeed, status, recovInterp };
    };

    const cards = [
      mk('ITG Arjuna',   ws.arj, false, 'amber'),
      mk('ITG Bima',     ws.bim, false, 'red'),
      mk('ITG Supercup', ws.sc,  true,  'blue')
    ];

    const valid = cards.filter(c => c.hasData);
    const worstGap  = valid.length ? valid.reduce((m, c) => c.gapVsTG < m.gapVsTG ? c : m) : null;
    const recovList = valid.filter(c => c.recovNeed !== null && c.recovNeed > 0);
    const highRecov = recovList.length ? recovList.reduce((m, c) => c.recovNeed > m.recovNeed ? c : m) : null;
    const projList  = valid.filter(c => c.proj !== null);
    const bestProj  = projList.length ? projList.reduce((m, c) => c.proj > m.proj ? c : m) : null;

    return {
      hasData: valid.length > 0,
      header: { timeGone: tg, hkPass: td.hkPass, hkTot: td.hkTot, hkRem: td.hkRem },
      cards,
      insight: { worstGap, highRecov, bestProj }
    };
  },

  calcPSAchiever: (data) => {
    if(!data || !data.length) return { ps: { hasData: false } };
    
    // Generic column finding due to potential spelling changes
    const findCol = (row, opts) => opts.find(o => row.hasOwnProperty(o)) || opts[0];
    const r0 = data[0];
    const c = {
      sit: findCol(r0, ['Target TM Sell In', 'Target_TM_Sell_In']),
      sia: findCol(r0, ['Act TM Sell In', 'Act_TM_Sell_In']),
      sot: findCol(r0, ['Target TM Sell Out', 'Target_TM_Sell_Out']),
      soa: findCol(r0, ['Act TM Sell Out', 'Act_TM_Sell_Out']),
      solm: findCol(r0, ['Sellout LMHK', 'Sell_Out_LMHK']),
      silm: findCol(r0, ['Sell In LMHK', 'Sell_In_LMHK']),
      cat: findCol(r0, ['CA TM']), calm: findCol(r0, ['CA LM']),
      dep: findCol(r0, ['PSName', 'Depo', 'PS'])
    };
    
    const res = { hasData: true, sit:0, sia:0, sot:0, soa:0, solm:0, silm:0, cat:0, calm:0 };
    data.forEach(r => {
      res.sit+=Utils.safeNum(r[c.sit]); res.sia+=Utils.safeNum(r[c.sia]);
      res.sot+=Utils.safeNum(r[c.sot]); res.soa+=Utils.safeNum(r[c.soa]);
      res.solm+=Utils.safeNum(r[c.solm]); res.silm+=Utils.safeNum(r[c.silm]);
      res.cat+=Utils.safeNum(r[c.cat]); res.calm+=Utils.safeNum(r[c.calm]);
    });
    res.siAch = Utils.calcAch(res.sia, res.sit);
    res.soAch = Utils.calcAch(res.soa, res.sot);
    // Trend objects — single calls replace 3 separate calcGrowth invocations
    res.siTrend = TrendEngine.calc(res.sia, res.silm, null);
    res.soTrend = TrendEngine.calc(res.soa, res.solm, null);
    res.caTrend = TrendEngine.calc(res.cat, res.calm, null);
    // Backward-compat aliases
    res.soVslm  = res.soTrend.vsLM  ?? 0;
    res.siVslm  = res.siTrend.vsLM  ?? 0;
    res.caVslm  = res.caTrend.vsLM  ?? 0;

    // Grouping Region
    const bReg = Utils.groupBy(data, 'Region', [c.sit, c.sia, c.sot, c.soa]);
    res.reg = Object.entries(bReg).map(([r,v])=>({
      reg:r, sia: Utils.calcAch(v[c.sia], v[c.sit]), soa: Utils.calcAch(v[c.soa], v[c.sot])
    })).sort((a,b)=>a.sia - b.sia);

    // ── Per-PS Name ranking — used by generatePSTopBottomTable() ──
    // Groups by PSName (c.dep column), computes SI and SO ach% per PS.
    // Filters: PSName must be non-blank; SI target and SO target must be > 0.
    const psMap = {};
    data.forEach(r => {
      const name   = (r[c.dep] || '').toString().trim();
      const region = (r['Region'] || '').toString().trim();
      if (!name) return;
      const siT = Utils.safeNum(r[c.sit]);
      const siA = Utils.safeNum(r[c.sia]);
      const soT = Utils.safeNum(r[c.sot]);
      const soA = Utils.safeNum(r[c.soa]);
      if (!psMap[name]) psMap[name] = { name, region, siT: 0, siA: 0, soT: 0, soA: 0 };
      psMap[name].siT += siT;
      psMap[name].siA += siA;
      psMap[name].soT += soT;
      psMap[name].soA += soA;
      // Keep last non-blank region (or first encountered)
      if (region && !psMap[name].region) psMap[name].region = region;
    });

    // Build ranked array — exclude rows where either target = 0
    res.byPS = Object.values(psMap)
      .filter(p => p.siT > 0 && p.soT > 0)
      .map(p => ({
        name:   p.name,
        region: p.region || '—',
        siT:    p.siT,
        siA:    p.siA,
        soT:    p.soT,
        soA:    p.soA,
        siAch:  Utils.calcAch(p.siA, p.siT),
        soAch:  Utils.calcAch(p.soA, p.soT)
      }));

    return { ps: res };
  },

  /**
   * calcWholesalerClass — BB5: Wholesaler Performance by customer CLASS.
   *
   * SOURCE: Wholesaler sheet (raw, filtered) — fields: CLASS, Act TM, LMHK, LYHK.
   * ISOLATION: Independent of BB1 (Perfomance-derived). Never added to master totals.
   *
   * Per-class KPIs:
   *   tm  = SUM(Act TM)   lm = SUM(LMHK)   ly = SUM(LYHK)
   *   gLM = (tm - lm)/lm  gLY = (tm - ly)/ly   contrib = tm / totalTM
   * Status rule (sign of gLM × sign of gLY):
   *   + / +  → Growth Engine    + / −  → Recovery
   *   − / +  → Momentum Loss     − / −  → Critical
   *
   * @returns { hasData, classes:[{cls,tm,lm,ly,gLM,gLY,contrib,status,...}], totalTM, insight }
   */
  calcWholesalerClass: (rows) => {
    if (!rows || !rows.length) return { hasData: false, classes: [], totalTM: 0, insight: null };

    // Preferred executive ordering; unknown/blank labels appended after.
    const ORDER = ['SPRBIG', 'BIG', 'MEDIUM', 'SMALL'];
    const agg = Utils.groupBy(
      rows.map(r => ({
        CLASS: (r['CLASS'] == null || r['CLASS'].toString().trim() === '')
          ? 'UNCLASSIFIED' : r['CLASS'].toString().trim().toUpperCase(),
        'Act TM': Utils.safeNum(r['Act TM']),
        LMHK:     Utils.safeNum(r['LMHK']),
        LYHK:     Utils.safeNum(r['LYHK'])
      })),
      'CLASS',
      ['Act TM', 'LMHK', 'LYHK']
    );

    const totalTM = Object.values(agg).reduce((s, v) => s + v['Act TM'], 0);

    const STATUS = {
      growth:   { key: 'growth',   label: 'Growth Engine', tone: 'positive', badge: 'solid-blue',  icon: '🚀' },
      recovery: { key: 'recovery', label: 'Recovery',      tone: 'warning',  badge: 'solid-amber', icon: '🔁' },
      momentum: { key: 'momentum', label: 'Momentum Loss', tone: 'warning',  badge: 'solid-amber', icon: '⚠' },
      critical: { key: 'critical', label: 'Critical',      tone: 'negative', badge: 'solid-red',   icon: '🔴' }
    };

    const classes = Object.entries(agg).map(([cls, v]) => {
      const tm = v['Act TM'], lm = v['LMHK'], ly = v['LYHK'];
      const gLM = Utils.safeDiv(tm - lm, lm);          // ratio or null
      const gLY = Utils.safeDiv(tm - ly, ly);
      const gLMpct = gLM === null ? null : gLM * 100;
      const gLYpct = gLY === null ? null : gLY * 100;
      const contrib = Utils.safeDiv(tm, totalTM, 0) * 100;
      // Status: treat null growth as 0 (flat) for classification safety.
      const up_LM = (gLMpct || 0) >= 0, up_LY = (gLYpct || 0) >= 0;
      const status = up_LM && up_LY ? STATUS.growth
                   : up_LM && !up_LY ? STATUS.recovery
                   : !up_LM && up_LY ? STATUS.momentum
                   : STATUS.critical;
      return { cls, tm, lm, ly, gLM: gLMpct, gLY: gLYpct, contrib, status };
    });

    // Sort by Sales TM descending; preferred order only used as tie-context label.
    classes.sort((a, b) => b.tm - a.tm);

    // ── Executive insight derivation ──
    const withLM = classes.filter(c => c.gLM !== null);
    const withLY = classes.filter(c => c.gLY !== null);
    const largest    = classes[0] || null;
    const fastestLM  = withLM.length ? withLM.reduce((m, c) => c.gLM > m.gLM ? c : m) : null;
    const fastestLY  = withLY.length ? withLY.reduce((m, c) => c.gLY > m.gLY ? c : m) : null;
    // Biggest decline: most negative combined momentum, prefer Critical, weight by contribution.
    const decliners  = classes.filter(c => (c.gLM || 0) < 0 || (c.gLY || 0) < 0);
    const biggestDrop = decliners.length
      ? decliners.reduce((m, c) =>
          ((c.gLM || 0) + (c.gLY || 0)) < ((m.gLM || 0) + (m.gLY || 0)) ? c : m)
      : null;
    // Recommended focus: Critical with highest contribution, else Recovery, else biggest decline.
    const critical = classes.filter(c => c.status.key === 'critical').sort((a, b) => b.contrib - a.contrib);
    const recovery = classes.filter(c => c.status.key === 'recovery').sort((a, b) => b.contrib - a.contrib);
    const focus = critical[0] || recovery[0] || biggestDrop || null;

    return {
      hasData: true,
      classes,
      totalTM,
      insight: { largest, fastestLM, fastestLY, biggestDrop, focus, ORDER }
    };
  },

  /**
   * calcMT — MT Analysis: Modern Trade Performance by Channel, Type, CLASS, Region.
   *
   * SOURCE: MT sheet (State.filtered.mt) — columns: Channel, Sub Channel, Act TM,
   *         LYHK, LMHK, CA, CA LM, CLASS, Region, Depo, Principle, Kategori.
   * ISOLATION: Completely independent of Performance sheet. Never added to master totals.
   * No Target column in MT sheet — growth-only analysis (vs LM, vs LY).
   *
   * Sub Channel encoding: [CHANNEL]-[TYPE]-[STORETYPE]-[CLASS]
   *   TYPE (position 1): MIN, SR, MTWS, MWS, SP, CON, HYP, FRUIT, WS, HB, BABY
   *
   * STATUS rule (sign of growVsLM × sign of growVsLY):
   *   + / + → Growth Engine   + / − → Recovery
   *   − / + → Momentum Loss   − / − → Critical
   *
   * @returns { hasData, overview, byChannel, byType, byClass, byRegion, concentration, insight }
   */
  calcMT: (rows) => {
    if (!rows || !rows.length) return { hasData: false, overview: null, byChannel: [], byType: [], byClass: [], byRegion: [], concentration: null, insight: null };

    const safeNum = Utils.safeNum;
    const safeDiv = Utils.safeDiv;
    const pct = (v) => v !== null ? v * 100 : null; // F-03: guard null*100 coercion

    // TYPE label lookup — decoded from Sub Channel segment 1
    const TYPE_LABELS = {
      MIN: 'Minimarket', SR: 'Supermarket', MTWS: 'MT Wholesale',
      MWS: 'Modern Wholesale', SP: 'Specialty', CON: 'Convenience',
      HYP: 'Hypermarket', FRUIT: 'Fruit Store', WS: 'Wholesale',
      HB: 'Health & Beauty', BABY: 'Baby Specialty'
    };
    const parseType = (subCh) => {
      if (!subCh) return 'UNCLASSIFIED';
      const parts = subCh.toString().trim().split('-');
      return parts.length >= 2 ? parts[1].toUpperCase() : 'UNCLASSIFIED';
    };

    // STATUS helper (mirrors calcWholesalerClass status logic exactly)
    const MT_STATUS = {
      growth:   { key: 'growth',   label: 'Growth Engine', tone: 'positive', badge: 'solid-blue',  icon: '\u{1F680}' },
      recovery: { key: 'recovery', label: 'Recovery',      tone: 'warning',  badge: 'solid-amber', icon: '\u{1F501}' },
      momentum: { key: 'momentum', label: 'Momentum Loss', tone: 'warning',  badge: 'solid-amber', icon: '\u26A0' },
      critical: { key: 'critical', label: 'Critical',      tone: 'negative', badge: 'solid-red',   icon: '\u{1F534}' }
    };
    const mkMTStatus = (gLM, gLY) => {
      const upLM = (gLM ?? 0) >= 0, upLY = (gLY ?? 0) >= 0;
      return upLM && upLY  ? MT_STATUS.growth
           : upLM && !upLY ? MT_STATUS.recovery
           : !upLM && upLY ? MT_STATUS.momentum
           : MT_STATUS.critical;
    };

    // Row aggregator — handles null LY/LM gracefully (null = no data, 0 = zero revenue)
    const aggRows = (rws) => {
      let actTM = 0, lyHK = 0, lmHK = 0, caT = 0, caLM = 0, hasLY = false, hasLM = false;
      rws.forEach(r => {
        actTM += safeNum(r['Act TM']);
        const ly = r['LYHK']; if (ly !== null && ly !== undefined) { lyHK += safeNum(ly); hasLY = true; }
        const lm = r['LMHK']; if (lm !== null && lm !== undefined) { lmHK += safeNum(lm); hasLM = true; }
        caT  += safeNum(r['CA']);
        caLM += safeNum(r['CA LM']);
      });
      return { actTM, lyHK: hasLY ? lyHK : null, lmHK: hasLM ? lmHK : null, caT, caLM };
    };

    // ── 1. Overview ──
    const ov           = aggRows(rows);
    const totalActTM   = ov.actTM;
    const growVsLY     = ov.lyHK !== null ? pct(safeDiv(ov.actTM - ov.lyHK, ov.lyHK)) : null;
    const growVsLM     = ov.lmHK !== null ? pct(safeDiv(ov.actTM - ov.lmHK, ov.lmHK)) : null;
    const caChurnTot   = ov.caLM - ov.caT;
    const avgRevPerCA  = safeDiv(ov.actTM, ov.caT, 0);
    const recoveryPotential = caChurnTot > 0 ? caChurnTot * avgRevPerCA : 0;
    const overview = {
      totalActTM, totalLYHK: ov.lyHK, totalLMHK: ov.lmHK,
      growVsLY, growVsLM,
      gapVsLY: ov.lyHK !== null ? ov.actTM - ov.lyHK : null,
      gapVsLM: ov.lmHK !== null ? ov.actTM - ov.lmHK : null,
      totalCAT: ov.caT, totalCALM: ov.caLM, caChurn: caChurnTot,
      avgRevPerCA, recoveryPotential
    };

    // ── 2. byChannel (MTI / NKA) ──
    const chMap = {};
    rows.forEach(r => {
      const ch = (r['Channel'] || 'UNKNOWN').toString().trim().toUpperCase();
      (chMap[ch] = chMap[ch] || []).push(r);
    });
    const byChannel = Object.entries(chMap).map(([channel, chRows]) => {
      const a = aggRows(chRows);
      const gLM = a.lmHK !== null ? pct(safeDiv(a.actTM - a.lmHK, a.lmHK)) : null;
      const gLY = a.lyHK !== null ? pct(safeDiv(a.actTM - a.lyHK, a.lyHK)) : null;
      return {
        channel, actTM: a.actTM, lyHK: a.lyHK, lmHK: a.lmHK,
        caT: a.caT, caLM: a.caLM, caChurn: a.caLM - a.caT,
        growVsLY: gLY, growVsLM: gLM,
        share: safeDiv(a.actTM, totalActTM, 0) * 100,
        status: mkMTStatus(gLM, gLY)
      };
    }).sort((a, b) => b.actTM - a.actTM);

    // ── 3. byType (decoded from Sub Channel segment 1) ──
    const typeMap = {};
    rows.forEach(r => {
      const t = parseType(r['Sub Channel']);
      (typeMap[t] = typeMap[t] || []).push(r);
    });
    const byType = Object.entries(typeMap).map(([type, tRows]) => {
      const a = aggRows(tRows);
      const gLM = a.lmHK !== null ? pct(safeDiv(a.actTM - a.lmHK, a.lmHK)) : null;
      const gLY = a.lyHK !== null ? pct(safeDiv(a.actTM - a.lyHK, a.lyHK)) : null;
      const chs = [...new Set(tRows.map(r => (r['Channel'] || '').toString().trim().toUpperCase()))].filter(Boolean);
      return {
        type, label: TYPE_LABELS[type] || type, channels: chs,
        actTM: a.actTM, lyHK: a.lyHK, lmHK: a.lmHK,
        growVsLY: gLY, growVsLM: gLM,
        share: safeDiv(a.actTM, totalActTM, 0) * 100,
        status: mkMTStatus(gLM, gLY)
      };
    }).sort((a, b) => b.actTM - a.actTM);

    // ── 4. byClass (SPRBIG, BIG, MEDIUM, SMALL ordering) ──
    const CLS_ORDER = ['SPRBIG', 'BIG', 'MEDIUM', 'SMALL'];
    const clsMap = {};
    rows.forEach(r => {
      const cls = (r['CLASS'] == null || r['CLASS'].toString().trim() === '')
        ? 'UNCLASSIFIED' : r['CLASS'].toString().trim().toUpperCase();
      (clsMap[cls] = clsMap[cls] || []).push(r);
    });
    const byClass = Object.entries(clsMap).map(([cls, cRows]) => {
      const a = aggRows(cRows);
      const gLM = a.lmHK !== null ? pct(safeDiv(a.actTM - a.lmHK, a.lmHK)) : null;
      const gLY = a.lyHK !== null ? pct(safeDiv(a.actTM - a.lyHK, a.lyHK)) : null;
      return {
        cls, actTM: a.actTM, lyHK: a.lyHK, lmHK: a.lmHK,
        caT: a.caT, caLM: a.caLM,
        growVsLY: gLY, growVsLM: gLM,
        share: safeDiv(a.actTM, totalActTM, 0) * 100,
        status: mkMTStatus(gLM, gLY)
      };
    }).sort((a, b) => {
      const ai = CLS_ORDER.indexOf(a.cls), bi = CLS_ORDER.indexOf(b.cls);
      if (ai < 0 && bi < 0) return b.actTM - a.actTM;
      if (ai < 0) return 1; if (bi < 0) return -1;
      return ai - bi;
    });

    // ── 5. byRegion ──
    const regMap = {};
    rows.forEach(r => {
      const reg = (r['Region'] || 'UNKNOWN').toString().trim();
      (regMap[reg] = regMap[reg] || []).push(r);
    });
    const byRegion = Object.entries(regMap).map(([region, rRows]) => {
      const a = aggRows(rRows);
      const gLM = a.lmHK !== null ? pct(safeDiv(a.actTM - a.lmHK, a.lmHK)) : null;
      const gLY = a.lyHK !== null ? pct(safeDiv(a.actTM - a.lyHK, a.lyHK)) : null;
      return {
        region, actTM: a.actTM, lyHK: a.lyHK, lmHK: a.lmHK,
        growVsLY: gLY, growVsLM: gLM,
        caT: a.caT, caLM: a.caLM, caChurn: a.caLM - a.caT
      };
    }).sort((a, b) => b.actTM - a.actTM);

    // ── 6. Concentration (top Sub Channel by Act TM) ──
    const scTotals = {};
    rows.forEach(r => {
      const sc = (r['Sub Channel'] || 'UNKNOWN').toString().trim();
      scTotals[sc] = (scTotals[sc] || 0) + safeNum(r['Act TM']);
    });
    const scTop    = Object.entries(scTotals).sort((a, b) => b[1] - a[1])[0] || ['--', 0];
    const topShare = safeDiv(scTop[1], totalActTM, 0) * 100;
    const concentration = {
      topSubChannel:      scTop[0],
      topSubChannelAct:   scTop[1],
      topSubChannelShare: topShare,
      isConcentrated:     topShare >= 40
    };

    // ── 7. Insight derivation ──
    const withLMt       = byType.filter(t => t.growVsLM !== null);
    const withLYt       = byType.filter(t => t.growVsLY !== null);
    const fastestGrowingLM = withLMt.length ? withLMt.reduce((m, t) => t.growVsLM > m.growVsLM ? t : m) : null;
    const fastestGrowingLY = withLYt.length ? withLYt.reduce((m, t) => t.growVsLY > m.growVsLY ? t : m) : null;
    const decliners     = byType.filter(t => (t.growVsLM ?? 0) < 0 || (t.growVsLY ?? 0) < 0);
    const biggestDecliner = decliners.length
      ? decliners.reduce((m, t) => ((t.growVsLM ?? 0) + (t.growVsLY ?? 0)) < ((m.growVsLM ?? 0) + (m.growVsLY ?? 0)) ? t : m)
      : null;
    const withLYr       = byRegion.filter(r => r.growVsLY !== null);
    const fastestRegion = withLYr.length ? withLYr.reduce((m, r) => r.growVsLY > m.growVsLY ? r : m) : null;
    const momentumRisk  = byRegion.filter(r => (r.growVsLM ?? 0) < 0).sort((a, b) => b.actTM - a.actTM)[0] || null;
    const critTypes     = byType.filter(t => t.status.key === 'critical').sort((a, b) => b.actTM - a.actTM);
    const focusType     = critTypes[0] || biggestDecliner || null;
    const topChurnCh    = byChannel
      .filter(c => c.caChurn > 0)
      .sort((a, b) => safeDiv(b.caChurn, b.caLM, 0) - safeDiv(a.caChurn, a.caLM, 0))[0] || null;

    const insight = {
      biggestChannel:   byChannel[0] || null,
      fastestGrowingLY,
      fastestGrowingLM,
      biggestDecliner,
      fastestRegion,
      momentumRisk,
      caOpportunity: {
        churned:         caChurnTot,
        potential:       recoveryPotential,
        topChurnChannel: topChurnCh ? topChurnCh.channel : null
      },
      focus: focusType ? {
        area:    focusType.label || focusType.type,
        reason:  focusType.status.label + ' -- ' + (focusType.share || 0).toFixed(1) + '% share',
        urgency: focusType.status.key
      } : null
    };

    return { hasData: true, overview, byChannel, byType, byClass, byRegion, concentration, insight };
  },

  /**
   * calcMTTimegone(mt, td) — Sprint 19A: MT5 Timegone Analysis.
   * Pure function. No State writes.
   *
   * BENCHMARK: LMHK (last month working-day-adjusted sales) used as full-month reference.
   * No Target column in MT sheet — tracks pace vs last month, not vs quota.
   *
   * Formulas mirror calcITGTimegone() exactly:
   *   ach         = (actTM / lmHK) × 100         [% of LM achieved so far]
   *   gapVsTG     = ach − timeGone                [pp ahead/behind pace]
   *   remainGap   = lmHK − actTM                  [sales still needed to match LM]
   *   reqDaily    = remainGap / hkRem              [Rp per remaining working day]
   *   proj        = (ach / timeGone) × 100        [projected ME as % of LM]
   *   recovNeed   = (reqRate / curRate − 1) × 100 [pace uplift needed]
   *
   * Status thresholds — same as BB2.5 + AHEAD tier:
   *   gapVsTG ≥  +5 → AHEAD    🟢
   *   gapVsTG ≥  −5 → ON TRACK 🟢
   *   gapVsTG ≥ −15 → RECOVERY 🟠
   *   else          → CRITICAL  🔴
   *
   * @param {object} mt  State.kpi.mt (output of calcMT — must already be computed)
   * @param {object} td  TimeEngine.get() result
   * @returns { hasData, header, cards[], insight }
   */
  calcMTTimegone: (mt, td) => {
    if (!mt || !mt.hasData || !Array.isArray(mt.byChannel) || !mt.byChannel.length || !td) {
      return { hasData: false, header: null, cards: [], insight: {} };
    }

    const tg = td.timeGone, hkRem = td.hkRem, hkPass = td.hkPass;
    const safeDiv = Utils.safeDiv;

    // Channel → card border colour mapping
    const CH_COLOR = { NKA: 'blue', MTI: 'green' };

    // Recovery-need interpretation — mirrors calcITGTimegone recovInterp exactly
    const mkRecovInterp = (rn) =>
      (rn === null || rn <= 0) ? { label: 'On Pace',                    cls: 'rn-onpace' }
      : rn <= 25               ? { label: 'Low Recovery Required',      cls: 'rn-low' }
      : rn <= 75               ? { label: 'Moderate Recovery Required', cls: 'rn-moderate' }
      : rn <= 125              ? { label: 'High Recovery Required',     cls: 'rn-high' }
      :                          { label: 'Critical Recovery Required', cls: 'rn-critical' };

    // Status — BB2.5 thresholds + AHEAD tier
    const mkStatus = (gapVsTG) =>
      gapVsTG >= 5   ? { key: 'ahead',    label: 'AHEAD',    icon: '\u{1F7E2}', cls: 'tg-ahead' }
    : gapVsTG >= -5  ? { key: 'ontrack',  label: 'ON TRACK', icon: '\u{1F7E2}', cls: 'tg-ahead' }
    : gapVsTG >= -15 ? { key: 'recovery', label: 'RECOVERY', icon: '\u{1F7E0}', cls: 'tg-ontrack' }
    :                  { key: 'critical', label: 'CRITICAL',  icon: '\u{1F534}', cls: 'tg-behind' };

    const mkCard = (ch) => {
      const color = CH_COLOR[ch.channel] || 'navy';
      // No LM data → card shown with placeholder (matches calcITGTimegone hasData: false pattern)
      if (ch.lmHK === null || ch.lmHK <= 0) {
        return { channel: ch.channel, color, hasData: false };
      }
      const ref    = ch.lmHK;                                           // Full-month LM reference
      const act    = ch.actTM;
      const ach    = safeDiv(act, ref, 0) * 100;                        // % of LM achieved
      const gapVsTG      = ach - tg;
      const remainGap    = ref - act;                                    // negative = already surpassed LM
      const reqDailySales = hkRem > 0 ? remainGap / hkRem : null;       // Rp/HK to match LM
      const proj   = tg > 0 ? (ach / tg) * 100 : null;                 // projected ME as % of LM
      const curRate = hkPass > 0 ? ach / hkPass : 0;                   // achievement% per elapsed HK
      const reqRate = hkRem > 0 ? (100 - ach) / hkRem : null;          // achievement% needed per remaining HK
      const recovNeed = (curRate > 0 && reqRate !== null)
        ? (safeDiv(reqRate, curRate, null) !== null ? (reqRate / curRate - 1) * 100 : null)
        : null;

      return {
        channel: ch.channel, color, hasData: true,
        act, ref, ach, gapVsTG, remainGap, reqDailySales,
        proj, recovNeed,
        status: mkStatus(gapVsTG),
        recovInterp: mkRecovInterp(recovNeed)
      };
    };

    const cards   = mt.byChannel.map(mkCard);
    const valid   = cards.filter(c => c.hasData);

    const worstGap    = valid.length ? valid.reduce((m, c) => c.gapVsTG < m.gapVsTG ? c : m) : null;
    const recovList   = valid.filter(c => c.recovNeed !== null && c.recovNeed > 0);
    const highRecov   = recovList.length ? recovList.reduce((m, c) => c.recovNeed > m.recovNeed ? c : m) : null;
    const projList    = valid.filter(c => c.proj !== null);
    const bestProj    = projList.length ? projList.reduce((m, c) => c.proj > m.proj ? c : m) : null;
    const bestChannel = valid.length ? valid.reduce((m, c) => c.ach > m.ach ? c : m) : null;

    return {
      hasData: valid.length > 0,
      header:  { timeGone: tg, hkPass: td.hkPass, hkTot: td.hkTot, hkRem: td.hkRem },
      cards,
      insight: { worstGap, highRecov, bestProj, bestChannel }
    };
  },

  /**
   * calculatePrincipleExecutiveSummary — Executive Summary Layer (above Section 1).
   *
   * REUSE: consumes already-aggregated k.perf.byPrin (no re-aggregation) + TimeEngine.
   * Fixed scope & order: GPPJ, GEN, GBS, MBR, then ALL PRINCIPLE (area aggregate).
   * Status vs Time Gone: ach ≥ TG+5 ON TRACK · within ±5 WATCHLIST · ach < TG−5 RECOVERY.
   *
   * @returns { hasData, timeGone, cards[], summary{count,best,worst,avg}, insights[] }
   */
  calculatePrincipleExecutiveSummary: (k) => {
    const perf = k.perf || {};
    const byPrin = perf.byPrin || [];
    const td = TimeEngine.get();
    const timeGone = td.timeGone;

    const FIXED = ['GPPJ', 'GEN', 'GBS', 'MBR'];
    const lookup = {};
    byPrin.forEach(p => { lookup[(p.principle || '').toUpperCase().trim()] = p; });

    const mkStatus = (ach) => {
      const gap = ach - timeGone;
      if (gap >= 5)  return { key: 'ontrack',   label: 'ON TRACK',  icon: '🟢', cls: 'st-ontrack',   badge: 'solid-green' };
      if (gap <= -5) return { key: 'recovery',  label: 'RECOVERY',  icon: '🔴', cls: 'st-recovery',  badge: 'solid-red' };
      return            { key: 'watchlist', label: 'WATCHLIST', icon: '🟠', cls: 'st-watchlist', badge: 'solid-amber' };
    };

    // Build a card from a principle-like object {tgt,act,gap,ach,trend}. Missing → placeholder.
    const mkCard = (name, pr, isArea) => {
      if (!pr) return { name, isArea: !!isArea, missing: true };
      const tgt = Utils.safeNum(pr.tgt), act = Utils.safeNum(pr.act);
      const gap = pr.gap != null ? pr.gap : act - tgt;
      const ach = pr.ach != null ? pr.ach : Utils.calcAch(act, tgt);
      const actRR = TimeEngine.actualRR(act, td.hkPass);
      const reqRR = act >= tgt ? 0 : TimeEngine.runRate(tgt - act, td.hkRem);
      const vsLM = pr.trend ? pr.trend.vsLM : null;
      const vsLY = pr.trend ? pr.trend.vsLY : null;
      return {
        name, isArea: !!isArea, missing: false,
        tgt, act, gap, ach, actRR, reqRR, vsLM, vsLY,
        gapVsPace: ach - timeGone,
        status: mkStatus(ach)
      };
    };

    const cards = FIXED.map(n => mkCard(n, lookup[n], false));

    // ── ALL PRINCIPLE — reuse Master Sales Performance totals (no duplicate aggregation) ──
    const totLY = byPrin.reduce((s, p) => s + Utils.safeNum(p.ly), 0); // LY not tracked on perf totals
    const allPr = {
      tgt: perf.totTgt, act: perf.totAct, gap: perf.gap, ach: perf.ach,
      trend: {
        vsLM: perf.trend ? perf.trend.vsLM : null,
        vsLY: totLY > 0 ? Utils.safeDiv(Utils.safeNum(perf.totAct) - totLY, totLY) * 100 : null
      }
    };
    cards.push(mkCard('ALL PRINCIPLE', (perf.totTgt != null ? allPr : null), true));

    // ── Top summary — over the 4 NAMED principles present in data only ──
    const named = cards.filter(c => !c.isArea && !c.missing);
    const best  = named.length ? named.reduce((m, c) => c.ach > m.ach ? c : m) : null;
    const worst = named.length ? named.reduce((m, c) => c.ach < m.ach ? c : m) : null;
    const avg   = named.length ? named.reduce((s, c) => s + c.ach, 0) / named.length : null;

    // ── 3 automated executive insights ──
    const insights = [];
    if (named.length) {
      const topAct = named.reduce((m, c) => c.act > m.act ? c : m);
      insights.push({ tone: best.ach >= timeGone ? 'positive' : 'warning',
        text: `${best.name} memimpin achievement di ${Utils.fmtPct(best.ach)} dan ${best.ach >= timeGone ? 'sudah berada di atas pace' : 'masih sedikit di bawah pace'} (Time Gone ${Utils.fmtPct(timeGone)}).` });
      insights.push({ tone: worst.status.key === 'recovery' ? 'negative' : 'warning',
        text: `${worst.name} terendah di ${Utils.fmtPct(worst.ach)} — ${worst.status.key === 'recovery' ? 'masuk zona RECOVERY dan butuh akselerasi' : 'perlu didorong agar mengejar pace'}.` });
      insights.push({ tone: topAct.gap < 0 ? 'warning' : 'positive',
        text: `${topAct.name} menyumbang actual terbesar (${Utils.fmtCompact(topAct.act)}) ${topAct.gap < 0 ? 'meski masih di bawah target' : 'dan tetap on track terhadap target'}.` });
    } else {
      insights.push({ tone: 'neutral', text: 'Data principle (GPPJ, GEN, GBS, MBR) tidak tersedia pada filter saat ini.' });
    }

    return {
      hasData: byPrin.length > 0,
      timeGone,
      cards,
      summary: { count: named.length, best, worst, avg },
      insights
    };
  },

  calcClassAnalysis: (arj, bim, sc) => {
    // ── Auto-detect Class column (tolerant of naming variations) ──
    const findClassCol = (rows) => {
      if (!rows.length) return null;
      const keys = Object.keys(rows[0]);
      // Priority: exact → contains 'class' case-insensitive
      return keys.find(k => k.trim() === 'Class (Target Q2)')
          || keys.find(k => k.trim().toLowerCase() === 'class')
          || keys.find(k => k.trim().toLowerCase().includes('class'))
          || null;
    };

    // ── Normalize class value to consistent casing ──
    const normalizeClass = (v) => {
      if (!v) return null;
      const s = v.toString().trim();
      if (!s) return null;
      // Map to canonical display names
      const map = {
        'superbig+': 'Superbig+',
        'superbig' : 'Superbig',
        'big upper': 'Big Upper',
        'big'      : 'Big',
        'medium'   : 'Medium',
        'bronze'   : 'Bronze',
        'silver'   : 'Silver',
      };
      return map[s.toLowerCase()] || s; // fallback: keep original casing
    };

    const byClass = (rows, isQty = false) => {
      if (!rows.length) return [];

      const classCol = findClassCol(rows);

      if (!classCol) {
        console.warn('[BB4] Class column NOT found. Available keys:', Object.keys(rows[0]));
      }

      const map = {};
      rows.forEach(r => {
        const rawClass = classCol ? r[classCol] : null;
        const cls = normalizeClass(rawClass) || 'Lainnya';
        if (!map[cls]) map[cls] = { cls, participants: 0, target: 0, actual: 0, lm: 0, ly: 0, trx: 0 };
        const m = map[cls];
        m.participants++;
        m.target += Utils.safeNum(r['Target TM']);
        m.actual += Utils.safeNum(r['Act TM']);
        m.lm     += Utils.safeNum(r['LMHK']);
        m.ly     += Utils.safeNum(r['LYHK']);
        if (Utils.safeNum(r['Act TM']) > 0) m.trx++;
      });

      const ORDER = ['Superbig+','Superbig','Big Upper','Big','Medium','Bronze','Silver','Lainnya'];
      return Object.values(map).map(m => {
        const trend = TrendEngine.calc(m.actual, m.lm || null, m.ly || null);
        return {
          cls:          m.cls,
          participants: m.participants,
          target:       m.target,
          actual:       m.actual,
          lm:           m.lm,
          ly:           m.ly,
          trx:          m.trx,
          ach:          Utils.calcAch(m.actual, m.target),
          trend,                        // full TrendEngine snapshot
          vsLM:         trend.vsLM,     // direct access for table rendering
          vsLY:         trend.vsLY,
          outletTrxPct: m.participants > 0 ? (m.trx / m.participants) * 100 : 0,
          isQty
        };
      }).sort((a, b) => {
        const ia = ORDER.indexOf(a.cls), ib = ORDER.indexOf(b.cls);
        if (ia === -1 && ib === -1) return b.actual - a.actual;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    };

    return {
      clsArj: byClass(arj, false),
      clsBim: byClass(bim, false),
      clsSc:  byClass(sc,  true)
    };
  },

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION 5 — EXECUTIVE DECISION CENTER BUILDERS
  // Data Contract v1.0.0 — See: docs/Section5_TechnicalDesignSpec.md
  //
  // Dependency order (enforced by calculateExecutiveDecision assembler):
  //   buildRisk → buildOpportunity → buildAction → buildImpact
  //
  // Rules:
  //   • Each builder owns exactly one domain sub-object
  //   • No business logic inside calculateExecutiveDecision (assembler only)
  //   • Do NOT modify State.kpi.perf, State.kpi.ca, or any other existing KPI
  //   • Section5View reads ONLY from State.kpi.executiveDecision
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * buildRisk — Phase 1
   *
   * Produces State.kpi.executiveDecision.risk
   *
   * Inputs:
   *   perf       — State.kpi.perf (output of calcPerformance)
   *   td         — TimeEngine.get() snapshot
   *   anomalies  — State.kpi.anomalies[] (output of AnomalyEngine)
   *
   * Formulas (ref: Section5_ExecutiveDecisionCenter_Spec.md §Risk):
   *   impliedDailyAvg    = totAct / hkPass          (= perf.actRR)
   *   monthEndProj       = (actRR × hkTot) / totTgt × 100
   *   requiredDailyAvg   = (totTgt − totAct) / hkRem
   *   requiredMultiplier = requiredDailyAvg / impliedDailyAvg
   *   classification: >2.00 UNREACHABLE | >1.50 CRITICAL | >1.20 AT_RISK | ≤1.20 ON_TRACK
   *   Edge: hkRem ≤ 3 AND mult > 1.30 AND AT_RISK → auto CRITICAL
   */
  buildRisk: (perf, td, anomalies) => {
    const C = CONSTANTS.EXEC_DECISION;

    // Implied daily average — already computed by calcPerformance as actRR
    const impliedDailyAvg = perf.actRR;  // totAct / hkPass

    // Required daily average to reach target in remaining working days
    const requiredDailyAvg = td.hkRem > 0
      ? Math.max(0, (perf.totTgt - perf.totAct) / td.hkRem)
      : 0;

    // Required multiplier: how much harder the team must push vs current pace
    const requiredMultiplier = impliedDailyAvg > 0
      ? requiredDailyAvg / impliedDailyAvg
      : (requiredDailyAvg > 0 ? 99 : 0);

    // Classify by required multiplier
    let classification;
    if      (requiredMultiplier > 2.00) classification = 'UNREACHABLE';
    else if (requiredMultiplier > 1.50) classification = 'CRITICAL';
    else if (requiredMultiplier > 1.20) classification = 'AT_RISK';
    else                                classification = 'ON_TRACK';

    // End-of-month edge case: very few days left + underperforming → escalate to CRITICAL
    if (td.hkRem <= 3 && requiredMultiplier > 1.30 && classification === 'AT_RISK') {
      classification = 'CRITICAL';
    }

    // Month-end projection: extrapolate current daily rate to full month
    const monthEndProj = perf.totTgt > 0
      ? (impliedDailyAvg * td.hkTot) / perf.totTgt * 100
      : 0;

    // Projected shortfall at month end (positive = below target; negative = surplus)
    const shortfall = perf.totTgt - (impliedDailyAvg * td.hkTot);

    // Worst territory: depo with highest required multiplier
    let worstTerritory = null;
    if (perf.byDepo && perf.byDepo.length > 0) {
      let worstMult = -Infinity;
      perf.byDepo.forEach(d => {
        if (d.tgt <= 0) return;
        const depoActRR = td.hkPass > 0 ? d.act / td.hkPass : 0;
        const depoReqRR = td.hkRem  > 0 ? Math.max(0, (d.tgt - d.act) / td.hkRem) : 0;
        const depoMult  = depoActRR > 0
          ? depoReqRR / depoActRR
          : (depoReqRR > 0 ? 99 : 0);
        if (depoMult > worstMult) {
          worstMult = depoMult;
          let depoCls;
          if      (depoMult > 2.00) depoCls = 'UNREACHABLE';
          else if (depoMult > 1.50) depoCls = 'CRITICAL';
          else if (depoMult > 1.20) depoCls = 'AT_RISK';
          else                      depoCls = 'ON_TRACK';
          const depoProj = d.tgt > 0 ? (depoActRR * td.hkTot / d.tgt * 100) : 0;
          worstTerritory = {
            territoryName:      d.depo,
            requiredMultiplier: parseFloat(depoMult.toFixed(2)),
            classification:     depoCls,
            monthEndProj:       parseFloat(depoProj.toFixed(1))
          };
        }
      });
    }

    // Anomaly flags: map high-severity anomalies to readable strings (max 5)
    const anomalyFlags = (anomalies || [])
      .filter(a => a && (a.severity === 'critical' || a.severity === 'warning'))
      .slice(0, 5)
      .map(a => `${a.label || a.type} — ${a.area || ''}`);

    return {
      classification,
      monthEndProj:       parseFloat(monthEndProj.toFixed(1)),
      requiredMultiplier: parseFloat(requiredMultiplier.toFixed(2)),
      impliedDailyAvg,
      requiredDailyAvg,
      shortfall:          Math.round(shortfall),
      progressPct:        perf.ach,
      totAct:             perf.totAct,
      totTgt:             perf.totTgt,
      worstTerritory,
      anomalyFlags
    };
  },

  /**
   * buildOpportunity — Phase 2
   *
   * Produces State.kpi.executiveDecision.opportunity
   *
   * Inputs:
   *   caMasterData — State.filtered.caMaster (raw filtered rows, or empty array)
   *   perf         — State.kpi.perf
   *
   * Formulas (ref: Section5_ExecutiveDecisionCenter_Spec.md §Opportunity):
   *   caActiveRate_T  = CA_TM_T / max(1, CA_LM_T)
   *   inactiveCA_T    = max(0, CA_LM_T − CA_TM_T)
   *   avgTicketLM_T   = perfLM_T / max(1, CA_LM_T)
   *   recoveryValue_T = inactiveCA_T × avgTicketLM_T
   *   qualify_T       = caActiveRate_T ≥ 0.80
   *
   * Data source: CA_Master preferred (caKey='CA TM'), fallback to perf (caKey='CA').
   * Revenue LM per territory: joined from State.kpi.perf.byReg via Region key.
   */
  buildOpportunity: (caMasterData, perf) => {
    const C = CONSTANTS.EXEC_DECISION;

    // Data source: CA_Master preferred, fallback to Performance sheet rows
    const useCaMaster = Array.isArray(caMasterData) && caMasterData.length > 0;
    const caData  = useCaMaster ? caMasterData : (State.filtered.perf || []);
    const caKey   = useCaMaster ? 'CA TM' : 'CA';
    const caLMKey = 'CA LM';

    // Build revenue-per-region lookup from perf.byReg
    const perfByRegMap = {};
    (perf.byReg || []).forEach(r => { perfByRegMap[r.region] = r; });

    // Aggregate CA by Region in one pass
    const regionMap = {};
    caData.forEach(r => {
      const region = ((r['Region'] || '') + '').trim() || '(Lainnya)';
      const caTM   = Utils.safeNum(r[caKey]);
      const caLM   = Utils.safeNum(r[caLMKey]);
      if (!regionMap[region]) regionMap[region] = { caTM: 0, caLM: 0 };
      regionMap[region].caTM += caTM;
      regionMap[region].caLM += caLM;
    });

    // Overall totals
    let totalCaTM = 0, totalCaLM = 0;
    Object.values(regionMap).forEach(v => { totalCaTM += v.caTM; totalCaLM += v.caLM; });

    // Overall CA active rate (0–1 ratio)
    const caActiveRateOverall = totalCaLM > 0 ? totalCaTM / totalCaLM : 1;

    // Overall avg ticket LM = aggregate LM revenue / aggregate LM CA count
    const avgTicketLM = totalCaLM > 0 ? (perf.totLM || 0) / totalCaLM : 0;

    // Per-territory opportunity classification
    const qualified    = [];
    const partial      = [];
    const disqualified = [];
    let totalRecoveryValue = 0;
    let totalInactiveCA    = 0;

    Object.entries(regionMap).forEach(([regionName, v]) => {
      if (v.caLM <= 0) return;  // skip: no LM baseline for this territory

      const caActiveRate = v.caTM / v.caLM;
      const inactiveCA   = Math.max(0, v.caLM - v.caTM);

      // Per-territory avg ticket: use perf LM revenue for this region / region CA LM count
      const perfReg       = perfByRegMap[regionName];
      const regLMRevenue  = perfReg ? (perfReg.lm || 0) : (perf.totLM || 0);
      const terrAvgTicket = v.caLM > 0 ? regLMRevenue / v.caLM : avgTicketLM;

      const recoveryValue = inactiveCA * terrAvgTicket;

      // Role assigned based on this territory's recovery value
      let assignedRole;
      if      (recoveryValue > C.ROLE_NSM_THRESHOLD) assignedRole = 'NSM';
      else if (recoveryValue > C.ROLE_AGM_THRESHOLD) assignedRole = 'AGM';
      else                                           assignedRole = 'Supervisor';

      const entry = {
        territoryName: regionName,
        inactiveCA,
        recoveryValue: Math.round(recoveryValue),
        caActiveRate:  parseFloat(caActiveRate.toFixed(4)),
        assignedRole
      };

      if (caActiveRate >= C.CA_ACTIVE_RATE_QUALIFIED) {
        qualified.push(entry);
        totalRecoveryValue += recoveryValue;
        totalInactiveCA    += inactiveCA;
      } else if (caActiveRate >= C.CA_ACTIVE_RATE_PARTIAL) {
        partial.push(entry);
      } else {
        disqualified.push(entry);
      }
    });

    // Sort by recovery value descending (highest opportunity first)
    qualified.sort((a, b) => b.recoveryValue - a.recoveryValue);
    partial.sort((a, b) => b.recoveryValue - a.recoveryValue);
    disqualified.sort((a, b) => b.recoveryValue - a.recoveryValue);

    // Overall qualification status
    let qualificationStatus, qualificationReason;
    if (caActiveRateOverall >= C.CA_ACTIVE_RATE_QUALIFIED) {
      qualificationStatus = 'QUALIFIED';
      qualificationReason = `CA active rate ${Math.round(caActiveRateOverall * 100)}% ≥ 80% — peluang recovery nyata, bukan masalah struktural.`;
    } else if (caActiveRateOverall >= C.CA_ACTIVE_RATE_PARTIAL) {
      qualificationStatus = 'PARTIAL';
      qualificationReason = `CA active rate ${Math.round(caActiveRateOverall * 100)}% — sebagian territory dapat di-recovery, sebagian struktural.`;
    } else {
      qualificationStatus = 'DISQUALIFIED';
      qualificationReason = `CA active rate ${Math.round(caActiveRateOverall * 100)}% < 60% — indikasi masalah struktural, bukan executional.`;
    }

    return {
      totalRecoveryValue:  Math.round(totalRecoveryValue),
      totalInactiveCA,
      caActiveRateOverall: parseFloat(caActiveRateOverall.toFixed(4)),
      avgTicketLM:         Math.round(avgTicketLM),
      qualificationStatus,
      qualificationReason,
      qualifiedTerritories:    qualified,
      partialTerritories:      partial,
      disqualifiedTerritories: disqualified,
      decayRatePerDay: C.DECAY_RATE_PER_DAY
    };
  },

  /**
   * buildAction — Phase 3
   *
   * Produces State.kpi.executiveDecision.action
   *
   * Inputs:
   *   opportunity — output of buildOpportunity()
   *   risk        — output of buildRisk()
   *   perf        — State.kpi.perf
   *   td          — TimeEngine.get() snapshot
   *
   * Formulas (ref: Section5_ExecutiveDecisionCenter_Spec.md §Action):
   *   callTarget           = min(totalInactiveCA, floor(hkRem × CALLS_PER_DAY))
   *   expectedRevenueToday = min(callTarget, MAX_EXPECTED_CALLS) × avgTicketLM
   *   role: >5B NSM | 2–5B AGM | <2B Supervisor
   *   deadlineDate         = D{hkPass+1}
   *   escalationTriggerDay = min(hkPass + WINDOW, hkTot)
   *   urgencySignal: CRITICAL/UNREACHABLE → ACT_NOW | AT_RISK → PROCEED | ON_TRACK → MONITOR
   */
  buildAction: (opportunity, risk, perf, td) => {
    const C = CONSTANTS.EXEC_DECISION;

    // Primary territory: highest recovery-value qualified territory
    const topTerritory     = opportunity.qualifiedTerritories[0] || null;
    const primaryTerritory = topTerritory ? topTerritory.territoryName : '(Semua Wilayah)';

    // Call target: realistic capacity given remaining days
    const callTarget = Math.min(
      opportunity.totalInactiveCA,
      Math.floor(td.hkRem * C.CALLS_PER_DAY)
    );

    // Expected revenue today from calls placed today
    const expectedRevenueToday = Math.round(
      Math.min(callTarget, C.MAX_EXPECTED_CALLS) * opportunity.avgTicketLM
    );

    // Primary role: who must own and drive this action
    let primaryRole;
    if      (opportunity.totalRecoveryValue > C.ROLE_NSM_THRESHOLD) primaryRole = 'NSM';
    else if (opportunity.totalRecoveryValue > C.ROLE_AGM_THRESHOLD) primaryRole = 'AGM';
    else                                                             primaryRole = 'Supervisor';

    // Brand focus: principle with the most negative gap (largest absolute shortfall)
    let brandFocus = null;
    if (perf.byPrin && perf.byPrin.length > 0) {
      const worstPrin = perf.byPrin
        .filter(p => p.gap < 0)
        .sort((a, b) => a.gap - b.gap)[0];
      brandFocus = worstPrin ? worstPrin.principle : null;
    }

    // Deadline: call campaigns start today, active by next working day
    const deadlineTime = C.ACTION_DEADLINE_TIME;
    const deadlineDate = `D${td.hkPass + 1}`;

    // Escalation: triggered if ach < threshold by trigger day
    const escalationTriggerDay = Math.min(td.hkPass + C.ESCALATION_WINDOW_DAYS, td.hkTot);
    const escalationThreshold  = C.ESCALATION_THRESHOLD;
    const escalationOwner      = 'NSM';
    const escalationCondition  =
      `Jika D${escalationTriggerDay} achievement <${escalationThreshold}% dari target → eskalasi ke ${escalationOwner}`;

    // Urgency signal: derived from risk classification
    let urgencySignal;
    if (risk.classification === 'CRITICAL' || risk.classification === 'UNREACHABLE') {
      urgencySignal = 'ACT_NOW';
    } else if (risk.classification === 'AT_RISK') {
      urgencySignal = 'PROCEED';
    } else {
      urgencySignal = 'MONITOR';
    }

    return {
      callTarget,
      expectedRevenueToday,
      primaryRole,
      primaryTerritory,
      brandFocus,
      deadlineTime,
      deadlineDate,
      escalationCondition,
      escalationTriggerDay,
      escalationThreshold,
      escalationOwner,
      urgencySignal
    };
  },

  /**
   * buildImpact — Phase 4
   *
   * Produces State.kpi.executiveDecision.impact
   *
   * Inputs:
   *   risk        — output of buildRisk()
   *   opportunity — output of buildOpportunity()
   *   perf        — State.kpi.perf
   *   td          — TimeEngine.get() snapshot
   *
   * Formulas (ref: Section5_ExecutiveDecisionCenter_Spec.md §Impact):
   *   doNothingProjection  = monthEndProj (identical value, different narrative)
   *   withActionProjection = (totAct + recoveryValue + actRR × hkRem) / totTgt × 100
   *   deltaProjection      = withAction − doNothing
   *   decayPerDay          = totalRecoveryValue × DECAY_RATE_PER_DAY
   *   viabilityDays        = floor(log(MIN_VIABLE / rv) / log(1 − decayRate))
   *   viabilityDate        = today + viabilityDays calendar days
   */
  buildImpact: (risk, opportunity, perf, td) => {
    const C = CONSTANTS.EXEC_DECISION;

    // Do-nothing: same trajectory as current (identical to risk.monthEndProj)
    const doNothingProjection = risk.monthEndProj;

    // With-action: add recovered inactive CA value + continue current daily pace
    const projectedTotal = perf.totAct
      + opportunity.totalRecoveryValue
      + (risk.impliedDailyAvg * td.hkRem);
    const withActionProjection = perf.totTgt > 0
      ? parseFloat((projectedTotal / perf.totTgt * 100).toFixed(1))
      : 0;

    const deltaProjection = parseFloat((withActionProjection - doNothingProjection).toFixed(1));
    const deltaValue      = opportunity.totalRecoveryValue;

    // Value decay: inactive outlets self-activate at DECAY_RATE each day the team delays
    const decayPerDay = Math.round(opportunity.totalRecoveryValue * C.DECAY_RATE_PER_DAY);

    // Viability window: how many days before recovery value drops below MIN_VIABLE_RECOVERY
    // Formula: rv × (1−rate)^n = min  →  n_max = floor(log(min/rv) / log(1−rate))
    let viabilityDays = 0;
    let viabilityDate = null;
    const rv = opportunity.totalRecoveryValue;
    if (rv > C.MIN_VIABLE_RECOVERY) {
      viabilityDays = Math.floor(
        Math.log(C.MIN_VIABLE_RECOVERY / rv) / Math.log(1 - C.DECAY_RATE_PER_DAY)
      );
      const d = new Date();
      d.setDate(d.getDate() + viabilityDays);
      viabilityDate = d.toISOString().split('T')[0];
    } else if (rv > 0) {
      viabilityDays = 0;
      viabilityDate = new Date().toISOString().split('T')[0];
    }

    return {
      doNothingProjection,
      withActionProjection,
      deltaProjection,
      deltaValue:   Math.round(deltaValue),
      viabilityDays,
      viabilityDate,
      decayPerDay
    };
  },

  /**
   * calculateExecutiveDecision — Phase 5 (ASSEMBLER ONLY)
   *
   * Produces State.kpi.executiveDecision (full contract v1.0.0)
   *
   * CONTRACT: This function MUST NOT contain business logic.
   * All calculations belong in the four builders above.
   * This function calls builders in dependency order and packages the result.
   *
   * Wire-up in runAll():
   *   State.kpi.executiveDecision = _section('calculateExecutiveDecision',
   *     () => KPIEngine.calculateExecutiveDecision(), null);
   *
   * Returns null if perf data is unavailable (prevents Section5View crash).
   */
  calculateExecutiveDecision: () => {
    const td   = TimeEngine.get();
    const perf = State.kpi.perf;

    // Guard: perf must be populated before this assembler runs
    if (!perf || !perf.totTgt) return null;

    // Build in dependency order — risk first, then opp, then action/impact (depend on both)
    const risk        = KPIEngine.buildRisk(perf, td, State.kpi.anomalies || []);
    const opportunity = KPIEngine.buildOpportunity(State.filtered.caMaster, perf);
    const action      = KPIEngine.buildAction(opportunity, risk, perf, td);
    const impact      = KPIEngine.buildImpact(risk, opportunity, perf, td);

    // Meta: generation context snapshot
    // NOTE: perf.timeGone is 0–100 (from TimeEngine); contract requires 0.0–1.0
    const meta = {
      schemaVersion: '1.0.0',
      generatedAt:   new Date().toISOString(),
      dataDate:      new Date().toISOString().split('T')[0],
      hkPass:        td.hkPass,
      hkRem:         td.hkRem,
      hkTot:         td.hkTot,
      timeGone:      perf.timeGone / 100,  // 0–100 → 0.0–1.0
      activeFilters: {
        regions:    [...(State.filters.regions    || [])],
        principles: [...(State.filters.principles || [])],
        channels:   [...(State.filters.channels   || [])],
        depos:      [...(State.filters.depos      || [])],
      }
    };

    return { meta, risk, opportunity, action, impact };
  }
};
