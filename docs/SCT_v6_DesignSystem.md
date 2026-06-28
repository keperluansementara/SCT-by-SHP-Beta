# SCT v6 Executive Design System

**Version:** 6.0  
**Status:** Official Reference — Do Not Modify Without Design Lead Approval  
**Scope:** All screens under the SCT v6 Executive Decision Center (Section 5) and any future SCT section  
**Date:** 2026-06-25  
**Companion documents:**
- `Section5_ExecutiveDecisionCenter_Spec.md` — KPI logic and business rules
- `Section5_UISpecification.md` — Full developer handoff for the Editorial Tier layout

---

## 1. Executive Design Philosophy

These seven principles explain the *why* behind every structural decision in Section 5. They govern all future SCT screens. When a new design decision is debated, it must be resolvable by reference to one of these principles.

---

### P1 — Why Risk is a headline instead of a card

A card border says *"this is one of several."* A headline says *"this is the situation."*

When information must be absorbed before anything else is processed, it cannot live inside a card — a card implies equality with its neighbours. The Risk zone uses a left accent bar (4px, status color) and a status-tinted background (8% opacity) as spatial delimiters. These do not create equality. They create the frame within which all cards are pictures.

In journalism, the headline has no border. The articles do.

**Rule derived:** Full-width zones with left accent bars = situational frames. Cards with borders = comparable items. Never reverse this mapping.

---

### P2 — Why Opportunity uses a white background

White in information design means *neutral ground before a decision* — a whiteboard, a printed report, a blank page.

The Opportunity card presents analysis: here is what the data shows, here is where money can be found. Analysis requires neutrality. A colored background implies the system has already judged the analysis. White withholds that judgment. The executive reads Opportunity data and forms his own conclusion — which the Action card then confirms or challenges.

**Rule derived:** `background: white` = analysis register. The executive decides. The system observes.

---

### P3 — Why Action uses a secondary background

In every professional context, instructions are formatted differently from descriptions. Legal operative clauses are indented. Military orders use a distinct format. Warning labels use a colored background.

The secondary background on the Action card is that register change. It is gray not for aesthetic reasons — it is gray because the eye must know, before reading a single word, that this card is different in kind from the card beside it.

Analysis sits on white. Instruction sits on gray.

**Rule derived:** Background color is identity, not decoration. Two cards with the same background have the same register. If they don't have the same register, they must not have the same background.

---

### P4 — Why Impact is always placed at the bottom

Causality flows downward in executive communication.

- Risk generates the Opportunity.
- Opportunity generates the Action.
- Action generates the Impact.

Placing Impact at the top would be a *claim without evidence* — "the month closes at 89.3%" means nothing until the executive understands the situation (88.8% tracking), the opportunity (3.6B recoverable), and the action (47 outlet calls). The footer placement forces the business case to be built mentally before the conclusion is delivered. This makes the conclusion stick.

**Rule derived:** Consequence is always the last thing read. The dark footer background enforces this — the eye stops at the bottom on dark.

---

### P5 — Why every card has exactly one Hero KPI

Two numbers of equal visual weight produce *competition*. The executive's brain must determine which to process first — defaulting to comparison mode, which requires calculation. Calculation takes time. A morning brief that must be consumed in 15 seconds cannot afford calculation mode.

One Hero KPI eliminates the competition before it starts. Supporting rows below the hero exist to explain it, qualify it, or contextualize it — but they never challenge its dominance.

**Rule derived:** One Hero KPI per card. Absolute constraint. No exceptions regardless of business pressure to add a second.

---

### P6 — Why animations are minimal

In Bloomberg Terminal, a blinking number means the price changed — the motion IS the information. In SCT, the data is static at the moment of reading.

Motion applied to static data is *false information* — it implies urgency or change that does not exist. The count-up on the Risk hero is the only justified exception: it draws attention to the most important number exactly when it appears. Every other animation is noise, and noise degrades the signal-to-noise ratio that executive decision support depends on.

