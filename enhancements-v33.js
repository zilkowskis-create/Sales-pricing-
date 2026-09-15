(() => {
  'use strict';

  const NAVY = '17365D';
  const BLUE = '2F66B0';
  const LIGHT = 'F4F7FB';
  const LIGHT_ALT = 'EEF4FA';
  const BORDER = 'D9E2EC';
  const TEXT = '172B4D';
  const MUTED = '5E6C84';

  function mergeStyle(existing, extra) {
    return {
      ...(existing || {}),
      ...extra,
      font: { ...((existing || {}).font || {}), ...(extra.font || {}) },
      fill: extra.fill || (existing || {}).fill,
      alignment: { ...((existing || {}).alignment || {}), ...(extra.alignment || {}) },
      border: { ...((existing || {}).border || {}), ...(extra.border || {}) }
    };
  }

  function thinBottom() {
    return { bottom: { style: 'thin', color: { rgb: BORDER } } };
  }

  function styleQuotationWorkbook(workbook) {
    if (!workbook || !workbook.SheetNames || !workbook.Sheets) return;
    const sheetName = workbook.SheetNames.find(n => /quotation/i.test(n)) || workbook.SheetNames[0];
    const ws = workbook.Sheets[sheetName];
    if (!ws || !ws['!ref']) return;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const maxCol = range.e.c;
    const maxRow = range.e.r;

    // Modern title bar
    for (let c = 0; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = mergeStyle(ws[addr].s, {
        font: { name: 'Aptos Display', bold: true, sz: c === 0 ? 20 : 12, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { vertical: 'center', horizontal: 'left' }
      });
    }

    // Find the table header row.
    let headerRow = -1;
    for (let r = 0; r <= Math.min(maxRow, 14); r++) {
      const values = [];
      for (let c = 0; c <= maxCol; c++) values.push(String(ws[XLSX.utils.encode_cell({ r, c })]?.v ?? ''));
      if (values.some(v => /part no\.?/i.test(v)) && values.some(v => /model/i.test(v))) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) return;

    // Customer / quote information: clean card-like area.
    for (let r = 2; r < headerRow - 1; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const value = String(cell.v ?? '').trim();
        const isLabel = /^(Customer|Date|Quotation No\.|Currency)$/i.test(value);
        cell.s = mergeStyle(cell.s, {
          font: { name: 'Aptos', sz: 10.5, bold: isLabel, color: { rgb: isLabel ? MUTED : TEXT } },
          alignment: { vertical: 'center', horizontal: isLabel ? 'left' : 'left' },
          border: isLabel || value ? thinBottom() : undefined
        });
      }
    }

    // Modern table header.
    for (let c = 0; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = mergeStyle(cell.s, {
        font: { name: 'Aptos', bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: BLUE } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: {
          bottom: { style: 'medium', color: { rgb: NAVY } },
          left: { style: 'thin', color: { rgb: '5E83B8' } },
          right: { style: 'thin', color: { rgb: '5E83B8' } }
        }
      });
    }

    // Find grand total row.
    let totalRow = -1;
    for (let r = headerRow + 1; r <= maxRow; r++) {
      for (let c = 0; c <= maxCol; c++) {
        const v = String(ws[XLSX.utils.encode_cell({ r, c })]?.v ?? '').toUpperCase();
        if (v === 'GRAND TOTAL' || v === 'GESAMTSUMME') totalRow = r;
      }
    }

    // Body: airy, border-light, alternating rows.
    const bodyEnd = totalRow >= 0 ? totalRow - 2 : maxRow;
    for (let r = headerRow + 1; r <= bodyEnd; r++) {
      const alt = (r - headerRow) % 2 === 0;
      for (let c = 0; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;
        const priorFill = cell.s?.fill;
        cell.s = mergeStyle(cell.s, {
          font: { name: 'Aptos', sz: 10.5, color: { rgb: TEXT } },
          fill: priorFill || { fgColor: { rgb: alt ? LIGHT_ALT : 'FFFFFF' } },
          alignment: { vertical: 'center', wrapText: false },
          border: thinBottom()
        });
      }
    }

    // Grand total as a strong summary block.
    if (totalRow >= 0) {
      for (let c = 0; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r: totalRow, c });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = mergeStyle(cell.s, {
          font: { name: 'Aptos', bold: true, sz: 11.5, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: NAVY } },
          alignment: { vertical: 'center' },
          border: { top: { style: 'medium', color: { rgb: NAVY } } }
        });
      }
    }

    // Better row heights.
    ws['!rows'] = ws['!rows'] || [];
    ws['!rows'][0] = { hpt: 30 };
    for (let r = 2; r < headerRow - 1; r++) ws['!rows'][r] = { hpt: 20 };
    ws['!rows'][headerRow] = { hpt: 26 };
    for (let r = headerRow + 1; r <= bodyEnd; r++) ws['!rows'][r] = { hpt: 23 };
    if (totalRow >= 0) ws['!rows'][totalRow] = { hpt: 25 };

    // More balanced column widths based on header meaning.
    ws['!cols'] = ws['!cols'] || [];
    for (let c = 0; c <= maxCol; c++) {
      const header = String(ws[XLSX.utils.encode_cell({ r: headerRow, c })]?.v ?? '').toLowerCase();
      let width = ws['!cols'][c]?.wch || 14;
      if (/pos/.test(header)) width = 7;
      else if (/part no/.test(header)) width = 20;
      else if (/model/.test(header)) width = 30;
      else if (/colour|ral/.test(header)) width = 15;
      else if (/qty/.test(header)) width = 8;
      else if (/discount/.test(header)) width = 15;
      else if (/price|quote|total/.test(header)) width = 17;
      else if (/source|family/.test(header)) width = 22;
      ws['!cols'][c] = { ...(ws['!cols'][c] || {}), wch: width };
    }

    ws['!margins'] = { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 };
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow + 1 };

    // Improve workbook metadata.
    workbook.Props = {
      ...(workbook.Props || {}),
      Author: 'Sales Pricing',
      Company: 'Sales Pricing',
      Comments: 'Generated with Sales Pricing Quotation & Pricing Tool'
    };
  }

  function install() {
    if (!window.XLSX || typeof window.XLSX.writeFile !== 'function' || window.XLSX.writeFile.__v33ModernQuote) return;
    const original = window.XLSX.writeFile;
    const wrapped = function(workbook, filename, options) {
      try { styleQuotationWorkbook(workbook); }
      catch (err) { console.warn('Modern Excel styling could not be applied.', err); }
      return original.call(this, workbook, filename, options);
    };
    wrapped.__v33ModernQuote = true;
    window.XLSX.writeFile = wrapped;
  }

  function init() {
    install();
    setTimeout(install, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
