# Section 5 — Technical Design Specification (TDS)
## SCT v6 Executive Decision Center

**Versi:** 1.0  
**Status:** Official Blueprint — Disetujui Sebelum Implementasi Dimulai  
**Bahasa:** Indonesian (Professional)  
**Tanggal:** 2026-06-25  
**Penulis:** Lead Architect, SCT by SHP

**Dokumen Pendamping (FROZEN — tidak boleh diubah):**
- `docs/Section5_ExecutiveDecisionCenter_Spec.md` — Business Rules & KPI Logic
- `docs/Section5_UISpecification.md` — UI & Layout Developer Handoff
- `docs/SCT_v6_DesignSystem.md` — Official Design Language

---

> **Catatan Penting:** Dokumen ini bersifat technology-agnostic. Tidak ada referensi ke framework, library CSS, atau sintaks JavaScript di dalam dokumen ini. Tujuan dokumen ini adalah mengeliminasi ambiguitas arsitektur sebelum satu baris kode pun ditulis.

---

## Daftar Isi

1. Architecture Goal
2. Responsibility Matrix
3. Module Boundary
4. Data Contract
5. Rendering Pipeline
6. Internal Component Architecture
7. Public API
8. State Management
9. Error Handling Strategy
10. Performance Strategy
11. Scalability Strategy
12. Extension Points
13. Testing Strategy
14. Coding Principles
15. Final Readiness Checklist

---

## 1. Architecture Goal

### 1.1 Peran Section 5 dalam Ekosistem SCT

Section 5 — Executive Decision Center — adalah **pure presentation module**. Perannya tunggal dan tidak ambigu: **mengubah output kalkulasi KPIEngine menjadi tampilan yang dapat dibaca oleh eksekutif dalam waktu kurang dari 20 detik.**

Section 5 tidak menghitung. Section 5 tidak mengambil data. Section 5 tidak menyimpan state bisnis. Section 5 menerima sebuah data contract yang telah terkalkulasi penuh, memvalidasinya, mentransformasinya menjadi view model, lalu merender view model tersebut ke dalam DOM.

Ini adalah prinsip arsitektur terpenting dalam seluruh modul: **Section 5 adalah pembaca, bukan penulis.**

### 1.2 Masalah yang Diselesaikan oleh Modul Ini

| # | Masalah | Solusi dalam Section 5 |
|---|---------|----------------------|
| 1 | NSM membutuhkan situasi bisnis hari ini dalam <20 detik | Four-card OODA layout yang mengalir secara kausal |
| 2 | Informasi tersebar di banyak KPI tanpa urutan prioritas | Single Hero KPI per card dengan hierarki visual yang ketat |
| 3 | Tidak ada sinyal aksi yang jelas untuk field | Action card dengan role, call target, dan deadline spesifik |
| 4 | Tidak ada konsekuensi inaksi yang terukur | Impact footer dengan do-nothing vs. with-action projection |
| 5 | Data telah dikalkulasi tetapi sulit dikonsumsi | Rendering layer yang mentransformasi angka menjadi narasi eksekutif |

### 1.3 Tanggung Jawab yang TIDAK Dimiliki Section 5

Ini sama pentingnya dengan tanggung jawab yang dimiliki. Section 5 **secara eksplisit dilarang** untuk:

- Melakukan kalkulasi KPI apapun (tanggung jawab KPIEngine)
- Mengakses sheet MonitorDaily secara langsung (tanggung jawab Parser dan DataMapper)
- Memodifikasi `State.kpi` atau state bisnis manapun (hanya boleh membaca)
- Menyimpan data ke Google Drive (tanggung jawab GoogleDriveEngine)
- Mengelola filter aktif (tanggung jawab FilterPanel dan State.options)
- Mengambil keputusan bisnis atau menginterpretasi data di luar apa yang telah diberikan oleh KPIEngine
- Menampilkan data dari sheet selain apa yang diberikan melalui data contract yang telah terdefinisi
- Mengimplementasikan logika fallback kalkulasi jika KPIEngine gagal — Section 5 harus menampilkan empty/error state, bukan mencoba menghitung sendiri

---

## 2. Responsibility Matrix

### 2.1 Tabel Tanggung Jawab Komponen

| Komponen | Tanggung Jawab | TIDAK Bertanggung Jawab Atas |
|----------|----------------|------------------------------|
| **Section5View** | Menerima data contract, memvalidasi kehadiran field wajib, mentransformasi ke view model, merender empat card (Risk, Opportunity, Action, Impact), mengelola error state dan empty state, mengelola tooltip visibility, merespons event filter change | Kalkulasi bisnis apapun, akses langsung ke State.kpi.perf, pengelolaan state global, export, komunikasi dengan Google Drive |
| **KPIEngine** | Menghitung seluruh KPI bisnis dari State.filtered, menghasilkan `State.kpi.executiveDecision` sebagai output yang bersih dan tervalidasi, mengeksekusi formula sesuai spec | Rendering, formatting tampilan, pengelolaan DOM, komunikasi dengan View |
| **RenderEngine** | Menyediakan utility rendering generik (badge generator, pill generator, status dot), mengelola template rendering yang digunakan lintas section | Logika spesifik Section 5, kalkulasi bisnis, akses state langsung |
| **State** | Single source of truth untuk seluruh data aplikasi termasuk `State.kpi.executiveDecision`, `State.options` (filter aktif), `State.filtered.*` | Memicu render, melakukan kalkulasi, mengelola UI |
| **Utils / Formatter** | Menyediakan fungsi formatting murni (formatCurrency, formatPct, formatDate, formatMultiplier), menyediakan helper generik tanpa side effect | Pengetahuan tentang domain Section 5, akses state, rendering |
| **TimeEngine (timegoneEngine)** | Menghitung `hkPass`, `hkRem`, `hkTot`, `timeGone`, `D_escalate`, working day calculations | Kalkulasi revenue, CA analytics, rendering |
| **InfographicEngine** | Merender progress bar, chart sederhana, dan elemen visual bukan teks yang digunakan di dalam card | Logika bisnis untuk menentukan nilai yang ditampilkan, pengelolaan state |
| **ExportEngine** | Mengekspor tampilan Section 5 sebagai bagian dari laporan dashboard (screenshot, PDF) | Memicu render Section 5, mengubah data untuk keperluan export |
| **GoogleDriveEngine** | Mengambil file MonitorDaily.xlsx dari Google Drive, menyimpan output ke Drive | Kalkulasi, rendering, pengelolaan state view |
| **AI Engine** *(future)* | Menghasilkan narasi advisory berbasis natural language dari `State.kpi.executiveDecision`, menambah layer interpretasi di atas data contract | Mengubah data contract, melakukan kalkulasi bisnis, mengakses sheet langsung |

### 2.2 Aturan Komunikasi Antar Komponen

Komunikasi antar komponen mengikuti satu arah yang tegas:

```
[Data Source] → Parser → DataMapper → State.filtered
                                           ↓
                                       KPIEngine
                                           ↓
                                   State.kpi.executiveDecision
                                           ↓
                                      Section5View
                                           ↓
                                          DOM
```

Tidak ada komponen di bagian kanan yang boleh berkomunikasi langsung ke komponen di bagian kiri. Section5View tidak boleh memanggil KPIEngine. KPIEngine tidak boleh memanggil Parser. Aliran data selalu searah.

---

## 3. Module Boundary

### 3.1 Input

Section 5 menerima tepat satu input utama:

| Input | Tipe | Sumber | Keterangan |
|-------|------|--------|-----------|
| `executiveDecision` | Object | `State.kpi.executiveDecision` | Data contract lengkap — didefinisikan penuh di Bagian 4 |

Section 5 tidak boleh membaca dari `State.filtered.perf`, `State.filtered.arjuna`, `State.filtered.bima`, atau sheet lain secara langsung. Jika data tersebut dibutuhkan di Section 5, KPIEngine harus terlebih dahulu merangkumnya ke dalam `State.kpi.executiveDecision`.

### 3.2 Output

| Output | Tipe | Tujuan | Keterangan |
|--------|------|--------|-----------|
| DOM mutations | Side effect | Container element yang di-inject saat `init()` | Satu-satunya output yang diizinkan |
| `renderResult` | Object | Caller (App.js) | Object berisi `{success: boolean, errors: string[], renderTime: number}` |

### 3.3 Dependencies (Diizinkan)

| Dependency | Alasan |
|-----------|--------|
| `State.kpi.executiveDecision` | Sumber data utama |
| `State.options` | Membaca filter aktif untuk menampilkan label territory/brand aktif |
| `Utils.formatCurrency()` | Formatting angka ke format IDR |
| `Utils.formatPct()` | Formatting persentase |
| `Utils.formatMultiplier()` | Formatting required multiplier |
| `RenderEngine.createBadge()` | Utility generik untuk badge rendering |
| `InfographicEngine.renderProgressBar()` | Rendering progress bar temporal |
| Konstanta dari `constants.js` | Threshold klasifikasi status, ikon mapping |

### 3.4 Non-Dependencies (Dilarang)

| Komponen | Alasan Dilarang |
|---------|----------------|
| `Parser` | Raw data — bukan tanggung jawab View |
| `DataMapper` | Transformasi data mentah — bukan tanggung jawab View |
| `State.filtered.*` (semua sheet) | Data kalkulasi intermediate — View hanya boleh mengonsumsi output final |
| `State.rawData` | Raw Excel data — tidak boleh diakses oleh View |
| `KPIEngine` secara langsung | View tidak boleh memicu kalkulasi |
| `GoogleDriveEngine` | Data fetching — bukan tanggung jawab View |
| `ExportEngine` | Export dipicu dari luar Section 5 |
| `anomalyEngine` | Anomali detection — output-nya harus dimasukkan ke data contract oleh KPIEngine jika diperlukan |

