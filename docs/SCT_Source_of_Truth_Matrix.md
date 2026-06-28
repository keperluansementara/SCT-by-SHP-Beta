# SCT by SHP — Source of Truth Matrix
**Date:** June 2026 | **Purpose:** Pre-implementation verification | **Status:** READ-ONLY — no code changed

---

## 1. Runtime Source of Truth

**Answer: 100% Inline HTML `<script>` block.**

The HTML file contains exactly **one** `<script>` tag with inline JS (line 1914). There are **zero** local `<script src="...">` tags. All four external `<script src>` tags point to CDN libraries only (XLSX, Chart.js, html2canvas, jsPDF).

```
Runtime execution chain:
  SCT-by-SHP.html
    ├── <script src="cdn/xlsx.js">         ← CDN only
    ├── <script src="cdn/chart.js">        ← CDN only
    ├── <script src="cdn/html2canvas.js">  ← CDN only
    ├── <script src="cdn/jspdf.js">        ← CDN only
    └── <script> [inline, 12,960 lines]    ← ALL BUSINESS LOGIC — THIS IS WHAT RUNS

  business/*.js, core/*.js, ui/*.js, etc.  ← NOT LOADED — not executed at runtime
```

**The extracted `.js` files in the project are entirely inert.** They are documentation-quality reference copies, not the running code. Any edit made to an external `.js` file has zero effect on the dashboard until Issue 5 (HTML wiring) is completed.

---

## 2. Naming Mismatch — Aliases vs Module Names

Six JS files export objects under names the HTML never uses. The HTML uses legacy alias names:

| HTML Runtime Name | JS File Export Name | JS File | Status |
|---|---|---|---|
| `Utils` (373 refs inline) | `Helpers` + `Formatter` | `utils/helpers.js`, `utils/formatter.js` | **Alias mismatch** — HTML uses `Utils` as a monolith; JS split it into two separate objects |
| `Parser` (38 refs inline) | `ExcelParser` | `data/excelParser.js` | **Alias mismatch** — `excelParser.js` re-exports as `const Parser = ExcelParser` but HTML never loads it |
| *(not referenced inline)* | `DataMapper` | `data/dataMapper.js` | **New object** — HTML inlines DataMapper logic inside the `Parser` object; JS split it out |
| *(not referenced inline)* | `UploadView` | `ui/uploadView.js` | **New object** — no HTML counterpart; upload wiring lives in `App.bindGlobalEvents()` |
| *(not referenced inline)* | `CONSTANTS` | `utils/constants.js` | **New object** — no HTML counterpart |
| `Helpers` (2 refs inline) | `Helpers` | `utils/helpers.js` | **Partial** — 2 stray `Helpers` refs in HTML; rest use `Utils` |

---

## 3. Source of Truth Matrix

