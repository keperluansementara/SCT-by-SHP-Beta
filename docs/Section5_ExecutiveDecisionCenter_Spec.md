# SCT v6 — Section 5: Executive Decision Center
## Business Logic Design Specification

**Version:** 1.0  
**Status:** Final — Ready for Implementation  
**Data constraint:** MonitorDaily.xlsx only. No external data. No competitor data. No sell-out data.  
**Reading time target:** < 15 seconds per card

---

## Design Principle

Section 5 answers only four executive questions:

1. What is the biggest business risk today?
2. What is the biggest business opportunity today?
3. What action should be executed today?
4. What business impact can be expected?

The computation behind each answer can be arbitrarily complex. The display layer shows only the answer.

---

## Card 1 — 🚨 Biggest Risk Today

### A. Objective

Tell the NSM, in one number, whether the month is on track to be won or lost — and by how much. Not current achievement. Not last month comparison. The forward projection. The NSM's first question every morning is not "where are we?" It is "where do we end up if today looks like yesterday?" That is the risk.

### B. KPI Logic

The primary risk signal is the gap between the month-end projection at current daily pace and the 100% target. Three inputs from State.kpi: actual MTD sales, working days elapsed, total working days in month.

The secondary signal is reachability — whether the remaining gap is physically closable in remaining working days. Quantified as a multiplier: how much harder the team must work from today versus demonstrated current pace. A multiplier above 1.5× means the gap is not organically closable. Above 2.0× means extraordinary intervention is required.

The tertiary signal is the primary driver: which single dimension (principle or region) accounts for the largest share of the shortfall.

### C. Calculation Formula

```
implied_daily_avg   = totAct / hkPass
month_end_proj      = (implied_daily_avg × hkTot) / totTgt × 100
projected_shortfall = totTgt − (implied_daily_avg × hkTot)

required_daily      = (totTgt − totAct) / hkRem
required_multiplier = required_daily / implied_daily_avg

pace_gap            = ach% − timeGone%

For each principle P and region R:
  driver_share_P = (totTgt_P − totAct_P) / (totTgt − totAct) × 100
Primary driver = dimension with highest driver_share
```

### D. Decision Rules

| Required Multiplier | Classification | Management Signal |
|---|---|---|
| ≤ 1.20 | On Track | Standard morning push. No escalation. |
| 1.21 – 1.50 | At Risk | Focused intervention. AGM-level push today. |
| 1.51 – 2.00 | Critical | NSM activates all territories. Track daily. |
| > 2.00 | Unreachable | Gap cannot close organically. Escalate immediately. |

Additional rule: if `hkRem ≤ 3` AND `required_multiplier > 1.30`, auto-escalate to Critical regardless of range. Time collapses the window faster than effort can recover it.

### E. Escalation Rules

**required_multiplier > 2.0:** NSM calls Managing Director before 9am. Begin extraordinary trade programme discussion with Principle.

**required_multiplier 1.5 – 2.0:** NSM calls all AGMs in morning meeting. Each AGM receives a territory-specific required multiplier.

**required_multiplier 1.2 – 1.5 AND primary driver > 40% of shortfall:** NSM calls the AGM of primary driver territory only. Targeted intervention, not blanket push.

**hkRem ≤ 3 AND projection < 90%:** NSM sends written brief to Principle for trade support today. Three working days is the minimum lead time for any meaningful trade response.

### F. Business Narrative

*"National is tracking to close at [month_end_proj]%. At current pace of [implied_daily_avg]/wd, the month delivers [implied_daily_avg × hkTot] against a [totTgt] target — a shortfall of [projected_shortfall]. Closing the gap requires [required_multiplier]× today's run rate. [PRIMARY DRIVER] accounts for [driver_share]% of the shortfall."*

### G. Example Output

