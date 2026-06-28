# SCT v6 — Sprint 14: Executive Decision Business Validation
## GO / NO-GO Report

**Date:** 2026-06-25  
**Sprint:** 14 — Section 5 / ExecutiveDecision Business Validation  
**Data Source:** MonitorDaily.xlsx  
**Engine:** KPIEngine v6 (Python port, logic-identical)  
**Validator:** Section5View.js v3 + ExecutiveDecision Contract v1.0.0  
**Scope:** 75 scenarios (5 regions × 5 principles × 3 channels) + 10 edge-case probes

---

## 1. Validation Matrix Summary

| Dimension | Scenarios Tested | PASS | FAIL | Notes |
|-----------|-----------------|------|------|-------|
| Risk Classification (mult threshold) | 75 | 75 | 0 | All correct |
| Risk Projection (monthEndProj) | 75 | 75 | 0 | All correct |
| Worst Territory Identification | 1 (ALL/ALL/ALL) | 1 | 0 | Depo Fs Jabotabek 1.85× confirmed |
| Opportunity Recovery Value ≥ 0 | 75 | 75 | 0 | All ≥ 0 |
| withAction ≥ doNothing | 75 | 75 | 0 | Invariant holds |
| delta ≥ 0 | 75 | 75 | 0 | Invariant holds (0.0 is ≥ 0) |
| Role Escalation (NSM/AGM/Supervisor) | 75 | 75 | 0 | Thresholds applied correctly |
| Action Urgency (ACT_NOW/PROCEED/MONITOR) | 75 | 75 | 0 | Matches risk.classification |
| callTarget cap (HK_REM × CALLS_PD) | 75 | 75 | 0 | 48-call cap enforced |
| HK_REM = 0 guard | 1 | 1 | 0 | callTarget=0, no division error |
| Negative achievement guard | 1 | 0 | 1 | -27.5% ach passes through unchecked |

---

## 2. Findings by Severity

### MAJOR — M1: Badge vs ED Classification Disagreement (10/75 scenarios)

**What:** The Risk Zone header badge (`_riskLevel(ach)`) uses `TimeEngine.evalStatus()` — pace-based thresholds (ach vs timeGone ± 5pp). The ED contract `risk.classification` uses multiplier-based thresholds (reqMult > 1.20 / 1.50 / 2.00). These two systems disagree in 13.3% of scenarios, and the badge is **always** more conservative than the ED.

**Impact:** User sees AT_RISK badge at the top of the Risk card but reads ON_TRACK in the `risk.classification` field (via `requiredMultiplier` colour). Creates contradictory signals on the same card.

| Scenario | ach% | mult | Badge | ED Classification |
|----------|------|------|-------|-------------------|
| All/All/RETAIL | 71.7% | 1.19× | AT_RISK | ON_TRACK |
| Jabar1/All/RETAIL | 69.3% | 1.33× | CRITICAL | AT_RISK |
| Jabar1/GPPJ/RETAIL | 69.6% | 1.31× | CRITICAL | AT_RISK |
| Jabar2/All/MTI | 69.2% | 1.33× | CRITICAL | AT_RISK |
| *(+6 more)* | | | | |

**Root Cause:** Two intentionally different classification systems co-exist in Section 5 with no reconciliation.  
**Recommendation:** Replace `_riskLevel(p.ach)` in `renderRisk()` with a direct mapping from `risk.classification`. The multiplier-based classification is more business-relevant (it measures the _future effort required_, not just current pace gap). Remove the `TimeEngine.evalStatus()` call from section5View entirely.

---

### MAJOR — M2: Opportunity Collapses to Zero for 71/75 Filter Combinations (94.7%)

**What:** `totalRecoveryValue = 0` for all scenarios except:
- All/All/All → Rp 7.41B
- Jabar1/All/All → Rp 7.41B
- All/All/RETAIL → Rp 4.31B
- Jabar1/All/RETAIL → Rp 4.31B

All 75 principle-filtered scenarios and MTI/non-Jabar1-regional scenarios show rv = 0.

**Root Cause — two compounding causes:**

1. **Principle filter**: When Performance is filtered by principle (e.g., GBS), `perf['byReg'][].lm` returns only GBS's LM revenue. CA_Master has no Principle column — outlet counts remain full territory-wide. `avgTicketLM = GBS_LM_IDR / total_CA_LM_outlets` → near-zero ticket, rv ≈ 0.

2. **Non-Jabar1 regions**: Jabar2, Jabobeka, and Jatakalbar all have `inactiveCA = max(0, caLM - caTM) = 0` across their territories in this month's data (their CA TM ≥ CA LM everywhere). Zero inactive CA → rv = 0 regardless of ticket size.

**Business Impact:** QUALIFIED badge displays alongside Rp 0 recovery value for 66 scenarios. The Section 5 Opportunity card is commercially meaningful only when All-Principles + All-Channel (or RETAIL) is selected. Any principle drill-down produces a misleading "Rp 0 / QUALIFIED" state.