### 3.5 Global Objects yang Diizinkan

| Global Object | Kegunaan yang Diizinkan |
|--------------|------------------------|
| `window.SCTHealth` | Membaca status health dashboard untuk menampilkan error state |
| `window.SCTConfig` (jika ada) | Membaca konfigurasi global (currency format, locale) |

### 3.6 Global Objects yang Dilarang

| Global Object | Alasan |
|--------------|--------|
| `window.SCTState` secara langsung | Harus melalui accessor yang terdefinisi, bukan direct property access |
| `document` secara global | Semua DOM access harus dilingkup dalam container element yang diinjeksi saat init |
| `window.fetch` / `XMLHttpRequest` | Section 5 tidak boleh melakukan network call apapun |
| `localStorage` / `sessionStorage` | Section 5 tidak boleh menyimpan state ke browser storage |
| `window.KPIEngine` secara langsung | Tidak boleh memicu kalkulasi dari dalam View |

---

## 4. Data Contract

### 4.1 Prinsip Desain Data Contract

Data contract adalah **perjanjian formal antara KPIEngine dan Section5View**. Contract ini menjamin bahwa Section5View tidak perlu mengetahui apapun tentang cara data dikalkulasi. Section5View hanya perlu tahu struktur data yang diterimanya.

Setiap perubahan pada contract ini harus disetujui bersama oleh Lead Architect dan Business Lead, karena perubahan di contract akan berdampak ke kedua sisi secara bersamaan.

### 4.2 Root Object: `State.kpi.executiveDecision`

**Purpose:** Menyediakan seluruh data yang dibutuhkan Section 5 dalam satu object terstruktur, siap dikonsumsi tanpa kalkulasi tambahan.

**Owner:** KPIEngine

**Source:** Dikalkulasi dari `State.filtered.perf`, `State.filtered.arjuna`, `State.filtered.bima`, `State.filtered.caMaster` dan waktu dari `TimeEngine`

---

### 4.3 Sub-Object: `meta`

**Purpose:** Konteks waktu dan metadata eksekusi yang digunakan untuk menampilkan label temporal dan timestamp di seluruh Section 5.

**Owner:** KPIEngine + TimeEngine

| Field | Tipe | Wajib | Deskripsi | Validasi |
|-------|------|-------|-----------|---------|
| `generatedAt` | `string` (ISO 8601) | Ya | Timestamp kalkulasi dijalankan | Format valid ISO 8601 |
| `dataDate` | `string` (YYYY-MM-DD) | Ya | Tanggal data yang sedang dianalisis | Format valid, tidak di masa depan |
| `hkPass` | `integer` | Ya | Hari kerja yang telah dilalui bulan ini | ≥0, ≤ hkTot |
| `hkRem` | `integer` | Ya | Hari kerja yang tersisa bulan ini | ≥0, ≤ hkTot |
| `hkTot` | `integer` | Ya | Total hari kerja bulan ini | >0, ≥ hkPass + hkRem |
| `timeGone` | `number` | Ya | Rasio waktu berlalu (hkPass / hkTot) | 0.0 – 1.0 |
| `activeFilters` | `object` | Tidak | Snapshot filter aktif saat kalkulasi | Bebas struktur, digunakan untuk display label saja |
| `schemaVersion` | `string` | Ya | Versi schema data contract | Semver format, e.g. "1.0.0" |

---

### 4.4 Sub-Object: `risk`

**Purpose:** Menyediakan data untuk Card 1 (Risk Headline Zone). Menjawab pertanyaan: "Di mana kita tracking hari ini?"

**Owner:** KPIEngine

| Field | Tipe | Wajib | Deskripsi | Validasi |
|-------|------|-------|-----------|---------|
| `classification` | `string` (enum) | Ya | Status akhir: `ON_TRACK`, `AT_RISK`, `CRITICAL`, `UNREACHABLE` | Harus salah satu dari empat nilai |
| `monthEndProj` | `number` | Ya | Proyeksi achievement akhir bulan (%) | 0 – 999 (pct, bukan desimal) |
| `requiredMultiplier` | `number` | Ya | Kelipatan pace yang dibutuhkan vs pace saat ini | ≥0, dua desimal |
| `impliedDailyAvg` | `number` | Ya | Revenue rata-rata aktual per hari kerja (IDR) | >0 |
| `requiredDailyAvg` | `number` | Ya | Revenue rata-rata yang dibutuhkan per hari kerja (IDR) | >0 |
| `shortfall` | `number` | Ya | Gap antara totAct dan ach_threshold (IDR, negatif jika below pace) | Bebas sign |
| `progressPct` | `number` | Ya | Achievement aktual saat ini (totAct / totTgt × 100) | 0 – 999 |
| `totAct` | `number` | Ya | Total revenue aktual bulan ini (IDR) | ≥0 |
| `totTgt` | `number` | Ya | Total target bulan ini (IDR) | >0 |
| `worstTerritory` | `object` | Tidak | Territory dengan multiplier tertinggi (paling berisiko) | Lihat sub-schema di bawah |
| `anomalyFlags` | `string[]` | Tidak | Daftar anomali yang terdeteksi (untuk tooltip) | Array string, max 5 item |

**Sub-schema `worstTerritory`:**

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `territoryName` | `string` | Ya | Nama territory |
| `requiredMultiplier` | `number` | Ya | Multiplier territory ini |
| `classification` | `string` | Ya | Klasifikasi territory ini |
| `monthEndProj` | `number` | Ya | Proyeksi territory ini |

---

### 4.5 Sub-Object: `opportunity`

**Purpose:** Menyediakan data untuk Card 2 (Opportunity Card). Menjawab pertanyaan: "Di mana revenue masih dapat dipulihkan?"

**Owner:** KPIEngine

| Field | Tipe | Wajib | Deskripsi | Validasi |
|-------|------|-------|-----------|---------|
| `totalRecoveryValue` | `number` | Ya | Total nilai recovery dari CA tidak aktif (IDR) | ≥0 |
| `totalInactiveCA` | `integer` | Ya | Jumlah outlet CA yang tidak aktif bulan ini | ≥0 |
| `caActiveRateOverall` | `number` | Ya | CA active rate agregat seluruh territory (0–1) | 0.0 – 1.0 |
| `avgTicketLM` | `number` | Ya | Rata-rata nilai transaksi CA bulan lalu (IDR) | >0 |
| `qualificationStatus` | `string` (enum) | Ya | `QUALIFIED`, `PARTIAL`, `DISQUALIFIED` | Harus salah satu dari tiga nilai |
| `qualificationReason` | `string` | Tidak | Penjelasan status kualifikasi (untuk tooltip) | Max 100 karakter |
| `qualifiedTerritories` | `TerritoryOpportunity[]` | Ya | Daftar territory yang qualify (caActiveRate ≥ 0.80) | Array, bisa kosong |
| `partialTerritories` | `TerritoryOpportunity[]` | Tidak | Territory dengan caActiveRate 0.60–0.79 | Array |
| `disqualifiedTerritories` | `TerritoryOpportunity[]` | Tidak | Territory caActiveRate <0.60 | Array |
| `decayRatePerDay` | `number` | Tidak | Estimasi penurunan recovery value per hari (0.10 default) | 0.0 – 1.0 |

**Sub-schema `TerritoryOpportunity`:**

| Field | Tipe | Wajib | Deskripsi |
|-------|------|-------|-----------|
| `territoryName` | `string` | Ya | Nama territory |
| `inactiveCA` | `integer` | Ya | Jumlah CA tidak aktif di territory ini |
| `recoveryValue` | `number` | Ya | Nilai recovery territory ini (IDR) |
| `caActiveRate` | `number` | Ya | CA active rate territory ini (0–1) |
| `caActiveRateClassification` | `string` | Ya | `EXECUTIONAL`, `PARTIAL`, `STRUCTURAL` |
| `assignedRole` | `string` | Ya | Role yang bertanggung jawab berdasarkan recovery value |

---

### 4.6 Sub-Object: `action`

**Purpose:** Menyediakan data untuk Card 3 (Action Card). Menjawab pertanyaan: "Apa yang harus dilakukan hari ini, oleh siapa, dan kapan?"

**Owner:** KPIEngine

| Field | Tipe | Wajib | Deskripsi | Validasi |
|-------|------|-------|-----------|---------|
| `callTarget` | `integer` | Ya | Jumlah outlet yang harus dihubungi hari ini | ≥0 |
| `expectedRevenueToday` | `number` | Ya | Estimasi revenue jika call target terpenuhi (IDR) | ≥0 |
| `primaryRole` | `string` | Ya | Peran utama yang bertanggung jawab | Tidak boleh generik ("Tim Sales") |
| `primaryTerritory` | `string` | Ya | Territory prioritas hari ini | Nama territory spesifik |
| `brandFocus` | `string` | Tidak | Brand/kategori yang difokuskan | Nama brand spesifik |
| `deadlineTime` | `string` | Ya | Batas waktu aksi hari ini (format HH:MM) | Format HH:MM valid |
| `deadlineDate` | `string` | Ya | Tanggal deadline dalam format D{n} kerja | Format `D{integer}` |
| `escalationCondition` | `string` | Ya | Kondisi trigger eskalasi dalam teks bisnis | Max 120 karakter |
| `escalationTriggerDay` | `integer` | Ya | Hari kerja ke-n sebagai trigger eskalasi | >hkPass, ≤hkTot |
| `escalationThreshold` | `number` | Ya | Threshold achievement (%) untuk trigger eskalasi | 0–100 |
| `escalationOwner` | `string` | Ya | Siapa yang di-escalate | Nama role spesifik |
| `urgencySignal` | `string` (enum) | Ya | `ACT_NOW`, `PROCEED`, `MONITOR` | Harus salah satu dari tiga nilai |

