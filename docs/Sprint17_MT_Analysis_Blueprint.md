# SCT v6 — Sprint 17: Executive MT Analysis
## Complete Implementation Blueprint

**Sprint:** 17 — Architecture & Design Phase  
**Date:** 2026-06-25  
**Status:** DESIGN ONLY — No code written, no files modified  
**Source of Truth:** MonitorDaily.xlsx (MT sheet) + current project architecture  
**Validated Against:** 14,118 MT rows across 4 regions, 2 channels, 50 sub-channels

---

## 1. Business Objective

The Executive MT Analysis section answers the following management questions from a single dashboard view:

| # | Question | Data Source |
|---|----------|-------------|
| 1 | How is MT performing overall? | `Act TM` vs `LMHK` vs `LYHK` |
| 2 | Which MT Channel (MTI vs NKA) contributes most? | `Channel` dimension |
| 3 | Which Sub-Channel Type is growing fastest? | Parsed from `Sub Channel` |
| 4 | Which Channel/Type is underperforming? | Growth < 0 vs LM or LY |
| 5 | Which Channel requires CA recovery? | `CA` vs `CA LM` delta |
| 6 | What is the recovery revenue opportunity? | Churned CA × avg revenue/CA |
| 7 | Is MT ahead or behind time-pace? | `LMHK` × `TimeEngine.timeGone%` |
| 8 | What should management prioritize today? | Executive insight synthesis |

**Business Context:** MT is the largest channel in this dataset at Rp 51.46B total revenue (+41.9% vs LY). NKA dominates (81.6% share) with a single sub-channel (NKA-MIN-DC-SPRBIG) accounting for 49.3% of total MT revenue. Despite strong revenue growth, CA outlets are declining (−3,436 vs LM), creating a Rp 5.33B recovery opportunity.

---

## 2. Existing MT Architecture

### 2.1 Current State (Before Sprint 18 Implementation)

The MT sheet exists in MonitorDaily.xlsx but is **not parsed, stored, or rendered** in any current module.

| Module | Current State | Required Change |
|--------|--------------|-----------------|
| `data/excelParser.js` | No MT parsing | Add `State.raw.mt` parse step |
| `core/state.js` | No `raw.mt` or `filtered.mt` | Add both namespace keys |
| `ui/filterPanel.js` | No MT filter logic | Add MT filter pass-through |
| `business/kpiEngine.js` | No `calcMT()` | Add `calcMT()` builder + `runAll()` call |
| `business/renderEngine.js` | No `renderMT()` | Add renderer + `execAll()` call |
| `index.html` | No MT section container | Add HTML section between Wholesaler and PS Achiever |
| `ui/mtView.js` | Does not exist | New module (recommended) |

### 2.2 Section Insertion Point

**In `renderEngine.execAll()` (lines 37–42):**

```
[LINE 37]  _safeRender('wholesaler', ...)
[LINE 38]  _safeRender('renderITGTimegone', ...)
[LINE 39]  _safeRender('renderWholesalerClassPerformance', ...)
[LINE 40]  _safeRender('bb4ClassAnalysis', ...)
           ← INSERT HERE: _safeRender('renderMT', () => RenderEngine.renderMT(k.mt))
[LINE 41]  _safeRender('psAchiever', ...)
```

**In `index.html` DOM:** Between the `<!-- BB5: Wholesaler Performance by Class -->` block (ends ~line 1712) and the `<div class="section-title">PS Achiever Monitoring</div>` block (starts ~line 1713).

---

## 3. Data Mapping

### 3.1 MT Sheet — Column Inventory

| Column | Type | Example Values | Purpose |
|--------|------|----------------|---------|
| `Area` | String | `Area 2` | Fixed — single area, not filterable |
| `Region` | String | `Jabar1`, `Jabar2`, `Jabobeka`, `Jatakalbar` | Geographic filter (4 values) |
| `Depo` | String | `DEPO BANDUNG`, `DEPO MM JABODETABEK` | Depot-level drill-down (20 values) |
| `Principle` | String | `GPPJ`, `MBR`, `QI`, etc. | Product principle (11 values) |
| `Kategori` | String | `LIQUID MILK`, `SNACK`, etc. | Category filter (22 values) |
| `Sub Kategori` | String | `PEDIASURE GO`, etc. | Sub-category (68 values) |
| `SKU` | String | `TPECO110`, etc. | SKU level (322 values) |
| `Channel` | String | `MTI`, `NKA` | Primary segmentation dimension |
| `Sub Channel` | String | `MTI-SR-ST-SPRBIG`, etc. | Encoded hierarchy (50 values) |
| `Act TM` | Number | `967680.18` | Actual sales revenue this month (IDR) |
| `LYHK` | Number | `8129101.66` | Last Year revenue (HK-adjusted) |
| `LMHK` | Number | `2593081.98` | Last Month revenue (HK-adjusted) |
| `CA` | Number | `4`, `1`, etc. | Coverage Active — outlets active TM |
| `CA LM` | Number | `8`, `2`, etc. | Coverage Active — outlets active LM |
| `CLASS` | String | `SMALL`, `MEDIUM`, `BIG`, `SPRBIG` | Outlet size classification (4 values) |