**Rule derived:** Motion carries business meaning or it does not exist. Every animation must answer: "what business information does this convey?" If no answer: delete the animation.

---

### P7 — Why tooltips explain business context instead of UI behavior

There are two types of tooltips:

1. **Interface tooltips** — explain the UI to someone confused by the interface. ("Click here to view details.")
2. **Business context tooltips** — explain the world to someone making a decision. ("Delay 1 day → opportunity shrinks by 360M as outlets self-activate.")

The SCT interface must be self-evident. If a user needs an interface tooltip, the design has failed. Tooltips are reserved exclusively for business intelligence that cannot fit in the primary view without cluttering it.

**Rule derived:** If a tooltip contains the word "click," "tap," "shows," "displays," or any UI verb — rewrite it as a business calculation or delete it.

---

## 2. Visual Hierarchy Rules

### 2.1 Reading Order — The OODA Loop

Section 5 reading sequence is enforced by layout, not by instruction:

```
OBSERVE          ORIENT           DECIDE           ACT
🚨 Risk     →   🎯 Opportunity  →  ⚡ Action    →   💰 Impact
Where are        Where is money     What do          What changes
we tracking?     recoverable?       we execute?      if we do it?
```

The OODA loop (Observe → Orient → Decide → Act) maps exactly to the four cards. Layout enforces sequence. The executive cannot read Impact before understanding Risk — the dark footer is below the fold at any screen height below 700px, and the before/after structure in the footer is meaningless without the context from the three cards above.

### 2.2 Information Priority Levels

| Level | Content | Role |
|-------|---------|------|
| P1 | Classification status | Sets emotional register before the number is read |
| P2 | Hero KPI | The quantified answer in one number |
| P3 | Primary cause | Driver, territory, named role |
| P4 | Qualifying data | Adds precision, not meaning |
| P5 | Conditions | Triggers, deadlines, escalation rules |
| P6 | Meta | Timestamp, source |

P1 must always be visible before P2. Never place the Hero KPI above the classification badge.

### 2.3 Eye Flow Pattern

1. **Entry:** Classification badge — sets emotional register before the number is read
2. **First dwell:** Hero KPI — the quantified answer
3. **Scan:** Supporting rows — context and qualification
4. **Left column first:** Opportunity card (analysis register)
5. **Right column second:** Action card (imperative register)
6. **Footer anchor:** Dark background draws eye down to consequence

### 2.4 Maximum Information Density Per Card

| Element | Maximum allowed |
|---------|----------------|
| Hero KPIs | 1 |
| Data rows | 4 |
| Badges / pills | 2 |
| Total words | 35 |

These are hard limits. If content exceeds any limit, it belongs in a drill-down section, not the Executive Decision Center.

### 2.5 Hero KPI Rules

- Always a number — never a text string as the hero
- Answers one specific, pre-defined business question
- Always forward-looking — projects state, not just current state
- Minimum 28px at all breakpoints, 48px at desktop
- Always `font-variant-numeric: tabular-nums` to prevent layout shift
- Color always carries semantic meaning — never neutral (never `text-primary` for a hero)

### 2.6 Secondary Row Rules

- Maximum 4 rows per card
- Structure: label (text-secondary, 400 weight) + value (text-primary, 500 weight)
- Consistent row height across all rows in the card
- No secondary row font size ≥ hero font size
- No nested rows — maximum one hierarchy level per card
- Zero charts, tables, or nested components inside rows

---

## 3. Component Library

### 3.1 Card Types

#### Analysis Card
- Background: `--color-background-primary` (white)
- Border: `0.5px solid --color-border-tertiary`
- Border-radius: `10px`
- Padding: `16px`
- Register: Analysis — neutral ground, data-forward, no system judgment implied
- Usage: Opportunity card exclusively

