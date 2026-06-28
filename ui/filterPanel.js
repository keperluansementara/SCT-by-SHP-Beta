// ==========================================
// UI LAYER — filterPanel.js
// ==========================================
// Extracted from SCT-by-SHP.html
//   DOM helpers    : lines 1369–1375
//   Components     : lines 1377–1629
//   MultiSelect    : lines 1631–1663
//   FilterEngine   : lines 1942–2121
//
// Dependencies (globals resolved at runtime):
//   Config, State, Utils, TimeEngine, TrendEngine,
//   ChartEngine, PrincipleCommentaryEngine
//
// NO business logic — all HTML builders and filter machinery only.
// ==========================================

// DOM helpers → extracted to ui/dom.js
// Must be loaded before this file: <script src="ui/dom.js">

// ==========================================
// COMPONENTS — HTML builder helpers
// ==========================================
const Components = {
  progRow: (label, ach, paceAware = false) => {
    const w = Math.min(Math.abs(ach), 100);
    const colorClass = paceAware ? Utils.getPaceClass(ach) : Utils.getPillClass(ach);
    const txtClass = 'text-' + colorClass.replace('bg-', '');   // pct text follows bar/status color
    return `
      <div class="prog-row">
        <div class="prog-label" title="${label}">${label}</div>
        <div class="prog-track"><div class="prog-fill ${colorClass}" style="width:${w}%"></div></div>
        <div class="prog-pct ${txtClass}">${Utils.fmtPct(ach)}</div>
      </div>
    `;
  },

  trafficLight: (name, ach, extra = '', labelExtra = '') => {
    const colorHash = ach >= 90 ? Config.COLORS.green : ach >= 60 ? Config.COLORS.amber : Config.COLORS.red;
    const txtClass = Utils.getTextClass(ach);
    return `
      <div class="tl-row">
        <div class="tl-dot" style="background-color:${colorHash}"></div>
        <div class="tl-name" title="${name}">${name} ${labelExtra}</div>
        <div class="tl-pct ${txtClass}">${Utils.fmtPct(ach)}</div>
        ${extra}
      </div>
    `;
  },

  paretoTable: (data, isQty = false) => {
    return data.map((r, i) => {
      const tgt = Utils.fmtCompact(Utils.safeNum(r['Target TM']));
      const act = Utils.fmtCompact(Utils.safeNum(r['Act TM']));
      const a = r._ach || 0;
      return `<tr>
        <td>${i+1}</td>
        <td class="truncate" style="max-width:130px" title="${r['Nama Pelanggan']}">${r['Nama Pelanggan']}</td>
        <td class="text-xs">${r['Region'] || '—'}</td>
        <td class="font-mono text-xs">${tgt}</td>
        <td class="font-mono text-xs">${act}</td>
        <td><span class="pill ${Utils.getPillClass(a)}">${Utils.fmtPct(a)}</span></td>
      </tr>`;
    }).join('');
  },

  /**
   * statBadge — canonical Stat column badge renderer.
   * Uses PerformanceStatus engine output — solid fill, always shows icon + label.
   * Primary use: Principle table Stat column, Time Gone Analysis card.
   *
   * @param {object} ps   Result of Utils.getPerformanceStatus() or TimeEngine.evalStatus()
   * @param {object} [opts]
   * @param {boolean} [opts.showGap=false]   Append gap value e.g. "+3.2%"
   * @param {boolean} [opts.muted=false]     Use muted tint variant instead of solid
   * @param {string}  [opts.extraStyle='']   Additional inline style string
   * @returns {string}  HTML string — a <span class="stat-badge …">…</span>
   */
  statBadge: (ps, opts = {}) => {
    const { showGap = false, muted = false, extraStyle = '' } = opts;
    const cls  = muted ? ps.statMutedCls : ps.statCls;
    const gap  = showGap ? ` <span style="opacity:.8;font-size:9px">(${ps.gap >= 0 ? '+' : ''}${ps.gap.toFixed(1)}%)</span>` : '';
    return `<span class="stat-badge ${cls}" style="${extraStyle}">${ps.label}${gap}</span>`;
  },

  /**
   * statBadgeCompact — minimal version for tight spaces (priority action sidebar, TG card).
   * Shows icon + label, no gap annotation.
   * @param {object} ps  Result of Utils.getPerformanceStatus()
   * @returns {string}
   */
  statBadgeCompact: (ps) => {
    return `<span class="stat-badge ${ps.statCls}" style="font-size:9px;padding:2px 6px">${ps.label}</span>`;
  },

  /**
   * generateDepotRanking(byDepo, n, td) — compact TOP/BOTTOM depo table.
   * Sorting: TOP → desc by ach%, BOTTOM → asc by ach%.
   * Filter: tgt > 0, depo non-blank (enforced in calcPerformance).
   * Need/HK: already computed per depo in calcPerformance.
   * @param {Array}  byDepo  res.byDepo from calcPerformance
   * @param {number} n       rows per side (default 5)
   * @param {object} td      TimeEngine.get() snapshot
   * @returns {string} HTML
   */
  generateDepotRanking: (byDepo, n = 5, td) => {
    if (!byDepo || !byDepo.length) return '';

    const achCls = (ach) =>
      ach >= 100 ? 'bg-green' : ach >= 80 ? 'bg-amber' : 'bg-red';

    const buildRows = (rows, isTop) => rows.map((d, i) => {
      const rankBg   = isTop ? 'var(--green-main)' : 'var(--red-main)';
      const gapFmt   = (d.gap >= 0 ? '+' : '') + Utils.fmtCompact(d.gap);
      const needFmt  = d.needHK > 0 ? Utils.fmtCompact(d.needHK) + '/HK' : '—';
      const vsLMFmt  = d.trend.hasLM
        ? (d.trend.vsLM >= 0 ? '+' : '') + d.trend.vsLM.toFixed(1) + '%'
        : '—';
      const vsLMCl   = d.trend.hasLM
        ? (d.trend.vsLM >= 0 ? 'var(--green-main)' : 'var(--red-main)')
        : 'var(--gray-400)';
      const vsLYFmt  = d.trend.hasLY
        ? (d.trend.vsLY >= 0 ? '+' : '') + d.trend.vsLY.toFixed(1) + '%'
        : '—';
      const vsLYCl   = d.trend.hasLY
        ? (d.trend.vsLY >= 0 ? 'var(--green-main)' : 'var(--red-main)')
        : 'var(--gray-400)';
      return `<tr>
        <td style="width:22px">
          <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:3px;background:${rankBg};color:#fff;font-size:9px;font-weight:800;font-family:var(--font-mono)">${i+1}</span>
        </td>
        <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:10px" title="${d.depo}">${d.depo}</td>
        <td style="font-size:9px;color:var(--gray-500)">${d.region}</td>
        <td class="font-mono" style="font-size:9px">${Utils.fmtCompact(d.tgt)}</td>
        <td class="font-mono" style="font-size:9px">${Utils.fmtCompact(d.act)}</td>
        <td><span class="pill ${achCls(d.ach)}" style="font-size:9px;padding:1px 5px">${d.ach.toFixed(1)}%</span></td>
        <td class="font-mono" style="font-size:9px;color:${d.gap >= 0 ? 'var(--green-main)' : 'var(--red-main)'}">${gapFmt}</td>
        <td class="font-mono" style="font-size:9px;color:var(--amber-main)">${needFmt}</td>
        <td class="font-mono" style="font-size:9px;color:${vsLMCl}">${vsLMFmt}</td>
        <td class="font-mono" style="font-size:9px;color:${vsLYCl}">${vsLYFmt}</td>
      </tr>`;
    }).join('');

    const top  = [...byDepo].sort((a, b) => b.ach - a.ach).slice(0, n);
    const bot  = [...byDepo].sort((a, b) => a.ach - b.ach).slice(0, n);

    const thead = `<thead><tr>
      <th>#</th><th>Depo</th><th>Reg</th>
      <th>Tgt</th><th>Act</th><th>%BP</th>
      <th>Gap</th><th>Need/HK</th><th>vs LM</th><th>vs LY</th>
    </tr></thead>`;

    return `
      <div style="margin-top:10px">
        <div class="sub-section-title" style="font-size:9px;margin-bottom:8px">📦 DEPOT ACHIEVEMENT RANKING</div>
        <!-- TOP 5 — full width -->
        <div style="margin-bottom:10px">
          <div style="font-size:9px;font-weight:700;color:var(--green-main);margin-bottom:4px;display:flex;align-items:center;gap:5px">
            🏆 TOP ${n} DEPO <span class="badge bg-green" style="font-size:8px;padding:1px 5px">GOOD</span>
          </div>
          <table class="data-table" style="font-size:9px;width:100%">
            ${thead}<tbody>${buildRows(top, true)}</tbody>
          </table>
        </div>
        <!-- BOTTOM 5 — full width, below TOP -->
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--red-main);margin-bottom:4px;display:flex;align-items:center;gap:5px">
            ⚠ BOTTOM ${n} DEPO <span class="badge bg-red" style="font-size:8px;padding:1px 5px">DANGER</span>
          </div>
          <table class="data-table" style="font-size:9px;width:100%">
            ${thead}<tbody>${buildRows(bot, false)}</tbody>
          </table>
        </div>
      </div>`;
  },

  generatePSTopBottomTable: (rows, mode, type, n = 10) => {
    if (!rows || !rows.length) {
      return `<div style="padding:12px;color:var(--gray-500);font-size:11px">Data PS tidak tersedia.</div>`;
    }

    const achKey   = mode === 'si' ? 'siAch' : 'soAch';
    const tgtKey   = mode === 'si' ? 'siT'   : 'soT';
    const actKey   = mode === 'si' ? 'siA'   : 'soA';
    const isTop    = type === 'top';
    const rankCls  = isTop ? 'ps-rank-top' : 'ps-rank-bottom';

    // Achievement pill class by threshold
    const achPillCls = (ach) =>
      ach >= 100 ? 'ps-ach-green' :
      ach >= 80  ? 'ps-ach-amber' :
                   'ps-ach-red';

    // Progress bar color by threshold
    const barColor = (ach) =>
      ach >= 100 ? 'var(--green-main)' :
      ach >= 80  ? 'var(--amber-main)' :
                   'var(--red-main)';

    // Sort + slice
    const sorted = [...rows]
      .filter(r => isFinite(r[achKey]) && r[achKey] >= 0)
      .sort((a, b) => isTop ? b[achKey] - a[achKey] : a[achKey] - b[achKey])
      .slice(0, n);

    const title    = `${isTop ? '🏆 TOP' : '⚠ BOTTOM'} ${n} — Sell ${mode === 'si' ? 'In' : 'Out'}`;
    const badgeCls = isTop ? 'bg-green' : 'bg-red';
    const badgeLbl = isTop ? 'GOOD' : 'DANGER';
    const cardAccent = isTop ? 'ps-card-top' : 'ps-card-bottom';

    const tbody = sorted.map((r, i) => {
      const ach     = r[achKey];
      const pctW    = Math.min(ach, 120);
      const clsPill = achPillCls(ach);
      const clsBar  = barColor(ach);
      return `<tr>
        <td style="width:26px;padding:4px 5px"><span class="${rankCls}">${i + 1}</span></td>
        <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:11px" title="${r.name}">${r.name}</td>
        <td style="font-size:10px;color:var(--gray-500);white-space:nowrap">${r.region}</td>
        <td class="font-mono" style="font-size:10px">${Utils.fmtCompact(r[tgtKey])}</td>
        <td class="font-mono" style="font-size:10px">${Utils.fmtCompact(r[actKey])}</td>
        <td style="min-width:100px">
          <div class="ps-prog-wrap">
            <span class="ps-ach-pill ${clsPill}">${Utils.fmtPct(ach)}</span>
            <div class="ps-prog-track">
              <div class="ps-prog-fill" style="width:${pctW}%;background:${clsBar}"></div>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="kpi-card ${cardAccent}" style="padding:10px">
        <div class="kpi-label" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span>${title}</span>
          <span class="badge ${badgeCls}" style="font-size:9px">${badgeLbl}</span>
        </div>
        <div class="ps-rank-table-wrap">
          <table class="ps-rank-tbl">
            <thead><tr>
              <th>#</th><th>PS Name</th><th>Region</th>
              <th>${mode === 'si' ? 'SI' : 'SO'} Target</th>
              <th>${mode === 'si' ? 'SI' : 'SO'} Actual</th>
              <th>Ach%</th>
            </tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>`;
  }
};

// ==========================================
// MULTI-SELECT — dropdown widget
// ==========================================
const MultiSelect = {
  createHTML: (id, label, options, selectedSet) => {
    const title = selectedSet.size === 0 ? `Pilih ${label}` : selectedSet.size === options.length ? `Semua ${label}` : `${selectedSet.size} ${label} Dipilih`;
    let optsHtml = options.map(opt => `
      <label class="ms-opt" data-val="${opt}">
        <input type="checkbox" ${selectedSet.has(opt) ? 'checked' : ''}>
        <span class="ms-opt-label">${opt}</span>
      </label>
    `).join('');

    return `
      <div class="ms-wrap" id="ms-${id}" data-type="${id}">
        <div class="ms-btn"><span class="ms-label">${title}</span><span class="ms-arrow">▼</span></div>
        <div class="ms-menu">
          <div class="ms-search-box"><input type="text" class="ms-search-input" placeholder="Cari ${label}..."></div>
          <div class="ms-actions">
            <span class="ms-action-btn ms-all">Pilih Semua</span>
            <span class="ms-action-btn ms-clear">Reset</span>
          </div>
          <div class="ms-options">${optsHtml}</div>
        </div>
      </div>
    `;
  },

  updateLabel: (wrapEl, type, selectedSet, totalOptions) => {
    const labelEl = wrapEl.querySelector('.ms-label');
    const labelName = type.charAt(0).toUpperCase() + type.slice(1);
    if (selectedSet.size === 0) labelEl.textContent = `Pilih ${labelName}`;
    else if (selectedSet.size === totalOptions) labelEl.textContent = `Semua ${labelName}`;
    else labelEl.textContent = `${selectedSet.size} ${labelName} Dipilih`;
  }
};

// ==========================================
// FILTER ENGINE
// ==========================================
const FilterEngine = {
  buildOptions: () => {
    const extract = (arr, key) => [...new Set(arr.map(r => r[key]).filter(Boolean))].sort();

    // Core from Performance
    State.options.regions = extract(State.raw.perf, 'Region');
    State.options.principles = extract(State.raw.perf, 'Principle');
    State.options.channels = extract(State.raw.perf, 'Channel');

    // Kategori (Product Category) — dynamic from Perfomance + Wholesaler (CA_Master has no Kategori)
    const allKats = new Set([
      ...State.raw.perf.map(r => r['Kategori']),
      ...State.raw.wholesaler.map(r => r['Kategori'])
    ].filter(Boolean));
    State.options.kategoris = [...allKats].sort();

    // Depo can be combined from multiple sources if missing in perf
    const allDepos = new Set([...State.raw.perf, ...State.raw.ps].map(r => r['Depo'] || r['PSName']).filter(Boolean));
    State.options.depos = [...allDepos].sort();

    // Build CA_Master options for region/channel/depo (complementary filter)
    if (State.raw.caMaster.length) {
      const caMRegions = [...new Set(State.raw.caMaster.map(r=>r['Region']).filter(Boolean))].sort();
      caMRegions.forEach(r=>{ if(!State.options.regions.includes(r)) State.options.regions.push(r); });
      State.options.regions.sort();
    }

    // Default select all
    State.filters.regions = new Set(State.options.regions);
    State.filters.principles = new Set(State.options.principles);
    State.filters.channels = new Set(State.options.channels);
    State.filters.kategoris = new Set(State.options.kategoris);
    State.filters.depos = new Set(State.options.depos);
  },

  // ── Cascading filter hierarchy (upstream → downstream) ──
  // Each level's available options are derived from rows passing ALL upstream filters.
  HIER:  ['regions', 'depos', 'channels', 'principles', 'kategoris'],
  FIELD: { regions: 'Region', depos: 'Depo', channels: 'Channel', principles: 'Principle', kategoris: 'Kategori' },

  /**
   * cascade(changedType) — recompute available options for every DOWNSTREAM filter,
   * prune now-invalid selections (no orphans), and re-render those dropdowns in place.
   * Source: Perfomance (carries all 5 dims) + PS depots union at the Depo level.
   * Does not touch calculations — only the option lists & selections.
   */
  cascade: (changedType) => {
    const HIER = FilterEngine.HIER, FIELD = FilterEngine.FIELD;
    const start = HIER.indexOf(changedType) + 1;
    if (start <= 0) return;

    // Row passes all upstream filters (levels 0..uptoIdx-1). Rows lacking a dim aren't excluded by it.
    const passesUpstream = (r, uptoIdx) => {
      for (let j = 0; j < uptoIdx; j++) {
        const ut = HIER[j], f = State.filters[ut];
        if (f.size === State.options[ut].length) continue;       // all selected → no constraint
        let val = (ut === 'depos') ? (r['Depo'] ?? r['PSName']) : r[FIELD[ut]];
        if (val == null || val === '') continue;                  // dim absent on this row
        if (!f.has(val)) return false;
      }
      return true;
    };

    for (let i = start; i < HIER.length; i++) {
      const type = HIER[i], field = FIELD[type];
      const avail = new Set();
      State.raw.perf.forEach(r => { if (passesUpstream(r, i)) { const v = r[field]; if (v != null && v !== '') avail.add(v); } });
      if (type === 'depos') { // keep PS-only depots available
        State.raw.ps.forEach(r => { if (passesUpstream(r, i)) { const v = r['Depo'] ?? r['PSName']; if (v != null && v !== '') avail.add(v); } });
      }
      const newOpts = [...avail].sort();
      const wasAll  = State.filters[type].size === State.options[type].length;
      State.options[type] = newOpts;
      if (wasAll) {
        State.filters[type] = new Set(newOpts);                   // stay "all"
      } else {
        const pruned = new Set([...State.filters[type]].filter(v => avail.has(v))); // drop orphans
        State.filters[type] = pruned.size ? pruned : new Set(newOpts); // empty → reselect all available
      }
      FilterEngine.rerenderDropdown(type);
    }
  },

  // Replace a single dropdown's DOM in place (events are delegated → no rebinding needed).
  rerenderDropdown: (type) => {
    const old = DOM.el(`ms-${type}`);
    if (!old) return;
    const label = { regions: 'Region', depos: 'Depo', channels: 'Channel', principles: 'Principle', kategoris: 'Kategori' }[type];
    const wasActive = old.classList.contains('active');
    const tmp = document.createElement('div');
    tmp.innerHTML = MultiSelect.createHTML(type, label, State.options[type], State.filters[type]);
    const fresh = tmp.firstElementChild;
    if (wasActive) fresh.classList.add('active');
    old.replaceWith(fresh);
  },

  renderDropdowns: () => {
    let html = '';
    html += MultiSelect.createHTML('regions', 'Region', State.options.regions, State.filters.regions);
    html += MultiSelect.createHTML('depos', 'Depo', State.options.depos, State.filters.depos);
    html += MultiSelect.createHTML('channels', 'Channel', State.options.channels, State.filters.channels);
    html += MultiSelect.createHTML('principles', 'Principle', State.options.principles, State.filters.principles);
    html += MultiSelect.createHTML('kategoris', 'Kategori', State.options.kategoris, State.filters.kategoris);

    const container = DOM.el('filter-container');
    // keep the label and re-upload button, inject dropdowns in between
    const existingHTML = container.innerHTML;
    container.innerHTML = `<span class="filter-label">Filter:</span> ${html} <button id="btn-reupload" style="margin-left:auto;font-size:11px;padding:6px 14px;border:1px solid var(--gray-300);border-radius:6px;cursor:pointer;background:white;font-weight:700;color:var(--gray-700);transition:all .2s;box-shadow:var(--shadow-sm)">↑ Upload Baru</button>`;
  },

  apply: () => {
    const { regions, principles, channels, kategoris, depos } = State.filters;
    const allReg = regions.size === State.options.regions.length;
    const allPrin = principles.size === State.options.principles.length;
    const allCh = channels.size === State.options.channels.length;
    const allKat = kategoris.size === State.options.kategoris.length;
    const allDep = depos.size === State.options.depos.length;

    // Filter Builder logic — order follows cascade hierarchy: Region → Depo → Channel → Principle → Kategori
    const rowPasses = (r) => {
      if(!r) return false;
      if (!allReg && r['Region'] && !regions.has(r['Region'])) return false;

      if (!allDep && (r['Depo'] || r['PSName']) && !depos.has(r['Depo']) && !depos.has(r['PSName'])) return false;

      // Handle Channel logic mapping from legacy (just exact match or partial)
      if (!allCh && r['Channel']) {
        let chMatch = false;
        channels.forEach(selectedCh => {
           if(r['Channel'].toUpperCase().includes(selectedCh.toUpperCase())) chMatch = true;
        });
        if(!chMatch) return false;
      }

      if (!allPrin && r['Principle'] && !principles.has(r['Principle'])) return false;

      // Kategori (Product Category) — exact match; rows without a Kategori field pass untouched
      if (!allKat && r['Kategori'] && !kategoris.has(r['Kategori'])) return false;

      return true;
    };

    State.filtered.perf = State.raw.perf.filter(rowPasses);
    State.filtered.arjuna = State.raw.arjuna.filter(rowPasses);
    State.filtered.bima = State.raw.bima.filter(rowPasses);
    State.filtered.sc = State.raw.sc.filter(rowPasses);
    State.filtered.ps = State.raw.ps.filter(rowPasses);
    // ── BB5 Wholesaler filter ──
    // The Wholesaler sheet's 'Channel' column is a product/class sub-taxonomy (e.g. WS-BEV-BIG),
    // NOT the global GT/MT/Wholesaler dimension — the whole sheet IS wholesaler data. Running it
    // through the shared rowPasses (which substring-matches Channel) would exclude every row the
    // moment any channel is deselected. Instead: filter by Region/Principle/Depo, and gate
    // visibility on whether a wholesaler-type channel is still selected.
    const wsChannelOn = allCh || [...channels].some(c => c.toString().toUpperCase().includes('WHOLESALER'));
    State.filtered.wholesaler = wsChannelOn
      ? State.raw.wholesaler.filter(r => {
          if (!r) return false;
          if (!allReg  && r['Region']    && !regions.has(r['Region']))       return false;
          if (!allPrin && r['Principle'] && !principles.has(r['Principle'])) return false;
          if (!allKat  && r['Kategori']  && !kategoris.has(r['Kategori']))    return false;
          if (!allDep  && r['Depo']      && !depos.has(r['Depo']))           return false;
          return true;
        })
      : [];

    // CA_Master: outlet-level → filter by Region, Depo & Channel.
    // NOTE: CA_Master has no Principle column, so the Principle filter cannot apply
    // to CA widgets (structural data limitation, not a bug). Depo IS available and applied.
    State.filtered.caMaster = State.raw.caMaster.filter(r => {
      if (!r) return false;
      if (!allReg && r['Region']  && !regions.has(r['Region']))   return false;
      if (!allDep && r['Depo']    && !depos.has(r['Depo']))       return false;
      if (!allCh  && r['Channel'] && !channels.has(r['Channel'])) return false;
      return true;
    });

    // ── MT Analysis filter �─ MT Analysis filter ──
    // The MT sheet's Channel column (MTI/NKA) is an internal MT dimension --
    // NOT the global GT/MT/Wholesaler switcher. The whole sheet IS MT data.
    // Gate visibility on whether MT-type channels are active (mirrors Wholesaler pattern).
    // Filter by Region, Depo, Principle, Kategori -- the shared dimensions MT carries.
    const mtChannelOn = allCh || [...channels].some(c => { const u = c.toString().toUpperCase(); return u.includes('MT') || u === 'NKA'; });
    State.filtered.mt = mtChannelOn
      ? State.raw.mt.filter(r => {
          if (!r) return false;
          if (!allReg  && r['Region']    && !regions.has(r['Region']))       return false;
          if (!allPrin && r['Principle'] && !principles.has(r['Principle'])) return false;
          if (!allKat  && r['Kategori']  && !kategoris.has(r['Kategori']))   return false;
          if (!allDep  && r['Depo']      && !depos.has(r['Depo']))           return false;
          return true;
        })
      : [];

    App.runCalculations();
  }
};
