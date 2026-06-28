// ==========================================
// AI LAYER — narrativeMemoryEngine.js
// ==========================================
// Source: index.html lines 9783–9875
// Extracted: AI Cluster Extraction
//
// Dependencies: NONE
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
// NARRATIVE MEMORY ENGINE
// ==========================================
/**
 * NarrativeMemoryEngine
 * Generates contextual narrative fragments from persistence + pattern signals.
 * Fragments are injected by _applyNarrativeRoute() into the composed summary.
 * Language: Bahasa Indonesia (operational FMCG context).
 */
const NarrativeMemoryEngine = {

  /**
   * compose(persistence, patterns) → { primary, secondary, context }
   * Selects the most relevant narrative fragment set from signal data.
   * Returns at most: 1 primary fragment + 1 secondary fragment.
   * Never returns both warning AND positive fragments — dominant signal wins.
   */
  compose: (persistence, patterns) => {
    if (!persistence || !patterns) return { primary: null, secondary: null, context: [] };

    const frags = [];

    // ── 1. Streak-based fragments (highest priority) ─────────────────
    if (patterns.acceleratingCollapse) {
      frags.push({ type: 'critical', weight: 10,
        text: `Tekanan mengakselerasi — setiap HK lebih buruk dari sebelumnya.` });
    }
    if (patterns.falseRecovery) {
      frags.push({ type: 'warning', weight: 9,
        text: `Bounce sebelumnya terbukti tidak bertahan — waspadai pola yang sama.` });
    }
    if (persistence.declineStreak >= 4) {
      frags.push({ type: 'critical', weight: 8,
        text: `Penurunan berlangsung ${persistence.declineStreak} HK berturut-turut — bukan gangguan sesaat.` });
    } else if (persistence.declineStreak >= 2) {
      frags.push({ type: 'warning', weight: 6,
        text: `Tekanan memasuki HK ke-${persistence.declineStreak + 1} berturut-turut.` });
    }
    if (patterns.sustainedRecovery) {
      frags.push({ type: 'good', weight: 8,
        text: `Recovery telah bertahan ${persistence.recoveryStreak} HK — momentum riil terkonfirmasi.` });
    } else if (persistence.recoveryStreak >= 2 && !patterns.falseRecovery) {
      frags.push({ type: 'good', weight: 5,
        text: `Perbaikan berlanjut ${persistence.recoveryStreak} HK — masih perlu divalidasi.` });
    }

    // ── 2. Pattern-based fragments ────────────────────────────────────
    if (patterns.recurringAnomalies.length > 0) {
      const topId = patterns.recurringAnomalies[0].replace(/-/g, ' ');
      frags.push({ type: 'warning', weight: 7,
        text: `Anomali "${topId}" berulang di 3+ HK terakhir — bukan insiden terisolasi.` });
    }
    if (patterns.persistentWeakPrins.length > 0) {
      const prins = patterns.persistentWeakPrins.slice(0, 2).join(', ');
      frags.push({ type: 'warning', weight: 7,
        text: `${prins} konsisten di zona DANGER selama 3+ HK — eskalasi prinsip ini.` });
    }
    if (patterns.temporaryBounce) {
      frags.push({ type: 'warning', weight: 8,
        text: `Kenaikan hari ini terjadi setelah 3 HK turun — belum cukup untuk konfirmasi recovery.` });
    }
    if (patterns.volatilePersistence) {
      frags.push({ type: 'neutral', weight: 4,
        text: `Volatilitas persisten — fluktuasi harian tinggi menyulitkan proyeksi akurat.` });
    }
    if (patterns.stableHighPerformer) {
      frags.push({ type: 'good', weight: 3,
        text: `Performa konsisten tinggi — semua KPI stabil di atas target pace.` });
    }

    // ── 3. Select: dominant type wins, pick top 2 ────────────────────
    if (!frags.length) return { primary: null, secondary: null, context: [] };

    frags.sort((a, b) => b.weight - a.weight);

    // Anti-contradiction: if top fragment is critical/warning, suppress 'good' at position 1
    const primary = frags[0];
    let secondary = null;
    if (frags.length > 1) {
      const candidate = frags[1];
      const conflicting =
        (primary.type === 'critical' && candidate.type === 'good') ||
        (primary.type === 'good'     && candidate.type === 'critical');
      secondary = conflicting ? null : candidate;
    }

    return {
      primary:   primary.text,
      secondary: secondary?.text || null,
      context:   frags.map(f => f.text),
    };
  },
};