---

### 4.7 Sub-Object: `impact`

**Purpose:** Menyediakan data untuk Card 4 (Impact Footer). Menjawab pertanyaan: "Apa konsekuensi inaksi vs aksi?"

**Owner:** KPIEngine

| Field | Tipe | Wajib | Deskripsi | Validasi |
|-------|------|-------|-----------|---------|
| `doNothingProjection` | `number` | Ya | Proyeksi achievement akhir bulan tanpa aksi recovery (%) | 0–999 |
| `withActionProjection` | `number` | Ya | Proyeksi achievement akhir bulan jika recovery terlaksana (%) | 0–999, ≥ doNothingProjection |
| `deltaProjection` | `number` | Ya | Selisih withAction - doNothing (%) | ≥0 |
| `deltaValue` | `number` | Ya | Selisih revenue dalam IDR | ≥0 |
| `viabilityDays` | `integer` | Tidak | Estimasi berapa hari tersisa sebelum opportunity hilang | ≥0 |
| `viabilityDate` | `string` | Tidak | Tanggal absolut sebelum opportunity tidak viable | Format YYYY-MM-DD |
| `decayPerDay` | `number` | Tidak | Nilai yang hilang per hari inaksi (IDR) | ≥0 |

---

### 4.8 Complete JSON Schema Example

```json
{
  "meta": {
    "schemaVersion": "1.0.0",
    "generatedAt": "2026-06-25T07:15:00.000Z",
    "dataDate": "2026-06-25",
    "hkPass": 15,
    "hkRem": 8,
    "hkTot": 23,
    "timeGone": 0.652,
    "activeFilters": {
      "territory": "ALL",
      "brand": "ALL",
      "channel": "ALL"
    }
  },
  "risk": {
    "classification": "CRITICAL",
    "monthEndProj": 88.8,
    "requiredMultiplier": 1.72,
    "impliedDailyAvg": 4800000000,
    "requiredDailyAvg": 8256000000,
    "shortfall": -80800000000,
    "progressPct": 65.3,
    "totAct": 720000000000,
    "totTgt": 1102400000000,
    "worstTerritory": {
      "territoryName": "Jabar 2",
      "requiredMultiplier": 2.14,
      "classification": "UNREACHABLE",
      "monthEndProj": 79.2
    },
    "anomalyFlags": []
  },
  "opportunity": {
    "totalRecoveryValue": 3600000000,
    "totalInactiveCA": 47,
    "caActiveRateOverall": 0.83,
    "avgTicketLM": 76595745,
    "qualificationStatus": "QUALIFIED",
    "qualificationReason": "CA active rate 83% — peluang recovery nyata, bukan struktural.",
    "decayRatePerDay": 0.10,
    "qualifiedTerritories": [
      {
        "territoryName": "Jabar 2",
        "inactiveCA": 28,
        "recoveryValue": 2144680000,
        "caActiveRate": 0.84,
        "caActiveRateClassification": "EXECUTIONAL",
        "assignedRole": "AGM Jabar"
      },
      {
        "territoryName": "Depo Bandung",
        "inactiveCA": 19,
        "recoveryValue": 1455319000,
        "caActiveRate": 0.81,
        "caActiveRateClassification": "EXECUTIONAL",
        "assignedRole": "Supervisor Bandung"
      }
    ],
    "partialTerritories": [],
    "disqualifiedTerritories": []
  },
  "action": {
    "callTarget": 47,
    "expectedRevenueToday": 1148936000,
    "primaryRole": "AGM Jabar",
    "primaryTerritory": "Jabar 2",
    "brandFocus": "GPPJ Biscuit (Arjuna class)",
    "deadlineTime": "10:00",
    "deadlineDate": "D16",
    "escalationCondition": "Jika D17 achievement <70% dari target → eskalasi ke NSM",
    "escalationTriggerDay": 17,
    "escalationThreshold": 70,
    "escalationOwner": "NSM",
    "urgencySignal": "ACT_NOW"
  },
  "impact": {
    "doNothingProjection": 88.8,
    "withActionProjection": 89.3,
    "deltaProjection": 0.5,
    "deltaValue": 3600000000,
    "viabilityDays": 3,
    "viabilityDate": "2026-06-28",
    "decayPerDay": 360000000
  }
}
```

---

### 4.9 Aturan Immutability Contract

1. Section5View **dilarang keras** memodifikasi object `executiveDecision` yang diterimanya.
2. Semua transformasi untuk tampilan harus dilakukan ke object baru (view model) yang dibuat oleh Section5View sendiri.
3. KPIEngine adalah satu-satunya pihak yang boleh menulis ke `State.kpi.executiveDecision`.
4. Jika Section5View membutuhkan data yang belum ada di contract, solusinya adalah menambahkan field ke contract dan meminta KPIEngine menyediakannya — bukan mengakses sumber data lain secara langsung.

---

## 5. Rendering Pipeline

Section 5 mengeksekusi rendering melalui enam tahap yang berurutan dan tidak boleh dilewati:

```
[1] DATA READY
      ↓
[2] VALIDATION
      ↓
[3] TRANSFORMATION
      ↓
[4] VIEW MODEL
      ↓
[5] RENDERER
      ↓
[6] DOM
```

### 5.1 Stage 1: DATA READY

**Tanggung Jawab:** Memastikan bahwa `State.kpi.executiveDecision` tersedia dan bukan `null`, `undefined`, atau object kosong sebelum pipeline dilanjutkan.

**Trigger:** Dipanggil oleh `App.js` setelah `KPIEngine.runAll()` berhasil selesai.

**Output ke Stage berikutnya:** Object `executiveDecision` mentah dari State.

**Jika gagal:** Pipeline dihentikan. `renderErrorState('DATA_NOT_READY')` dipanggil.

**Catatan:** Stage ini tidak melakukan validasi struktur — hanya memverifikasi kehadiran root object.

---

### 5.2 Stage 2: VALIDATION

**Tanggung Jawab:** Memvalidasi bahwa semua field wajib hadir dan memiliki tipe data yang benar. Memvalidasi nilai terhadap aturan yang didefinisikan di Data Contract (Bagian 4).

**Input:** Object `executiveDecision` mentah.

**Proses:**
- Validasi schema version — jika tidak cocok, log warning tapi lanjutkan
- Validasi kehadiran semua field wajib di `meta`, `risk`, `opportunity`, `action`, `impact`
- Validasi tipe data setiap field
- Validasi range nilai (contoh: `caActiveRate` harus 0–1, bukan negatif)
- Validasi enum values (`classification`, `qualificationStatus`, `urgencySignal`)
- Kumpulkan semua error dalam array `validationErrors`

**Output ke Stage berikutnya:** Object `{isValid: boolean, errors: ValidationError[], data: executiveDecision}`.

**Jika ada error kritikal (field wajib tidak hadir):** Pipeline dihentikan. `renderErrorState('VALIDATION_FAILED', errors)` dipanggil.

**Jika ada error non-kritikal (field opsional format salah):** Pipeline dilanjutkan dengan field tersebut diset ke nilai default yang aman. Error dicatat di log.

---

### 5.3 Stage 3: TRANSFORMATION

**Tanggung Jawab:** Mengubah data bisnis menjadi data yang siap ditampilkan. Stage ini tidak menambah atau mengubah makna bisnis — hanya mengubah representasi untuk keperluan tampilan.

**Input:** Object `executiveDecision` yang telah tervalidasi.

**Proses:**
- Memanggil `Utils.formatCurrency()` untuk semua nilai IDR
- Memanggil `Utils.formatPct()` untuk semua nilai persentase
- Memanggil `Utils.formatMultiplier()` untuk `requiredMultiplier`
- Menentukan status color token berdasarkan `classification` enum (mapping dari konstanta)
- Menentukan badge type string berdasarkan `classification`
- Membangun narrative string untuk setiap card berdasarkan template
- Mengubah `urgencySignal` enum menjadi display label (`ACT_NOW` → `"SEGERA BERTINDAK"`)
- Membangun `tooltipContent` untuk setiap elemen yang memiliki tooltip
- Menghitung `progressBarWidth` (persentase untuk CSS width) dari `hkPass / hkTot`
- Menentukan posisi tick mark pada progress bar

**Output ke Stage berikutnya:** Object `viewModel` yang berisi semua nilai dalam format siap tampil.

**Prinsip kritis:** Transformation **tidak boleh melakukan kalkulasi bisnis**. Jika untuk menghasilkan suatu tampilan diperlukan kalkulasi baru, kalkulasi tersebut harus ditambahkan ke KPIEngine dan hasilnya ditambahkan ke data contract.

---

### 5.4 Stage 4: VIEW MODEL

**Tanggung Jawab:** Mendefinisikan struktur object view model yang dihasilkan oleh Stage 3 dan dikonsumsi oleh Stage 5.

View Model bukan data bisnis. View Model adalah representasi tampilan. Contoh perbedaannya:

