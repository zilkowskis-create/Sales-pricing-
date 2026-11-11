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

  function fieldDefinitions(currency) {
    return [
      { key: 'position', header: 'Pos.', width: 7, align: 'center' },
      { key: 'article', header: 'Part No.', width: 22, align: 'left' },
      { key: 'model', header: 'Model', width: 30, align: 'left' },
      { key: 'color', header: 'Colour / RAL', width: 17, align: 'left' },
      { key: 'family', header: 'Family / Group', width: 23, align: 'left' },
      { key: 'qty', header: 'Qty', width: 9, align: 'center', format: '0' },
      { key: 'listPrice', header: 'List Price ' + currency, width: 17, align: 'right', money: true },
      { key: 'priceListDiscount', header: 'Discount', width: 13, align: 'center', percent: true },
      { key: 'netPrice', header: 'Net Price ' + currency, width: 17, align: 'right', money: true },
      { key: 'extraDiscount', header: 'Second Discount', width: 17, align: 'center', percent: true },
      { key: 'finalUnitPrice', header: 'Quote/Unit ' + currency, width: 18, align: 'right', money: true },
      { key: 'total', header: 'Total ' + currency, width: 18, align: 'right', money: true },
      { key: 'source', header: 'Price List / Source', width: 23, align: 'left' }
    ];
  }

  function selectedFields(currency) {
    const defs = fieldDefinitions(currency);
    const selected = defs.filter(def => state.exportOptions?.[def.key]);
    return selected.length ? selected : defs.filter(def => ['article', 'model', 'qty', 'total'].includes(def.key));
  }

  function valueForField(item, field, index) {
    const qty = Number(item.qty || 1);
    const listPrice = Number(item.listPrice || 0);
    const discount1 = Number(item.priceListDiscount || 0);
    const netPrice = Number(item.netPrice || 0);
    const discount2 = Number(item.extraDiscount || 0);
    const quoteUnit = netPrice * (1 - discount2 / 100);
    const total = quoteUnit * qty;

    switch (field.key) {
      case 'position': return index + 1;
      case 'article': return item.article || '';
      case 'model': return item.model || '';
      case 'color': return item.color || '';
      case 'family': return item.family || '';
      case 'qty': return qty;
      case 'listPrice': return listPrice;
      case 'priceListDiscount': return discount1 / 100;
      case 'netPrice': return netPrice;
      case 'extraDiscount': return discount2 / 100;
      case 'finalUnitPrice': return quoteUnit;
      case 'total': return total;
      case 'source': return typeof shortFileName === 'function' ? shortFileName(item.source || '') : (item.source || '');
      default: return '';
    }
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
    const fields = selectedFields(currency);

    const firstDataRow = 10;
    const minimumLines = Math.max(6, state.offer.length);
    const lastDataRow = firstDataRow + minimumLines - 1;
    const subtotalRow = lastDataRow + 2;
    const totalRow = subtotalRow + 1;

    const tableColCount = fields.length;
    const sheetColCount = Math.max(tableColCount, 4);
    const lastSheetCol = XLSX.utils.encode_col(sheetColCount - 1);
    const lastTableCol = XLSX.utils.encode_col(tableColCount - 1);
    const rightLabelColIndex = Math.max(2, sheetColCount - 2);
    const rightValueColIndex = Math.max(3, sheetColCount - 1);
    const rightLabelCol = XLSX.utils.encode_col(rightLabelColIndex);
    const rightValueCol = XLSX.utils.encode_col(rightValueColIndex);

    const ws = {};
    ws['!ref'] = `A1:${lastSheetCol}${totalRow + 3}`;
    ws['!merges'] = [
      XLSX.utils.decode_range(`A1:${lastSheetCol}1`),
      XLSX.utils.decode_range(`A2:${lastSheetCol}2`),
      XLSX.utils.decode_range(`A4:${lastSheetCol}4`)
    ];
    ws['!cols'] = Array.from({ length: sheetColCount }, (_, i) => {
      let width = fields[i]?.width || 16;
      if (i === 0) width = Math.max(width, 16);
      if (i === 1) width = Math.max(width, 24);
      return { wch: width };
    });
    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 30 };
    ws['!rows'][1] = { hpt: 23 };
    ws['!rows'][3] = { hpt: 26 };
    ws['!rows'][4] = { hpt: 22 };
    ws['!rows'][5] = { hpt: 22 };
    ws['!rows'][8] = { hpt: 27 };
    for (let r = firstDataRow - 1; r <= lastDataRow - 1; r++) ws['!rows'][r] = { hpt: 23 };
    ws['!rows'][totalRow - 1] = { hpt: 27 };
    ws['!margins'] = { left: 0.3, right: 0.3, top: 0.35, bottom: 0.35, header: 0.2, footer: 0.2 };
    ws['!freeze'] = { xSplit: 0, ySplit: 9 };
    if (tableColCount > 0) ws['!autofilter'] = { ref: `A9:${lastTableCol}${firstDataRow + state.offer.length - 1}` };

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
      font: { name: 'Arial', bold: true, sz: 10.5, color: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const metaStyle = {
      font: { name: 'Arial', sz: 10.5, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: CREAM } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const rightLabelStyle = {
      font: { name: 'Arial', bold: true, sz: 10.5, color: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'right' }
    };
    const tableHeader = {
      font: { name: 'Arial', bold: true, sz: 10.5, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLACK } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
    };
    const bodyBase = {
      font: { name: 'Arial', sz: 10, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: CREAM } },
      border: thinBorder(),
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const totalStyle = {
      font: { name: 'Arial', bold: true, sz: 11.5, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: RED } },
      alignment: { vertical: 'center', horizontal: 'right' }
    };

    for (let c = 0; c < sheetColCount; c++) {
      setCell(ws, XLSX.utils.encode_cell({ r: 0, c }), c === 0 ? 'SNAP-ON EQUIPMENT' : '', redBar);
      setCell(ws, XLSX.utils.encode_cell({ r: 1, c }), c === 0 ? 'AUTHORIZED DEALER / PARTNER' : '', blackBar);
    }

    setCell(ws, 'A4', 'COMMERCIAL QUOTATION', quotationTitle);
    setCell(ws, 'A5', 'Customer:', labelStyle);
    setCell(ws, 'B5', customer, metaStyle);
    setCell(ws, 'A6', 'Quotation No.:', labelStyle);
    setCell(ws, 'B6', quotationNo, metaStyle);
    setCell(ws, `${rightLabelCol}5`, 'Date:', rightLabelStyle);
    setCell(ws, `${rightValueCol}5`, dateText(quotationDate), metaStyle);
    setCell(ws, `${rightLabelCol}6`, 'Currency:', rightLabelStyle);
    setCell(ws, `${rightValueCol}6`, currency, metaStyle);

    fields.forEach((field, i) => {
      const style = {
        ...tableHeader,
        alignment: {
          vertical: 'center',
          horizontal: field.align === 'left' ? 'left' : 'center',
          wrapText: true
        }
      };
      setCell(ws, XLSX.utils.encode_cell({ r: 8, c: i }), field.header, style);
    });

    for (let line = 0; line < minimumLines; line++) {
      const row = firstDataRow + line;
      const item = state.offer[line];

      fields.forEach((field, colIndex) => {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: colIndex });
        const align = field.align || 'left';
        const style = {
          ...bodyBase,
          font: {
            ...bodyBase.font,
            bold: ['position', 'article', 'model', 'color'].includes(field.key)
          },
          alignment: { vertical: 'center', horizontal: align }
        };

        if (!item) {
          setCell(ws, addr, '', style);
          return;
        }

        const value = valueForField(item, field, line);
        const format = field.money ? moneyFormat : field.percent ? '0.00%' : field.format;
        setCell(ws, addr, value, style, format);

        if (field.key === 'color' && typeof ralPrimaryHex === 'function') {
          try {
            const hex = ralPrimaryHex(item.color);
            if (hex && ws[addr]) {
              const rgb = hex.replace('#', '').toUpperCase();
              ws[addr].s = {
                ...style,
                fill: { fgColor: { rgb } },
                font: {
                  ...style.font,
                  color: { rgb: typeof isDarkHex === 'function' && isDarkHex(hex) ? WHITE : '111111' }
                }
              };
            }
          } catch (_) {}
        }
      });
    }

    const grandTotal = state.offer.reduce((sum, item) => {
      const quoteUnit = Number(item.netPrice || 0) * (1 - Number(item.extraDiscount || 0) / 100);
      return sum + quoteUnit * Number(item.qty || 1);
    }, 0);

    const totalFieldIndex = fields.findIndex(field => field.key === 'total');
    const summaryValueColIndex = totalFieldIndex >= 0 ? totalFieldIndex : Math.max(1, tableColCount - 1);
    const summaryLabelColIndex = Math.max(0, summaryValueColIndex - 1);
    const summaryValueCol = XLSX.utils.encode_col(summaryValueColIndex);
    const summaryLabelCol = XLSX.utils.encode_col(summaryLabelColIndex);

    setCell(ws, `${summaryLabelCol}${subtotalRow}`, 'Subtotal:', {
      font: { name: 'Arial', bold: true, sz: 10.5, color: { rgb: BLACK } },
      alignment: { horizontal: 'right' }
    });
    setCell(ws, `${summaryValueCol}${subtotalRow}`, grandTotal, {
      font: { name: 'Arial', sz: 10.5, color: { rgb: BLACK } },
      alignment: { horizontal: 'right' }
    }, moneyFormat);

    setCell(ws, `${summaryLabelCol}${totalRow}`, 'TOTAL:', totalStyle);
    setCell(ws, `${summaryValueCol}${totalRow}`, grandTotal, totalStyle, moneyFormat);

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

  function lockCurrentVersionBadge() {
    const current = document.querySelector('.badge');
    if (!current) return;
    const badge = current.cloneNode(true);
    badge.textContent = 'V37 · Selectable quotation columns';
    badge.removeAttribute('data-v34-locked');
    current.replaceWith(badge);
    new MutationObserver(() => {
      if (badge.textContent !== 'V37 · Selectable quotation columns') {
        badge.textContent = 'V37 · Selectable quotation columns';
      }
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  function install() {
    lockCurrentVersionBadge();
    const btn = document.getElementById('exportBtn');
    if (btn && btn.dataset.v37QuotationDesign !== '1') {
      btn.dataset.v37QuotationDesign = '1';
      btn.addEventListener('click', exportSnapOnQuotation, true);
    }
    setTimeout(lockCurrentVersionBadge, 50);
    setTimeout(lockCurrentVersionBadge, 300);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