#### Imperative Card
- Background: `--color-background-secondary` (gray)
- Border: `0.5px solid --color-border-tertiary`
- Border-radius: `10px`
- Padding: `16px`
- Register: Instruction — the system is telling the user what to do
- Usage: Action card exclusively

#### Headline Zone (not a card)
- Background: status color at 8% opacity (`rgba(status-hex, 0.08)`)
- Left accent bar: `4px solid [status color]`
- No card border, no border-radius on the zone itself
- Register: Situational — the overall context before all cards
- Usage: Risk zone exclusively

#### Consequence Footer Block
- Background: `#2C2C2A` (warm dark neutral)
- Border-radius: `10px`
- Padding: `14px 16px`
- Register: Consequence — accounting of outcomes, not an error state
- Usage: Impact footer exclusively

**Do:** Match background to register at all times.  
**Don't:** Use the same background for Opportunity and Action. Add colored backgrounds to content cards. Use `#2C2C2A` for anything other than the Impact footer.

---

### 3.2 Badges

Classification badges. Use `border-radius: 4px` (squared, not pill). Carry the highest-level judgment about business state.

| Badge | Background | Text | Usage |
|-------|-----------|------|-------|
| CRITICAL | `#FCEBEB` | `#A32D2D` | Required multiplier >2.00, or ach <70% |
| AT RISK | `#FAEEDA` | `#633806` | Required multiplier 1.51–2.00 |
| ON TRACK | `#EAF3DE` | `#27500A` | Required multiplier ≤1.20 |
| ACT NOW | `#E6F1FB` | `#185FA5` | Action urgency signal in Action card |

Typography: `9px · 700 · uppercase · letter-spacing: 0.10em`  
Padding: `2px 8px`  
Maximum 2 badges per card. Position: top of card, before the card label.

**Do:** Use badges for binary classifications only. One badge per state.  
**Don't:** Create intermediate or custom badge colors. Stack more than 2 badges.

---

### 3.3 Pills

Category pills. Use `border-radius: 100px` (fully rounded). Classify sub-types within the card without implying severity.

| Pill | Background | Text | Usage |
|------|-----------|------|-------|
| Executional | `#EAF3DE` | `#27500A` | CA active rate ≥90% — gap is effort, not structure |
| Partial | `#FAEEDA` | `#633806` | CA active rate 80–89% — mixed signal |
| Structural | `#FCEBEB` | `#A32D2D` | CA active rate <80% — deep problem |
| Inactive CA | `#E6F1FB` | `#0C447C` | Count of inactive outlets |
| Pace Deficit | `var(--bg-secondary)` | `text-secondary` | Root cause classification |

Typography: `9px · 700 · uppercase · letter-spacing: 0.05em`  
Padding: `2px 7px`

**Distinction from badges:** Badges judge (CRITICAL, AT RISK). Pills classify (Executional, Structural). They answer different questions. A card may have one badge AND one pill simultaneously.

---

### 3.4 Status Dots

Item-level status indicators for CA outlet lists. Dot only — no text, no icon. 8px diameter circle.

| Color | Hex | Condition |
|-------|-----|-----------|
| Green | `#639922` | CA active rate ≥90% |
| Amber | `#BA7517` | CA active rate 80–89% |
| Red | `#E24B4A` | CA active rate <80% |

**Do:** Use dots for item-level status where colored text would be too heavy.  
**Don't:** Use traffic lights (circular red/amber/green with shadow). Use dots for anything other than item-level CA status.

---

### 3.5 Progress Bar

Used exclusively in the Risk headline zone to show temporal position within the month.

- Height: `4px`
- Background (track): `--color-border-tertiary`
- Fill color: matches current classification status color
- Border-radius: `2px`
- Tick mark: `1px wide × 10px tall`, color `text-secondary`, positioned at current `hkPass / hkTot` ratio
- No animation on the fill
- Below bar: left-align `current %`, center `D{hkPass} · {timeGone}%`, right-align `Target 100%`
- Typography: `9px · 400 · text-secondary`

