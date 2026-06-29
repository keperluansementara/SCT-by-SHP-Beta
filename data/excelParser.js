// ==========================================
// DATA LAYER — excelParser.js
// ==========================================
// Source: index.html lines 2813–3148
// Extracted: Utility Extraction Phase C
//
// Exposes global: Parser
// Dependencies:
//   DOM    (setStyle, setTxt — lazy)
//   State  (State.raw writes — lazy)
//   Config (sheet name constants — lazy)
//   App    (App.initDashboardData — lazy)
//   XLSX   (CDN global — must load before this file)
// ==========================================

const Parser = {
  /**
   * handleFile(file) — Sprint 23.1: now returns a Promise.
   * Resolves when extractSheets() completes successfully.
   * Rejects with { code, message, stage, originalError } on any failure.
   *
   * Manual upload callers (.catch() in App.bindGlobalEvents) show alert on reject.
   * Google Drive caller (loadFromBridge) awaits and lets its own catch handle errors.
   *
   * NOTE: loader-wrapper / loader-bar / loader-text are still used for the MANUAL
   * upload path. The GDE path uses its own #gde-overlay and never touches these IDs.
   */
  handleFile: (file) => {
    if (!file) return Promise.resolve({ ok: false, error: 'NO_FILE' });
    DOM.setStyle('loader-wrapper', 'display', 'block');
    Parser.updateProgress(10, 'Decrypting data source...');

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          Parser.updateProgress(40, 'Parsing workbook engine...');
          const wb = XLSX.read(e.target.result, { type: 'array' });
          Parser.extractSheets(wb);
          resolve({ ok: true });
        } catch (err) {
          Parser.updateProgress(0, '❌ Fatal: File processing failed');
          // ── Runtime Diagnostics (permanent) ────────────────────────────────
          const errName  = (err && err.name)    ? err.name    : 'UnknownError';
          const errMsg   = (err && err.message) ? err.message : String(err);
          const errStack = (err && err.stack)   ? err.stack   : '(no stack trace)';
          const errStage = (typeof Parser._currentSheet !== 'undefined')
                           ? 'Sheet: ' + Parser._currentSheet
                           : 'XLSX.read or extractSheets (sheet unknown)';
          console.error('[SCT RUNTIME] ── Upload pipeline fatal exception ──');
          console.error('[SCT RUNTIME] Stage  :', errStage);
          console.error('[SCT RUNTIME] Name   :', errName);
          console.error('[SCT RUNTIME] Message:', errMsg);
          console.error('[SCT RUNTIME] Stack  :', errStack);
          console.error('[SCT RUNTIME] Full object:', err);
          reject({
            code:          'PARSE_ERROR',
            message:       'Gagal membaca file Excel: ' + errMsg,
            stage:         errStage,
            originalError: err
          });
        }
      };

      reader.onerror = (e) => {
        // Sprint 23.1 — previously MISSING; now handles FileReader failures
        Parser.updateProgress(0, '❌ Fatal: FileReader error');
        console.error('[SCT RUNTIME] FileReader error event:', e);
        reject({
          code:    'FILEREADER_ERROR',
          message: 'FileReader gagal membaca file. Pastikan file tidak rusak dan coba lagi.',
          stage:   'FileReader.readAsArrayBuffer'
        });
      };

      reader.readAsArrayBuffer(file);
    });
  },

  updateProgress: (pct, msg) => {
    DOM.setStyle('loader-bar', 'width', `${pct}%`);
    DOM.setTxt('loader-text', msg);
  },

  findSheet: (wb, aliases) => {
    for (const a of aliases) {
      const clean = a.replace('📦', '').trim().toLowerCase();
      const exact = wb.SheetNames.find(s => s.trim().toLowerCase() === clean);
      if (exact) return exact;
      const partial = wb.SheetNames.find(s => s.toLowerCase().includes(clean));
      if (partial) return partial;
    }
    return null;
  },

  cleanKeys: (raw) => raw.map(row => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) clean[k.trim()] = v;
    return clean;
  }),

  /**
   * parseDimDate — Extract working-day config from DimDate sheet.
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
    if (found.hkTot === undefined && found.hkPass === undefined) {
      let calHdrIdx = -1;
      rows.slice(0, 10).forEach((row, idx) => {
        if (Object.values(row).some(v => normalize(v ? v.toString() : '') === 'isworkday')) calHdrIdx = idx;
      });
      if (calHdrIdx >= 0) {
        const hdrVals = Object.values(rows[calHdrIdx]);
        let dateIdx = -1, isWDIdx = -1;
        hdrVals.forEach((v, i) => {
          const n = normalize(v ? v.toString() : '');
          if (n === 'date' || n === 'tanggal') dateIdx = i;
          if (n === 'isworkday')               isWDIdx = i;
        });
        if (dateIdx >= 0 && isWDIdx >= 0) {
          const today  = new Date();
          let tYear  = today.getFullYear(), tMonth = today.getMonth() + 1;
          const periodStr = (State.raw && State.raw.period) ? State.raw.period.toString().toLowerCase().trim() : '';
          if (periodStr) {
            const ID_M = {jan:1,feb:2,mar:3,apr:4,mei:5,may:5,jun:6,jul:7,agu:8,aug:8,sep:9,okt:10,oct:10,nov:11,des:12,dec:12};
            const pts = periodStr.replace(/[,\/\-]/g, ' ').split(/\s+/);
            pts.forEach((p, pi) => {
              const mk = ID_M[p.substring(0, 3)];
              if (mk) { tMonth = mk; const yr = parseInt(pts[pi+1]); if (!isNaN(yr) && yr > 2000) tYear = yr; }
              else { const nm = parseInt(p); if (!isNaN(nm) && nm >= 1 && nm <= 12) tMonth = nm; else if (!isNaN(nm) && nm > 2000) tYear = nm; }
            });
          }
          const endOfToday = new Date(today); endOfToday.setHours(23, 59, 59, 999);
          let totalHK = 0, passedHK = 0;
          rows.slice(calHdrIdx + 2).forEach(dataRow => {
            const vals = Object.values(dataRow);
            if (vals[isWDIdx] !== 1) return;
            const rawDate = vals[dateIdx]; if (!rawDate) return;
            let d = (rawDate instanceof Date) ? rawDate : (typeof rawDate === 'number') ? new Date(Math.round((rawDate - 25569) * 86400000)) : new Date(rawDate.toString());
            if (isNaN(d.getTime())) return;
            if (d.getFullYear() === tYear && (d.getMonth() + 1) === tMonth) {
              totalHK++;
              if (d <= endOfToday) passedHK++;
            }
          });
          if (totalHK > 0) {
            found.hkTot = totalHK; found.hkPass = passedHK;
            console.log(`[TimeEngine] Strategy C: Calendar ${tYear}-${String(tMonth).padStart(2,'0')} → hkTot=${totalHK} hkPass=${passedHK}`);
          } else {
            console.warn(`[TimeEngine] Strategy C: No Is_Workday=1 rows found for ${tYear}-${String(tMonth).padStart(2,'0')}`);
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
      hkTot:    hasCoreData ? Math.max(1, hkTot)  : 1,
      hkPass:   hasCoreData ? Math.min(hkPass, hkTot) : 0,
      hkRem:    hkRem  !== null ? Math.max(0, hkRem)  : 1,
      timeGone: timeGone !== null ? timeGone : 0,
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
  },

  extractSheets: (wb) => {
    Parser.updateProgress(70, 'Mapping business logic...');
    const sMap = {
      perf: Parser.findSheet(wb, Config.SHEET_ALIASES.perf) || wb.SheetNames[0],
      arjuna: Parser.findSheet(wb, Config.SHEET_ALIASES.arjuna),
      bima: Parser.findSheet(wb, Config.SHEET_ALIASES.bima),
      sc: Parser.findSheet(wb, Config.SHEET_ALIASES.supercup),
      ps: Parser.findSheet(wb, Config.SHEET_ALIASES.ps)
    };

    State.raw.perf = Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMap.perf], {defval:null}));
    State.raw.arjuna = sMap.arjuna ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMap.arjuna], {defval:null})) : [];
    State.raw.bima = sMap.bima ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMap.bima], {defval:null})) : [];
    State.raw.sc = sMap.sc ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMap.sc], {defval:null})) : [];
    State.raw.ps = sMap.ps ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMap.ps], {defval:null})) : [];

    // Wholesaler sheet — raw customer-level rows carrying CLASS field (SPRBIG/BIG/MEDIUM/SMALL).
    // Powers BB5 "Wholesaler Performance by Class". Isolated from BB1 (which derives from Perfomance).
    const sWS = Parser.findSheet(wb, Config.SHEET_ALIASES.wholesaler);
    State.raw.wholesaler = sWS ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sWS], {defval:null})) : [];
    if (!sWS) console.warn('[Wholesaler] Sheet tidak ditemukan. BB5 Performance by Class akan disembunyikan.');
    else console.log('[Wholesaler] Loaded:', State.raw.wholesaler.length, 'rows for BB5 Class analysis');

    // MT sheet — Modern Trade row-level data (MTI + NKA channels).
    // Powers MT Analysis section. Isolated from Performance sheet.
    // Columns: Area, Region, Depo, Principle, Kategori, Sub Kategori, SKU,
    //          Channel, Sub Channel, Act TM, LYHK, LMHK, CA, CA LM, CLASS
    const sMT = Parser.findSheet(wb, Config.SHEET_ALIASES.mt || []);
    State.raw.mt = sMT ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sMT], {defval:null})) : [];
    if (!sMT) console.warn('[MT] Sheet tidak ditemukan. MT Analysis akan disembunyikan.');
    else console.log('[MT] Loaded:', State.raw.mt.length, 'rows for MT Analysis');

    // Config sheet: extract reporting period (e.g. 'Mei 2026') for Strategy C calendar parsing
    const sConfigSheet = Parser.findSheet(wb, ['Config', 'config', 'Konfigurasi', 'Setting']);
    State.raw.period = null;
    if (sConfigSheet) {
      const cfgAoA = XLSX.utils.sheet_to_json(wb.Sheets[sConfigSheet], { header: 1, defval: null });
      cfgAoA.forEach(row => {
        if (!Array.isArray(row)) return;
        const strs = row.map(v => v ? v.toString().trim() : '');
        const pi = strs.findIndex(s => s.toLowerCase() === 'periode');
        if (pi >= 0 && strs[pi + 1]) State.raw.period = strs[pi + 1];
      });
      if (State.raw.period) console.log('[Config] Periode:', State.raw.period);
      else console.warn('[Config] Sheet ditemukan tapi kolom "Periode" kosong.');
    }

    // DimDate: parse working days configuration
    // Strategy A/B: key-value format  |  Strategy C: calendar table format
    const sDimDate = Parser.findSheet(wb, Config.SHEET_ALIASES.dimdate);
    State.raw.dimdate = sDimDate ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sDimDate], {defval:null})) : [];
    Parser.parseDimDate(State.raw.dimdate);

    // CA_Master: Single Source of Truth for CA data
    const sCA = Parser.findSheet(wb, Config.SHEET_ALIASES.caMaster);
    State.raw.caMaster = sCA ? Parser.cleanKeys(XLSX.utils.sheet_to_json(wb.Sheets[sCA], {defval:null})) : [];
    if (!sCA) console.warn('[CA_Master] Sheet tidak ditemukan. Fallback ke Perfomance sheet untuk CA.');
    else console.log('[CA_Master] Loaded:', State.raw.caMaster.length, 'unique outlets');

    Parser.updateProgress(95, 'Building UI Render...');
    App.initDashboardData();
  }
};
