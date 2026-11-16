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
      { key: 'listPrice', header: 'List Price', width: 17, align: 'right', money: true },
      { key: 'priceListDiscount', header: 'Discount', width: 13, align: 'center', percent: true },
      { key: 'netPrice', header: 'Net Price', width: 17, align: 'right', money: true },
      { key: 'extraDiscount', header: 'Second Discount', width: 17, align: 'center', percent: true },
      { key: 'finalUnitPrice', header: 'Quote/Unit', width: 18, align: 'right', money: true },
      { key: 'total', header: 'Total', width: 18, align: 'right', money: true },
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

  function syncQuotationInputs() {
    try {
      document.querySelectorAll('#offerBody [data-offer-field]').forEach(input => {
        const uid = input.dataset.offerUid;
        const field = input.dataset.offerField;
        const item = state.offer.find(x => x.uid === uid);
        if (!item) return;
        if (field === 'qty') item.qty = Math.max(1, Math.round(Number(input.value) || 1));
        if (field === 'extraDiscount') item.extraDiscount = Math.min(100, Math.max(0, Number(input.value) || 0));
      });
    } catch (_) {}
  }

  function createQuotationWorkbook() {
    syncQuotationInputs();
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

    const headerRow = 8;
    const firstDataRow = 9;
    const lineCount = Math.max(2, state.offer.length);
    const lastDataRow = firstDataRow + lineCount - 1;
    const totalRow = lastDataRow + 2;

    const tableColCount = fields.length;
    const sheetColCount = Math.max(tableColCount, 4);
    const lastSheetCol = XLSX.utils.encode_col(sheetColCount - 1);
    const lastTableCol = XLSX.utils.encode_col(tableColCount - 1);
    const rightLabelColIndex = Math.max(2, sheetColCount - 2);
    const rightValueColIndex = Math.max(3, sheetColCount - 1);
    const rightLabelCol = XLSX.utils.encode_col(rightLabelColIndex);
    const rightValueCol = XLSX.utils.encode_col(rightValueColIndex);

    const BLUE_TITLE = '17365D';
    const BLUE_HEADER = '1F4E78';
    const LABEL_BLUE = '44546A';
    const BORDER_BLUE = 'D9E2F3';
    const TOTAL_FILL = 'D9EAF7';

    const referenceWidths = {
      position: 8,
      article: 24,
      model: 34,
      color: 18,
      qty: 10,
      listPrice: 18,
      priceListDiscount: 14,
      netPrice: 18,
      extraDiscount: 18,
      finalUnitPrice: 20,
      total: 18,
      family: 24,
      source: 24
    };

    const ws = {};
    ws['!ref'] = `A1:${lastSheetCol}${totalRow}`;
    ws['!merges'] = [XLSX.utils.decode_range(`A1:${lastSheetCol}1`)];
    ws['!cols'] = fields.map(field => ({ wch: referenceWidths[field.key] || field.width || 16 }));
    while (ws['!cols'].length < sheetColCount) ws['!cols'].push({ wch: 16 });

    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 26 };
    ws['!rows'][1] = { hpt: 8 };
    ws['!rows'][2] = { hpt: 20 };
    ws['!rows'][3] = { hpt: 20 };
    ws['!rows'][4] = { hpt: 8 };
    ws['!rows'][5] = { hpt: 8 };
    ws['!rows'][6] = { hpt: 8 };
    ws['!rows'][headerRow - 1] = { hpt: 24 };
    for (let r = firstDataRow - 1; r <= lastDataRow - 1; r++) ws['!rows'][r] = { hpt: 22 };
    ws['!rows'][totalRow - 1] = { hpt: 22 };

    ws['!margins'] = { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 };
    ws['!freeze'] = { xSplit: 0, ySplit: headerRow };

    const lightBorder = {
      top: { style: 'thin', color: { rgb: BORDER_BLUE } },
      bottom: { style: 'thin', color: { rgb: BORDER_BLUE } },
      left: { style: 'thin', color: { rgb: BORDER_BLUE } },
      right: { style: 'thin', color: { rgb: BORDER_BLUE } }
    };

    const titleStyle = {
      font: { name: 'Calibri', bold: true, sz: 18, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE_TITLE } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const labelStyle = {
      font: { name: 'Calibri', bold: true, sz: 11, color: { rgb: LABEL_BLUE } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const valueStyle = {
      font: { name: 'Calibri', sz: 11, color: { rgb: BLACK } },
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const headerStyle = {
      font: { name: 'Calibri', bold: true, sz: 11, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: BLUE_HEADER } },
      border: lightBorder,
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true }
    };
    const bodyStyle = {
      font: { name: 'Calibri', sz: 11, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: WHITE } },
      border: lightBorder,
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const totalStyle = {
      font: { name: 'Calibri', bold: true, sz: 11, color: { rgb: BLACK } },
      fill: { fgColor: { rgb: TOTAL_FILL } },
      border: lightBorder,
      alignment: { vertical: 'center', horizontal: 'left' }
    };
    const totalValueStyle = {
      ...totalStyle,
      alignment: { vertical: 'center', horizontal: 'right' }
    };

    for (let col = 0; col < sheetColCount; col++) {
      setCell(ws, XLSX.utils.encode_cell({ r: 0, c: col }), col === 0 ? 'QUOTATION' : '', titleStyle);
    }

    setCell(ws, 'A3', 'Customer', labelStyle);
    setCell(ws, 'B3', customer, valueStyle);
    setCell(ws, 'A4', 'Date', labelStyle);
    setCell(ws, 'B4', dateText(quotationDate), valueStyle);
    setCell(ws, `${rightLabelCol}3`, 'Quotation No.', labelStyle);
    setCell(ws, `${rightValueCol}3`, quotationNo, valueStyle);

    fields.forEach((field, i) => {
      setCell(ws, XLSX.utils.encode_cell({ r: headerRow - 1, c: i }), field.header, headerStyle);
    });

    const colByKey = Object.fromEntries(fields.map((field, index) => [field.key, XLSX.utils.encode_col(index)]));

    function finalUnitFormula(item, row) {
      let baseExpr;
      if (colByKey.netPrice) {
        baseExpr = `${colByKey.netPrice}${row}`;
      } else if (colByKey.listPrice) {
        const discountExpr = colByKey.priceListDiscount
          ? `${colByKey.priceListDiscount}${row}`
          : String(Number(item.priceListDiscount || 0) / 100);
        baseExpr = `${colByKey.listPrice}${row}*(1-${discountExpr})`;
      } else {
        baseExpr = String(Number(item.netPrice || 0));
      }
      const secondDiscountExpr = colByKey.extraDiscount
        ? `${colByKey.extraDiscount}${row}`
        : String(Number(item.extraDiscount || 0) / 100);
      return `(${baseExpr})*(1-${secondDiscountExpr})`;
    }

    function totalFormula(item, row) {
      const qtyExpr = colByKey.qty ? `${colByKey.qty}${row}` : String(Number(item.qty || 1));
      const unitExpr = colByKey.finalUnitPrice
        ? `${colByKey.finalUnitPrice}${row}`
        : finalUnitFormula(item, row);
      return `${unitExpr}*${qtyExpr}`;
    }

    for (let line = 0; line < lineCount; line++) {
      const row = firstDataRow + line;
      const item = state.offer[line];

      fields.forEach((field, colIndex) => {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c: colIndex });
        const align = ['qty','listPrice','priceListDiscount','netPrice','extraDiscount','finalUnitPrice','total'].includes(field.key)
          ? 'right'
          : 'left';
        let style = { ...bodyStyle, alignment: { vertical: 'center', horizontal: align } };

        if (!item) {
          setCell(ws, addr, '', style);
          return;
        }

        const format = field.money ? moneyFormat : field.percent ? '0.00%' : field.format;
        if (field.key === 'finalUnitPrice') {
          setCell(ws, addr, { f: finalUnitFormula(item, row) }, style, format);
        } else if (field.key === 'total') {
          setCell(ws, addr, { f: totalFormula(item, row) }, style, format);
        } else {
          setCell(ws, addr, valueForField(item, field, line), style, format);
        }

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
                  bold: true,
                  color: { rgb: typeof isDarkHex === 'function' && isDarkHex(hex) ? WHITE : '111111' }
                }
              };
            }
          } catch (_) {}
        }
      });
    }

    const totalFieldIndex = fields.findIndex(field => field.key === 'total');
    const summaryValueColIndex = totalFieldIndex >= 0 ? totalFieldIndex : Math.max(1, tableColCount - 1);
    const summaryLabelColIndex = Math.max(0, summaryValueColIndex - 1);
    const summaryValueCol = XLSX.utils.encode_col(summaryValueColIndex);
    const summaryLabelCol = XLSX.utils.encode_col(summaryLabelColIndex);

    const grandTotal = state.offer.reduce((sum, item) => {
      const quoteUnit = Number(item.netPrice || 0) * (1 - Number(item.extraDiscount || 0) / 100);
      return sum + quoteUnit * Number(item.qty || 1);
    }, 0);

    const lastOfferRow = firstDataRow + state.offer.length - 1;
    const grandTotalFormula = colByKey.total
      ? `SUM(${colByKey.total}${firstDataRow}:${colByKey.total}${lastOfferRow})`
      : '';

    setCell(ws, `${summaryLabelCol}${totalRow}`, 'GRAND TOTAL', totalStyle);
    setCell(ws, `${summaryValueCol}${totalRow}`,
      grandTotalFormula ? { f: grandTotalFormula } : grandTotal,
      totalValueStyle,
      moneyFormat
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quotation');
    wb.Props = {
      Title: quotationNo ? `Quotation ${quotationNo}` : 'Quotation',
      Subject: customer ? `Quotation for ${customer}` : 'Quotation',
      Author: 'Sales Pricing',
      Company: '',
      CreatedDate: new Date()
    };

    return { wb, customer, quotationNo };
  }

    const ARCHIVE_DB_NAME = 'salesPricingQuotationArchiveDB';
  const ARCHIVE_STORE = 'quotations';

  function openArchiveDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ARCHIVE_DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
          db.createObjectStore(ARCHIVE_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveArchiveRecord(record) {
    const db = await openArchiveDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
      tx.objectStore(ARCHIVE_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function getArchiveRecords() {
    const db = await openArchiveDb();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readonly');
      const req = tx.objectStore(ARCHIVE_STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return records.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function getArchiveRecord(id) {
    const db = await openArchiveDb();
    const record = await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readonly');
      const req = tx.objectStore(ARCHIVE_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  }

  async function deleteArchiveRecord(id) {
    const db = await openArchiveDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ARCHIVE_STORE, 'readwrite');
      tx.objectStore(ARCHIVE_STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function archiveTotal() {
    return state.offer.reduce((sum, item) => {
      const quoteUnit = Number(item.netPrice || 0) * (1 - Number(item.extraDiscount || 0) / 100);
      return sum + quoteUnit * Number(item.qty || 1);
    }, 0);
  }

  function normalizeArchiveDate(value) {
    if (!value) return '';
    const iso = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
    if (iso) return iso[0];
    const m = String(value).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
    return '';
  }

  function restoreArchiveMeta(record) {
    const customerEl = document.getElementById('customerName');
    const numberEl = document.getElementById('offerNumber');
    const dateEl = document.getElementById('offerDate');
    const currencyEl = document.getElementById('currency');
    if (customerEl) customerEl.value = record.customer || '';
    if (numberEl) numberEl.value = record.quotationNo || '';
    if (dateEl) dateEl.value = normalizeArchiveDate(record.quotationDate || '');
    if (currencyEl && record.currency) currencyEl.value = record.currency;
  }

  function archiveItemsFromWorkbook(record) {
    try {
      const wb = XLSX.read(record.data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return [];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      const headerIndex = rows.findIndex(row => row.some(v => normalize(v) === normalize('Part No.')) || row.some(v => normalize(v) === normalize('Model')));
      if (headerIndex < 0) return [];
      const headers = rows[headerIndex].map(v => normalize(v));
      const findCol = names => headers.findIndex(h => names.some(n => h === normalize(n) || h.startsWith(normalize(n))));
      const cols = {
        article: findCol(['Part No.','Article']),
        model: findCol(['Model']),
        color: findCol(['Colour / RAL','Color / RAL','Colour','Color']),
        family: findCol(['Family / Group','Family']),
        qty: findCol(['Qty']),
        listPrice: findCol(['List Price']),
        priceListDiscount: findCol(['Discount']),
        netPrice: findCol(['Net Price']),
        extraDiscount: findCol(['Second Discount'])
      };
      const items = [];
      for (let r = headerIndex + 1; r < rows.length; r++) {
        const row = rows[r];
        const article = cols.article >= 0 ? row[cols.article] : '';
        const model = cols.model >= 0 ? row[cols.model] : '';
        if (!article && !model) continue;
        const num = (idx, fallback=0) => {
          if (idx < 0) return fallback;
          const v = Number(row[idx]);
          return Number.isFinite(v) ? v : fallback;
        };
        items.push({
          uid: `archive-${record.id}-${r}`,
          listId: 'archive',
          article: String(article || ''),
          model: String(model || ''),
          color: cols.color >= 0 ? String(row[cols.color] || '') : '',
          family: cols.family >= 0 ? String(row[cols.family] || '') : '',
          qty: Math.max(1, Math.round(num(cols.qty, 1))),
          listPrice: num(cols.listPrice, 0),
          priceListDiscount: num(cols.priceListDiscount, 0) * (num(cols.priceListDiscount, 0) <= 1 ? 100 : 1),
          netPrice: num(cols.netPrice, 0),
          extraDiscount: num(cols.extraDiscount, 0) * (num(cols.extraDiscount, 0) <= 1 ? 100 : 1),
          source: record.filename || 'Archived quotation'
        });
      }
      return items;
    } catch (err) {
      console.warn('Archived quotation could not be reconstructed.', err);
      return [];
    }
  }

  async function loadArchiveRecord(id) {
    const record = await getArchiveRecord(id);
    if (!record) return;

    let items = Array.isArray(record.offer) ? record.offer.map((item, index) => ({
      ...item,
      uid: item.uid || `archive-${record.id}-${index}`
    })) : [];

    if (!items.length && record.data) items = archiveItemsFromWorkbook(record);
    if (!items.length) {
      alert('This archived quotation cannot be loaded back into the editor.');
      return;
    }

    state.offer = items;
    if (record.exportOptions) state.exportOptions = { ...state.exportOptions, ...record.exportOptions };
    restoreArchiveMeta(record);
    if (typeof renderOffer === 'function') renderOffer();
    if (typeof renderResults === 'function') renderResults();
    if (typeof autoSaveDraft === 'function') autoSaveDraft();
    document.getElementById('offerCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ensureArchiveUi() {
    if (document.getElementById('quotationArchiveCard')) return;
    const offerCard = document.getElementById('offerCard');
    if (!offerCard) return;

    const card = document.createElement('section');
    card.id = 'quotationArchiveCard';
    card.className = 'card quotation-archive-card';
    card.innerHTML = `
      <div class="section-head">
        <div>
          <h2>Quotation archive</h2>
          <p class="muted">Every exported quotation is saved automatically in this browser.</p>
        </div>
        <span id="quotationArchiveCount" class="count-pill">0 quotations</span>
      </div>
      <div class="quotation-archive-wrap">
        <table class="quotation-archive-table">
          <thead><tr><th>Date</th><th>Customer</th><th>Quotation No.</th><th>Total</th><th></th></tr></thead>
          <tbody id="quotationArchiveBody"><tr><td colspan="5" class="empty">No saved quotations yet.</td></tr></tbody>
        </table>
      </div>`;

    offerCard.insertAdjacentElement('afterend', card);

    const style = document.createElement('style');
    style.textContent = `
      .quotation-archive-card{margin-top:18px}
      .quotation-archive-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:12px}
      .quotation-archive-table{width:100%;border-collapse:collapse;min-width:720px}
      .quotation-archive-table th{background:#f7f8fa;color:#656b73;font-size:11px;text-transform:uppercase;letter-spacing:.03em;text-align:left;padding:10px 12px;border-bottom:1px solid #e5e7eb}
      .quotation-archive-table td{padding:11px 12px;border-bottom:1px solid #eceff2;font-size:13px}
      .quotation-archive-table tr:last-child td{border-bottom:0}
      .quotation-archive-table td:nth-child(4),.quotation-archive-table th:nth-child(4){text-align:right}
      .quotation-archive-actions{display:flex;gap:6px;justify-content:flex-end}
    `;
    document.head.appendChild(style);

    card.addEventListener('click', async event => {
      const loadBtn = event.target.closest('[data-archive-load]');
      if (loadBtn) {
        await loadArchiveRecord(loadBtn.dataset.archiveLoad);
        return;
      }
      const downloadBtn = event.target.closest('[data-archive-download]');
      if (downloadBtn) {
        const record = await getArchiveRecord(downloadBtn.dataset.archiveDownload);
        if (record?.data) {
          triggerBlobDownload(new Blob([record.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), record.filename);
        }
        return;
      }
      const deleteBtn = event.target.closest('[data-archive-delete]');
      if (deleteBtn) {
        if (!confirm('Delete this quotation from the archive?')) return;
        await deleteArchiveRecord(deleteBtn.dataset.archiveDelete);
        await renderQuotationArchive();
      }
    });
  }

  async function renderQuotationArchive() {
    ensureArchiveUi();
    const body = document.getElementById('quotationArchiveBody');
    const count = document.getElementById('quotationArchiveCount');
    if (!body || !count) return;
    try {
      const records = await getArchiveRecords();
      count.textContent = `${records.length} quotation${records.length === 1 ? '' : 's'}`;
      if (!records.length) {
        body.innerHTML = '<tr><td colspan="5" class="empty">No saved quotations yet.</td></tr>';
        return;
      }
      body.innerHTML = records.map(record => {
        const dt = new Date(record.createdAt);
        const date = Number.isNaN(dt.getTime()) ? '' : dt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
        const total = new Intl.NumberFormat('en-GB', { style: 'currency', currency: record.currency || 'EUR' }).format(Number(record.total || 0));
        return `<tr>
          <td>${escapeHtml(date)}</td>
          <td><strong>${escapeHtml(record.customer || '—')}</strong></td>
          <td>${escapeHtml(record.quotationNo || '—')}</td>
          <td>${escapeHtml(total)}</td>
          <td><div class="quotation-archive-actions">
            <button class="mini-btn" type="button" data-archive-load="${escapeAttr(record.id)}">Load</button>
            <button class="mini-btn" type="button" data-archive-download="${escapeAttr(record.id)}">Download</button>
            <button class="mini-btn danger-text" type="button" data-archive-delete="${escapeAttr(record.id)}">Delete</button>
          </div></td>
        </tr>`;
      }).join('');
    } catch (err) {
      console.warn('Quotation archive could not be loaded.', err);
    }
  }

  async function hideGridlinesInWorkbook(data) {
    if (!window.JSZip) return data;
    try {
      const zip = await JSZip.loadAsync(data);
      const sheetPath = 'xl/worksheets/sheet1.xml';
      const file = zip.file(sheetPath);
      if (!file) return data;
      let xml = await file.async('string');
      if (/<sheetView\b[^>]*showGridLines=/.test(xml)) {
        xml = xml.replace(/(<sheetView\b[^>]*?)showGridLines="[^"]*"/, '$1showGridLines="0"');
      } else {
        xml = xml.replace(/<sheetView\b/, '<sheetView showGridLines="0"');
      }
      zip.file(sheetPath, xml);
      return await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    } catch (err) {
      console.warn('Could not hide Excel gridlines.', err);
      return data;
    }
  }

  async function exportSnapOnQuotation(event) {
    event.preventDefault();
    event.stopImmediatePropagation();

    const result = createQuotationWorkbook();
    if (!result) return;

    const customerPart = result.customer ? '_' + safeFile(result.customer) : '';
    const quotationPart = result.quotationNo ? '_' + safeFile(result.quotationNo) : '';
    const filename = `Quotation${customerPart}${quotationPart}.xlsx`;
    let data = XLSX.write(result.wb, { bookType: 'xlsx', type: 'array' });
    data = await hideGridlinesInWorkbook(data);
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    try {
      await saveArchiveRecord({
        id: (result.quotationNo || 'quotation') + '::' + Date.now(),
        createdAt: new Date().toISOString(),
        customer: result.customer || '',
        quotationNo: result.quotationNo || '',
        currency: document.getElementById('currency')?.value || 'EUR',
        total: archiveTotal(),
        quotationDate: document.getElementById('offerDate')?.value || '',
        exportOptions: { ...(state.exportOptions || {}) },
        offer: state.offer.map(item => ({ ...item })),
        filename,
        data
      });
      await renderQuotationArchive();
    } catch (err) {
      console.warn('Quotation could not be saved to archive.', err);
    }

    triggerBlobDownload(blob, filename);
  }

  function lockCurrentVersionBadge() {
    const current = document.querySelector('.badge');
    if (!current) return;
    const badge = current.cloneNode(true);
    badge.textContent = 'V44 · Final clean quotation';
    badge.removeAttribute('data-v34-locked');
    current.replaceWith(badge);
    new MutationObserver(() => {
      if (badge.textContent !== 'V44 · Final clean quotation') {
        badge.textContent = 'V44 · Final clean quotation';
      }
    }).observe(badge, { childList: true, characterData: true, subtree: true });
  }

  function install() {
    lockCurrentVersionBadge();
    const btn = document.getElementById('exportBtn');
    if (btn && btn.dataset.v47QuotationDesign !== '1') {
      btn.dataset.v47QuotationDesign = '1';
      btn.addEventListener('click', exportSnapOnQuotation, true);
    }
    setTimeout(lockCurrentVersionBadge, 50);
    setTimeout(lockCurrentVersionBadge, 300);
    ensureArchiveUi();
    renderQuotationArchive();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
