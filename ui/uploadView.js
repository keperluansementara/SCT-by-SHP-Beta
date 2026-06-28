// ==========================================
// UI LAYER — uploadView.js
// ==========================================
// Extracted from SCT-by-SHP.html
//   Upload event binding : App.bindGlobalEvents lines 6617–6649
//   View switch helper   : App.initDashboardData lines 6774–6782
//
// Dependencies (globals resolved at runtime):
//   DOM, Parser, DemoData, ExportEngine
//
// UploadView.bind()          — call once at App.init() to wire upload events
// UploadView.showDashboard() — call from App.initDashboardData() to switch views
//
// NO business logic — event wiring and view transition only.
// ==========================================

const UploadView = {
  /**
   * bind() — wire all upload-screen event handlers.
   * Mirrors the upload-specific portion of App.bindGlobalEvents().
   * Must be called AFTER DOM is ready (DOMContentLoaded).
   *
   * NOTE: btn-reupload is created dynamically by FilterEngine.renderDropdowns()
   * and bound via the delegated click handler in App.bindGlobalEvents — it is
   * NOT bound here because it does not exist in the DOM at init time.
   */
  bind: () => {
    // File Handlers — null-guarded
    const dz  = DOM.el('drop-zone');
    const fIn = DOM.el('file-input');
    if (dz && fIn) {
      dz.addEventListener('click',    ()  => fIn.click());
      dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
      dz.addEventListener('dragleave',()  => dz.classList.remove('drag'));
      dz.addEventListener('drop',     (e) => { e.preventDefault(); dz.classList.remove('drag'); Parser.handleFile(e.dataTransfer.files[0]); });
      fIn.addEventListener('change',  (e) => Parser.handleFile(e.target.files[0]));
    }

    // Demo Data Loader
    const btnDemo = DOM.el('btn-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => {
        DOM.setStyle('loader-wrapper', 'display', 'block');
        Parser.updateProgress(60, 'Loading Enterprise Mock Data...');
        setTimeout(DemoData.load, 600);
      });
    }
  },

  /**
   * showDashboard() — transition from upload view to dashboard view.
   * Mirrors the setTimeout block inside App.initDashboardData().
   * Called after FilterEngine.buildOptions() + renderDropdowns() + runCalculations().
   */
  showDashboard: () => {
    DOM.setStyle('view-upload', 'display', 'none');
    DOM.setStyle('view-dashboard', 'display', 'block');
    // Phase 1 v5: Show export toolbar when dashboard is visible
    const tb = document.getElementById('export-toolbar');
    if (tb) tb.classList.add('visible');
    // Update watermark with loaded filter state
    if (typeof ExportEngine !== 'undefined') ExportEngine._updateWatermark();
  }
};
