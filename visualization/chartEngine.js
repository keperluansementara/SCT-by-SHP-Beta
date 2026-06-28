// ==========================================
// VISUALIZATION LAYER — chartEngine.js
// ==========================================
// Extracted from SCT-by-SHP.html : lines 3031–3039
//
// ChartEngine — Chart.js instance manager.
// Single responsibility: create + destroy Chart.js instances
// by canvas ID, prevent duplicate registrations.
//
// Dependencies (globals resolved at runtime):
//   Chart  — Chart.js 4.4.1 (loaded via <script> in HTML)
//
// Callers:
//   ui/dashboardView.js → RenderEngine.charts()
//   ui/dashboardView.js → RenderEngine.categoryAnalysis()
//   ui/dashboardView.js → RenderEngine.renderWholesalerClassPerformance()
//   ui/dashboardView.js → RenderEngine.bb4ClassAnalysis()
//   export/exportEngine.js → ExportEngine._awaitAllCharts()
//
// Chart appearance (data, datasets, options, colors, animations)
// is entirely controlled by the caller — ChartEngine itself
// is a pure create/destroy wrapper with zero visual opinion.
// ==========================================

const ChartEngine = {
  instances: {},
  create: (id, type, data, options) => {
    if (ChartEngine.instances[id]) ChartEngine.instances[id].destroy();
    const ctx = document.getElementById(id);
    if (!ctx) return;
    ChartEngine.instances[id] = new Chart(ctx, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
  }
};