**Critical note:** There is **no Target TM column** in the MT sheet. Achievement % cannot be calculated. All performance is expressed as growth vs LM and vs LY.

### 3.2 Sub Channel Encoding

Sub Channel follows a structured 4-part format: `[CHANNEL]-[TYPE]-[STORETYPE]-[CLASS]`

| Segment | Position | Values | Meaning |
|---------|----------|--------|---------|
| CHANNEL | 1 | `MTI`, `NKA` | Parent channel |
| TYPE | 2 | `MIN`, `SR`, `MTWS`, `MWS`, `SP`, `CON`, `HYP`, `FRUIT`, `WS`, `HB`, `BABY` | Store type/program |
| STORETYPE | 3 | `ST` (Standard), `DC` (Distribution Center) | Order model |
| CLASS | 4 | `SMALL`, `MEDIUM`, `BIG`, `SPRBIG` | Outlet size tier |

**Proposed TYPE labels for display:**

| Code | Display Label | Channel |
|------|--------------|---------|
| MIN | Minimarket | MTI + NKA |
| SR | Supermarket/Retail | MTI + NKA |
| MTWS | MT Wholesale | NKA |
| MWS | Modern Wholesale | NKA |
| SP | Specialty | MTI + NKA |
| CON | Convenience | MTI + NKA |
| HYP | Hypermarket | NKA |
| FRUIT | Fruit Store | MTI |
| WS | Wholesale Standard | MTI |
| HB | Health & Beauty | MTI |
| BABY | Baby Specialty | MTI |

### 3.3 Filter Compatibility

The MT sheet shares `Region`, `Depo`, and `Principle` dimensions with the Performance sheet. The global filter system (Region, Principle, Channel, Depo) must pass through to MT rows. Note:

- `Channel` in the MT sheet is `MTI` or `NKA`, NOT the global GT/MT/Wholesaler channel. MT sheet IS the MT dimension — it should be shown whenever MT is selected OR all channels shown.
- Principle filter: applies to `Principle` column in MT sheet.
- Region filter: applies to `Region` column.
- Depo filter: applies to `Depo` column.
- Kategori filter: applies to `Kategori` column.

**Filter isolation rule (mirrors Wholesaler pattern):** MT filter in `filterPanel.js` should check if MT channel is visible. If a channel filter is active that excludes MT entirely, hide the MT section rather than showing empty data.

---

## 4. KPI Mapping

### 4.1 Available KPIs from MT Sheet

| KPI | Formula | Available? | Note |
|-----|---------|-----------|------|
| Total Revenue TM | `SUM(Act TM)` | ✅ | Primary metric |
| Revenue LM | `SUM(LMHK)` | ✅ | Comparison base |
| Revenue LY | `SUM(LYHK)` | ✅ | Year-over-year base |
| Growth vs LM | `(Act TM - LMHK) / LMHK` | ✅ | MoM momentum |
| Growth vs LY | `(Act TM - LYHK) / LYHK` | ✅ | YoY trend |
| Gap vs LM | `Act TM - LMHK` | ✅ | Revenue gap in IDR |
| Gap vs LY | `Act TM - LYHK` | ✅ | Revenue gap in IDR |
| Channel Share | `channel_act / total_act` | ✅ | Contribution % |
| CA Active TM | `SUM(CA)` | ✅ | Outlet coverage |
| CA Active LM | `SUM(CA LM)` | ✅ | Prior coverage |
| CA Churn | `CA LM - CA` | ✅ | Outlets lost |
| Avg Revenue/CA | `Act TM / CA TM` | ✅ | Outlet productivity |
| Recovery Potential | `CA Churn × Avg Revenue/CA` | ✅ | IDR opportunity |
| Time Pace | `Act TM / (LMHK × timeGone%)` | ✅ | Requires TimeEngine |
| Target Achievement | — | ❌ | No Target column in MT |

### 4.2 Status Classification Rules

**Channel / Type Status** (mirrors `calcWholesalerClass` pattern):

| Condition | Status | Badge | Icon |
|-----------|--------|-------|------|
| `growVsLM ≥ 0` AND `growVsLY ≥ 0` | Growth Engine | `solid-blue` | 🚀 |
| `growVsLM ≥ 0` AND `growVsLY < 0` | Recovery | `solid-amber` | 🔁 |
| `growVsLM < 0` AND `growVsLY ≥ 0` | Momentum Loss | `solid-amber` | ⚠ |
| `growVsLM < 0` AND `growVsLY < 0` | Critical | `solid-red` | 🔴 |
| LY data = null (new program) | New / Emerging | `solid-navy` | ⭐ |

