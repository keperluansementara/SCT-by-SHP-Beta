# SCT by SHP — Modularization Roadmap
**Status:** Planning Only — No code has been changed  
**Source:** `SCT-by-SHP.html` (14,851 lines, single-file monolith)  
**Goal:** Extract into a clean module structure without changing any behaviour, KPI logic, or visual output

---

## Target Folder Structure

```
sct/
├── index.html                  ← Thin shell: loads modules, contains HTML skeleton only
│
├── styles/
│   ├── variables.css           ← CSS custom properties (:root block, ~20 lines)
│   ├── components.css          ← Badges, cards, progress bars, tables, tabs (~400 lines)
│   ├── layout.css              ← Upload view, dashboard header, filter panel, responsive (~250 lines)
│   └── dashboard.css           ← Section blocks, anomaly strip, export toolbar, infographic (~600 lines)
│
├── core/
│   ├── config.js               ← Config object: COLORS, SHEET_ALIASES, FOCUS_CHANNELS
│   ├── state.js                ← State object: raw, filtered, options, filters, timeEngine, kpi, history
│   └── app.js                  ← App object: init(), bindGlobalEvents(), initDashboardData(), runCalculations()
│
├── utils/
│   ├── constants.js            ← Shared magic numbers, threshold values, sentinel defaults
│   ├── formatter.js            ← fmtCompact(), fmtPct(), fmtCurrency(), number display helpers
│   └── helpers.js              ← safeNum(), calcAch(), groupBy(), debounce(), getPaceClass(), getPillClass()
│
├── data/
│   ├── parser.js               ← Parser: handleFile(), findSheet(), cleanKeys(), parseDimDate(), extractSheets()
│   ├── dataMapper.js           ← Key normalization, LABEL_MAP, column alias resolution
│   └── repository.js           ← Thin read accessors over State.raw / State.filtered (no mutation)
│
├── business/
│   ├── timegoneEngine.js       ← TimeEngine: get(), pace(), runRate(), actualRR(), evalStatus(), formatSummary()
│   ├── kpiEngine.js            ← KPIEngine: runAll(), calcPerformance(), calcCAMonitoring(), calcWholesaler(),
│   │                               calcPSAchiever(), calcClassAnalysis(), calcWholesalerClass(),
│   │                               calculatePrincipleExecutiveSummary()
│   ├── anomalyEngine.js        ← AnomalyEngine: detect(), severity classification, render()
│   ├── commentaryEngine.js     ← PrincipleCommentaryEngine + ExecSummaryEngine + InsightEngine
│   └── rankingEngine.js        ← Depot/PS top-bottom ranking sort logic (extracted from Components)
│
├── visualization/
│   ├── chartEngine.js          ← ChartEngine: registry, destroy(), rebuild(), all Chart.js configs
│   └── infographicEngine.js    ← InfographicEngine + SnapshotEngine: canvas drawing, generateX() methods
│
├── ui/
│   ├── components.js           ← Components + DOM + MultiSelect: shared HTML fragment builders
│   ├── filterPanel.js          ← FilterEngine: buildOptions(), cascade(), apply(), renderDropdowns()
│   ├── uploadView.js           ← Upload drag-drop handlers, progress bar, demo loader
│   ├── dashboardView.js        ← RenderEngine: execAll() + all section render methods
│   └── exportToolbar.js        ← Export toolbar UI, toast, overlay, watermark update
│
├── export/
│   └── exportEngine.js         ← ExportEngine + ExportDebug + SnapshotEngine
│
├── intelligence/
│   └── intelligenceLayer.js    ← IntelligenceMemoryEngine, TrendPersistenceEngine, PatternRecognitionEngine,
│                                   NarrativeMemoryEngine, PredictivePressureEngine, ProjectionScoringEngine,
│                                   RecoverySustainabilityEngine, EscalationForecastEngine,
│                                   PressureNarrativeEngine, NarrativeRouter
│
└── source/
    ├── googleDriveEngine.js    ← GoogleDriveEngine: auto-fetch, Bridge fetch loop
    ├── sourceConfigEngine.js   ← SourceConfigEngine: config read/write
    └── sourceUI.js             ← DriveConfigUI + SourceStatusUI + BridgeFetchUI
```

**Total target files:** 32 files (4 CSS + 28 JS)  
**Files added to `index.html`:** `<link>` for each CSS + `<script type="module">` for each JS in dependency order

---

## Dependency Order

Read bottom-up: each layer only imports from layers below it.

