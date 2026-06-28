# Section 5 — KPI Contract Verification Report
## SCT v6 Executive Decision Center

**Versi:** 1.0  
**Status:** Official Audit — Sebelum Implementasi Section5View  
**Tanggal:** 2026-06-25  
**Auditor:** Lead Architect / KPIEngine Lead  
**Sumber Kebenaran:** `docs/Section5_TechnicalDesignSpec.md` (TDS v1.0 — FROZEN)

**File yang Diaudit:**
- `business/kpiEngine.js` — Core KPI Engine
- `business/timegoneEngine.js` — TimeEngine + TrendEngine
- `business/execSummaryEngine.js` — Executive Summary (existing Section 0)
- `core/state.js` — State shape definition
- `utils/constants.js` — Business rule thresholds

---

## 1. Executive Summary

### Kesimpulan Utama

KPIEngine v5 **belum siap** memproduksi `State.kpi.executiveDecision` yang dibutuhkan oleh Section5View. Sebagian besar building block untuk `meta` dan `risk` sudah ada, tetapi dalam nama yang berbeda dan belum dikemas dalam structure yang benar. Seluruh domain `opportunity`, `action`, dan `impact` memerlukan fungsi baru yang belum ada sama sekali.

### Estimasi Completion Percentage

| Domain | Fields Wajib | Sudah Ada (Full/Partial) | Missing | Completion |
|--------|-------------|--------------------------|---------|-----------|
| `meta` | 6 field wajib | 4 partial | 2 | ~55% |
| `risk` | 9 field wajib | 6 partial | 3 | ~45% |
| `opportunity` | 6 field wajib | 1 partial | 5 | ~10% |
| `action` | 11 field wajib | 0 | 11 | 0% |
| `impact` | 7 field wajib | 0 | 7 | 0% |
| **Total** | **39 field wajib** | **11 partial** | **28** | **~22%** |

### Overall Readiness

**KPIEngine saat ini: 22% siap.** Bukan berarti 78% harus ditulis dari nol — banyak bahan baku (raw material) sudah ada di `State.kpi.perf` dan `State.kpi.ca`. Yang dibutuhkan adalah fungsi assembly baru: `calculateExecutiveDecision()` yang mengambil bahan baku yang tersebar, menghitung field yang belum ada, dan mengemasnya dalam struktur `State.kpi.executiveDecision` yang sesuai contract.

### Biggest Risks

1. **`opportunity` domain sepenuhnya baru.** Konsep `caActiveRate` per territory, `recoveryValue`, `qualifiedTerritories`, dan klasifikasi `EXECUTIONAL/PARTIAL/STRUCTURAL` belum ada di KPIEngine. Ini adalah kalkulasi bisnis paling kompleks yang perlu dibangun.

2. **`action` domain sepenuhnya baru.** Role assignment logic (NSM/AGM/Supervisor berdasarkan recovery value threshold), call target formula, dan deadline calculation tidak ada di mana pun di codebase saat ini.

3. **`impact` domain sepenuhnya baru.** Do-nothing projection, with-action projection, dan decay calculation belum pernah diimplementasikan. Ini membutuhkan konfirmasi business rule sebelum dapat diimplementasikan.

4. **`State.kpi.executiveDecision` belum ada sebagai key.** `KPIEngine.runAll()` saat ini tidak menulis ke key ini sama sekali. Harus ditambahkan sebagai langkah terakhir di `runAll()`.

5. **CA_Master dependency.** Seluruh `opportunity` domain bergantung pada `State.filtered.caMaster`. Jika CA_Master tidak tersedia, seluruh opportunity engine harus fallback dengan aman — logika fallback ini harus dirancang sebelum implementasi.

---

## 2. Complete Data Contract Audit

### 2.1 Domain: `meta`

| Data Contract Field | Status | Source Function (Existing) | Source Sheet | Notes |
|---------------------|--------|---------------------------|--------------|-------|
| `meta.schemaVersion` | ❌ Missing | — | — | Perlu ditambahkan sebagai konstanta hardcoded di fungsi baru |
| `meta.generatedAt` | ❌ Missing | — | — | `new Date().toISOString()` — trivial tapi belum ada sebagai field |
| `meta.dataDate` | ❌ Missing | `TimeEngine.get()` tidak menyediakan `dataDate` | DimDate | DimDate menyimpan tanggal hari kerja tapi tidak di-expose ke kpi |
| `meta.hkPass` | 🟡 Partial | `calcPerformance()` → `State.kpi.perf.hkPass` | DimDate via TimeEngine | Tersedia di `perf`, perlu di-promote ke `meta` |
| `meta.hkRem` | 🟡 Partial | `calcPerformance()` → `State.kpi.perf.hkRem` | DimDate via TimeEngine | Tersedia di `perf`, perlu di-promote ke `meta` |
| `meta.hkTot` | 🟡 Partial | `calcPerformance()` → `State.kpi.perf.hkTot` | DimDate via TimeEngine | Tersedia di `perf`, perlu di-promote ke `meta` |
| `meta.timeGone` | 🟡 Partial | `calcPerformance()` → `State.kpi.perf.timeGone` | DimDate via TimeEngine | Tersedia sebagai ratio (0–100), perlu verifikasi apakah format cocok (contract minta 0.0–1.0) |
| `meta.activeFilters` | ❌ Missing | `State.filters` tersedia tapi tidak di-snapshot ke kpi | — | Perlu snapshot filter aktif pada saat kalkulasi |

### 2.2 Domain: `risk`

