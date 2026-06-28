# Sprint 19B — MT Analysis: Product Review & UX Refinement
**Review Date:** 2026-06-26
**Reviewer Role:** Senior Product Owner + FMCG Business Intelligence Consultant + UX Reviewer
**Scope:** MT Analysis — Sprint 18 (MT1–MT4) + Sprint 19A (MT5 Timegone)
**Mandate:** Product quality review. No code changes. No patches. Lock design before Sprint 20.

---

## 1. Executive Summary

The MT Analysis implementation (MT1–MT5) delivers a technically sound and functionally complete analytical block. All KPI calculations are correct, the data pipeline is clean, and the Sprint 19A timegone analysis introduces a meaningful pacing metric using last-month as benchmark — a pragmatic solution given the absence of a Target column in the MT sheet.

**However, the product has three structural problems that must be resolved before Sprint 20:**

1. **No unified executive entry point.** An NSM or GM Sales opening the MT section sees five sub-sections of equal visual weight. There is no hero moment — no single number or status that summarises "how is MT doing right now?" before the reader decides to go deeper.

2. **The business story is incomplete.** The section covers Channel → Type → Class → Timegone, but Regional performance is computed and silently discarded. For FMCG, regional accountability is non-negotiable for NSM-level use.

3. **The MT4 insight block has a cross-contamination defect.** Region-level momentum risk is displayed inside the CLASS section (MT4). This is not a code bug — it is a product design error that undermines credibility when a reader sees "Region X at risk" inside a chart labelled "Performance by CLASS."

Everything else is refinement and prioritisation, not structural failure.

**Overall Product Readiness Score: 72 / 100**
The product is not ready for NSM/GM-level daily use in its current form. It is ready for Trade Marketing Manager and analyst use.

---

## 2. Product Review

### 2.1 Executive Readability — Score: 5 / 10

**Assessment:** A typical NSM or GM Sales cannot extract a clear picture of MT health within 10 seconds. The section opens directly into four KPI cards of equal size, then immediately flows into four sub-sections of tables and charts, each with its own inline insight block. The total reading distance from entry to the timegone pacing signal (MT5) is extremely long — a reader must scroll through two tables and two charts before reaching the most time-sensitive KPI.

**Specific problems:**
- No section-level "MT Status" badge (e.g., GROWTH / RECOVERY / CRITICAL) visible at the top
- Hero KPI card (Total MT Revenue) is the same size as NKA Revenue, MTI Revenue, and CA Active TM — no visual hierarchy
- CA Active TM is an operations metric (outlet count) in a row of revenue metrics — it breaks pattern recognition
- The most executive-relevant signal (timegone pace vs last month) is at the bottom of the section, after the most analyst-relevant signals

**What an NSM needs in 10 seconds:**
> "MT is [status]. Total: Rp X. NKA: X% share, MTI: X% share. Pace: Y% vs LM (timegone Z%). Key risk: [one sentence]."

This is not currently surfaced.

---

### 2.2 KPI Review

**MT1 — Headline Cards:**

| KPI | Classification | Comment |
|-----|---------------|---------|
| Total MT Revenue | Essential | Correct. Should be visually dominant (hero). |
| NKA Revenue | Essential | Correct. Share% and growth are both needed. |
| MTI Revenue | Essential | Correct. Symmetric with NKA. |
| CA Active TM | Nice to Have | Useful, but breaks the revenue pattern. Should move to an operational KPI strip or a dedicated CA sub-section. |

**MT2 — Channel Breakdown:**

| KPI | Classification | Comment |
|-----|---------------|---------|
| Revenue TM | Essential | Core. |
| Share % | Essential | Critical for NKA/MTI balance decision. |
| vs LM % | Essential | Month-on-month trend. |
| vs LY % | Essential | Year-on-year trend. |
| Status badge | Essential | Four-quadrant classification (Growth/Recovery/Momentum/Critical) is appropriate. |