```
Layer 0 — No dependencies (safe to move first)
  constants.js
  formatter.js
  variables.css
  components.css

Layer 1 — Depends on Layer 0
  config.js          (uses: constants)
  helpers.js         (uses: formatter)
  layout.css         (uses: variables.css tokens)
  dashboard.css      (uses: variables.css tokens)

Layer 2 — Depends on Layer 0–1
  state.js           (uses: config)

Layer 3 — Depends on Layer 0–2
  timegoneEngine.js  (uses: state, helpers)
  dataMapper.js      (uses: helpers, constants)
  parser.js          (uses: state, dataMapper, timegoneEngine, helpers)
  repository.js      (uses: state)

Layer 4 — Depends on Layer 0–3
  components.js      (uses: helpers, formatter, state)
  filterPanel.js     (uses: state, repository, components)
  rankingEngine.js   (uses: helpers, formatter, state)
  kpiEngine.js       (uses: state, timegoneEngine, helpers, formatter)

Layer 5 — Depends on Layer 0–4
  anomalyEngine.js   (uses: state, kpiEngine, helpers)
  commentaryEngine.js(uses: state, kpiEngine, helpers, formatter, timegoneEngine)
  chartEngine.js     (uses: state, helpers, formatter)
  intelligenceLayer.js (uses: state, kpiEngine, helpers)

Layer 6 — Depends on Layer 0–5
  infographicEngine.js (uses: state, kpiEngine, chartEngine, helpers, formatter)
  dashboardView.js   (uses: state, components, chartEngine, helpers, formatter, kpiEngine)
  exportEngine.js    (uses: state, dashboardView, infographicEngine, chartEngine)

Layer 7 — Depends on Layer 0–6
  uploadView.js      (uses: state, parser, components)
  exportToolbar.js   (uses: exportEngine, state)
  sourceConfigEngine.js (uses: state, config)
  googleDriveEngine.js  (uses: state, parser, sourceConfigEngine)
  sourceUI.js        (uses: state, sourceConfigEngine, googleDriveEngine)

Layer 8 — Depends on all
  app.js             (uses: all modules — orchestration only)
```

---

## Safe Migration Sequence

### Pre-condition (Before Any Migration)
- [ ] Create a git branch: `refactor/modularize`
- [ ] Snapshot the current `SCT-by-SHP.html` as `SCT-by-SHP.v5-FROZEN.html` — this is the regression baseline
- [ ] Define a manual verification checklist:
  - Upload MonitorDaily.xlsx → confirm all 6 sections render
  - Confirm KPI values match baseline (spot-check 5 key metrics)
  - Confirm filter dropdowns work and cascade correctly
  - Confirm export PDF produces output
  - Confirm demo data loads correctly

---

### Phase 1 — CSS Extraction  
**Risk: Very Low** — No logic, purely visual. Regression visible instantly.

| Step | Action | Verify |
|---|---|---|
| 1.1 | Cut `:root` block → `variables.css` | Page colours unchanged |
| 1.2 | Cut utility/component styles → `components.css` | Cards, badges, tables render |
| 1.3 | Cut upload/header/filter styles → `layout.css` | Upload screen and header render |
| 1.4 | Cut dashboard/anomaly/export styles → `dashboard.css` | Full dashboard renders |
| 1.5 | Replace `<style>` block with 4 `<link>` tags | Full visual regression check |

---

### Phase 2 — Zero-Dependency Utilities  
**Risk: Very Low** — Pure functions, no side effects, no DOM access.

| Step | Action | Verify |
|---|---|---|
| 2.1 | Extract `constants.js` (magic numbers, sentinel defaults) | No console errors |
| 2.2 | Extract `formatter.js` (fmtCompact, fmtPct, display helpers) | KPI numbers display correctly |
| 2.3 | Extract `helpers.js` (safeNum, calcAch, groupBy, debounce, getPaceClass) | Filters and KPI % unchanged |

---

### Phase 3 — Config & State  
**Risk: Low** — Data containers only, no computation.

| Step | Action | Verify |
|---|---|---|
| 3.1 | Extract `config.js` (Config object) | Sheet detection unchanged |
| 3.2 | Extract `state.js` (State object) | State initialises correctly on load |

---

### Phase 4 — Data Layer  
**Risk: Low-Medium** — File parsing is critical path; test with real and demo data.

| Step | Action | Verify |
|---|---|---|
| 4.1 | Extract `dataMapper.js` (LABEL_MAP, cleanKeys, key normalization) | Column detection unchanged |
| 4.2 | Extract `timegoneEngine.js` (TimeEngine) | Working days & pace % unchanged |
| 4.3 | Extract `parser.js` (Parser — full object) | Upload → data loads, DimDate parsed |
| 4.4 | Extract `repository.js` (thin accessors) | State.raw / State.filtered readable |

---

### Phase 5 — Business Engines  
**Risk: Medium** — This is the core. Extract one calc function at a time. Verify KPI output after each step by comparing `State.kpi` values to baseline.