| Data Contract Field | Status | Source Function (Existing) | Source Sheet | Notes |
|---------------------|--------|---------------------------|--------------|-------|
| `risk.classification` | ❌ Missing | — | — | Logic klasifikasi ON_TRACK/AT_RISK/CRITICAL/UNREACHABLE berdasarkan `requiredMultiplier` belum ada. TrendEngine mempunyai `trendStatus` tapi dengan threshold berbeda. |
| `risk.monthEndProj` | 🟡 Partial | `calcITGTimegone()` punya `proj = (ach/tg)*100` — tapi per ITG, bukan aggregate. `calculatePrincipleExecutiveSummary()` juga punya `proj` per principle. | Perfomance | Formula TDS: `(implied_daily_avg × hkTot) / totTgt × 100` belum diimplementasikan sebagai fungsi eksplisit untuk aggregate. |
| `risk.requiredMultiplier` | 🟡 Partial | `ExecSummaryEngine._slotPerformance()` punya `rrMult = p.actRR/p.reqRR` tapi tidak disimpan ke `State.kpi`. | Perfomance | Kalkulasinya ada di ExecSummaryEngine tapi tidak diekspos sebagai KPI field. Perlu dipindah ke KPIEngine dan disimpan ke State.kpi. |
| `risk.impliedDailyAvg` | 🟡 Partial | `calcPerformance()` punya `actRR = totAct/hkPass` — secara kalkulasi identik. | Perfomance | Tersimpan sebagai `State.kpi.perf.actRR`. Nama berbeda. Perlu di-alias atau di-copy ke contract. |
| `risk.requiredDailyAvg` | 🟡 Partial | `calcPerformance()` punya `reqRR` = gap/hkRem. Berbeda dari formula TDS. | Perfomance | `reqRR` di KPIEngine = (totTgt-totAct)/hkRem. Formula TDS: `required_daily = (totTgt - totAct) / hkRem` → identik. Hanya nama yang berbeda. |
| `risk.shortfall` | 🟡 Partial | `calcPerformance()` → `State.kpi.perf.gap = totAct - totTgt` | Perfomance | Nilai ada, tapi `gap` bisa positif (surplus) atau negatif (deficit). Contract field `shortfall` sesuai semantik negatif = deficit. Perlu konfirmasi sign convention. |
| `risk.progressPct` | ✅ Existing | `calcPerformance()` → `State.kpi.perf.ach` | Perfomance | Identik secara semantik. Hanya nama yang berbeda. |
| `risk.totAct` | ✅ Existing | `calcPerformance()` → `State.kpi.perf.totAct` | Perfomance | Tersedia langsung. |
| `risk.totTgt` | ✅ Existing | `calcPerformance()` → `State.kpi.perf.totTgt` | Perfomance | Tersedia langsung. |
| `risk.worstTerritory` | ❌ Missing | `State.kpi.perf.byDepo[]` ada tapi tidak dengan `requiredMultiplier` per territory. | Perfomance | `byDepo` punya `needHK` dan `ach`, tapi tidak menghitung `requiredMultiplier` per depo. Perlu iterasi byDepo dengan formula multiplier di fungsi baru. |
| `risk.anomalyFlags` | 🟡 Partial | `State.kpi.anomalies[]` ada dari `AnomalyEngine.detect()` | Multiple | Format berbeda — `anomalies` adalah array object kompleks, contract minta `string[]`. Perlu transformasi/filtering. |

### 2.3 Domain: `opportunity`

| Data Contract Field | Status | Source Function (Existing) | Source Sheet | Notes |
|---------------------|--------|---------------------------|--------------|-------|
| `opportunity.totalRecoveryValue` | ❌ Missing | — | CA_Master | Formula: `inactive_CA × avg_ticket_LM`. Belum ada di mana pun. |
| `opportunity.totalInactiveCA` | 🟡 Partial | `calcCAMonitoring()` → `State.kpi.ca.zero` | CA_Master/Perfomance | `ca.zero` = jumlah outlet CA TM=0 dan CA LM>0. Semantik sama tapi granularitas berbeda — `ca.zero` adalah aggregate, contract butuh per-territory. |
| `opportunity.caActiveRateOverall` | ❌ Missing | — | CA_Master | `ca.delta` ada (% growth CA vs LM) tapi bukan CA active rate (CA TM / CA LM). Ini berbeda secara fundamental. |
| `opportunity.avgTicketLM` | ❌ Missing | — | CA_Master, Perfomance | Tidak ada di mana pun. Formula: `totLM / ca.lm`. Perlu kalkulasi baru. |
| `opportunity.qualificationStatus` | ❌ Missing | — | CA_Master | Logic QUALIFIED/PARTIAL/DISQUALIFIED berdasarkan `caActiveRate >= 0.80` belum ada. |
| `opportunity.qualificationReason` | ❌ Missing | — | CA_Master | Narrative string — belum ada. |
| `opportunity.qualifiedTerritories[]` | ❌ Missing | — | CA_Master | Territory-level opportunity breakdown belum ada sama sekali. `ca.byReg` ada tapi bukan per-territory dengan caActiveRate + recoveryValue. |
| `opportunity.partialTerritories[]` | ❌ Missing | — | CA_Master | Belum ada. |
| `opportunity.disqualifiedTerritories[]` | ❌ Missing | — | CA_Master | Belum ada. |
| `opportunity.decayRatePerDay` | ❌ Missing | — | Business rule | Konstanta 0.10 (10%/hari) — belum ada di `constants.js` maupun business layer. |

### 2.4 Domain: `action`

| Data Contract Field | Status | Source Function (Existing) | Source Sheet | Notes |
|---------------------|--------|---------------------------|--------------|-------|
| `action.callTarget` | ❌ Missing | — | CA_Master | Formula: `min(inactive_CA_count, floor(hkRem × 8))`. Belum ada. |
| `action.expectedRevenueToday` | ❌ Missing | — | CA_Master | Formula: `min(callTarget, 15) × avgTicketLM`. Belum ada. |
| `action.primaryRole` | ❌ Missing | — | Business rule | Role assignment: NSM(>5B), AGM(2-5B), Supervisor(<2B). Belum ada. |
| `action.primaryTerritory` | ❌ Missing | — | CA_Master | Territory dengan recoveryValue tertinggi yang qualified. Belum ada. |
| `action.brandFocus` | ❌ Missing | — | CA_Master, Perfomance | Brand/kategori dengan CA inactive tertinggi di primary territory. Belum ada. |
| `action.deadlineTime` | ❌ Missing | — | Business rule | Hardcoded business rule ("10:00") yang belum ada di config manapun. |
| `action.deadlineDate` | ❌ Missing | — | DimDate | `D{hkPass + 2}` = deadline 2 hari kerja ke depan. Perlu formula dari hkPass. |
| `action.escalationCondition` | ❌ Missing | — | Business rule | Template narrative. ExecSummaryEngine._slotActionToday() punya sentence action tapi format berbeda dan tidak terstruktur sebagai escalation condition. |
| `action.escalationTriggerDay` | ❌ Missing | — | Business rule | `hkPass + 2` — belum ada sebagai computed field. |
| `action.escalationThreshold` | ❌ Missing | — | Business rule | Threshold 70% — belum ada di constants.js. |
| `action.escalationOwner` | ❌ Missing | — | Business rule | Escalation owner logic — belum ada. |
| `action.urgencySignal` | ❌ Missing | — | Business rule | ACT_NOW/PROCEED/MONITOR berdasarkan classification — belum ada. |

