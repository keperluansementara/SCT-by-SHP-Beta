# SCT by SHP — Architecture Overview
**Version:** 5.x (Monolith)  
**File:** `SCT-by-SHP.html` — 14,851 lines  
**Stack:** Vanilla JS (ES6), Chart.js 4.4, SheetJS 0.18, html2canvas, jsPDF  

---

## 1. High-Level Architecture

The application is a **single-file monolith**: all CSS, HTML structure, and JavaScript live inside one `.html` file. There are no separate modules, no build step, and no server — it runs entirely in the browser.

```
SCT-by-SHP.html
├── <head>           CDN dependencies (XLSX, Chart.js, html2canvas, jsPDF)
├── <style>          ~1,265 lines — CSS variables, components, layout, dashboard
├── <body>           ~700 lines  — Upload view + Dashboard HTML skeleton
└── <script>         ~12,900 lines — All application logic
```

**Two views** toggle via `display` style:
- `#view-upload` — file drop/upload screen, Drive config, demo loader
- `#view-dashboard` — full dashboard rendered by JS after data load

**Data entry point:** User uploads an `.xlsx` file → `Parser` reads it → `App.initDashboardData()` → `FilterEngine` → `KPIEngine` → `RenderEngine`.

---

## 2. Main Modules (Current `const` Objects)

| Layer | Module | Responsibility | ~Lines |
|---|---|---|---|
| **Core** | `Config` | Sheet aliases, color constants, channel whitelist | 1968–1988 |
| **Core** | `State` | Single source of truth: raw/filtered data, filters, kpi, history | 1993–2040 |
| **Core** | `App` | Bootstrap, event binding, orchestration loop | 7733–7915 |
| **Utilities** | `Utils` | safeNum, calcAch, groupBy, debounce, getPaceClass | 2045–2189 |
| **Utilities** | `DOM` | getElementById wrappers, setTxt/setHtml/setStyle | 2490–2497 |
| **Utilities** | `Components` | Reusable HTML fragment builders (progress bars, pills) | 2498–2751 |
| **Data** | `Parser` | xlsx → JS objects, sheet detection, DimDate parsing | 2789–3059 |
| **Data** | `FilterEngine` | Build filter options, cascade hierarchy, apply filters | 3063–3242 |
| **Data** | `MultiSelect` | Dropdown UI state management | 2752–2785 |
| **Engines** | `TimeEngine` | Centralized working days, pace, run-rate math | 2207–2307 |
| **Engines** | `TrendEngine` | vs-LM / vs-LY growth calculations | 2325–2486 |
| **Engines** | `KPIEngine` | Core business calculations for all 5 business blocks | 3246–4151 |
| **Engines** | `AlertEngine` | Priority alert generation from KPI output | 4197–4567 |
| **Engines** | `AnomalyEngine` | Statistical outlier detection | 4598–4909 |
| **Engines** | `InsightEngine` | Rule-based auto insight text | 4938–5251 |
| **Engines** | `PrincipleCommentaryEngine` | Per-principle narrative + action plans | 5270–5886 |
| **Engines** | `ExecSummaryEngine` | Morning briefing structured output | 5914–6195 |
| **Visualization** | `RenderEngine` | DOM updates for all 6 dashboard sections | 6199–7732 |
| **Visualization** | `ChartEngine` | Chart.js instance registry + destroy/rebuild | 4152–4196 |
| **Visualization** | `InfographicEngine` | Canvas-drawn exportable infographic cards | 9187–12393 |
| **Export** | `ExportEngine` | PDF/PNG export, toolbar, watermark, overlay | 7999–8910 |
| **Export** | `SnapshotEngine` | Section screenshot capture | 9072–9186 |
| **Intelligence** | `IntelligenceMemoryEngine` | KPI snapshot history (in-memory) | 12438–12683 |
| **Intelligence** | `TrendPersistenceEngine` | Multi-period trend tracking | 12684–12803 |
| **Intelligence** | `PatternRecognitionEngine` | Anomaly pattern classification | 12804–12931 |
| **Intelligence** | `NarrativeMemoryEngine` | Commentary history context | 12932–13017 |
| **Intelligence** | `PredictivePressureEngine` | Forward pressure forecasting | 13148–13340 |
| **Intelligence** | `ProjectionScoringEngine` | Month-end projection scoring | 13349–13433 |
| **Intelligence** | `PressureNarrativeEngine` + `NarrativeRouter` | Natural language output routing | 13539–14235 |
| **Source/Drive** | `GoogleDriveEngine` | Google Drive auto-fetch integration | 14552–14812 |
| **Source/Drive** | `SourceConfigEngine` / `DriveConfigUI` / `SourceStatusUI` | Drive config UI | 14256–14551 |
| **Dev** | `DemoData` | Mock data loader for testing | 7919–7998 |
| **Dev** | `ExportDebug` | Export dev diagnostics panel | 8911–9071 |

---

## 3. Business Logic Areas

**5 Business Blocks (BB)** computed by `KPIEngine.runAll()`:

