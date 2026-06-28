# SCT v6 — Section 5: Executive Decision Center
## Complete UI Specification — Developer Handoff

**Layout:** Editorial Tier (Concept 5 — selected)
**Version:** 1.0 · Ready for Implementation

---

## Section Container

| Property | Value |
|---|---|
| Section label | "Executive Decision Center" — 10px, 500, uppercase, ls 0.08em, text-secondary |
| Timestamp | "D{N} of {N} · Live data" — 10px, 400, text-secondary, right-aligned |
| Label row margin-bottom | 12px |
| Zone gap | 8px between Risk / Middle / Footer |
| Background | Transparent — inherits dashboard |
| Section border | None |
| Section padding | 0 horizontal (inherits grid) |

---

## Zone Heights (Desktop 1440px)

| Zone | Height |
|---|---|
| Risk Headline | 140px min-height, auto-grows with content |
| Middle two-column | 200px min-height |
| Impact Footer | 80px min-height, auto-grows on mobile |
| Total target | 420–480px |

---

## Card 1 — 🚨 Risk Headline Zone

### Structure
Full-width zone. No card border. No white card background. Sits directly on section background with left accent bar and subtle status-tinted bg.

### KPI Hierarchy
1. **P1 Hero:** `month_end_proj` % — 48px, 500, tabular-nums, status color
2. **P2 Badge:** Classification — CRITICAL / AT RISK / ON TRACK
3. **P3 Shortfall:** `projected_shortfall` in rupiah — 16px, 500
4. **P4 Context:** "Projected month-end at current pace" — 12px, 400, muted
5. **P5 Driver:** "Primary driver: [NAME] — [X]% of shortfall" — 12px, 400
6. **P6 Multiplier:** "Requires [X]× today's effort" — 10px, 500, in tinted pill
7. **P7 Visual:** Progress bar (4px) with D-tick at timeGone position

### Typography
| Element | Size | Weight | Color |
|---|---|---|---|
| Classification badge | 9px | 700 | Status color (see below) |
| Hero % | 48px | 500 | Status color |
| Shortfall value | 16px | 500 | text-primary |
| Shortfall context | 12px | 400 | text-secondary |
| Primary driver | 12px | 400 | text-secondary (name: text-primary + strong) |
| Multiplier badge | 10px | 500 | Status color, tinted bg |

### Color by Status
| Status | Condition | Hero color | Badge bg | Zone bg tint | Left bar |
|---|---|---|---|---|---|
| CRITICAL | multiplier > 1.50 | #A32D2D | #FCEBEB | rgba(226,75,74,0.08) | #E24B4A |
| AT RISK | 1.20 ≤ mult ≤ 1.50 | #633806 | #FAEEDA | rgba(186,117,23,0.08) | #BA7517 |
| ON TRACK | mult ≤ 1.20 | #27500A | #EAF3DE | rgba(99,153,34,0.08) | #639922 |

Left accent bar: 4px solid, full zone height, border-radius 0 on left. Zone has border-left: 4px solid [status color].

### Progress Bar
- Height: 4px
- Background: var(--color-border-tertiary)
- Fill: matches status color, width = ach% of total
- D-tick: 1px vertical line, 12px tall, color text-secondary, at timeGone% position
- D-tick label above bar: "D{N} · {X}%" — 9px, text-secondary
- End label: "100% target" — 9px, text-secondary, right-aligned

### Spacing
| Gap | Value |
|---|---|
| Zone padding | 16px 18px |
| Badge → hero | 8px |
| Hero row → driver | 6px |
| Driver → multiplier | 4px |
| Multiplier → progress bar | 10px |

### Micro-interactions
| Trigger | Behaviour |
|---|---|
| Load (CRITICAL) | Classification badge pulses once: scale 1→1.05→1, 300ms ease. Never repeats. |
| Hero number | Count-up animation: 0 → final value over 800ms ease-out. Tabular-nums prevents layout shift. |
| Primary driver hover | Underline appears. Cursor pointer. Scrolls to Section 2 (principle breakdown). |
| Progress bar hover | Tooltip: "Current {X}B/wd · Required {Y}B/wd to close in {N} WDs" |
| D-tick hover | Tooltip: "D{N} — {X}% of period elapsed" |

---

## Card 2 — 🎯 Opportunity Card

### Structure
White card background (`var(--color-background-primary)`). Hairline border (0.5px, border-tertiary). border-radius-lg (12px). Left column of middle zone.