### 2.5 Domain: `impact`

| Data Contract Field | Status | Source Function (Existing) | Source Sheet | Notes |
|---------------------|--------|---------------------------|--------------|-------|
| `impact.doNothingProjection` | ❌ Missing | — | Perfomance | Sama dengan `risk.monthEndProj` (proyeksi linear tanpa aksi recovery). Perlu konfirmasi apakah benar identik atau berbeda. |
| `impact.withActionProjection` | ❌ Missing | — | Perfomance, CA_Master | `(totAct + recoveryValue + impliedDailyAvg × hkRem) / totTgt × 100`. Belum ada. |
| `impact.deltaProjection` | ❌ Missing | — | Derived | `withActionProjection - doNothingProjection`. Belum ada. |
| `impact.deltaValue` | ❌ Missing | — | CA_Master | Sama dengan `totalRecoveryValue`. Perlu konfirmasi apakah identik atau perlu kalkulasi terpisah. |
| `impact.viabilityDays` | ❌ Missing | — | Business rule | `floor(log(1.0B / value_today) / log(0.90))` — belum ada. |
| `impact.viabilityDate` | ❌ Missing | — | DimDate | Tanggal absolut = dataDate + viabilityDays. Belum ada. |
| `impact.decayPerDay` | ❌ Missing | — | Business rule | `recoveryValue × decayRatePerDay`. Belum ada. |

---

## 3. KPI Mapping

### 3.1 Field → Fungsi yang Harus Memproduksinya

