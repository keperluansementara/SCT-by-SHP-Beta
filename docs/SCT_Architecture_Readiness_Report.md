# SCT by SHP — Architecture Readiness Report
**Date:** June 2026 | **Version:** v5.6 | **Scope:** Modularization Readiness Assessment

---

## Executive Summary

The SCT monolith (originally 13,714 lines in a single HTML file) is approximately **62% modularized by JS line count**. A clean folder structure is established and the core, data, business, and export layers are extracted. However, 25 objects totalling ~5,000 lines remain inline, three active architectural anti-patterns introduce risk for future migration, and the HTML file is still the single integration point — meaning all extracted `.js` files are not yet wired as the live source of truth.

| Metric | Value |
|---|---|
| Total inline JS lines | 12,960 |
| Extracted to modules (estimated) | ~8,050 lines (62%) |
| Objects still inline in HTML | 25 |
| Circular dependency pairs | 1 (ChartEngine ↔ ExportEngine) |
| Layer violations | 3 |
| Modules not yet created | 4 (InfographicEngine, AI engine cluster, integration layer, repository.js) |

---

## Architecture Strengths

**Layered folder convention is correct.** The `core/`, `data/`, `business/`, `ui/`, `visualization/`, `export/`, `utils/`, `styles/` structure maps directly to a clean separation of concerns and requires no structural change before a React migration.

**Business engines are pure and portable.** `kpiEngine.js`, `timegoneEngine.js`, `rankingEngine.js`, `anomalyEngine.js`, and `commentaryEngine.js` contain no DOM references. They operate on `State` and return computed values — making them directly importable into a React or Node.js environment without modification.

**State is centralized.** A single `State` object is the canonical runtime store. No computed values are scattered across local variables. This is the foundation needed for a future reactive store (Zustand, Redux, or Jotai).

**Config is separated.** `config.js` holds all constants, aliases, and thresholds. Business engines never hardcode values — they read from `Config`. This makes parameterization and environment-level overrides straightforward.

---

## Architecture Weaknesses

### 1. Folder Structure — Incomplete Extraction
**Current:** 25 objects (InfographicEngine, 9 AI/Narrative engines, FilterEngine, KPIEngine, AlertEngine, InsightEngine, DemoData, integration layer) remain defined inline in `SCT-by-SHP.html`.
**Risk: High** — The HTML file is still the effective source of truth. Any change to the HTML overwrites the modular files' canonical reference.
**Recommended:** Extract remaining objects in priority order (see Refactor Priority below). Add a dedicated `ai/` folder for narrative intelligence engines.

### 2. Dependency Organization — Circular Reference
**Current:** `chartEngine.js` references both `RenderEngine` (dashboardView) and `ExportEngine`. `exportEngine.js` references `ChartEngine`. This creates a mutual dependency: `ChartEngine ↔ ExportEngine`.
**Risk: Medium** — Circular dependencies prevent static analysis, break tree-shaking in a future bundler, and make load-order fragile.
**Recommended:** Extract a shared `chartRenderer.js` (pure Chart.js wrapper with no cross-module refs). `RenderEngine` and `ExportEngine` both consume it. Neither `ChartEngine` nor `ExportEngine` references each other.

