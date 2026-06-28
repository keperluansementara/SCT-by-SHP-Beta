# SCT by SHP — Top 5 Structural Fix Implementation Plan
**Date:** June 2026 | **Scope:** Pre-modularization structural repairs only | **Status:** PLAN — no code yet

---

## Overview

These five fixes must be completed **in sequence**. Each one reduces the blast radius of the next. Attempting them out of order introduces rollback complexity.

| # | Issue | Risk | Estimated Effort | Must precede |
|---|---|---|---|---|
| 1 | DOM utility extraction | Low | 1–2 hrs | Issues 2, 3, 4 |
| 2 | `state.js` layer violation | Low | 30 min | Issue 3 |
| 3 | `ChartEngine ↔ ExportEngine` circular dep | Medium | 2–3 hrs | Issue 4 |
| 4 | `InfographicEngine` extraction | High | 4–6 hrs | Issue 5 |
| 5 | HTML integration point wiring | Medium | 3–4 hrs | — |

> **Implementation order differs from priority order.** DOM fix (Issue 1 in priority) is implemented first because everything else depends on having a clean `DOM` utility as an independent module.

---

## Issue 1 — DOM Utility Extraction
**Priority rank: #5 in severity | Implementation order: FIRST**

### Current Dependency Map
```
filterPanel.js
  └── exports: DOM (utility), FilterEngine (business logic)   ← mixed export
  
Other modules that consume DOM:
  app.js           → DOM.el(), DOM.setStyle(), DOM.setTxt()
  excelParser.js   → DOM.el(), DOM.setStyle(), DOM.setTxt()
  dashboardView.js → DOM.el(), DOM.setStyle(), DOM.setTxt()
  exportEngine.js  → DOM.el()
```

### Proposed Dependency Map
```
ui/dom.js
  └── exports: DOM only (utility)
  └── dependencies: NONE

ui/filterPanel.js
  └── exports: FilterEngine only
  └── depends on: dom.js, state.js, config.js
```

### Files Affected
| File | Change |
|---|---|
| `ui/filterPanel.js` | Remove DOM object definition; add `// DOM → ui/dom.js` comment |
| `ui/dom.js` | NEW — move DOM object verbatim from filterPanel.js |
| `SCT-by-SHP.html` | Mirror same split inline (DOM defined before FilterEngine) |

### Risk Assessment
- **Low.** DOM is a pure utility — no business logic, no state reads, no side effects.
- The object already exists as a self-contained block inside filterPanel.js.
- The only risk: load order. `dom.js` must be declared before any file that uses it.
- Rollback: revert dom.js creation, restore DOM back into filterPanel.js.

### Success Criteria
- `DOM` is defined in `ui/dom.js` only.
- `filterPanel.js` contains only `FilterEngine` and `MultiSelect`/`Components` definitions.
- No other module defines or re-exports `DOM`.

---

## Issue 2 — `state.js` Layer Violation
**Priority rank: #2 in severity | Implementation order: SECOND**

### Current Dependency Map
```
core/state.js
  └── references: FilterEngine  ← UI/business layer
  └── references: RenderEngine  ← UI layer
  └── references: KPIEngine     ← business layer
  (State is supposed to have ZERO outward dependencies)
```

### Proposed Dependency Map
```
core/state.js
  └── references: NOTHING (pure data container)
  └── exports: State (plain object with typed shape)

Callers that set State fields will now own their own initialization:
  app.js           → sets State fields after engines run
  excelParser.js   → sets State.raw fields
  dataMapper.js    → sets State.timeEngine
```

### Files Affected
| File | Change |
|---|---|
| `core/state.js` | Remove all engine references. State becomes a plain data schema only. |
| `SCT-by-SHP.html` | Mirror same removal inline in the `const State = {...}` block |

### Risk Assessment
- **Low.** The references in `state.js` are documentation-style (not functional calls at parse time). They appear in JSDoc comments or as type hints — not as runtime calls.
- Verify before touching: confirm each reference is non-executable (comment or string, not a live call).
- If any reference IS a live call: isolate that specific line and defer it to a caller instead.
- Rollback: revert single file.

### Success Criteria
- `grep -n "FilterEngine\|RenderEngine\|KPIEngine" core/state.js` returns zero results.
- All existing dashboard output remains identical after change.

---

## Issue 3 — ChartEngine ↔ ExportEngine Circular Dependency
**Priority rank: #3 in severity | Implementation order: THIRD**

### Current Dependency Map
```
visualization/chartEngine.js
  └── references: ExportEngine   ← export layer (wrong direction)
  └── references: RenderEngine   ← ui layer (wrong direction)

export/exportEngine.js
  └── references: ChartEngine    ← visualization layer (correct)

Result: ChartEngine → ExportEngine → ChartEngine  (CIRCULAR)
```