| Step | Action | Verify |
|---|---|---|
| 5.1 | Extract `rankingEngine.js` (depot/PS ranking sort logic) | Section 4 & 5 rankings unchanged |
| 5.2 | Extract `kpiEngine.js` (KPIEngine — all calcX methods) | All KPI values match baseline |
| 5.3 | Extract `anomalyEngine.js` (AnomalyEngine) | Anomaly strip unchanged |
| 5.4 | Extract `commentaryEngine.js` (PrincipleCommentaryEngine + ExecSummaryEngine + InsightEngine) | Commentary panels render, text unchanged |

---

### Phase 6 — UI Components & Filters  
**Risk: Medium** — DOM manipulation; test all filter interactions.

| Step | Action | Verify |
|---|---|---|
| 6.1 | Extract `components.js` (Components, DOM, MultiSelect) | Progress bars, pills render |
| 6.2 | Extract `filterPanel.js` (FilterEngine) | All dropdowns work, cascade correct |
| 6.3 | Extract `uploadView.js` (upload handlers, demo loader) | File upload + demo data load |

---

### Phase 7 — Visualization Layer  
**Risk: Medium-High** — Chart.js instances are stateful. Destroy/rebuild must stay coupled.

| Step | Action | Verify |
|---|---|---|
| 7.1 | Extract `chartEngine.js` (ChartEngine + all chart configs) | All charts render on load and filter |
| 7.2 | Extract `dashboardView.js` (RenderEngine — all execX methods) | All 6 dashboard sections render |
| 7.3 | Extract `infographicEngine.js` (InfographicEngine + SnapshotEngine) | Infographic download works |

---

### Phase 8 — Export & Intelligence  
**Risk: Medium** — Export depends on rendered DOM state; intelligence engines are additive.

| Step | Action | Verify |
|---|---|---|
| 8.1 | Extract `exportEngine.js` (ExportEngine + ExportDebug) | PDF/PNG export produces correct output |
| 8.2 | Extract `exportToolbar.js` (toolbar UI, watermark) | Toolbar visible, watermark updates |
| 8.3 | Extract `intelligenceLayer.js` (all 10 intelligence engines as one bundle) | No console errors; history snapshots captured |

---

### Phase 9 — Source / Drive  
**Risk: Low** — Additive feature, failure-isolated. Current users may not use Drive.

| Step | Action | Verify |
|---|---|---|
| 9.1 | Extract `sourceConfigEngine.js` | Config read/write intact |
| 9.2 | Extract `sourceUI.js` (DriveConfigUI + SourceStatusUI + BridgeFetchUI) | Drive config UI renders |
| 9.3 | Extract `googleDriveEngine.js` | Drive fetch still works (if configured) |

---

### Phase 10 — App Shell & index.html  
**Risk: Low** — Orchestration only; all logic already moved.

| Step | Action | Verify |
|---|---|---|
| 10.1 | Extract `app.js` (App object) | Full end-to-end flow works |
| 10.2 | Strip `SCT-by-SHP.html` to `index.html` shell (HTML skeleton only) | Full regression check against baseline |
| 10.3 | Add `<script type="module">` imports in dependency order | Final verification |

---

## High Risk Areas

### 🔴 Critical Risk — Do Not Rush

**1. `State.kpi` Shape**  
The KPI output object has 60+ flat keys (`totTgt`, `totAct`, `ach`, `byReg`, `byPrin`, `wsClass`, `ps`, `anomalies`, `alerts`, `insights`, `execSlots`, `principleExec`, ...). Every engine and every render function reads from this shape. If any key is renamed or restructured during extraction, it silently breaks downstream rendering.  
→ **Rule:** Freeze `State.kpi`'s shape. No renaming. No restructuring. Move the code, not the data contract.

**2. `RenderEngine` DOM ID Coupling**  
`RenderEngine.execAll()` sets content on ~50+ hard-coded element IDs (`perf-kpi-grid`, `ca-channel-tl`, `ws-all-regions`, `ps-si-regions`, etc.). These IDs are defined in the HTML skeleton. If the HTML skeleton is touched before `RenderEngine` is extracted, IDs go out of sync.  
→ **Rule:** Do not touch HTML element IDs at any point during Phase 1–9. Only clean up the HTML in Phase 10 after all JS is moved.

**3. `ChartEngine` Instance Registry**  
`ChartEngine` keeps a dictionary of live Chart.js instances. `RenderEngine` calls `ChartEngine.destroy()` before redrawing. These two objects must be extracted together or in the same phase. Splitting them risks calling `.update()` on a destroyed instance (throws silently, leaves blank charts).  
→ **Rule:** Extract `chartEngine.js` first (Phase 7.1), then `dashboardView.js` (Phase 7.2). Never reverse the order.

