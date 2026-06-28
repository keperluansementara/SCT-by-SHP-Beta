// ==========================================
// VISUALIZATION LAYER — infographicEngine.js
// ==========================================
// Source: SCT-by-SHP.html lines 9246–12473
// Extracted: Issue #4 — InfographicEngine Extraction
//
// Dependencies (runtime, load before this file):
//   utils/helpers.js     → Utils.fmtPct(), Utils.fmtCompact()
//   business/timeEngine.js → TimeEngine.get(), TimeEngine.fmt()
//   core/state.js        → State.filters, State.options
//   export/exportEngine.js → ExportEngine._toast() [typeof-guarded]
//
// Defines globals:
//   InfographicEngine    — Canvas2D infographic rendering engine
//   ExecCardEngine       — v5 backward-compat alias for InfographicEngine
//
// Load order:
//   utils/ → core/ → data/ → business/ → export/exportEngine.js
//     → visualization/infographicEngine.js
// ==========================================

// ==========================================
// V6: InfographicEngine
// AI-Powered FMCG Executive Briefing & Infographic System
// ==========================================
/**
 * InfographicEngine (v6)
 * Canvas2D infographic rendering engine — not a screenshot system.
 * Generates WhatsApp-ready 1080×1350px PNG infographic cards.
 *
 * Reads: State.kpi (post KPIEngine.runAll), State.filters,
 *        TimeEngine.fmt(), Utils.fmtCompact(), Utils.fmtPct()
 *
 * Zero modifications to: KPIEngine, RenderEngine, ExportEngine,
 *                         ChartEngine, FilterEngine, business logic.
 *
 * V5 (Phase B1): renderMorningBriefing() — preserved, aliased as generateDailyBriefing()
 * V6 Phase 1A:   generateDailyBriefing() — enhanced Daily Briefing   [V6 PHASE 1A]
 * V6 Phase 1B:   generateChannelWatch()  — Channel Watch card        [V6 PHASE 1B]
 * V6 Phase 2:    generatePrincipleAlert(), generateRegionAlert()      [V6 FUTURE]
 *
 * Backward compat: const ExecCardEngine = InfographicEngine (alias below closing brace)
 */