| Data Contract | View Model |
|--------------|-----------|
| `monthEndProj: 88.8` | `riskHeroDisplay: "88.8%"` |
| `classification: "CRITICAL"` | `badgeType: "CRITICAL"`, `badgeLabel: "CRITICAL"`, `heroColor: "#A32D2D"` |
| `totalRecoveryValue: 3600000000` | `opportunityHeroDisplay: "Rp 3,6 M"` |
| `urgencySignal: "ACT_NOW"` | `urgencyLabel: "SEGERA BERTINDAK"`, `urgencyBadgeType: "ACT_NOW"` |

View Model terdiri dari empat sub-object yang memetakan persis ke empat card:

- `viewModel.risk` — semua nilai display untuk Risk card
- `viewModel.opportunity` — semua nilai display untuk Opportunity card
- `viewModel.action` — semua nilai display untuk Action card
- `viewModel.impact` — semua nilai display untuk Impact footer
- `viewModel.meta` — timestamp, filter label, schema version untuk display

---

### 5.5 Stage 5: RENDERER

**Tanggung Jawab:** Mengubah view model menjadi struktur DOM. Stage ini adalah satu-satunya stage yang bersentuhan dengan DOM.

**Input:** Object `viewModel` dari Stage 4.

**Proses:**
- Panggil `renderRisk(viewModel.risk)` → hasilkan DOM fragment untuk Risk zone
- Panggil `renderOpportunity(viewModel.opportunity)` → hasilkan DOM fragment untuk Opportunity card
- Panggil `renderAction(viewModel.action)` → hasilkan DOM fragment untuk Action card
- Panggil `renderImpact(viewModel.impact)` → hasilkan DOM fragment untuk Impact footer
- Panggil `renderHeader(viewModel.meta)` → hasilkan section header
- Susun semua fragment ke dalam container

**Prinsip:** Setiap fungsi render menghasilkan DOM fragment yang independen. Tidak ada fungsi render yang memodifikasi output fungsi render lain.

---

### 5.6 Stage 6: DOM

**Tanggung Jawab:** Menulis output Renderer ke dalam DOM yang sebenarnya, menggantikan konten lama.

**Strategi:** Gunakan replace-all strategy — seluruh konten container Section 5 diganti setiap kali `render()` dipanggil. Tidak menggunakan partial DOM update kecuali untuk tooltip visibility.

**Alasan replace-all:** Section 5 berisi empat card yang saling terkait secara kausal. Partial update berisiko menampilkan kombinasi data dari dua state berbeda, yang lebih berbahaya daripada biaya replace-all.

**Pasca render:**
- Pasang event listener untuk tooltip hover
- Pasang event listener untuk hover border card
- Jalankan count-up animation pada Risk hero KPI
- Jalankan badge pulse jika `classification === 'CRITICAL'`
- Catat render timestamp untuk performa monitoring

---

## 6. Internal Component Architecture

Setiap fungsi render di dalam Section5View harus mengikuti kontrak interface yang seragam:

```
render{Name}(viewModelSlice) → DocumentFragment
```

Tidak ada fungsi render yang boleh:
- Memodifikasi DOM secara langsung tanpa menggunakan container yang diberi ke `init()`
- Mengakses state global secara langsung
- Melakukan kalkulasi bisnis apapun
- Memanggil fungsi render lain secara rekursif

---

### 6.1 `renderRisk(riskViewModel)`

**Purpose:** Menghasilkan Risk Headline Zone — full-width zone dengan classification badge, Hero KPI (bulan-akhir proyeksi), supporting rows, dan progress bar temporal.

**Inputs:**
- `riskViewModel.badgeType` — enum string untuk badge variant
- `riskViewModel.heroDisplay` — string proyeksi akhir bulan yang sudah diformat
- `riskViewModel.heroColor` — token warna untuk Hero KPI (dari mapping konstanta)
- `riskViewModel.multiplierDisplay` — string required multiplier yang diformat
- `riskViewModel.shortfallDisplay` — string shortfall yang diformat
- `riskViewModel.progressBarWidth` — number 0–100 untuk CSS width progress bar
- `riskViewModel.progressTickPosition` — number 0–100 untuk posisi tick mark
- `riskViewModel.worstTerritoryDisplay` — string nama + multiplier territory terburuk
- `riskViewModel.narrativeLabel` — teks narasi singkat untuk sub-label hero
- `riskViewModel.tooltipContents` — object berisi konten tooltip per elemen

**Outputs:** `DocumentFragment` berisi struktur Risk zone lengkap.

**Side effects:** Tidak ada. Fragment hanya dikembalikan, belum di-attach ke DOM.

---

### 6.2 `renderOpportunity(opportunityViewModel)`

**Purpose:** Menghasilkan Opportunity Card — analysis register, dengan Hero KPI recovery value, CA active rate, daftar territory qualifier, dan qualification status pill.

**Inputs:**
- `opportunityViewModel.heroDisplay` — string total recovery value yang diformat
- `opportunityViewModel.inactiveCADisplay` — string jumlah CA tidak aktif
- `opportunityViewModel.caActiveRateDisplay` — string CA active rate yang diformat
- `opportunityViewModel.qualificationPillType` — enum untuk pill variant
- `opportunityViewModel.qualificationLabel` — teks label kualifikasi
- `opportunityViewModel.territories` — array view objects territory yang qualified
- `opportunityViewModel.decayWarning` — teks warning decay (opsional)
- `opportunityViewModel.tooltipContents` — object tooltip

**Outputs:** `DocumentFragment` berisi struktur Opportunity card.

**Side effects:** Tidak ada.

---

### 6.3 `renderAction(actionViewModel)`

**Purpose:** Menghasilkan Action Card — imperative register, dengan call target, expected revenue, role assignment, deadline, dan escalation condition.

**Inputs:**
- `actionViewModel.urgencyBadgeType` — enum untuk urgency badge variant
- `actionViewModel.urgencyLabel` — display label urgency signal
- `actionViewModel.callTargetDisplay` — string call target yang diformat
- `actionViewModel.revenueDisplay` — string expected revenue yang diformat
- `actionViewModel.roleDisplay` — string nama role + territory
- `actionViewModel.brandDisplay` — string brand focus (opsional)
- `actionViewModel.deadlineDisplay` — string formatted deadline
- `actionViewModel.escalationDisplay` — string kondisi eskalasi yang diformat
- `actionViewModel.dividerPosition` — boolean, apakah divider ditampilkan
- `actionViewModel.tooltipContents` — object tooltip

**Outputs:** `DocumentFragment` berisi struktur Action card.

**Side effects:** Tidak ada.

---

### 6.4 `renderImpact(impactViewModel)`

**Purpose:** Menghasilkan Impact Footer — consequence register dengan dark background, menampilkan do-nothing vs. with-action projection berdampingan.

**Inputs:**
- `impactViewModel.doNothingDisplay` — string proyeksi do-nothing yang diformat
- `impactViewModel.withActionDisplay` — string proyeksi with-action yang diformat
- `impactViewModel.deltaDisplay` — string delta nilai yang diformat
- `impactViewModel.doNothingColor` — token warna untuk angka do-nothing (on dark)
- `impactViewModel.withActionColor` — token warna untuk angka with-action (on dark)
- `impactViewModel.viabilityWarning` — teks warning viability (opsional)
- `impactViewModel.tooltipContents` — object tooltip

**Outputs:** `DocumentFragment` berisi struktur Impact footer.

**Side effects:** Tidak ada.

---

### 6.5 `renderHeader(metaViewModel)`

**Purpose:** Menghasilkan section header — judul section, label filter aktif, timestamp data.

**Inputs:**
- `metaViewModel.sectionTitle` — string judul section
- `metaViewModel.timestampDisplay` — string timestamp yang diformat
- `metaViewModel.filterLabel` — string label filter aktif
- `metaViewModel.dayProgress` — string label D{n} dari D{total}

**Outputs:** `DocumentFragment` berisi header section.

**Side effects:** Tidak ada.

---

### 6.6 `renderBadge(type, label)`

**Purpose:** Menghasilkan element badge berdasarkan type enum. Fungsi generik — dapat dipanggil oleh renderRisk, renderOpportunity, atau renderAction.

**Inputs:**
- `type` — `string` enum: `CRITICAL`, `AT_RISK`, `ON_TRACK`, `ACT_NOW`
- `label` — `string` teks yang ditampilkan di dalam badge

**Outputs:** `Element` — badge element tunggal.

**Side effects:** Tidak ada. Harus murni (pure function).

---

### 6.7 `renderPill(type, label)`

**Purpose:** Menghasilkan element pill berdasarkan type enum.

**Inputs:**
- `type` — `string` enum: `EXECUTIONAL`, `PARTIAL`, `STRUCTURAL`, `INACTIVE_CA`, `PACE_DEFICIT`
- `label` — `string` teks yang ditampilkan

**Outputs:** `Element` — pill element tunggal.

**Side effects:** Tidak ada.

---

### 6.8 `renderProgressBar(widthPct, tickPct, fillColorToken)`

**Purpose:** Menghasilkan progress bar temporal untuk Risk zone.

**Inputs:**
- `widthPct` — `number` 0–100, lebar fill bar
- `tickPct` — `number` 0–100, posisi tick mark
- `fillColorToken` — `string` CSS variable name untuk fill color

**Outputs:** `Element` — progress bar container dengan fill dan tick.

**Side effects:** Tidak ada.

---

### 6.9 `renderTooltip(targetElement, content)`

**Purpose:** Pasang tooltip behavior ke elemen target. Mengelola show/hide tooltip berdasarkan hover event.

