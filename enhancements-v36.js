(() => {
  'use strict';

  const RED = 'ED174C';
  const BLACK = '222222';
  const CREAM = 'FCFAF2';
  const BORDER = 'C9C9C9';
  const WHITE = 'FFFFFF';

  function safeFile(value) {
    return String(value || '').replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80);
  }

  function currencyFormat(currency) {
    const formats = {
      EUR: '€ #,##0.00',
      USD: '$ #,##0.00',
      GBP: '£ #,##0.00',
      CHF: 'CHF #,##0.00',
      SEK: 'SEK #,##0.00'
    };
    return formats[currency] || currency + ' #,##0.00';
  }

  function dateText(value) {
    const d = value ? new Date(value + 'T12:00:00') : new Date();
    return d.toLocaleDateString('en-GB');
  }

  function thinBorder() {
    return {
      top: { style: 'thin', color: { rgb: BORDER } },
      bottom: { style: 'thin', color: { rgb: BORDER } },
      left: { style: 'thin', color: { rgb: BORDER } },
      right: { style: 'thin', color: { rgb: BORDER } }
    };
  }

  function setCell(ws, addr, value, style, format) {
    if (value && typeof value === 'object' && value.f) ws[addr] = { t: 'n', f: value.f };
    else if (typeof value === 'number') ws[addr] = { t: 'n', v: value };
    else ws[addr] = { t: 's', v: value == null ? '' : String(value) };
    if (style) ws[addr].s = style;
    if (format) ws[addr].z = format;
  }

  function createQuotationWorkbook() {
    if (typeof state === 'undefined' || !state.offer?.length) {
      alert('Please select at least one item first.');
      return null;
    }

    const customer = document.getElementById('customerName')?.value.trim() || '';
    const quotationNo = document.getElementById('offerNumber')?.value.trim() || '';
    const quotationDate = document.getElementById('offerDate')?.value || '';
    const currency = document.getElementById('currency')?.value || 'EUR';
    const moneyFormat = currencyFormat(currency);

    const firstDataRow = 10;
    const minimumLines = 8;
    const lineCount = Math.max(minimumLines, state.offer.length);
    const lastDataRow = firstDataRow + lineCount - 1;
    const subtotalRow = lastDataRow + 2;
    const totalRow = subtotalRow + 1;

    const ws = {};
    ws['!ref'] = `A1:F${totalRow + 3}`;
    ws['!merges'] = [
      XLSX.utils.decode_range('A1:F1'),
      XLSX.utils.decode_range('A2:F2'),
      XLSX.utils.decode_range('A4:C4'),
      XLSX.utils.decode_range('A5:B5'),
      XLSX.utils.decode_range('A6:B6'),
      XLSX.utils.decode_range('D5:E5'),
      XLSX.utils.decode_range('D6:E6'),
      XLSX.utils.decode_range(`D${totalRow}:E${totalRow}`)
    ];
    ws['!cols'] = [
      { wch: 54 },
      { wch: 8 },
      { wch: 17 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 }
    ];
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 30 };
    ws['!rows'][1] = { hpt: 23 };
    ws['!rows'][3] = { hpt: 26 };
    ws['!rows'][4] = { hpt: 23 };
    ws['!rows'][5] = { hpt: 23 };
    ws['!rows'][8] = { hpt: 27 };
    for (let r = firstDataRow - 1; r <= lastDataRow - 1; r++) ws['!rows'][r] = { hpt: 24 };
    ws['!rows'][totalRow - 1] = { hpt: 27 };
    ws['!margins'] = { left: 0.35, right: 0.35, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
    ws['!freeze'] = { xSplit: 0, ySplit: 9 };

    const redBar = {
      font: { name: 'Arial', bold: true, sz: 22, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: RED } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const blackBar = {
      font: { name: 'Arial', italic: true, sz: 11, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const quotationTitle = {
      font: { name: 'Arial', bold: true, sz: 18, color: { rgb: RED } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const labelStyle = {
      font: { name: 'Arial', bold: true, sz: 11, color: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const metaStyle = {
      font: { name: 'Arial', sz: 11, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: CREAM } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const metaRightLabel = {
      font: { name: 'Arial', bold: true, sz: 11, color: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'right' }
    };
    const tableHeader = {
      font: { name: 'Arial', bold: true, sz: 11, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLACK } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
    };
    const tableHeaderLeft = {
      ...tableHeader,
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true }
    };
    const itemStyle = {
      font: { name: 'Arial', bold: true, sz: 10.5, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: CREAM } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const bodyStyle = {
      font: { name: 'Arial', sz: 10.5, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: CREAM } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'center' }
    };
    const bodyMoneyStyle = {
      ...bodyStyle,
      alignment: { vertical: 'center', horizontal: 'right' }
    };
    const totalStyle = {
      font: { name: 'Arial', bold: true, sz: 11.5, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: RED } },
      alignment: { vertical: 'center', horizontal: 'right' }
    };

    for (let c = 0; c < 6; c++) {
      setCell(ws, XLSX.utils.encode_cell({ r: 0, c }), c === 0 ? 'SNAP-ON EQUIPMENT' : '', redBar);
      setCell(ws, XLSX.utils.encode_cell({ r: 1, c }), c === 0 ? 'AUTHORIZED DEALER / PARTNER' : '', blackBar);
    }

    setCell(ws, 'A4', 'COMMERCIAL QUOTATION', quotationTitle);
    setCell(ws, 'A5', customer ? `Customer: ${customer}` : 'Customer:', labelStyle);
    setCell(ws, 'A6', quotationNo ? `Quotation No.: ${quotationNo}` : 'Quotation No.:', labelStyle);
    setCell(ws, 'D5', 'Date:', metaRightLabel);
    setCell(ws, 'F5', dateText(quotationDate), metaStyle);
    setCell(ws, 'D6', 'Currency:', metaRightLabel);
    setCell(ws, 'F6', currency, metaStyle);

    const headers = ['Item / Model & Description', 'Qty', 'Unit Price', 'Discount 1', 'Discount 2', 'Total Net'];
    headers.forEach((h, i) => setCell(ws, XLSX.utils.encode_cell({ r: 8, c: i }), h, i === 0 ? tableHeaderLeft : tableHeader));

    for (let line = 0; line < lineCount; line++) {
      const row = firstDataRow + line;
      const item = state.offer[line];
      const a = `A${row}`, b = `B${row}`, c = `C${row}`, d = `D${row}`, e = `E${row}`, f = `F${row}`;
      if (item) {
        const desc = [item.article, item.model].filter(Boolean).join('  ');
        setCell(ws, a, desc, itemStyle);
        setCell(ws, b, Number(item.qty || 1), bodyStyle, '0');
        setCell(ws, c, Number(item.listPrice || 0), bodyMoneyStyle, moneyFormat);
        setCell(ws, d, Number(item.priceListDiscount || 0) / 100, bodyStyle, '0.0%');
        setCell(ws, e, Number(item.extraDiscount || 0) / 100, bodyStyle, '0.0%');
        setCell(ws, f, { f: `B${row}*C${row}*(1-D${row})*(1-E${row})` }, bodyMoneyStyle, moneyFormat);
      } else {
        setCell(ws, a, '', itemStyle);
        setCell(ws, b, '', bodyStyle);
        setCell(ws, c, '', bodyMoneyStyle);
        setCell(ws, d, '', bodyStyle);
        setCell(ws, e, '', bodyStyle);
        setCell(ws, f, '', bodyMoneyStyle);
      }
    }

    setCell(ws, `E${subtotalRow}`, 'Subtotal:', { font: { name: 'Arial', bold: true, sz: 10.5 }, alignment: { horizontal: 'right' } });
    setCell(ws, `F${subtotalRow}`, { f: `SUM(F${firstDataRow}:F${firstDataRow + state.offer.length - 1})` }, { font: { name: 'Arial', sz: 10.5 }, alignment: { horizontal: 'right' } }, moneyFormat);

    setCell(ws, `D${totalRow}`, 'TOTAL:', totalStyle);
    setCell(ws, `F${totalRow}`, { f: `F${subtotalRow}` }, totalStyle, moneyFormat);
    setCell(ws, `E${totalRow}`, '', totalStyle);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    wb.Props = {
      Title: quotationNo ? `Quotation ${quotationNo}` : 'Commercial Quotation',
      Subject: customer ? `Commercial quotation for ${customer}` : 'Commercial quotation',
      Author: 'Snap-on Equipment',
      Company: 'Snap-on Equipment',
      CreatedDate: new Date()
    };

    return { wb, customer, quotationNo };
  }

  function exportSnapOnQuotation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const result = createQuotationWorkbook();
    if (!result) return;

    const customerPart = result.customer ? '_' + safeFile(result.customer) : '';
    const quotationPart = result.quotationNo ? '_' + safeFile(result.quotationNo) : '';
    XLSX.writeFile(result.wb, `Quotation${customerPart}${quotationPart}.xlsx`);
  }

  function install() {
    const btn = document.getElementById('exportBtn');
    if (!btn || btn.dataset.v36QuotationDesign === '1') return;
    btn.dataset.v36QuotationDesign = '1';
    btn.addEventListener('click', exportSnapOnQuotation, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