**MT3 — Sub-Channel Type:**

| KPI | Classification | Comment |
|-----|---------------|---------|
| Type label (Minimarket, Supermarket, etc.) | Essential | The most actionable segmentation for Trade Marketing. |
| Channel tag | Nice to Have | Useful context, but the 9px font on the channel column is too small to read. |
| Revenue TM | Essential | Core. |
| Share % | Essential | Trade distribution signal. |
| vs LM % | Essential | Required. |
| vs LY % | Essential | Required. |
| Status badge | Essential | Correct. |

MT3 has no redundant KPIs. However, the **7-column table on a laptop screen is too wide** and the Channel column has near-illegible font size.

**MT4 — Performance by CLASS:**

| KPI | Classification | Comment |
|-----|---------------|---------|
| CLASS (SPRBIG / BIG / MEDIUM / SMALL) | Essential | Revenue tiering by store size — critical for FMCG account management. |
| Revenue TM | Essential | Core. |
| Share % | Essential | Tier contribution. |
| vs LM % | Essential | Required. |
| vs LY % | Essential | Required. |
| Status badge | Essential | Correct. |
| MT4 Insight — biggestChannel | **Redundant** | Already shown in MT1 and MT2. Repeats information that is 2 seconds of scrolling above. |
| MT4 Insight — momentumRisk (Region) | **Wrong section** | This is a region insight displayed in a CLASS section. Structural cross-contamination. |
| MT4 Insight — focus (critType/biggestDecliner) | Essential | The only CLASS-specific insight. Should be the only MT4 insight. |

**MT5 — Timegone:**

| KPI | Classification | Comment |
|-----|---------------|---------|
| Timegone % | Essential | The foundational pacing denominator. |
| HK Passed | Essential | Transparency — tells reader where in the month we are. |
| HK Remaining | Essential | Action-oriented — "how many working days left." |
| HK Total | Nice to Have | Derivable from HK Passed + HK Remaining. Marginal value. |
| Achievement % vs LM | Essential | The headline pacing metric. |
| Gap vs Timegone | Essential | The decision metric — positive = ahead, negative = behind. |
| To Match LM / Required Daily Sales | Essential | The most actionable KPI — daily target to recover. |
| Recovery Need % | Essential | Pace uplift needed — % is more intuitive than absolute. |
| Recovery Interpretation Badge | Essential | Low/Moderate/High/Critical — the right qualitative layer. |
| Projected Month End vs LM | Nice to Have | Useful forward-looking signal. However, with only 2 channels (NKA + MTI), this feels less impactful than in BB2.5 which has 3–5 programs. |

**Total KPI Assessment:**
- 28 individual KPIs/metrics across MT1–MT5
- ~23 are Essential or Nice to Have
- ~3 are Redundant (biggestChannel in MT4 insight, momentumRisk region in MT4, HK Total in MT5)
- 1 is in the wrong section (momentumRisk region shown in CLASS section)

---

## 3. UX Review

### 3.1 Visual Hierarchy — Score: 6 / 10

**Strengths:**
- The 4-card MT1 row establishes a clear starting point
- Sub-section numbered titles (MT2, MT3, MT4, MT5) give the reader a wayfinding structure
- The BB2.5-derived tg-card in MT5 is well-structured — hero / grid / mini layout works

**Weaknesses:**

**Hero KPI absent.** All 4 MT1 cards are the same size. In FMCG dashboards, the Total Revenue card should be 1.5× to 2× the size of the channel breakdown cards. The reader's eye has no anchor.

**CA Active TM card breaks the row rhythm.** Three cards measure revenue; the fourth measures outlet count. The 4th card header ("📊 CA Active TM") and the sub-line ("CA LM: X outlets") are measuring a fundamentally different unit. A reader scanning quickly will misread it as a revenue card.

