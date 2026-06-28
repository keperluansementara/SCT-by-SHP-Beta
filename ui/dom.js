// ==========================================
// UI LAYER — dom.js
// ==========================================
// Extracted from: ui/filterPanel.js (was lines 17–26)
// Original HTML source: SCT-by-SHP.html lines 2503–2509
//
// Dependencies: NONE
//
// Load order: before any module that calls DOM.*
//   utils/ → core/ → ui/dom.js → data/ → business/ → ui/filterPanel.js → ...
// ==========================================

const DOM = {
  el: id => document.getElementById(id),
  setTxt: (id, text) => { const e = DOM.el(id); if (e) e.textContent = text; },
  setHtml: (id, html) => { const e = DOM.el(id); if (e) e.innerHTML = html; },
  setClass: (id, cls) => { const e = DOM.el(id); if (e) e.className = cls; },
  setStyle: (id, prop, val) => { const e = DOM.el(id); if (e) e.style[prop] = val; }
};