**Timegone Pace Status:**

| Condition | Status | Color |
|-----------|--------|-------|
| `pace ≥ 1.05` | Ahead of Pace | `--green-main` |
| `0.95 ≤ pace < 1.05` | On Pace | `--amber-main` |
| `pace < 0.95` | Behind Pace | `--red-main` |

Where `pace = Act TM / (LMHK × timeGone / 100)`

---

## 5. Business Rules

### 5.1 Data Integrity Rules

1. **No Target column** — Never attempt to calculate achievement % from MT sheet. Show growth metrics only.
2. **CA null safety** — Many rows have `CA = null` and `CA LM = null`. Use `safeNum()` for all CA aggregation. CA = 0 does NOT mean "no outlet" — it means "no active CA this period." Only non-null records with `CA > 0` count as active outlets.
3. **Negative revenue guard** — Some rows have negative `Act TM`, `LYHK`, `LMHK` (returns, credit adjustments — observed in CON and RANS principle). Aggregate these as-is (negative values cancel out mathematically). Flag at display level if total is negative.
4. **LYHK null handling** — Rows where `LYHK = null` indicate no prior-year comparison available (new SKU/program). Display LY growth as "N/A" for these. Do not exclude from totals.
5. **Double-counting guard** — MT sheet data is ISOLATED from Performance sheet. **Never add MT sheet totals to Performance sheet totals.** The MT sheet represents MT channel detail only; it does not include GT or Wholesaler.
6. **Sub Channel decode** — Parse `Sub Channel` by splitting on `-`. Use `parts[1]` for TYPE. If parsing fails (unexpected format), place in `UNCLASSIFIED` bucket.
7. **NKA-MIN-DC-SPRBIG concentration risk** — This single sub-channel is Rp 25.37B (49.3% of total MT). Any aggregated MT metric is dominated by this one bucket. Always show this explicitly in the analysis.

### 5.2 Filtering Rules

```
filteredMT = State.raw.mt.filter(row => {
  if (activeRegions.size > 0 && !activeRegions.has(row.Region)) return false;
  if (activeDepos.size > 0 && !activeDepos.has(row.Depo)) return false;
  if (activePrinciples.size > 0 && !activePrinciples.has(row.Principle)) return false;
  if (activeKategoris.size > 0 && !activeKategoris.has(row.Kategori)) return false;
  return true;
});
```

**MT is NOT filtered by the global `channels` filter** — the MT section is always shown when MT is among the active channel types (or when no channel filter is active). The internal `Channel` column (MTI/NKA) is an internal dimension, not the global GT/MT/Wholesaler switcher.

### 5.3 Section Visibility Rule

```
if (filteredMT.length === 0) → hide entire MT section container (display:none)
if (filteredMT.length > 0)  → show section
```

---

## 6. Proposed Executive Layout

### 6.1 Section Header

```
┌─────────────────────────────────────────────────────────────────┐
│ 🏬 Modern Trade (MT) Analysis                    [BADGE: LIVE]  │
│    Source: MT Sheet | 14,118 rows | MTI + NKA channels          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Overall Layout Structure

```
┌── SECTION HEADER ─────────────────────────────────────────────────────┐
│  🏬 Modern Trade (MT) Performance Overview                            │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 1: MT HEADLINE KPIs ─────── (4-column KPI card row) ──────────┐
│  [Total MT Revenue]  [Growth vs LY]  [Growth vs LM]  [Time Pace]      │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 2: CHANNEL BREAKDOWN ──────── (2 column: table + chart) ──────┐
│  [MTI vs NKA Summary Table]    [Bar chart: Revenue + Growth %]         │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 3: SUB-CHANNEL TYPE ANALYSIS ─── (full-width table + chart) ──┐
│  [Type Performance Table: MIN, SR, MTWS, MWS, SP, CON, HYP, etc.]     │
│  [Combo Chart: Revenue bars + Growth % lines]                           │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 4: CLASS ANALYSIS ──────── (mirrors BB5 Wholesaler pattern) ──┐
│  [SPRBIG | BIG | MEDIUM | SMALL status cards]                          │
│  [Combo Chart: Revenue + LM/LY growth lines per CLASS]                 │
│  [Executive Insight Card]                                               │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 5: TIMEGONE ANALYSIS ──────── (compact single row) ───────────┐
│  [Pace Card] [Status] [Projected EOM vs LM] [Working Days Context]     │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 6: CA OPPORTUNITY ANALYSIS ─── (recovery card) ───────────────┐
│  [CA Churn Count]  [Avg Rev/Outlet]  [Recovery Potential Rp]  [Action]  │
└───────────────────────────────────────────────────────────────────────┘