**Sub-section titles are descriptive, not diagnostic.** "📦 MT3 — Sub-Channel Type Performance" tells the reader what the section contains, not what they need to know. Compare to a diagnostic title: "📦 MT3 — Type Performance: Minimarket leads, Specialty at risk." The diagnostic version would double executive comprehension speed.

**Inline insights are visually buried.** The `kpi-insight` blocks after MT3 and MT4 are rendered below the chart in a small text format. A reader who finishes scanning the chart must look downward into a lower-contrast text block to find the insight. The insight should be above or beside the chart, not below it.

**MT5 is visually disconnected.** The timegone block (MT5) uses a different visual language (`tg-header`, `tg-card`, `tg-grid`) than MT1–MT4 (which use `kpi-card`, `sub-section`, `data-table`). On a conceptual level this is intentional reuse of BB2.5 patterns. On a visual level, the MT section changes language halfway through, which creates a sense of visual discontinuity — the reader feels they have entered a different product.

### 3.2 Spacing and Density — Score: 6 / 10

The MT section as currently structured contains:
- 4 KPI cards
- 2 tables with total rows (MT2, MT4)
- 1 table without total row (MT3)
- 2 dual-axis combo charts
- 3 inline insight blocks (MT3, MT4, MT5)
- 1 timegone header strip
- 2 timegone channel cards
- 1 executive summary list

On a 1920×1080 laptop screen, this is approximately **5–6 full screens of content** for a single channel (MT). If the user is also reviewing Wholesaler, PS Achiever, and Executive Summary, MT alone constitutes a significant portion of total scroll distance.

**Density verdict:** The density is appropriate for an analyst or Trade Marketing Manager. It is too high for NSM / GM Sales daily use without a summary-first design.

### 3.3 Color System — Score: 8 / 10

**Strengths:**
- NKA = blue, MTI = green: consistent across MT1 cards and MT5 timegone cards
- Growth = blue badge, Recovery = amber, Momentum Loss = amber, Critical = red: appropriate
- Text-green / text-red for growth deltas: consistent with the rest of the dashboard

**Weaknesses:**

**Recovery and Momentum Loss are visually identical.** Both use `solid-amber`. From a distance, an NSM looking at the MT2 channel table cannot distinguish "Recovery" (growing vs LM but declining vs LY) from "Momentum Loss" (declining vs LM but growing vs LY). These are very different business situations with different urgency levels, but they are rendered identically.

**MT5 tg-badge color semantics are non-intuitive.** `tg-ahead` (green) is used for BOTH AHEAD (≥+5pp) and ON TRACK (≥−5pp). This means a channel that is exactly at timegone pace (gapVsTG = 0) and a channel that is 10pp ahead of pace both render green, indistinguishable. For a busy executive, the AHEAD state should feel different from ON TRACK — but it does not.

**`tg-ontrack` maps to amber, not green.** The CSS class name says "on track" but it is amber (meaning warning). This is a naming trap — any future developer editing the code will apply `tg-ontrack` thinking it means "green / good" when it actually means "amber / recovery." This is not a visual bug for users, but it is a maintenance risk.

### 3.4 Chart Review — Score: 7 / 10

**MT2 Chart (Channel Breakdown — Combo: bars + 2 lines):**
- Chart type: appropriate. Bars for absolute revenue, lines for growth rates — standard FMCG viz.
- **Risk: only 2 data points (NKA + MTI).** A combo chart with 2 bars and 2 lines on 2 x-axis labels looks sparse. The chart carries less information than the table below it. Consider whether a pie/donut (share) or a grouped bar (sales vs LM vs LY) would be more informative.
- Labels: adequate. Font sizes are consistent with the rest of the dashboard.
- Legend: positioned at bottom with point style markers — correct and readable.
- Tooltip: properly formatted with Rp compact format and % suffix.