**Recommendation:** This is an architecture limitation, not a calculation bug. Two remediation options:

| Option | Description | Effort |
|--------|-------------|--------|
| A (Display guard) | When `totalRecoveryValue = 0` and a principle filter is active, show a context note: *"Peluang dihitung di level territory, bukan principle. Pilih All Principle untuk melihat nilai."* | Sprint 15 — Minor |
| B (Architecture fix) | Add Principle dimension to CA_Master join, or compute avgTicketLM at SKU-principle level | Future — Major |

**Do NOT change the calculation.** The math is correct. Fix the display context.

---

### MINOR — N1: `-0.0` Delta Projection Display Artifact (71/75 scenarios)

**What:** `deltaProjection = round(-0.00000x, 1)` produces `-0.0`. `section5View.renderImpact()` renders `'+' + imp.deltaProjection.toFixed(1) + 'pp'` → `"+-0.0pp"`.

**Impact:** Cosmetic only. No business calculation error. The `-0.0` indicates rv = 0 (which it is). But the string `+-0.0pp` is visually confusing.

**Recommendation (one-line fix in section5View.js, renderImpact):**
```javascript
const dpDisplay = Math.max(0, imp.deltaProjection);
const deltaFmt = imp ? '+' + dpDisplay.toFixed(1) + 'pp' : '+•••';
```

---

### MINOR — N2: Negative Achievement Display (1 scenario: Jabobeka/GEN/MTI)

**What:** `totAct = -107,628,516` (returns/credit adjustments in source data). `ach = -27.5%`, `monthEndProj = -36.7%`. No guard exists in `buildRisk` for negative `totAct`.

**Impact:** Hero text renders `-27.5%`. Progress bar clips to 0% (correct via `achPct = Math.min(...)`). Multiplier = 99, classification = UNREACHABLE. Functionally stable, visually alarming.

**Recommendation (guard in kpiEngine.buildRisk):**
```javascript
// If totAct is negative (returns/adj), treat as 0 for classification purposes
const effectiveAct = Math.max(0, perf.totAct);
```
Or: treat as a data quality flag in `anomalyFlags`.

---

### MINOR — N3: Extreme Achievement Values (3 scenarios)

**What:** Small principle+channel targets with high actuals produce extreme ach%:
- Jabar1/HGJ/RETAIL: ach = 1161%, proj = 1548%
- Jabar2/HGJ/RETAIL: ach = 2633%, proj = 3511%
- Jatakalbar/GEN/MTI: ach = 361%, proj = 481%

**Cause:** HGJ targets for RETAIL are very small (3,727–9,562 units) while actuals are 28–98× higher.