| Block | Source Sheet | Key Metrics |
|---|---|---|
| **BB0 — Exec / Principle Summary** | Perfomance | Achievement %, gap, trend vs LM/LY per principle |
| **BB1 — Overall Performance** | Perfomance | Total target vs actual, run-rate, pace vs time-gone, by region/depot/channel/category |
| **BB2 — CA Monitoring** | CA_Master (fallback: Perfomance) | Channel achievement, region traffic light, SKU coverage |
| **BB3 — Wholesaler / ITG Programs** | Perfomance (WS channel) + Arjuna/Bima/Supercup | Sub-program achievement, Pareto tables, timegone analysis |
| **BB4 — PS Achiever** | PS_Achiever | Sell-In/Sell-Out achievement, depot ranking, top/bottom 10 |
| **BB5 — Wholesaler by Class** | Wholesaler sheet | Achievement by wholesaler CLASS field |

**Supporting calculations always applied:**
- `TimeEngine` — working days from DimDate sheet; sentinel fallback if absent
- `TrendEngine` — vsLM, vsLY for every metric
- `AlertEngine` + `AnomalyEngine` — post-KPI signal generation
- `IntelligenceMemoryEngine` — snapshot after every `runCalculations()` call

---

## 4. Data Flow

```
User: drop/upload .xlsx
        │
        ▼
Parser.handleFile()
  → XLSX.read() [SheetJS]
  → Parser.parseDimDate()    ──→ State.timeEngine (working days)
  → Parser.extractSheets()   ──→ State.raw.{perf, arjuna, bima, sc, ps, wholesaler, caMaster}
        │
        ▼
App.initDashboardData()
  → FilterEngine.buildOptions()   (extract unique values for dropdowns)
  → FilterEngine.renderDropdowns() (render multi-select UI)
  → State.filtered = State.raw    (initial: no filter)
        │
        ▼
App.runCalculations()  ← also called on every filter change
  → KPIEngine.runAll()
      → calcPerformance()
      → calcCAMonitoring()
      → calcWholesaler()
      → calcPSAchiever()
      → calcClassAnalysis()
      → calcWholesalerClass()
      → calculatePrincipleExecutiveSummary()
      → AlertEngine.generate()
      → AnomalyEngine.detect()
      → InsightEngine.generateInsights()
      → ExecSummaryEngine.build()
      ──→ State.kpi (single output object)
  → IntelligenceMemoryEngine.capture(State.kpi)
  → RenderEngine.execAll()
      → All DOM updates across 6 sections
      → ChartEngine (Chart.js redraws)
```

**Filter change trigger:** `FilterEngine.apply()` → `State.filtered` updated → `App.runCalculations()` re-runs full chain.

---

## 5. Recommended Modularization Strategy

**Guiding principle:** Extract modules in dependency order — bottom-up. Nothing that depends on `State` or `KPIEngine` moves until `State`, `Config`, and utilities are stable as standalone files.

### Phase 1 — Foundation (Zero Risk)
Extract with no external dependencies:
- `config.js` ← `Config`
- `constants.js` ← color/sheet alias constants
- `formatter.js` ← `Utils.fmtCompact`, `Utils.fmtPct`, number formatters
- `helpers.js` ← `Utils.safeNum`, `Utils.calcAch`, `Utils.groupBy`, `Utils.debounce`
- `variables.css`, `components.css`, `layout.css`, `dashboard.css` ← split the `<style>` block

### Phase 2 — State & Data Layer
- `state.js` ← `State` (depends on config)
- `parser.js` ← `Parser` (depends on state, SheetJS)
- `repository.js` ← thin accessor layer over `State.raw` / `State.filtered`
- `dataMapper.js` ← `Parser.cleanKeys()`, key normalization logic

### Phase 3 — Business Engines
Extract in this order (each depends on state + utils):
1. `timegoneEngine.js` ← `TimeEngine`
2. `rankingEngine.js` ← ranking/depot sort logic inside `Components`
3. `kpiEngine.js` ← `KPIEngine` (depends on TimeEngine, TrendEngine, State)
4. `anomalyEngine.js` ← `AnomalyEngine`
5. `commentaryEngine.js` ← `PrincipleCommentaryEngine`, `ExecSummaryEngine`, `InsightEngine`, `NarrativeRouter`

### Phase 4 — Visualization & UI
- `chartEngine.js` ← `ChartEngine` + Chart.js wrappers
- `infographicEngine.js` ← `InfographicEngine` + `SnapshotEngine`
- `filterPanel.js` ← `FilterEngine`, `MultiSelect`
- `uploadView.js` ← `Parser` upload handlers, `DriveConfigUI`, `SourceStatusUI`
- `dashboardView.js` ← `RenderEngine`
- `exportToolbar.js` ← export UI controls

### Phase 5 — Export & Intelligence
- `exportEngine.js` ← `ExportEngine`, `ExportDebug`
- Intelligence engines (`IntelligenceMemoryEngine`, `PredictivePressureEngine`, etc.) — bundle as `intelligenceLayer.js` initially, split later

### Key Risks to Watch
| Risk | Mitigation |
|---|---|
| `State.kpi` is a flat mega-object with ~60+ keys | Keep its shape frozen during extraction; never restructure |
| `RenderEngine` directly manipulates DOM IDs defined in HTML | Map all IDs before touching HTML structure |
| `ChartEngine` holds live Chart.js instances in a closure dict | Extract together; do not split chart creation from chart registry |
| Intelligence engines have circular narrative dependencies | Bundle as a single layer first, split only when isolated |
| `ExportEngine` uses `html2canvas` on DOM sections by ID | Export must run after `RenderEngine`; preserve call order |