┌── BLOCK 7: EXECUTIVE INSIGHT ──────── (insight card) ─────────────────┐
│  [Auto-generated narrative from data: leader, fastest, risk, action]    │
└───────────────────────────────────────────────────────────────────────┘
```

### 6.3 Sub-Section Labels (mirroring Wholesaler BB convention)

| Block | Code | Label | Source |
|-------|------|-------|--------|
| Block 1 | MT1 | MT Performance Overview | MT sheet aggregate |
| Block 2 | MT2 | Channel Breakdown — MTI vs NKA | `Channel` column |
| Block 3 | MT3 | Sub-Channel Type Analysis | `Sub Channel` parsed TYPE |
| Block 4 | MT4 | MT Performance by CLASS | `CLASS` column |
| Block 5 | MT5 | Timegone Pace Analysis | MT + `TimeEngine` |
| Block 6 | MT6 | CA Opportunity — Recovery Potential | `CA` vs `CA LM` |
| Block 7 | MT7 | Executive Insight | Derived synthesis |

---

## 7. Recommended KPI Cards

### 7.1 Block MT1 — 4 Headline KPI Cards

**Card 1: Total MT Revenue TM**
```
Label:     Rp [value]B
Sub-label: Modern Trade — MTI + NKA
Comparison: vs LM: [+/-X.X%] · vs LY: [+/-X.X%]
Badge:     Growth Engine / Momentum Loss / Critical (based on LM+LY)
From data: Rp 51.46B (+41.9% LY, +7.7% LM)
```

**Card 2: NKA Revenue (Dominant Channel)**
```
Label:     Rp [value]B
Sub-label: NKA — [XX.X%] share of MT
Comparison: vs LM: [+/-X.X%] · vs LY: [+/-X.X%]
From data: Rp 41.99B, 81.6% share, +49.3% LY, +5.8% LM
```

**Card 3: MTI Revenue**
```
Label:     Rp [value]B
Sub-label: MTI — [XX.X%] share of MT
Comparison: vs LM: [+/-X.X%] · vs LY: [+/-X.X%]
From data: Rp 9.47B, 18.4% share, +16.3% LY, +16.8% LM
```

**Card 4: MT Time Pace**
```
Label:     [X.XXx] pace ratio
Sub-label: Act vs (LM × TimeGone%)
Status badge: AHEAD / ON_PACE / BEHIND
Required WD note: [X] HK remaining
```

### 7.2 Block MT2 — Channel Comparison Cards (MTI / NKA)

Each channel shown as a status card:

```
[Channel: MTI]
Revenue:   Rp 9.47B
vs LM:     +16.8%
vs LY:     +16.3%
CA TM:     26,391
CA Churn:  -2,390
Status:    🚀 Growth Engine
```

```
[Channel: NKA]
Revenue:   Rp 41.99B
vs LM:     +5.8%
vs LY:     +49.3%
CA TM:     6,786
CA Churn:  -1,046
Status:    🚀 Growth Engine
```

---

## 8. Recommended Charts

### 8.1 Chart MT-A: Channel Revenue Comparison (Block MT2)
- **Type:** Grouped bar chart (vertical)
- **X-axis:** Channel (MTI, NKA)
- **Y-axis (left):** Revenue IDR
- **Data series:** Act TM (bar), LMHK (bar), LYHK (bar)
- **Secondary line (right axis):** Growth vs LM %
- **Colors:** Act TM = `--exec-navy`, LMHK = `--gray-300`, LYHK = `--gray-100`

### 8.2 Chart MT-B: Sub-Channel Type Performance (Block MT3)
- **Type:** Horizontal bar chart sorted by Act TM descending
- **X-axis:** Revenue TM (IDR, Rp B format)
- **Y-axis:** TYPE label (MIN, SR, MTWS, MWS, SP, CON, HYP, ...)
- **Color per bar:** Status color (Growth Engine=blue, Momentum Loss=amber, Critical=red)
- **Annotation on bar:** Growth vs LY % displayed inline
- **Max bars:** All 11 types (no truncation — compact horizontal bars at 18px height)

### 8.3 Chart MT-C: CLASS Revenue + Growth Combo (Block MT4)
- **Type:** Combo chart (bars + line) — identical pattern to `renderWholesalerClassPerformance`
- **X-axis:** CLASS (SPRBIG, BIG, MEDIUM, SMALL)
- **Left Y-axis:** Revenue IDR (bars)
- **Right Y-axis:** Growth % (lines)
- **Bar series:** Act TM
- **Line series 1:** Growth vs LM (dashed)
- **Line series 2:** Growth vs LY (solid)
- **Colors:** Bars = `--exec-navy`, LM line = `--amber-main`, LY line = `--green-main`

### 8.4 Chart MT-D: Region × Channel Matrix (Block MT2 expanded)
- **Type:** Stacked bar chart
- **X-axis:** Region (Jabobeka, Jabar1, Jatakalbar, Jabar2)
- **Stacked series:** MTI (navy) + NKA (blue-light)
- **Sorted:** By total Act TM descending
- **Annotation:** Region growth vs LM % shown above each bar

---

## 9. Recommended Opportunity Analysis (Block MT6)

### 9.1 CA Churn Opportunity

The fundamental opportunity equation:

```
Recovery Potential = CA Churned × Average Revenue per Active Outlet
                   = 3,436 × Rp 1,551,071
                   = Rp 5.33B