**Inputs:**
- `targetElement` — `Element` elemen yang dihover untuk trigger tooltip
- `content` — `string` teks konten tooltip (sudah diformat, bukan data mentah)

**Outputs:** Tidak ada (void).

**Side effects:** Menambahkan event listener ke `targetElement`. Ini adalah satu-satunya fungsi di Section 5 yang boleh menambahkan event listener.

---

### 6.10 `renderEmptyState(reason)`

**Purpose:** Menampilkan state kosong yang informatif jika data tidak tersedia namun bukan karena error.

**Inputs:**
- `reason` — `string` enum: `NO_DATA`, `FILTER_MISMATCH`, `INSUFFICIENT_HISTORY`

**Outputs:** `DocumentFragment` berisi empty state message sesuai reason.

**Side effects:** Tidak ada.

---

### 6.11 `renderErrorState(errorCode, errors)`

**Purpose:** Menampilkan error state yang tidak merusak dashboard. Harus tidak panik — tampilkan pesan yang membantu tanpa membocorkan detail teknis ke user.

**Inputs:**
- `errorCode` — `string` enum kode error
- `errors` — `ValidationError[]` daftar detail error (digunakan untuk logging, bukan ditampilkan ke user)

**Outputs:** `DocumentFragment` berisi error message yang ramah user.

**Side effects:** Menulis detail error ke `console.error` dengan prefix yang konsisten. Menulis ke `window.SCTHealth.errors` jika tersedia.

---

### 6.12 `renderStatusDot(caActiveRateClassification)`

**Purpose:** Menghasilkan status dot 8px untuk item dalam daftar territory opportunity.

**Inputs:**
- `caActiveRateClassification` — `string` enum: `EXECUTIONAL`, `PARTIAL`, `STRUCTURAL`

**Outputs:** `Element` — dot element dengan warna yang sesuai.

**Side effects:** Tidak ada.

---

## 7. Public API

Public API adalah kontrak antara Section5View dan App.js (atau modul manapun yang mengorkestrasikan Section 5).

---

### 7.1 `Section5View.init(container, options)`

**Purpose:** Inisialisasi Section 5 ke dalam container DOM yang ditentukan. Harus dipanggil sekali sebelum `render()` pertama kali.

**Arguments:**
- `container` — `Element` — DOM element yang akan menjadi host Section 5
- `options` — `object` (opsional) — konfigurasi opsional:
  - `options.animateOnMount` — `boolean` default `true` — apakah count-up animation aktif
  - `options.locale` — `string` default `'id-ID'` — locale untuk formatting angka

**Return value:** `{success: boolean, error?: string}`

**Kapan dipanggil:** Satu kali, setelah DOM siap dan sebelum data tersedia. Dapat dipanggil sebelum KPIEngine selesai — akan menampilkan loading state.

**Kapan TIDAK dipanggil:** Lebih dari satu kali tanpa memanggil `destroy()` terlebih dahulu. Tidak boleh dipanggil ulang setelah filter berubah — `onFilterChange()` yang digunakan untuk itu.

---

### 7.2 `Section5View.render(executiveDecision)`

**Purpose:** Menjalankan pipeline rendering lengkap (Validation → Transformation → View Model → DOM) dengan data yang diberikan.

**Arguments:**
- `executiveDecision` — `object` — data contract sesuai schema di Bagian 4

**Return value:** `{success: boolean, errors: string[], renderTime: number}`

**Kapan dipanggil:** Setiap kali `KPIEngine.runAll()` menghasilkan data baru. Dipanggil oleh App.js, bukan oleh modul lain.

**Kapan TIDAK dipanggil:** Secara langsung dari dalam KPIEngine. Dari dalam event handler UI. Sebelum `init()` dipanggil.

---

### 7.3 `Section5View.refresh()`

**Purpose:** Re-render Section 5 menggunakan data yang sudah ada di `State.kpi.executiveDecision` tanpa memerlukan argumen baru.

**Arguments:** Tidak ada.

**Return value:** `{success: boolean, errors: string[], renderTime: number}`

**Kapan dipanggil:** Setelah Google Drive refresh selesai dan KPIEngine telah memperbarui `State.kpi.executiveDecision`. Juga dipanggil oleh ExportEngine sesaat sebelum screenshot untuk memastikan state terkini.

**Kapan TIDAK dipanggil:** Jika `State.kpi.executiveDecision` adalah `null` atau undefined. Saat data sedang dalam proses kalkulasi (race condition harus dihindari dengan flag di App.js).

---

### 7.4 `Section5View.onFilterChange(filterState)`

**Purpose:** Memberitahu Section 5 bahwa filter telah berubah. Section 5 tidak memproses perubahan filter sendiri — ia hanya menampilkan data baru yang dirender setelah KPIEngine selesai menghitung ulang.

**Arguments:**
- `filterState` — `object` — snapshot filter aktif yang baru

**Return value:** Tidak ada (void).

**Kapan dipanggil:** Oleh FilterPanel atau App.js, segera setelah user mengubah filter dan KPIEngine telah selesai menghitung ulang.

**Kapan TIDAK dipanggil:** Sebelum KPIEngine selesai kalkulasi ulang dengan filter baru. Memanggil ini sebelum kalkulasi selesai akan menyebabkan Section 5 menampilkan data lama dengan label filter baru.

---

### 7.5 `Section5View.clear()`

**Purpose:** Menghapus seluruh konten Section 5 dan menampilkan loading state.

**Arguments:** Tidak ada.

**Return value:** Tidak ada (void).

**Kapan dipanggil:** Saat file baru sedang di-upload. Saat Google Drive refresh sedang berlangsung (sebelum data baru tersedia). Saat user mengganti file sumber.

**Kapan TIDAK dipanggil:** Saat hanya filter yang berubah — dalam kasus ini, tampilkan loading indicator minimal, bukan clear penuh.

---

### 7.6 `Section5View.destroy()`

**Purpose:** Membersihkan seluruh state internal Section 5, melepas semua event listener, dan mengosongkan container.

**Arguments:** Tidak ada.

**Return value:** Tidak ada (void).

**Kapan dipanggil:** Saat Section 5 perlu di-reinisialisasi dengan container berbeda. Saat komponen induk di-unmount (relevan untuk future React migration).

**Kapan TIDAK dipanggil:** Saat hanya data yang berubah — `render()` atau `refresh()` sudah cukup.

---

### 7.7 `Section5View.getLastRenderResult()`

**Purpose:** Mengembalikan hasil render terakhir untuk keperluan monitoring dan debugging.

**Arguments:** Tidak ada.

**Return value:** `{success: boolean, errors: string[], renderTime: number, timestamp: string} | null`

**Kapan dipanggil:** Oleh `App.validateDataQuality()` atau `window.SCTHealth` monitor untuk melaporkan status Section 5. Dapat dipanggil kapan saja setelah `init()`.

---

## 8. State Management

### 8.1 Data yang Di-Cache oleh Section5View

Section 5 menyimpan cache minimal — hanya apa yang diperlukan untuk operasi yang efisien:

| Item | Alasan Di-Cache | TTL |
|------|----------------|-----|
| DOM container reference | Menghindari query DOM berulang | Sepanjang lifecycle |
| Opsi inisialisasi (`locale`, `animateOnMount`) | Tidak berubah setelah `init()` | Sepanjang lifecycle |
| Hasil render terakhir (`lastRenderResult`) | Dibutuhkan oleh `getLastRenderResult()` | Diganti setiap `render()` |
| Tooltip element references | Efisiensi event binding | Diganti setiap `render()` |

**Section5View tidak menyimpan cache** untuk data bisnis, view model, atau apapun yang berasal dari `executiveDecision`. Setiap panggilan `render()` memproses data dari awal.

### 8.2 Data yang Selalu Dikalkulasi Ulang

| Item | Alasan |
|------|--------|
| View model seluruhnya | Data bisnis dapat berubah kapan saja; stale view model lebih berbahaya dari biaya re-transform |
| Badge types | Tergantung pada data contract yang mungkin berubah |
| Formatted display strings | Locale atau konfigurasi format bisa berbeda per render |
| Tooltip contents | Tergantung data yang mungkin berubah |

### 8.3 Data yang Tidak Boleh Dimutasi

| Data | Alasan |
|------|--------|
| `executiveDecision` object yang diterima | Immutable — milik KPIEngine. Mutasi akan menyebabkan inkonsistensi dengan State |
| `State.kpi.*` | Section5View adalah reader, bukan writer |
| `State.options` | Filter state — dikelola oleh FilterPanel |
| Konstanta dari `constants.js` | Global constants — tidak boleh di-override per render |

Implementasi harus memastikan bahwa Transformation stage membuat **deep copy** atau membangun object baru sepenuhnya, bukan memodifikasi input.

### 8.4 Strategi Refresh

**Skenario 1: Data biasa berubah (KPI Engine selesai kalkulasi)**
```
App.js → KPIEngine.runAll() → State.kpi.executiveDecision updated → App.js → Section5View.render(State.kpi.executiveDecision)
```
Section5View menerima data baru dan menjalankan pipeline penuh.

**Skenario 2: Filter berubah**
```
User → FilterPanel → State.options updated → App.js → KPIEngine.runAll() (dengan filter baru) → State.kpi.executiveDecision updated → App.js → Section5View.render(State.kpi.executiveDecision)
```
Section5View tidak merespons perubahan filter secara langsung. Ia hanya menerima hasil kalkulasi ulang.