```
Month-end projection:    88.8%
Projected shortfall:     80.8B
Required multiplier:     1.50× (needs 50% more effort from current pace)
Classification:          CRITICAL
Primary driver:          GPPJ Principle — 34% of shortfall (8.2B gap)
Time remaining:          5 working days
```

### H. Management Interpretation

An NSM reads Card 1 and answers one question: "Do I need to make calls before the morning meeting, or during it?" A projection above 97% means a progress check meeting. Below 95%, an intervention meeting. Below 90%, a crisis meeting. The required multiplier tells him which meeting he is walking into.

---

## Card 2 — 🎯 Biggest Opportunity Today

### A. Objective

Identify the single highest-value revenue action executable today using existing relationships, without new trade spend, without new outlets, and without extraordinary effort. In FMCG execution, "opportunity" means one specific thing: an outlet that has already proven it buys your product, has not bought yet this month, and can still be converted before month-end.

### B. KPI Logic

The critical distinction: **lost outlet** vs **inactive outlet**.

- **Lost outlet:** `CA_TM = 0` because it stopped buying permanently. Recovery this month is impossible.
- **Inactive outlet:** `CA_LM > 0` and `CA_TM = 0` this month. Bought last month, exists, has the relationship, simply has not placed an order yet. One call converts it.

CA active rate (`CA_TM / CA_LM`) determines whether a territory's problem is structural (< 80%) or executional (≥ 80%). Only executional problems are addressable today.

Average ticket per outlet: `totLM / CA_LM` — based on actual observed spending behavior, not projection.

### C. Calculation Formula

```
For each territory T (region or depo level):

  CA_active_rate_T  = CA_TM_T / max(1, CA_LM_T)
  inactive_CA_T     = max(0, CA_LM_T − CA_TM_T)
  avg_ticket_LM_T   = totLM_T / max(1, CA_LM_T)
  recovery_value_T  = inactive_CA_T × avg_ticket_LM_T

  qualify_T = CA_active_rate_T ≥ 0.80
  opportunity_T = qualify_T ? recovery_value_T : 0

Top opportunity = territory with highest opportunity_T

Recovery feasibility ratio:
  feasibility = top_opportunity_T / (totTgt − totAct)
  If feasibility < 0.15 → flag secondary opportunity also
```

### D. Decision Rules

| CA Active Rate | Action |
|---|---|
| ≥ 90% | High confidence. Full recovery value applies. Execute immediately. |
| 80 – 90% | Medium confidence. Apply 0.85 discount to recovery value in narrative. |
| 70 – 80% | Primarily structural. Select a different territory with higher active rate. |
| < 70% | Do not present as opportunity. Flag as distribution problem — escalate to Channel Manager. |

**No territory qualifies (all < 80%):** Fallback — identify channel with largest pace gap and sufficient WDs to recover through volume push.

### E. Escalation Rules

**CA active rate trending down across periods:** Escalate to Commercial Excellence for outlet health audit.

**Recovery value < 0.5B AND required_multiplier > 1.5:** Single action insufficient. NSM simultaneously executes reactivation AND initiates trade support request.

**Inactive CA count > 50 in single depo:** Escalate to Depo Manager level. Volume at this scale signals systemic issue, not calling gap.

### F. Business Narrative

*"[inactive_CA_count] outlets in [TERRITORY] bought [PRINCIPLE/BRAND] last month and have not ordered this month. At an average ticket of [avg_ticket_LM], recovering these outlets is worth [recovery_value]. The CA base is intact — active rate [CA_active_rate]% — which means these outlets exist, the relationship exists, and the only missing action is the call. Recovery window: [hkRem] working days."*

*"[Alternative territory] has a [X]B gap but only [Y]% CA active rate — the outlets are not reachable this month. [Selected territory] was chosen because its active rate of [Z]% makes recovery executable today."*

### G. Example Output