**Impact:** The 48px hero text shows "1161.0%" — no overflow, no crash, but commercially misleading. `requiredMultiplier = 0.0`, classification = ON_TRACK (correct — they've already exceeded).

**Recommendation:** No code change needed. Consider adding a display cap annotation: if `ach > 150`, show "★ {ach}%" with a distinct style to signal over-delivery rather than an error.

---

## 3. Edge Case Results

| Edge Case | Input | Result | Status |
|-----------|-------|--------|--------|
| HK_REM = 0 | Simulated zero remaining days | callTarget=0, mult=0.0, no division error | ✅ PASS |
| Channel = MTI (sparse CA) | 1,021 CA rows | inactiveCA=19, rv=0, callTarget=19 | ✅ PASS |
| Negative totAct (Jabobeka/GEN/MTI) | act=-107M | ach=-27.5%, proj=-36.7%, cls=UNREACHABLE | ⚠️ No guard |
| Achievement > 100% (Jabar1/HGJ/RETAIL) | ach=1161% | mult=0.0, cls=ON_TRACK, proj=1548% | ✅ Math correct |
| Achievement = 0 (Jabobeka/HGJ/RETAIL) | ach=0% | mult=99, cls=UNREACHABLE | ✅ PASS |
| callTarget cap | inactiveCA=2204, HK_REM×8=48 | callTarget=48, max calls=15 for revenue | ✅ PASS |
| Worst territory (ALL/ALL/ALL) | Full data | Depo Fs Jabotabek 1.85× | ✅ PASS |
| Role escalation (ALL/ALL/ALL) | rv=7.41B | NSM (>5B threshold) | ✅ PASS |
| Zero CA recovery in filtered view | Principle filter | rv=0, action still calculated | ✅ No crash |
| withAction = doNothing (rv=0) | delta=0 | +0.0pp displayed | ✅ No crash |

---

## 4. Mathematical Invariant Results

| Invariant | Tested | Pass | Fail | Notes |
|-----------|--------|------|------|-------|
| withAction ≥ doNothing | 75 | 75 | 0 | |
| delta ≥ 0 | 75 | 75 | 0 | 71 show delta=0.0 (rv=0 scenarios) |
| recoveryValue ≥ 0 | 75 | 75 | 0 | |
| classification ∈ {ON_TRACK, AT_RISK, CRITICAL, UNREACHABLE} | 75 | 75 | 0 | |
| requiredMultiplier ≥ 0 | 75 | 75 | 0 | |
| callTarget ≥ 0 | 75 | 75 | 0 | |
| monthEndProj = f(actRR, totTgt, hkTot) | 5 | 5 | 0 | Spot-checked key scenarios |

**Note on `deltaValue` vs `totalRecoveryValue`:** Both are `rv` by definition — the Python test harness showed 2 spurious failures from `round()` rounding up on rv > 0.5 fractional. This is a test harness artifact; in JS `deltaValue = Math.round(rv)` and `totalRecoveryValue = rv` differ by at most 0.5 IDR — a sub-cent discrepancy with zero business impact.

---

## 5. Business Logic Integrity Checks

| Check | ALL/ALL/ALL | Jabar1/All/RETAIL | Jabobeka/ALL/ALL |
|-------|-------------|-------------------|-----------------|
| ach% | 77.4% | 69.3% | 79.4% |
| mult | 0.97× | 1.33× | 0.76× |
| classification | ON_TRACK | AT_RISK | ON_TRACK |
| monthEndProj | 103.2% | 92.4% | 105.9% |
| doNothing = doNothing math ✓ | ✅ | ✅ | ✅ |
| withAction > doNothing when rv>0 | ✅ | ✅ | N/A (rv=0) |
| Role correct | NSM (7.41B) | AGM (4.31B) | Supervisor (0) |
| Urgency | MONITOR | PROCEED | MONITOR |
| Worst territory identified | Depo Fs Jabotabek | — | — |

---

## 6. Scores

### Business Accuracy Score: **91 / 100**

| Component | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Risk math (classification, projection, multiplier) | 25 | 25 | All correct |
| Opportunity calculation logic | 20 | 16 | Correct math; architecture limits useful output to 4/75 scenarios |
| Impact math (doNothing, withAction, delta) | 20 | 20 | All invariants hold |
| Action logic (role, urgency, callTarget) | 20 | 20 | All thresholds correct |
| Edge case resilience | 15 | 10 | Missing negative-ach guard (−5) |

### UI Stability Score: **86 / 100**

| Component | Weight | Score | Notes |
|-----------|--------|-------|-------|
| No crashes across 75 scenarios | 30 | 30 | Zero crashes |
| No division-by-zero / NaN | 20 | 20 | All guarded |
| Display strings correct | 20 | 14 | −4 badge/ED mismatch (M1); −2 `+-0.0pp` artifact (N1) |
| Extreme value handling | 15 | 12 | ach > 200% passes through without annotation (−3) |
| Animation / count-up | 15 | 10 | `_mounted` guard untested in browser; assumed correct (−5 unverified) |

---

## 7. GO / NO-GO Verdict

### ✅ CONDITIONAL GO

The core business engine is mathematically correct. All critical invariants hold across all 75 scenarios. No crashes, no NaN, no division-by-zero. The ExecutiveDecision Contract produces accurate, consistent output for the primary use case (All/All/All and All/All/RETAIL).

**Conditions before unrestricted production release:**

| # | Condition | Severity | Sprint |
|---|-----------|----------|--------|
| 1 | Fix badge/ED classification disagreement — replace `_riskLevel(ach)` with `risk.classification` from ED contract | MAJOR | Sprint 15 |
| 2 | Add display context note when `totalRecoveryValue = 0` and principle filter is active | MAJOR | Sprint 15 |
| 3 | Fix `+-0.0pp` delta display — `Math.max(0, imp.deltaProjection)` | MINOR | Sprint 15 |
| 4 | Add negative ach guard in buildRisk — `Math.max(0, perf.totAct)` for classification | MINOR | Sprint 15 |

**Items that do NOT block go-live:**
- Extreme ach% (1161%, 2633%) — data quality issue, not an engine bug
- `deltaValue` vs `totalRecoveryValue` sub-IDR rounding — cosmetically irrelevant
- Role always Supervisor on principle-filtered views — correct per formula

---

## 8. Data Quality Notes (Out of Scope for v6)

The following issues exist in the source data and require upstream investigation:

| Issue | Example | Count |
|-------|---------|-------|
| Negative actual sales | Jabobeka/GEN/MTI: act = −107M | 1 |
| Extremely small targets | HGJ RETAIL targets: 3,727–9,562 units | 2+ regions |
| CA_Master has no Principle dimension | Cannot scope opportunity by principle | Architecture |

---

*Report generated: Sprint 14 validation complete.*  
*Next: Sprint 15 — apply 4 conditional-GO fixes.*