| Data Contract Field | Fungsi Rekomendasi | Status Fungsi |
|---------------------|-------------------|---------------|
| **meta.schemaVersion** | `calculateExecutiveDecision()` — nilai hardcoded `"1.0.0"` | ❌ Fungsi belum ada |
| **meta.generatedAt** | `calculateExecutiveDecision()` — `new Date().toISOString()` | ❌ Fungsi belum ada |
| **meta.dataDate** | `calculateExecutiveDecision()` — baca dari `State.timeEngine` atau DimDate | ❌ Fungsi belum ada; `dataDate` belum tersimpan di State.timeEngine |
| **meta.hkPass** | `calculateExecutiveDecision()` — ambil dari `State.kpi.perf.hkPass` | 🟡 Sumber ada; assembler belum ada |
| **meta.hkRem** | `calculateExecutiveDecision()` — ambil dari `State.kpi.perf.hkRem` | 🟡 Sumber ada; assembler belum ada |
| **meta.hkTot** | `calculateExecutiveDecision()` — ambil dari `State.kpi.perf.hkTot` | 🟡 Sumber ada; assembler belum ada |
| **meta.timeGone** | `calculateExecutiveDecision()` — ambil dari `State.kpi.perf.timeGone`, ubah 0–100 → 0.0–1.0 | 🟡 Sumber ada; perlu transformasi |
| **meta.activeFilters** | `calculateExecutiveDecision()` — snapshot dari `State.filters` dan `State.options` | ❌ Fungsi belum ada |
| **risk.classification** | `calculateExecutiveDecision()` — logika baru berdasarkan `requiredMultiplier` | ❌ Logika belum ada |
| **risk.monthEndProj** | `calculateExecutiveDecision()` — formula: `(actRR × hkTot / totTgt) × 100` | 🟡 Bahan ada di perf; formula belum ditulis eksplisit sebagai field |
| **risk.requiredMultiplier** | `calculateExecutiveDecision()` — `reqRR / actRR` dari `State.kpi.perf` | 🟡 Kalkulasi ada di ExecSummaryEngine; perlu dipindah ke KPIEngine |
| **risk.impliedDailyAvg** | `calculateExecutiveDecision()` — `State.kpi.perf.actRR` (alias) | ✅ Data ada; perlu mapping nama |
| **risk.requiredDailyAvg** | `calculateExecutiveDecision()` — `State.kpi.perf.reqRR` (alias) | ✅ Data ada; perlu mapping nama |
| **risk.shortfall** | `calculateExecutiveDecision()` — derivasi dari `perf.ach`, `perf.timeGone`, `perf.totTgt` | 🟡 Komponen ada; `shortfall` spesifik belum dihitung |
| **risk.progressPct** | `calculateExecutiveDecision()` — `State.kpi.perf.ach` (alias) | ✅ Data ada; perlu mapping nama |
| **risk.totAct** | `calculateExecutiveDecision()` — `State.kpi.perf.totAct` (direct copy) | ✅ Data ada |
| **risk.totTgt** | `calculateExecutiveDecision()` — `State.kpi.perf.totTgt` (direct copy) | ✅ Data ada |
| **risk.worstTerritory** | `calculateExecutiveDecision()` — iterasi `State.kpi.perf.byDepo`, hitung multiplier per depo | ❌ Fungsi belum ada; `byDepo` ada tapi belum dengan multiplier |
| **risk.anomalyFlags** | `calculateExecutiveDecision()` — filter dan transform `State.kpi.anomalies` ke string[] | 🟡 Source ada; transformasi belum ada |
| **opportunity.totalRecoveryValue** | `calculateCAOpportunity()` — **fungsi baru** | ❌ Fungsi belum ada |
| **opportunity.totalInactiveCA** | `calculateCAOpportunity()` — aggregate dari territory-level inactive CA | 🟡 `ca.zero` ada tapi bukan territory-level |
| **opportunity.caActiveRateOverall** | `calculateCAOpportunity()` — `CA_TM / CA_LM` aggregate | ❌ Formula belum ada (ca.delta berbeda) |
| **opportunity.avgTicketLM** | `calculateCAOpportunity()` — `totLM / ca.lm` | ❌ Belum ada |
| **opportunity.qualificationStatus** | `calculateCAOpportunity()` — klasifikasi berdasarkan `caActiveRate >= 0.80` | ❌ Belum ada |
| **opportunity.qualificationReason** | `calculateCAOpportunity()` — narrative berdasarkan qualification | ❌ Belum ada |
| **opportunity.qualifiedTerritories[]** | `calculateCAOpportunity()` — per-territory breakdown dari `State.filtered.caMaster` | ❌ Belum ada |
| **opportunity.partialTerritories[]** | `calculateCAOpportunity()` | ❌ Belum ada |
| **opportunity.disqualifiedTerritories[]** | `calculateCAOpportunity()` | ❌ Belum ada |
| **opportunity.decayRatePerDay** | `calculateCAOpportunity()` — konstanta `0.10` dari `constants.js` | ❌ Konstanta belum ada di CONSTANTS |
| **action.callTarget** | `calculateActionPlan()` — **fungsi baru** | ❌ Fungsi belum ada |
| **action.expectedRevenueToday** | `calculateActionPlan()` | ❌ Belum ada |
| **action.primaryRole** | `calculateActionPlan()` — role assignment berdasarkan recoveryValue tier | ❌ Belum ada |
| **action.primaryTerritory** | `calculateActionPlan()` — territory dengan recoveryValue tertinggi yang qualified | ❌ Belum ada |
| **action.brandFocus** | `calculateActionPlan()` — top Arjuna principle di primary territory | ❌ Belum ada |
| **action.deadlineTime** | `calculateActionPlan()` — hardcoded business rule | ❌ Belum ada di config |
| **action.deadlineDate** | `calculateActionPlan()` — `D{hkPass + 2}` | ❌ Belum ada |
| **action.escalationCondition** | `calculateActionPlan()` — template narrative | ❌ Belum ada |
| **action.escalationTriggerDay** | `calculateActionPlan()` — `hkPass + 2` | ❌ Belum ada |
| **action.escalationThreshold** | `calculateActionPlan()` — 70% (business rule) | ❌ Belum ada di CONSTANTS |
| **action.escalationOwner** | `calculateActionPlan()` — NSM (default escalation owner) | ❌ Belum ada |
| **action.urgencySignal** | `calculateActionPlan()` — berdasarkan classification | ❌ Belum ada |
| **impact.doNothingProjection** | `calculateImpact()` — **fungsi baru** — identik dengan `risk.monthEndProj` | ❌ Fungsi belum ada |
| **impact.withActionProjection** | `calculateImpact()` — proyeksi dengan recovery | ❌ Belum ada |
| **impact.deltaProjection** | `calculateImpact()` — `withAction - doNothing` | ❌ Belum ada |
| **impact.deltaValue** | `calculateImpact()` — identik dengan `totalRecoveryValue` | ❌ Belum ada |
| **impact.viabilityDays** | `calculateImpact()` — log decay formula | ❌ Belum ada |
| **impact.viabilityDate** | `calculateImpact()` — `dataDate + viabilityDays` | ❌ Belum ada |
| **impact.decayPerDay` | `calculateImpact()` — `recoveryValue × 0.10` | ❌ Belum ada |

---

## 4. Gap Analysis

### 4.1 Sudah Tersedia (Dapat Langsung Digunakan)

Semua field ini tersedia di `State.kpi.perf` — hanya perlu di-reference dan di-rename di dalam `calculateExecutiveDecision()`.

| Field | Sumber Existing | Effort |
|-------|----------------|--------|
| `risk.totAct` | `State.kpi.perf.totAct` | Low |
| `risk.totTgt` | `State.kpi.perf.totTgt` | Low |
| `risk.progressPct` | `State.kpi.perf.ach` | Low |
| `risk.impliedDailyAvg` | `State.kpi.perf.actRR` | Low |
| `risk.requiredDailyAvg` | `State.kpi.perf.reqRR` | Low |
| `meta.hkPass` | `State.kpi.perf.hkPass` | Low |
| `meta.hkRem` | `State.kpi.perf.hkRem` | Low |
| `meta.hkTot` | `State.kpi.perf.hkTot` | Low |
| `meta.timeGone` | `State.kpi.perf.timeGone` ÷ 100 | Low |
| `meta.generatedAt` | `new Date().toISOString()` | Low |
| `meta.schemaVersion` | Hardcoded `"1.0.0"` | Low |

**Estimasi: 11 field — Effort Low — 1 hari kerja untuk mengemas ke assembler function.**

---

### 4.2 Perlu Enhancement (Logic Ada Tapi Perlu Adaptasi)

Field ini membutuhkan transformasi atau kalkulasi tambahan dari data yang sudah ada.

| Field | Yang Perlu Dilakukan | Effort |
|-------|---------------------|--------|
| `risk.shortfall` | Hitung `(perf.ach × perf.totTgt/100) - (timeGone × perf.totTgt/100)` untuk shortfall vs pace — bukan hanya gap vs target. Perlu klarifikasi business rule mana yang dimaksud. | Medium |
| `risk.monthEndProj` | Implementasikan formula eksplisit `(actRR × hkTot) / totTgt × 100` sebagai derived field. Komponen ada di `perf`. | Low-Medium |
| `risk.requiredMultiplier` | Pindahkan dari `ExecSummaryEngine._slotPerformance()` ke `calculateExecutiveDecision()` dan simpan ke State.kpi. | Low |
| `risk.classification` | Buat mapping dari `requiredMultiplier` ke enum: ≤1.20 ON_TRACK, 1.21-1.50 AT_RISK, 1.51-2.00 CRITICAL, >2.00 UNREACHABLE. | Low |
| `risk.worstTerritory` | Iterasi `State.kpi.perf.byDepo[]`, hitung `requiredMultiplier` per depo (`(depo.tgt - depo.act) / (depo.act/hkPass) / hkRem`), pilih yang tertinggi. | Medium |
| `risk.anomalyFlags` | Filter `State.kpi.anomalies[]` untuk anomali yang relevan dengan Risk, map ke string[]. | Low |
| `meta.dataDate` | Expose `dataDate` dari `State.timeEngine` atau derive dari DimDate parsing. Perlu tambahan field di `State.timeEngine`. | Medium |
| `meta.activeFilters` | Snapshot `State.filters` dan `State.options` pada saat `calculateExecutiveDecision()` dipanggil. | Low |
| `opportunity.totalInactiveCA` | Re-aggregate dari territory-level (`calculateCAOpportunity()`). `ca.zero` yang ada adalah aggregate tapi belum per-territory dari CA_Master dengan kolom yang benar. | Medium |

**Estimasi: 9 field — Effort Low-Medium — 3-5 hari kerja.**

---

### 4.3 Harus Dibangun dari Awal

Field ini memerlukan fungsi baru yang belum ada di mana pun di codebase.

#### Blok A — `calculateCAOpportunity()` (Fungsi Baru)

Fungsi ini membaca `State.filtered.caMaster` dan `State.kpi.perf`, menghitung seluruh opportunity domain.

| Field | Formula / Logic | Effort |
|-------|----------------|--------|
| `opportunity.caActiveRateOverall` | `sum(CA_TM) / sum(CA_LM)` dari CA_Master aggregate | Medium |
| `opportunity.avgTicketLM` | `perf.totLM / sum(CA_LM)` — butuh konfirmasi apakah `totLM` dari Perfomance sheet = `totLM` yang relevan untuk CA | Medium |
| `opportunity.totalRecoveryValue` | `sum(inactiveCA_per_territory × avgTicketLM_per_territory)` | High |
| `opportunity.qualifiedTerritories[]` | Per-territory: `caActiveRate`, `inactiveCA`, `recoveryValue`, `assignedRole`. Butuh groupBy territory di CA_Master. | High |
| `opportunity.partialTerritories[]` | Sama dengan qualified tapi untuk caActiveRate 0.60-0.79 | Medium |
| `opportunity.disqualifiedTerritories[]` | Sama dengan qualified tapi untuk caActiveRate <0.60 | Medium |
| `opportunity.qualificationStatus` | Logika berdasarkan `caActiveRateOverall >= 0.80` | Low |
| `opportunity.qualificationReason` | Narrative template berdasarkan qualification status | Low |
| `opportunity.decayRatePerDay` | Konstanta `0.10` — tambahkan ke `CONSTANTS` | Low |

**Estimasi Blok A: 9 field — Effort High — 5-8 hari kerja.**

#### Blok B — `calculateActionPlan()` (Fungsi Baru)

Fungsi ini bergantung pada output `calculateCAOpportunity()`.

| Field | Formula / Logic | Effort |
|-------|----------------|--------|
| `action.callTarget` | `min(totalInactiveCA, floor(hkRem × 8))` | Low |
| `action.expectedRevenueToday` | `min(callTarget, 15) × avgTicketLM` | Low |
| `action.primaryRole` | `recoveryValue > 5B → NSM; 2-5B → AGM; <2B → Supervisor` — **perlu konfirmasi threshold** | Medium |
| `action.primaryTerritory` | Territory dengan `recoveryValue` tertinggi dari `qualifiedTerritories[]` | Low |
| `action.brandFocus` | Top Arjuna principle dari `State.kpi.perf.byPrin` yang berkaitan dengan primary territory — butuh join antara CA territory dan perf principle | High |
| `action.deadlineTime` | Business rule hardcoded `"10:00"` — perlu masuk ke `CONSTANTS` | Low |
| `action.deadlineDate` | `"D${hkPass + 2}"` — perlu konfirmasi business rule | Low |
| `action.escalationCondition` | Template: `"Jika D{trigger} ach <{threshold}% → eskalasi ke {owner}"` | Low |
| `action.escalationTriggerDay` | `hkPass + 2` | Low |
| `action.escalationThreshold` | `70` (%) — perlu masuk ke `CONSTANTS` | Low |
| `action.escalationOwner` | `NSM` (default) atau berdasarkan primaryRole — perlu konfirmasi | Medium |
| `action.urgencySignal` | `CRITICAL → ACT_NOW; AT_RISK → PROCEED; ON_TRACK → MONITOR` | Low |

**Estimasi Blok B: 12 field — Effort Medium — 3-5 hari kerja.**

#### Blok C — `calculateImpact()` (Fungsi Baru)

Fungsi ini bergantung pada output Blok A dan B.

| Field | Formula / Logic | Effort |
|-------|----------------|--------|
| `impact.doNothingProjection` | Identik dengan `risk.monthEndProj`. Perlu konfirmasi apakah ini benar sama atau ada perbedaan asumsi. | Low |
| `impact.withActionProjection` | `(totAct + recoveryValue + impliedDailyAvg × hkRem) / totTgt × 100` | Medium |
| `impact.deltaProjection` | `withAction - doNothing` | Low |
| `impact.deltaValue` | Identik dengan `totalRecoveryValue`. Perlu konfirmasi. | Low |
| `impact.viabilityDays` | `floor(log(1B / recoveryValue) / log(0.90))` — **perlu business rule klarifikasi: angka 1B dari mana?** | High |
| `impact.viabilityDate` | `dataDate + viabilityDays working days` | Medium |
| `impact.decayPerDay` | `recoveryValue × 0.10` | Low |

**Estimasi Blok C: 7 field — Effort Medium-High — 3-4 hari kerja.**

---

### 4.4 Ringkasan Gap

| Kategori | Jumlah Field | Estimasi Effort | Estimasi Hari |
|----------|-------------|----------------|---------------|
| Sudah tersedia — tinggal assemble | 11 | Low | 1 |
| Perlu enhancement | 9 | Low-Medium | 3–5 |
| Harus dibangun — Blok A (CAOpportunity) | 9 | High | 5–8 |
| Harus dibangun — Blok B (ActionPlan) | 12 | Medium | 3–5 |
| Harus dibangun — Blok C (Impact) | 7 | Medium-High | 3–4 |
| **Total** | **48** | | **15–23 hari kerja** |

---

## 5. Data Lineage

Untuk setiap domain, aliran data dari sheet hingga ke Section5View.

### 5.1 Domain: `meta`

```
[DimDate sheet]
  → Parser.parseDimDate()
  → State.timeEngine {hkTot, hkPass, hkRem, timeGone, dataDate}
  → TimeEngine.get()
  → KPIEngine.calcPerformance() → State.kpi.perf {hkTot, hkPass, hkRem, timeGone}
  → [NEW] KPIEngine.calculateExecutiveDecision()
  → State.kpi.executiveDecision.meta
  → Section5View.renderHeader()