**MT4 Chart (CLASS — Combo with data labels):**
- Chart type: appropriate. More data points (up to 4 classes: SPRBIG, BIG, MEDIUM, SMALL) make the combo chart more effective here than MT2.
- Data labels on bars and lines: a strong design choice. Eliminates the need to hover to read values.
- **Risk: data labels may overlap** when CLASS values are close (e.g., BIG and MEDIUM have similar revenue). At smaller screen widths, labels above bars and line points will collide.
- Axis labels: "Sales TM (Rp)" and "Growth %" are clear and correctly positioned.

**MT3: No chart.** The sub-channel type table has up to 10 row types (Minimarket, Supermarket, MT Wholesale, etc.). This is a large dataset with no visual representation. An ordered bar chart of Revenue by Type would dramatically improve pattern recognition speed. Currently the reader must parse 10 rows of numbers to identify the top and bottom performers.

**Chart colour consistency:**
- Sales TM bars: `#0F2744` (navy) — consistent across MT2 and MT4. Good.
- Growth LM line: `#10B981` (green) — consistent. Good.
- Growth LY line: `#F59E0B` (amber, dashed) — consistent. Good.

---

## 4. Business Review

### 4.1 Business Story Flow — Score: 6 / 10

**Current flow:**
```
MT1 (Total + Channel Headlines)
↓
MT2 (Channel detail: NKA vs MTI table + chart)
↓
MT3 (Sub-Channel Type detail table)
↓
MT4 (CLASS detail table + chart)
↓
MT5 (Timegone pacing)
```

**Assessment:**

The flow starts well — MT1 gives the overview, MT2 drills into the two key channels. The problem begins at MT3 and MT4. These are analyst-level segmentations (sub-channel type, store class) that appear before the most time-sensitive executive signal: timegone pacing (MT5).

In FMCG performance management, the question hierarchy for NSM/GM is:
> 1. Where are we vs target/benchmark? (pacing — MT5 answers this)
> 2. Who is driving it? (channel — MT2 answers this)
> 3. What's the risk? (declining segments — MT3/MT4 answer this)
> 4. What do we do? (action recommendation)

The current order addresses questions 2 → 3 → 1, not 1 → 2 → 3. MT5 (pacing) should be the second block after MT1 (overview), not the last.

**Recommended story arc:**
```
MT1 — Headline: "MT this month, how much?"
↓
MT5 — Pacing: "Are we on pace vs last month?"
↓
MT2 — Channel: "Which channel is driving it?"
↓
MT3 — Type: "Which store type is winning/losing?"
↓
MT4 — Class: "Which store size is winning/losing?"
↓
MT6 (future) — Opportunity: "Where is the gap?"
```

This restructuring requires only HTML reordering (MT5 block moves above MT2) and zero business logic changes.

### 4.2 Missing Regional Breakdown

`byRegion` is fully computed in `calcMT()` and contains: Revenue TM, vs LM, vs LY, CA by region, CA Churn by region. This data is computed but never displayed. The only place region data surfaces is in MT4's `momentumRisk` insight bullet — and even there it is shown inside the wrong section.

For NSM and GM Sales, regional accountability is mandatory. An NSM cannot have a complete MT review without knowing which regions are driving growth and which are declining. The absence of a regional view makes the MT section incomplete for executive use.

This should be MT6 (Regional MT Performance) — not necessarily Sprint 20, but it is a product gap that limits executive adoption.

### 4.3 CA (Customer Active) Analysis

CA data is surfaced in two places:
- MT1 card: total active outlets, vs LM net change
- MT insight: CA churn, recovery potential (computed but not prominently displayed)

The `recoveryPotential` (`caChurn × avgRevPerCA`) is calculated in KPI engine and available in `overview.recoveryPotential`. This is one of the most commercially powerful metrics in the entire dashboard — if 50 outlets churned and each outlet averages Rp 15M/month, that is Rp 750M of recoverable revenue. However, this number is currently buried inside the `overview` object and **never rendered** in any MT section.

This is a product oversight: the most actionable FMCG metric (revenue recovery potential from churned accounts) is computed but invisible.