```

**Display cards:**

| Card | Label | Value |
|------|-------|-------|
| CA Churned | Outlets active LM, absent TM | 3,436 |
| Avg Rev/CA | Revenue per active outlet TM | Rp 1.55M |
| Recovery Potential | If churned outlets re-activate | Rp 5.33B |
| Recovery Difficulty | Churn rate vs total LM | 9.4% of LM base |

### 9.2 Top Channel Opportunity

**By Churn Rate per Channel:**

| Channel | CA LM | CA TM | Churned | Churn % | Potential |
|---------|-------|-------|---------|---------|-----------|
| MTI | 28,781 | 26,391 | 2,390 | 8.3% | Rp 3.71B |
| NKA | 7,832 | 6,786 | 1,046 | 13.4% | Rp 6.47B est. |

**NKA has higher churn rate** (13.4% vs 8.3%) — this is the recovery priority flag.

### 9.3 Concentration Risk Flag

A unique MT business rule: **NKA-MIN-DC-SPRBIG = 49.3% of total MT.** Any aggregate MT figure is dominated by a single sub-channel. The section should display a **concentration risk indicator** when top sub-channel share > 40%:

```
⚠ Concentration Note: NKA-MIN-DC-SPRBIG accounts for 49.3% of total MT revenue.
  Any fluctuation in this single sub-channel materially impacts total MT.
  Diversification metric: HHI (Herfindahl) across top 10 sub-channels.
```

---

## 10. Timegone Analysis (Block MT5)

### 10.1 Pace Calculation

```javascript
// Using TimeEngine (existing, shared utility)
const td = TimeEngine.get();
const timeGonePct = td.timeGone / 100;  // e.g. 0.75

// MT pace: how does current act compare to LM × elapsed time?
// If pace = 1.0 → exactly on LM pace → projected EOM = LM
// If pace > 1.0 → beating LM pace → projected EOM > LM
const mtActTM   = mt.overview.totalActTM;
const mtLMHK    = mt.overview.totalLMHK;
const expectedByNow = mtLMHK * timeGonePct;
const pace          = safeDiv(mtActTM, expectedByNow);  // 1.0 = on pace
const projectedEOM  = timeGonePct > 0 ? safeDiv(mtActTM, timeGonePct) : null;
const projGrowthVsLM = projectedEOM ? safeDiv(projectedEOM - mtLMHK, mtLMHK) * 100 : null;
```

### 10.2 Timegone Display

```
┌───────────────────────────────────────────────────────────┐
│ ⏱ MT5 — Timegone Pace Analysis                           │
├──────────────┬──────────────┬──────────────┬─────────────┤
│ Pace Ratio   │ HK Elapsed   │ HK Remaining │ Proj EOM    │
│ [1.0x]       │ [18/24]      │ [6 HK]       │ [Rp 68.6B]  │
│ ON_PACE      │ 75%          │ 25%          │ +43.5% LM   │
└──────────────┴──────────────┴──────────────┴─────────────┘