```

**Gap di lineage:** `dataDate` belum di-expose oleh `TimeEngine.get()` dan belum ada di `State.timeEngine`. Parser perlu ditambahkan untuk menyimpan tanggal data aktif dari DimDate.

---

### 5.2 Domain: `risk`

```
[Perfomance sheet]
  → Parser.parseSheet('perf')
  → State.raw.perf[]
  → FilterEngine → State.filtered.perf[]
  → KPIEngine.calcPerformance()
  → State.kpi.perf {totAct, totTgt, ach, actRR, reqRR, byDepo[], hkPass, hkRem, hkTot}
  → [NEW] KPIEngine.calculateExecutiveDecision()
  → State.kpi.executiveDecision.risk
  → Section5View.renderRisk()
```

**Gap di lineage:** `requiredMultiplier`, `classification`, dan `worstTerritory` adalah kalkulasi baru yang harus dilakukan di dalam `calculateExecutiveDecision()`. Bahan bakunya ada di `State.kpi.perf` — tidak perlu akses ke State.filtered.

```
[AnomalyEngine output]
  → State.kpi.anomalies[]
  → [NEW] KPIEngine.calculateExecutiveDecision() — filter & transform
  → State.kpi.executiveDecision.risk.anomalyFlags[]
```

---

### 5.3 Domain: `opportunity`

```
[CA_Master sheet]
  → Parser.parseSheet('caMaster')
  → State.raw.caMaster[]
  → FilterEngine → State.filtered.caMaster[]
  → [NEW] KPIEngine.calculateCAOpportunity(State.filtered.caMaster, State.kpi.perf)
      ├── Group by Territory → per-territory: CA_TM, CA_LM, inactive_CA
      ├── caActiveRate = CA_TM / CA_LM per territory
      ├── avgTicketLM = totLM (perf) / CA_LM aggregate
      ├── recoveryValue = inactive_CA × avgTicketLM per territory
      ├── Classify territory: EXECUTIONAL/PARTIAL/STRUCTURAL
      └── Assign role berdasarkan recoveryValue tier
  → State.kpi.executiveDecision.opportunity
  → Section5View.renderOpportunity()
