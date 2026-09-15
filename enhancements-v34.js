(() => {
  'use strict';

  function normalizeEnglishLabels(workbook) {
    if (!workbook || !workbook.SheetNames || !workbook.Sheets) return;
    for (const sheetName of workbook.SheetNames) {
      const ws = workbook.Sheets[sheetName];
      if (!ws) continue;
      for (const key of Object.keys(ws)) {
        if (key.startsWith('!')) continue;
        const cell = ws[key];
        if (!cell || typeof cell.v !== 'string') continue;
        const value = cell.v.trim();
        let translated = cell.v;
        if (/^(ANGEBOT|Angebot)$/i.test(value)) translated = 'QUOTATION';
        else if (/^(GESAMTSUMME|Gesamtsumme)$/i.test(value)) translated = 'GRAND TOTAL';
        else if (/^Datum$/i.test(value)) translated = 'Date';
        else if (/^Gesamt(?:\s|$)/i.test(value)) translated = value.replace(/^Gesamt/i, 'Total');
        if (translated !== cell.v) {
          cell.v = translated;
          if ('w' in cell) cell.w = translated;
        }
      }
    }
  }

  function install() {
    if (!window.XLSX || typeof window.XLSX.writeFile !== 'function' || window.XLSX.writeFile.__stableNoImages) return;
    const original = window.XLSX.writeFile;
    const wrapped = function(workbook, filename, options) {
      try { normalizeEnglishLabels(workbook); }
      catch (err) { console.warn('Could not normalize quotation labels.', err); }
      return original.call(this, workbook, filename, options);
    };
    wrapped.__stableNoImages = true;
    window.XLSX.writeFile = wrapped;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