Interpretation: If the current MT revenue rate continues for the remaining
6 working days, total MT will reach Rp 68.6B this month (+43.5% vs LM).
```

### 10.3 Timegone Status Logic

```
pace ≥ 1.05  → AHEAD  (green, 🟢) — exceeding LM pace, on track for growth
0.95 ≤ pace < 1.05 → ON_PACE (amber, 🟡) — matching LM pace ±5%
pace < 0.95  → BEHIND (red, 🔴) — lagging LM pace, risk of missing LM
```

**Timegone dependency:** Requires `TimeEngine.get()` which requires DimDate sheet to be loaded. Graceful fallback: if `td.valid === false`, show "Working Day data not available" and suppress pace calculation.

---

## 11. Executive Insight (Block MT7)

### 11.1 Auto-Derived Insight Fields

```javascript
mt.insight = {
  // 1. Dominant sub-channel (concentration alert)
  dominantSubChannel: { name: 'NKA-MIN-DC-SPRBIG', share: 49.3, actTM: 25.37B },

  // 2. Fastest growing TYPE vs LY (from byType)
  fastestGrowingLY:   { type: 'MTWS', growLY: +127.1%, actTM: 4.44B },

  // 3. Fastest growing TYPE vs LM
  fastestGrowingLM:   { type: 'BABY', growLM: +124.6%, actTM: 3.0M },

  // 4. Biggest decliner TYPE (Critical or Momentum Loss)
  biggestDecliner:    { type: 'HB', growLY: -69.4%, growLM: -93.0%, status: 'critical' },

  // 5. Region with highest growth vs LY
  fastestRegion:      { region: 'Jatakalbar', growLY: +304.8%, actTM: 12.14B },

  // 6. Region with momentum concern vs LM
  momentumRegion:     { region: 'Jabobeka', growLM: -19.0%, actTM: 24.74B },

  // 7. CA recovery opportunity
  caOpportunity:      { churned: 3436, potential: 5.33B, topChurnChannel: 'NKA' },

  // 8. Recommended management focus (derived priority)
  focus:              { priority: 'Jabobeka momentum recovery', reason: 'Largest region (-19% LM)' }
}
```

### 11.2 Insight Narrative Template

```
MT Performance: Rp 51.46B (+41.9% LY, +7.7% LM). NKA dominates at 81.6%.
Fastest growing: MTWS (+127.1% LY). Watch: HB channel (-69.4% LY, Critical).
Jabobeka (-19.0% LM) — largest region at Rp 24.74B — shows momentum risk.
CA opportunity: 3,436 churned outlets → Rp 5.33B potential recovery.
Jatakalbar: +304.8% LY — new growth territory, scale investment.
```

---

## 12. Action Recommendation

### 12.1 Priority Matrix

| Priority | Area | Signal | Action |
|----------|------|--------|--------|
| P1 — URGENT | Jabobeka | −19.0% vs LM, Rp 24.74B at risk | Investigate NKA-MIN-DC-SPRBIG order cadence |
| P2 — HIGH | NKA CA Recovery | 1,046 NKA outlets churned (13.4% churn) | AM team re-activation call list |
| P3 — HIGH | HB Channel | −69.4% LY, −93.0% LM (Critical) | Escalate to NSM — structural decline |
| P4 — MEDIUM | Jatakalbar Scale | +304.8% LY — emerging territory | Increase target, allocate resources |
| P5 — MEDIUM | MTWS Momentum | +127.1% LY, fastest growing | Protect and expand MTWS program |

### 12.2 Action Card Design

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚡ MT Priority Action                                                │
├──────────────────────────────────┬──────────────────────────────────┤
│ PRIORITY 1                       │ PRIORITY 2                       │
│ 🔴 Jabobeka Momentum             │ 🔁 NKA CA Recovery               │
│ −19.0% vs LM · Rp 24.74B        │ 1,046 outlets churned            │
│ Action: Audit NKA-MIN-DC-SPRBIG  │ Recovery: Rp 6.47B potential     │
│ PIC: NSM / Regional Manager      │ PIC: AM Team                     │
└──────────────────────────────────┴──────────────────────────────────┘
```

---

## 13. Impact Analysis

### 13.1 Business Impact

| Scenario | Impact |
|----------|--------|
| Full CA recovery (3,436 outlets) | +Rp 5.33B revenue |
| Jabobeka recovers to LM level | +Rp 5.87B vs current |
| HB channel stabilized at LM | +Rp 0.50B |
| Jatakalbar scaled 50% further | +Rp 6.07B |

### 13.2 Implementation Impact on Existing System

| Module | Impact Type | Severity |
|--------|-------------|----------|
| `excelParser.js` | Additive — new sheet parse | Zero regression risk |
| `state.js` | Additive — new raw.mt key | Zero regression risk |
| `filterPanel.js` | Additive — MT filter logic | Low risk — mirrors existing pattern |
| `kpiEngine.js` | Additive — new `calcMT()` in `_section` wrapper | Zero regression — isolated try/catch |
| `renderEngine.js` | Additive — new `_safeRender('renderMT', ...)` call | Zero regression — isolated |
| `index.html` | Additive — new `<div>` container between Wholesaler and PS Achiever | Zero regression |
| Existing sections | None — all existing State.kpi keys preserved | Zero regression |

---

## 14. Export Compatibility

### 14.1 Excel Export

The existing `ExportEngine` must be extended to include MT sheet data when exporting. Required additions:

- **Sheet: "MT Analysis"** — aggregate table with columns: Channel, Type, Revenue TM, Revenue LM, Revenue LY, Growth LM%, Growth LY%, CA TM, CA LM, CA Churn, Status
- **Sheet: "MT CLASS"** — CLASS-level performance table
- **Sheet: "MT Region"** — Region × Channel matrix

These are additive sheets in the existing Excel export. No modification to existing export sheets required.

### 14.2 Executive Card Export

**MT Executive Card** (`id="mt-exec-card"`) following existing `ExecCardEngine` pattern:

```
┌────────────────────────────────────────────────────────────┐
│ SCT v6 · Modern Trade Analysis                   [LOGO]   │
│ ─────────────────────────────────────────────────────────  │
│ TOTAL MT: Rp 51.46B   +41.9% LY   +7.7% LM              │
│ ─────────────────────────────────────────────────────────  │
│ MTI  Rp 9.47B  +16.3% LY  │  NKA  Rp 41.99B  +49.3% LY │
│ ─────────────────────────────────────────────────────────  │
│ FASTEST: MTWS +127.1%  │  WATCH: HB -69.4% (Critical)    │
│ CA OPP: Rp 5.33B (3,436 outlets)                          │
│ [timestamp] [region filter] [period]                       │
└────────────────────────────────────────────────────────────┘
```