**Do:** Single fill color only. Show the tick mark for temporal context.  
**Don't:** Stack multiple fills. Animate the fill. Use outside the Risk zone.

---

### 3.6 Section Labels (Card Headers)

The label above each card's content, identifying the card's purpose.

- Typography: `10px · 500 · uppercase · letter-spacing: 0.08em`
- Color: `--color-text-secondary`
- Position: Top of card content area, before the Hero KPI
- Examples: `BIGGEST OPPORTUNITY · D15 OF 23`, `WHAT TO DO TODAY`

**Do:** Keep labels purely descriptive — what question does this card answer?  
**Don't:** Make labels interactive. Include data values in the label.

---

### 3.7 Divider

Used inside the Action card to visually separate the action instruction from the deadline/escalation block.

- Height: `0.5px`
- Color: `--color-border-tertiary`
- Margin: `8px 0` (top and bottom)
- Never used between Hero KPI and supporting rows

---

### 3.8 Tooltips

Business context tooltips triggered on hover, with 200ms delay.

- Background: `#2C2C2A`
- Text color: `#D3D1C7`
- Typography: `12px · 400 · line-height: 1.5`
- Border-radius: `6px`
- Padding: `6px 10px`
- Max width: `220px`
- Max words: 25
- Appear: instant (0ms transition) after 200ms hover delay
- Content rule: business calculation or business consequence ONLY — never UI instruction

Valid tooltip example: *"Delay 1 day → opportunity shrinks by 360M as outlets self-activate (10% daily decay)."*  
Invalid tooltip example: *"Click to view territory breakdown."*

---

### 3.9 Footer Block

The consequence footer (Impact card). Dark zone at the bottom of Section 5.

Structure: `[do-nothing projection] — [delta arrow] — [with-action projection]`

- Container background: `#2C2C2A`
- Section label: `9px · 500 · uppercase · ls 0.08em · #888780`
- Do-nothing number: `30px · 500 · tabular-nums · #F09595`
- Do-nothing label: `10px · 400 · #888780`
- Delta value: `13px · 700 · #9FE1CB`
- Arrow: `→` in `#5F5E5A`
- Action number: `30px · 500 · tabular-nums · #9FE1CB`
- Action label: `10px · 400 · #888780`

**Do:** Always show do-nothing BEFORE action. Red-200 on dark, not full red. Keep the arrow neutral.  
**Don't:** Use the dark background anywhere else. Make the do-nothing projection alarming — it is a forecast, not an error.

---

### 3.10 Timestamp

Last updated indicator displayed at the bottom of Section 5 below the footer.

- Typography: `10px · 400 · text-secondary`
- Format: `Live data · Updated D{hkPass} · {timestamp}`
- Alignment: right-aligned
- Position: Below the consequence footer, outside the dark zone

---

### 3.11 Icons

Tabler Outline icons exclusively. All icons are functional — none are decorative. Each icon has a fixed semantic meaning that never varies.

| Icon | Tabler name | Fixed meaning in SCT |
|------|------------|---------------------|
| 🚨 | `ti-alert-triangle` | Urgent — CRITICAL classification only |
| 🎯 | `ti-target` | Opportunity / recoverable revenue |
| ⚡ | `ti-bolt` | Immediate action required |
| 💰 | `ti-coin` | Business impact / consequence |
| 👤 | `ti-user` | Named role / escalation owner |
| 📅 | `ti-calendar` | Deadline / working day reference |
| 📞 | `ti-phone` | Outlet call target |
| 📊 | `ti-chart-bar` | Performance tracking |

Icon size: `14px` in all supporting rows. `16px` in card labels.  

**Do:** Use icons to reinforce meaning that text already communicates.  
**Don't:** Use icons as decoration. Use the same icon for different meanings in different cards.

---

### 3.12 Alert Bar

Reserved for system-level alerts (data not loaded, date mismatch, calculation error). Not used within Section 5 cards.