### Proposed Dependency Map
```
visualization/chartEngine.js
  └── references: NOTHING (pure Chart.js configuration registry)
  └── exports: ChartEngine (chart defaults, color maps, axis formatters)

export/exportEngine.js
  └── references: ChartEngine   (one-way, correct direction)
  └── references: State, Config, DOM

ui/dashboardView.js
  └── references: ChartEngine   (one-way, correct direction)
```

### Breaking the Cycle — Approach

The circular reference exists because `chartEngine.js` currently calls back into ExportEngine (likely for export-readiness checks) and into RenderEngine (likely to access chart instances). The fix is **event-based decoupling**, not a shared module:

1. `ChartEngine` exposes a `ChartEngine.registry` — a plain object mapping chart IDs to Chart.js instances.
2. `ExportEngine` reads `ChartEngine.registry` directly (already does this — remove the reverse call).
3. `RenderEngine` populates `ChartEngine.registry` after chart creation (remove ChartEngine's reference back to RenderEngine).

No new files needed. The cycle is broken by removing two reverse references in `chartEngine.js`.

### Files Affected
| File | Change |
|---|---|
| `visualization/chartEngine.js` | Remove `ExportEngine` reference. Remove `RenderEngine` reference. |
| `export/exportEngine.js` | No change needed — reference direction is already correct. |
| `ui/dashboardView.js` | Ensure it populates `ChartEngine.registry` after each chart render. |
| `SCT-by-SHP.html` | Mirror same removals in the inline `const ChartEngine = {...}` block |

### Risk Assessment
- **Medium.** The reverse calls in `chartEngine.js` may be functional, not just documentary. Before removal:
  - Trace every `ExportEngine.*` call inside `chartEngine.js` → move the logic to the caller (ExportEngine itself).
  - Trace every `RenderEngine.*` call inside `chartEngine.js` → move to dashboardView.js post-render hook.
- Test export (PNG/PDF) after change — this is the most likely place a regression surfaces.
- Rollback: revert chartEngine.js only.

### Success Criteria
- `grep "ExportEngine\|RenderEngine" visualization/chartEngine.js` returns zero results.
- Full PNG export and section PDF export produce identical output.

---

## Issue 4 — InfographicEngine Extraction
**Priority rank: #1 in severity | Implementation order: FOURTH**

### Current Dependency Map
```
SCT-by-SHP.html (inline, ~line 9266, ~3,200 lines)
  const InfographicEngine = {
    └── reads:  State, Config, Formatter, Utils
    └── calls:  DOM.el(), DOM.setStyle(), DOM.setTxt()
    └── calls:  ChartEngine (chart instances)
    └── calls:  ExportEngine._toast() (notifications)
    └── NO KPI calculations — purely visual assembly
  }
```

### Proposed Dependency Map
```
visualization/infographicEngine.js
  └── reads:  State, Config, Formatter, Utils  (runtime globals)
  └── calls:  DOM                              (from ui/dom.js after Issue 1)
  └── calls:  ChartEngine                     (after Issue 3 — no circular risk)
  └── calls:  ExportEngine._toast()           (one-way — acceptable)
  └── exports: InfographicEngine (const global)
```

### Files Affected
| File | Change |
|---|---|
| `visualization/infographicEngine.js` | NEW — verbatim copy of InfographicEngine block from HTML |
| `SCT-by-SHP.html` | Replace `const InfographicEngine = {...}` block with `<!-- InfographicEngine → visualization/infographicEngine.js -->` comment placeholder |

### Extraction Boundary
- **Start:** `const InfographicEngine = {` (approximately line 9,266 in current HTML)
- **End:** Closing `};` of the InfographicEngine object
- **Excluded:** Nothing inside InfographicEngine is shared — the block is fully self-contained.
- **Do NOT extract** any AI/Narrative engine calls that may reference InfographicEngine from outside — those remain inline until the AI cluster extraction (future phase).

### Risk Assessment
- **High effort, Low logic risk.** InfographicEngine is the largest remaining module but it is purely visual — no KPI math, no business rules. A verbatim copy carries zero calculation risk.
- Main risk is **load order**: `infographicEngine.js` must load after `dom.js`, `chartEngine.js`, `state.js`, and `config.js`.
- Secondary risk: the extraction script must capture the EXACT object boundary. An off-by-one on the closing `};` corrupts the JS.
- **Verify by:** running the full dashboard render and comparing BB4 (Infographic section) pixel-for-pixel before and after. Console must show zero new errors.
- Rollback: restore the HTML block from the comment placeholder.

### Success Criteria
- `InfographicEngine` defined nowhere in `SCT-by-SHP.html`.
- `visualization/infographicEngine.js` loads and all BB4 infographic sections render identically.
- `grep "InfographicEngine" SCT-by-SHP.html` returns only comments/references, not a definition.

---

## Issue 5 — HTML as Integration Point
**Priority rank: #1 in severity | Implementation order: LAST**

### Current State
```
SCT-by-SHP.html
  ├── <style> block (1,124 lines — inlined for file:// compatibility)
  ├── HTML markup (~790 lines)
  └── <script> block (12,960 lines — ALL JS inline)
       All .js files in the project are PARALLEL COPIES, not the live source.
```

### Proposed State
```
SCT-by-SHP.html (integration shell only)
  ├── <style> block (keep inlined — required for file:// use)
  ├── HTML markup (unchanged)
  └── <script> blocks (ordered load sequence):
       <script src="utils/constants.js">
       <script src="utils/helpers.js">
       <script src="utils/formatter.js">
       <script src="core/config.js">
       <script src="core/state.js">
       <script src="ui/dom.js">              ← after Issue 1
       <script src="data/dataMapper.js">
       <script src="data/excelParser.js">
       <script src="business/timegoneEngine.js">
       <script src="business/rankingEngine.js">
       <script src="business/anomalyEngine.js">
       <script src="business/kpiEngine.js">
       <script src="business/commentaryEngine.js">
       <script src="visualization/chartEngine.js">
       <script src="visualization/infographicEngine.js"> ← after Issue 4
       <script src="export/exportEngine.js">
       <script src="ui/filterPanel.js">
       <script src="ui/uploadView.js">
       <script src="ui/dashboardView.js">
       <script src="core/app.js">
       + remaining inline objects not yet extracted (DemoData, FilterEngine,
         KPIEngine, AlertEngine, AI cluster, integration layer)
       + DOMContentLoaded bootstrap (App.init())
```

### Transition Strategy — Incremental, Not Big Bang

Do NOT replace the entire `<script>` block at once. Use a **side-by-side swap** per module:

1. For each extracted `.js` file, add its `<script src="...">` tag before the inline `<script>` block.
2. Inside the inline `<script>` block, delete only the corresponding object definition.
3. Test after each deletion. If behavior is identical → proceed. If regression → revert that one tag.

This means at any point during Issue 5, the HTML is in a valid hybrid state: some objects loaded from files, the rest still inline.

### Files Affected
| File | Change |
|---|---|
| `SCT-by-SHP.html` | Add `<script src="...">` tags in load order. Delete matching inline definitions one at a time. |
| All `.js` files in project | No changes — they become the live source for the first time. |

### Hard Constraint — CSS Stays Inlined
The 4 CSS files (`variables.css`, `components.css`, `layout.css`, `dashboard.css`) **cannot** be loaded via `<link>` tags when the file is opened via `file://` protocol. The `<style>` block must remain inlined. This is a browser security constraint, not an architectural choice.

### Risk Assessment
- **Medium.** The risk is load-order errors. If Module B references Module A and B's `<script>` tag appears before A's, the object is `undefined` at parse time and all calls to it silently fail.
- Mitigated by the incremental approach — one module swap at a time, test after each.
- Highest-risk swaps: `FilterEngine` and `KPIEngine` (deeply cross-referenced). Defer those to last.
- Rollback per module: re-add the inline definition, remove the `<script src>` tag.

### Load Order Rules (Non-negotiable)
1. `utils/` before everything
2. `core/config.js` before `core/state.js`
3. `ui/dom.js` before any UI or parser module
4. `data/` before `business/`
5. `business/` before `visualization/`
6. `visualization/` before `export/`
7. `export/` before `ui/dashboardView.js`
8. `core/app.js` LAST (before the bootstrap DOMContentLoaded call)

### Success Criteria
- `<script>` block in HTML contains no object definitions for extracted modules.
- Opening `SCT-by-SHP.html` directly in Chrome via `file://` produces identical dashboard output.
- Browser console shows `[SCT] Bootstrap complete — App.init() called` with no errors.

---

## Execution Checklist (In Order)

- [ ] **Issue 1:** Create `ui/dom.js`, remove DOM from `filterPanel.js`, mirror in HTML
- [ ] Verify: dashboard filter dropdowns and upload flow work identically
- [ ] **Issue 2:** Remove engine refs from `core/state.js`, mirror in HTML
- [ ] Verify: `grep` confirms zero engine refs in state.js
- [ ] **Issue 3:** Remove reverse refs from `chartEngine.js`, mirror in HTML
- [ ] Verify: PNG export and PDF export produce correct output
- [ ] **Issue 4:** Extract InfographicEngine to `visualization/infographicEngine.js`
- [ ] Verify: BB4 infographic section renders identically; no console errors
- [ ] **Issue 5:** Begin incremental `<script src>` swap (one module at a time)
- [ ] Verify after each swap: full upload → dashboard render → export cycle passes

---

*This plan covers structural repairs only. KPI calculations, business rules, and dashboard output are not changed at any step.*