```

**Gap kritis di lineage:** `calculateCAOpportunity()` membutuhkan join antara CA_Master (untuk CA data) dan Perfomance (untuk avgTicketLM). Join ini tidak boleh dilakukan di Section5View — harus dilakukan di KPIEngine level. Join dilakukan melalui `State.kpi.perf.totLM` dan `State.kpi.ca.lm` yang sudah tersedia.

---

### 5.4 Domain: `action`

```
[State.kpi.executiveDecision.opportunity] — output Blok A
  → [NEW] KPIEngine.calculateActionPlan(opportunity, State.kpi.perf, TimeEngine.get())
      ├── callTarget = min(totalInactiveCA, floor(hkRem × 8))
      ├── expectedRevenueToday = min(callTarget, 15) × avgTicketLM
      ├── primaryRole = role berdasarkan totalRecoveryValue tier
      ├── primaryTerritory = qualifiedTerritories[0] (sorted by recoveryValue desc)
      ├── brandFocus = top Arjuna principle dari State.kpi.perf.byPrin
      ├── deadline = hkPass + 2
      └── escalation = {trigger: hkPass+2, threshold: 70%, owner: NSM}
  → State.kpi.executiveDecision.action
  → Section5View.renderAction()
```

---

### 5.5 Domain: `impact`

```
[State.kpi.executiveDecision.risk] + [State.kpi.executiveDecision.opportunity]
  → [NEW] KPIEngine.calculateImpact(risk, opportunity, TimeEngine.get())
      ├── doNothingProjection = risk.monthEndProj
      ├── withActionProjection = (totAct + recoveryValue + actRR × hkRem) / totTgt × 100
      ├── deltaProjection = withAction - doNothing
      ├── deltaValue = opportunity.totalRecoveryValue
      ├── viabilityDays = floor(log(1B/recoveryValue) / log(0.90))
      └── decayPerDay = recoveryValue × 0.10
  → State.kpi.executiveDecision.impact
  → Section5View.renderImpact()
