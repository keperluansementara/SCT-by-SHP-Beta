/**
 * config.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Application configuration: color palette, CA channel whitelist, sheet aliases.
 * No functions except isFocusChannel (pure predicate, no side effects).
 *
 * Source: Config object (SCT-by-SHP.html lines 847–867)
 *
 * Dependencies:
 *   none — this is the root of the dependency tree
 *
 * Consumers (after integration):
 *   constants.js     — COLORS, FOCUS_CHANNELS, SHEET_ALIASES are mirrored in CONSTANTS
 *   helpers.js       — isFocusChannel (currently on Config, mirrored in Helpers)
 *   parser.js        — SHEET_ALIASES (findSheet fuzzy matching)
 *   kpiEngine.js     — COLORS
 *   chartEngine.js   — COLORS
 *   filterEngine.js  — isFocusChannel
 *
 * Load order:
 *   config.js  ← first (no deps)
 *   constants.js, formatter.js, helpers.js, ...
 *
 * ⚠ FROZEN: Do not change FOCUS_CHANNELS or SHEET_ALIASES without product
 *   team sign-off. These lists govern which data appears in CA charts,
 *   rankings, traffic light, and commentary — wrong changes break BB2.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const Config = {
  COLORS: {
    green: '#1E8449', amber: '#D35400', red: '#C0392B',
    blue: '#1A5276', gray: '#E5E5EA', dark: '#1C1C1E'
  },
  // ── CA Channel Governance (Section 2) — strategic channel whitelist ──
  // Only these channels appear in CA channel charts, rankings, traffic light,
  // insights & commentary. All others (Others, E-COM, PDE, HEALTH & BEAUTY, …) are hidden.
  FOCUS_CHANNELS: ['WHOLESALER', 'RETAIL', 'MTI', 'NKA', 'PS', 'SPECIALTY CHANNEL', 'FOOD SERVICE', 'MTI FS', 'RETAIL FS', 'WHOLESALER FS'],
  isFocusChannel: (name) => name != null && Config.FOCUS_CHANNELS.includes(name.toString().trim().toUpperCase()),
  SHEET_ALIASES: {
    dimdate: ['DimDate', 'Dim Date', 'dimdate', 'HK', 'WorkingDay', 'WorkingDays', 'Hari Kerja'],
    perf: ['Perfomance', 'Performance', 'performance'],
    arjuna: ['ITG_Arjuna', 'ITG Arjuna', 'Arjuna'],
    bima: ['ITG_Bima', 'ITG Bima', 'Bima'],
    supercup: ['ITG_Supercup', 'ITG Supercup', 'Supercup'],
    ps: ['PS_Achiever', 'PS Achiever', 'PSAchiever'],
    caMaster: ['CA_Master', 'CA Master', 'CAMaster', 'ca_master'],
    wholesaler: ['Wholesaler', 'wholesaler', 'WS', 'Wholeseler'],
    mt: ['MT', 'MonitorMT', 'Monitor MT', 'MonitorDaily MT', 'mt']
  }
};