### 14.3 PDF Export

Section 17 (MT Analysis) automatically included in PDF report via existing scrollCapture pattern. No change required to PDF export logic — section DOM container renders automatically.

---

## 15. Mobile Compatibility

### 15.1 Breakpoint Behavior

Following SCT's existing responsive pattern (1366 / 1600 / 1920):

| Block | Desktop Layout | Mobile/Narrow Layout |
|-------|---------------|---------------------|
| MT1 KPI Cards | 4-column grid | 2-column × 2-row grid |
| MT2 Channel (table + chart) | Side-by-side (50/50) | Stacked (table then chart) |
| MT3 Type table | Full-width horizontal bars | Full-width, scrollable |
| MT4 CLASS | 4-column status cards + chart | 2-column cards, chart below |
| MT5 Timegone | 4-column row | 2-column × 2-row |
| MT6 CA Opportunity | 3-column cards | Single column |
| MT7 Executive Insight | Full-width card | Full-width card |

### 15.2 CSS Classes Required

All MT-specific CSS classes must use `mt-` prefix to avoid collision with existing styles:

```css
.mt-kpi-grid   /* 4-col responsive KPI grid */
.mt-channel-grid /* 2-col channel comparison */
.mt-type-table   /* sub-channel type table */
.mt-class-grid   /* 4-col CLASS status cards */
.mt-insight-card /* executive insight panel */
```

---

## 16. Rollback Strategy

### 16.1 Zero-Risk Design

The MT section is **100% additive**. Rollback requires removing only the additions:

| Step | Action | Risk |
|------|--------|------|
| 1 | Remove `State.raw.mt = []` from `state.js` | Zero |
| 2 | Remove `State.raw.mt` parse from `excelParser.js` | Zero |
| 3 | Remove MT filter logic from `filterPanel.js` | Zero |
| 4 | Remove `calcMT()` from `kpiEngine.js` | Zero |
| 5 | Remove `_safeRender('renderMT', ...)` from `renderEngine.js` | Zero |
| 6 | Remove MT HTML container from `index.html` | Zero |

**All existing functionality is unaffected** because the MT module uses isolated namespacing (`State.kpi.mt`) and a dedicated `_safeRender` wrapper that cannot propagate failures.

### 16.2 Feature Flag (Optional)

For extra safety, a feature flag can be added to `Config`:

```javascript
// core/config.js
MT_ANALYSIS_ENABLED: true  // set false to disable without code removal
```

Then in `renderEngine.execAll()`:

```javascript
if (Config.MT_ANALYSIS_ENABLED) {
  _safeRender('renderMT', () => RenderEngine.renderMT(k.mt));
}
```

---

## Appendix A: Data Contract (Full Specification)