```
Top opportunity territory:  Jabar2 + Depo Bandung
Inactive CA count:          47 outlets
Average ticket (LM):        77M per outlet
Recovery value:             3.6B
CA active rate:             95% — EXECUTIONAL, not structural
Confidence adjustment:      None — full recovery value applies
Window:                     4 working days before inactivity becomes churn
Feasibility ratio:          4.5% of total gap — material, not sufficient alone
```

### H. Management Interpretation

An NSM reads Card 2 and asks: "Can I pick up 3.6 billion with a phone call?" The CA active rate of 95% is the key credential — the outlets are still there, the product still fits, nobody has called them yet this month. That is an execution gap, not a market gap. NSMs fix execution gaps before breakfast.

---

## Card 3 — ⚡ What To Do Today

### A. Objective

Convert the risk (Card 1) and the opportunity (Card 2) into a single specific instruction with a named role, a named target, a quantified goal, and a hard deadline. A recommendation without an owner is advice. An action without a deadline is aspiration. Card 3 produces neither.

### B. KPI Logic

Action is derived mechanically from Cards 1 and 2:

1. **Target territory** → from Card 2 (highest-opportunity qualified territory)
2. **Principle or brand** → from Card 1 (primary driver of national shortfall)
3. **Outlet type** → intersection: inactive CA in target territory for primary driver principle
4. **Role assignment** → fixed hierarchy based on gap magnitude
5. **Deadline** → fixed 10:00 for call activation; orders must clear EOD to count in MTD

Root cause determines action type:

| Root Cause | Action Type |
|---|---|
| Inactive CA (CA_LM > 0, CA_TM = 0) | Call plan — reactivate specific outlets |
| WS zero transaction (Act_TM = 0 in WS channel) | Wholesaler activation push — order confirmation |
| Ticket compression (actPerCA < lmPerCA × 0.90) | SKU depth push — increase order size per active outlet |
| Pure pace deficit (no specific CA issue) | Territory target reallocation — daily run rate assignment per AGM |

### C. Calculation Formula

```
Role assignment:
  recovery_value > 5B  → NSM directly activates AGM
  recovery_value 2–5B  → AGM activates Supervisor
  recovery_value < 2B  → Supervisor activates field team

Realistic call target (not total inactive):
  call_target     = min(inactive_CA_count, floor(hkRem × 8))
  [8 = reasonable calls per supervisor per day]

  expected_today  = min(call_target, 15) × avg_ticket_LM
  expected_full   = call_target × avg_ticket_LM

Escalation trigger date:
  D_escalate      = hkPass + 2
  ach_threshold   = timeGone × totTgt × 0.95
```

### D. Decision Rules

**Inactive CA, active rate ≥ 90%:** Call plan. Outlets sorted by historical ticket size descending — highest-ticket first. Every confirmed order today is guaranteed MTD revenue.

**WS zero, WS_zero_count > 30% of WS outlets:** Send AGM with Principle AM together. Wholesaler inactivity at this scale is a relationship or pricing signal, not a calling gap.

**Ticket compression, actPerCA < lmPerCA × 0.90:** Visit top 10 active outlets by volume. Propose incremental order of the underperforming SKU. Do not dilute across many outlets.

**Pure pace deficit:** NSM assigns daily run-rate sub-targets to each AGM: `required_daily_T = (totTgt_T − totAct_T) / hkRem`. Each AGM receives a number. NSM tracks daily.

**Two root causes coexist:** Address only the one with higher recovery value. Do not split field effort across two action types in a 5-day window.

### E. Escalation Rules

**No improvement after D+2:** NSM submits written brief to Principle requesting trade support. Must include: current projection, gap amount, specific territory, recovery value available if supported.

**CA active rate drops below 80% during month:** Current action plan invalidated. Stop call push. Escalate to Channel Manager for outlet health diagnosis.

**required_multiplier > 2.0:** Card 3 action is insufficient alone. Explicitly flag: "This action recovers [X]B. The remaining [Y]B gap requires trade programme activation."

### F. Business Narrative