### 4.4 Status Classification — Business Accuracy

The four-quadrant status logic is:
- **Growth Engine:** up vs LM AND up vs LY → `solid-blue` 🚀
- **Recovery:** up vs LM, down vs LY → `solid-amber` 🔁
- **Momentum Loss:** down vs LM, up vs LY → `solid-amber` ⚠
- **Critical:** down vs LM AND down vs LY → `solid-red` 🔴

This classification is business-accurate for FMCG. The four quadrant model correctly captures both short-term (LM) and long-term (LY) performance direction.

**Issue:** Recovery and Momentum Loss are business-distinct situations but visually identical (`solid-amber`). In practice:
- **Recovery** (up LM, down LY) is relatively positive — the channel is improving and gaining momentum. The year-on-year decline may be a prior-year anomaly.
- **Momentum Loss** (down LM, up LY) is more concerning — the channel had strong prior-year comparables but is now weakening. This is often a sign of competitive pressure or channel conflict.

An NSM looking at the channel table with two amber badges will not know which situation they are looking at without reading the badge label — which is fine, but in dense reports, labels are often scanned rather than read.

---

## 5. Dashboard Story Review

### 5.1 MT3 Insight Quality

Current MT3 insights:
- **Fastest Growth vs LY:** `[Type]: +X% year-on-year.`
- **Fastest Growth vs LM:** `[Type]: +X% month-on-month.`
- **Critical:** `[Type] (LM: X% · LY: X%) — X% share.`
- **Concentration:** `[Sub-Channel] menyumbang X% dari total MT.`

**Assessment:** The growth insights are factual but not actionable. Knowing that Minimarket grew the fastest tells the NSM what happened, not what to do.

**Better insight pattern:**
> "Minimarket (+18% vs LM) is outperforming the MT average. Consider accelerating activation budget allocation to minimarket formats in Q3."

> "Specialty is declining −12% vs LM with 8% share. If unchecked, this represents Rp X revenue at risk."

The current insights lack: (1) implication, (2) magnitude in Rp terms, (3) suggested action.

### 5.2 MT4 Insight Quality

Current MT4 insights (as rendered):
- **Largest Channel:** `[Channel] — Rp X (X% share)` — **Redundant with MT1 + MT2**
- **Momentum Risk:** `[Region] +X% vs LM — Rp X revenue at risk` — **Wrong section** (region data in CLASS section)
- **Priority:** `[Type] — [Status]: X% share` — Correct but generic

The MT4 insight block is the weakest in the MT Analysis. It mixes data from different dimensions (channel, region, type) inside a CLASS section, creating confusion about what "CLASS" means. An NSM reading this insight block in MT4 would legitimately question whether the dashboard is correct.

### 5.3 MT5 Insight Quality

Current MT5 executive summary (max 4 bullets):
1. Worst gap vs timegone: `[Channel] (+X pp vs timegone)`
2. Highest recovery need: `[Channel] (+X% pace uplift — [Recovery Category])`
3. Best projected finish: `[Channel] (X% vs LM)`
4. Best performing channel: `[Channel] — X% vs LM achievement`

**Assessment:** This is the strongest insight block in MT Analysis. All four bullets are:
- Correctly attributed to a specific channel
- Quantified in a unit the reader understands
- Non-redundant (each bullet answers a different question)

**One improvement opportunity:** Bullet 4 (Best performing channel) is derivable from bullet 3 (Best projected finish) in most scenarios — they will usually name the same channel. Consider replacing bullet 4 with a **risk alert** if any channel's `reqDailySales` implies an infeasible daily rate (e.g., if Required Daily Sales exceeds the highest daily rate achieved in the month).

---

## 6. Improvement Backlog

### P1 — High Priority (Must fix before Sprint 20)

