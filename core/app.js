/**
 * app.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Application bootstrap and global event wiring.
 * Entry point: DOMContentLoaded → App.init()
 *
 * Source: App object (SCT-by-SHP.html lines 6612–6793)
 *         Bootstrap listener: reconstructed from architecture analysis.
 *         (Original HTML is truncated at line 13,714 — the closing
 *          DOMContentLoaded call is absent from the file. The call below
 *          matches the known bootstrap pattern confirmed in architecture review.)
 *
 * Dependencies (must be loaded before app.js):
 *   config.js        — Config (COLORS, FOCUS_CHANNELS)
 *   state.js         — State (raw, filtered, filters, options, timeEngine, kpi)
 *   constants.js     — CONSTANTS
 *   formatter.js     — Formatter
 *   helpers.js       — Helpers (Utils alias used inline here)
 *   parser.js        — Parser.handleFile()
 *   filterEngine.js  — FilterEngine.buildOptions(), .renderDropdowns(), .apply(), .cascade()
 *   kpiEngine.js     — KPIEngine.runAll()
 *   renderEngine.js  — RenderEngine.execAll()
 *   dom.js           — DOM.el(), DOM.setStyle()
 *   components.js    — MultiSelect.updateLabel()
 *   demoData.js      — DemoData.load()
 *   exportEngine.js  — ExportEngine._updateWatermark() (optional, guarded)
 *   intelligenceMemoryEngine.js — IntelligenceMemoryEngine.capture() (optional, guarded)
 *
 * ── What App does ────────────────────────────────────────────────────────────
 *   init()              — called once at DOMContentLoaded; wires all global events
 *   bindGlobalEvents()  — file upload, re-upload, demo loader, filter dropdowns,
 *                         BB4 tab switching, principle accordion
 *   initDashboardData() — called by Parser after successful parse; builds filter
 *                         options, resets filtered state, runs calculations,
 *                         switches view from upload → dashboard
 *   runCalculations()   — KPIEngine.runAll() → IntelligenceMemoryEngine.capture()
 *                         → RenderEngine.execAll()
 *
 * ── What App does NOT do ─────────────────────────────────────────────────────
 *   - No KPI math (all in KPIEngine)
 *   - No data parsing (all in Parser)
 *   - No DOM rendering (all in RenderEngine / Components)
 *   - No chart drawing (all in ChartEngine)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const App = {
  init: () => {
    App.bindGlobalEvents();
  },

  bindGlobalEvents: () => {
    // File Handlers — null-guarded
    const dz  = DOM.el('drop-zone');
    const fIn = DOM.el('file-input');
    if (dz && fIn) {
      dz.addEventListener('click',    ()  => fIn.click());
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave',()  => dz.classList.remove('drag'));
      dz.addEventListener('drop',     (e) => { e.preventDefault(); dz.classList.remove('drag'); Parser.handleFile(e.dataTransfer.files[0]); });
      fIn.addEventListener('change',  (e) => Parser.handleFile(e.target.files[0]));
    }

    // Re-upload
    const btnRe = DOM.el('btn-reupload');
    if (btnRe) {
      btnRe.addEventListener('click', () => {
        DOM.setStyle('view-dashboard', 'display', 'none');
        DOM.setStyle('view-upload', 'display', 'flex');
        DOM.setStyle('loader-wrapper', 'display', 'none');
        if (fIn) fIn.value = '';
      });
    }

    // Demo Data Loader
    const btnDemo = DOM.el('btn-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => {
        DOM.setStyle('loader-wrapper', 'display', 'block');
        Parser.updateProgress(60, 'Loading Enterprise Mock Data...');
        setTimeout(DemoData.load, 600);
      });
    }

    // Delegated Multi-Select Events
    const handleFilterChange = Utils.debounce(() => FilterEngine.apply(), 300);
    // Cascade downstream options immediately (UI feedback), then run calculations (debounced).
    const onFilterChanged = (type) => { FilterEngine.cascade(type); handleFilterChange(); };

    document.addEventListener('click', (e) => {
      // 1. Close dropdowns if clicking outside
      if (!e.target.closest('.ms-wrap')) {
        document.querySelectorAll('.ms-wrap.active').forEach(w => w.classList.remove('active'));
      }

      // 2. Toggle dropdown menu
      const btn = e.target.closest('.ms-btn');
      if (btn) {
        const wrap = btn.closest('.ms-wrap');
        const isActive = wrap.classList.contains('active');
        document.querySelectorAll('.ms-wrap').forEach(w => w.classList.remove('active'));
        if (!isActive) wrap.classList.add('active');
      }

      // 3. Select All Action
      if (e.target.classList.contains('ms-all')) {
        const wrap = e.target.closest('.ms-wrap');
        const type = wrap.dataset.type;
        const visibleChecks = wrap.querySelectorAll('.ms-opt:not([style*="display: none"]) input');
        visibleChecks.forEach(chk => {
          chk.checked = true;
          State.filters[type].add(chk.closest('.ms-opt').dataset.val);
        });
        MultiSelect.updateLabel(wrap, type, State.filters[type], State.options[type].length);
        onFilterChanged(type);
      }

      // 4. Clear All Action
      if (e.target.classList.contains('ms-clear')) {
        const wrap = e.target.closest('.ms-wrap');
        const type = wrap.dataset.type;
        const visibleChecks = wrap.querySelectorAll('.ms-opt:not([style*="display: none"]) input');
        visibleChecks.forEach(chk => {
          chk.checked = false;
          State.filters[type].delete(chk.closest('.ms-opt').dataset.val);
        });
        MultiSelect.updateLabel(wrap, type, State.filters[type], State.options[type].length);
        onFilterChanged(type);
      }
    });

    // Delegated Change Event for Checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.closest('.ms-opt')) {
        const chk = e.target;
        const optWrap = chk.closest('.ms-opt');
        const val = optWrap.dataset.val;
        const wrap = optWrap.closest('.ms-wrap');
        const type = wrap.dataset.type;

        if (chk.checked) State.filters[type].add(val);
        else State.filters[type].delete(val);

        MultiSelect.updateLabel(wrap, type, State.filters[type], State.options[type].length);
        onFilterChanged(type);
      }
    });

    // Delegated Input Event for Search
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('ms-search-input')) {
        const term = e.target.value.toLowerCase();
        const wrap = e.target.closest('.ms-wrap');
        wrap.querySelectorAll('.ms-opt').forEach(opt => {
          const label = opt.querySelector('.ms-opt-label').textContent.toLowerCase();
          opt.style.display = label.includes(term) ? 'flex' : 'none';
        });
      }
    });

    // BB4 Tab Switching
    document.addEventListener('click', (e) => {
      const bb4Tab = e.target.closest('[data-bb4]');
      if (!bb4Tab) return;
      const prog = bb4Tab.dataset.bb4;
      document.querySelectorAll('[data-bb4]').forEach(t => t.classList.remove('active'));
      bb4Tab.classList.add('active');
      ['arjuna','bima','supercup'].forEach(id => {
        const el = DOM.el('bb4-' + id);
        if (el) el.classList.toggle('active', id === prog);
      });
    });

    // ── Principle row expand/collapse — delegated on the table body ──
    // Clicking a .prin-row toggles its commentary panel row and expanded class.
    // Only one panel open at a time (accordion behaviour).
    document.addEventListener('click', (e) => {
      const row = e.target.closest('.prin-row');
      if (!row) return;

      const panelId  = row.dataset.panel;
      const panel    = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      const isOpen = panel.classList.contains('open');

      // Close all other open panels first (accordion)
      document.querySelectorAll('.prin-commentary-row.open').forEach(p => {
        if (p.id !== panelId) {
          p.classList.remove('open');
          const sibRow = document.querySelector(`.prin-row[data-panel="${p.id}"]`);
          if (sibRow) sibRow.classList.remove('expanded');
        }
      });

      // Toggle this panel
      panel.classList.toggle('open', !isOpen);
      row.classList.toggle('expanded', !isOpen);
    });
  },

  initDashboardData: () => {
    FilterEngine.buildOptions();
    FilterEngine.renderDropdowns();
    State.filtered = { ...State.raw }; // Reset filter to raw — includes caMaster
    App.runCalculations();

    // Switch View
    setTimeout(() => {
      DOM.setStyle('view-upload', 'display', 'none');
      DOM.setStyle('view-dashboard', 'display', 'block');
      // Phase 1 v5: Show export toolbar when dashboard is visible
      const tb = document.getElementById('export-toolbar');
      if (tb) tb.classList.add('visible');
      // Update watermark with loaded filter state
      if (typeof ExportEngine !== 'undefined') ExportEngine._updateWatermark();
    }, 300);
  },

  runCalculations: () => {
    KPIEngine.runAll();
    // V6 Step 7.5: capture memory snapshot after KPI is computed
    if (typeof IntelligenceMemoryEngine !== 'undefined') {
      IntelligenceMemoryEngine.capture(State.kpi);
    }
    RenderEngine.execAll();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
// ⚠ NOTE: The original SCT-by-SHP.html is truncated at line 13,714.
// The closing DOMContentLoaded listener was absent from the file end.
// This call is reconstructed from architecture analysis and confirmed
// by the presence of App.init() and BridgeFetchUI.init registered separately.
// BridgeFetchUI registers its own DOMContentLoaded listener (wires #ss-btn-fetch).
document.addEventListener('DOMContentLoaded', () => App.init());