- Background: `#FCEBEB`
- Border-left: `4px solid #A32D2D`
- Text: `12px · 500 · #A32D2D`
- Position: Above Section 5 entirely — never inside a card
- Dismissible: Yes, via `×` button on the right

---

### 3.13 Escalation Row

A structured row inside the Action card below the divider, showing the escalation condition and trigger.

- Icon: `ti-alert-triangle` at `11px · #A32D2D`
- Text: `11px · 400 · #A32D2D`
- Format: `"If D{trigger_day} ach <{threshold}% → escalate to {role}"`
- Always visible — never collapsed or hidden behind a toggle
- Deadline row above divider: `11px · 500 · #BA7517`

---

## 4. Motion Guidelines

### 4.1 Permitted Animations

| Animation | Element | Duration | Easing | Trigger | Repeat |
|-----------|---------|----------|--------|---------|--------|
| Count-up | Risk hero KPI only | 800ms | ease-out | On mount | Once — never repeats |
| Badge pulse | CRITICAL badge only | 300ms | ease-in-out | On mount, CRITICAL only | Once |
| Escalation pulse | `ti-alert-triangle` (CRITICAL only) | 300ms | ease-in-out | On mount, CRITICAL only | Once |
| Card hover border | All cards | 150ms | ease | Mouse enter/leave | Per hover |
| Tooltip appear | Tooltip overlay | 0ms (instant) | — | 200ms after hover start | Per hover |

### 4.2 Count-Up Specification

Applied to the Risk hero KPI — the only element where count-up is justified.

- Start value: `0`
- End value: `computed month_end_proj %`
- Duration: `800ms`
- Easing: `ease-out` — fast start, soft landing on the correct number
- Font during animation: `font-variant-numeric: tabular-nums` from 0 to prevent layout shift
- On data refresh: snap to new value immediately — no re-animation
- Justification: Draws attention to the most critical number at exactly the moment it appears

### 4.3 Forbidden Animations

The following are permanently forbidden in all SCT files:

| Forbidden | Reason |
|-----------|--------|
| Card slide-in | Implies arrival. Dashboards are always present. |
| Card fade-in | Implies construction. Data is pre-loaded. |
| Number spinning / rolling | Gambling aesthetic. Destroys executive credibility. |
| Skeleton loading screens | Implies slowness. Use "Loading data..." text state. |
| Color pulse on AT RISK or ON TRACK | Pulse is reserved for CRITICAL. Dilutes the signal. |
| `animation: infinite` | No animation repeats under any circumstance. |
| Scroll-triggered animations | Executive dashboards are not marketing pages. |
| Hover-scale on cards | Scaling implies clickable navigation. Section 5 cards are not nav targets. |
| Background color transitions | Backgrounds are identity. Identity does not animate. |
| Chart draw/fill animations | Charts render fully immediately in all SCT sections. |

---

## 5. Color Semantics

Colors describe business conditions. If a color cannot be justified by a business meaning, it does not belong in SCT.

### 5.1 Red Family — Business Deterioration · Deficit · Consequence of Inaction

| Token | Hex | Context |
|-------|-----|---------|
| CRITICAL text on white | `#A32D2D` | Risk hero KPI, classification badge text |
| Fill / accent | `#E24B4A` | Progress bar fill (CRITICAL), left accent bar |
| Badge background | `#FCEBEB` | CRITICAL badge, Structural pill background |
| Text on dark | `#F09595` | Do-nothing projection in Impact footer |

**Appears when:** Business is tracking to miss target. An outlet is lost from CA base. The do-nothing projection is shown. Required multiplier >1.50.  
**Never appears for:** System errors (use Alert Bar). Decoration. Any situation that is not a verified business deficit.

### 5.2 Green Family — Recoverable Revenue · Achievable Targets · Active Execution

