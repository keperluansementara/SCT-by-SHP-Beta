/**
 * core/configLoader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sprint 23.5 — Zero Configuration Architecture
 *
 * Responsibilities:
 *   1. Fetch config/config.json (or any future source — Task 12)
 *   2. Validate required fields (bridgeUrl, driveId, version)
 *   3. Inject into State.runtimeConfig + window.ConfigRuntime
 *   4. Return config to bootstrap caller
 *
 * DEPENDENCY INJECTION PATTERN (Task 12):
 *   Swap ConfigLoader._strategy to change the config source without touching
 *   GoogleDriveEngine or any business engine:
 *
 *   Current:  JSON file   → ConfigLoader._strategy = jsonStrategy
 *   Future A: REST API    → ConfigLoader._strategy = restApiStrategy
 *   Future B: Firebase    → ConfigLoader._strategy = firebaseStrategy
 *   Future C: Supabase    → ConfigLoader._strategy = supabaseStrategy
 *   Future D: Admin CMS   → ConfigLoader._strategy = cmsStrategy
 *
 * SECURITY (Task 11):
 *   bridgeUrl and driveId are injected at runtime only.
 *   They are never stored in localStorage, never editable via UI.
 *
 * REGRESSION GUARD:
 *   This module does NOT touch Parser, KPIEngine, RenderEngine, FilterEngine,
 *   ExportEngine, State.raw, State.filtered, or any business calculation.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* global State */

const ConfigLoader = {

  /** URL of the configuration file (can be overridden before load() is called). */
  CONFIG_URL: 'config/config.json',

  // ──────────────────────────────────────────────────────────────────────────
  // STRATEGY — swap this function to change config source (Task 12)
  // Default: JSON file fetch
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * _strategy(url) — pluggable fetch strategy.
   * Replace with API / Firebase / Supabase / CMS adapter as needed.
   * Must return a Promise that resolves to a plain config object.
   */
  _strategy: async (url) => {
    const response = await fetch(url, {
      method: 'GET',
      cache:  'no-cache',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      throw {
        code    : 'CONFIG_LOAD_FAILED',
        status  : response.status,
        message : 'HTTP ' + response.status + ' — could not load ' + url
      };
    }
    return response.json();
  },

  // ──────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * _validate(cfg) — enforce required fields.
   * Throws {code:'CONFIG_LOAD_FAILED', missing:[]} on failure.
   */
  _validate: (cfg) => {
    if (!cfg || typeof cfg !== 'object') {
      throw { code: 'CONFIG_LOAD_FAILED', message: 'Config is not a valid object' };
    }
    const required = ['bridgeUrl', 'driveId', 'version'];
    const missing  = required.filter(function(k) { return !cfg[k]; });
    if (missing.length) {
      throw {
        code    : 'CONFIG_LOAD_FAILED',
        missing : missing,
        message : 'Missing required config fields: ' + missing.join(', ')
      };
    }
    return true;
  },

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * load() — main entry point called by DOMContentLoaded bootstrap.
   *
   * Flow:
   *   ConfigLoader._strategy(CONFIG_URL)
   *     → _validate(cfg)
   *     → State.runtimeConfig = cfg
   *     → window.ConfigRuntime = cfg    (global alias for easy access)
   *     → return cfg
   *
   * Throws {code:'CONFIG_LOAD_FAILED', detail} on any failure.
   * The caller (DOMContentLoaded) should catch and abort startup.
   *
   * @returns {Promise<object>} resolved config object
   */
  load: async function() {
    try {
      const cfg = await ConfigLoader._strategy(ConfigLoader.CONFIG_URL);
      ConfigLoader._validate(cfg);

      // Inject into State (primary) and window (secondary alias)
      if (typeof State !== 'undefined')  State.runtimeConfig  = cfg;
      if (typeof window !== 'undefined') window.ConfigRuntime = cfg;

      console.log(
        '[SCT] ConfigLoader ✓ v' + cfg.version +
        ' | maintenance=' + !!cfg.maintenance +
        ' | forceRefresh=' + !!cfg.forceRefresh
      );
      return cfg;

    } catch (err) {
      const structured = {
        code   : (err && err.code)    ? err.code    : 'CONFIG_LOAD_FAILED',
        detail : (err && err.message) ? err.message : String(err)
      };
      console.error('[SCT] ConfigLoader FAILED:', structured);
      throw structured;
    }
  }

};

// Expose globally for access by bootstrap and health check
if (typeof window !== 'undefined') window.ConfigLoader = ConfigLoader;

// CommonJS export for test harness / Node.js compatibility
if (typeof module !== 'undefined') module.exports = ConfigLoader;