**Skenario 3: Google Drive refresh**
```
User → DriveRefreshButton → Section5View.clear() → GoogleDriveEngine.refresh() → Parser → DataMapper → State.filtered updated → KPIEngine.runAll() → State.kpi.executiveDecision updated → App.js → Section5View.render(...)
```
`clear()` dipanggil segera untuk memberikan feedback visual. `render()` baru dipanggil setelah seluruh pipeline upstream selesai.

**Skenario 4: Export**
```
ExportEngine → Section5View.refresh() → [screenshot] → ExportEngine continues
```
ExportEngine memicu `refresh()` untuk memastikan state terkini sebelum screenshot.

### 8.5 Race Condition Prevention

App.js wajib mengimplementasikan flag `isCalculating: boolean`. Selama flag ini `true`, App.js tidak boleh memanggil `Section5View.render()`. Section5View tidak bertanggung jawab untuk mendeteksi atau mencegah race condition ini — itu adalah tanggung jawab App.js sebagai orkestrator.

---

## 9. Error Handling Strategy

Prinsip utama: **Section 5 tidak boleh membuat seluruh dashboard crash.** Setiap error harus ditangani secara lokal, terisolasi di dalam Section 5, dan dicatat tanpa memblokir render section lain.

### 9.1 Missing Hero KPI (Field Wajib Null)

**Contoh:** `risk.monthEndProj` adalah `null` atau `undefined`.

**Penanganan:**
- Validation stage mendeteksi missing field wajib
- Klasifikasikan sebagai `CRITICAL_VALIDATION_ERROR`
- Hentikan pipeline untuk section terdampak
- Tampilkan `renderErrorState('MISSING_CRITICAL_KPI', [{field: 'risk.monthEndProj'}])`
- Tampilkan pesan user-friendly: *"Data proyeksi tidak tersedia. Coba muat ulang file."*
- Log detail teknis ke console dan SCTHealth
- Section lain tidak terdampak

**Tidak boleh dilakukan:** Menampilkan angka 0 atau placeholder sebagai KPI. Angka 0% sebagai proyeksi akhir bulan adalah data yang menyesatkan.

### 9.2 Missing Territory Data

**Contoh:** `opportunity.qualifiedTerritories` adalah array kosong meskipun `totalInactiveCA > 0`.

**Penanganan:**
- Klasifikasikan sebagai non-kritikal — data tidak konsisten tapi tidak fatal
- Tampilkan card Opportunity dengan warning: *"Detail territory tidak tersedia"*
- Tetap tampilkan `totalRecoveryValue` dan `totalInactiveCA` di hero
- Log warning ke SCTHealth
- Lanjutkan render card lain secara normal

### 9.3 Division by Zero dalam Formatting

**Contoh:** `requiredDailyAvg / impliedDailyAvg` menghasilkan Infinity atau NaN saat sudah diterima dari KPIEngine.

**Penanganan:**
- KPIEngine seharusnya sudah menangani ini sebelum mengisi contract
- Jika tetap terjadi: Validation stage mendeteksi nilai `Infinity` atau `NaN`
- Klasifikasikan sebagai non-kritikal jika field opsional, kritikal jika field wajib
- Jika opsional: tampilkan `"—"` sebagai nilai (en dash, bukan kosong)
- Jika wajib: ikuti prosedur Missing Hero KPI
- Catat incident ke SCTHealth dengan detail field yang bermasalah

### 9.4 Missing MonitorDaily Sheet

**Contoh:** KPIEngine tidak dapat menghasilkan `executiveDecision` karena sheet CA_Master tidak tersedia.

**Penanganan:**
- KPIEngine mengembalikan `State.kpi.executiveDecision = null`
- `Section5View.render(null)` dipanggil
- Validation stage mendeteksi null input pada Stage 1 (Data Ready)
- Tampilkan `renderEmptyState('NO_DATA')` dengan pesan: *"Data belum tersedia. Pastikan file MonitorDaily.xlsx dimuat dengan benar."*
- Tampilkan daftar sheet yang dibutuhkan (dari konstanta) untuk membantu debugging user

### 9.5 Empty Principle (No Applicable Data for Current Filter)

**Contoh:** Filter aktif menghasilkan territory set kosong — tidak ada data yang relevan.

**Penanganan:**
- KPIEngine mengisi contract dengan nilai `0` atau array kosong yang valid secara schema
- Validation stage lolos karena contract valid
- Section5View mendeteksi kondisi empty melalui field `totalInactiveCA === 0 && totAct === 0`
- Tampilkan `renderEmptyState('FILTER_MISMATCH')` dengan pesan: *"Tidak ada data untuk filter yang dipilih. Coba ubah pilihan territory atau brand."*
- Jangan tampilkan card dengan nilai 0% sebagai proyeksi — ini menyesatkan

### 9.6 Corrupted Data (Invalid Enum Values)

**Contoh:** `risk.classification` berisi string `"KRITIS"` (bukan enum yang valid).

**Penanganan:**
- Validation stage mendeteksi invalid enum
- Map ke nilai default yang aman: invalid classification → `"AT_RISK"` (lebih konservatif dari `ON_TRACK`)
- Log warning dengan detail: *"Invalid enum value untuk field 'risk.classification': 'KRITIS'. Menggunakan default 'AT_RISK'."*
- Render dilanjutkan dengan nilai default
- Tambahkan visual indicator subtle (tidak alarming) bahwa ada data anomali

### 9.7 Schema Version Mismatch

**Contoh:** `meta.schemaVersion` adalah `"0.9.0"` sedangkan Section5View mengharapkan `"1.0.0"`.

**Penanganan:**
- Log warning: *"Schema version mismatch. Expected 1.0.0, got 0.9.0."*
- Tetap lanjutkan rendering — backward compatibility diutamakan
- Jika major version berbeda (0.x vs 1.x): tampilkan banner warning kecil di header section
- Developer harus memperbarui KPIEngine atau Section5View agar versi selaras

### 9.8 Render Timeout

**Contoh:** Rendering memakan waktu lebih dari 500ms (threshold performance budget).

**Penanganan:**
- Setelah rendering selesai, bandingkan `renderTime` dengan threshold
- Jika melebihi: log performance warning ke SCTHealth
- Tidak ada UI yang ditampilkan kepada user — ini murni monitoring
- Trigger alert di SCTHealth `performanceWarnings` array

---

## 10. Performance Strategy

### 10.1 Target Performa

| Metric | Target | Maximum |
|--------|--------|---------|
| Waktu render lengkap (Validation → DOM) | <100ms | 200ms |
| Waktu transformasi (Stage 3) | <20ms | 50ms |
| DOM replacement time | <50ms | 100ms |
| Waktu pasca-render (event binding, animation trigger) | <30ms | 80ms |
| Total user-perceived latency dari data ready ke visible | <150ms | 300ms |

### 10.2 Hindari Rendering yang Tidak Diperlukan

Section5View mengimplementasikan **shallow equality check** sebelum menjalankan pipeline penuh:

- Simpan hash atau timestamp dari `executiveDecision` terakhir yang di-render
- Jika `render()` dipanggil dengan data yang identik (sama `generatedAt`), lewati pipeline dan return `lastRenderResult` langsung
- Ini mencegah re-render yang tidak perlu saat App.js memanggil `render()` secara defensif

### 10.3 Hindari Kalkulasi yang Tidak Diperlukan

Transformation stage hanya memformat data yang benar-benar akan ditampilkan di current filter state. Jika territory list lebih dari N item dan hanya M yang ditampilkan (karena display limit), hanya M territory yang perlu diformat.

### 10.4 Memoization Opportunities

| Kandidat Memoization | Kondisi |
|---------------------|---------|
| Currency formatter object | Dibuat sekali saat `init()`, di-reuse setiap render |
| Percent formatter object | Sama — formatter object adalah expensive to construct |
| Badge element templates | Template dasar (tanpa label) dapat di-clone, bukan dibuat dari scratch |
| Icon SVG strings | Dibaca dari konstanta sekali, tidak perlu re-fetch |

**Yang tidak boleh di-memoize:** View model atau formatted strings — karena data dapat berubah kapan saja.

### 10.5 DOM Update Strategy

**Replace-all, bukan partial update.** Alasan:
1. Section 5 hanya dirender ulang saat data bisnis berubah — bukan pada setiap interaksi user
2. Empat card adalah unit kausal yang tidak dapat dipisahkan — partial update berisiko inkonsistensi
3. Biaya replace-all pada elemen sekecil Section 5 (<20 DOM nodes) tidak signifikan
4. Partial update menambah kompleksitas yang tidak sebanding dengan manfaat untuk use case ini

**Pengecualian:** Tooltip show/hide tidak melakukan DOM replacement — hanya toggle visibility class.

### 10.6 Animation Performance

Count-up animation menggunakan `requestAnimationFrame` bukan `setInterval`. Ini memastikan animasi berjalan sesuai refresh rate display dan tidak memblokir main thread. Animation hanya dipasang setelah DOM tersedia (pasca replace) dan hanya jika `options.animateOnMount === true`.

---

## 11. Scalability Strategy

Section 5 harus mampu menerima fitur-fitur berikut tanpa perlu refactoring arsitektur:

### 11.1 AI Action Engine

**Skenario:** Di masa depan, AI Engine menghasilkan narasi advisory berbasis natural language (contoh: "Berdasarkan pola bulan lalu, risiko tertinggi adalah di Jabar 2 karena pola aktivasi CA-nya turun pada H+10 setiap bulan...").