| Token | Hex | Context |
|-------|-----|---------|
| Badge text on white | `#27500A` | ON TRACK badge, Executional pill text |
| Hero KPI | `#3B6D11` | Opportunity hero (recovery value) |
| CA status dot | `#639922` | Active outlet indicator (≥90%) |
| Text on dark | `#9FE1CB` | With-action projection in Impact footer |

**Appears when:** Revenue is recoverable. Target is achievable. CA outlet is active. The action scenario improves the projection over the do-nothing scenario.  
**Never appears for:** General positive sentiment. Full card backgrounds. Situations without a verified, specific business improvement.

### 5.3 Amber Family — Time-Sensitive · Attention Required · Recoverable If Acted On Today

| Token | Hex | Context |
|-------|-----|---------|
| AT RISK text | `#633806` | AT RISK classification badge text |
| Deadline text | `#BA7517` | Deadline row in Action card |
| Badge background | `#FAEEDA` | AT RISK badge, Partial pill background |
| CA dot | `#BA7517` | Partially active outlet (80–89%) |

**Appears when:** Required multiplier is 1.20–1.50. Deadline is approaching (≤2 WDs remaining). CA active rate is 80–89%.  
**Amber implies direction:** Action today moves amber to green. Inaction moves amber to red. Amber is never a permanent state.

### 5.4 Blue Family — System Direction · Decisive Instruction

| Token | Hex | Context |
|-------|-----|---------|
| ACT NOW badge text | `#185FA5` | Urgency signal in Action card |
| Badge background | `#E6F1FB` | ACT NOW badge, Inactive CA pill background |
| Pill text | `#0C447C` | Inactive CA count pill |

**Appears when:** System is issuing a specific, time-bound action directive. CA count is highlighted by classification.  
**Never appears for:** Status (that is red/amber/green). Background of content zones.

### 5.5 Background Semantics

| Background | Value | Meaning |
|-----------|-------|---------|
| White (bg-primary) | `--color-background-primary` | Analysis register — neutral ground |
| Gray (bg-secondary) | `--color-background-secondary` | Imperative register — instruction |
| Status tint | 8% opacity of status hex | Situational frame (Risk zone only) |
| Consequence dark | `#2C2C2A` | Consequence register (Impact footer only) |

### 5.6 Neutral Semantics

| Token | Usage |
|-------|-------|
| `--color-text-primary` | The value — the answer — the decisive element |
| `--color-text-secondary` | The label — the context — the supporting element |
| `--color-border-tertiary` | Card borders, dividers, progress tracks |
| `#888780` | Text on dark background |
| `#D3D1C7` | Tooltip text on dark |
| `#5F5E5A` | Neutral arrow in footer (`→`) |

---

## 6. Typography System

Two weights only across the entire system: **400 Regular** and **500 Medium**. Weight **700** is permitted only as inline `<strong>` emphasis within text content — never as a standalone heading weight.

Weights 600, 800, and 900 are forbidden in SCT.

### 6.1 Type Scale

| Level | Size | Weight | Variant | Color | Usage |
|-------|------|--------|---------|-------|-------|
| L2 | 48px | 500 | tabular-nums | Status color | Risk hero KPI |
| L3 | 34px | 500 | tabular-nums | `#3B6D11` | Opportunity hero KPI |
| L4 | 30px | 500 | tabular-nums | On-dark semantic | Impact footer numbers |
| L5 | 16px | 500 | — | `text-primary` | Secondary primary value (shortfall, key data row) |
| L6 | 13px | 500 | — | `text-primary` | WHO line, named role/territory |
| L7 | 12px | 700 | — | `text-primary` | Inline strong emphasis only |
| L8 | 12px | 400 | — | `text-primary` | Supporting rows, general content |
| L9 | 11px | 500/400 | — | Semantic | Deadline (500 amber) · Escalation (400 red) |
| L10 | 10px | 500 | uppercase | `text-secondary` | Card labels, section headers, timestamp |
| Badge | 9px | 700 | uppercase | Semantic | Classification badges |
| Pill | 9px | 700 | uppercase | Semantic | Category pills |