*"[ROLE] at [TERRITORY LEVEL] activates a call plan for [OUTLET_COUNT] inactive [PRINCIPLE] outlets via [DEPO NAME]. These outlets have a proven average ticket of [avg_ticket_LM] — the relationship exists and the product has been accepted. Call target: [call_target] outlets confirmed by [DEADLINE]. Expected revenue today: [expected_today]. If executed across all [hkRem] remaining working days: [expected_full] total recovery."*

*"If achievement does not reach [ach_threshold] by [D_escalate], NSM initiates trade support request to Principle [PRINCIPLE NAME]."*

### G. Example Output

```
Root cause:       Inactive CA — executional gap
Who:              AGM Jabar → Supervisor Bandung
What:             Call plan, 23 GPPJ Biscuit outlets (Arjuna class, Depo Bandung)
Priority order:   Highest historical ticket first
Goal today:       15 outlets confirmed → 1.2B
Goal full period: 23 outlets → 1.8B by D17
Deadline:         Activate before 10:00. Orders confirmed by EOD.
Escalation:       If D17 achievement < 70%, NSM briefs GPPJ Principle for trade support
Escalation date:  D17 (2 working days from today)
```

### H. Management Interpretation

An NSM reads Card 3 and has one question answered before the morning meeting: who is he calling, what is he telling them to do, and what does he expect by EOD. The test of Card 3: does the NSM's 8:30am call to AGM Jabar take less than 3 minutes because everything is already specified? If yes, the card has succeeded.

---

## Card 4 — 💰 Expected Impact

### A. Objective

Tell the NSM what the month looks like in rupiah — in two scenarios only: if no action is taken, and if Card 3's action is executed. Not three scenarios. Not a confidence range. Two numbers, two futures, one decision. The card also tells him what the action does NOT solve — the remaining gap — so he is not over-confident about a partial recovery.

### B. KPI Logic

Three required outputs:

1. **Do-nothing projection** — where the month ends if today's pace continues. The most important number on the card. It creates urgency. NSMs are motivated by what they will lose, not what they can gain.

2. **Action projection** — where the month ends if Card 3 is fully executed. Expressed in rupiah AND new achievement percentage. Achievement percentage is only meaningful relative to a management threshold (90%, 95%, 100%).

3. **Time decay signal** — how much the recovery value shrinks each day of inactivity. This is the urgency quantifier. Each day without the call, some inactive outlets self-activate through their own ordering cycles — the opportunity shrinks by itself.

### C. Calculation Formula

```
Do-nothing projection:
  projected_base_total  = totAct + (implied_daily_avg × hkRem)
  ach_base              = projected_base_total / totTgt × 100
  shortfall_base        = totTgt − projected_base_total

Action projection:
  projected_with_action = totAct + recovery_value + (implied_daily_avg × hkRem)
  ach_with_action       = projected_with_action / totTgt × 100
  improvement_rupiah    = recovery_value
  gap_closure_pct       = recovery_value / (totTgt − totAct) × 100

Remaining gap after action:
  remaining_gap         = totTgt − projected_with_action

Time decay (conservative: 10% of inactive outlets self-activate per day):
  value_today    = inactive_CA × avg_ticket_LM
  value_D_plus1  = (inactive_CA × 0.90) × avg_ticket_LM
  value_D_plus2  = (inactive_CA × 0.81) × avg_ticket_LM
  value_D_plus3  = (inactive_CA × 0.73) × avg_ticket_LM

  daily_decay    = value_today − value_D_plus1

Latest viable date:
  D_viable = today + floor(log(1.0B / value_today) / log(0.90))
  [Last day before recovery value drops below 1B — minimum threshold for AGM time]
```

### D. Decision Rules

| Ach with action | Management Signal |
|---|---|
| ≥ 100% | Target achievable — execute and maintain. |
| 95 – 99% | Strong close — focused execution sufficient. |
| 90 – 95% | Good close — report to MD as expected outcome. |
| 85 – 90% | Acceptable close — brief MD with explanation of recovery executed. |
| < 85% | Below floor — action insufficient. Activate extraordinary measures simultaneously. |