### KPI Hierarchy
1. **P1 Hero:** `recovery_value` in rupiah — 34px, 500, text-success
2. **P2 Label:** "recoverable today" — 12px, 400, muted
3. **P3 Outlets:** "{N} inactive outlets · [Territory]" — 12px, 500 (strong on count)
4. **P4 Ticket:** "Avg ticket LM: {X}M / outlet" — 12px, 400, muted label + strong value
5. **P5 CA health:** "{X}% CA active · [Brand]" — 12px, 500, + colored dot
6. **P6 Window:** "Window: {N} WDs remaining" — 12px, 400, muted / amber if ≤2 WDs
7. **P7 Badges:** EXECUTIONAL / PARTIAL / STRUCTURAL + window pill

### Typography
| Element | Size | Weight | Color |
|---|---|---|---|
| Card label | 10px | 500 | text-secondary, uppercase, ls 0.08em |
| Recovery hero | 34px | 500 | #3B6D11 (text-success) |
| "recoverable" sub | 12px | 400 | text-secondary |
| Outlet count | 12px | 700 | text-primary |
| Avg ticket value | 12px | 500 | text-primary |
| CA active % | 12px | 500 | text-primary |
| Window text | 12px | 400 | text-secondary (amber if ≤2 WDs) |
| Badge text | 9px | 700 | Status ramp, uppercase, ls 0.05em |

### CA Active Rate → Color Dot
| Rate | Dot color | Badge label | Badge style |
|---|---|---|---|
| ≥ 90% | #639922 | EXECUTIONAL | Green pill |
| 80–89% | #BA7517 | PARTIAL | Amber pill |
| < 80% | #E24B4A | STRUCTURAL | Red pill |

### Icons (all Tabler Outline)
| Icon | Usage | Size | Color |
|---|---|---|---|
| ti-target | Card label prefix | 14px | text-secondary |
| ti-building-store | Outlet count row | 13px | text-secondary |
| ti-clock | Window row | 13px | text-secondary (amber if ≤2 WDs) |

### Spacing
| Gap | Value |
|---|---|
| Card padding | 16px |
| Card label → hero | 10px |
| Hero → sub label | 2px |
| Sub label → KPI rows | 8px |
| Between KPI rows | 6px |
| KPI rows → badges | 10px |

### Micro-interactions
| Trigger | Behaviour |
|---|---|
| Card hover | Border: border-tertiary → border-secondary. 150ms ease. |
| Recovery value hover | Tooltip: "{N} outlets × {X}M avg ticket = {Y}B. Based on LM actual ticket size." |
| Window badge hover | Tooltip: "Delay 1 day → opportunity shrinks by {X}M as outlets self-activate." |
| Outlet count hover | Tooltip: Territory breakdown by depo. |
| CA dot hover | Tooltip: Explanation of executional vs structural classification. |

---

## Card 3 — ⚡ Action Card

### Structure
**Background: `var(--color-background-secondary)`** — NOT white. This is the critical visual differentiator between analysis (Opportunity = white) and imperative (Action = gray). Never change this.

Hairline border (0.5px, border-tertiary). border-radius-lg (12px). Right column of middle zone.

### KPI Hierarchy
1. **P0 Badges:** Root cause + Confidence — top of card, before label
2. **P1 WHO:** Role → Role — 13px, 500 (the instruction headline)
3. **P2 WHAT:** Outlet count, brand, depo — 12px, 400
4. **P3 Goal today:** "{N} outlets → {X}B today" — 12px, 500, text-success
5. **P4 Goal period:** "All {N} → {X}B by D{N}" — 11px, 400, muted
6. **P5 Deadline:** "Activate before {TIME} · Orders by EOD" — 11px, 500, text-warning
7. **P6 Escalation:** Trigger condition + date — 11px, 400, text-danger

### Typography
| Element | Size | Weight | Color |
|---|---|---|---|
| Card label | 10px | 500 | text-secondary, uppercase, ls 0.08em |
| WHO line | 13px | 500 | text-primary |
| WHAT line | 12px | 400 | text-primary |
| Goal today value | 12px | 500 | #3B6D11 (text-success) |
| Goal period | 11px | 400 | text-secondary |
| Deadline | 11px | 500 | #BA7517 (text-warning) |
| Escalation | 11px | 400 | #A32D2D (text-danger) |
| Badge text | 9px | 700 | Status ramp, uppercase |