**P1-A: Fix MT4 insight cross-contamination**
The `momentumRisk` insight (Region data) must be removed from MT4's insight block. MT4 is about CLASS. The region momentum risk should either move to a future Regional MT section or be surfaced in MT3 Type insight with correct framing.
`Impact: Executive credibility. An NSM reading "Region X at risk" inside a CLASS chart loses trust in the entire section.`

**P1-B: Move MT5 (Timegone) to second position — directly after MT1**
Story flow should be: Overview → Pacing → Channel breakdown → Segmentation. Currently pacing is last. Timegone is the most time-sensitive executive metric and should be the first drill-down after the headline numbers.
`Impact: Reduces time-to-insight for NSM from 5 screens of scroll to 1 screen.`

**P1-C: Surface the Recovery Potential (Rp) somewhere visible**
`overview.recoveryPotential` is computed (`caChurn × avgRevPerCA`) and never shown. This is the most actionable FMCG metric in the section. Minimum viable rendering: a single line in the CA card or a dedicated insight bullet at the top of the MT section.
`Impact: Direct commercial value. Churned outlet recovery is a core FMCG growth lever.`

**P1-D: Add a section-level MT Status badge**
The MT section header should display an overall MT status: GROWTH / RECOVERY / MOMENTUM LOSS / CRITICAL based on the overview `growVsLM` and `growVsLY`. This is the first thing an NSM should see.
`Impact: Enables 3-second executive scan ("MT is RECOVERY — growth vs LM but declining vs LY").`

### P2 — Medium Priority (Target Sprint 20 or 21)

**P2-A: Add Regional MT breakdown (MT6)**
`byRegion` is fully computed. Render it as a table (Region, Revenue TM, vs LM, vs LY, CA, CA Churn, Status). This is a product gap for NSM-level use.
`Impact: Enables regional accountability conversations in weekly business reviews.`

**P2-B: Replace MT2 chart with share + growth dual view**
A 2-channel combo chart (NKA vs MTI) with 2 bars + 2 lines is visually sparse. Consider replacing with a donut chart for share (more immediately readable for 2 segments) alongside a small bar comparison for growth vs LM and LY.
`Impact: Cleaner visual for a 2-segment dataset. Donut share is faster to read than a bar chart.`

**P2-C: Add a chart to MT3 (Sub-Channel Type)**
MT3 has the richest multi-row dataset (up to 10 types) but no chart. An ordered horizontal bar chart (Revenue by Type, colored by Status) would dramatically improve pattern recognition for analysts and Trade Marketing Managers.
`Impact: Makes MT3 section actionable without having to parse a 10-row table.`

**P2-D: Make Recovery Need badge visually distinguish from Critical**
Both `Recovery` and `Momentum Loss` status badges are `solid-amber`. Consider differentiating — e.g., Recovery as `solid-amber-light` (outline/lighter) and Momentum Loss as `solid-amber` (filled). Alternatively, add directional icons: Recovery = 🔁 (already done, correct) vs Momentum Loss = ⚠ (already done). Confirm these icons are large enough to be legible at table density.
`Impact: Faster visual triage for NSM reading the channel or type table.`

**P2-E: Make diagnostic sub-section titles optional**
Consider adding a subtitle line below each sub-section number/title that renders the lead insight dynamically. Example: instead of "MT3 — Sub-Channel Type Performance", render "MT3 — Type: Minimarket leads (+18%), Specialty critical (−12%)". This converts the section header from a label into an executive alert.
`Impact: NSM can scan section headers alone and identify where to read carefully.`

**P2-F: Surface Recovery Potential in MT Opportunity framing**
When Sprint 20 (Opportunity Engine) is implemented for MT, the `recoveryPotential` value should be the primary opportunity signal — ahead of gap-vs-target because MT has no quota.
`Impact: Positions MT Opportunity correctly as a CA recovery story, not a target-gap story.`

### P3 — Nice to Have (Sprint 22+)