**Strategi skalabilitas:**
- AI Engine menghasilkan output dalam format field tambahan di data contract: `executiveDecision.aiAdvisory`
- Section5View memeriksa kehadiran field ini dan jika ada, memanggil fungsi render baru `renderAIAdvisory(aiAdvisoryViewModel)` yang menghasilkan fragment tambahan
- Tidak ada perubahan pada empat card yang sudah ada
- Field `aiAdvisory` bersifat opsional — jika tidak ada, Section 5 tetap berfungsi normal

### 11.2 Executive Morning Briefing

**Skenario:** Section baru yang menampilkan narasi ringkas dalam format paragraf, bukan card — cocok untuk print atau email.

**Strategi skalabilitas:**
- Briefing engine mengonsumsi `State.kpi.executiveDecision` yang sama
- Briefing adalah section terpisah — bukan bagian dari Section5View
- Section5View tidak perlu berubah sama sekali
- Data contract yang sama sudah mengandung semua informasi yang dibutuhkan briefing

### 11.3 Territory Opportunity Engine

**Skenario:** Drill-down lebih dalam ke setiap territory dengan ranking opportunity, historis aktivasi, dan prediksi.

**Strategi skalabilitas:**
- Territory Opportunity Engine membutuhkan data yang lebih granular dari `qualifiedTerritories`
- Solusi: tambahkan field `territories.detail[]` di contract — KPIEngine menyediakan, Section 5 menggunakannya di `renderOpportunity()`
- Atau: Section5View memancarkan event `section5:territoryClicked(territoryName)` yang ditangkap oleh Territory Opportunity Engine di section terpisah
- Tidak ada kalkulasi territory yang pindah ke Section5View

### 11.4 FMCG Copilot

**Skenario:** AI copilot yang dapat menjawab pertanyaan user berdasarkan konteks Section 5 yang sedang ditampilkan.

**Strategi skalabilitas:**
- Copilot membutuhkan konteks — Section5View menyediakan method `Section5View.getContextSnapshot()` yang mengembalikan view model terakhir
- Copilot engine menggunakan snapshot ini sebagai konteks prompt
- Section5View tidak perlu tahu apapun tentang copilot
- Integrasi bersifat pull (copilot meminta ke Section5View), bukan push

### 11.5 Predictive Analytics

**Skenario:** Machine learning model yang memprediksi akhir bulan dengan akurasi lebih tinggi dari proyeksi linear.

**Strategi skalabilitas:**
- Output model (predicted projection) masuk ke contract sebagai field baru: `risk.mlProjection`
- Section5View menampilkan nilai ini jika hadir, di bawah hero KPI linear projection yang sudah ada
- Backward compatible — jika `mlProjection` tidak ada, tampilan tidak berubah

### 11.6 Sell-Out Integration

**Skenario:** Di masa depan ada data sell-out dari retailer yang dapat memperkaya analisis CA activation.

**Strategi skalabilitas:**
- Sell-out data diolah oleh layer baru di DataMapper → KPIEngine
- Output yang relevan ditambahkan ke `opportunity.territories[n].sellOutData`
- Section5View merender data tambahan ini jika hadir di contract
- Tidak ada perubahan arsitektur — hanya perluasan data contract

---

## 12. Extension Points

### 12.1 Card Registry Pattern

Section5View mengimplementasikan internal card registry:

```
cardRegistry = [
  { id: 'risk',        renderer: renderRisk,        zone: 'headline', required: true },
  { id: 'opportunity', renderer: renderOpportunity,  zone: 'middle-left', required: true },
  { id: 'action',      renderer: renderAction,       zone: 'middle-right', required: true },
  { id: 'impact',      renderer: renderImpact,       zone: 'footer', required: true },
]
```

Untuk menambah card baru (contoh: AI Advisory card di masa depan), cukup tambahkan entry ke registry dan sediakan field di data contract. Tidak ada perubahan pada renderRisk, renderOpportunity, renderAction, atau renderImpact.

### 12.2 Data Contract Extension Points

Setiap sub-object di contract (`risk`, `opportunity`, `action`, `impact`) memiliki kemampuan untuk menerima field baru tanpa breaking changes:

- Field baru yang opsional tidak memengaruhi Section5View yang belum tahu tentang field tersebut
- Section5View hanya membaca field yang ia ketahui
- Field yang tidak diketahui diabaikan tanpa error
- Breaking changes (menghapus field wajib atau mengubah tipe) membutuhkan schema version bump

### 12.3 Renderer Hook Points

Section5View menyediakan hook system untuk future AI Engine atau extension:

| Hook | Kapan Dipanggil | Kegunaan |
|------|----------------|---------|
| `onBeforeRender` | Sebelum pipeline dimulai | Validasi tambahan, logging |
| `onAfterRender` | Setelah DOM diperbarui | Screenshot trigger, copilot context update |
| `onCardRendered(cardId)` | Setelah setiap card selesai | Progressive loading indicators |
| `onError(errorCode, details)` | Saat error terjadi | Error reporting ke external system |

Hook ini opsional — jika tidak didaftarkan, tidak ada overhead.

### 12.4 Formatter Extension

`Utils.formatCurrency()` menerima konfigurasi yang memungkinkan format IDR dan format lain (USD, SGD) di masa depan jika SCT di-expand ke multi-market, tanpa mengubah Section5View.

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Scope:** Setiap fungsi render dan transformer diuji secara terpisah dengan input yang dikontrol.

**Target:** Minimal 90% code coverage pada seluruh file Section5View.

| Test Case | Input | Expected Output | Success Criteria |
|-----------|-------|----------------|-----------------|
| `renderBadge('CRITICAL', 'CRITICAL')` | Enum valid | Element dengan class dan label benar | Badge type class, label text, tidak ada error |
| `renderBadge('INVALID', 'x')` | Enum invalid | Default badge atau throw | Tidak crash, log warning |
| `renderRisk(validRiskViewModel)` | View model valid | DocumentFragment dengan semua required elements | Fragment tidak null, semua field hadir |
| `renderRisk(nullHeroViewModel)` | Hero null | Error fragment | Tidak crash, error message visible |
| `transformRisk(validRiskData)` | Data contract valid | View model dengan format IDR benar | Format sesuai locale id-ID |
| `validateExecutiveDecision(validData)` | Schema valid | `{isValid: true, errors: []}` | Lolos tanpa error |
| `validateExecutiveDecision(missingField)` | Field wajib null | `{isValid: false, errors: [{field: ...}]}` | Error terdeteksi dengan benar |
| `validateExecutiveDecision(invalidEnum)` | Enum salah | Warning, bukan error kritikal | Default digunakan, warning di-log |
| Count-up animation start value | `monthEndProj: 88.8` | Animasi dimulai dari 0, berakhir di 88.8 | Final value tepat 88.8 |
| Shallow equality check | Same `generatedAt` | Skip re-render | `lastRenderResult` yang lama dikembalikan |

### 13.2 Integration Tests

**Scope:** Pipeline lengkap dari data contract → DOM output, menggunakan mock KPIEngine output.

| Test Case | Scenario | Success Criteria |
|-----------|---------|-----------------|
| Happy path — CRITICAL | Contract CRITICAL lengkap | Semua 4 card ter-render, badge CRITICAL muncul, hero red, footer dark |
| Happy path — AT_RISK | Contract AT_RISK lengkap | Badge AT_RISK muncul, amber color, call target visible |
| Happy path — ON_TRACK | Contract ON_TRACK lengkap | Badge ON_TRACK, green hero, opportunity card qualified |
| Filter change flow | Render → filter change → render baru | Data lama tidak muncul setelah render kedua |
| Null contract | `executiveDecision = null` | Empty state ditampilkan, tidak ada crash |
| Partial data | Hanya `risk` ada, `opportunity` missing | Risk card render, error state di Opportunity |
| Google Drive refresh | clear() → render() | Loading state terlihat antara clear dan render |

### 13.3 Regression Tests

**Scope:** Memastikan perubahan kode tidak mengubah output visual yang diharapkan.

**Strategi:**
- Simpan HTML snapshot dari setiap test case setelah pertama kali ditulis
- Setiap kali kode berubah, jalankan rendering dan bandingkan HTML output dengan snapshot
- Jika ada perbedaan yang tidak diintensikan → test gagal
- Jika perbedaan disengaja (bug fix, feature) → snapshot diperbarui secara eksplisit

**Prioritas regression tests:**

| Priority | Test | Alasan |
|---------|------|--------|
| P0 | Nilai Hero KPI Risk selalu sama dengan `monthEndProj` yang diformat | Angka salah → keputusan bisnis salah |
| P0 | Badge CRITICAL hanya muncul jika classification === 'CRITICAL' | Alarm palsu atau alarm yang hilang |
| P0 | Impact footer selalu menampilkan do-nothing sebelum with-action | Urutan naratif — salah urutan = salah pesan |
| P1 | Format IDR konsisten (titik sebagai pemisah ribuan) | Inconsistent formatting merusak kredibilitas |
| P1 | Role name dari Action card selalu sama dengan `primaryRole` di contract | Role salah → aksi tidak sampai ke orang yang tepat |

### 13.4 UAT (User Acceptance Test)

**Pelaksana:** NSM atau Commercial Excellence Director — bukan developer atau QA teknis.

