/**
 * dataMapper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Domain-specific data transformation: raw spreadsheet rows → typed domain objects.
 * Currently contains one transformer: parseDimDate.
 *
 * Source: Parser.parseDimDate (SCT-by-SHP.html lines 1730–1898)
 *
 * Dependencies (must be loaded before this file):
 *   state.js   — State.timeEngine (write target)
 *
 * ── What DataMapper does ─────────────────────────────────────────────────────
 *   parseDimDate(rows) — interprets DimDate sheet rows using two strategies
 *                        (column-header match AND label-value pair match),
 *                        validates the extracted values, and writes the result
 *                        to State.timeEngine.
 *
 * ── What DataMapper does NOT do ──────────────────────────────────────────────
 *   - No Excel file I/O (→ excelParser.js)
 *   - No KPI calculations
 *   - No rendering
 *
 * ── Expansion point ──────────────────────────────────────────────────────────
 *   Future sheet-to-domain mappers (e.g., mapPerf(), mapCaMaster()) belong here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DataMapper = {

  /**
   * parseDimDate(rows)
   * Extract working-day configuration from DimDate sheet rows.
   *
   * WRITES TO: State.timeEngine (single write point — nowhere else writes this).
   *
   * Supported column layouts (both horizontal header row & vertical label|value):
   *   "Total Hari Kerja" / "Total HK" / "Total Working Days"  → hkTot
   *   "Hari Kerja Berjalan" / "HK Berjalan" / "WD Passed"     → hkPass
   *   "Sisa Hari Kerja" / "Sisa HK" / "Remaining WD"          → hkRem
   *   "Time Gone" / "Time Gone %" / "Waktu Berjalan"           → timeGone (%)
   *
   * Validation rules:
   *   1. hkTot must be > 0
   *   2. hkPass must be <= hkTot
   *   3. If hkRem supplied: cross-checked against (hkTot - hkPass); warn if mismatch > 1
   *   4. timeGone: accepted as-is if 0–100; if 0–1 range, multiplied × 100
   *
   * On any parse failure: State.timeEngine.valid = false, warnings populated,
   * sentinel values kept so all downstream calculations fail visibly.
   *
   * Source: Parser.parseDimDate
   */
  parseDimDate: (rows) => {
    // ── Reset to sentinel on every call ──
    State.timeEngine = {
      hkTot:    1,
      hkPass:   0,
      hkRem:    1,
      timeGone: 0,
      source:   'fallback-sentinel',
      valid:    false,
      warnings: []
    };

    if (!rows || !rows.length) {
      State.timeEngine.warnings.push('Sheet DimDate tidak ditemukan. Semua Working Days menggunakan sentinel.');
      console.warn('[TimeEngine] DimDate sheet missing. Sentinel values active.');
      return;
    }

    const normalize = (s) => s ? s.toString().toLowerCase().replace(/[\s_\-\.]+/g, '') : '';

    // ── Label → internal key map ──
    const LABEL_MAP = {
      // hkTot variants
      'totalharikerja':       'hkTot',
      'totalhk':              'hkTot',
      'totalworkingday':      'hkTot',
      'totalworkingdays':     'hkTot',
      'wdtotal':              'hkTot',
      'hktotal':              'hkTot',
      // hkPass variants
      'harikerjaberjalan':    'hkPass',
      'hkberjalan':           'hkPass',
      'workingdaypassed':     'hkPass',
      'workingdayspassed':    'hkPass',
      'wdpassed':             'hkPass',
      'wdberjalan':           'hkPass',
      'hkpassed':             'hkPass',
      'berjalan':             'hkPass',
      'elapsed':              'hkPass',
      // hkRem variants
      'sisaharikerja':        'hkRem',
      'sisahk':               'hkRem',
      'remainingworkingday':  'hkRem',
      'remainingworkingdays': 'hkRem',
      'wdremaining':          'hkRem',
      'wdsisa':               'hkRem',
      'hkremaining':          'hkRem',
      'sisa':                 'hkRem',
      // timeGone variants
      'timegone':             'timeGone',
      'timegone%':            'timeGone',
      'waktuberjalan':        'timeGone',
      'persenwaktu':          'timeGone',
      'pctgone':              'timeGone',
      'percentgone':          'timeGone',
      'timegonepct':          'timeGone',
      'tg':                   'timeGone',
    };

    const found = {};

    rows.slice(0, 30).forEach(row => {
      const vals = Object.values(row);
      const keys = Object.keys(row);

      keys.forEach((k, idx) => {
        // Strategy A: column header matches a label
        const nKey = normalize(k);
        const targetA = LABEL_MAP[nKey];
        if (targetA && found[targetA] === undefined) {
          const v = vals[idx];
          if (v !== null && v !== undefined && v !== '') {
            const parsed = parseFloat(v);
            if (!isNaN(parsed)) found[targetA] = parsed;
          }
        }

        // Strategy B: cell VALUE is a string label → next cell is the number
        const cellVal = vals[idx];
        if (typeof cellVal === 'string') {
          const nVal = normalize(cellVal);
          const targetB = LABEL_MAP[nVal];
          if (targetB && found[targetB] === undefined) {
            const nextVal = vals[idx + 1];
            if (nextVal !== null && nextVal !== undefined && nextVal !== '') {
              const parsed = parseFloat(nextVal);
              if (!isNaN(parsed)) found[targetB] = parsed;
            }
          }
        }
      });
    });

    // ── Strategy C: Calendar table (full date grid with Is_Workday column) ──────
    // Triggered when Strategy A + B find nothing.
    // DimDate may be a full calendar table (2025–2026) where each row is one
    // calendar day: Date | Year | Month_Num | ... | Is_Workday | ...
    // SheetJS reads the TITLE ROW (row 1) as the header, making the real column
    // headers ('Date', 'Is_Workday' etc.) appear as cell VALUES in rows[1].
    // We detect this embedded header, map column positions, then count working
    // days for the target period from State.raw.period (set by extractSheets).
    if (found.hkTot === undefined && found.hkPass === undefined) {

      // Detect embedded calendar header: find row where a cell value = 'isworkday'
      let calHdrIdx = -1;
      rows.slice(0, 10).forEach((row, idx) => {
        if (Object.values(row).some(v => normalize(v ? v.toString() : '') === 'isworkday')) {
          calHdrIdx = idx;
        }
      });

      if (calHdrIdx >= 0) {
        // Map column positions from the embedded header row
        const hdrVals = Object.values(rows[calHdrIdx]);
        let dateIdx = -1, isWDIdx = -1;
        hdrVals.forEach((v, i) => {
          const n = normalize(v ? v.toString() : '');
          if (n === 'date' || n === 'tanggal') dateIdx = i;
          if (n === 'isworkday')               isWDIdx = i;
        });

        if (dateIdx >= 0 && isWDIdx >= 0) {
          // Determine target year/month.
          // Priority: State.raw.period (parsed from Config sheet by extractSheets)
          // Fallback: current month from system clock.
          const today  = new Date();
          let tYear  = today.getFullYear();
          let tMonth = today.getMonth() + 1;  // 1-based

          const periodStr = (State.raw && State.raw.period)
            ? State.raw.period.toString().toLowerCase().trim()
            : '';

          if (periodStr) {
            const ID_M = {
              jan:1, feb:2, mar:3, apr:4, mei:5, may:5,
              jun:6, jul:7, agu:8, aug:8, sep:9,
              okt:10, oct:10, nov:11, des:12, dec:12
            };
            // Handle formats: 'Mei 2026', 'May 2026', '05/2026', '2026-05', etc.
            const pts = periodStr.replace(/[,\/\-]/g, ' ').split(/\s+/);
            pts.forEach((p, pi) => {
              const mk = ID_M[p.substring(0, 3)];
              if (mk) {
                tMonth = mk;
                const yr = parseInt(pts[pi + 1]);
                if (!isNaN(yr) && yr > 2000) tYear = yr;
              } else {
                // numeric month: '05 2026' or '2026 05'
                const nm = parseInt(p);
                if (!isNaN(nm) && nm >= 1 && nm <= 12 && !mk) {
                  tMonth = nm;
                } else if (!isNaN(nm) && nm > 2000) {
                  tYear = nm;
                }
              }
            });
          }

          // Count working days in tYear/tMonth
          const endOfToday = new Date(today);
          endOfToday.setHours(23, 59, 59, 999);

          let totalHK = 0, passedHK = 0;

          // Data rows start 2 rows after embedded header (header row + description row)
          rows.slice(calHdrIdx + 2).forEach(dataRow => {
            const vals = Object.values(dataRow);
            // Is_Workday must be exactly 1
            if (vals[isWDIdx] !== 1) return;

            const rawDate = vals[dateIdx];
            if (!rawDate) return;

            let d;
            if (rawDate instanceof Date) {
              d = rawDate;
            } else if (typeof rawDate === 'number') {
              // Excel serial date (days since 1899-12-30)
              d = new Date(Math.round((rawDate - 25569) * 86400000));
            } else {
              d = new Date(rawDate.toString());
            }
            if (isNaN(d.getTime())) return;

            const dYear  = d.getFullYear();
            const dMonth = d.getMonth() + 1;  // 1-based

            if (dYear === tYear && dMonth === tMonth) {
              totalHK++;
              if (d <= endOfToday) passedHK++;
            }
          });

          if (totalHK > 0) {
            found.hkTot  = totalHK;
            found.hkPass = passedHK;
            console.log(
              `[TimeEngine] Strategy C: Calendar ${tYear}-${String(tMonth).padStart(2,'0')}` +
              ` → hkTot=${totalHK} hkPass=${passedHK}`
            );
          } else {
            console.warn(
              `[TimeEngine] Strategy C: Calendar detected but no Is_Workday=1 rows` +
              ` found for ${tYear}-${String(tMonth).padStart(2,'0')}.` +
              ` Check State.raw.period or today's date.`
            );
          }
        }
      }
    }

    // ── Validate & populate ──
    const warnings = [];

    if (found.hkTot === undefined && found.hkPass === undefined) {
      warnings.push('DimDate ditemukan tapi tidak ada kolom yang dikenali (hkTot / hkPass). Cek nama kolom.');
      State.timeEngine.warnings = warnings;
      State.timeEngine.source   = 'DimDate-unrecognized';
      console.warn('[TimeEngine] DimDate found but no recognized columns.', 'Keys available:', rows.length ? Object.keys(rows[0]) : []);
      return;
    }

    const hkTot  = found.hkTot  !== undefined ? Math.round(Math.abs(found.hkTot))  : null;
    const hkPass = found.hkPass !== undefined ? Math.round(Math.abs(found.hkPass)) : null;
    let   hkRem  = found.hkRem  !== undefined ? Math.round(Math.abs(found.hkRem))  : null;

    // Validation: hkTot must be > 0
    if (hkTot !== null && hkTot <= 0) {
      warnings.push(`hkTot=${hkTot} tidak valid (harus > 0). Nilai diabaikan.`);
    }

    // Validation: hkPass cannot exceed hkTot
    if (hkTot !== null && hkTot > 0 && hkPass !== null && hkPass > hkTot) {
      warnings.push(`hkPass=${hkPass} melebihi hkTot=${hkTot}. Dikap ke hkTot.`);
    }

    // Cross-check hkRem vs (hkTot - hkPass) — warn if mismatch > 1 day
    if (hkTot !== null && hkPass !== null && hkRem !== null) {
      const derived = hkTot - hkPass;
      if (Math.abs(hkRem - derived) > 1) {
        warnings.push(`hkRem=${hkRem} tidak konsisten dengan hkTot-hkPass=${derived}. Menggunakan nilai dari sheet.`);
      }
    }

    // Derive hkRem if not supplied
    if (hkRem === null && hkTot !== null && hkPass !== null) {
      hkRem = Math.max(0, hkTot - hkPass);
    }

    // timeGone: normalize range
    let timeGone = null;
    if (found.timeGone !== undefined) {
      const raw = found.timeGone;
      // If stored as fraction (0–1), convert to percent
      timeGone = raw > 1 ? raw : raw * 100;
      // Clamp to safe range
      timeGone = Math.min(100, Math.max(0, timeGone));
    } else if (hkTot !== null && hkTot > 0 && hkPass !== null) {
      // Derive from HK values
      const safePass = Math.min(hkPass, hkTot);
      timeGone = (safePass / hkTot) * 100;
    }

    // ── Determine validity & source ──
    const hasCoreData = (hkTot !== null && hkTot > 0) && (hkPass !== null);
    const isPartial   = hasCoreData && (found.hkRem === undefined || found.timeGone === undefined);

    State.timeEngine = {
      hkTot:    hasCoreData ? Math.max(1, hkTot)           : 1,
      hkPass:   hasCoreData ? Math.min(hkPass, hkTot)      : 0,
      hkRem:    hkRem     !== null ? Math.max(0, hkRem)    : 1,
      timeGone: timeGone  !== null ? timeGone               : 0,
      source:   hasCoreData ? (isPartial ? 'DimDate-partial' : 'DimDate') : 'fallback-sentinel',
      valid:    hasCoreData,
      warnings
    };

    if (warnings.length) console.warn('[TimeEngine] Warnings:', warnings);
    console.log(
      `[TimeEngine] Loaded | source=${State.timeEngine.source}` +
      ` | hkTot=${State.timeEngine.hkTot}` +
      ` | hkPass=${State.timeEngine.hkPass}` +
      ` | hkRem=${State.timeEngine.hkRem}` +
      ` | timeGone=${State.timeEngine.timeGone.toFixed(1)}%` +
      ` | valid=${State.timeEngine.valid}`
    );
  }

};