### 6.2 Line Height Rules

| Level | Line height |
|-------|------------|
| L2–L4 (Hero type) | `1.0` — no leading, pure presence |
| L5–L8 (Content) | `1.5` — comfortable reading |
| L9–L10 (Metadata) | `1.4` — compact but legible |

### 6.3 Spacing Rules

| Rule | Value |
|------|-------|
| Letter spacing — L10 card labels only | `0.08em` |
| Letter spacing — badges | `0.10em` |
| Letter spacing — pills | `0.05em` |
| Letter spacing — all other levels | `0` (default) |
| tabular-nums | All hero KPIs (L2, L3, L4) — prevents layout shift during count-up |

### 6.4 Weight Rules

| Weight | Usage |
|--------|-------|
| 400 | Labels, secondary text, general content, escalation rows |
| 500 | Heroes, instruction rows, card labels, deadline, WHO line |
| 700 | Inline `<strong>` emphasis within prose rows only |
| 600 | **Forbidden** — too heavy relative to host app UI |
| 800+ | **Forbidden** — never in SCT |

---

## 7. Twenty Immutable Executive UX Rules

These rules govern every future SCT screen without exception. Deviation requires explicit written justification from the design lead.

---

**Rule 01 — Content**  
Every screen answers a question, not presents data. The question must be stated before the screen is designed. If the design team cannot state the question in one sentence, the screen is not ready to design.

---

**Rule 02 — Hierarchy**  
Every section has exactly one entry point — one primary element the eye finds before consciously choosing to look for it. Multiple competing entry points produce a waiting room, not a decision support tool.

---

**Rule 03 — KPI**  
Hero KPIs are always forward-looking projections. Displaying only current state without a projection is a reporting screen, not a decision screen. SCT is a decision screen.

---

**Rule 04 — Background**  
Analysis and instruction must be visually distinct. White background = analysis register. Secondary background = instruction register. If two adjacent cards have the same background, they must have the same register. If they don't have the same register, they must not have the same background.

---

**Rule 05 — Color**  
Status is communicated by position AND color simultaneously. Color alone is insufficient — colorblind executives must read the same information as those with full color vision. Every status must be readable by position or text when color is removed.

---

**Rule 06 — Narrative**  
The consequence of inaction always precedes the benefit of action. Do-nothing projection is shown before action projection, always. Reversing this order is false advertising.

---

**Rule 07 — Numbers**  
Every number includes a unit or explanatory label within two visual lines. "88.8" is ambiguous. "88.8% — month-end projection" is a decision. Numbers without units are not permitted in Section 5 or any future executive section.

---

**Rule 08 — Density**  
Every card has exactly one Hero KPI. Two Hero KPIs per card is not acceptable under any circumstance, regardless of business pressure to add a second metric. The business pressure to add a second hero is a signal that the section needs a new card, not a bigger card.

---

**Rule 09 — Density**  
Maximum 35 words per card including all labels. If content exceeds this limit, it belongs in a drill-down section, not the Executive Decision Center. Count the words. If over 35, remove the least-critical row.

---

**Rule 10 — Tooltips**  
Tooltips explain business context, never UI behavior. If a tooltip contains the words "click," "tap," "shows," "displays," or any UI verb — rewrite it as a business calculation or delete it. The interface must be self-evident. Tooltips are business intelligence.

---

**Rule 11 — Motion**  
Motion carries business meaning or does not exist. Every animation must answer: "what business information does this convey?" If no answer: delete the animation. This test applies at design review, not retrospectively.

---

**Rule 12 — Motion**  
Animations fire once on mount and never repeat. `animation-iteration-count: infinite` is forbidden in all SCT stylesheets without exception. Code review must flag any use of `infinite`.

---