### 3. State Management — Layer Violations
**Current:** `state.js` imports `FilterEngine` and `RenderEngine` names in its body. `filterPanel.js` exports the `DOM` utility object (mixed concern).
**Risk: Medium** — State should be a dumb data container. Any reference to UI or business engines inside `state.js` creates upward coupling that will block React migration (React's state cannot call render functions directly).
**Recommended:** Purge all engine references from `state.js`. Move `DOM` utility out of `filterPanel.js` into a standalone `ui/dom.js`. Keep `filterPanel.js` as FilterEngine only.

### 4. View Layer — dashboardView.js Overloaded
**Current:** `dashboardView.js` is 1,547 lines. It contains RenderEngine (rendering orchestrator), all BB1–BB5 section renderers, and chart initialization.
**Risk: Medium** — A 1,500-line view file will be difficult to split into React components because the render functions share implicit closure state.
**Recommended:** Before React migration, split into `ui/dashboardView.js` (orchestrator only) + `ui/sections/bb1View.js`, `bb2View.js`, etc. (one file per dashboard section). This maps 1:1 to future React component files.

### 5. Engine Layer — chartEngine.js is a Stub
**Current:** `chartEngine.js` is 33 lines — essentially empty. The actual Chart.js configuration logic lives inside `dashboardView.js` and `exportEngine.js`.
**Risk: Low-Medium** — Chart configuration is duplicated across two modules. Changes to chart styling require edits in two places.
**Recommended:** Consolidate all Chart.js configuration (defaults, color maps, axis formatters) into `visualization/chartEngine.js` as a proper engine.

### 6. Component Reusability — No Component System
**Current:** Components (cards, tables, badges, dropdowns) are rendered via template literals inside `RenderEngine`. The `MultiSelect` component is defined inside `filterPanel.js`. `InfographicEngine` (~3,200 lines) is still inline in HTML.
**Risk: Medium** — Template-literal components cannot be reused across sections without copy-paste. This is the biggest single obstacle to React componentization.
**Recommended:** Extract `InfographicEngine` to `visualization/infographicEngine.js` immediately (highest-line remaining module). Long term: introduce `ui/components/` folder with reusable card, table, and badge renderers before React migration.

### 7. Business Logic Placement — AI Engines Not Organized
**Current:** 9 AI/Narrative engines (`IntelligenceMemoryEngine`, `TrendPersistenceEngine`, `PatternRecognitionEngine`, `NarrativeMemoryEngine`, `PredictivePressureEngine`, `ProjectionScoringEngine`, `RecoverySustainabilityEngine`, `EscalationForecastEngine`, `PressureNarrativeEngine`, `NarrativeRouter`) are all inline in HTML, defined sequentially with no grouping folder.
**Risk: Low** (they are purely computational, no DOM) but **organizationally High** — these engines are the most complex business logic in the codebase and will be the primary target for AI Agent integration.
**Recommended:** Create an `ai/` folder. Extract all 9 engines + `NarrativeRouter` into it. `NarrativeRouter` becomes the public API; individual engines are internal.

### 8. Future React Migration Readiness
**Current:** Business engines are pure (ready). State is centralized (ready). DOM is imperative and scattered across RenderEngine (not ready).
**Risk: Medium** — Every `document.getElementById` call inside a render function must be replaced by React refs or JSX. RenderEngine's template literals become JSX. This is a predictable but large refactor.
**Recommended:** The key prerequisite is completing view-layer decomposition (Weakness 4) before attempting React migration. Business engines require zero changes for React.

### 9. Future AI Agent Integration Readiness
**Current:** Business engines are accessible as plain JS objects — callable by any orchestrator. State provides a single snapshot of dashboard data.
**Risk: Low** — The architecture already supports agent integration at the business layer. Agents can call `KpiEngine`, `AnomalyEngine`, `NarrativeRouter` directly once extracted.
**Recommended:** After AI engine extraction to `ai/`, expose a single `SCTAgent.query(intent, context)` facade that routes to the appropriate engine. No structural changes to existing engines required.

---

## Recommended Folder Structure (Target State)

```
SCT by SHP/
├── core/
│   ├── app.js            ✅ done
│   ├── config.js         ✅ done
│   └── state.js          ✅ done (fix layer violation)
├── data/
│   ├── excelParser.js    ✅ done
│   ├── dataMapper.js     ✅ done
│   ├── repository.js     ⬜ not started
│   └── demoData.js       ⬜ extract from HTML
├── business/
│   ├── kpiEngine.js      ✅ done
│   ├── timegoneEngine.js ✅ done
│   ├── rankingEngine.js  ✅ done
│   ├── anomalyEngine.js  ✅ done
│   ├── commentaryEngine.js ✅ done
│   ├── alertEngine.js    ⬜ extract
│   └── insightEngine.js  ⬜ extract
├── ai/                   ⬜ new folder needed
│   ├── intelligenceMemoryEngine.js
│   ├── trendPersistenceEngine.js
│   ├── patternRecognitionEngine.js
│   ├── narrativeMemoryEngine.js
│   ├── predictivePressureEngine.js
│   ├── projectionScoringEngine.js
│   ├── recoverySustainabilityEngine.js
│   ├── escalationForecastEngine.js
│   ├── pressureNarrativeEngine.js
│   └── narrativeRouter.js      ← public facade
├── visualization/
│   ├── chartEngine.js    ✅ stub (needs content)
│   └── infographicEngine.js ⬜ extract (~3,200 lines)
├── ui/
│   ├── dom.js            ⬜ extract from filterPanel
│   ├── uploadView.js     ✅ done
│   ├── filterPanel.js    ✅ done (fix DOM export)
│   ├── dashboardView.js  ✅ done (split later)
│   └── exportToolbar.js  ⬜ not started
├── export/
│   └── exportEngine.js   ✅ done
├── integration/          ⬜ new folder needed
│   ├── sourceConfigEngine.js
│   ├── driveConfigUI.js
│   ├── sourceStatusUI.js
│   └── googleDriveEngine.js
├── utils/
│   ├── constants.js      ✅ done
│   ├── formatter.js      ✅ done
│   └── helpers.js        ✅ done
├── styles/
│   ├── variables.css     ✅ done
│   ├── components.css    ✅ done
│   ├── layout.css        ✅ done
│   └── dashboard.css     ✅ done
└── SCT-by-SHP.html       ← integration shell (inline until server)
```

---

## Refactor Priority

| Priority | Task | Effort | Risk | Rationale |
|---|---|---|---|---|
| 1 | Extract `InfographicEngine` → `visualization/infographicEngine.js` | High | Low | Largest remaining module (~3,200 lines). Purely visual, no business logic risk. |
| 2 | Fix `state.js` layer violation | Low | Low | Remove FilterEngine/RenderEngine refs. Required before React migration. |
| 3 | Extract `DOM` from `filterPanel.js` → `ui/dom.js` | Low | Low | Fixes mixed export concern. DOM utilities needed by multiple modules. |
| 4 | Extract AI/Narrative cluster → `ai/` folder | High | Low | 9 engines, pure computation. Creates foundation for AI Agent integration. |
| 5 | Extract `FilterEngine` + `KPIEngine` → proper modules | Medium | Medium | Core business-UI bridge. High coupling — requires careful dependency map first. |
| 6 | Extract integration layer → `integration/` | Medium | Low | SourceConfigEngine, GoogleDriveEngine. Self-contained, low coupling. |
| 7 | Fix `ChartEngine ↔ ExportEngine` circular dep | Medium | Medium | Required before bundler/tree-shaking. Not blocking current vanilla JS runtime. |
| 8 | Split `dashboardView.js` by section | High | Low | Pre-condition for React component extraction. |

---

## Migration Roadmap

**Phase 1 — Complete Extraction (Current):** Extract remaining 25 inline objects. Resolve layer violations and circular dependency. Outcome: HTML is a thin shell; all logic lives in `.js` files.

**Phase 2 — Integration Wiring:** Replace inline `<script>` block with ordered `<script src="...">` tags. Validate that each module loads independently. Add a minimal `index.html` as the entry point. Outcome: The HTML monolith is no longer the source of truth.

**Phase 3 — TypeScript Migration:** Add `.d.ts` declarations for `State`, `Config`, and each engine's public API. Convert files incrementally (utils → core → data → business → ui). Outcome: Full type safety, IDE autocomplete, and compiler-enforced module boundaries.

**Phase 4 — React Migration:** Replace `RenderEngine` sections with React components (one component per dashboard section). `State` becomes a Zustand store. Business engines are imported directly into hooks (`useKpi()`, `useAnomalies()`). Outcome: Component-level re-renders, React DevTools, and hot module replacement.

**Phase 5 — AI Agent Integration:** Expose `SCTAgent` facade over extracted AI engines. Integrate with Claude API or local LLM. Agent reads from `State`, calls `NarrativeRouter`, returns structured recommendations. Outcome: Natural-language querying of dashboard data without touching business logic.

---

*Report generated from live codebase scan. Calculations, KPI formulas, and business rules were not reviewed.*
