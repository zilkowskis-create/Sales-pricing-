(() => {
  'use strict';

  const IMAGE_OPTION_KEY = 'includeProductImages';

  function ensureImageOption() {
    if (typeof state === 'undefined') return;
    if (!(IMAGE_OPTION_KEY in state.exportOptions)) state.exportOptions[IMAGE_OPTION_KEY] = false;
    const grid = document.getElementById('exportOptionsGrid');
    if (!grid || grid.querySelector('[data-export-option="includeProductImages"]')) return;
    const label = document.createElement('label');
    label.className = 'export-option';
    label.innerHTML = `
      <input type="checkbox" data-export-option="includeProductImages" ${state.exportOptions.includeProductImages ? 'checked' : ''} />
      <span>Include product images</span>`;
    grid.appendChild(label);
  }

  function installOptionObserver() {
    const grid = document.getElementById('exportOptionsGrid');
    if (!grid) return;
    ensureImageOption();
    new MutationObserver(() => ensureImageOption()).observe(grid, { childList: true });
  }

  function colName(index) {
    let n = index + 1, result = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      result = String.fromCharCode(65 + rem) + result;
      n = Math.floor((n - 1) / 26);
    }
    return result;
  }

  function exportFields(currency) {
    const defs = [
      { key: 'position', header: 'Pos.', width: 7 },
      { key: 'article', header: 'Part No.', width: 22 },
      { key: 'model', header: 'Model', width: 32 },
      { key: 'color', header: 'Colour / RAL', width: 18 },
      { key: 'family', header: 'Family / Group', width: 24 },
      { key: 'qty', header: 'Qty', width: 10 },
      { key: 'listPrice', header: `List Price ${currency}`, width: 18, numFmt: '#,##0.00' },
      { key: 'priceListDiscount', header: 'Discount', width: 14, numFmt: '0.00%' },
      { key: 'netPrice', header: `Net Price ${currency}`, width: 18, numFmt: '#,##0.00' },
      { key: 'extraDiscount', header: 'Second Discount', width: 18, numFmt: '0.00%' },
      { key: 'finalUnitPrice', header: `Quote/Unit ${currency}`, width: 20, numFmt: '#,##0.00' },
      { key: 'total', header: `Total ${currency}`, width: 18, numFmt: '#,##0.00' },
      { key: 'source', header: 'Price List / Source', width: 24 }
    ];
    return defs.filter(f => state.exportOptions[f.key]);
  }

  function imageExtension(dataUrl) {
    const match = String(dataUrl || '').match(/^data:image\/(png|jpeg|jpg);base64,/i);
    if (!match) return '';
    return match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase();
  }

  function safeName(value) {
    return String(value || '').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60);
  }

  async function exportWithImages() {
    if (!state.offer.length) {
      alert('Please select at least one item first.');
      return;
    }
    if (typeof ExcelJS === 'undefined') {
      alert('The image export module could not be loaded. Please reload the page and try again.');
      return;
    }

    const customer = document.getElementById('customerName').value.trim();
    const offerNo = document.getElementById('offerNumber').value.trim();
    const currency = document.getElementById('currency').value;
    const offerDate = document.getElementById('offerDate').value || '';
    const fields = exportFields(currency);
    if (!fields.length) {
      alert('Please enable at least one Excel column.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sales Pricing';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('Quotation', { views: [{ state: 'frozen', ySplit: 8 }] });

    const imageOffset = 1;
    const dataStartCol = imageOffset + 1;
    const lastCol = dataStartCol + fields.length - 1;
    ws.mergeCells(1, 1, 1, lastCol);
    const title = ws.getCell(1, 1);
    title.value = 'QUOTATION';
    title.font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
    title.alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 28;

    ws.getCell(3, 1).value = 'Customer';
    ws.getCell(3, 2).value = customer;
    ws.getCell(3, Math.max(3, lastCol - 1)).value = 'Quotation No.';
    ws.getCell(3, Math.max(4, lastCol)).value = offerNo;
    ws.getCell(4, 1).value = 'Date';
    ws.getCell(4, 2).value = offerDate;
    ws.getCell(4, Math.max(3, lastCol - 1)).value = 'Currency';
    ws.getCell(4, Math.max(4, lastCol)).value = currency;

    const headerRow = 8;
    const firstDataRow = 9;
    ws.getCell(headerRow, 1).value = 'Image';
    fields.forEach((field, i) => ws.getCell(headerRow, dataStartCol + i).value = field.header);
    for (let c = 1; c <= lastCol; c++) {
      const cell = ws.getCell(headerRow, c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
        right: { style: 'thin', color: { argb: 'FFD9E2F3' } }
      };
    }

    ws.getColumn(1).width = 14;
    fields.forEach((field, i) => ws.getColumn(dataStartCol + i).width = field.width || 18);

    const keyToCol = Object.fromEntries(fields.map((f, i) => [f.key, dataStartCol + i]));

    state.offer.forEach((item, idx) => {
      const rowNo = firstDataRow + idx;
      const row = ws.getRow(rowNo);
      row.height = 62;

      const finalUnit = Number(item.netPrice || 0) * (1 - Number(item.extraDiscount || 0) / 100);
      fields.forEach((field, i) => {
        const cell = ws.getCell(rowNo, dataStartCol + i);
        switch (field.key) {
          case 'position': cell.value = idx + 1; break;
          case 'article': cell.value = item.article || ''; break;
          case 'model': cell.value = item.model || ''; break;
          case 'color': cell.value = item.color || ''; break;
          case 'family': cell.value = item.family || ''; break;
          case 'qty': cell.value = Number(item.qty || 1); break;
          case 'listPrice': cell.value = Number(item.listPrice || 0); break;
          case 'priceListDiscount': cell.value = Number(item.priceListDiscount || 0) / 100; break;
          case 'netPrice': cell.value = Number(item.netPrice || 0); break;
          case 'extraDiscount': cell.value = Number(item.extraDiscount || 0) / 100; break;
          case 'finalUnitPrice': cell.value = finalUnit; break;
          case 'total': cell.value = finalUnit * Number(item.qty || 1); break;
          case 'source': cell.value = (item.sourceFile || item.source || '').replace(/\.(xlsx|xls|csv)$/i, ''); break;
        }
        if (field.numFmt) cell.numFmt = field.numFmt;
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD9E2F3' } },
          bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } },
          left: { style: 'thin', color: { argb: 'FFD9E2F3' } },
          right: { style: 'thin', color: { argb: 'FFD9E2F3' } }
        };
      });

      try {
        const src = typeof getItemImage === 'function' ? getItemImage(item) : '';
        const ext = imageExtension(src);
        if (src && ext) {
          const imageId = workbook.addImage({ base64: src, extension: ext });
          ws.addImage(imageId, {
            tl: { col: 0.08, row: rowNo - 1 + 0.08 },
            ext: { width: 72, height: 72 },
            editAs: 'oneCell'
          });
        }
      } catch (err) {
        console.warn('Product image skipped in Excel export.', err);
      }
    });

    const totalCol = keyToCol.total;
    const totalRowNo = firstDataRow + state.offer.length + 1;
    if (totalCol) {
      const labelCell = ws.getCell(totalRowNo, Math.max(1, totalCol - 1));
      const valueCell = ws.getCell(totalRowNo, totalCol);
      labelCell.value = 'GRAND TOTAL';
      valueCell.value = { formula: `SUM(${colName(totalCol - 1)}${firstDataRow}:${colName(totalCol - 1)}${firstDataRow + state.offer.length - 1})` };
      valueCell.numFmt = '#,##0.00';
      [labelCell, valueCell].forEach(cell => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAF7' } };
      });
    }

    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow, column: lastCol } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Quotation${customer ? '_' + safeName(customer) : ''}${offerNo ? '_' + safeName(offerNo) : ''}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  function installImageExport() {
    const exportBtn = document.getElementById('exportBtn');
    if (!exportBtn) return;
    exportBtn.addEventListener('click', async (event) => {
      ensureImageOption();
      if (!state.exportOptions.includeProductImages) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      exportBtn.disabled = true;
      const oldText = exportBtn.textContent;
      exportBtn.textContent = 'Creating Excel with images…';
      try { await exportWithImages(); }
      catch (err) {
        console.error(err);
        alert('The Excel quotation with images could not be created.');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = oldText;
      }
    }, true);
  }

  function init() {
    installOptionObserver();
    installImageExport();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