const InfographicEngine = {

  // ── Canvas dimensions ────────────────────────────────────────────────
  W: 1080,
  H: 1350,

  // ── Design tokens (mirrored from CSS vars for Canvas2D use) ──────────
  CLR: {
    bg:          '#0D0D0F',   // near-black background
    surface:     '#171719',   // card surface
    surface2:    '#1E1E22',   // raised inner panels
    border:      '#2A2A30',   // subtle borders
    borderAccent:'#3A3A44',   // slightly brighter borders
    white:       '#FFFFFF',
    textPrimary: '#F0F0F5',   // main text
    textSec:     '#9494A4',   // secondary / muted
    textMuted:   '#5C5C6E',   // very muted labels
    // Status
    red:         '#C0392B',
    redBright:   '#E74C3C',
    redBg:       '#2A1A1A',
    amber:       '#D35400',
    amberBright: '#F39C12',
    amberBg:     '#2A1E0D',
    green:       '#1E8449',
    greenBright: '#27AE60',
    greenBg:     '#0D2010',
    blue:        '#1A5276',
    blueBright:  '#3498DB',
    // Accent
    accent:      '#5DADE2',
    accentDim:   '#2E5F7A',
  },

  // ── Typography — Canvas2D font strings ───────────────────────────────
  // IBM Plex fonts already loaded by the page's Google Fonts import.
  // Canvas2D inherits from document font list when fonts are loaded.
  FONT: {
    num:    (size, w=800) => `${w} ${size}px "IBM Plex Mono", monospace`,
    sans:   (size, w=400) => `${w} ${size}px "IBM Plex Sans", sans-serif`,
    sansBold:(size)       => `700 ${size}px "IBM Plex Sans", sans-serif`,
    label:  (size)        => `700 ${size}px "IBM Plex Sans", sans-serif`,
  },

  // ── Internal layout state (reset each render) ─────────────────────────
  _ctx:     null,
  _canvas:  null,

  // ── Canvas setup ─────────────────────────────────────────────────────
  _createCanvas: () => {
    const c = document.createElement('canvas');
    c.width  = InfographicEngine.W;
    c.height = InfographicEngine.H;
    return c;
  },

  _getCtx: (canvas) => {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'high';
    return ctx;
  },

  // ── Utility: rounded rect path ───────────────────────────────────────
  _rrect: (ctx, x, y, w, h, r) => {
    r = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x+w, y,   x+w, y+r,   r);
    ctx.lineTo(x+w, y+h-r);
    ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x+r, y+h);
    ctx.arcTo(x, y+h, x, y+h-r,     r);
    ctx.lineTo(x, y+r);
    ctx.arcTo(x, y,   x+r, y,       r);
    ctx.closePath();
  },

  // ── Utility: word-wrap text into lines ───────────────────────────────
  // Returns array of lines that fit within maxWidth.
  _wrapText: (ctx, text, maxWidth) => {
    if (!text) return [''];
    const words = String(text).split(' ');
    const lines = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        cur = test;
      } else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  },

  // ── Utility: draw multi-line text, returns final y ───────────────────
  _drawText: (ctx, text, x, y, maxWidth, lineHeight, maxLines = 99) => {
    const lines = InfographicEngine._wrapText(ctx, text, maxWidth);
    const drawn = lines.slice(0, maxLines);
    drawn.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + drawn.length * lineHeight;
  },

  // ── Utility: truncate string to fit width, appending '…' ─────────────
  _truncate: (ctx, text, maxWidth) => {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '…';
  },

  // ── Utility: status color set from ach vs pace ───────────────────────
  _statusColors: (status) => {
    const C = InfographicEngine.CLR;
    if (status === 'GOOD')    return { text: C.greenBright, bg: C.greenBg, border: C.green };
    if (status === 'WARNING') return { text: C.amberBright, bg: C.amberBg, border: C.amber };
    return                           { text: C.redBright,   bg: C.redBg,   border: C.red   };
  },

  // ── Utility: filter label string ────────────────────────────────────
  _filterLabel: () => {
    if (typeof State === 'undefined' || !State.filters || !State.options) return 'ALL DATA';
    const rSz = State.filters.regions    ? State.filters.regions.size    : 0;
    const pSz = State.filters.principles ? State.filters.principles.size : 0;
    const rTt = State.options.regions    ? State.options.regions.length    : 0;
    const pTt = State.options.principles ? State.options.principles.length : 0;
    const parts = [];
    if (rSz > 0 && rSz < rTt) parts.push(rSz + ' Region');
    if (pSz > 0 && pSz < pTt) parts.push(pSz + ' Principle');
    return parts.length ? parts.join(' · ') : 'ALL DATA';
  },

  // ════════════════════════════════════════════════════════════════════
  // DRAWING PRIMITIVES
  // ════════════════════════════════════════════════════════════════════

  // ── Draw section title bar ───────────────────────────────────────────
  drawSectionTitle: (ctx, text, x, y, w) => {
    const C = InfographicEngine.CLR;
    ctx.fillStyle = C.borderAccent;
    ctx.fillRect(x, y, 4, 22);
    ctx.font      = InfographicEngine.FONT.label(13);
    ctx.fillStyle = C.textSec;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), x + 12, y + 11);
    return y + 30;
  },

  // ── Draw metric card ─────────────────────────────────────────────────
  // x,y = top-left; w,h = dimensions; label = top caption; value = big number;
  // sub = small line below value; statusColor = hex for value color.
  drawMetricCard: (ctx, x, y, w, h, label, value, sub, valueColor) => {
    const C   = InfographicEngine.CLR;
    const pad = 14;
    InfographicEngine._rrect(ctx, x, y, w, h, 8);
    ctx.fillStyle = C.surface2;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Label
    ctx.font      = InfographicEngine.FONT.label(11);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + pad, y + pad);

    // Value
    ctx.font      = InfographicEngine.FONT.num(30);
    ctx.fillStyle = valueColor || C.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const valY = y + pad + 20;
    ctx.fillText(value, x + pad, valY);

    // Sub
    if (sub) {
      ctx.font      = InfographicEngine.FONT.sans(11);
      ctx.fillStyle = C.textSec;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(sub, x + pad, valY + 36);
    }
  },

  // ── Draw status pill ─────────────────────────────────────────────────
  drawStatusPill: (ctx, x, y, label, statusColors) => {
    const C   = InfographicEngine.CLR;
    ctx.font  = InfographicEngine.FONT.label(13);
    const tw  = ctx.measureText(label).width;
    const pw  = tw + 28;
    const ph  = 28;
    InfographicEngine._rrect(ctx, x, y, pw, ph, 6);
    ctx.fillStyle   = statusColors.bg;
    ctx.fill();
    ctx.strokeStyle = statusColors.border;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.fillStyle    = statusColors.text;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + pw/2, y + ph/2);
    return pw; // return width for caller positioning
  },

  // ── Draw mini horizontal bar ─────────────────────────────────────────
  // pct: 0–100; color: fill color; bgColor: track color
  drawMiniBar: (ctx, x, y, w, h, pct, color, bgColor) => {
    const C   = InfographicEngine.CLR;
    const r   = h / 2;
    // Track
    InfographicEngine._rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = bgColor || C.border;
    ctx.fill();
    // Fill
    const fw = Math.max(r * 2, (Math.min(pct, 100) / 100) * w);
    InfographicEngine._rrect(ctx, x, y, fw, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  },

  // ── Draw insight / narrative box ─────────────────────────────────────
  drawInsightBox: (ctx, x, y, w, text, accentColor) => {
    const C    = InfographicEngine.CLR;
    const pad  = 14;
    const lh   = 20;
    ctx.font   = InfographicEngine.FONT.sans(13);
    const lines = InfographicEngine._wrapText(ctx, text, w - pad*2 - 8);
    const shown = lines.slice(0, 4);
    const h     = pad + shown.length * lh + pad;

    InfographicEngine._rrect(ctx, x, y, w, h, 8);
    ctx.fillStyle = C.surface2;
    ctx.fill();
    // Accent left bar
    ctx.fillStyle = accentColor || C.accent;
    ctx.fillRect(x, y + 6, 3, h - 12);

    ctx.fillStyle    = C.textPrimary;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    shown.forEach((line, i) => ctx.fillText(line, x + pad + 8, y + pad + i * lh));
    return h;
  },

  // ── Draw region/principle mini row ───────────────────────────────────
  drawRankRow: (ctx, x, y, w, rank, name, ach, statusColor) => {
    const C     = InfographicEngine.CLR;
    const barW  = 120;
    const barH  = 7;
    const barX  = x + w - barW - 14;
    const barY  = y + 8;

    // Rank number
    ctx.font      = InfographicEngine.FONT.num(11);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(rank + '.', x + 24, y + 12);

    // Name
    ctx.font      = InfographicEngine.FONT.sans(13, 600);
    ctx.fillStyle = C.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxNameW = barX - x - 32;
    ctx.fillText(InfographicEngine._truncate(ctx, name, maxNameW), x + 30, y + 12);

    // Ach% text
    ctx.font      = InfographicEngine.FONT.num(13);
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(ach.toFixed(1) + '%', barX - 8, y + 12);

    // Mini bar
    InfographicEngine.drawMiniBar(ctx, barX, barY, barW, barH, ach, statusColor, C.border);

    return y + 28;
  },

  // ── Draw horizontal divider ──────────────────────────────────────────
  _divider: (ctx, y, x, w) => {
    const C = InfographicEngine.CLR;
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    return y + 1;
  },

  // ════════════════════════════════════════════════════════════════════
  // SECTION RENDERERS — Morning Briefing Card
  // ════════════════════════════════════════════════════════════════════

  // ── SECTION: Header ──────────────────────────────────────────────────
  // Returns: next y position
  _renderHeader: (ctx, k) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const tf  = TimeEngine.fmt();

    // Background gradient bar
    const grad = ctx.createLinearGradient(0, 0, W, 90);
    grad.addColorStop(0, '#0B1826');
    grad.addColorStop(1, '#101020');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 90);

    // Accent bottom line
    ctx.fillStyle = C.accent;
    ctx.fillRect(0, 88, W, 2);

    // Title
    ctx.font      = InfographicEngine.FONT.label(20);
    ctx.fillStyle = C.white;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('⚡ SALES CONTROL TOWER', 28, 18);

    // Subtitle — v5 + SHP
    ctx.font      = InfographicEngine.FONT.sans(12);
    ctx.fillStyle = C.accent;
    ctx.fillText('by SHP · Morning Briefing', 28, 44);

    // Right side — date + WD
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
    ctx.font      = InfographicEngine.FONT.num(12);
    ctx.fillStyle = C.textSec;
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 28, 18);

    ctx.font      = InfographicEngine.FONT.sans(11);
    ctx.fillStyle = C.textMuted;
    ctx.fillText(tf.hkLabel, W - 28, 38);

    // Filter state badge
    const fLabel = InfographicEngine._filterLabel();
    ctx.font      = InfographicEngine.FONT.label(10);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'right';
    ctx.fillText(fLabel, W - 28, 58);

    return 102;  // next y (header h=90 + 12 gap)
  },

  // ── SECTION: Top KPI row (4 metric cards) ────────────────────────────
  _renderKPIRow: (ctx, k, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const p   = k.perf;
    const td  = TimeEngine.get();
    const pad = 28;
    const gap = 12;
    const cw  = (W - pad*2 - gap*3) / 4;

    const status   = p.tgStatus?.status || 'DANGER';
    const sc       = InfographicEngine._statusColors(status);
    const achColor = sc.text;

    const cards = [
      {
        label: 'ACHIEVEMENT',
        value: Utils.fmtPct(p.ach),
        sub:   'vs ' + Utils.fmtPct(td.timeGone) + ' pace',
        color: achColor
      },
      {
        label: 'GAP TO TARGET',
        value: Utils.fmtCompact(p.gap),
        sub:   p.gap < 0 ? 'shortfall' : 'surplus',
        color: p.gap < 0 ? C.redBright : C.greenBright
      },
      {
        label: 'vs LAST MONTH',
        value: (p.vsLM >= 0 ? '+' : '') + p.vsLM.toFixed(1) + '%',
        sub:   p.vsLM >= 0 ? 'growth' : 'decline',
        color: p.vsLM >= 0 ? C.greenBright : C.redBright
      },
      {
        label: 'NEED / HK',
        value: Utils.fmtCompact(p.reqRR),
        sub:   'act: ' + Utils.fmtCompact(p.actRR),
        color: p.reqRR > p.actRR * 1.2 ? C.amberBright : C.greenBright
      }
    ];

    const h = 95;
    cards.forEach((card, i) => {
      const x = pad + i * (cw + gap);
      InfographicEngine.drawMetricCard(ctx, x, y, cw, h, card.label, card.value, card.sub, card.color);
    });

    return y + h + 16;
  },

  // ── SECTION: Overall Status ───────────────────────────────────────────
  _renderStatusBar: (ctx, k, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const p   = k.perf;
    const td  = TimeEngine.get();
    const pad = 28;

    const status   = p.tgStatus?.status || 'DANGER';
    const sc       = InfographicEngine._statusColors(status);

    // Status pill
    ctx.font = InfographicEngine.FONT.label(13);
    const pillLabel = status === 'GOOD' ? '✅  GOOD' : status === 'WARNING' ? '⚠  WARNING' : '🔴  DANGER';
    const pillW = InfographicEngine.drawStatusPill(ctx, pad, y, pillLabel, sc);

    // Time gone label
    const tf = TimeEngine.fmt();
    ctx.font      = InfographicEngine.FONT.sans(13);
    ctx.fillStyle = C.textSec;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tf.timeGoneLabel + '  ·  ' + tf.hkRemLabel, pad + pillW + 14, y + 14);

    // Pace bar
    const barX  = pad;
    const barY  = y + 36;
    const barW  = W - pad*2;
    const barH  = 8;
    // Track = timeGone marker
    InfographicEngine.drawMiniBar(ctx, barX, barY, barW, barH, td.timeGone, C.accentDim, C.surface2);
    // Achievement bar overlaid
    InfographicEngine.drawMiniBar(ctx, barX, barY, barW, barH, p.ach, sc.text, 'transparent');
    // Pace marker (vertical line)
    const paceX = barX + Math.round((td.timeGone / 100) * barW);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth   = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(paceX, barY - 4);
    ctx.lineTo(paceX, barY + barH + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    // Labels under bar
    ctx.font      = InfographicEngine.FONT.sans(10);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('0%', barX, barY + barH + 4);
    ctx.textAlign = 'right';
    ctx.fillText('100%', barX + barW, barY + barH + 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.accent;
    ctx.fillText('pace', paceX, barY + barH + 4);

    return y + 36 + barH + 20 + 12;
  },

  // ── SECTION: Biggest Issue + Growth (2 columns) ───────────────────────
  _renderIssueGrowth: (ctx, k, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const pad = 28;
    const gap = 12;
    const cw  = (W - pad*2 - gap) / 2;

    // ── Left: Biggest Issue (worst principle) ──
    let nextY = y;
    nextY = InfographicEngine.drawSectionTitle(ctx, 'Biggest Issue', pad, nextY, cw);

    const worstPrin = k.perf.byPrin.slice().sort((a,b) => a.ach - b.ach)[0];
    const worstReg  = k.perf.byReg[0];
    const worstCat  = k.perf.byCategory?.slice().sort((a,b) => a.ach - b.ach)[0];

    // Worst principle
    if (worstPrin) {
      const sc    = InfographicEngine._statusColors(worstPrin.tgStatus?.status || 'DANGER');
      const nextR = InfographicEngine.drawRankRow(ctx, pad, nextY, cw, 1, worstPrin.principle, worstPrin.ach, sc.text);
      nextY = nextR + 4;
    }
    // Worst region
    if (worstReg) {
      const regAch = worstReg.ach;
      const regSt  = regAch >= 80 ? 'GOOD' : regAch >= 60 ? 'WARNING' : 'DANGER';
      const sc     = InfographicEngine._statusColors(regSt);
      const nextR  = InfographicEngine.drawRankRow(ctx, pad, nextY, cw, 2, worstReg.region, regAch, sc.text);
      nextY = nextR + 4;
    }
    // Worst category
    if (worstCat) {
      const catAch = worstCat.ach;
      const catSt  = catAch >= 80 ? 'GOOD' : catAch >= 60 ? 'WARNING' : 'DANGER';
      const sc     = InfographicEngine._statusColors(catSt);
      const nextR  = InfographicEngine.drawRankRow(ctx, pad, nextY, cw, 3, worstCat.category || worstCat.subKat || '—', catAch, sc.text);
      nextY = nextR;
    }

    // ── Right: Biggest Growth ──
    const rx = pad + cw + gap;
    let nextY2 = y;
    nextY2 = InfographicEngine.drawSectionTitle(ctx, 'Biggest Growth', rx, nextY2, cw);

    const bestPrin = k.perf.byPrin.filter(p => p.trend?.hasLM).sort((a,b) => (b.trend?.vsLM??-99)-(a.trend?.vsLM??-99))[0];
    const bestReg  = k.perf.byReg.slice().sort((a,b) => b.ach - a.ach)[0];
    const bestCat  = k.perf.byCategory?.filter(c => c.trend?.hasLM).sort((a,b)=>(b.trend?.vsLM??-99)-(a.trend?.vsLM??-99))[0];

    if (bestPrin) {
      const sc    = InfographicEngine._statusColors(bestPrin.tgStatus?.status || 'GOOD');
      const nextR = InfographicEngine.drawRankRow(ctx, rx, nextY2, cw, 1, bestPrin.principle, bestPrin.ach, sc.text);
      nextY2 = nextR + 4;
    }
    if (bestReg) {
      const regSt = bestReg.ach >= 80 ? 'GOOD' : bestReg.ach >= 60 ? 'WARNING' : 'DANGER';
      const sc    = InfographicEngine._statusColors(regSt);
      const nextR = InfographicEngine.drawRankRow(ctx, rx, nextY2, cw, 2, bestReg.region, bestReg.ach, sc.text);
      nextY2 = nextR + 4;
    }
    if (bestCat) {
      const catSt = bestCat.ach >= 80 ? 'GOOD' : bestCat.ach >= 60 ? 'WARNING' : 'DANGER';
      const sc    = InfographicEngine._statusColors(catSt);
      const nextR = InfographicEngine.drawRankRow(ctx, rx, nextY2, cw, 3, bestCat.category || bestCat.subKat || '—', bestCat.ach, sc.text);
      nextY2 = nextR;
    }

    return Math.max(nextY, nextY2) + 18;
  },

  // ── SECTION: Action Today ─────────────────────────────────────────────
  _renderActionToday: (ctx, k, y) => {
    const C     = InfographicEngine.CLR;
    const W     = InfographicEngine.W;
    const pad   = 28;
    const iw    = W - pad*2;

    y = InfographicEngine.drawSectionTitle(ctx, 'Priority Action Today', pad, y, iw);

    const alerts = k.alerts;
    if (!alerts || !alerts.top5 || !alerts.top5.length) {
      const h = InfographicEngine.drawInsightBox(ctx, pad, y, iw,
        '✅ Tidak ada aksi prioritas terdeteksi — semua KPI dalam kondisi normal.', C.greenBright);
      return y + h + 12;
    }

    // Top 2 actions
    const top2 = alerts.top5.slice(0, 2);
    let currentY = y;
    top2.forEach((issue, i) => {
      const actionText = '→ ' + (issue.action || issue.headline || '');
      const score   = issue.severityScore || 0;
      const color   = score >= 45 ? C.redBright : score >= 20 ? C.amberBright : C.blueBright;
      const h       = InfographicEngine.drawInsightBox(ctx, pad, currentY, iw, actionText, color);
      currentY += h + 8;
    });

    return currentY + 8;
  },

  // ── SECTION: Top Alert ────────────────────────────────────────────────
  _renderTopAlert: (ctx, k, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const pad = 28;
    const iw  = W - pad*2;

    y = InfographicEngine.drawSectionTitle(ctx, 'Top Alert', pad, y, iw);

    const top = k.alerts?.topIssue;
    if (!top) {
      const h = InfographicEngine.drawInsightBox(ctx, pad, y, iw,
        '✅ Tidak ada alert kritis — dashboard dalam kondisi operasional normal.', C.greenBright);
      return y + h + 12;
    }

    const score  = top.severityScore || 0;
    const color  = score >= 70 ? C.redBright : score >= 45 ? C.redBright : score >= 20 ? C.amberBright : C.blueBright;
    const text   = (top.badgeLabel || '') + '  ' + (top.headline || '') + '  →  ' + (top.action || '');
    const h      = InfographicEngine.drawInsightBox(ctx, pad, y, iw, text, color);
    return y + h + 12;
  },

  // ── SECTION: Executive Summary AI ────────────────────────────────────
  _renderExecSummary: (ctx, k, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const pad = 28;
    const iw  = W - pad*2;

    y = InfographicEngine.drawSectionTitle(ctx, 'Executive Summary', pad, y, iw);

    // Pull performance slot sentence from ExecSummaryEngine
    const slots    = k.execSlots || [];
    const perfSlot = slots.find(s => s?.slot === 'PERFORMANCE');
    const issSlot  = slots.find(s => s?.slot === 'ISSUE');

    let summary = '';
    if (perfSlot?.sentence) summary += perfSlot.sentence + ' ';
    if (issSlot?.sentence)  summary += issSlot.sentence;
    if (!summary.trim()) {
      // Fallback: build from raw KPI
      const p = k.perf;
      const td = TimeEngine.get();
      summary = `Capaian ${Utils.fmtPct(p.ach)} vs pace ${Utils.fmtPct(td.timeGone)} — `
              + `gap ${Utils.fmtCompact(p.gap)}, butuh ${Utils.fmtCompact(p.reqRR)}/HK di sisa ${td.hkRem} HK.`;
    }

    const sc    = InfographicEngine._statusColors(k.perf.tgStatus?.status || 'DANGER');
    const h     = InfographicEngine.drawInsightBox(ctx, pad, y, iw, summary.trim(), sc.text);
    return y + h + 12;
  },

  // ── SECTION: Footer ───────────────────────────────────────────────────
  _renderFooter: (ctx, y) => {
    const C   = InfographicEngine.CLR;
    const W   = InfographicEngine.W;
    const H   = InfographicEngine.H;

    // Separator
    InfographicEngine._divider(ctx, H - 42, 28, W - 56);

    ctx.font      = InfographicEngine.FONT.sans(11);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const now = new Date();
    const ts  = now.toLocaleString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    ctx.fillText(`⚡ Sales Control Tower v5  ·  Generated ${ts} WIB`, W/2, H - 22);
  },

  // ════════════════════════════════════════════════════════════════════
  // MAIN RENDER — Morning Briefing Card
  // ════════════════════════════════════════════════════════════════════

  renderMorningBriefing: () => {
    // Guard: requires KPI data
    if (typeof State === 'undefined' || !State.kpi || !State.kpi.perf) {
      ExportEngine._toast('No data loaded — upload Excel file first', 'error');
      return null;
    }

    const k      = State.kpi;
    const canvas = InfographicEngine._createCanvas();
    const ctx    = InfographicEngine._getCtx(canvas);

    // ── Full background ──
    ctx.fillStyle = InfographicEngine.CLR.bg;
    ctx.fillRect(0, 0, InfographicEngine.W, InfographicEngine.H);

    // ── Render sections top-down, each returns next Y ──
    let y = InfographicEngine._renderHeader(ctx, k);

    y = InfographicEngine._divider(ctx, y - 2, 28, InfographicEngine.W - 56);
    y += 12;

    y = InfographicEngine._renderKPIRow(ctx, k, y);

    y = InfographicEngine._divider(ctx, y, 28, InfographicEngine.W - 56);
    y += 14;

    y = InfographicEngine._renderStatusBar(ctx, k, y);

    y = InfographicEngine._divider(ctx, y, 28, InfographicEngine.W - 56);
    y += 14;

    y = InfographicEngine._renderIssueGrowth(ctx, k, y);

    y = InfographicEngine._divider(ctx, y, 28, InfographicEngine.W - 56);
    y += 14;

    y = InfographicEngine._renderActionToday(ctx, k, y);

    // Remaining space check before alert + summary
    const remaining = InfographicEngine.H - 80 - y;  // 80 = footer reserve
    if (remaining > 80) {
      y = InfographicEngine._divider(ctx, y, 28, InfographicEngine.W - 56);
      y += 10;
      y = InfographicEngine._renderTopAlert(ctx, k, y);
    }
    if (remaining > 160) {
      y = InfographicEngine._divider(ctx, y, 28, InfographicEngine.W - 56);
      y += 10;
      y = InfographicEngine._renderExecSummary(ctx, k, y);
    }

    InfographicEngine._renderFooter(ctx, y);

    return canvas;
  },

  // ════════════════════════════════════════════════════════════════════
  // EXPORT API
  // ════════════════════════════════════════════════════════════════════

  // ── Wait for fonts before rendering ──────────────────────────────────
  _fontsReady: () => {
    if (document.fonts && document.fonts.ready) return document.fonts.ready;
    return Promise.resolve();
  },

  // ── Download as PNG ───────────────────────────────────────────────────
  exportCard: async (cardType) => {
    await InfographicEngine._fontsReady();
    const canvas = InfographicEngine.renderMorningBriefing();
    if (!canvas) return;
    InfographicEngine.downloadCard(canvas, cardType || 'MorningBriefing');
  },

  downloadCard: (canvas, label) => {
    const n    = new Date();
    const d    = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}`;
    const t    = `${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const name = `SCT_ExecCard_${label}_${d}_${t}.png`;
    const link = document.createElement('a');
    link.download = name;
    link.href     = canvas.toDataURL('image/png', 1.0);
    link.click();
    if (typeof ExportEngine !== 'undefined') {
      ExportEngine._toast('Executive Card downloaded: ' + name, 'success');
    }
  },

  copyToClipboard: async () => {
    if (!navigator.clipboard || !window.ClipboardItem) {
      if (typeof ExportEngine !== 'undefined') {
        ExportEngine._toast('Clipboard API requires HTTPS', 'error');
      }
      return;
    }
    await InfographicEngine._fontsReady();
    const canvas = InfographicEngine.renderMorningBriefing();
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        if (typeof ExportEngine !== 'undefined') {
          ExportEngine._toast('Executive Card copied to clipboard', 'info');
        }
      } catch (e) {
        if (typeof ExportEngine !== 'undefined') {
          ExportEngine._toast('Clipboard write failed — requires HTTPS', 'error');
        }
      }
    }, 'image/png', 1.0);
  },

  // ── V5 PRESERVED stubs (kept for backward compat) ──────────────────
  // Callers should use v6 public API below instead.
  renderPrincipleAlert:  () => { console.log('[InfographicEngine] use generatePrincipleAlert()'); return null; },
  renderChannelWatch:    () => { console.log('[InfographicEngine] use generateChannelWatch()');   return null; },
  renderPSPerformance:   () => { console.log('[InfographicEngine] use generatePSPerformance()');  return null; },

  // ════════════════════════════════════════════════════════════════════
  // V6 PUBLIC API — skeleton methods (logic implemented per phase)
  // ════════════════════════════════════════════════════════════════════

  // ── V6 Phase 1A: Daily Briefing (enhanced from v5 renderMorningBriefing) ──
  // [V6 PHASE 1A] Replace stub with full enhanced implementation
  generateDailyBriefing: () => {
    console.log('[InfographicEngine v6] generateDailyBriefing — routing to renderMorningBriefing (Phase 1A stub)');
    // Phase 1A will enhance this with drawHeroMetric, drawActionList, drawNarrative, Channel Watch mini-section
    return InfographicEngine.renderMorningBriefing();
  },

  // ── V6 Phase 1B: Channel Watch Infographic ────────────────────────────
  // [V6 PHASE 1B] Implement: k.ca.byCh[] → Channel Watch 1080×1350px card
  generateChannelWatch: () => {
    console.log('[InfographicEngine v6] generateChannelWatch — Phase 1B (not yet implemented)');
    if (typeof ExportEngine !== 'undefined') {
      ExportEngine._toast('Channel Watch card — coming in v6 Phase 1B', 'info', 2500);
    }
    return null;
  },

  // ── V6 Phase 2: Principle Alert Infographic ───────────────────────────
  // [V6 FUTURE] Implement: k.perf.byPrin → Principle Alert 1080×1350px card
  generatePrincipleAlert: () => {
    console.log('[InfographicEngine v6] generatePrincipleAlert — Phase 2 (not yet implemented)');
    if (typeof ExportEngine !== 'undefined') {
      ExportEngine._toast('Principle Alert card — coming in v6 Phase 2', 'info', 2500);
    }
    return null;
  },

  // ── V6 Phase 2: Region Alert Infographic ──────────────────────────────
  // [V6 FUTURE] Implement: k.perf.byReg → Region Alert 1080×1350px card
  generateRegionAlert: () => {
    console.log('[InfographicEngine v6] generateRegionAlert — Phase 2 (not yet implemented)');
    if (typeof ExportEngine !== 'undefined') {
      ExportEngine._toast('Region Alert card — coming in v6 Phase 2', 'info', 2500);
    }
    return null;
  },

  // ── V6 Phase 2: PS Performance Infographic ────────────────────────────
  // [V6 FUTURE] Implement: k.ps → PS Performance 1080×1350px card
  generatePSPerformance: () => {
    console.log('[InfographicEngine v6] generatePSPerformance — Phase 2 (not yet implemented)');
    if (typeof ExportEngine !== 'undefined') {
      ExportEngine._toast('PS Performance card — coming in v6 Phase 2', 'info', 2500);
    }
    return null;
  },

  // ════════════════════════════════════════════════════════════════════
  // V6 NEW DRAWING PRIMITIVES — stubs (implemented per phase)
  // Each returns null until phase implementation.
  // ════════════════════════════════════════════════════════════════════

  // ── [V6 PHASE 1A] drawHeroMetric — IMPLEMENTED ──────────────────────
  //
  // Executive KPI hero block. Canvas2D only. WhatsApp-validated font sizes.
  //
  // @param {CanvasRenderingContext2D} ctx
  // @param {number} x, y       — top-left of the card
  // @param {number} w, h       — dimensions (recommended h: 200–240px)
  // @param {object} config
  //   label      {string}       — metric name, auto-uppercased  e.g. "Achievement"
  //   value      {string}       — pre-formatted dominant value  e.g. "82.4%"
  //   sub        {string|null}  — secondary line               e.g. "vs 65.2% pace"
  //   trend      {string|null}  — magnitude without arrow      e.g. "+4.2%"
  //   trendDir   {"up"|"down"|null} — controls arrow + color
  //   accent     {string|null}  — left bar + progress color    defaults: CLR.accent
  //   valueColor {string|null}  — value text color             defaults: CLR.textPrimary
  //   progress   {number|null}  — 0–100 fills progress bar; null = no bar
  //   footer     {string|null}  — bottom-right small label     e.g. "Target: 285B"
  //   bg         {string|null}  — card background              defaults: CLR.surface2
  //
  // @returns {number} — bottom edge y (y + h), for stacking caller logic
  //
  drawHeroMetric: (ctx, x, y, w, h, config) => {
    const C    = InfographicEngine.CLR;
    const F    = InfographicEngine.FONT;
    const cfg  = config || {};

    // ── Resolved values with safe defaults ──────────────────────────────
    const accentColor = cfg.accent      || C.accent;
    const valueFill   = cfg.valueColor  || C.textPrimary;
    const cardBg      = cfg.bg          || C.surface2;
    const hasTrend    = cfg.trend && cfg.trendDir;
    const hasProgress = typeof cfg.progress === 'number';
    const hasFooter   = !!cfg.footer;
    const hasSub      = !!cfg.sub;

    // ── Layout constants ─────────────────────────────────────────────────
    const PAD    = 22;   // inner padding
    const LABEL_SIZE  = 22;
    const VALUE_SIZE  = 80;
    const SUB_SIZE    = 26;
    const FOOTER_SIZE = 18;
    const TREND_SIZE  = 20;
    const BAR_H       = 6;
    const ACCENT_W    = 4;   // left accent bar width

    // ── 1. Card background ───────────────────────────────────────────────
    InfographicEngine._rrect(ctx, x, y, w, h, 12);
    ctx.fillStyle = cardBg;
    ctx.fill();

    // ── 2. Card border — subtle 1px ──────────────────────────────────────
    InfographicEngine._rrect(ctx, x, y, w, h, 12);
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.stroke();

    // ── 3. Left accent bar — visual identity / status indicator ──────────
    // Clipped to card left edge with matching top/bottom corner radius
    const accentBarY1 = y + 12;
    const accentBarH  = h - 24;
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.moveTo(x, accentBarY1 + 4);
    ctx.arcTo(x, accentBarY1, x + ACCENT_W, accentBarY1, 4);
    ctx.lineTo(x + ACCENT_W, accentBarY1 + accentBarH - 4);
    ctx.arcTo(x + ACCENT_W, accentBarY1 + accentBarH, x, accentBarY1 + accentBarH, 4);
    ctx.lineTo(x, accentBarY1 + accentBarH);
    ctx.closePath();
    ctx.fill();

    // ── 4. Label — small uppercase at top-left ───────────────────────────
    const labelX = x + PAD + ACCENT_W + 4;
    const labelY = y + PAD;
    ctx.font         = F.label(LABEL_SIZE);
    ctx.fillStyle    = C.textSec;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText((cfg.label || 'METRIC').toUpperCase(), labelX, labelY);

    // ── 5. Trend pill — top-right corner ─────────────────────────────────
    if (hasTrend) {
      const isUp         = cfg.trendDir === 'up';
      const arrow        = isUp ? '▲' : '▼';
      const pillText     = arrow + ' ' + cfg.trend;
      const pillBg       = isUp ? C.greenBg  : C.redBg;
      const pillBorder   = isUp ? C.green    : C.red;
      const pillTextClr  = isUp ? C.greenBright : C.redBright;

      ctx.font = `700 ${TREND_SIZE}px "IBM Plex Sans", sans-serif`;
      const tw  = ctx.measureText(pillText).width;
      const pw  = tw + 24;   // 12px padding each side
      const ph  = 30;
      const px  = x + w - PAD - pw;
      const py  = y + PAD - 2;

      InfographicEngine._rrect(ctx, px, py, pw, ph, ph / 2);
      ctx.fillStyle   = pillBg;
      ctx.fill();
      ctx.strokeStyle = pillBorder;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.fillStyle    = pillTextClr;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, px + pw / 2, py + ph / 2);
    }

    // ── 6. Value — dominant focal point ──────────────────────────────────
    const valueY = labelY + LABEL_SIZE + 12;
    ctx.font         = F.num(VALUE_SIZE, 800);
    ctx.fillStyle    = valueFill;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    // Measure to ensure it fits — truncate with ellipsis if needed
    const maxValW = w - PAD * 2 - ACCENT_W - 8;
    const valText = InfographicEngine._truncate(ctx, String(cfg.value || '—'), maxValW);
    ctx.fillText(valText, labelX, valueY);

    // ── 7. Sub-text — below value ─────────────────────────────────────────
    let subBottomY = valueY + VALUE_SIZE + 6;
    if (hasSub) {
      ctx.font         = `400 ${SUB_SIZE}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle    = C.textSec;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      const subText = InfographicEngine._truncate(ctx, cfg.sub, maxValW);
      ctx.fillText(subText, labelX, subBottomY);
      subBottomY += SUB_SIZE + 4;
    }

    // ── 8. Progress bar — optional ────────────────────────────────────────
    if (hasProgress) {
      const barX = x + PAD + ACCENT_W + 4;
      const barW = w - PAD * 2 - ACCENT_W - 4;
      // Bottom-anchored: sits above footer if present, else above bottom pad
      const barY = hasFooter
        ? y + h - PAD - FOOTER_SIZE - 10 - BAR_H
        : y + h - PAD - BAR_H;

      // Track
      InfographicEngine._rrect(ctx, barX, barY, barW, BAR_H, BAR_H / 2);
      ctx.fillStyle = C.border;
      ctx.fill();

      // Fill — clamped to 0–100
      const pct   = Math.max(0, Math.min(100, cfg.progress));
      const fillW = Math.max(BAR_H, (pct / 100) * barW);
      InfographicEngine._rrect(ctx, barX, barY, fillW, BAR_H, BAR_H / 2);
      ctx.fillStyle = accentColor;
      ctx.fill();

      // Progress percentage label — right-aligned, just above bar
      ctx.font         = `600 14px "IBM Plex Mono", monospace`;
      ctx.fillStyle    = accentColor;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(pct.toFixed(1) + '%', barX + barW, barY - 3);
    }

    // ── 9. Footer text — bottom-right small label ─────────────────────────
    if (hasFooter) {
      const footerY = y + h - PAD;
      ctx.font         = `400 ${FOOTER_SIZE}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'bottom';
      const footerText = InfographicEngine._truncate(ctx, cfg.footer, w - PAD * 2);
      ctx.fillText(footerText, x + w - PAD, footerY);
    }

    // ── 10. Return bottom edge y for caller stacking ──────────────────────
    return y + h;
  },

  // ── [V6 PHASE 1A] testHeroMetric — preview generator ─────────────────
  //
  // Creates a 1080×1350 test canvas showing drawHeroMetric in all variants.
  // Call from browser console: InfographicEngine.testHeroMetric()
  // Or: const c = InfographicEngine.testHeroMetric(); document.body.appendChild(c)
  //
  testHeroMetric: () => {
    const IE   = InfographicEngine;
    const C    = IE.CLR;
    const F    = IE.FONT;
    const canvas = IE._createCanvas();
    const ctx    = IE._getCtx(canvas);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, IE.W, IE.H);

    // Title
    ctx.font         = F.label(22);
    ctx.fillStyle    = C.textSec;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('drawHeroMetric — v6 Component Test', 28, 28);

    ctx.font      = F.sans(16);
    ctx.fillStyle = C.textMuted;
    ctx.fillText('All variants · 1080×1350 · IBM Plex · Canvas2D only', 28, 56);

    // Divider
    ctx.strokeStyle = C.border; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(28, 80); ctx.lineTo(IE.W - 28, 80); ctx.stroke();

    const CW  = IE.W - 56;   // card width (28px margin each side)
    const CX  = 28;
    let   cy  = 96;
    const GAP = 18;

    // ── Variant 1: GOOD status — Achievement % with progress ──
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted; ctx.textBaseline = 'top';
    ctx.fillText('Variant 1: Achievement % — GOOD status, trend up, progress bar, footer', CX, cy);
    cy += 24;
    cy = IE.drawHeroMetric(ctx, CX, cy, CW, 230, {
      label:      'Overall Achievement',
      value:      '86.3%',
      sub:        'vs 78.5% time-gone pace  ·  WD 18/23',
      trend:      '+4.2%',
      trendDir:   'up',
      accent:     C.greenBright,
      valueColor: C.greenBright,
      progress:   86.3,
      footer:     'Target: 285B  ·  Actual: 246B',
    });
    cy += GAP;

    // ── Variant 2: DANGER status — Achievement lagging ──
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted; ctx.textBaseline = 'top';
    ctx.fillText('Variant 2: Achievement % — DANGER status, trend down, no progress', CX, cy);
    cy += 24;
    cy = IE.drawHeroMetric(ctx, CX, cy, CW, 210, {
      label:      'Overall Achievement',
      value:      '58.2%',
      sub:        'Tertinggal 15.3pp dari pace  ·  WD 18/23',
      trend:      '-8.1%',
      trendDir:   'down',
      accent:     C.redBright,
      valueColor: C.redBright,
      footer:     'Gap: -127B  ·  Butuh 14.2M/HK',
    });
    cy += GAP;

    // ── Variant 3: WARNING — Gap metric, amber accent ──
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted; ctx.textBaseline = 'top';
    ctx.fillText('Variant 3: Gap to Target — WARNING, amber accent, no trend pill', CX, cy);
    cy += 24;
    cy = IE.drawHeroMetric(ctx, CX, cy, CW, 200, {
      label:      'Gap to Target',
      value:      '-47.3B',
      sub:        'Shortfall dari target TM',
      trend:      null,
      trendDir:   null,
      accent:     C.amberBright,
      valueColor: C.amberBright,
      footer:     'Butuh 11.8M/HK di sisa 8 HK',
    });
    cy += GAP;

    // ── Variant 4: Growth vs LM — blue accent, positive ──
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted; ctx.textBaseline = 'top';
    ctx.fillText('Variant 4: Growth vs LM — positive, blue accent, progress bar', CX, cy);
    cy += 24;
    cy = IE.drawHeroMetric(ctx, CX, cy, CW, 220, {
      label:      'Growth vs Last Month',
      value:      '+12.4%',
      sub:        'Pertumbuhan tertinggi 3 bulan terakhir',
      trend:      '+12.4%',
      trendDir:   'up',
      accent:     C.blueBright,
      valueColor: C.blueBright,
      progress:   72,
      footer:     'LM: 219B  ·  TM: 246B',
    });
    cy += GAP;

    // ── Variant 5: CA Zero Risk — compact, no sub, no footer ──
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted; ctx.textBaseline = 'top';
    ctx.fillText('Variant 5: CA Zero Risk — compact h=175, minimal config', CX, cy);
    cy += 24;
    cy = IE.drawHeroMetric(ctx, CX, cy, CW, 175, {
      label:      'CA Zero Risk',
      value:      '18.4%',
      sub:        '92 outlets zero-transaksi dari 500 CA LM',
      trend:      '+3.1%',
      trendDir:   'down',
      accent:     C.amber,
      valueColor: C.amberBright,
    });
    cy += GAP;

    // Footer
    ctx.font      = F.sans(15);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ InfographicEngine v6 · drawHeroMetric · Canvas2D · IBM Plex', IE.W / 2, IE.H - 30);

    // Trigger download
    const n    = new Date();
    const ts   = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}_${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const link = document.createElement('a');
    link.download = `test_drawHeroMetric_${ts}.png`;
    link.href     = canvas.toDataURL('image/png', 1.0);
    link.click();

    console.log('[InfographicEngine] testHeroMetric() complete — PNG download triggered');
    console.log(`[InfographicEngine] Final y used: ${cy} of ${IE.H}px`);
    return canvas;
  },

  // ── [V6 PHASE 1B] drawChannelRow ──────────────────────────────────────
  // Single channel row: name + delta pill + CA actual + mini bar.
  // params: ctx, x, y, w, ch { name, ca, lm, delta, gap }, showBar
  // Data source: k.ca.byCh[] (already in KPIEngine, no new computation)
  // [V6 PHASE 1B] Implement for Channel Watch card rows
  drawChannelRow: (ctx, x, y, w, ch, showBar) => {
    // stub — returns null until Phase 1B
    return null;
  },

  // ── [V6 PHASE 1A/1B] drawMiniTrend — IMPLEMENTED ───────────────────
  //
  // Premium sparkline renderer. Canvas2D only. No SVG, no chart lib.
  // WhatsApp-validated line weights (2-3px). Bloomberg/TradingView style.
  //
  // @param {CanvasRenderingContext2D} ctx
  // @param {number} x, y          — top-left of bounding box
  // @param {number} w, h          — width × height of the sparkline area
  // @param {number[]} data        — array of numeric values (any range, any length)
  //                                 empty / null → flat placeholder line
  // @param {object|string} config — config object OR legacy hex string (compat)
  //   stroke        {string}       — line color            default: CLR.accent
  //   lineWidth     {number}       — line thickness (px)   default: 2
  //   showArea      {boolean}      — gradient area fill    default: true
  //   showLastDot   {boolean}      — 3-layer end dot       default: true
  //   showDots      {boolean}      — dot on every point    default: false
  //   showHighLow   {boolean}      — H/L markers           default: false
  //   smooth        {boolean}      — quadratic Bezier      default: true
  //   baseline      {number|null}  — data-space value for dashed baseline
  //   baselineColor {string|null}  — dashed line color     default: textMuted
  //   trendDir      {"up"|"down"|"flat"|"auto"|null}  — overrides stroke color
  //   dangerThreshold {number|null} — value below which line turns red
  //   padding       {number}       — vertical pad fraction (0–0.5) default: 0.10
  //
  // @returns {object} — { lastX, lastY } pixel coords of last drawn point
  //                     useful for placing labels next to the sparkline
  //
  drawMiniTrend: (ctx, x, y, w, h, data, config) => {
    const C = InfographicEngine.CLR;

    // ── 0. Dimension guard ─────────────────────────────────────────────
    if (!w || !h || w < 4 || h < 4) return { lastX: x, lastY: y + h / 2 };

    // ── 1. Backward-compat: string → config.stroke ────────────────────
    const cfg = (typeof config === 'string')
      ? { stroke: config }
      : (config || {});

    // ── 2. Clean and validate data array ──────────────────────────────
    const raw = Array.isArray(data) ? data : [];
    const pts = raw.map(Number).filter(v => isFinite(v));  // strip NaN/null

    // ── 3. Resolve stroke color from trendDir or config ───────────────
    let strokeColor = cfg.stroke || C.accent;
    const td = cfg.trendDir;
    if (td === 'up')                                 strokeColor = C.greenBright;
    else if (td === 'down')                          strokeColor = C.redBright;
    else if (td === 'flat')                          strokeColor = C.textSec;
    else if (td === 'auto' && pts.length >= 2) {
      const delta = pts[pts.length - 1] - pts[0];
      strokeColor = delta > 0 ? C.greenBright : delta < 0 ? C.redBright : C.textSec;
    }

    // ── 4. Config defaults ─────────────────────────────────────────────
    const lineWidth     = cfg.lineWidth   ?? 2;
    const showArea      = cfg.showArea    ?? true;
    const showLastDot   = cfg.showLastDot ?? true;
    const showDots      = cfg.showDots    ?? false;
    const showHighLow   = cfg.showHighLow ?? false;
    const smooth        = cfg.smooth      ?? true;
    const padFrac       = Math.max(0, Math.min(0.45, cfg.padding ?? 0.10));
    const padPx         = h * padFrac;

    // ── 5. Flat placeholder — empty or single-value data ──────────────
    const flatY = y + h / 2;
    if (pts.length === 0) {
      ctx.save();
      ctx.strokeStyle = C.textMuted;
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(x, flatY);
      ctx.lineTo(x + w, flatY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return { lastX: x + w, lastY: flatY };
    }

    if (pts.length === 1) {
      // Single dot at center
      ctx.save();
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(x + w / 2, flatY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return { lastX: x + w / 2, lastY: flatY };
    }

    // ── 6. Normalize: data values → canvas coordinates ────────────────
    const mn = Math.min(...pts);
    const mx = Math.max(...pts);
    const range = mx - mn;

    const toX = (i) => {
      if (pts.length === 1) return x + w / 2;
      return x + (i / (pts.length - 1)) * w;
    };
    const toY = (v) => {
      if (range === 0) return y + h / 2;  // flat line exactly centered
      return y + h - padPx - ((v - mn) / range) * (h - padPx * 2);
    };

    const canvasPts = pts.map((v, i) => ({ px: toX(i), py: toY(v), v }));
    const first     = canvasPts[0];
    const last      = canvasPts[canvasPts.length - 1];

    // ── 7. Danger override: if last value below dangerThreshold ────────
    if (typeof cfg.dangerThreshold === 'number' && last.v < cfg.dangerThreshold) {
      strokeColor = C.redBright;
    }

    // ── 8. Save context state ──────────────────────────────────────────
    ctx.save();

    // Clip to bounding box — prevents overflow into adjacent cells
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // ── 9. Baseline (dashed reference line) ───────────────────────────
    if (typeof cfg.baseline === 'number') {
      const blY = toY(cfg.baseline);
      ctx.strokeStyle  = cfg.baselineColor || InfographicEngine._hexToRgba(C.textMuted, 0.45);
      ctx.lineWidth    = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, blY);
      ctx.lineTo(x + w, blY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── 10. Build the sparkline path ──────────────────────────────────
    // Uses quadratic Bezier mid-point smoothing:
    //   Control point = previous data point
    //   Curve endpoint = midpoint between current and previous
    //   Final segment = lineTo last point (ensures line ends exactly on last datum)
    ctx.beginPath();
    ctx.moveTo(first.px, first.py);

    if (smooth && canvasPts.length > 2) {
      for (let i = 1; i < canvasPts.length - 1; i++) {
        const prev = canvasPts[i - 1];
        const curr = canvasPts[i];
        const midX = (prev.px + curr.px) / 2;
        const midY = (prev.py + curr.py) / 2;
        ctx.quadraticCurveTo(prev.px, prev.py, midX, midY);
      }
      // Final segment: from last-mid to last point
      const secondLast = canvasPts[canvasPts.length - 2];
      ctx.quadraticCurveTo(secondLast.px, secondLast.py, last.px, last.py);
    } else {
      // Straight segments (smooth:false or only 2 points)
      for (let i = 1; i < canvasPts.length; i++) {
        ctx.lineTo(canvasPts[i].px, canvasPts[i].py);
      }
    }

    // ── 11. Area fill (gradient, under the line) ──────────────────────
    if (showArea) {
      // Re-use the path: extend to bottom corners then close for fill
      ctx.lineTo(last.px, y + h);
      ctx.lineTo(first.px, y + h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(x, y, x, y + h);
      const rgb  = InfographicEngine._hexToRgba(strokeColor, 0.18);
      const rgb0 = InfographicEngine._hexToRgba(strokeColor, 0.00);
      grad.addColorStop(0, rgb);
      grad.addColorStop(1, rgb0);
      ctx.fillStyle = grad;
      ctx.fill();

      // Re-draw the line path (fill destroyed the stroke)
      ctx.beginPath();
      ctx.moveTo(first.px, first.py);
      if (smooth && canvasPts.length > 2) {
        for (let i = 1; i < canvasPts.length - 1; i++) {
          const prev = canvasPts[i - 1];
          const curr = canvasPts[i];
          const midX = (prev.px + curr.px) / 2;
          const midY = (prev.py + curr.py) / 2;
          ctx.quadraticCurveTo(prev.px, prev.py, midX, midY);
        }
        const secondLast = canvasPts[canvasPts.length - 2];
        ctx.quadraticCurveTo(secondLast.px, secondLast.py, last.px, last.py);
      } else {
        for (let i = 1; i < canvasPts.length; i++) {
          ctx.lineTo(canvasPts[i].px, canvasPts[i].py);
        }
      }
    }

    // ── 12. Stroke the line ───────────────────────────────────────────
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth   = lineWidth;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.stroke();

    // ── 13. All-point dots (optional, showDots:true) ──────────────────
    if (showDots && h >= 16) {
      canvasPts.forEach((pt, i) => {
        if (i === canvasPts.length - 1) return; // last dot drawn separately
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = InfographicEngine._hexToRgba(strokeColor, 0.6);
        ctx.fill();
      });
    }

    // ── 14. High / Low markers (optional, showHighLow:true) ───────────
    if (showHighLow && h >= 24 && pts.length >= 3) {
      let maxIdx = 0, minIdx = 0;
      pts.forEach((v, i) => {
        if (v > pts[maxIdx]) maxIdx = i;
        if (v < pts[minIdx]) minIdx = i;
      });
      const lastIdx = pts.length - 1;

      const drawHL = (pt, label, isHigh) => {
        // Skip if overlaps last point
        if (Math.abs(pt.px - last.px) < 8 && Math.abs(pt.py - last.py) < 8) return;
        // Tiny marker dot
        ctx.beginPath();
        ctx.arc(pt.px, pt.py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = C.textMuted;
        ctx.fill();
        // H / L label
        if (h >= 36) {
          ctx.font         = `600 9px "IBM Plex Sans", sans-serif`;
          ctx.fillStyle    = C.textMuted;
          ctx.textAlign    = 'center';
          ctx.textBaseline = isHigh ? 'bottom' : 'top';
          const labelY     = isHigh ? pt.py - 3 : pt.py + 3;
          ctx.fillText(label, pt.px, labelY);
        }
      };

      if (maxIdx !== lastIdx) drawHL(canvasPts[maxIdx], 'H', true);
      if (minIdx !== lastIdx) drawHL(canvasPts[minIdx], 'L', false);
    }

    // ── 15. End-point emphasis — 3-layer dot ─────────────────────────
    // Outer glow → mid ring → solid core
    // Only drawn when height is sufficient (avoids clutter in tiny sparks)
    if (showLastDot && h >= 10) {
      const dotR = Math.max(2.0, Math.min(3.5, h * 0.055)); // scales with height

      // Outer glow (alpha 0.15)
      ctx.beginPath();
      ctx.arc(last.px, last.py, dotR * 2.8, 0, Math.PI * 2);
      ctx.fillStyle = InfographicEngine._hexToRgba(strokeColor, 0.12);
      ctx.fill();

      // Mid ring (alpha 0.30)
      ctx.beginPath();
      ctx.arc(last.px, last.py, dotR * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = InfographicEngine._hexToRgba(strokeColor, 0.28);
      ctx.fill();

      // Solid core
      ctx.beginPath();
      ctx.arc(last.px, last.py, dotR, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
    }

    // ── 16. Restore context ────────────────────────────────────────────
    ctx.restore();

    return { lastX: last.px, lastY: last.py };
  },

  // ── [V6 UTILITY] _hexToRgba — hex color → rgba string ────────────────
  // Internal helper for alpha-aware color usage in Canvas2D.
  // Converts '#RRGGBB' or '#RGB' to 'rgba(r,g,b,alpha)'.
  // Used by drawMiniTrend area fill, glow layers, baseline.
  // Not exposed as a public primitive — prefix _ marks it internal.
  _hexToRgba: (hex, alpha) => {
    if (!hex || typeof hex !== 'string') return `rgba(93,173,226,${alpha})`;
    const clean = hex.replace('#', '');
    let r, g, b;
    if (clean.length === 3) {
      r = parseInt(clean[0]+clean[0], 16);
      g = parseInt(clean[1]+clean[1], 16);
      b = parseInt(clean[2]+clean[2], 16);
    } else {
      r = parseInt(clean.slice(0,2), 16);
      g = parseInt(clean.slice(2,4), 16);
      b = parseInt(clean.slice(4,6), 16);
    }
    if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(93,173,226,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
  },

  // ── [V6 PHASE 1A] testMiniTrend — preview generator ──────────────────
  //
  // Creates a 1080×1350 test canvas with all drawMiniTrend variants.
  // Run: InfographicEngine.testMiniTrend()
  //
  testMiniTrend: () => {
    const IE = InfographicEngine;
    const C  = IE.CLR;
    const F  = IE.FONT;

    const canvas = IE._createCanvas();
    const ctx    = IE._getCtx(canvas);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, IE.W, IE.H);

    // Title
    ctx.font         = F.label(22);
    ctx.fillStyle    = C.textSec;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('drawMiniTrend — v6 Component Test', 28, 24);
    ctx.font      = F.sans(15);
    ctx.fillStyle = C.textMuted;
    ctx.fillText('All variants · Quadratic Bezier · Canvas2D · IBM Plex', 28, 52);

    // Divider
    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(28, 76); ctx.lineTo(IE.W - 28, 76); ctx.stroke();

    const CW  = IE.W - 56;    // chart width (28px side margins)
    const CX  = 28;
    let   cy  = 90;
    const LH  = 22;            // label line height
    const GAP = 24;            // gap between variants

    const VARIANTS = [
      {
        label:   'Variant 1 — Strong uptrend · trendDir:"auto" · area fill · end dot · H/L markers',
        data:    [58, 60, 57, 63, 67, 71, 74, 78, 79, 82],
        h:       72,
        cfg: { trendDir: 'auto', showArea: true, showLastDot: true,
               showHighLow: true, smooth: true, lineWidth: 2.5,
               baseline: 65, baselineColor: null }
      },
      {
        label:   'Variant 2 — Strong downtrend · trendDir:"down" · area fill · danger red · no H/L',
        data:    [91, 89, 87, 84, 80, 77, 72, 68, 65, 61],
        h:       72,
        cfg: { trendDir: 'down', showArea: true, showLastDot: true,
               showHighLow: false, smooth: true, lineWidth: 2.5 }
      },
      {
        label:   'Variant 3 — Volatile/choppy · flat trendDir · all dots visible · dangerThreshold:70',
        data:    [72, 81, 68, 79, 65, 83, 70, 77, 63, 74],
        h:       72,
        cfg: { trendDir: 'flat', showArea: true, showLastDot: true,
               showDots: true, showHighLow: true, smooth: true,
               lineWidth: 2, dangerThreshold: 70 }
      },
      {
        label:   'Variant 4 — Flat / no movement · smooth:false straight lines · textSec color',
        data:    [75, 75, 76, 74, 75, 75, 76, 74, 75, 75],
        h:       60,
        cfg: { stroke: C.textSec, showArea: false, showLastDot: true,
               smooth: false, lineWidth: 1.5 }
      },
      {
        label:   'Variant 5 — Recovery pattern · dip then climb · auto color · baseline at 70',
        data:    [80, 76, 72, 68, 65, 67, 71, 75, 79, 83],
        h:       72,
        cfg: { trendDir: 'auto', showArea: true, showLastDot: true,
               showHighLow: true, smooth: true, lineWidth: 2.5,
               baseline: 70 }
      },
      {
        label:   'Variant 6 — Single value [82] · dot only · no line',
        data:    [82],
        h:       48,
        cfg: { trendDir: 'up', showLastDot: true }
      },
      {
        label:   'Variant 7 — Empty [] · flat placeholder dashed line',
        data:    [],
        h:       48,
        cfg: {}
      },
      {
        label:   'Variant 8 — Small h=32 · compact row size · area + end dot',
        data:    [60, 65, 62, 70, 74, 71, 78],
        h:       32,
        cfg: { trendDir: 'up', showArea: true, showLastDot: true, lineWidth: 2 }
      },
      {
        label:   'Variant 9 — Two-column layout · same data side by side',
        data:    null,     // rendered separately below
        h:       64,
        cfg: {}
      },
    ];

    for (let vi = 0; vi < VARIANTS.length - 1; vi++) {
      const v = VARIANTS[vi];

      // Variant label
      ctx.font         = F.label(13);
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(v.label, CX, cy);
      cy += LH;

      // Surface card behind sparkline
      InfographicEngine._rrect(ctx, CX, cy, CW, v.h, 6);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth   = 1;
      ctx.stroke();

      // Draw sparkline with 8px inner padding
      const inner_pad = 8;
      IE.drawMiniTrend(ctx, CX + inner_pad, cy + inner_pad, CW - inner_pad*2, v.h - inner_pad*2, v.data, v.cfg);

      cy += v.h + GAP;
    }

    // Variant 9 — side-by-side two charts
    {
      ctx.font         = F.label(13);
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Variant 9 — Two-column: left (uptrend) vs right (downtrend) · same height', CX, cy);
      cy += LH;

      const colW   = (CW - 12) / 2;
      const colH   = 64;
      const inner  = 8;

      // Left card
      InfographicEngine._rrect(ctx, CX, cy, colW, colH, 6);
      ctx.fillStyle = C.surface; ctx.fill();
      ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
      IE.drawMiniTrend(ctx, CX + inner, cy + inner, colW - inner*2, colH - inner*2,
        [60, 65, 62, 70, 74, 71, 78, 82],
        { trendDir: 'up', showArea: true, showLastDot: true, lineWidth: 2.5 });

      // Right card
      const rx = CX + colW + 12;
      InfographicEngine._rrect(ctx, rx, cy, colW, colH, 6);
      ctx.fillStyle = C.surface; ctx.fill();
      ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
      IE.drawMiniTrend(ctx, rx + inner, cy + inner, colW - inner*2, colH - inner*2,
        [82, 80, 77, 74, 70, 67, 63, 59],
        { trendDir: 'down', showArea: true, showLastDot: true, lineWidth: 2.5 });

      cy += colH + GAP;
    }

    // Footer
    ctx.font      = F.sans(15);
    ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ InfographicEngine v6 · drawMiniTrend · Canvas2D · Quadratic Bezier · IBM Plex', IE.W / 2, IE.H - 28);

    // Download
    const n  = new Date();
    const ts = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}_${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const link = document.createElement('a');
    link.download = `test_drawMiniTrend_${ts}.png`;
    link.href     = canvas.toDataURL('image/png', 1.0);
    link.click();

    console.log('[InfographicEngine] testMiniTrend() complete — PNG download triggered');
    console.log('[InfographicEngine] Final cy:', cy, 'of', IE.H);
    return canvas;
  },

  // ── [V6 PHASE 1A] drawActionList — IMPLEMENTED ──────────────────────
  //
  // Executive FMCG action/insight list renderer. Canvas2D only.
  // Renders a vertical stack of insight rows — alerts, opportunities,
  // recovery signals, risk commentary, action recommendations.
  //
  // @param {CanvasRenderingContext2D} ctx
  // @param {number} x, y     — top-left of the list area
  // @param {number} w        — width of the component
  // @param {object[]} items  — array of item objects:
  //   icon    {string}       — emoji or short symbol  e.g. '⚠' '✓' '↑'
  //   tone    {string}       — 'critical'|'warning'|'good'|'neutral'|'info'
  //   title   {string}       — short bold headline    e.g. 'GBS under pressure'
  //   body    {string|null}  — narrative paragraph    can wrap to multiple lines
  //   footer  {string|null}  — meta line (mono font)  e.g. 'Need +2.8B/day'
  // @param {object} config   — layout config:
  //   maxItems   {number}    — max rows to show    default: 5, rest → tail row
  //   compact    {boolean}   — dense mode          default: false
  //   numbered   {boolean}   — 1/2/3 instead of icon bubble  default: false
  //   showFooter {boolean}   — global footer toggle  default: true
  //   bodyMaxLines {number}  — max body wrap lines  default: 3
  //   rowGap     {number}    — extra px between rows  default: 0
  //   sectionBg  {boolean}   — draw surface card behind each row  default: false
  //
  // @returns {number} — finalY (y + total height rendered)
  //
  drawActionList: (ctx, x, y, w, items, config) => {
    const C   = InfographicEngine.CLR;
    const F   = InfographicEngine.FONT;
    const cfg = config || {};

    // ── Guard: nothing to render ──────────────────────────────────────
    if (!items || !items.length || w < 40) return y;

    // ── Config resolution ─────────────────────────────────────────────
    const compact      = !!cfg.compact;
    const numbered     = !!cfg.numbered;
    const showFooter   = cfg.showFooter !== false;       // default true
    const bodyMaxLines = cfg.bodyMaxLines || 3;
    const rowGap       = cfg.rowGap || 0;
    const sectionBg    = !!cfg.sectionBg;

    // Max items: trim list + show tail
    const maxItems  = cfg.maxItems || 5;
    const visItems  = items.slice(0, maxItems);
    const overCount = items.length - visItems.length;

    // ── Sizing constants (normal vs compact) ──────────────────────────
    const ROW_PAD_V    = compact ? 8   : 14;
    const ICON_W       = compact ? 28  : 36;
    const ICON_FONT    = compact ? 14  : 16;
    const ACCENT_W_PX  = 3;
    const ACCENT_GAP   = compact ? 8   : 10;
    const TITLE_SIZE   = compact ? 20  : 24;
    const BODY_SIZE    = compact ? 17  : 20;
    const FOOTER_SIZE  = 16;                             // always 16px
    const TITLE_LH     = TITLE_SIZE + 6;                 // 1.25× approx
    const BODY_LH      = BODY_SIZE  + 6;
    const FOOTER_LH    = FOOTER_SIZE + 6;
    const DIVIDER_H    = 1;
    const DIVIDER_GAP  = compact ? 4 : 8;                // above + below

    // Text column: after accent bar + optional icon bubble
    const suppressBubble = w < 120;
    const TEXT_X  = suppressBubble
      ? ACCENT_W_PX + (compact ? 8 : 12)
      : ACCENT_W_PX + ACCENT_GAP + ICON_W + (compact ? 6 : 10);
    const TEXT_W  = w - TEXT_X - 10;   // 10px right breathing room

    // ── Tone → color map ──────────────────────────────────────────────
    const TONES = {
      critical: { text: C.redBright,   bg: C.redBg,   border: C.red,      fill: C.red   },
      warning:  { text: C.amberBright, bg: C.amberBg, border: C.amber,    fill: C.amber },
      good:     { text: C.greenBright, bg: C.greenBg, border: C.green,    fill: C.green },
      neutral:  { text: C.blueBright,  bg: C.surface2,border: C.blueBright,fill: C.blue },
      info:     { text: C.accent,      bg: C.surface2,border: C.accentDim, fill: C.accentDim },
    };
    const toneColors = (tone) => TONES[tone] || TONES.neutral;

    // ── Draw one row ──────────────────────────────────────────────────
    // Returns: rowBottomY (y after the full row including divider)
    const drawRow = (item, rowY, rowIndex, isLast) => {
      const tc = toneColors(item.tone || 'neutral');
      const iconText = numbered
        ? String(rowIndex + 1)
        : (item.icon || '·');

      // ── Pre-compute body wrap ──────────────────────────────────────
      ctx.font = `400 ${BODY_SIZE}px "IBM Plex Sans", sans-serif`;
      const bodyLines = item.body
        ? InfographicEngine._wrapText(ctx, item.body, TEXT_W).slice(0, bodyMaxLines)
        : [];

      const hasFooter  = showFooter && !compact && !!item.footer;
      const hasBody    = bodyLines.length > 0;

      // ── Compute dynamic row height ─────────────────────────────────
      let rowH = ROW_PAD_V;
      rowH += TITLE_LH;
      if (hasBody)   { rowH += 4 + BODY_LH * bodyLines.length; }
      if (hasFooter) { rowH += 6 + FOOTER_LH; }
      rowH += ROW_PAD_V;

      // Icon bubble center y
      const bubbleCY = rowY + ROW_PAD_V + ICON_W / 2;

      // ── Optional section background card ──────────────────────────
      if (sectionBg) {
        InfographicEngine._rrect(ctx, x, rowY, w, rowH, 8);
        ctx.fillStyle = C.surface;
        ctx.fill();
      }

      // ── Left tone accent bar ───────────────────────────────────────
      // Rounded at top and bottom, clipped to row
      const abY  = rowY + 6;
      const abH  = rowH - 12;
      ctx.fillStyle = tc.fill;
      ctx.beginPath();
      ctx.moveTo(x, abY + 4);
      ctx.arcTo(x, abY, x + ACCENT_W_PX, abY, 4);
      ctx.lineTo(x + ACCENT_W_PX, abY + abH - 4);
      ctx.arcTo(x + ACCENT_W_PX, abY + abH, x, abY + abH, 4);
      ctx.lineTo(x, abY + abH);
      ctx.closePath();
      ctx.fill();

      // ── Icon / number bubble ───────────────────────────────────────
      if (!suppressBubble) {
        const bx = x + ACCENT_W_PX + ACCENT_GAP;
        const by = rowY + ROW_PAD_V;
        InfographicEngine._rrect(ctx, bx, by, ICON_W, ICON_W, 8);
        // Bubble fill: tone bg at ~60% opacity via gradient
        ctx.fillStyle = tc.bg;
        ctx.fill();
        // Bubble border
        ctx.strokeStyle = InfographicEngine._hexToRgba(tc.border, 0.4);
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Icon / number centered in bubble
        ctx.font = numbered
          ? `700 ${ICON_FONT}px "IBM Plex Mono", monospace`
          : `700 ${ICON_FONT}px system-ui, "Apple Color Emoji", sans-serif`;
        ctx.fillStyle    = tc.text;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(iconText, bx + ICON_W / 2, by + ICON_W / 2);
      }

      // ── Title ──────────────────────────────────────────────────────
      let textY = rowY + ROW_PAD_V;

      // Vertically center title with bubble if body is absent
      if (!hasBody && !hasFooter && !suppressBubble) {
        textY = bubbleCY - TITLE_SIZE / 2 - 2;
      }

      ctx.font         = `700 ${TITLE_SIZE}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle    = tc.text;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      const titleText  = InfographicEngine._truncate(ctx, item.title || '', TEXT_W);
      ctx.fillText(titleText, x + TEXT_X, textY);
      textY += TITLE_LH;

      // ── Body (wrapped) ─────────────────────────────────────────────
      if (hasBody) {
        textY += 4;
        ctx.font         = `400 ${BODY_SIZE}px "IBM Plex Sans", sans-serif`;
        ctx.fillStyle    = C.textSec;
        ctx.textBaseline = 'top';
        bodyLines.forEach((line) => {
          ctx.fillText(line, x + TEXT_X, textY);
          textY += BODY_LH;
        });
      }

      // ── Footer ─────────────────────────────────────────────────────
      if (hasFooter) {
        textY += 6;
        ctx.font         = `600 ${FOOTER_SIZE}px "IBM Plex Mono", monospace`;
        ctx.fillStyle    = C.textMuted;
        ctx.textBaseline = 'top';
        const footerText = InfographicEngine._truncate(ctx, item.footer, TEXT_W);
        ctx.fillText(footerText, x + TEXT_X, textY);
      }

      // ── Divider (not after last row) ───────────────────────────────
      const rowBottomY = rowY + rowH;
      if (!isLast) {
        const dY = rowBottomY + DIVIDER_GAP;
        ctx.strokeStyle = C.border;
        ctx.lineWidth   = DIVIDER_H;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(x + ACCENT_W_PX + 6, dY);
        ctx.lineTo(x + w - 6, dY);
        ctx.stroke();
        return dY + DIVIDER_GAP;    // next row starts after divider + gap
      }

      return rowBottomY + rowGap;   // last row: just return bottom
    };

    // ── Render all visible rows ───────────────────────────────────────
    let currentY = y;
    visItems.forEach((item, i) => {
      const isLast = (i === visItems.length - 1) && (overCount === 0);
      currentY = drawRow(item, currentY, i, isLast);
    });

    // ── Tail row: "+ N more items" ────────────────────────────────────
    if (overCount > 0) {
      const tailY  = currentY + (compact ? 4 : DIVIDER_GAP);
      ctx.font         = `500 ${BODY_SIZE}px "IBM Plex Sans", sans-serif`;
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`+${overCount} item lainnya`, x + TEXT_X, tailY);
      currentY = tailY + BODY_LH + (compact ? 4 : 8);
    }

    return currentY;
  },

  // ── [V6 PHASE 1A] testActionList — preview generator ─────────────────
  //
  // Creates a 1080×1350 test canvas showing drawActionList in all variants.
  // Run from browser console: InfographicEngine.testActionList()
  //
  testActionList: () => {
    const IE = InfographicEngine;
    const C  = IE.CLR;
    const F  = IE.FONT;

    const canvas = IE._createCanvas();
    const ctx    = IE._getCtx(canvas);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, IE.W, IE.H);

    // Page title
    ctx.font = F.label(22); ctx.fillStyle = C.textSec;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('drawActionList — v6 Component Test', 28, 24);
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.fillText('All variants · Canvas2D · IBM Plex Sans / Mono', 28, 52);

    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(28, 76); ctx.lineTo(IE.W - 28, 76); ctx.stroke();

    const CX  = 28;
    const CW  = IE.W - 56;
    let   cy  = 92;
    const LH  = 22;
    const GAP = 20;

    // ── Helper: section heading ──
    const heading = (text, y) => {
      ctx.font = F.label(14); ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(text, CX, y);
      return y + LH;
    };

    // ── Test data sets ────────────────────────────────────────────────
    const CRITICAL_ITEMS = [
      {
        icon: '🔴', tone: 'critical',
        title: 'GBS di zona DANGER — capaian tertahan',
        body:  'Achievement 58.2% tertinggal jauh dari pace 72.1%. Gap -22B vs target TM. Run rate aktual hanya 6.8M/HK, butuh 14.2M/HK.',
        footer: 'Need +7.4M/HK · 8 HK tersisa'
      },
      {
        icon: '🔴', tone: 'critical',
        title: 'MBR zero-transaction — 18 WS belum aktif',
        body:  'Dari 45 wholesaler aktif Bima program, 18 belum ada transaksi hari ini.',
        footer: 'Eskalasi ke TSO segera'
      },
    ];

    const OPPORTUNITY_ITEMS = [
      {
        icon: '📈', tone: 'good',
        title: 'Jabodetabek momentum positif',
        body:  'Region terbaik dengan ach 91.3%, growth vs LM +5.2%. Run rate di atas pace. Potential untuk close early.',
        footer: null
      },
      {
        icon: '✓', tone: 'good',
        title: 'GGBI — recovery dalam 3 HK terakhir',
        body:  'Dari 61% naik ke 74% dalam 3 hari. Trend reversal terdeteksi.',
        footer: 'Monitor daily · trend masih berlanjut'
      },
    ];

    const MIXED_ITEMS = [
      {
        icon: '⚠', tone: 'warning',
        title: 'CA Drop vs LM meningkat di GT Modern',
        body:  'Active outlet GT Modern turun 8.2% vs LM. 42 outlet hilang dari base aktif.',
        footer: 'Priority visit: Jabar2, Jatim1'
      },
      {
        icon: '🔴', tone: 'critical',
        title: 'GPPJ run rate kritis',
        body:  'Butuh 15.8M/HK di sisa 6 HK untuk close. Realistis maximum 12M/HK.',
        footer: 'Gap tidak dapat ditutup tanpa push distribusi'
      },
      {
        icon: 'ℹ', tone: 'info',
        title: 'PS Achiever — Surabaya outperform',
        body:  'Sell-in ach 88%, sell-out ach 79%. Kedua di atas target pace.',
        footer: null
      },
      {
        icon: '📈', tone: 'good',
        title: 'Supercup program on track',
        body:  'BB3 achievement 84.2%, 12 WS baru onboarded bulan ini.',
        footer: 'Continue monitoring BB3 coverage'
      },
      {
        icon: '⚠', tone: 'warning',
        title: 'Bima zero-trx: 9 WS belum aktif hari ini',
        body:  'List WS: Sriwijaya, Mandiri, Bahari, Surya, dst.',
        footer: 'Target: semua WS aktif sebelum 14:00'
      },
      {
        icon: '📉', tone: 'critical',
        title: 'Overflow test — item ke-6',
        body:  'Row ini harusnya tidak tampil karena maxItems=5.',
        footer: 'Harus tersembunyi'
      },
    ];

    const WRAP_STRESS = [
      {
        icon: '⚠', tone: 'warning',
        title: 'Ini adalah judul yang sangat panjang untuk menguji truncation karena teks melebihi lebar kolom',
        body:  'Ini adalah body teks yang sangat panjang dan dirancang khusus untuk menguji text wrapping system. Body teks ini harus terbungkus secara otomatis ke beberapa baris tanpa overflow keluar dari bounding box komponen. Sistem harus memotong maksimal 3 baris dan tidak lebih dari itu agar tidak merusak layout infographic keseluruhan.',
        footer: 'Footer yang juga cukup panjang untuk diuji truncation nya pada layar sempit'
      },
    ];

    // ── Section 1: Critical alerts ────────────────────────────────────
    cy = heading('Section 1 — Critical Alerts · standard mode · icon bubbles', cy);
    cy = IE.drawActionList(ctx, CX, cy, CW, CRITICAL_ITEMS, {});
    cy += GAP;

    // ── Section 2: Opportunities ──────────────────────────────────────
    cy = heading('Section 2 — Opportunities · standard mode · icon bubbles', cy);
    cy = IE.drawActionList(ctx, CX, cy, CW, OPPORTUNITY_ITEMS, {});
    cy += GAP;

    // ── Section 3: Mixed briefing (maxItems=5 → overflow tail) ────────
    cy = heading('Section 3 — Mixed Briefing · maxItems=5 · numbered · sectionBg · tail row', cy);
    cy = IE.drawActionList(ctx, CX, cy, CW, MIXED_ITEMS, {
      numbered: true, maxItems: 5, sectionBg: true, rowGap: 4
    });
    cy += GAP;

    // ── Section 4: Compact mode ───────────────────────────────────────
    cy = heading('Section 4 — Compact mode · numbered · showFooter:false · dense layout', cy);
    cy = IE.drawActionList(ctx, CX, cy, CW, MIXED_ITEMS.slice(0, 4), {
      compact: true, numbered: true, showFooter: false
    });
    cy += GAP;

    // ── Section 5: Overflow / wrap stress test ───────────────────────
    cy = heading('Section 5 — Wrap stress test · very long title + body · bodyMaxLines=3', cy);
    cy = IE.drawActionList(ctx, CX, cy, CW, WRAP_STRESS, { bodyMaxLines: 3 });
    cy += GAP;

    // Page footer
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡ InfographicEngine v6 · drawActionList · Canvas2D · IBM Plex', IE.W / 2, IE.H - 28);

    // Download
    const n  = new Date();
    const ts = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}_${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const lnk = document.createElement('a');
    lnk.download = `test_drawActionList_${ts}.png`;
    lnk.href     = canvas.toDataURL('image/png', 1.0);
    lnk.click();

    console.log('[InfographicEngine] testActionList() complete — PNG download triggered');
    console.log('[InfographicEngine] Final cy:', cy, 'of', IE.H);
    return canvas;
  },

  // ── [V6 PHASE 1A] drawNarrative ──────────────────────────────────────
  // Multi-line executive narrative from ExecSummaryEngine.
  // params: ctx, x, y, w, text, maxLines, accentColor
  // [V6 PHASE 1A] Replaces drawInsightBox for management narrative blocks
  drawNarrative: (ctx, x, y, w, text, maxLines, accentColor) => {
    // stub — delegates to existing drawInsightBox until Phase 1A
    return InfographicEngine.drawInsightBox(ctx, x, y, w, text, accentColor);
  },

  // ── [V6 PHASE 1A] drawHeader ─────────────────────────────────────────
  // Public card header — wraps _renderHeader with card-type config.
  // params: ctx, k, config { subtitle, accentColor }
  // [V6 PHASE 1A] Each card type passes its own subtitle + accent
  drawHeader: (ctx, k, config) => {
    // stub — delegates to _renderHeader until Phase 1A
    return InfographicEngine._renderHeader(ctx, k);
  },

  // ── [V6 PHASE 1A] drawFooter ─────────────────────────────────────────
  // Public card footer — wraps _renderFooter.
  // [V6 PHASE 1A] Add card type label + v6 branding
  drawFooter: (ctx, y) => {
    // stub — delegates to _renderFooter until Phase 1A
    return InfographicEngine._renderFooter(ctx, y);
  },

  // ── [V6 STEP 5] drawNarrativeStrip — IMPLEMENTED ─────────────────────
  //
  // Executive horizontal intelligence ribbon. Canvas2D only.
  // Renders a segmented strip of insight items in a single horizontal row.
  // Bloomberg terminal / CNBC ribbon style — for scanning, not reading.
  //
  // @param {CanvasRenderingContext2D} ctx
  // @param {number} x, y     — top-left of the strip
  // @param {number} w        — total strip width
  // @param {object[]} items  — array of segment items:
  //   tone      {string}     — 'critical'|'warning'|'good'|'neutral'|'info'
  //   icon      {string}     — emoji or short glyph  e.g. '⚠' '↑' '✓'
  //   text      {string}     — segment label text (auto-truncated to fit)
  //   emphasis  {boolean}    — highlight this segment (thicker accent, brighter bg)
  // @param {object} config
  //   mode         {'full'|'compact'|'export'|'dark'}  — preset  default: 'full'
  //   maxSegments  {number}   — hard cap on visible segments  default: auto
  //   widthMode    {'equal'|'proportional'}             default: 'equal'
  //   bg           {'solid'|'glass'|'none'}             default: 'solid'
  //   topBorder    {boolean}                            default: false
  //   bottomBorder {boolean}                            default: true
  //   borderColor  {string|null}                        default: CLR.border
  //   showOverflow {boolean}                            default: true
  //   roundedCorners {number}                           default: 0
  //
  // @returns {{ height, segments, overflow }}
  //   height   — actual strip height rendered
  //   segments — number of segments drawn
  //   overflow — number of items that didn't fit (0 if all shown)
  //
  drawNarrativeStrip: (ctx, x, y, w, items, config) => {
    const C   = InfographicEngine.CLR;
    const F   = InfographicEngine.FONT;
    const cfg = config || {};

    // ── Guard ──────────────────────────────────────────────────────────
    if (!items || !items.length || w < 40) {
      return { height: 0, segments: 0, overflow: 0 };
    }

    // ── Mode preset resolution ─────────────────────────────────────────
    // Modes set multiple config options at once; explicit cfg keys override.
    const mode = cfg.mode || 'full';
    const isCompact = mode === 'compact' || !!cfg.compact;
    const isExport  = mode === 'export';

    // ── Sizing constants ───────────────────────────────────────────────
    const STRIP_H      = isCompact ? 34 : 44;
    const FONT_SIZE    = isCompact ? 15 : 16;
    const ICON_SIZE    = isCompact ? 15 : 16;  // emoji-safe font matches text size
    const PAD_H        = isCompact ? 10 : 14;  // left+right inner padding per segment
    const ACCENT_BAR_H = 3;                    // top accent bar height (normal)
    const ACCENT_EMH   = 5;                    // top accent bar height (emphasis)
    const SEP_INSET    = isCompact ? 5 : 6;    // top+bottom separator inset from strip edge
    const MIN_SEG_W    = 80;

    // ── Tone color map ─────────────────────────────────────────────────
    const TONES = {
      critical: { text: C.redBright,   bg: C.redBg,   accent: C.red,      border: C.red      },
      warning:  { text: C.amberBright, bg: C.amberBg, accent: C.amber,    border: C.amber    },
      good:     { text: C.greenBright, bg: C.greenBg, accent: C.green,    border: C.green    },
      neutral:  { text: C.textSec,     bg: C.surface2,accent: C.accent,   border: C.accentDim},
      info:     { text: C.accent,      bg: C.surface2,accent: C.accentDim,border: C.accentDim},
    };
    const toneOf = (t) => TONES[t] || TONES.neutral;

    // ── Determine max displayable segments ────────────────────────────
    const autoMax    = Math.floor(w / MIN_SEG_W);
    const maxSegs    = cfg.maxSegments ? Math.min(cfg.maxSegments, autoMax) : autoMax;
    const visItems   = items.slice(0, isExport ? items.length : maxSegs);
    const overflow   = items.length - visItems.length;
    const showOverflow = (cfg.showOverflow !== false) && overflow > 0;

    // Width reserved for overflow badge (+N)
    const OVERFLOW_BADGE_W = showOverflow ? 42 : 0;
    const usableW = w - OVERFLOW_BADGE_W;

    // ── Segment width allocation ───────────────────────────────────────
    // 'equal': all segments share equal width (Bloomberg style)
    // 'proportional': width ∝ measured text length, with min guard
    let segWidths;
    const N = visItems.length;

    if (cfg.widthMode === 'proportional' && N > 0) {
      // Measure natural widths
      ctx.font = `600 ${FONT_SIZE}px "IBM Plex Sans", sans-serif`;
      const natural = visItems.map(item => {
        const iconW  = item.icon ? ctx.measureText(item.icon).width + 8 : 0;
        const textW  = ctx.measureText(item.text || '').width;
        return PAD_H + iconW + textW + PAD_H;
      });
      const totalNatural = natural.reduce((s, v) => s + v, 0);
      // Separator cost: (N-1) × 1px separator (not double-padded — we allocate padding in segment)
      const sepCost    = (N - 1) * 1;
      const available  = usableW - sepCost;
      const scale      = available / Math.max(totalNatural, 1);
      segWidths = natural.map(nw => Math.max(MIN_SEG_W, Math.round(nw * scale)));

      // Adjust last segment to fill exactly
      const sumSoFar = segWidths.reduce((s, v) => s + v, 0) + sepCost;
      segWidths[segWidths.length - 1] += (available - sumSoFar + sepCost);
    } else {
      // Equal allocation (default)
      const sepCost  = (N - 1) * 1;
      const segW     = Math.max(MIN_SEG_W, Math.floor((usableW - sepCost) / N));
      segWidths = visItems.map((_, i) => {
        // Last segment takes any remainder pixel
        if (i === N - 1) {
          const allocated = segWidths ? segWidths.reduce((s, v) => s + v, 0) : segW * (N - 1);
          return usableW - sepCost - (segW * (N - 1));
        }
        return segW;
      });
      // Simpler: compute directly
      const baseW = Math.floor((usableW - sepCost) / N);
      const rem   = (usableW - sepCost) - baseW * N;
      segWidths = visItems.map((_, i) => baseW + (i === N - 1 ? rem : 0));
    }

    // ── Strip background ───────────────────────────────────────────────
    const bgMode      = cfg.bg || (isExport ? 'solid' : 'solid');
    const roundCorner = cfg.roundedCorners || 0;

    ctx.save();

    if (bgMode === 'solid' || bgMode === 'glass') {
      if (bgMode === 'glass') ctx.globalAlpha = 0.88;
      if (roundCorner > 0) {
        InfographicEngine._rrect(ctx, x, y, w, STRIP_H, roundCorner);
        ctx.fillStyle = C.surface2;
        ctx.fill();
      } else {
        ctx.fillStyle = C.surface2;
        ctx.fillRect(x, y, w, STRIP_H);
      }
      if (bgMode === 'glass') ctx.globalAlpha = 1.0;
    }

    // ── Top border ─────────────────────────────────────────────────────
    const borderClr = cfg.borderColor || C.border;
    if (cfg.topBorder || isExport) {
      ctx.strokeStyle = borderClr;
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + w, y);
      ctx.stroke();
    }

    // ── Draw segments ──────────────────────────────────────────────────
    let curX = x;

    visItems.forEach((item, i) => {
      const sw   = segWidths[i];
      const tc   = toneOf(item.tone || 'neutral');
      const emph = !!item.emphasis;
      const accentH = emph ? ACCENT_EMH : ACCENT_BAR_H;

      // Separator before every segment except first
      if (i > 0) {
        ctx.strokeStyle = C.border;
        ctx.lineWidth   = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(curX, y + SEP_INSET);
        ctx.lineTo(curX, y + STRIP_H - SEP_INSET);
        ctx.stroke();
      }

      // Segment clip region
      ctx.save();
      ctx.beginPath();
      ctx.rect(curX, y, sw, STRIP_H);
      ctx.clip();

      // Segment background tint (tone color, subtle opacity)
      const bgAlpha = emph ? 0.32 : 0.14;
      ctx.fillStyle = InfographicEngine._hexToRgba(tc.bg, bgAlpha);
      ctx.fillRect(curX, y, sw, STRIP_H);

      // Top accent bar (tone color, full segment width)
      ctx.fillStyle = tc.accent;
      ctx.fillRect(curX, y, sw, accentH);

      // Emphasis: also draw subtle right-to-left gradient fade on right edge
      if (emph) {
        const fadeGrad = ctx.createLinearGradient(curX + sw - 20, y, curX + sw, y);
        fadeGrad.addColorStop(0, InfographicEngine._hexToRgba(tc.bg, 0));
        fadeGrad.addColorStop(1, InfographicEngine._hexToRgba(tc.bg, 0.25));
        ctx.fillStyle = fadeGrad;
        ctx.fillRect(curX + sw - 20, y, 20, STRIP_H);
      }

      // Content: icon + text, vertically centered
      const contentY  = y + STRIP_H / 2 + (accentH / 2);  // shift down slightly for accent bar
      const iconFont  = `600 ${ICON_SIZE}px system-ui, "Apple Color Emoji", sans-serif`;
      const textFont  = emph
        ? `700 ${FONT_SIZE}px "IBM Plex Sans", sans-serif`
        : `600 ${FONT_SIZE}px "IBM Plex Sans", sans-serif`;

      ctx.textBaseline = 'middle';
      let contentX = curX + PAD_H;

      // Icon
      if (item.icon) {
        ctx.font      = iconFont;
        ctx.fillStyle = tc.text;
        ctx.textAlign = 'left';
        ctx.fillText(item.icon, contentX, contentY);
        contentX += ctx.measureText(item.icon).width + 6;
      }

      // Label text — measure available width, then truncate
      const textMaxW = sw - (contentX - curX) - PAD_H;
      ctx.font      = textFont;
      ctx.fillStyle = tc.text;
      ctx.textAlign = 'left';
      const labelText = InfographicEngine._truncate(ctx, item.text || '', textMaxW);
      ctx.fillText(labelText, contentX, contentY);

      ctx.restore();  // remove clip
      curX += sw + 1; // advance by segment width + separator pixel
    });

    // ── Overflow badge ─────────────────────────────────────────────────
    if (showOverflow) {
      const bw   = OVERFLOW_BADGE_W - 4;
      const bh   = STRIP_H - 12;
      const bx   = x + w - OVERFLOW_BADGE_W + 2;
      const by   = y + 6;

      InfographicEngine._rrect(ctx, bx, by, bw, bh, 6);
      ctx.fillStyle = C.surface;
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.font         = `700 12px "IBM Plex Mono", monospace`;
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`+${overflow}`, bx + bw / 2, by + bh / 2);
    }

    // ── Bottom border ──────────────────────────────────────────────────
    if (cfg.bottomBorder !== false) {  // default: always show
      ctx.strokeStyle = borderClr;
      ctx.lineWidth   = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, y + STRIP_H); ctx.lineTo(x + w, y + STRIP_H);
      ctx.stroke();
    }

    ctx.restore();

    return { height: STRIP_H, segments: visItems.length, overflow };
  },

  // ── [V6 STEP 5] testNarrativeStrip — preview generator ───────────────
  //
  // 1080×1350 test canvas showing all drawNarrativeStrip variants.
  // Run: InfographicEngine.testNarrativeStrip()
  //
  testNarrativeStrip: () => {
    const IE = InfographicEngine;
    const C  = IE.CLR;
    const F  = IE.FONT;

    const canvas = IE._createCanvas();
    const ctx    = IE._getCtx(canvas);

    // Background
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, IE.W, IE.H);

    ctx.font = F.label(22); ctx.fillStyle = C.textSec;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('drawNarrativeStrip — v6 Component Test', 28, 24);
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.fillText('Horizontal executive intelligence ribbon · Canvas2D · IBM Plex', 28, 52);

    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(28, 76); ctx.lineTo(IE.W - 28, 76); ctx.stroke();

    const CX = 28, CW = IE.W - 56;
    let cy = 92;
    const LH = 22, GAP = 22;

    // Helper: small variant label
    const label = (text) => {
      ctx.font = F.label(14); ctx.fillStyle = C.textMuted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(text, CX, cy);
      cy += LH;
    };

    // ── Data sets ─────────────────────────────────────────────────────
    const CRITICAL_ITEMS = [
      { tone: 'critical', icon: '🔴', text: 'GBS DANGER 58.2%' },
      { tone: 'critical', icon: '⚠',  text: 'MBR zero 18 WS' },
      { tone: 'warning',  icon: '↓',  text: 'GT Drop -8.2%' },
    ];

    const MIXED_ITEMS = [
      { tone: 'critical', icon: '⚠',  text: 'GBS tertahan 58.2%',  emphasis: true },
      { tone: 'warning',  icon: '↓',  text: 'CA drop GT Modern' },
      { tone: 'good',     icon: '↑',  text: 'Jabodetabek +5.2%' },
      { tone: 'good',     icon: '✓',  text: 'PS Surabaya on pace' },
      { tone: 'neutral',  icon: 'ℹ',  text: 'BB3 Supercup 84.2%' },
    ];

    const OVERFLOW_ITEMS = [
      { tone: 'critical', icon: '🔴', text: 'GBS 58.2%' },
      { tone: 'warning',  icon: '⚠',  text: 'MBR zero 18 WS' },
      { tone: 'warning',  icon: '↓',  text: 'CA drop -8.2%' },
      { tone: 'good',     icon: '↑',  text: 'Jabodetabek +5.2%' },
      { tone: 'good',     icon: '✓',  text: 'PS overpace' },
      { tone: 'neutral',  icon: 'ℹ',  text: 'BB3 on track' },
      { tone: 'neutral',  icon: 'ℹ',  text: 'Arjuna 79.1%' },
      { tone: 'info',     icon: '↗',  text: 'Bima recovery' },
    ];

    const SINGLE_CRITICAL = [
      { tone: 'critical', icon: '🔴', text: 'OVERALL DANGER — 58.2% vs 72.1% pace', emphasis: true },
    ];

    // ── Strip 1: Critical-only, standard, bottom border ───────────────
    label('Strip 1 — Critical-only · standard · bottomBorder · no bg background');
    const r1 = IE.drawNarrativeStrip(ctx, CX, cy, CW, CRITICAL_ITEMS, {
      bg: 'none', bottomBorder: true
    });
    cy += r1.height + GAP;

    // ── Strip 2: Mixed tone, solid bg, top+bottom borders ─────────────
    label('Strip 2 — Mixed tones · emphasis on critical · solid bg · both borders');
    const r2 = IE.drawNarrativeStrip(ctx, CX, cy, CW, MIXED_ITEMS, {
      bg: 'solid', topBorder: true, bottomBorder: true
    });
    cy += r2.height + GAP;

    // ── Strip 3: Compact mode, proportional widths ─────────────────────
    label('Strip 3 — Compact mode · proportional width · glass bg · roundedCorners:6');
    const r3 = IE.drawNarrativeStrip(ctx, CX, cy, CW, MIXED_ITEMS, {
      mode: 'compact', widthMode: 'proportional', bg: 'glass', roundedCorners: 6
    });
    cy += r3.height + GAP;

    // ── Strip 4: Overflow — 8 items, maxSegments=5 ────────────────────
    label(`Strip 4 — Overflow mode · 8 items · maxSegments=5 · overflow badge (+${OVERFLOW_ITEMS.length - 5})`);
    const r4 = IE.drawNarrativeStrip(ctx, CX, cy, CW, OVERFLOW_ITEMS, {
      maxSegments: 5, bg: 'solid', topBorder: false
    });
    cy += r4.height + GAP;

    // ── Strip 5: Export mode (forces all segments) ─────────────────────
    label('Strip 5 — Export mode · forces all items · both borders · solid bg');
    const r5 = IE.drawNarrativeStrip(ctx, CX, cy, CW, OVERFLOW_ITEMS, {
      mode: 'export'
    });
    cy += r5.height + GAP;

    // ── Strip 6: Single critical emphasis ─────────────────────────────
    label('Strip 6 — Single full-width critical segment · emphasis=true');
    const r6 = IE.drawNarrativeStrip(ctx, CX, cy, CW, SINGLE_CRITICAL, {
      bg: 'solid', topBorder: true, bottomBorder: true
    });
    cy += r6.height + GAP;

    // ── Strip 7: Narrow width test (w=480, left-aligned) ──────────────
    label('Strip 7 — Narrow w=480 · overflow · compact · left-aligned');
    const narrowW = 480;
    const r7 = IE.drawNarrativeStrip(ctx, CX, cy, narrowW, MIXED_ITEMS, {
      mode: 'compact', bg: 'solid'
    });
    cy += r7.height + GAP;

    // ── Return value display ───────────────────────────────────────────
    const results = [r1,r2,r3,r4,r5,r6,r7];
    ctx.font = F.sans(13); ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    results.forEach((r, i) => {
      ctx.fillText(
        `Strip ${i+1}: height=${r.height}px · segments=${r.segments} · overflow=${r.overflow}`,
        CX, cy
      );
      cy += 20;
    });
    cy += GAP;

    // Footer
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡ InfographicEngine v6 · drawNarrativeStrip · Canvas2D · IBM Plex', IE.W / 2, IE.H - 28);

    // Download
    const n   = new Date();
    const ts  = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}_${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const lnk = document.createElement('a');
    lnk.download = `test_drawNarrativeStrip_${ts}.png`;
    lnk.href     = canvas.toDataURL('image/png', 1.0);
    lnk.click();

    console.log('[InfographicEngine] testNarrativeStrip() complete — PNG download triggered');
    console.log('[InfographicEngine] Final cy:', cy, 'of', IE.H);
    return canvas;
  },

  // ════════════════════════════════════════════════════════════════════
  // V6 STEP 7: NARRATIVE ROUTER INTEGRATION PATCH
  // Applied to composeExecutiveBriefingCard() — additive only.
  // ════════════════════════════════════════════════════════════════════

  /**
   * _applyNarrativeRoute(composed, route, k, slots)
   * Internal helper: takes the output of composeExecutiveBriefingCard()
   * and modulates it based on NarrativeRouter.route() output.
   * Called only when NarrativeRouter is available (graceful degradation).
   *
   * Modulates:
   *   - summary paragraph sentence order
   *   - bullet order and count
   *   - footer line (urgency prefix)
   *   - strip items emphasis
   *   - title prefix (audience-aware)
   *   - anti-alarmism: add growth as last bullet if in crisis mode
   *   - repetition suppression: deduplicates bullets vs summary
   */
  _applyNarrativeRoute: (composed, route, k, slots) => {
    if (!composed || !route) return composed;

    const ss      = route.sentenceStrategy;
    const ls      = route.layoutStrategy;
    const tp      = route.toneProfile;
    const slotOf  = (name) => (slots || []).find(s => s?.slot === name);

    // ── 1. Rebuild summary using route sentence strategy ───────────────
    if (ss && ss.order) {
      const sentenceParts = ss.order
        .slice(0, ss.maxSentences || 2)
        .map(slotName => slotOf(slotName)?.sentence || '')
        .filter(Boolean);

      if (sentenceParts.length > 0) {
        composed.summary = sentenceParts.join(' ').trim().replace(/\s+/g, ' ');
      }
    }

    // ── 1b. Append narrative memory fragment to summary (Step 7.5) ──
    if (route.historySignals?.available && route.historySignals.fragments?.primary) {
      const frag = route.historySignals.fragments.primary;
      const fragKeyword = frag.split(' ').slice(0, 3).join(' ').toLowerCase();
      if (composed.summary && !composed.summary.toLowerCase().includes(fragKeyword)) {
        composed.summary = composed.summary + ' ' + frag;
      }
    }

    // ── 1c. Prepend top forecast narrative (Step 8) ───────────────────
    //  If PPE produced a high-priority forecast narrative, prepend to bullets.
    const forecast = route.historySignals?.forecast;
    if (forecast?.forecastNarratives?.length > 0 && forecast.forecastMeta?.dataQuality === 'good') {
      const topForecast = forecast.forecastNarratives[0];
      const alreadyPresent = (composed.summary || '').toLowerCase().includes('proyeksi');
      if (!alreadyPresent && composed.bullets) {
        // Add forecast as first bullet with neutral/warning tone
        const fcTone = forecast.projectedSeverity === 'critical' ? 'critical' : 'warning';
        composed.bullets.unshift({
          icon:   '🔭',
          tone:   fcTone,
          title:  'Forecast Tekanan',
          body:   topForecast,
          footer: `Proyeksi finish: ${forecast.projectedFinishRange || '—'}`,
        });
      }
    }

    // ── 2. Apply urgency prefix to footer ─────────────────────────────
    if (route.urgencyLevel !== undefined) {
      const prefix = NarrativeRouter.getUrgencyPrefix(route.urgencyLevel);
      if (prefix && composed.footerLine) {
        // Only add prefix if not already present
        if (!composed.footerLine.startsWith(prefix.trim())) {
          composed.footerLine = prefix + composed.footerLine;
        }
      }
      // ALL CAPS footer for extreme urgency (level >= 12)
      if (route.urgencyLevel >= 12 && composed.footerLine) {
        composed.footerLine = composed.footerLine.toUpperCase();
      }
    }

    // ── 3. Cap and reorder bullets by layoutStrategy ───────────────────
    if (ls && typeof ls.maxBullets === 'number') {
      // Filter by bulletFilter mode
      let filtered = [...(composed.bullets || [])];

      if (ls.bulletFilter === 'critical-only') {
        filtered = filtered.filter(b => b.tone === 'critical');
        // Safety: always keep at least 1 if filter removes all
        if (!filtered.length) filtered = composed.bullets.slice(0, 1);
      } else if (ls.bulletFilter === 'growth-first') {
        const growth = filtered.filter(b => b.tone === 'good');
        const rest   = filtered.filter(b => b.tone !== 'good');
        filtered = [...growth, ...rest];
      } else if (ls.bulletFilter === 'critical-first') {
        const crit = filtered.filter(b => b.tone === 'critical');
        const rest = filtered.filter(b => b.tone !== 'critical');
        filtered = [...crit, ...rest];
      } else if (ls.bulletFilter === 'ws-ps-first') {
        // Distributor audience: WS/PS bullets first
        const wsps = filtered.filter(b =>
          (b.title || '').toLowerCase().match(/ws|bima|arjuna|supercup|ps|sell/i));
        const rest = filtered.filter(b =>
          !(b.title || '').toLowerCase().match(/ws|bima|arjuna|supercup|ps|sell/i));
        filtered = [...wsps, ...rest];
      }

      composed.bullets = filtered.slice(0, ls.maxBullets);
    }

    // ── 4. Anti-alarmism: add growth bullet in crisis mode ─────────────
    if (ss?.growthAsLastBullet && route.mode === 'crisis') {
      const growthSlot = slotOf('GROWTH');
      if (growthSlot?.severity === 'good' && growthSlot.sentence) {
        const alreadyHasGrowth = composed.bullets.some(b => b.tone === 'good');
        if (!alreadyHasGrowth) {
          composed.bullets.push({
            icon:   '📈',
            tone:   'good',
            title:  'Positive Signal',
            body:   growthSlot.sentence.length <= 100
                      ? growthSlot.sentence
                      : growthSlot.sentence.slice(0, 97) + '…',
            footer: null
          });
        }
      }
    }

    // ── 5. Repetition suppression ──────────────────────────────────────
    composed.bullets = NarrativeRouter.deduplicateBullets(composed.bullets, composed.summary);

    // ── 6. Strip emphasis from route ──────────────────────────────────
    // 'none' = remove all emphasis flags; 'all' = emphasize all; 'first' = default
    if (ls?.stripEmphasis === 'none' && composed.stripItems) {
      composed.stripItems.forEach(si => { si.emphasis = false; });
    } else if (ls?.stripEmphasis === 'all' && composed.stripItems) {
      // recovery mode: all strip segments glow
      composed.stripItems.forEach((si, i) => { if (i > 0) si.emphasis = (si.tone === 'good'); });
    }

    // ── 7. Add audience prefix to title ───────────────────────────────
    if (tp?.prefix) {
      // Prepend mode prefix only to the card title's leading part
      // Format: "ESKALASI — MORNING BRIEFING · date · time"
      if (!composed.title.startsWith(tp.prefix)) {
        composed.title = tp.prefix + ' ' + composed.title;
      }
    }

    // ── 8. Store route metadata on composed object ────────────────────
    composed.routeMeta = {
      mode:           route.mode,
      dominantSignal: route.dominantSignal,
      urgencyLevel:   route.urgencyLevel,
      contradiction:  route.contradictionFlag,
      recoveryScore:  route.recoveryScore,
      audience:       route.audience,
    };

    return composed;
  },

  // ════════════════════════════════════════════════════════════════════
  // V6 STEP 6: EXECUTIVE BRIEFING ORCHESTRATION LAYER
  // ════════════════════════════════════════════════════════════════════

  // ── composeExecutiveBriefingCard ────────────────────────────────────
  //
  // PURE DATA LAYER — no canvas, no ctx.
  // Reads State.kpi (or accepts a pre-built kpi snapshot) and produces
  // a fully structured content object ready for drawExecutiveBriefingCard.
  //
  // Separation of concerns:
  //   compose() = data intelligence → structured content (serializable)
  //   draw()    = structured content → canvas pixels
  //
  // @param {object} kpi     — State.kpi object, or null (auto-reads State.kpi)
  // @param {object} config
  //   maxBullets  {number}  — max action bullets    default: 5
  //   bulletMode  {'full'|'compact'} — bullet density  default: 'full'
  //   includeGrowth {boolean}        — include growth bullet  default: true
  //   includeChannel {boolean}       — include channel bullet default: true
  //   lang        {'id'|'en'}        — narrative language  default: 'id'
  //
  // @returns {object}
  //   title       — card header title string
  //   severity    — 'critical'|'warning'|'stable'|'opportunity'
  //   summary     — 1-2 sentence executive summary string
  //   bullets     — array of drawActionList-compatible item objects
  //   footerLine  — urgency / closing meta string
  //   stripItems  — array of drawNarrativeStrip-compatible segment objects
  //   layoutMeta  — { estimatedH, bulletCount, accentColor, filterLabel, timestamp }
  //
  composeExecutiveBriefingCard: (kpi, config) => {
    const k   = kpi || (typeof State !== 'undefined' ? State.kpi : null);
    const cfg = config || {};

    // Guard: return safe placeholder if no data available
    if (!k || !k.perf) {
      return {
        title:      'EXECUTIVE BRIEFING',
        severity:   'stable',
        summary:    'Data belum tersedia. Upload file Excel untuk memulai analisis.',
        bullets:    [],
        footerLine: 'Menunggu data —',
        stripItems: [{ tone: 'neutral', icon: 'ℹ', text: 'No data loaded' }],
        layoutMeta: { estimatedH: 200, bulletCount: 0, accentColor: '#5DADE2',
                      filterLabel: '—', timestamp: new Date().toISOString() }
      };
    }

    const C          = InfographicEngine.CLR;
    const maxBullets = cfg.maxBullets || 5;

    // ── 1. Read pre-computed execSlots (ExecSummaryEngine output) ──────
    const slots  = k.execSlots || [];
    const slotOf = (name) => slots.find(s => s && s.slot === name);

    const perfSlot    = slotOf('PERFORMANCE');
    const issueSlot   = slotOf('ISSUE');
    const growthSlot  = slotOf('GROWTH');
    const channelSlot = slotOf('CHANNEL');
    const actionSlot  = slotOf('ACTION');

    // ── 2. Severity scoring ────────────────────────────────────────────
    //  Score 0-100 across 4 dimensions, weighted to get overall severity.
    const p   = k.perf;
    const td  = typeof TimeEngine !== 'undefined' ? TimeEngine.get() : { timeGone: 70, hkRem: 8, hkPass: 15, hkTot: 23 };

    const achGap      = p.ach - td.timeGone;               // negative = behind pace
    const rrRatio     = p.actRR > 0 ? p.reqRR / p.actRR : 1;
    const topScore    = k.alerts?.topIssue?.severityScore ?? 0;
    const critPrinN   = p.byPrin?.filter(pr => pr.tgStatus?.status === 'DANGER').length ?? 0;
    const hkUrgency   = td.hkRem <= 5 ? 30 : td.hkRem <= 8 ? 15 : 0;  // extra urgency late in period

    // Composite risk score (0–100)
    const riskScore =
      topScore * 0.45 +
      Math.max(0, Math.min(100, -achGap * 4)) * 0.30 +
      Math.max(0, Math.min(100, (rrRatio - 1) * 50)) * 0.15 +
      hkUrgency * 0.10;

    let severity;
    if (riskScore >= 65)      severity = 'critical';
    else if (riskScore >= 35) severity = 'warning';
    else if (achGap >= 10)    severity = 'opportunity';
    else                      severity = 'stable';

    // Severity → accent color (from CLR palette)
    const SEVERITY_CLR = {
      critical:    C.redBright,
      warning:     C.amberBright,
      stable:      C.accent,
      opportunity: C.greenBright,
    };
    const accentColor = SEVERITY_CLR[severity];

    // ── 2b. NarrativeRouter hook (Step 7) ────────────────────────────
    //  Route the narrative based on full context.
    //  Gracefully absent if NarrativeRouter not yet loaded.
    // V6 Step 7.5: inject memory signals into NarrativeRouter context
    const _historySignals = (typeof IntelligenceMemoryEngine !== 'undefined')
      ? IntelligenceMemoryEngine.getSignals()
      : null;

    const _route = (typeof NarrativeRouter !== 'undefined')
      ? NarrativeRouter.route({
          kpi:            k,
          severity,
          riskScore,
          achGap,
          rrRatio,
          hkRem:          td.hkRem,
          critPrinN,
          audience:       cfg.audience || 'NSM',
          historySignals: _historySignals,  // temporal intelligence
        })
      : null;

    // ── 3. Title & timestamp ───────────────────────────────────────────
    const now     = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} WIB`;
    const title   = `MORNING BRIEFING  ·  ${dateStr}  ·  ${timeStr}`;

    // ── 4. Summary paragraph ──────────────────────────────────────────
    //  Compose 1–2 sentences from PERFORMANCE + ISSUE slots.
    //  Priority order:
    //    critical: ISSUE sentence first, then PERFORMANCE context
    //    warning:  PERFORMANCE first, then ISSUE
    //    stable/opp: PERFORMANCE + GROWTH
    let summary = '';

    if (severity === 'critical') {
      // Issue-first ordering
      const iss  = issueSlot?.sentence || '';
      const perf = perfSlot?.sentence  || '';
      if (iss && perf) {
        summary = iss + ' ' + perf;
      } else {
        summary = iss || perf || 'Situasi kritis terdeteksi — lihat detail di bawah.';
      }
    } else if (severity === 'warning') {
      const perf = perfSlot?.sentence  || '';
      const iss  = issueSlot?.sentence || '';
      summary = perf + (iss ? ' ' + iss : '');
    } else if (severity === 'opportunity') {
      const perf   = perfSlot?.sentence   || '';
      const growth = growthSlot?.sentence || '';
      summary = perf + (growth ? ' ' + growth : '');
    } else {
      // stable
      const perf = perfSlot?.sentence || '';
      const ch   = channelSlot?.sentence || '';
      summary = perf + (ch && ch !== perf ? ' ' + ch : '');
    }
    summary = summary.trim().replace(/\s+/g, ' ');

    // ── 5. Bullet items from alerts.top5 ──────────────────────────────
    //  Convert AlertEngine issues into drawActionList-compatible items.
    //  Each issue has: badgeLabel, headline, action, severityScore, domain
    const rawAlerts  = k.alerts?.top5 || [];
    const maxBull    = Math.min(maxBullets, rawAlerts.length);

    const bullets = rawAlerts.slice(0, maxBull).map(issue => {
      const score  = issue.severityScore || 0;
      const tone   = score >= 65 ? 'critical' : score >= 35 ? 'warning' : 'neutral';
      const icon   = score >= 65 ? '🔴' : score >= 35 ? '⚠' : 'ℹ';

      // Title: short, ≤55 chars — condense headline
      let title = issue.headline || '';
      // Strip trailing metric noise if too long
      if (title.length > 55) {
        const firstClause = title.split(/[—–-]|\.{3}|\.\s/)[0];
        title = firstClause.trim().slice(0, 55);
        if (title.length < (issue.headline?.length || 0)) title += '…';
      }

      // Body: action sentence — the specific recommendation
      const body = issue.action || null;

      // Footer: quantified metric extracted from headline tail or data
      let footer = null;
      if (issue.data) {
        const d = issue.data;
        if (d.gap   !== undefined) footer = `Gap: ${typeof Utils !== 'undefined' ? Utils.fmtCompact(d.gap) : d.gap}`;
        else if (d.reqRR !== undefined) footer = `Need ${typeof Utils !== 'undefined' ? Utils.fmtCompact(d.reqRR) : d.reqRR}/HK`;
        else if (d.zro  !== undefined && d.total !== undefined) footer = `${d.zro}/${d.total} zero-trx`;
      }

      return { icon, tone, title: title || '—', body, footer };
    });

    // ── 6. Optionally add Growth bullet if significant & space allows ──
    if (cfg.includeGrowth !== false && bullets.length < maxBullets && growthSlot?.severity === 'good') {
      const growthSentence = growthSlot.sentence || '';
      if (growthSentence) {
        bullets.push({
          icon:   '📈',
          tone:   'good',
          title:  'Peluang Pertumbuhan',
          body:   growthSentence.length <= 100
                    ? growthSentence
                    : growthSentence.slice(0, 97) + '…',
          footer: null
        });
      }
    }

    // ── 7. Footer urgency line ────────────────────────────────────────
    //  From ACTION slot sentence; fallback to a computed urgency statement.
    let footerLine = actionSlot?.sentence || '';
    if (!footerLine) {
      if (severity === 'critical') {
        footerLine = `Sisa ${td.hkRem} HK — eskalasi distribusi dan coverage diperlukan segera.`;
      } else if (severity === 'warning') {
        footerLine = `Sisa ${td.hkRem} HK — akselerasi run rate ke ${typeof Utils !== 'undefined' ? Utils.fmtCompact(p.reqRR) : p.reqRR}/HK.`;
      } else if (severity === 'opportunity') {
        footerLine = `Posisi kuat — jaga momentum dan pertahankan run rate di atas pace hingga close.`;
      } else {
        footerLine = `Monitoring rutin — tidak ada eskalasi diperlukan saat ini.`;
      }
    }

    // ── 8. Strip items for NarrativeStrip header ──────────────────────
    //  First segment = overall status (emphasized)
    //  Subsequent = top 3 from alerts.top5 (condensed)
    const stripItems = [];

    // Overall status segment (always first, always emphasis)
    const statusIcon = severity === 'critical' ? '🔴'
      : severity === 'warning'  ? '⚠'
      : severity === 'opportunity' ? '✅'
      : '✓';
    stripItems.push({
      tone:     severity === 'opportunity' ? 'good' : severity,
      icon:     statusIcon,
      text:     `${typeof Utils !== 'undefined' ? Utils.fmtPct(p.ach) : p.ach.toFixed(1)+'%'} Ach`,
      emphasis: true
    });

    // Pace segment
    stripItems.push({
      tone:  achGap >= 0 ? 'good' : achGap >= -10 ? 'warning' : 'critical',
      icon:  achGap >= 0 ? '↑' : '↓',
      text:  `Pace ${typeof Utils !== 'undefined' ? Utils.fmtPct(td.timeGone) : td.timeGone.toFixed(1)+'%'}`
    });

    // Top issue abbreviated (if critical/warning)
    const topIssue = k.alerts?.topIssue;
    if (topIssue) {
      const issText = topIssue.headline?.split(' ').slice(0, 4).join(' ') + '…' || 'Issue aktif';
      stripItems.push({ tone: topIssue.severityScore >= 65 ? 'critical' : 'warning', icon: '⚠', text: issText });
    }

    // HK remaining segment
    stripItems.push({
      tone: td.hkRem <= 5 ? 'critical' : td.hkRem <= 8 ? 'warning' : 'neutral',
      icon: '⏱',
      text: `${td.hkRem} HK sisa`
    });

    // ── 9. Layout metadata ────────────────────────────────────────────
    const STRIP_H   = 44;
    const SUMMARY_H = 84;
    const DIVIDER_H = 20;
    const BULLET_H  = 100;  // avg per bullet (body = ~1 line)
    const FOOTER_H  = 40;
    const CARD_PAD  = 24;

    const estimatedH = CARD_PAD
      + STRIP_H
      + DIVIDER_H
      + SUMMARY_H
      + DIVIDER_H
      + bullets.length * BULLET_H
      + FOOTER_H
      + CARD_PAD;

    const filterLabel = typeof InfographicEngine._filterLabel === 'function'
      ? InfographicEngine._filterLabel()
      : 'ALL DATA';

    // ── Base composed object ──────────────────────────────────────────
    const composed = {
      title,
      severity,
      summary,
      bullets,
      footerLine,
      stripItems,
      layoutMeta: {
        estimatedH,
        bulletCount:   bullets.length,
        severity,
        accentColor,
        filterLabel,
        timestamp:     now.toISOString(),
        riskScore:     Math.round(riskScore),
        achGap:        parseFloat(achGap.toFixed(1)),
      }
    };

    // ── Apply NarrativeRouter modulation (Step 7) ─────────────────────
    //  _route is null if NarrativeRouter not loaded — compose returns as-is.
    if (_route) {
      InfographicEngine._applyNarrativeRoute(composed, _route, k, slots);
      // Update layoutMeta with route data
      composed.layoutMeta.bulletCount = composed.bullets.length;
      composed.layoutMeta.narrativeMode = _route.mode;
    }

    return composed;
  },

  // ── drawExecutiveBriefingCard ────────────────────────────────────────
  //
  // CANVAS DRAW LAYER.
  // Takes the output of composeExecutiveBriefingCard() and renders it to
  // canvas using all v6 primitives: drawNarrativeStrip, drawActionList,
  // drawInsightBox. Returns finalY.
  //
  // @param {CanvasRenderingContext2D} ctx
  // @param {number} x, y        — top-left of the card
  // @param {number} w           — card width
  // @param {object} composed    — output of composeExecutiveBriefingCard()
  // @param {object} config
  //   mode    {'full'|'compact'|'export'|'dark'}  default: 'full'
  //   showStrip   {boolean}   default: true
  //   showSummary {boolean}   default: true
  //   showBullets {boolean}   default: true
  //   showFooter  {boolean}   default: true
  //   cardBg  {boolean}   draw full card background  default: true
  //   cornerR {number}    corner radius for card bg  default: 10
  //
  // @returns {number} finalY
  //
  drawExecutiveBriefingCard: (ctx, x, y, w, composed, config) => {
    const C   = InfographicEngine.CLR;
    const F   = InfographicEngine.FONT;
    const cfg = config || {};
    const IE  = InfographicEngine;

    if (!composed || !w) return y;

    const isCompact = cfg.mode === 'compact';
    const isExport  = cfg.mode === 'export';

    const accentColor  = composed.layoutMeta?.accentColor || C.accent;
    const CARD_PAD     = isCompact ? 14 : 20;
    const INNER_W      = w - CARD_PAD * 2;
    const INNER_X      = x + CARD_PAD;
    const cornerR      = cfg.cornerR ?? 10;

    let cy = y + CARD_PAD;

    // ── Card background ────────────────────────────────────────────────
    if (cfg.cardBg !== false) {
      IE._rrect(ctx, x, y, w, composed.layoutMeta.estimatedH, cornerR);
      ctx.fillStyle = C.surface;
      ctx.fill();
      // Accent top border
      ctx.fillStyle = accentColor;
      ctx.fillRect(x, y, w, 3);
      // Subtle card border
      IE._rrect(ctx, x, y, w, composed.layoutMeta.estimatedH, cornerR);
      ctx.strokeStyle = IE._hexToRgba(accentColor, 0.25);
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // ── Header: NarrativeStrip ─────────────────────────────────────────
    if (cfg.showStrip !== false && composed.stripItems?.length) {
      const stripResult = IE.drawNarrativeStrip(ctx, INNER_X, cy, INNER_W, composed.stripItems, {
        mode:         isCompact ? 'compact' : 'full',
        bg:           'solid',
        topBorder:    false,
        bottomBorder: true,
        borderColor:  IE._hexToRgba(accentColor, 0.3),
        roundedCorners: 6
      });
      cy += stripResult.height + (isCompact ? 10 : 14);
    }

    // ── Summary paragraph ──────────────────────────────────────────────
    if (cfg.showSummary !== false && composed.summary) {
      // Section title
      const titleY = cy;
      ctx.fillStyle = IE._hexToRgba(accentColor, 0.6);
      ctx.fillRect(INNER_X, titleY, 3, 18);
      ctx.font         = F.label(isCompact ? 12 : 13);
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('EXECUTIVE SUMMARY', INNER_X + 10, titleY + 2);
      cy += 24;

      // Summary text — word-wrapped
      const summaryFont = `400 ${isCompact ? 18 : 20}px "IBM Plex Sans", sans-serif`;
      const summaryLH   = isCompact ? 26 : 30;
      ctx.font         = summaryFont;
      ctx.fillStyle    = C.textPrimary;
      ctx.textBaseline = 'top';
      const summaryLines = IE._wrapText(ctx, composed.summary, INNER_W);
      const shownLines   = summaryLines.slice(0, 4);  // max 4 lines
      shownLines.forEach((line) => {
        ctx.fillText(line, INNER_X, cy);
        cy += summaryLH;
      });
      cy += isCompact ? 8 : 12;
    }

    // ── Divider ────────────────────────────────────────────────────────
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(INNER_X, cy);
    ctx.lineTo(INNER_X + INNER_W, cy);
    ctx.stroke();
    cy += isCompact ? 8 : 14;

    // ── Bullets: drawActionList ────────────────────────────────────────
    if (cfg.showBullets !== false && composed.bullets?.length) {
      const titleY = cy;
      ctx.fillStyle = IE._hexToRgba(accentColor, 0.6);
      ctx.fillRect(INNER_X, titleY, 3, 18);
      ctx.font         = F.label(isCompact ? 12 : 13);
      ctx.fillStyle    = C.textMuted;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('PRIORITY ACTIONS', INNER_X + 10, titleY + 2);
      cy += 24;

      cy = IE.drawActionList(ctx, INNER_X, cy, INNER_W, composed.bullets, {
        compact:    isCompact,
        numbered:   true,
        showFooter: !isCompact,
        bodyMaxLines: 2,
      });
      cy += isCompact ? 6 : 10;
    }

    // ── Footer urgency line ────────────────────────────────────────────
    if (cfg.showFooter !== false && composed.footerLine) {
      // Separator
      ctx.strokeStyle = C.border;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(INNER_X, cy);
      ctx.lineTo(INNER_X + INNER_W, cy);
      ctx.stroke();
      cy += isCompact ? 6 : 8;

      ctx.font         = `600 ${isCompact ? 14 : 15}px "IBM Plex Mono", monospace`;
      ctx.fillStyle    = accentColor;
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'top';
      const footerText = IE._truncate(ctx, composed.footerLine, INNER_W);
      ctx.fillText(footerText, INNER_X, cy);
      cy += isCompact ? 22 : 28;
    }

    cy += CARD_PAD;
    return cy;
  },

  // ── testExecutiveBriefingCard ────────────────────────────────────────
  //
  // 1080×1350 test canvas with 7 scenarios.
  // Run: InfographicEngine.testExecutiveBriefingCard()
  //
  testExecutiveBriefingCard: () => {
    const IE = InfographicEngine;
    const C  = IE.CLR;
    const F  = IE.FONT;

    const canvas = IE._createCanvas();
    const ctx    = IE._getCtx(canvas);

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, IE.W, IE.H);

    ctx.font = F.label(22); ctx.fillStyle = C.textSec;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('composeExecutiveBriefingCard — v6 Orchestration Test', 28, 24);
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.fillText('All severity modes · Canvas2D · IBM Plex · 1080×1350', 28, 52);

    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(28, 76); ctx.lineTo(IE.W - 28, 76); ctx.stroke();

    const CX = 28, CW = IE.W - 56;
    let cy = 90;
    const GAP = 16;

    // Synthetic mock KPI builder — creates a minimal State.kpi-like object
    const mockKpi = (overrides) => {
      const base = {
        perf: {
          ach: 72.3, gap: -47300000000, vsLM: -2.1,
          reqRR: 12400000, actRR: 9200000, totTgt: 285000000000, totAct: 206000000000,
          tgStatus: { status: 'DANGER', gap: -5.2 },
          byPrin: [
            { principle: 'GPPJ',  ach: 58.2, tgStatus: { status: 'DANGER', gap: -14 }, trend: { hasLM: true, vsLM: -3.1 }, act: 50000000000 },
            { principle: 'MBR',   ach: 65.1, tgStatus: { status: 'DANGER', gap: -7 },  trend: { hasLM: true, vsLM: +1.2 }, act: 40000000000 },
            { principle: 'GBS',   ach: 78.4, tgStatus: { status: 'WARNING', gap: -2 }, trend: { hasLM: true, vsLM: +4.8 }, act: 60000000000 },
            { principle: 'GGBI',  ach: 88.1, tgStatus: { status: 'GOOD', gap: 3 },     trend: { hasLM: true, vsLM: +8.2 }, act: 56000000000 },
          ],
          byReg: [
            { region: 'Jabar2',    ach: 55.1 },
            { region: 'Jatakalbar',ach: 61.3 },
            { region: 'Jabodetabek',ach: 91.2 },
          ]
        },
        alerts: {
          top5: [
            { headline: 'GPPJ tertahan — gap -42B dari target TM saat ini', action: 'Eskalasi ke RSM dan push coverage GT segera', severityScore: 82, domain: 'PERFORMANCE', type: 'principle-pace', data: { gap: -42000000000 } },
            { headline: '18 WS Bima belum transaksi hari ini dari 45 aktif', action: 'Hubungi TSO untuk follow-up 18 WS zero-trx sebelum 14:00', severityScore: 67, domain: 'WHOLESALER', type: 'zero-trx', data: { zro: 18, total: 45 } },
            { headline: 'MBR run rate 8.2M/HK — butuh 13.5M/HK di sisa 8 HK', action: 'Review program Arjuna MBR — tingkatkan incentive outlet', severityScore: 55, domain: 'PERFORMANCE', type: 'runrate', data: { reqRR: 13500000, actRR: 8200000 } },
            { headline: 'CA GT Modern drop 8.2% vs LM — 42 outlet hilang', action: 'Aktifkan retensi GT Modern di Jabar2 dan Jatakalbar', severityScore: 38, domain: 'CA', type: 'ca-drop', data: { gap: -42 } },
          ],
          topIssue: { headline: 'GPPJ tertahan — gap -42B dari target TM saat ini', action: 'Eskalasi RSM', severityScore: 82, domain: 'PERFORMANCE', type: 'principle-pace', data: { gap: -42000000000 } },
          issues: [{ badgeLabel: 'CRITICAL', headline: 'GPPJ kritis' }]
        },
        ca: { zero: 42, lm: 512, byCh: [{ name: 'GT Modern', delta: -8.2, ca: 420, lm: 462, gap: -42 }] },
        ws: { allTrend: { vsLM: +3.2 }, allZero: 18 },
        ps: { siAch: 82.1, soAch: 76.4, hasData: true },
        execSlots: null,  // will be built inline below
      };

      // Build execSlots synchronously from mock data
      base.execSlots = typeof ExecSummaryEngine !== 'undefined'
        ? ExecSummaryEngine.build(base)
        : [
            { slot: 'PERFORMANCE', icon: '📊', label: 'Performance', sentence: 'Capaian 72.3% tertinggal 4.6pp dari pace — dibutuhkan run rate 12.4M/HK di sisa 8 HK.', severity: 'warning' },
            { slot: 'ISSUE', icon: '⚠️', label: 'Issue', sentence: 'GPPJ tertahan signifikan dari pace — dampaknya mempengaruhi capaian bulan ini.', severity: 'critical' },
            { slot: 'GROWTH', icon: '📈', label: 'Growth', sentence: 'GGBI tumbuh +8.2% vs LM — menjadi motor pertumbuhan terkuat periode ini.', severity: 'good' },
            { slot: 'CHANNEL', icon: '📣', label: 'Channel', sentence: 'GT Modern turun 8.2% CA vs LM — aktifkan program retensi di channel ini.', severity: 'warning' },
            { slot: 'ACTION', icon: '⚡', label: 'Action', sentence: 'Sisa 8 HK — eskalasi strategi distribusi diperlukan hari ini.', severity: 'critical' },
          ];

      return Object.assign({}, base, overrides);
    };

    // ── Test 1: Live data (if available) OR mock critical scenario ─────
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText('Scenario 1 — CRITICAL · 3 bullets · standard mode', CX, cy);
    cy += 22;

    const liveKpi  = (typeof State !== 'undefined' && State.kpi?.perf) ? State.kpi : null;
    const kpi1     = liveKpi || mockKpi({});
    const composed1 = IE.composeExecutiveBriefingCard(kpi1, { maxBullets: 3 });
    cy = IE.drawExecutiveBriefingCard(ctx, CX, cy, CW, composed1, { mode: 'full', cardBg: true });
    cy += GAP;

    // ── Test 2: Compact / WhatsApp mode ───────────────────────────────
    ctx.font = F.label(14); ctx.fillStyle = C.textMuted;
    ctx.textBaseline = 'top';
    ctx.fillText('Scenario 2 — Compact WA mode · showFooter:false', CX, cy);
    cy += 22;

    const composed2 = IE.composeExecutiveBriefingCard(liveKpi || mockKpi({}), { maxBullets: 3 });
    cy = IE.drawExecutiveBriefingCard(ctx, CX, cy, CW, composed2, {
      mode: 'compact', cardBg: true, showFooter: false
    });
    cy += GAP;

    // Page footer
    ctx.font = F.sans(15); ctx.fillStyle = C.textMuted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡ InfographicEngine v6 · composeExecutiveBriefingCard · Canvas2D', IE.W / 2, IE.H - 28);

    // Download
    const n   = new Date();
    const ts  = `${n.getFullYear()}${String(n.getMonth()+1).padStart(2,'0')}${String(n.getDate()).padStart(2,'0')}_${String(n.getHours()).padStart(2,'0')}${String(n.getMinutes()).padStart(2,'0')}`;
    const lnk = document.createElement('a');
    lnk.download = `test_composeExecutiveBriefingCard_${ts}.png`;
    lnk.href     = canvas.toDataURL('image/png', 1.0);
    lnk.click();

    console.log('[InfographicEngine] testExecutiveBriefingCard() — download triggered');
    console.log('[InfographicEngine] composed1:', composed1.severity, '| bullets:', composed1.bullets.length, '| estimatedH:', composed1.layoutMeta.estimatedH);
    console.log('[InfographicEngine] cy reached:', cy, 'of', IE.H);
    return canvas;
  },


};

// ════════════════════════════════════════════════════════════════════════
// V6 BACKWARD COMPATIBILITY ALIAS
// ════════════════════════════════════════════════════════════════════════
// All v5 references to ExecCardEngine continue to work unchanged.
// The HTML toolbar button (onclick="ExecCardEngine.exportCard(...)") resolves through this alias.
// DO NOT remove this alias — it is load-bearing for v5 compatibility.
const ExecCardEngine = InfographicEngine;
