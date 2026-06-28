// ==========================================
// AI LAYER — narrativeRouter.js
// ==========================================
// Source: index.html lines 10496–11090
// Extracted: AI Cluster Extraction
//
// Dependencies: State (external)
//
// Load order: see ai/ wiring note in index.html
// ==========================================

// ==========================================
const NarrativeRouter = {

  // ════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════

  /**
   * route(context) — main entry point
   *
   * @param {object} context
   *   kpi          {object}  — State.kpi snapshot
   *   severity     {string}  — pre-computed severity from compose()
   *   riskScore    {number}  — pre-computed 0-100 risk score
   *   achGap       {number}  — ach% - timeGone%  (positive = ahead)
   *   rrRatio      {number}  — reqRR / actRR     (>1 = under pressure)
   *   hkRem        {number}  — working days remaining
   *   critPrinN    {number}  — count of DANGER principles
   *   audience     {string}  — 'CEO'|'NSM'|'RSM'|'Distributor'  default: 'NSM'
   *
   * @returns {object}
   *   mode              — 'crisis'|'defensive'|'balanced'|'recovery'|'opportunity'|'operational'
   *   audience          — resolved audience key
   *   dominantSignal    — 'issue-led'|'execution-led'|'recovery-led'|'growth-led'|'balanced'
   *   toneProfile       — { style, compact, depth, prefixIntensity }
   *   urgencyLevel      — 0-15
   *   narrativeWeights  — { issue, growth, channel, performance, action } (each 0-1)
   *   sentenceStrategy  — { order: string[], maxSentences, suppressGrowth, suppressIssue }
   *   layoutStrategy    — { maxBullets, bulletFilter, stripEmphasis, showFooter, summaryLines }
   *   recoveryScore     — 0-95 (internal, exposed for debugging)
   *   contradictionFlag — boolean (mixed positive+negative signals)
   *   meta              — { routedAt, contextHash }
   */
  route: (context) => {
    const ctx = context || {};
    const k   = ctx.kpi;

    // ── 1. Compute supplementary scores ──────────────────────────────
    const recoveryScore = NarrativeRouter.resolveDominantSignal._calcRecoveryScore(k);
    const contFlag      = NarrativeRouter._detectContradiction(ctx, recoveryScore);

    // ── 2. Resolve narrative mode ─────────────────────────────────────
    const mode = NarrativeRouter.resolveNarrativeMode(ctx, recoveryScore);

    // ── 3. Resolve dominant signal ────────────────────────────────────
    const dominantSignal = NarrativeRouter.resolveDominantSignal(ctx, recoveryScore);

    // ── 4. Resolve audience tone ──────────────────────────────────────
    const audience      = ctx.audience || 'NSM';
    const toneProfile   = NarrativeRouter.resolveAudienceTone(audience, mode);

    // ── 5. Compute urgency level ──────────────────────────────────────
    const urgencyLevel  = NarrativeRouter._calcUrgencyLevel(ctx);

    // ── 6. Compute narrative weights ─────────────────────────────────
    const narrativeWeights = NarrativeRouter.resolveNarrativeWeights(mode, dominantSignal, ctx);

    // ── 7. Build sentence strategy ────────────────────────────────────
    const sentenceStrategy = NarrativeRouter.buildSentenceStrategy(mode, dominantSignal, contFlag, toneProfile);

    // ── 8. Build layout strategy ──────────────────────────────────────
    const layoutStrategy = NarrativeRouter._buildLayoutStrategy(mode, audience, urgencyLevel, ctx);

    // ── Step 7.5: consume historySignals ─────────────────────────────
    //  Amplify mode/urgency based on persistence evidence.
    const hs = ctx.historySignals;
    let finalMode     = mode;
    let finalUrgency  = urgencyLevel;

    if (hs && hs.available) {
      // Persistent decline → escalate mode one level
      if (hs.declineStreak >= 3 && mode === 'balanced') finalMode = 'defensive';
      if (hs.declineStreak >= 4 && mode === 'defensive') finalMode = 'crisis';
      // Sustained recovery → prevent mode from staying at defensive
      if (hs.sustainedRecovery && mode === 'defensive') finalMode = 'recovery';
      // Accelerating collapse → +2 urgency
      if (hs.patterns?.acceleratingCollapse) finalUrgency = Math.min(15, finalUrgency + 2);
      // False recovery → override mode back toward defensive
      if (hs.patterns?.falseRecovery && mode === 'recovery') finalMode = 'balanced';
      // Persistent weakness → +1 urgency
      if (hs.persistenceSeverity === 'persistent') finalUrgency = Math.min(15, finalUrgency + 1);
    }

    // ── Step 8: forecastSignals amplification ─────────────────────────
    const fc = hs?.forecast?.forecastSignals || (typeof State !== 'undefined' ? State.history?.forecastSignals : null);
    if (fc) {
      // High escalation probability → force minimum defensive mode
      if (fc.escalationProbability >= 0.75 && finalMode !== 'crisis')  finalMode = 'crisis';
      else if (fc.escalationProbability >= 0.55 && finalMode === 'balanced') finalMode = 'defensive';
      // Severity escalating → +2 urgency
      if (fc.severityEscalating)  finalUrgency = Math.min(15, finalUrgency + 2);
    }

    // Rebuild layout and sentence strategy if mode changed
    const finalLayout = finalMode !== mode
      ? NarrativeRouter._buildLayoutStrategy(finalMode, ctx.audience || 'NSM', finalUrgency, ctx)
      : layoutStrategy;
    const finalSentence = finalMode !== mode
      ? NarrativeRouter.buildSentenceStrategy(finalMode, dominantSignal, contFlag, toneProfile)
      : sentenceStrategy;

    return {
      mode:             finalMode,
      originalMode:     mode,      // for debugging — what mode was before history amplification
      audience,
      dominantSignal,
      toneProfile,
      urgencyLevel:     finalUrgency,
      narrativeWeights,
      sentenceStrategy: finalSentence,
      layoutStrategy:   finalLayout,
      recoveryScore,
      contradictionFlag: contFlag,
      historyAmplified: finalMode !== mode || finalUrgency !== urgencyLevel,
      historySignals:   hs || null,
      meta: {
        routedAt:    new Date().toISOString(),
        contextHash: [ctx.severity, finalMode, dominantSignal].join('|'),
      }
    };
  },

  // ════════════════════════════════════════════════════════════════════
  // NARRATIVE MODE RESOLVER
  // ════════════════════════════════════════════════════════════════════

  /**
   * resolveNarrativeMode(ctx, recoveryScore) → mode string
   *
   * Priority cascade — first match wins:
   *   1. crisis:      riskScore>=70 AND (critPrinN>=2 OR hkRem<=5)
   *   2. defensive:   riskScore>=45 AND achGap<=-8
   *   3. recovery:    recoveryScore>=40 AND riskScore<70  (recovery signal present)
   *   4. opportunity: achGap>=10 AND riskScore<30
   *   5. balanced:    riskScore>=15 AND riskScore<45
   *   6. operational: default
   */
  resolveNarrativeMode: (ctx, recoveryScore) => {
    const rs   = ctx.riskScore   || 0;
    const ag   = ctx.achGap      || 0;
    const hkR  = ctx.hkRem       || 999;
    const cpN  = ctx.critPrinN   || 0;
    const rec  = recoveryScore   || 0;

    if (rs >= 70 && (cpN >= 2 || hkR <= 5))  return 'crisis';
    if (rs >= 45 && ag <= -8)                 return 'defensive';
    if (rec >= 40 && rs < 70)                 return 'recovery';
    if (ag >= 10 && rs < 30)                  return 'opportunity';
    if (rs >= 15 && rs < 45)                  return 'balanced';
    return 'operational';
  },

  // ════════════════════════════════════════════════════════════════════
  // DOMINANT SIGNAL RESOLVER
  // ════════════════════════════════════════════════════════════════════

  /**
   * resolveDominantSignal(ctx, recoveryScore) → signal string
   *
   * Picks exactly ONE dominant narrative signal.
   * Priority: issue > execution > recovery > growth
   * In contradictions (high risk + high recovery): issue wins if score>=65.
   */
  resolveDominantSignal: (ctx, recoveryScore) => {
    const k    = ctx.kpi;
    const rs   = ctx.riskScore || 0;
    const rr   = ctx.rrRatio   || 1;
    const ag   = ctx.achGap    || 0;
    const rec  = recoveryScore || 0;

    const topScore = k?.alerts?.topIssue?.severityScore ?? 0;
    const slots    = k?.execSlots || [];
    const growthSl = slots.find(s => s?.slot === 'GROWTH');
    const growthOk = growthSl?.severity === 'good' && ag >= -5;

    if (topScore >= 65)                        return 'issue-led';
    if (rr >= 1.4)                             return 'execution-led';
    if (rec >= 50 && topScore < 65)            return 'recovery-led';
    if (growthOk && rs < 30)                   return 'growth-led';
    return 'balanced';
  },

  // Static sub-function for recovery score (also exposed on resolveDominantSignal for clarity)
  _calcRecoveryScore: (k) => {
    if (!k || !k.perf) return 0;
    let score = 0;
    // Principles recovering: below pace but trending positive vs LM
    const recoveringPrins = (k.perf.byPrin || []).filter(pr =>
      pr.tgStatus?.status !== 'GOOD' &&
      pr.trend?.hasLM && pr.trend.vsLM > 0
    ).slice(0, 3);
    score += recoveringPrins.length * 20;

    // Overall positive vs LM
    if (k.perf.vsLM > 0) score += 15;

    // CA channel improving
    const bestCh = (k.ca?.byCh || []).find(ch => ch.delta > 5);
    if (bestCh) score += 10;

    // WS improving
    if ((k.ws?.allTrend?.vsLM || 0) > 0) score += 10;

    return Math.min(95, score);
  },

  // ════════════════════════════════════════════════════════════════════
  // AUDIENCE TONE RESOLVER
  // ════════════════════════════════════════════════════════════════════

  /**
   * resolveAudienceTone(audience, mode) → toneProfile object
   *
   * Each audience gets a different wording register and content depth.
   */
  resolveAudienceTone: (audience, mode) => {
    const profiles = {
      CEO: {
        style:           'strategic',
        compact:         true,
        depth:           'low',
        maxSentences:    1,
        financialFocus:  true,
        operationalDetail: false,
        prefixMap: {
          crisis:      'CRITICAL:',
          defensive:   'Alert:',
          balanced:    'Status:',
          recovery:    'Improving:',
          opportunity: 'On Track:',
          operational: 'Normal:',
        }
      },
      NSM: {
        style:           'tactical-strategic',
        compact:         false,
        depth:           'medium',
        maxSentences:    2,
        financialFocus:  true,
        operationalDetail: true,
        prefixMap: {
          crisis:      'ESKALASI —',
          defensive:   'Perhatian:',
          balanced:    'Update:',
          recovery:    'Recovery:',
          opportunity: 'Momentum:',
          operational: 'Briefing:',
        }
      },
      RSM: {
        style:           'operational',
        compact:         false,
        depth:           'high',
        maxSentences:    3,
        financialFocus:  false,
        operationalDetail: true,
        prefixMap: {
          crisis:      'ACTION REQUIRED:',
          defensive:   'Push harder:',
          balanced:    'Monitor:',
          recovery:    'Jaga momentum:',
          opportunity: 'Close strong:',
          operational: 'Standar:',
        }
      },
      Distributor: {
        style:           'program-focused',
        compact:         true,
        depth:           'medium',
        maxSentences:    2,
        financialFocus:  false,
        operationalDetail: true,
        prefixMap: {
          crisis:      'URGENT:',
          defensive:   'Warning:',
          balanced:    'Info:',
          recovery:    'Good signal:',
          opportunity: 'Bagus:',
          operational: 'Rutin:',
        }
      }
    };

    const profile = profiles[audience] || profiles.NSM;
    const prefix  = profile.prefixMap[mode] || '';

    return {
      ...profile,
      prefix,
      intensityModifier: NarrativeRouter._intensityFromMode(mode),
    };
  },

  _intensityFromMode: (mode) => {
    const map = { crisis: 1.0, defensive: 0.8, balanced: 0.5, recovery: 0.4, opportunity: 0.2, operational: 0.1 };
    return map[mode] ?? 0.5;
  },

  // ════════════════════════════════════════════════════════════════════
  // SENTENCE STRATEGY BUILDER
  // ════════════════════════════════════════════════════════════════════

  /**
   * buildSentenceStrategy(mode, dominantSignal, contradictionFlag, toneProfile)
   * Returns the ordered list of which exec slots to use and in what order.
   *
   * order[] = array of slot names in display order
   * suppressGrowth: if true, growth sentence is demoted to last bullet (not summary)
   * suppressIssue:  if true, issue is demoted to watchpoint bullet (not summary)
   */
  buildSentenceStrategy: (mode, dominantSignal, contradictionFlag, toneProfile) => {
    const maxS = toneProfile?.maxSentences || 2;

    const strategies = {
      crisis: {
        order:          ['ISSUE', 'PERFORMANCE'],
        maxSentences:   Math.min(maxS, 2),
        suppressGrowth: true,   // growth never in summary for crisis
        suppressIssue:  false,
        growthAsLastBullet: true,  // anti-alarmism: add growth as last bullet
      },
      defensive: {
        order:          ['PERFORMANCE', 'ISSUE'],
        maxSentences:   Math.min(maxS, 2),
        suppressGrowth: false,
        suppressIssue:  false,
        growthAsLastBullet: false,
      },
      balanced: {
        order:          ['PERFORMANCE', 'ISSUE'],
        maxSentences:   Math.min(maxS, 2),
        suppressGrowth: false,
        suppressIssue:  false,
        growthAsLastBullet: !contradictionFlag,
      },
      recovery: {
        order:          dominantSignal === 'recovery-led'
                          ? ['GROWTH', 'PERFORMANCE']
                          : ['PERFORMANCE', 'GROWTH'],
        maxSentences:   Math.min(maxS, 2),
        suppressGrowth: false,
        suppressIssue:  true,  // issue demoted to watchpoint bullet
        growthAsLastBullet: false,
      },
      opportunity: {
        order:          ['PERFORMANCE', 'GROWTH'],
        maxSentences:   Math.min(maxS, 1),
        suppressGrowth: false,
        suppressIssue:  true,
        growthAsLastBullet: false,
      },
      operational: {
        order:          ['PERFORMANCE', 'CHANNEL'],
        maxSentences:   Math.min(maxS, 2),
        suppressGrowth: false,
        suppressIssue:  false,
        growthAsLastBullet: false,
      },
    };

    return strategies[mode] || strategies.balanced;
  },

  // ════════════════════════════════════════════════════════════════════
  // NARRATIVE WEIGHTS RESOLVER
  // ════════════════════════════════════════════════════════════════════

  /**
   * resolveNarrativeWeights(mode, dominantSignal, ctx)
   * Returns relative weights 0-1 for each content slot.
   * Compose() uses these to decide which slots to include in bullets.
   */
  resolveNarrativeWeights: (mode, dominantSignal, ctx) => {
    // Base weights
    const base = {
      crisis:      { issue: 1.0, performance: 0.7, growth: 0.0, channel: 0.3, action: 0.9 },
      defensive:   { issue: 0.9, performance: 0.8, growth: 0.2, channel: 0.5, action: 0.8 },
      balanced:    { issue: 0.6, performance: 0.7, growth: 0.5, channel: 0.5, action: 0.6 },
      recovery:    { issue: 0.3, performance: 0.5, growth: 0.9, channel: 0.4, action: 0.5 },
      opportunity: { issue: 0.1, performance: 0.7, growth: 0.9, channel: 0.3, action: 0.4 },
      operational: { issue: 0.4, performance: 0.6, growth: 0.4, channel: 0.5, action: 0.5 },
    };

    const weights = { ...(base[mode] || base.balanced) };

    // Modulate by dominant signal
    if (dominantSignal === 'issue-led')     { weights.issue += 0.1; weights.growth = Math.max(0, weights.growth - 0.1); }
    if (dominantSignal === 'recovery-led')  { weights.growth += 0.1; weights.issue = Math.max(0, weights.issue - 0.1); }
    if (dominantSignal === 'execution-led') { weights.action += 0.1; }
    if (dominantSignal === 'growth-led')    { weights.growth = Math.min(1, weights.growth + 0.15); }

    // Clamp all to 0-1
    Object.keys(weights).forEach(k => {
      weights[k] = Math.max(0, Math.min(1, weights[k]));
    });

    return weights;
  },

  // ════════════════════════════════════════════════════════════════════
  // URGENCY LEVEL CALCULATOR
  // ════════════════════════════════════════════════════════════════════

  _calcUrgencyLevel: (ctx) => {
    const hkR = ctx.hkRem    || 999;
    const rs  = ctx.riskScore || 0;

    let base = hkR <= 3 ? 4 : hkR <= 5 ? 3 : hkR <= 8 ? 2 : 0;
    base += Math.floor(rs / 20);
    return Math.min(15, base);
  },

  /**
   * getUrgencyPrefix(urgencyLevel) → string prefix for footer
   * Called by compose() when building the footerLine.
   */
  getUrgencyPrefix: (urgencyLevel) => {
    if (urgencyLevel >= 12) return 'ESKALASI SEGERA — ';
    if (urgencyLevel >= 8)  return 'Prioritas hari ini — ';
    if (urgencyLevel >= 4)  return 'Perhatian — ';
    return '';
  },

  // ════════════════════════════════════════════════════════════════════
  // LAYOUT STRATEGY BUILDER
  // ════════════════════════════════════════════════════════════════════

  _buildLayoutStrategy: (mode, audience, urgencyLevel, ctx) => {
    const modeMap = {
      crisis:      { maxBullets: 3, bulletFilter: 'critical-only', stripEmphasis: 'first', showFooter: true,  summaryLines: 2 },
      defensive:   { maxBullets: 4, bulletFilter: 'critical-first', stripEmphasis: 'first', showFooter: true, summaryLines: 2 },
      balanced:    { maxBullets: 4, bulletFilter: 'mixed',           stripEmphasis: 'first', showFooter: true, summaryLines: 2 },
      recovery:    { maxBullets: 3, bulletFilter: 'growth-first',    stripEmphasis: 'all',   showFooter: true, summaryLines: 2 },
      opportunity: { maxBullets: 3, bulletFilter: 'growth-first',    stripEmphasis: 'none',  showFooter: false, summaryLines: 1 },
      operational: { maxBullets: 3, bulletFilter: 'mixed',           stripEmphasis: 'first', showFooter: true, summaryLines: 2 },
    };

    const layout = { ...(modeMap[mode] || modeMap.balanced) };

    // Audience compactness overrides
    if (audience === 'CEO') {
      layout.maxBullets  = Math.min(layout.maxBullets, 2);
      layout.summaryLines = 1;
    } else if (audience === 'Distributor') {
      layout.bulletFilter = 'ws-ps-first';
    }

    // Late-period urgency boosts bullet density
    if (urgencyLevel >= 10 && layout.maxBullets < 5) layout.maxBullets++;

    return layout;
  },

  // ════════════════════════════════════════════════════════════════════
  // CONTRADICTION DETECTOR
  // ════════════════════════════════════════════════════════════════════

  _detectContradiction: (ctx, recoveryScore) => {
    const rs  = ctx.riskScore || 0;
    const ag  = ctx.achGap    || 0;
    // Contradiction: system under pressure but recovery signals are strong
    return rs >= 40 && recoveryScore >= 35;
  },

  // ════════════════════════════════════════════════════════════════════
  // REPETITION SUPPRESSOR
  // ════════════════════════════════════════════════════════════════════

  /**
   * deduplicateBullets(bullets, mentionedInSummary)
   * Removes or demotes bullet items that were already prominently mentioned
   * in the summary paragraph. Prevents the same principle/domain appearing
   * in both summary AND bullet list.
   *
   * @param {object[]} bullets     — full bullet array from compose()
   * @param {string}   summary     — the composed summary text
   * @returns {object[]}           — filtered bullets array
   */
  deduplicateBullets: (bullets, summary) => {
    if (!bullets || !bullets.length || !summary) return bullets;
    const sumLow = summary.toLowerCase();

    return bullets.filter((bullet, i) => {
      if (i === 0) return true;  // never remove first bullet (most critical)
      const titleLow = (bullet.title || '').toLowerCase();
      // Extract potential principle/entity name (first word ≥ 4 chars)
      const entity = titleLow.split(/[\s—-]/)[0];
      if (!entity || entity.length < 4) return true;
      // Suppress bullet if entity already prominent in summary (>1 mention or in first 100 chars)
      const inSummary = sumLow.indexOf(entity) < 120 || (sumLow.match(new RegExp(entity, 'g')) || []).length > 1;
      return !inSummary;
    });
  },

  // ════════════════════════════════════════════════════════════════════
  // TEST ENGINE
  // ════════════════════════════════════════════════════════════════════

  /**
   * testNarrativeRouter()
   * Runs 7 scenarios through NarrativeRouter.route() and logs results.
   * No canvas — pure console output. Validates routing logic.
   */
  testNarrativeRouter: () => {
    const scenarios = [
      {
        label: 'Scenario 1 — National Crisis (riskScore=78, critPrin=3, hkRem=4)',
        ctx: { severity:'critical', riskScore:78, achGap:-18, rrRatio:2.1, hkRem:4, critPrinN:3,
               kpi: { perf:{ ach:54, vsLM:-3, byPrin:[
                 {principle:'GPPJ', tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:-5}, act:5e10},
                 {principle:'MBR',  tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:-2}, act:4e10},
                 {principle:'GBS',  tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:+3}, act:6e10},
               ]}, alerts:{topIssue:{severityScore:88}}, ca:{byCh:[{delta:-12}]}, ws:{allTrend:{vsLM:-1}},
               execSlots:[{slot:'GROWTH',severity:'neutral'}] } }
      },
      {
        label: 'Scenario 2 — Recovery Momentum (riskScore=38, recoveryScore=60)',
        ctx: { severity:'warning', riskScore:38, achGap:-4, rrRatio:1.2, hkRem:10, critPrinN:1,
               kpi: { perf:{ ach:66, vsLM:+6, byPrin:[
                 {principle:'GGBI', tgStatus:{status:'WARNING'}, trend:{hasLM:true,vsLM:+8}, act:5.5e10},
                 {principle:'GPPJ', tgStatus:{status:'WARNING'}, trend:{hasLM:true,vsLM:+4}, act:4e10},
               ]}, alerts:{topIssue:{severityScore:42}}, ca:{byCh:[{delta:+6}]}, ws:{allTrend:{vsLM:+3}},
               execSlots:[{slot:'GROWTH',severity:'good'}] } }
      },
      {
        label: 'Scenario 3 — Mixed Signals (riskScore=52, recoveryScore=40)',
        ctx: { severity:'warning', riskScore:52, achGap:-9, rrRatio:1.5, hkRem:8, critPrinN:2,
               kpi: { perf:{ ach:61, vsLM:+2, byPrin:[
                 {principle:'MBR',  tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:+5}, act:4e10},
                 {principle:'GPPJ', tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:-3}, act:5e10},
               ]}, alerts:{topIssue:{severityScore:64}}, ca:{byCh:[{delta:+7}]}, ws:{allTrend:{vsLM:+1}},
               execSlots:[{slot:'GROWTH',severity:'good'}] } }
      },
      {
        label: 'Scenario 4 — Operational Pressure (riskScore=28, rrRatio=1.5)',
        ctx: { severity:'warning', riskScore:28, achGap:-2, rrRatio:1.5, hkRem:12, critPrinN:0,
               kpi: { perf:{ ach:68, vsLM:-1, byPrin:[]}, alerts:{topIssue:{severityScore:30}},
               ca:{byCh:[]}, ws:{allTrend:{vsLM:0}}, execSlots:[] } }
      },
      {
        label: 'Scenario 5 — Opportunity Acceleration (riskScore=12, achGap=+14)',
        ctx: { severity:'opportunity', riskScore:12, achGap:14, rrRatio:0.8, hkRem:9, critPrinN:0,
               kpi: { perf:{ ach:84, vsLM:+9, byPrin:[
                 {principle:'GGBI', tgStatus:{status:'GOOD'}, trend:{hasLM:true,vsLM:+12}, act:6e10},
               ]}, alerts:{topIssue:null}, ca:{byCh:[{delta:+8}]}, ws:{allTrend:{vsLM:+5}},
               execSlots:[{slot:'GROWTH',severity:'good'}] } }
      },
      {
        label: 'Scenario 6 — End-of-Month Urgency (riskScore=55, hkRem=2)',
        ctx: { severity:'critical', riskScore:55, achGap:-12, rrRatio:1.8, hkRem:2, critPrinN:1,
               kpi: { perf:{ ach:60, vsLM:-2, byPrin:[
                 {principle:'GPPJ', tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:+1}, act:5e10},
               ]}, alerts:{topIssue:{severityScore:60}}, ca:{byCh:[{delta:-5}]}, ws:{allTrend:{vsLM:-2}},
               execSlots:[] } }
      },
      {
        label: 'Scenario 7 — Contradiction Stress (riskScore=62, recoveryScore=55)',
        ctx: { severity:'critical', riskScore:62, achGap:-11, rrRatio:1.7, hkRem:7, critPrinN:2,
               audience: 'CEO',
               kpi: { perf:{ ach:59, vsLM:+4, byPrin:[
                 {principle:'GBS',  tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:+10}, act:6e10},
                 {principle:'GPPJ', tgStatus:{status:'DANGER'}, trend:{hasLM:true,vsLM:-4}, act:5e10},
               ]}, alerts:{topIssue:{severityScore:68}}, ca:{byCh:[{delta:+6}]}, ws:{allTrend:{vsLM:+4}},
               execSlots:[{slot:'GROWTH',severity:'good'}] } }
      },
    ];

    console.group('[NarrativeRouter] testNarrativeRouter() — 7 scenarios');
    const results = [];

    scenarios.forEach((sc, i) => {
      const result = NarrativeRouter.route(sc.ctx);
      const rec    = NarrativeRouter._calcRecoveryScore(sc.ctx.kpi);
      results.push(result);

      console.group(`${i+1}. ${sc.label}`);
      console.log('  mode:            ', result.mode);
      console.log('  dominantSignal:  ', result.dominantSignal);
      console.log('  urgencyLevel:    ', result.urgencyLevel);
      console.log('  contradictionFlag:', result.contradictionFlag);
      console.log('  recoveryScore:   ', rec);
      console.log('  sentenceStrategy:', JSON.stringify(result.sentenceStrategy.order));
      console.log('  maxBullets:      ', result.layoutStrategy.maxBullets);
      console.log('  bulletFilter:    ', result.layoutStrategy.bulletFilter);
      console.log('  tonePrefix:      ', result.toneProfile.prefix);
      console.log('  urgencyPrefix:   ', NarrativeRouter.getUrgencyPrefix(result.urgencyLevel));
      console.groupEnd();
    });

    console.log('[NarrativeRouter] All 7 scenarios routed successfully');
    console.groupEnd();
    return results;
  },

};