**P3-A: Separate CA metric into its own sub-section**
Currently CA Active TM is the 4th MT1 headline card, breaking the revenue row pattern. Consider a small dedicated CA strip below MT1 showing: Active TM, Active LM, Net Change, Churn%, Recovery Potential (Rp). This groups outlet health data independently from revenue data.

**P3-B: Add collapse/expand for MT3 and MT4**
For NSM daily use, MT3 and MT4 are analyst-level. A collapse control (open by default for analysts, collapsed for executive view) would reduce scroll distance significantly. Implementation: a single `data-collapsible` attribute on each sub-section div.

**P3-C: Replace HK Total with "Days Elapsed" in MT5 header**
HK Total is derivable (HK Passed + HK Remaining). Replacing it with "Days Elapsed" or "Month Progress" (`HK Passed / HK Total × 100`) adds forward-looking context that HK Total alone does not provide. Or eliminate HK Total entirely and show only Timegone%, HK Passed, HK Remaining — 3 data points is cleaner than 4 for a header strip.

**P3-D: MT5 AHEAD vs ON TRACK visual distinction**
Both AHEAD and ON TRACK render the same green `tg-ahead` badge. Consider using a different icon for AHEAD (e.g., 🔵 or ⬆ in addition to green) to make "ahead of pace" feel celebratory rather than merely "acceptable." This preserves the CSS class structure while adding a visual signal.

**P3-E: Colour-code `tg-ontrack` CSS class name**
The CSS class `tg-ontrack` maps to amber. This naming trap will confuse future maintainers. This is a Sprint 20+ housekeeping item — rename to `tg-recovery` or add a code comment at every usage site.

---

## 7. Final Recommendation

### DO before Sprint 20:

| # | Action | File | Effort |
|---|--------|------|--------|
| P1-A | Remove region insight from MT4 insight block | renderEngine.js | XS — delete 3 lines |
| P1-B | Move MT5 HTML block above MT2 | index.html | XS — cut/paste in HTML only |
| P1-C | Add recoveryPotential to CA card or top insight | renderEngine.js | S — 2–3 new lines |
| P1-D | Add MT Status badge to section header | renderEngine.js + index.html | S — 4–5 lines |

All four P1 items are low-effort (< 30 lines combined) and zero business-logic risk. None touch KPI calculations. All are render/HTML changes only.

### DO in Sprint 20 or 21:

- P2-A: Add Regional MT breakdown (MT6) — proper sprint scope
- P2-C: Add MT3 chart — medium effort, high UX value
- P2-F: Wire Recovery Potential into Opportunity framing

### DEFER:

- P2-B: MT2 chart redesign — low urgency
- P3-A through P3-E: Polish items for Sprint 22+

---

### Final Product Readiness Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Business Value | 8/10 | Correct KPIs, correct calculations, actionable for Trade Marketing |
| Executive Readability | 5/10 | Too dense, no hero moment, pacing buried at bottom |
| UX | 6/10 | Consistent CSS, but no visual hierarchy, insight blocks buried |
| Storytelling | 6/10 | Flow is wrong — pacing should precede segmentation |
| Consistency | 8/10 | MT consistent with Wholesaler pattern; MT5 reuses BB2.5 correctly |
| Scalability | 9/10 | byRegion computed, calcMTTimegone modular, Sprint 20 ready |
| **Overall** | **7.0 / 10** | Analyst-ready. Needs 4 targeted P1 fixes for executive use. |

---

### GO / NO-GO Assessment

**NO-GO for NSM/GM Sales daily use** in current form.
**GO for analyst and Trade Marketing use.**
**GO for Sprint 20** — with the condition that P1-A and P1-B are implemented as pre-Sprint-20 patch (they are HTML/render-only changes, not business logic).

The MT Analysis foundation is solid. The business rules are correct. The data pipeline is complete. What is missing is the product layer — the executive entry point, the story ordering, and the removal of the MT4 cross-contamination. These four changes (P1-A through P1-D) transform a technically correct dashboard into an executive-grade product.