**4. `ExportEngine` DOM Dependency**  
`ExportEngine` uses `html2canvas` on live DOM nodes, identified by section IDs. It must run after `RenderEngine` has painted the dashboard. The call order `KPIEngine → RenderEngine → ExportEngine` must be preserved.  
→ **Rule:** Export functions must never be called from inside `KPIEngine` or `RenderEngine`. Verify the call chain is intact after Phase 8.

**5. Intelligence Engine Circular References**  
`NarrativeRouter` calls `PredictivePressureEngine`, `PatternRecognitionEngine`, `NarrativeMemoryEngine`, and `PressureNarrativeEngine` — all in the same call chain. These engines also reference each other's outputs. Splitting them into separate files risks undefined-reference errors at call time.  
→ **Rule:** Bundle all 10 intelligence engines into a single `intelligenceLayer.js` in Phase 8.3. Only split them in a later pass once the module boundary is stable.

---

### 🟡 Medium Risk — Handle with Care

**6. `FilterEngine.cascade()` Call Order**  
The filter hierarchy (`region → principle → channel → kategori → depo`) must cascade strictly top-down. The cascade calls `App.runCalculations()` through a debounced handler. If `FilterEngine` is extracted before `App`, the debounce callback reference breaks.  
→ **Rule:** Pass the `runCalculations` callback as a parameter during extraction, or extract `App` and `FilterEngine` in the same phase.

**7. `Parser` Sheet Alias Matching**  
`Parser.findSheet()` uses fuzzy matching against `Config.SHEET_ALIASES`. If `Config` is loaded after `Parser` (wrong script order), sheet detection silently falls back to `wb.SheetNames[0]`, loading the wrong sheet with no error.  
→ **Rule:** Enforce strict load order: `config.js` → `parser.js`. Validate with a `console.assert(typeof Config !== 'undefined')` guard at the top of `parser.js` during initial extraction.

**8. `DemoData` Coupling to `App`**  
`DemoData.load()` directly calls `App.initDashboardData()` and `Parser.updateProgress()`. It is not an isolated module — it mimics the full Parser flow.  
→ **Rule:** Extract `DemoData` as part of `uploadView.js`, not as a standalone module. It is UI logic, not a data layer concern.

**9. `TrendEngine` Inline Use in `KPIEngine`**  
`TrendEngine.calc()` is called dozens of times inside `KPIEngine` calc functions. If `TrendEngine` is not exported before `KPIEngine` is extracted, all trend calculations silently return `null`.  
→ **Rule:** Include `TrendEngine` inside `kpiEngine.js` or ensure it is loaded first. Do not split `TrendEngine` from `KPIEngine` in Phase 5.

---

### 🟢 Low Risk — Standard Caution

**10. CSS Token Scope**  
All CSS custom properties are in `:root`. As long as `variables.css` is the first stylesheet loaded, all other CSS files will resolve tokens correctly. Wrong load order causes all colour tokens to go undefined (page renders in black/unstyled).  
→ **Rule:** `variables.css` must be the first `<link>` in `index.html`.

---

## Verification Protocol (Applies After Each Phase)

After every phase, run this checklist before starting the next:

1. **Upload test** — Drop `MonitorDaily.xlsx`, confirm dashboard loads without console errors
2. **KPI spot-check** — Compare 5 key values (totAct, totTgt, ach%, wsClass ach, PS SI ach) against baseline screenshot
3. **Filter test** — Apply Region filter, confirm all sections update correctly
4. **Export test** — Run PDF export, confirm file downloads (Phase 8+ only)
5. **Demo data test** — Click "Load Demo", confirm all sections render
6. **Console check** — Zero `TypeError` or `ReferenceError` entries in browser console

---

## Summary Timeline

| Phase | Scope | Files Created | Est. Risk |
|---|---|---|---|
| 1 | CSS Extraction | 4 CSS files | Very Low |
| 2 | Zero-dep Utilities | 3 JS files | Very Low |
| 3 | Config + State | 2 JS files | Low |
| 4 | Data Layer | 4 JS files | Low-Medium |
| 5 | Business Engines | 4 JS files | Medium |
| 6 | UI Components | 3 JS files | Medium |
| 7 | Visualization | 3 JS files | Medium-High |
| 8 | Export + Intelligence | 3 JS files | Medium |
| 9 | Source / Drive | 3 JS files | Low |
| 10 | App Shell + index.html | 1 JS + index.html | Low |
| **Total** | | **32 files** | |

**Golden rule throughout:** If a phase produces any console error or any KPI value differs from the baseline — stop, revert that phase, diagnose before proceeding.
