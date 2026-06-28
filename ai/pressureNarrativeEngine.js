// ==========================================
// AI LAYER — pressureNarrativeEngine.js
// ==========================================
// Source: index.html lines 10390–10493
// Extracted: AI Cluster Extraction
//
// Dependencies: Utils (external: fmtPct, fmtCompact)
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// PRESSURE NARRATIVE ENGINE
// ==========================================
/**
 * PressureNarrativeEngine
 * Generates executive-quality forecast narratives in Bahasa Indonesia.
 * Each narrative is traceable to a specific signal or condition.
 * Returns max 4 narratives, prioritized by severity.
 */
const PressureNarrativeEngine = {

  /**
   * compose(conditions, paceProj, recSust, escProb, hkPressure, per, td, kpi)
   * → string[] of executive narrative statements
   */
  compose: (conditions, paceProj, recSust, escProb, hkPressure, per, td, kpi) => {
    const narratives = [];
    const p  = kpi?.perf || {};
    const fmtPct = (v) => (typeof Utils !== 'undefined' ? Utils.fmtPct(v) : v?.toFixed(1) + '%');
    const fmtC   = (v) => (typeof Utils !== 'undefined' ? Utils.fmtCompact(v) : String(v));

    // ── 1. Escalation probability ─────────────────────────────────
    if (escProb >= 0.75) {
      narratives.push({ w: 10, type: 'critical',
        text: `⚠️ Probabilitas eskalasi ke CRITICAL dalam 3 HK: ${Math.round(escProb*100)}% — tindakan mendesak diperlukan.` });
    } else if (escProb >= 0.55) {
      narratives.push({ w: 8, type: 'warning',
        text: `⚠️ Risiko eskalasi ke CRITICAL dalam 3 HK moderat (${Math.round(escProb*100)}%) — monitor harian.` });
    }

    // ── 2. Pace projection narrative ─────────────────────────────
    if (paceProj.method !== 'pace_ratio' || paceProj.midpoint < 100) {
      const rangeStr = `${paceProj.low.toFixed(1)}%–${paceProj.high.toFixed(1)}%`;
      if (paceProj.midpoint < 92) {
        narratives.push({ w: 9, type: 'critical',
          text: `📉 Trajectory saat ini mengindikasikan finish di kisaran ${rangeStr} — di bawah target minimal.` });
      } else if (paceProj.midpoint < 97) {
        narratives.push({ w: 7, type: 'warning',
          text: `📉 Proyeksi capaian akhir: ${rangeStr} — masih memungkinkan namun memerlukan akselerasi.` });
      } else {
        narratives.push({ w: 5, type: 'good',
          text: `📈 Proyeksi capaian akhir: ${rangeStr} — on track atau melampaui target.` });
      }
    }

    // ── 3. Condition-specific narratives ─────────────────────────
    const condIds = conditions.map(c => c.id);

    if (condIds.includes('accelerating_collapse')) {
      narratives.push({ w: 10, type: 'critical',
        text: `📉 Penurunan mengakselerasi — setiap HK lebih buruk dari sebelumnya. Tanpa intervensi, eskalasi tak terhindarkan.` });
    }
    if (condIds.includes('late_month_panic_risk')) {
      narratives.push({ w: 9, type: 'critical',
        text: `⏱️ Risiko panic closing end-of-month: ${td.hkRem} HK tersisa dengan tekanan run rate tinggi — eskalasi strategi distribusi sekarang.` });
    }
    if (condIds.includes('runrate_impossibility')) {
      const rr = p.reqRR;
      narratives.push({ w: 9, type: 'critical',
        text: `🔢 Run rate yang dibutuhkan (${fmtC(rr)}/HK) tidak realistis — perlu revisi target atau push luar biasa dalam ${td.hkRem} HK.` });
    }
    if (condIds.includes('hk_pressure_escalation')) {
      narratives.push({ w: 8, type: 'warning',
        text: `⏱️ Tekanan HK mengakselerasi — gap dan run rate requirement mengeras dengan menyempitnya sisa hari kerja.` });
    }
    if (condIds.includes('sustained_deterioration')) {
      narratives.push({ w: 8, type: 'warning',
        text: `📉 Deteriorasi berlangsung ${per.declineStreak} HK berturut-turut — bukan insiden sesaat, pola sistemik.` });
    }
    if (condIds.includes('fragile_recovery')) {
      narratives.push({ w: 7, type: 'warning',
        text: `📊 Recovery saat ini bersifat fragile — ${recSust.drivers?.[0] || 'sustainability belum terkonfirmasi'}.` });
    }
    if (condIds.includes('temporary_rebound')) {
      narratives.push({ w: 7, type: 'warning',
        text: `⚠️ Bounce hari ini kemungkinan sementara — konteks sebelumnya 3 HK menurun. Belum cukup untuk konfirmasi reversal.` });
    }
    if (condIds.includes('recurring_execution_anomaly')) {
      const anomId = conditions.find(c => c.id === 'recurring_execution_anomaly');
      narratives.push({ w: 7, type: 'warning',
        text: `🔬 Anomali eksekusi berulang terdeteksi — bukan insiden terisolasi, indikasi kelemahan sistemik operasional.` });
    }
    if (condIds.includes('recovery_stabilization')) {
      narratives.push({ w: 6, type: 'good',
        text: `📈 Recovery menunjukkan tanda stabilisasi — ${per.recoveryStreak} HK konsisten membaik dengan momentum yang terjaga.` });
    }
    if (condIds.includes('momentum_exhaustion')) {
      narratives.push({ w: 5, type: 'warning',
        text: `📊 Momentum recovery mulai melambat — pertahankan tekanan agar tidak kembali terdepresi.` });
    }

    // ── 4. Positive close narrative ───────────────────────────────
    if (!condIds.some(id => ['accelerating_collapse','late_month_panic_risk','runrate_impossibility'].includes(id))) {
      if (paceProj.midpoint >= 95) {
        narratives.push({ w: 4, type: 'good',
          text: `✅ Proyeksi close kuat (${paceProj.midpoint.toFixed(1)}%) — pertahankan run rate dan pastikan tidak ada penurunan coverage.` });
      }
    }

    // Sort by weight, take top 4
    narratives.sort((a, b) => b.w - a.w);
    return narratives.slice(0, 4).map(n => n.text);
  },
};