### Root Cause Badges
| Root cause | Badge style | Condition |
|---|---|---|
| Inactive CA | Blue pill | CA_LM > 0 AND CA_TM = 0 |
| WS Zero | Amber pill | Act_TM = 0 in WS channel, count > 30% WS |
| Ticket Drop | Orange pill (#712B13 bg #FAECE7) | actPerCA < lmPerCA × 0.90 |
| Pace Deficit | Gray pill | No specific CA issue |

### Confidence Badges
| Confidence | Badge | Condition |
|---|---|---|
| ACT NOW | Green pill | required_multiplier ≤ 1.50 AND CA active ≥ 90% |
| PROCEED | Amber pill | required_multiplier 1.50–2.00 OR CA active 80–90% |
| ESCALATE | Red pill | required_multiplier > 2.00 OR CA active < 80% |

### Icons
| Icon | Usage | Size | Color |
|---|---|---|---|
| ti-bolt | Card label prefix | 14px | #BA7517 (amber — signals urgency) |
| ti-user-circle | WHO line prefix | 14px | text-secondary |
| ti-building-store | WHAT line prefix | 13px | text-secondary |
| ti-arrow-narrow-right | Goal today (→ revenue) | 14px | text-success |
| ti-clock-hour-4 | Deadline prefix | 13px | #BA7517 (always visible) |
| ti-alert-triangle | Escalation prefix | 12px | #A32D2D |

### Spacing
| Gap | Value |
|---|---|
| Card padding | 16px |
| Badges → label | 6px |
| Label → WHO | 8px |
| WHO → WHAT | 6px |
| WHAT → goal | 8px |
| Goal today → goal period | 4px |
| Divider (hairline) margin | 8px top + 8px bottom |
| Goal period → divider | 4px |
| Divider → deadline | 0px (deadline directly below) |
| Deadline → escalation | 5px |

### Micro-interactions
| Trigger | Behaviour |
|---|---|
| Load (CRITICAL) | ti-alert-triangle pulses once: scale 1→1.1→1, 300ms ease. |
| Card hover | Border: border-tertiary → border-secondary. 150ms ease. |
| Deadline hover | Tooltip: "Order cutoff for MTD count. After {TIME}, transaction counts in next period." |
| Escalation hover | Tooltip: "Fires on D{N} if ach < {X}%. NSM submits written brief to Principle {NAME} requesting trade support." |
| WHO role name hover | Underline. Cursor pointer. In v7: navigates to AGM contact. In v6: no navigation. |

---

## Card 4 — 💰 Impact Footer

### Structure
Full-width dark strip. Background: `#2C2C2A` (warm dark neutral, not pure black). border-radius-lg (12px). Not a card — a footer zone.

### Layout
Three-column within footer: [do-nothing % | +delta → | action %]. Supporting line below a hairline divider.

### KPI Hierarchy
1. **LEFT:** `ach_base` % — do-nothing projection, red-tinted
2. **CENTER:** "+{X}B" delta — improvement in rupiah, green-tinted, + arrow →
3. **RIGHT:** `ach_with_action` % — action projection, green-tinted
4. **SUPPORT LINE:** remaining_gap + "unresolved" flag + D_viable date

### Typography (all on dark #2C2C2A bg)
| Element | Size | Weight | Color |
|---|---|---|---|
| Footer label | 9px | 500 | #888780 (gray-400), uppercase, ls 0.08em |
| Do-nothing % | 30px | 500 | #F09595 (red-200) |
| "if no action" caption | 10px | 400 | #888780 |
| Delta "+{X}B" | 14px | 700 | #9FE1CB (teal-200) |
| Arrow → | 18px typographic | — | #5F5E5A (gray-600) |
| Action % | 30px | 500 | #9FE1CB (teal-200) |
| "if executed" caption | 10px | 400 | #888780, right-aligned |
| Unresolved text | 11px | 400 | #F09595 (subtle warning) |
| Support line rest | 11px | 400 | #888780 |
| D-pill text | 9px | 600 | #D3D1C7 (gray-200) |
| D-pill bg | — | — | #444441 (gray-700) |

### Spacing
| Property | Value |
|---|---|
| Zone height | min 80px, auto-grows |
| Padding | 14px 18px |
| Footer label → cols | 10px |
| Column gap | 12px |
| Hairline divider margin | 8px top + 8px bottom |
| Support line margin | 0 |

### Color Rules (dark bg)
| Element | Hex |
|---|---|
| Do-nothing number | #F09595 — visible on dark, not alarming |
| Action number | #9FE1CB — growth accent on dark |
| Delta label | #9FE1CB — same ramp as action |
| Arrow | #5F5E5A — neutral connector |
| Divider | #444441 |
| D-pill bg | #444441 |

### Micro-interactions
| Trigger | Behaviour |
|---|---|
| Do-nothing hover | Tooltip: "At current pace of {X}B/wd for {N} WDs: {totAct} + ({daily} × {hkRem}) = {total}B → {ach}%" |
| Delta "+{X}B" hover | Tooltip: "Delay 1 day → drops to {X-decay}B. Decay: 10%/day as outlets self-activate." |
| Action % hover | Tooltip: "If {N} outlets confirmed at avg {X}M: {totAct} + {recovery} + {pace×hkRem} = {total}B → {ach}%" |
| Unresolved text hover | Tooltip: "Remaining gap requires separate trade programme. Contact Principle {NAME}." |
| D-pill hover | Tooltip: "After D{N}, recovery value drops below 1B. AGM time no longer justified." |
| NO count-up animation | Footer numbers render static. Only Risk hero uses count-up. |

---

## Color System Reference

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| Risk CRITICAL | #A32D2D | #F09595 | Hero number, badge, bar, zone tint |
| Risk AT RISK | #633806 | #FAC775 | Hero number, badge, bar, zone tint |
| Risk ON TRACK | #27500A | #9FE1CB | Hero number, badge, bar, zone tint |
| Opportunity value | #3B6D11 | #9FE1CB | Recovery hero, goal text |
| CA dot green | #639922 | #9FE1CB | ≥90% active rate |
| CA dot amber | #BA7517 | #FAC775 | 80–89% active rate |
| CA dot red | #E24B4A | #F09595 | <80% active rate |
| Deadline | #BA7517 | #FAC775 | Deadline time text |
| Escalation | #A32D2D | #F09595 | Escalation line text |
| Footer bg | #2C2C2A | #2C2C2A | Impact footer (same both modes) |

---

## Icon Usage Rules (Tabler Outline only)

| Icon | Usage | Size |
|---|---|---|
| ti-brain | Section label | 12px |
| ti-target | Opportunity card label | 14px |
| ti-bolt | Action card label (amber) | 14px |
| ti-cash | Impact footer label | 12px |
| ti-alert-triangle | Risk CRITICAL badge + escalation line | 10px / 12px |
| ti-building-store | Outlet count rows | 13px |
| ti-user-circle | WHO line in Action | 14px |
| ti-clock | Window row (Opportunity) | 13px |
| ti-clock-hour-4 | Deadline row (Action) | 13px |
| ti-arrow-narrow-right | Goal line (→ revenue) | 14px |
| ti-trending-up | Multiplier badge (Risk) | 10px |

**Rule:** Every icon carries semantic meaning. No decorative icons permitted.

---

## Responsive Breakpoints

### Desktop ≥ 1200px
- Full layout as specified above
- All micro-interactions active (hover tooltips)
- Risk hero: 48px
- Middle zone: 2 columns, 50/50
- Footer: 3-column horizontal

### Tablet 768–1199px
- Risk hero: 40px
- Risk right content stacks below the hero row
- Middle zone: 2 columns maintained
- Footer: 3-column maintained, height auto

### Mobile < 768px
- Risk hero: 32px
- Middle zone: single column stack (Opportunity → Action)
- Footer: vertical stack — do-nothing / delta / action / support line
- Footer height: ~140px
- Tooltips: long-press 500ms instead of hover

### Non-negotiable rules at all breakpoints
| Rule | Reason |
|---|---|
| Hero number never below 28px | Must be readable across the room |
| Classification badge always visible | Primary status signal |
| WHO line (Action) never truncated | Decision owner must be immediately visible |
| Deadline text always visible | Time-critical — never collapsible |
| Escalation line always visible | Highest-priority content on the card |
| Progress bar always full available width | Proportional reading requires full width |
| Remaining gap line always visible in footer | Prevents over-optimism about partial recovery |

---

## Animation Specification

| Element | Animation | Duration | Easing | Repeat |
|---|---|---|---|---|
| Risk hero number | Count-up 0 → value | 800ms | ease-out | Once on mount |
| CRITICAL badge on load | Pulse scale 1→1.05→1 | 300ms | ease-in-out | Once on mount |
| Escalation icon (CRITICAL) | Pulse scale 1→1.1→1 | 300ms | ease-in-out | Once on mount |
| Card hover border | Color transition | 150ms | ease | On hover |
| All other elements | None | — | — | — |

**No looping animations. No marquees. No spinners (except dashboard-level loading state).**

---

*Document version: 1.0 | Implementation-ready | Matches business logic spec: Section5_ExecutiveDecisionCenter_Spec.md*