```

---

### 5.6 Dependency Order di KPIEngine.runAll()

Urutan eksekusi yang wajib (karena ada dependency antar blok):

```
1. calcPerformance()          → State.kpi.perf [sudah ada]
2. calcCAMonitoring()         → State.kpi.ca [sudah ada]
3. calculateCAOpportunity()   → [BARU] — requires: State.filtered.caMaster + State.kpi.perf
4. calculateActionPlan()      → [BARU] — requires: output step 3
5. calculateImpact()          → [BARU] — requires: output step 3 + State.kpi.perf
6. calculateExecutiveDecision() → [BARU] — assembles meta + risk + output 3,4,5
```

`calculateExecutiveDecision()` adalah langkah terakhir yang mengemas semua output ke dalam `State.kpi.executiveDecision`.

---

## 6. Business Rule Validation

Berikut adalah field-field yang memerlukan konfirmasi business rule sebelum implementasi dapat dimulai.

### BR-01: Formula `shortfall`

**Ambiguitas:** Dalam konteks TDS Section 5, `shortfall` adalah gap antara achievement aktual dan pace target (expected achievement pada hari ini). Namun bisa juga diinterpretasikan sebagai gap vs target akhir bulan.

- **Interpretasi A (vs Pace):** `shortfall = (timeGone × totTgt) - totAct` — berapa yang kurang vs apa yang seharusnya dicapai hari ini.
- **Interpretasi B (vs Target):** `shortfall = totAct - totTgt` — identik dengan `perf.gap` yang sudah ada.

**⚠ Keputusan diperlukan:** Interpretasi mana yang dimaksud di Section 5? Interpretasi A lebih relevan untuk "Executive Decision Center" karena menunjukkan defisit vs pace.

---

### BR-02: `avgTicketLM` — Base Data yang Digunakan

**Ambiguitas:** `avgTicketLM = totLM / ca.lm`. Pertanyaan: `totLM` dari sheet mana?

- **Opsi A:** `totLM` dari Perfomance sheet aggregate (`State.kpi.perf.totLM`) dibagi dengan `State.kpi.ca.lm` aggregate.
- **Opsi B:** `totLM` dari CA_Master per territory, bagi dengan jumlah CA LM per territory → lebih akurat untuk per-territory calculation.

**⚠ Keputusan diperlukan:** Opsi B lebih akurat secara bisnis tapi memerlukan kalkulasi per-territory yang lebih kompleks.

---

### BR-03: Role Assignment Threshold

**Business rule dari TDS Spec:**
- `recoveryValue > 5B → NSM`
- `recoveryValue 2–5B → AGM`
- `recoveryValue < 2B → Supervisor`

**Pertanyaan:** Threshold ini fixed (hardcoded) atau tergantung pada total target bulan itu? Di bulan dengan target 500B, 5B mungkin tidak signifikan. Di bulan dengan target 50B, 5B adalah 10% target.

**⚠ Keputusan diperlukan:** Apakah threshold bersifat absolut (IDR fixed) atau relatif (% dari total target)?

---

### BR-04: Viability Days Formula

**Business rule dari TDS:**
```
viabilityDays = floor(log(1.0B / value_today) / log(0.90))
```

**Pertanyaan:** Angka `1.0B` (1 miliar IDR) sebagai minimum viable recovery — dari mana angka ini? Apakah ini:
- **Opsi A:** Minimum absolute (selalu 1B tanpa tergantung ukuran bisnis)
- **Opsi B:** % dari target (misalnya 0.1% dari totTgt)

**⚠ Keputusan diperlukan:** Konfirmasi nilai minimum viable recovery dan apakah ini konstanta atau derived.

---

### BR-05: `doNothingProjection` vs `monthEndProj`

**Ambiguitas:** TDS mendefinisikan `impact.doNothingProjection` dan `risk.monthEndProj` secara terpisah tapi dengan formula yang terlihat identik (`(actRR × hkTot) / totTgt × 100`).

**Pertanyaan:** Apakah keduanya benar-benar identik (satu nilai yang ditampilkan dua kali untuk narasi berbeda) atau ada perbedaan asumsi kalkulasi?

**⚠ Keputusan diperlukan:** Konfirmasi apakah kedua field ini identik atau berbeda secara kalkulasi.

---

### BR-06: Territory Definition

**Ambiguitas:** Dalam CA_Master, apakah kolom grouping yang digunakan untuk "territory" adalah:
- `Region` — sama dengan Performance sheet
- `Depo` / `PSName` — lebih granular
- Kolom khusus lainnya di CA_Master

**⚠ Keputusan diperlukan:** Konfirmasi kolom yang menjadi unit territory di CA_Master untuk `calculateCAOpportunity()`.

---

### BR-07: Call Target Cadence

**Business rule dari TDS:**
```
callTarget = min(inactive_CA_count, floor(hkRem × 8))
```

**Pertanyaan:** Angka `8` (calls per day) — apakah ini konstanta bisnis yang fixed atau variabel yang tergantung pada jumlah force per territory? Di territory dengan force 2 orang, 8 calls/hari mungkin tidak realistis.

**⚠ Keputusan diperlukan:** Apakah `8` adalah konstanta untuk semua territory atau perlu konfigurasi per territory?

---

### BR-08: Escalation Trigger Window

**Business rule dari TDS:** `escalationTriggerDay = hkPass + 2`

**Pertanyaan:** "+2" hari kerja ini fixed atau dinamis? Di akhir bulan (hkRem = 1), `hkPass + 2` melebihi batas bulan.

**⚠ Keputusan diperlukan:** Bagaimana handle kasus edge dimana `escalationTriggerDay > hkTot`?

---

## 7. Dependency Validation

### 7.1 Verifikasi Arsitektur

Audit tidak menemukan pelanggaran arsitektur dalam implementasi yang ada. Seluruh aliran data saat ini sudah mengikuti pola yang benar:

```
MonitorDaily.xlsx → Parser → State.raw → State.filtered → KPIEngine → State.kpi → RenderEngine/ExecSummaryEngine
```

Section5View belum diimplementasikan, sehingga tidak ada risiko Section5View mengakses State.filtered langsung.

### 7.2 Potensi Pelanggaran yang Harus Dicegah

Berikut adalah risiko pelanggaran yang harus diperhatikan selama implementasi:

| Risiko | Deskripsi | Mitigasi |
|--------|-----------|---------|
| **CA_Master bypass** | Developer mungkin tergoda mengakses `State.filtered.caMaster` langsung dari Section5View untuk menghitung `caActiveRate` | Pastikan `calculateCAOpportunity()` sudah memproduksi semua field sebelum Section5View diimplementasikan. Code review harus melarang akses ke `State.filtered.*` dari `ui/` folder. |
| **ExecSummaryEngine.build() overlap** | `ExecSummaryEngine._slotActionToday()` menghasilkan action narrative yang mirip dengan `action.escalationCondition`. Ada risiko duplikasi logic. | `calculateActionPlan()` tidak boleh memanggil ExecSummaryEngine. Business logic harus diimplementasikan ulang secara independen di KPIEngine. |
| **Inline rrMult calculation** | `ExecSummaryEngine._slotPerformance()` menghitung `rrMult` yang identik dengan `requiredMultiplier`. Jika developer copy-paste ini ke Section5View, terjadi pelanggaran. | `rrMult` harus dipindah ke `calculateExecutiveDecision()` dan menjadi bagian dari `State.kpi.executiveDecision.risk.requiredMultiplier`. |
| **timeGone format mismatch** | `State.kpi.perf.timeGone` adalah 0–100 (persentase), contract minta 0.0–1.0 (ratio). | Transformasi wajib: `timeGone_contract = perf.timeGone / 100`. Dokumentasikan di CHANGELOG. |

### 7.3 Konfirmasi: Tidak Ada Pelanggaran Aktif

Karena Section5View belum ada, tidak ada pelanggaran aktif saat ini. Audit ini bersifat preventif — memastikan `State.kpi.executiveDecision` diproduksi sepenuhnya oleh KPIEngine sebelum Section5View diimplementasikan.

---

## 8. Performance Impact

### 8.1 Kalkulasi Tambahan yang Dibutuhkan

| Fungsi Baru | Operasi | Estimasi Beban |
|-------------|---------|----------------|
| `calculateCAOpportunity()` | Group-by territory pada `State.filtered.caMaster`. Untuk 200 rows CA_Master: ~5-10ms | Rendah |
| `calculateActionPlan()` | Lookup dan sorting dari output opportunity. O(n) dimana n = jumlah qualified territories | Sangat rendah |
| `calculateImpact()` | 5-7 kalkulasi arithmetic dari output sebelumnya | Sangat rendah |
| `calculateExecutiveDecision()` | Assembly dari semua output + TimeEngine call | Sangat rendah |
| Per-territory `requiredMultiplier` dalam `risk.worstTerritory` | Iterasi `State.kpi.perf.byDepo[]` — biasanya <50 entries | Rendah |

### 8.2 Memory Impact

| Item | Estimasi Memory |
|------|----------------|
| `State.kpi.executiveDecision` object | ~5-10 KB (39+ field + nested arrays) |
| `opportunity.qualifiedTerritories[]` | ~2-3 KB untuk 10-20 territories |
| Total overhead vs current `State.kpi` | < 15 KB — tidak signifikan |

### 8.3 Eksekusi Impact pada KPIEngine.runAll()

| Item | Estimasi |
|------|----------|
| Tambahan waktu eksekusi KPIEngine | +10–30ms |
| Persentase overhead vs current runtime (~200ms) | +5–15% |
| Dampak terhadap user experience | Tidak terasa (<16ms threshold untuk 60fps) |

### 8.4 Risiko Performance

Satu-satunya risiko performa yang perlu diperhatikan adalah pada `calculateCAOpportunity()` jika CA_Master mengandung ribuan baris (>1000 rows). Untuk ukuran file MonitorDaily.xlsx yang normal, ini tidak menjadi masalah. Jika performance menjadi isu, solusinya adalah meng-cache output `calculateCAOpportunity()` dan hanya menghitung ulang saat filter berubah.

---

## 9. Final Readiness Matrix

| Area | Status | Siap untuk Implementasi? |
|------|--------|--------------------------|
| **Architecture** | ✅ Solid | Ya — TDS mendefinisikan arsitektur yang jelas, tidak ada konflik dengan struktur KPIEngine saat ini |
| **Business Rules (existing)** | ✅ Valid | Ya — `calcPerformance`, `calcCAMonitoring`, `TimeEngine` sudah mengikuti business rules yang benar |
| **Business Rules (new - BR-01 s/d BR-08)** | ⚠️ Pending | Tidak — 8 business rule questions harus dijawab sebelum implementasi dimulai |
| **Data Contract** | 🟡 Draft | Tidak — contract sudah defined tapi belum diverifikasi production-ready. `dataDate` memerlukan perubahan di State.timeEngine. `timeGone` format mismatch harus diresolvasi. |
| **KPI Mapping (existing fields)** | ✅ Clear | Ya — 11 field yang sudah ada memiliki mapping yang jelas |
| **KPI Mapping (new functions)** | ⚠️ Designed | Tidak — 3 fungsi baru (calculateCAOpportunity, calculateActionPlan, calculateImpact) sudah dirancang tapi belum diimplementasikan |
| **CA_Master Dependency** | ⚠️ Partial Risk | Belum sepenuhnya — Fallback behavior jika CA_Master tidak tersedia belum didefinisikan untuk domain opportunity |
| **Constants / Config** | ❌ Incomplete | Tidak — `decayRatePerDay`, `escalationThreshold`, `callsPerDay`, `deadlineTime`, `minViableRecovery` belum ada di `constants.js` |
| **Dependencies (Architecture)** | ✅ Clean | Ya — tidak ada circular dependency, aliran searah terjaga |
| **Performance** | ✅ Acceptable | Ya — estimasi overhead <30ms, tidak signifikan |
| **Testing** | ⚠️ Pending | Tidak — mock data contract v1.0.0 belum dibuat; unit tests untuk fungsi baru belum ada |
| **Section5View Readiness** | 🔴 Blocked | Tidak — Section5View tidak boleh dimulai sebelum `State.kpi.executiveDecision` terproduksi dengan benar |

---

## 10. Go / No-Go Decision

### Keputusan: **GO WITH MAJOR CHANGES**

---

### Reasoning

**Mengapa bukan NO-GO:**

Fondasi arsitektur sudah kuat. `KPIEngine.calcPerformance()` dan `KPIEngine.calcCAMonitoring()` mengandung semua data mentah yang dibutuhkan untuk domain `meta` dan `risk`. `State.timeEngine`, `TimeEngine`, dan `TrendEngine` sudah matang dan reliable. Tidak ada yang harus di-redesign atau di-refactor — hanya ada yang harus ditambahkan.

**Mengapa bukan GO atau GO WITH MINOR CHANGES:**

78% dari field data contract belum ada sebagai output KPIEngine. Tiga fungsi baru harus dibangun dari nol: `calculateCAOpportunity()`, `calculateActionPlan()`, dan `calculateImpact()`. Delapan business rule harus dikonfirmasi sebelum satu baris kode pun dapat ditulis untuk fungsi-fungsi ini. `State.kpi.executiveDecision` bahkan belum ada sebagai key di State.kpi.

**Apa yang harus diselesaikan sebelum Section5View boleh dimulai:**

**Prioritas 1 — Business Rule Confirmation (1-2 hari):**
Jawab 8 pertanyaan di Bagian 6. Tanpa ini, implementasi apapun berisiko membangun formula yang salah.

**Prioritas 2 — Constants Completion (0.5 hari):**
Tambahkan ke `constants.js`:
- `CA_ACTIVE_RATE_QUALIFIED: 0.80`
- `CA_ACTIVE_RATE_PARTIAL: 0.60`
- `DECAY_RATE_PER_DAY: 0.10`
- `CALLS_PER_DAY: 8`
- `MAX_EXPECTED_CALLS: 15`
- `ESCALATION_THRESHOLD: 70`
- `ACTION_DEADLINE_TIME: "10:00"`
- `ROLE_NSM_THRESHOLD: 5_000_000_000`
- `ROLE_AGM_THRESHOLD: 2_000_000_000`
- `ESCALATION_WINDOW_DAYS: 2`

**Prioritas 3 — calculateCAOpportunity() (5-8 hari):**
Fungsi terpenting dan paling kompleks. Semua domain `opportunity` bergantung pada ini.

**Prioritas 4 — calculateActionPlan() + calculateImpact() (3-4 hari):**
Bergantung pada output Prioritas 3.

**Prioritas 5 — calculateExecutiveDecision() assembler (1-2 hari):**
Mengemas semua output ke dalam `State.kpi.executiveDecision` dengan schema v1.0.0.

**Prioritas 6 — Mock Data Production (0.5 hari):**
Produksi mock `State.kpi.executiveDecision` yang lengkap untuk digunakan oleh tim Section5View secara paralel.

**Setelah semua prioritas di atas selesai:** Section5View implementation dapat dimulai.

---

### Timeline Estimasi

| Fase | Kegiatan | Estimasi |
|------|----------|---------|
| Fase 1 | Business Rule Confirmation + Constants Update | 1–2 HK |
| Fase 2 | calculateCAOpportunity() + Unit Tests | 5–8 HK |
| Fase 3 | calculateActionPlan() + calculateImpact() | 3–5 HK |
| Fase 4 | calculateExecutiveDecision() assembler + Integration Tests | 2–3 HK |
| Fase 5 | Mock Data Production + Contract Verification | 1 HK |
| **Total** | **KPIEngine ready untuk Section5View** | **12–19 HK** |

---

*End of Section 5 — KPI Contract Verification Report*

**Lampiran:**
- Lihat `docs/Section5_TechnicalDesignSpec.md` untuk Data Contract lengkap (Bagian 4)
- Lihat `docs/Section5_ExecutiveDecisionCenter_Spec.md` untuk formula bisnis referensi
- Lihat `business/kpiEngine.js` untuk implementasi existing yang menjadi foundation