| Skenario UAT | Langkah | Kriteria Kelulusan |
|-------------|---------|-------------------|
| Baca dashboard dalam 20 detik | Load MonitorDaily bulan ini, buka Section 5, ukur waktu hingga NSM dapat menyebutkan: status, peluang, aksi | ≤20 detik tanpa bimbingan |
| Identifikasi territory prioritas | Load data dengan 3+ territory, buka Section 5 | NSM menyebut territory yang sama dengan yang tertera di Action card |
| Identifikasi call target hari ini | Lihat Action card | NSM menyebut angka callTarget yang benar |
| Baca konsekuensi inaksi | Lihat Impact footer | NSM dapat menyebutkan selisih proyeksi jika tidak ada aksi vs jika ada aksi |
| Tidak ada kebingungan tooltip | Hover pada elemen dengan tooltip | NSM membaca tooltip dan tidak bingung — tooltip berisi bisnis, bukan UI instruction |

### 13.5 Smoke Tests

**Dijalankan:** Setiap kali ada deployment atau perubahan kode.

| Test | Pass Condition |
|------|--------------|
| Section 5 container exists after init | `document.querySelector('#section5-container')` tidak null |
| Risk card renders | Badge element hadir |
| Opportunity card renders | Hero KPI element hadir |
| Action card renders | Call target element hadir |
| Impact footer renders | Footer dark background element hadir |
| No console errors | `window.SCTHealth.errors` kosong setelah render |
| Render time acceptable | `lastRenderResult.renderTime < 300` |

### 13.6 Performance Tests

**Dijalankan:** Mingguan dan sebelum setiap release.

| Test | Target | Maximum |
|------|--------|---------|
| Render time dengan data standar (23 territory) | <100ms | 200ms |
| Render time dengan data maksimum (100+ territory) | <150ms | 300ms |
| Memory usage setelah 50× render cycles | Tidak ada memory leak | Heap stabil |
| Render setelah rapid filter changes (10×/detik) | Tidak ada race condition | Hanya render terakhir yang terlihat |

---

## 14. Coding Principles

Prinsip-prinsip berikut bersifat **mandatory** — bukan rekomendasi. Code review harus menolak kode yang melanggar prinsip ini.

---

**P1 — Single Responsibility Principle**
Setiap fungsi, kelas, atau modul memiliki tepat satu alasan untuk berubah. `renderRisk()` hanya berubah jika struktur Risk card berubah. `transformRisk()` hanya berubah jika aturan transformasi data Risk berubah. Kedua hal ini tidak boleh berada dalam satu fungsi.

**P2 — Tidak Ada Kalkulasi Bisnis di dalam View**
Section5View tidak boleh melakukan operasi aritmatika terhadap data bisnis. Tidak ada pembagian, perkalian, persentase, atau logika kondisional yang mengubah makna bisnis di dalam Section5View. Jika suatu tampilan memerlukan kalkulasi, kalkulasinya harus dilakukan di KPIEngine dan hasilnya ditambahkan ke data contract.

**P3 — Pure Rendering Functions**
Setiap fungsi `render{Name}()` harus pure: input yang sama selalu menghasilkan output yang sama. Tidak ada akses ke state global, tidak ada side effect, tidak ada network call. Satu-satunya pengecualian yang diizinkan adalah `renderTooltip()` yang mendaftarkan event listener — dan ini harus didokumentasikan secara eksplisit.

**P4 — Immutable Input**
Section5View tidak boleh memodifikasi object `executiveDecision` yang diterimanya. Semua transformasi menghasilkan object baru. Implementasi harus memastikan bahwa pipeline transformation tidak mengubah object input secara langsung (no in-place mutation).

**P5 — Tidak Ada Duplikasi Formatter Logic**
Ada tepat satu tempat untuk logic format IDR: `Utils.formatCurrency()`. Ada tepat satu tempat untuk format persentase: `Utils.formatPct()`. Section5View tidak boleh mengimplementasikan formatter sendiri, bahkan untuk kasus yang tampak sederhana. Jika formatter yang ada tidak memenuhi kebutuhan, perbaiki formatter tersebut — jangan duplikasi.

**P6 — Tidak Ada Duplikasi KPI Calculation**
Jika Section5View membutuhkan nilai yang dapat dihitung dari data yang sudah ada di contract, ia tidak boleh menghitungnya sendiri. Nilai tersebut harus diminta untuk ditambahkan ke contract oleh KPIEngine. Ini mencegah divergensi antara "KPI yang dilihat user" dan "KPI yang dihitung engine".

**P7 — Tidak Ada Direct DOM Mutation di Luar Renderer**
Semua perubahan DOM harus melalui fungsi render yang terdefinisi. Tidak ada `document.getElementById().style.color = ...` yang tersebar di seluruh codebase. Setiap perubahan DOM yang tidak melalui Renderer harus ditolak di code review.

**P8 — Deterministic Rendering**
Untuk input yang sama, output DOM harus identik setiap saat, pada semua browser yang didukung. Tidak ada timestamp yang di-embed dalam DOM pada saat render (kecuali dari data contract). Tidak ada `Math.random()` dalam fungsi render.

**P9 — Consistent Error Logging**
Semua log dari Section5View menggunakan prefix yang konsisten: `[Section5View]`. Semua error menggunakan `[Section5View:ERROR]`. Ini memudahkan filtering di browser console. Tidak ada `console.log()` tanpa prefix di production code.

**P10 — Zero Toleration for Silent Failures**
Jika sesuatu gagal, ia harus gagal dengan eksplisit dan terlog. Tidak ada `try/catch` yang menelan error tanpa logging. `catch(e) {}` adalah anti-pattern yang dilarang. Minimal: `catch(e) { console.error('[Section5View:ERROR]', e); }`

**P11 — Contract Before Implementation**
Setiap field baru di data contract harus disetujui bersama sebelum ada implementasi di kedua sisi (KPIEngine dan Section5View). Tidak ada field yang ditambahkan secara unilateral oleh satu sisi.

**P12 — No Framework Lock-in dalam Logic**
Business logic transformation dan validation tidak boleh menggunakan API yang framework-specific. Ini memastikan bahwa logic ini dapat dipindahkan ke React, TypeScript, atau environment lain tanpa penulisan ulang.

---

## 15. Final Readiness Checklist

Semua item berikut harus **fully completed and approved** sebelum implementasi Section 5 dimulai. Setiap item harus memiliki sign-off yang teridentifikasi.

| # | Item | Owner | Status | Kriteria Penyelesaian |
|---|------|-------|--------|----------------------|
| 1 | Business Spec Approved | Business Lead | ✅ Done | `Section5_ExecutiveDecisionCenter_Spec.md` final dan frozen |
| 2 | UI Spec Approved | Design Lead | ✅ Done | `Section5_UISpecification.md` final dan frozen |
| 3 | Design System Approved | Design Lead | ✅ Done | `SCT_v6_DesignSystem.md` final dan frozen |
| 4 | Technical Design Spec Approved | Lead Architect | 🔄 This document | TDS ini telah direview dan disetujui oleh Lead Architect |
| 5 | Data Contract Frozen | KPIEngine Lead | ⬜ Pending | JSON schema v1.0.0 disetujui kedua sisi (KPIEngine + Section5View) |
| 6 | KPIEngine Output Verified | Backend Lead | ⬜ Pending | `State.kpi.executiveDecision` menghasilkan output yang cocok dengan schema v1.0.0 |
| 7 | Dependency Map Approved | Lead Architect | ⬜ Pending | Semua dependency dan non-dependency terkonfirmasi dan tidak ada circular dependency |
| 8 | Error Strategy Approved | QA Lead | ⬜ Pending | Semua 8 error scenario di Bagian 9 memiliki handler yang disepakati |
| 9 | Performance Budget Approved | Lead Architect | ⬜ Pending | Target <150ms dinyatakan realistis setelah benchmark pada hardware target |
| 10 | Public API Reviewed | App.js Maintainer | ⬜ Pending | Semua 7 method public API cocok dengan kebutuhan App.js saat ini dan yang direncanakan |
| 11 | UAT Scenario Approved | NSM atau Commercial Lead | ⬜ Pending | 5 skenario UAT di Bagian 13.4 disetujui sebagai kriteria penerimaan bisnis |
| 12 | Extension Points Reviewed | Future Tech Lead | ⬜ Pending | 6 skenario scalability di Bagian 11 dinyatakan cukup untuk roadmap 12 bulan |
| 13 | Testing Strategy Agreed | QA Lead | ⬜ Pending | Coverage target (90% unit, 100% smoke) dinyatakan feasible |
| 14 | Coding Principles Socialized | All Developers | ⬜ Pending | Semua 12 coding principles telah dibaca dan dipahami oleh seluruh tim yang mengimplementasikan |
| 15 | Mock KPIEngine Output Prepared | KPIEngine Lead | ⬜ Pending | Mock data contract v1.0.0 tersedia untuk digunakan selama pengembangan Section5View secara paralel |

---

> **Catatan Akhir:** Dokumen ini adalah satu-satunya sumber kebenaran untuk arsitektur Section 5 sebelum implementasi dimulai. Perubahan apapun pada dokumen ini setelah item #4 (TDS Approved) harus melalui proses change request formal dengan approval dari Lead Architect. Tidak ada implementasi yang boleh menyimpang dari TDS ini tanpa persetujuan tertulis.

---

*End of Section 5 Technical Design Specification — SCT v6*

**Lampiran:**

- Lihat `docs/Section5_ExecutiveDecisionCenter_Spec.md` untuk formula KPI lengkap
- Lihat `docs/Section5_UISpecification.md` untuk detail tampilan dan animasi
- Lihat `docs/SCT_v6_DesignSystem.md` untuk design language resmi