**Rule 13 — Accessibility**  
The section must be fully readable without color. Color reinforces meaning — it never creates meaning. Every status must also be communicated by text or position. This is not an accessibility bonus — it is a requirement for any executive who reads SCT on a projector or a small screen.

---

**Rule 14 — Responsive**  
No critical information collapses to a hidden state at any breakpoint. Classification badge, WHO line, deadline row, and escalation condition are always visible. At mobile breakpoints, layout stacks — information never disappears.

---

**Rule 15 — Action**  
The action owner is always a named role — never "the team," "sales," or a generic title. "AGM Jabar" is an action. "The team" is a suggestion. SCT produces actions, not suggestions.

---

**Rule 16 — Escalation**  
Escalation triggers are always visible on screen. They are never hidden behind a click, an expansion, or a "see more" control. The condition must be on screen. The executive must be able to see the trigger without any interaction.

---

**Rule 17 — Background**  
Dark background (`#2C2C2A`) signals consequences exclusively. This background is never used for navigation, page headers, general UI containers, or cards of any kind other than the Impact consequence footer.

---

**Rule 18 — Color**  
No more than two accent colors simultaneously on any single card. The Impact footer is the only exception — its do-nothing/action before-after structure justifies the explicit red-green contrast as semantically required, not decorative.

---

**Rule 19 — Icons**  
Every icon has a fixed semantic meaning that never varies across SCT. `ti-bolt` always means immediate action. `ti-target` always means opportunity. `ti-alert-triangle` always means CRITICAL escalation. Semantic drift — using the same icon for different meanings in different cards — is forbidden. Maintain the icon semantic register in constants.js.

---

**Rule 20 — Experience**  
The reading sequence of every SCT section must be self-evident to a first-time user without any tutorial, onboarding, or tooltip guidance. If the section requires instruction to be understood, the layout has failed — not the user. Rethink the layout.

---

## Appendix A — Quick Reference

### Status color map

| Status | Hero color | Badge bg | Badge text | Accent bar |
|--------|-----------|---------|-----------|-----------|
| CRITICAL | `#A32D2D` | `#FCEBEB` | `#A32D2D` | `#E24B4A` |
| AT RISK | `#633806` | `#FAEEDA` | `#633806` | `#BA7517` |
| ON TRACK | `#27500A` | `#EAF3DE` | `#27500A` | `#639922` |

### Zone height reference (1440px desktop)

| Zone | Min height | Notes |
|------|-----------|-------|
| Risk Headline | 140px | Expands with content |
| Middle (2-col) | 200px | Equal height columns |
| Impact Footer | 80px | Consequence dark bg |
| Zone gaps | 8px | Between all zones |

### Breakpoint behavior

| Breakpoint | Risk hero | Middle layout | Footer |
|-----------|----------|--------------|--------|
| ≥1200px | 48px | 2-column | 3-column |
| 768–1199px | 40px | 2-column | 3-column |
| <768px | 32px | Stacked (Opp → Act) | Stacked vertical |

### Required multiplier classification

| Value | Classification | Color |
|-------|--------------|-------|
| ≤1.20 | ON TRACK | Green |
| 1.21–1.50 | AT RISK | Amber |
| 1.51–2.00 | CRITICAL | Red |
| >2.00 | UNREACHABLE | Red + additional flag |

---

## Appendix B — Companion Documents

| Document | Location | Contents |
|---------|----------|---------|
| Section 5 Business Spec | `docs/Section5_ExecutiveDecisionCenter_Spec.md` | Full KPI logic, formulas, decision rules, business narratives, example outputs for all 4 cards |
| Section 5 UI Spec | `docs/Section5_UISpecification.md` | Complete developer handoff: typography tables, spacing specs, micro-interactions, responsive behavior |
| SCT v6 Design System (this file) | `docs/SCT_v6_DesignSystem.md` | Design language, component library, color semantics, 20 immutable rules |

---

*End of SCT v6 Executive Design System — Official Reference Document*