| Module | Defined in HTML inline | Defined in .js file | Runtime Source | Dual Maintenance Risk |
|---|---|---|---|---|
| **Config** | ✅ Yes | ✅ `core/config.js` | **HTML** | 🔴 HIGH — any config change must be made in HTML |
| **State** | ✅ Yes | ✅ `core/state.js` | **HTML** | 🔴 HIGH |
| **App** | ✅ Yes | ✅ `core/app.js` | **HTML** | 🔴 HIGH |
| **DOM** | ✅ Yes (in filterPanel block) | ✅ `ui/filterPanel.js` | **HTML** | 🔴 HIGH |
| **Components** | ✅ Yes (in filterPanel block) | ✅ `ui/filterPanel.js` | **HTML** | 🔴 HIGH |
| **MultiSelect** | ✅ Yes (in filterPanel block) | ✅ `ui/filterPanel.js` | **HTML** | 🔴 HIGH |
| **FilterEngine** | ✅ Yes (in filterPanel block) | ✅ `ui/filterPanel.js` | **HTML** | 🔴 HIGH |
| **TimeEngine** | ✅ Yes | ✅ `business/timegoneEngine.js` | **HTML** | 🔴 HIGH |
| **TrendEngine** | ✅ Yes | ✅ `business/timegoneEngine.js` | **HTML** | 🔴 HIGH |
| **KPIEngine** | ✅ Yes | ✅ `business/kpiEngine.js` | **HTML** | 🔴 HIGH |
| **AlertEngine** | ✅ Yes | ✅ `business/rankingEngine.js` | **HTML** | 🔴 HIGH |
| **AnomalyEngine** | ✅ Yes | ✅ `business/anomalyEngine.js` | **HTML** | 🔴 HIGH |
| **InsightEngine** | ✅ Yes | ✅ `business/commentaryEngine.js` | **HTML** | 🔴 HIGH |
| **PrincipleCommentaryEngine** | ✅ Yes | ✅ `business/commentaryEngine.js` | **HTML** | 🔴 HIGH |
| **ExecSummaryEngine** | ✅ Yes | ✅ `business/commentaryEngine.js` | **HTML** | 🔴 HIGH |
| **RenderEngine** | ✅ Yes | ✅ `ui/dashboardView.js` | **HTML** | 🔴 HIGH |
| **ChartEngine** | ✅ Yes | ✅ `visualization/chartEngine.js` | **HTML** | 🔴 HIGH |
| **ExportEngine** | ✅ Yes | ✅ `export/exportEngine.js` | **HTML** | 🔴 HIGH |
| **ExportDebug** | ✅ Yes | ✅ `export/exportEngine.js` | **HTML** | 🔴 HIGH |
| **SnapshotEngine** | ✅ Yes | ✅ `export/exportEngine.js` | **HTML** | 🔴 HIGH |
| **Utils** | ✅ Yes | ❌ No match (split into `Helpers`+`Formatter`) | **HTML** | 🟡 MEDIUM — split exists but name mismatch |
| **Parser** | ✅ Yes | ❌ No match (renamed `ExcelParser`) | **HTML** | 🟡 MEDIUM — alias exists in excelParser.js but never loaded |
| **DataMapper** | ❌ No (logic inside Parser) | ✅ `data/dataMapper.js` | **HTML** | 🟡 MEDIUM — structural divergence |
| **DemoData** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **InfographicEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **IntelligenceMemoryEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **TrendPersistenceEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **PatternRecognitionEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **NarrativeMemoryEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **PredictivePressureEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **ProjectionScoringEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **RecoverySustainabilityEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **EscalationForecastEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **PressureNarrativeEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **NarrativeRouter** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **SourceConfigEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **DriveConfigUI** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **SourceStatusUI** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **GoogleDriveEngine** | ✅ Yes | ❌ Not extracted | **HTML** | ⚪ NONE — single source |
| **UploadView** | ❌ No | ✅ `ui/uploadView.js` | **N/A — not used** | ⚪ NONE — dead file |
| **CONSTANTS** | ❌ No | ✅ `utils/constants.js` | **N/A — not used** | ⚪ NONE — dead file |
| **Helpers** | ❌ No (2 stray refs) | ✅ `utils/helpers.js` | **N/A — not used** | ⚪ NONE — dead file |
| **Formatter** | ❌ No | ✅ `utils/formatter.js` | **N/A — not used** | ⚪ NONE — dead file |
| **DataMapper** | ❌ No (inside Parser) | ✅ `data/dataMapper.js` | **N/A — not used** | ⚪ NONE — dead file |
| **ExcelParser** | ❌ No | ✅ `data/excelParser.js` | **N/A — not used** | ⚪ NONE — dead file |

---

## 4. Summary of Findings

### Modules in dual maintenance (🔴 HIGH risk) — 20 modules
Every one of these exists in both the HTML and a `.js` file, but **only the HTML version runs**. A developer editing the `.js` file believing they are fixing a bug is making a silent no-op change.

```
Config, State, App, DOM, Components, MultiSelect, FilterEngine,
TimeEngine, TrendEngine, KPIEngine, AlertEngine, AnomalyEngine,
InsightEngine, PrincipleCommentaryEngine, ExecSummaryEngine,
RenderEngine, ChartEngine, ExportEngine, ExportDebug, SnapshotEngine
```

### Modules with structural divergence (🟡 MEDIUM risk) — 3 cases
The JS files restructured or renamed these relative to the HTML. Wiring them in Issue 5 will require reconciliation, not just a `<script src>` tag drop-in:

- `Utils` (HTML) ↔ `Helpers` + `Formatter` (JS) — must decide: merge back to `Utils` or update all 373 HTML refs
- `Parser` (HTML) ↔ `ExcelParser` (JS) — the alias `const Parser = ExcelParser` in `excelParser.js` handles this, but must be verified
- `DataMapper` (JS-only) — `parseDimDate` logic lives inside `Parser` in HTML; in JS it is a separate object called by `ExcelParser.extractSheets()`

### Modules with no JS file yet (⚪ NONE risk, single source) — 18 modules
These have no dual maintenance risk because they only exist inline. They are the next extraction targets (Issues 4, and future phases).

### Dead JS files (not loaded, not referenced) — 6 files
`utils/constants.js`, `utils/helpers.js`, `utils/formatter.js`, `data/excelParser.js`, `data/dataMapper.js`, `ui/uploadView.js` — these files exist on disk but are never loaded. They will become live only after Issue 5 wiring.

---

## 5. Impact on Issue #1 (DOM Extraction)

Issue 1 plan is to create `ui/dom.js` and remove `DOM` from `filterPanel.js`. This is safe to proceed **with one clarification**:

- `DOM` in the `.js` file today lives inside `ui/filterPanel.js`
- `DOM` in the HTML inline script is defined at the top of the `FilterEngine` block
- **The HTML inline version is what runs** — the `.js` file version is inert

Issue 1 therefore has two parallel actions:
1. Create `ui/dom.js` (extracts DOM from `filterPanel.js`) — affects the `.js` layer
2. Mirror the same split in the HTML inline script — affects the runtime

Both must happen together. Doing only the `.js` side has zero runtime effect.

---

*Verification complete. No code was modified. All findings are read-only observations from the live codebase.*