```
State.kpi.mt = {
  hasData: boolean,                    // false if State.filtered.mt is empty

  overview: {
    totalActTM:        number,          // SUM(Act TM) all rows
    totalLYHK:         number,          // SUM(LYHK) all rows
    totalLMHK:         number,          // SUM(LMHK) all rows
    growVsLY:          number | null,   // (totalActTM / totalLYHK) - 1, null if LY=0
    growVsLM:          number | null,   // (totalActTM / totalLMHK) - 1, null if LM=0
    gapVsLY:           number,          // totalActTM - totalLYHK
    gapVsLM:           number,          // totalActTM - totalLMHK
    totalCAT:          number,          // SUM(CA)
    totalCALM:         number,          // SUM(CA LM)
    caChurn:           number,          // totalCALM - totalCAT (positive = outlets lost)
    avgRevPerCA:       number,          // totalActTM / totalCAT
    recoveryPotential: number,          // caChurn × avgRevPerCA
  },

  byChannel: [                          // indexed [0]=MTI, [1]=NKA
    {
      channel:    string,               // 'MTI' | 'NKA'
      actTM:      number,
      lyHK:       number,
      lmHK:       number,
      caT:        number,
      caLM:       number,
      caChurn:    number,
      growVsLY:   number | null,
      growVsLM:   number | null,
      share:      number,               // actTM / overview.totalActTM * 100
      status:     StatusObject,         // { key, label, tone, badge, icon }
    }
  ],

  byType: [                             // sorted by actTM descending
    {
      type:       string,               // 'MIN' | 'SR' | 'MTWS' | etc.
      label:      string,               // display label
      channels:   string[],             // ['MTI'] | ['NKA'] | ['MTI','NKA']
      actTM:      number,
      lyHK:       number,
      lmHK:       number,
      growVsLY:   number | null,
      growVsLM:   number | null,
      share:      number,               // % of total MT
      status:     StatusObject,
    }
  ],

  byClass: [                            // ordered: SPRBIG, BIG, MEDIUM, SMALL
    {
      cls:        string,               // 'SPRBIG' | 'BIG' | 'MEDIUM' | 'SMALL'
      actTM:      number,
      lyHK:       number,
      lmHK:       number,
      caT:        number,
      caLM:       number,
      growVsLY:   number | null,
      growVsLM:   number | null,
      share:      number,
      status:     StatusObject,
    }
  ],

  byRegion: [                           // sorted by actTM descending
    {
      region:     string,
      actTM:      number,
      lyHK:       number,
      lmHK:       number,
      growVsLY:   number | null,
      growVsLM:   number | null,
      caT:        number,
      caLM:       number,
      caChurn:    number,
    }
  ],

  timegone: {
    pace:            number | null,     // actTM / (lmHK × timeGone%)
    paceStatus:      string,            // 'AHEAD' | 'ON_PACE' | 'BEHIND'
    projectedEOM:    number | null,     // actTM / timeGone%
    projGrowthVsLM:  number | null,     // (projEOM / lmHK) - 1
    valid:           boolean,           // false if TimeEngine not loaded
  },

  concentration: {
    topSubChannel:   string,            // 'NKA-MIN-DC-SPRBIG'
    topSubChannelAct: number,           // 25.37B
    topSubChannelShare: number,         // 49.3
    isConcentrated:  boolean,           // true if top sub-channel > 40%
  },

  insight: {
    biggestChannel:    object | null,   // highest actTM channel
    fastestGrowingLY:  object | null,   // TYPE with max growVsLY
    fastestGrowingLM:  object | null,   // TYPE with max growVsLM
    biggestDecliner:   object | null,   // TYPE with most negative combined growth
    fastestRegion:     object | null,   // Region with max growVsLY
    momentumRisk:      object | null,   // Region/Channel with negative growVsLM + high actTM
    caOpportunity:     object | null,   // { churned, potential, topChurnChannel }
    focus:             object | null,   // { area, reason, urgency }
  }
}
```

---

## Appendix B: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `data/excelParser.js` | ADDITIVE | Add MT sheet detection + `State.raw.mt` parse |
| `core/state.js` | ADDITIVE | Add `mt: []` to `raw` and `filtered` |
| `ui/filterPanel.js` | ADDITIVE | Add MT filter pass-through in `applyFilters()` |
| `business/kpiEngine.js` | ADDITIVE | Add `calcMT(rows)` method + call in `runAll()` |
| `business/renderEngine.js` | ADDITIVE | Add `renderMT(mt)` method + call in `execAll()` |
| `index.html` | ADDITIVE | Add MT section HTML container |
| `ui/mtView.js` | NEW FILE | Standalone MT view module (optional — can stay in renderEngine) |

**Total files changed: 6 (existing) + 1 (new)**  
**Zero modifications to existing business logic**  
**Zero modifications to existing KPI calculations**  
**Zero modifications to existing render output**

---

## Appendix C: Key Data Facts (for Implementation Reference)

```
Grand Total MT (All/All/All):
  Act TM:   Rp 51.46B
  LMHK:     Rp 47.80B
  LYHK:     Rp 36.26B
  Grow LM:  +7.7%
  Grow LY:  +41.9%
  CA TM:    33,177
  CA LM:    36,613
  CA Churn: -3,436

Channel Split:
  MTI:  Rp  9.47B  (18.4%)  26,391 CA
  NKA:  Rp 41.99B  (81.6%)   6,786 CA

Top Sub-Channel:
  NKA-MIN-DC-SPRBIG: Rp 25.37B (49.3% of total MT)

Top Region:
  Jabobeka:   Rp 24.74B (-19.0% LM) — highest revenue, momentum concern
  Jabar1:     Rp 10.82B (+20.7% LM) — growing
  Jatakalbar: Rp 12.14B (+124.7% LM) — fastest growth
  Jabar2:     Rp  3.76B (+29.8% LM) — steady

CLASS:
  SPRBIG: Rp 37.69B (73.2%) — dominant
  BIG:    Rp  6.92B (13.5%)
  SMALL:  Rp  4.89B (9.5%)
  MEDIUM: Rp  1.96B (3.8%)

Type Growth vs LY (all channels):
  MTWS:  +127.1% — fastest
  SP:    +60.1%
  MIN:   +57.2%
  FRUIT: +29.1%
  WS:    +28.5%
  SR:    +13.0%
  MWS:   +7.8%
  CON:   -1.9%
  BABY:  +25.6% (tiny base)
  HYP:   -20.0%
  HB:    -69.4% — critical decline
```

---

*Blueprint prepared: Sprint 17 — Architecture & Design Phase Only*  
*No code written. No files modified. Ready for Sprint 18 implementation.*