**If remaining_gap > recovery_value × 3:** Card must explicitly state the action is a partial recovery. Do not allow the card to imply the action solves the month.

**If ach_with_action − ach_base < 1pp:** Flag explicitly: "This action is necessary but insufficient. NSM must activate additional recovery levers simultaneously."

### E. Escalation Rules

**ach_with_action < 85%:** NSM briefs Managing Director today that the month will not close above 85% under any executable scenario. Presenting a miss at month-end without advance warning is a management failure.

**daily_decay > 200M:** Flag: "Every day of delay costs [daily_decay]. Execute today or tomorrow at the latest."

**remaining_gap > 50B after action:** NSM submits trade support request to Principle today, parallel to Card 3 execution.

### F. Business Narrative

*"If no action is taken today: the month closes at [ach_base]%, a [shortfall_base] shortfall."*

*"If [Card 3 action] is executed before [DEADLINE]: the month closes at [ach_with_action]%, recovering [improvement_rupiah]. A [gap_closure_pct]% reduction in the remaining gap. [remaining_gap] still requires a separate plan."*

*"Every day this action is delayed, the opportunity shrinks by [daily_decay] as inactive outlets begin self-activating. The latest viable date to execute is [D_viable]."*

The remaining gap must never be omitted. An NSM who reads only the improvement figure will over-celebrate a partial recovery.

### G. Example Output

```
Do nothing:           88.8% → 642.6B (shortfall: 80.9B)
Execute action:       89.3% → 646.2B (+3.6B)
Achievement delta:    +0.5pp
Gap closure:          4.5% of remaining shortfall addressed
Remaining gap:        77.3B (requires trade programme — separate track)
Daily decay:          360M per day of inactivity
Latest viable date:   D18 (after D18, value drops below 1B)
Management flag:      Action is necessary but insufficient — parallel track required
```

### H. Management Interpretation

An NSM reads Card 4 and answers: "Does executing this action change my conversation with the MD?" If the action moves projection from 88.8% to 89.3%, the answer is no — the story is still a miss. But the card also gives him his narrative: "We recovered 3.6B through CA reactivation. The remaining 77B requires a trade programme we have already requested." That is a different conversation than walking in at month-end with no explanation. Card 4 gives the NSM his narrative for upward communication, not just his task for downward execution.

---

## Data Source Reference

All computations use only data available in MonitorDaily.xlsx via State.kpi and State.filtered.

| Card | Key Fields | Sheet |
|---|---|---|
| Card 1 | totAct, totTgt, hkPass, hkTot, hkRem, totAct_by_principle | Performance + DimDate |
| Card 2 | CA_TM, CA_LM, totLM, by territory | Performance |
| Card 3 | inactive_CA by depo, avg_ticket_LM by depo, root cause inputs | Performance + CA_Master |
| Card 4 | All Card 1 + Card 2 fields, recovery_value from Card 2 | Performance + DimDate |

No sell-out data. No competitor data. No external API. No new data sources required.

---

## Cross-Card Dependencies

```
Card 1 (Risk)
  → feeds primary driver to Card 3 (which principle/brand to target)
  → feeds projected_shortfall to Card 4 (do-nothing scenario)

Card 2 (Opportunity)
  → feeds top territory and recovery_value to Card 3 (where to act)
  → feeds recovery_value to Card 4 (action scenario)

Card 3 (Action)
  → derived from Cards 1 + 2
  → feeds action_description to Card 4 (what "execute action" means)

Card 4 (Impact)
  → consumes outputs from all three cards
  → produces the consequence frame for NSM upward communication
```

Cards must be computed in sequence: Card 1 → Card 2 → Card 3 → Card 4.

---

*Document version: 1.0 | Ready for development*
