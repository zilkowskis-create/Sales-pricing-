const DB_NAME = 'preislistenAnalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'priceLists';
const EXPORT_OPTIONS_KEY = 'preislistenAnalyzerExportOptionsV1';
const DRAFT_KEY = 'preislistenAnalyzerOfferDraftV1';
const OFFER_SEQUENCE_KEY = 'preislistenAnalyzerOfferSequenceV1';
const SEARCH_SETTINGS_KEY = 'preislistenAnalyzerSearchSettingsV1';

const DEFAULT_EXPORT_OPTIONS = {
  position: true,
  article: true,
  model: true,
  color: true,
  family: false,
  qty: true,
  listPrice: true,
  priceListDiscount: true,
  netPrice: true,
  extraDiscount: true,
  finalUnitPrice: true,
  total: true,
  source: false
};

const EXPORT_FIELD_LABELS = {
  position: 'Pos.',
  article: 'Artikelnummer',
  model: 'Modell',
  color: 'Farbe / RAL',
  family: 'Family / Gruppe',
  qty: 'Menge',
  listPrice: 'List Price',
  priceListDiscount: 'Discount',
  netPrice: 'Net Price',
  extraDiscount: 'Second Discount',
  finalUnitPrice: 'Angebot/Stk.',
  total: 'Gesamt',
  source: 'Preisliste / Quelle'
};

const state = {
  priceLists: [],
  activeListId: null,
  offer: [],
  exportOptions: loadExportOptions(),
  searchSettings: loadSearchSettings()
};

const el = (id) => document.getElementById(id);
const fileInput = el('fileInput');
const fileInfo = el('fileInfo');
const savedLists = el('savedLists');
const mappingCard = el('mappingCard');
const searchCard = el('searchCard');
const offerCard = el('offerCard');
const priceListSelect = el('priceListSelect');
const sheetSelect = el('sheetSelect');
const articleCol = el('articleCol');
const modelCol = el('modelCol');
const listPriceCol = el('listPriceCol');
const priceListDiscountCol = el('priceListDiscountCol');
const netPriceCol = el('netPriceCol');
const familyCol = el('familyCol');
const colorCol = el('colorCol');
const searchInput = el('searchInput');
const resultsBody = el('resultsBody');
const resultCount = el('resultCount');
const offerBody = el('offerBody');
const grandTotal = el('grandTotal');
const exportOptionsGrid = el('exportOptionsGrid');
const draftStatus = el('draftStatus');
const filtersEnabledToggle = el('filtersEnabledToggle');
const filterPanel = el('filterPanel');
const sourceFilter = el('sourceFilter');
const familyFilter = el('familyFilter');
const colorFilter = el('colorFilter');
const imageDialog = el('imageDialog');
const imageDialogImg = el('imageDialogImg');
const imageDialogCaption = el('imageDialogCaption');

fileInput.addEventListener('change', handleFiles);
priceListSelect.addEventListener('change', () => setActiveList(priceListSelect.value));
sheetSelect.addEventListener('change', () => switchActiveSheet(sheetSelect.value));
el('applyMappingBtn').addEventListener('click', applyMapping);
searchInput.addEventListener('input', renderResults);
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    quickAddTopResult();
  }
});
el('clearSearchBtn').addEventListener('click', () => {
  searchInput.value = '';
  renderResults();
  searchInput.focus();
});
filtersEnabledToggle.addEventListener('change', () => {
  state.searchSettings.filtersEnabled = filtersEnabledToggle.checked;
  saveSearchSettings();
  renderFilters();
  renderResults();
});
[sourceFilter, familyFilter, colorFilter].forEach(select => select.addEventListener('change', () => {
  state.searchSettings[select.dataset.settingKey] = select.value;
  saveSearchSettings();
  renderFilters();
  renderResults();
}));
el('clearFiltersBtn').addEventListener('click', clearFilters);
el('clearOfferBtn').addEventListener('click', () => {
  state.offer = [];
  renderOffer();
  renderResults();
  autoSaveDraft();
});
el('clearListsBtn').addEventListener('click', clearAllLists);
el('exportBtn').addEventListener('click', exportOffer);
el('currency').addEventListener('change', () => { renderOffer(); autoSaveDraft(); });
el('customerName').addEventListener('input', autoSaveDraft);
el('offerNumber').addEventListener('input', autoSaveDraft);
el('offerDate').addEventListener('change', autoSaveDraft);
el('generateOfferNoBtn').addEventListener('click', () => {
  el('offerNumber').value = generateOfferNumber();
  autoSaveDraft();
});
el('applyQtyAllBtn').addEventListener('click', applyQuantityToAll);
el('applyDiscountAllBtn').addEventListener('click', applyDiscountToAll);
el('saveDraftBtn').addEventListener('click', () => saveDraft(true));
el('loadDraftBtn').addEventListener('click', loadDraft);
el('newOfferBtn').addEventListener('click', newOffer);
el('defaultExportOptionsBtn').addEventListener('click', () => {
  state.exportOptions = { ...DEFAULT_EXPORT_OPTIONS };
  saveExportOptions();
  renderExportOptions();
});
el('allExportOptionsBtn').addEventListener('click', () => {
  state.exportOptions = Object.fromEntries(Object.keys(DEFAULT_EXPORT_OPTIONS).map(key => [key, true]));
  saveExportOptions();
  renderExportOptions();
});
exportOptionsGrid.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-export-option]');
  if (!checkbox) return;
  state.exportOptions[checkbox.dataset.exportOption] = checkbox.checked;
  saveExportOptions();
});

savedLists.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('[data-enable-list]');
  if (!checkbox) return;
  const list = state.priceLists.find(x => x.id === checkbox.dataset.enableList);
  if (!list) return;
  list.enabled = checkbox.checked;
  await savePriceList(list);
  renderSavedLists();
  renderFilters();
  renderResults();
});

savedLists.addEventListener('click', async (event) => {
  const editBtn = event.target.closest('[data-edit-list]');
  if (editBtn) {
    setActiveList(editBtn.dataset.editList);
    mappingCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const removeBtn = event.target.closest('[data-remove-list]');
  if (removeBtn) {
    const id = removeBtn.dataset.removeList;
    const list = state.priceLists.find(x => x.id === id);
    if (!list) return;
    if (!confirm(`Preisliste „${list.fileName}“ aus dem Browser löschen?`)) return;
    await deletePriceList(id);
    state.priceLists = state.priceLists.filter(x => x.id !== id);
    state.offer = state.offer.filter(x => x.listId !== id);
    if (state.activeListId === id) state.activeListId = state.priceLists[0]?.id || null;
    refreshAll();
  }
});

resultsBody.addEventListener('change', (event) => {
  const checkbox = event.target.closest('[data-offer-uid]');
  if (!checkbox) return;
  toggleOffer(checkbox.dataset.offerUid, checkbox.checked);
});

offerBody.addEventListener('change', (event) => {
  const input = event.target.closest('[data-offer-field]');
  if (!input) return;
  updateOffer(input.dataset.offerUid, input.dataset.offerField, input.value);
});

offerBody.addEventListener('click', (event) => {
  const image = event.target.closest('[data-image-preview]');
  if (image) {
    openImagePreview(image.src, image.dataset.imageCaption || 'Produktbild');
    return;
  }
  const btn = event.target.closest('[data-remove-offer]');
  if (!btn) return;
  removeOffer(btn.dataset.removeOffer);
});
resultsBody.addEventListener('click', (event) => {
  const image = event.target.closest('[data-image-preview]');
  if (!image) return;
  openImagePreview(image.src, image.dataset.imageCaption || 'Produktbild');
});
el('closeImageDialog').addEventListener('click', () => imageDialog.close());
imageDialog.addEventListener('click', (event) => {
  if (event.target === imageDialog) imageDialog.close();
});

init();

async function init() {
  try {
    const stored = await getAllPriceLists();
    state.priceLists = stored.map(list => {
      const detected = autoDetectMapping(list.headers || []);
      const upgraded = {
        ...list,
        workbook: null,
        sourceData: null,
        images: list.images || {},
        imageRowMap: list.imageRowMap || {},
        mapping: { ...detected, ...(list.mapping || {}) }
      };
      if (!upgraded.mapping.color) upgraded.mapping.color = detected.color || '';
      upgraded.items = mapItems(upgraded);
      return upgraded;
    });
    state.activeListId = state.priceLists[0]?.id || null;
    refreshAll();
    initializeOfferMeta();
    updateDraftStatus();
  } catch (err) {
    console.error(err);
    fileInfo.textContent = 'Lokaler Speicher konnte nicht geöffnet werden. Neue Preislisten können trotzdem geladen werden.';
    refreshAll();
    initializeOfferMeta();
    updateDraftStatus();
  }
}

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  fileInfo.textContent = `${files.length} Preisliste(n) werden verarbeitet …`;
  let imported = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      if (!wb.SheetNames.length) throw new Error('Keine Tabellenblätter gefunden.');

      const id = makeListId(file);
      const bestSheet = detectBestSheet(wb);
      const extractedImages = await extractImagesForSheet(data, bestSheet);
      const existingIndex = state.priceLists.findIndex(x => x.id === id);
      const list = buildPriceListFromSheet({
        id,
        fileName: file.name,
        fileSize: file.size,
        lastModified: file.lastModified,
        workbook: wb,
        sourceData: data,
        images: extractedImages.images,
        imageRowMap: extractedImages.rowToImageId,
        enabled: existingIndex >= 0 ? state.priceLists[existingIndex].enabled : true
      }, bestSheet);

      if (existingIndex >= 0) state.priceLists.splice(existingIndex, 1, list);
      else state.priceLists.push(list);

      await savePriceList(list);
      state.activeListId = list.id;
      imported++;
    } catch (err) {
      console.error(file.name, err);
      errors++;
    }
  }

  fileInput.value = '';
  fileInfo.textContent = `${imported} Preisliste(n) gespeichert${errors ? ` · ${errors} Fehler` : ''}.`;
  refreshAll();
}

function buildPriceListFromSheet(base, sheetName) {
  const ws = base.workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!matrix.length) throw new Error(`Blatt „${sheetName}“ enthält keine lesbaren Daten.`);

  const headerInfo = detectHeaderRow(matrix);
  const headers = makeUniqueHeaders(matrix[headerInfo.index].map((v, i) => String(v || `Spalte ${i + 1}`).trim()));
  const rawRows = matrix.slice(headerInfo.index + 1)
    .map((row, relativeIndex) => ({ row, excelRow: headerInfo.index + 2 + relativeIndex }))
    .filter(entry => entry.row.some(v => String(v).trim() !== ''))
    .map(entry => ({
      ...Object.fromEntries(headers.map((h, i) => [h, entry.row[i] ?? ''])),
      __excelRow: entry.excelRow
    }));

  const mapping = autoDetectMapping(headers);
  const list = {
    ...base,
    sheetName,
    headers,
    rawRows,
    mapping,
    savedAt: new Date().toISOString(),
    items: []
  };
  list.items = mapItems(list);
  return list;
}

function detectBestSheet(wb) {
  let best = wb.SheetNames[0];
  let bestScore = -Infinity;

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const ref = ws['!ref'];
    if (!ref) continue;

    const decoded = XLSX.utils.decode_range(ref);
    const previewRange = XLSX.utils.encode_range({
      s: { r: decoded.s.r, c: decoded.s.c },
      e: { r: Math.min(decoded.s.r + 39, decoded.e.r), c: Math.min(decoded.s.c + 30, decoded.e.c) }
    });
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false, range: previewRange });
    const analysis = detectHeaderRow(matrix);

    let score = analysis.score;
    const normalizedName = normalize(name);
    if (normalizedName.includes('hofmann')) score += 8;
    if (normalizedName.includes('john bean') || normalizedName.includes('car o liner') || normalizedName.includes('josam')) score += 6;
    if (normalizedName.includes('price')) score += 4;
    if (normalizedName.includes('2026')) score += 2;
    if (normalizedName.includes('language') || normalizedName.includes('term')) score -= 8;

    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return best;
}

function detectHeaderRow(matrix) {
  const maxScan = Math.min(matrix.length, 40);
  const strongKeywords = ['p/n', 'part no', 'part number', 'model', 'list price', 'net price', 'discount'].map(normalize);
  const generalKeywords = ['artikel', 'article', 'item', 'material', 'bezeichnung', 'description', 'produkt', 'product', 'preis', 'price', 'family'].map(normalize);
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = matrix[i].map(v => normalize(v));
    const nonEmpty = row.filter(Boolean).length;
    let score = Math.min(nonEmpty, 14) * 0.15;

    for (const cell of row) {
      for (const keyword of strongKeywords) if (cell === keyword || cell.includes(keyword)) score += 4;
      for (const keyword of generalKeywords) if (cell === keyword || cell.includes(keyword)) score += 1.5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return { index: bestIndex, score: bestScore };
}

function makeUniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((h, i) => {
    const base = h || `Spalte ${i + 1}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

function autoDetectMapping(headers) {
  return {
    article: findHeader(headers, ['p/n', 'pn', 'artikelnummer', 'artikelnr', 'artikel nr', 'article number', 'article no', 'item number', 'item no', 'part number', 'part no', 'material number', 'material', 'sku', 'code']) || '',
    model: findHeader(headers, ['model', 'bezeichnung', 'artikelbezeichnung', 'product name', 'produkt', 'product', 'name']) || '',
    listPrice: findHeader(headers, ['list price', 'listenpreis', 'gross price', 'bruttopreis']) || findHeader(headers, ['price', 'preis']) || '',
    priceListDiscount: findHeader(headers, ['discount', 'rabatt', 'price list discount', 'preislistenrabatt']) || '',
    netPrice: findHeader(headers, ['net price', 'nettopreis', 'net price euro', 'net']) || '',
    family: findHeader(headers, ['family', 'familie', 'product type', 'produktgruppe', 'category', 'kategorie']) || '',
    color: findHeader(headers, ['color', 'colour', 'farbe', 'ral', 'farbton']) || ''
  };
}

function findHeader(headers, candidates) {
  const normalized = headers.map(h => ({ original: h, n: normalize(h) }));
  for (const candidate of candidates) {
    const c = normalize(candidate);
    const exact = normalized.find(x => x.n === c);
    if (exact) return exact.original;
  }
  for (const candidate of candidates) {
    const c = normalize(candidate);
    const partial = normalized.find(x => x.n.includes(c));
    if (partial) return partial.original;
  }
  return '';
}

function mapItems(list) {
  const m = list.mapping || {};
  let lastImageId = '';
  let lastImageFamily = '';

  return (list.rawRows || []).map((row, index) => {
    const article = m.article ? String(row[m.article] ?? '').trim() : '';
    const model = m.model ? String(row[m.model] ?? '').trim() : '';
    const listPrice = m.listPrice ? parsePrice(row[m.listPrice]) : 0;
    const priceListDiscount = m.priceListDiscount ? parseDiscount(row[m.priceListDiscount]) : 0;
    const hasNetPrice = m.netPrice && String(row[m.netPrice] ?? '').trim() !== '';
    const mappedNetPrice = hasNetPrice ? parsePrice(row[m.netPrice]) : 0;
    const calculatedNetPrice = listPrice * (1 - priceListDiscount / 100);
    const netPrice = hasNetPrice ? mappedNetPrice : calculatedNetPrice;
    const family = m.family ? String(row[m.family] ?? '').trim() : '';
    const color = m.color ? String(row[m.color] ?? '').trim() : '';
    const excelRow = Number(row.__excelRow) || (index + 1);
    let imageId = list.imageRowMap?.[excelRow] || '';

    if (imageId) {
      lastImageId = imageId;
      lastImageFamily = normalize(family);
    } else if (lastImageId && normalize(family) && normalize(family) === lastImageFamily) {
      imageId = lastImageId;
    } else if (normalize(family) !== lastImageFamily) {
      lastImageId = '';
      lastImageFamily = '';
    }

    const uid = `${list.id}::${index}`;
    const searchValues = Object.entries(row)
      .filter(([key]) => key !== '__excelRow')
      .map(([, value]) => value);

    return {
      uid,
      listId: list.id,
      rowIndex: index,
      excelRow,
      source: list.fileName,
      article,
      model,
      family,
      color,
      imageId,
      listPrice,
      priceListDiscount,
      netPrice,
      searchText: normalize(searchValues.join(' '))
    };
  }).filter(item => item.article || item.model);
}

function refreshAll() {
  renderSavedLists();
  renderPriceListSelector();
  renderMapping();
  renderFilters();
  renderResults();
  renderOffer();
  renderExportOptions();

  const hasLists = state.priceLists.length > 0;
  mappingCard.classList.toggle('hidden', !hasLists);
  searchCard.classList.toggle('hidden', !hasLists);
  offerCard.classList.toggle('hidden', !hasLists);

  if (hasLists && !fileInfo.textContent.includes('gespeichert')) {
    const activeCount = state.priceLists.filter(x => x.enabled).length;
    fileInfo.textContent = `${state.priceLists.length} Preisliste(n) im Browser gespeichert · ${activeCount} aktiv.`;
  }
}

function renderSavedLists() {
  if (!state.priceLists.length) {
    savedLists.innerHTML = '<div class="empty-box">Noch keine Preislisten gespeichert.</div>';
    return;
  }

  savedLists.innerHTML = state.priceLists.map(list => `
    <div class="saved-list-row ${list.enabled ? '' : 'disabled-row'}">
      <label class="saved-list-main">
        <input type="checkbox" data-enable-list="${escapeAttr(list.id)}" ${list.enabled ? 'checked' : ''} />
        <span>
          <strong>${escapeHtml(list.fileName)}</strong>
          <small>${escapeHtml(list.sheetName)} · ${list.items.length.toLocaleString('de-DE')} Artikel · ${Object.keys(list.images || {}).length ? `${Object.keys(list.images || {}).length} Bilder` : 'Bilder nach erneutem Import verfügbar'}</small>
        </span>
      </label>
      <div class="button-row">
        <button class="mini-btn" data-edit-list="${escapeAttr(list.id)}">Zuordnung</button>
        <button class="mini-btn danger-text" data-remove-list="${escapeAttr(list.id)}">Löschen</button>
      </div>
    </div>
  `).join('');
}

function renderPriceListSelector() {
  priceListSelect.innerHTML = state.priceLists.map(list =>
    `<option value="${escapeAttr(list.id)}">${escapeHtml(list.fileName)}</option>`
  ).join('');
  if (state.activeListId && state.priceLists.some(x => x.id === state.activeListId)) {
    priceListSelect.value = state.activeListId;
  }
}

function setActiveList(id) {
  if (!state.priceLists.some(x => x.id === id)) return;
  state.activeListId = id;
  renderPriceListSelector();
  renderMapping();
}

function getActiveList() {
  return state.priceLists.find(x => x.id === state.activeListId) || null;
}

function renderMapping() {
  const list = getActiveList();
  if (!list) return;

  if (list.workbook) {
    sheetSelect.disabled = false;
    sheetSelect.innerHTML = list.workbook.SheetNames.map(name =>
      `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`
    ).join('');
  } else {
    sheetSelect.disabled = true;
    sheetSelect.innerHTML = `<option value="${escapeAttr(list.sheetName)}">${escapeHtml(list.sheetName)} (gespeichert)</option>`;
  }
  sheetSelect.value = list.sheetName;

  const selects = [articleCol, modelCol, listPriceCol, priceListDiscountCol, netPriceCol, familyCol, colorCol];
  for (const select of selects) {
    select.innerHTML = '<option value="">— nicht verwenden —</option>' +
      list.headers.map(h => `<option value="${escapeAttr(h)}">${escapeHtml(h)}</option>`).join('');
  }

  articleCol.value = list.mapping.article || '';
  modelCol.value = list.mapping.model || '';
  listPriceCol.value = list.mapping.listPrice || '';
  priceListDiscountCol.value = list.mapping.priceListDiscount || '';
  netPriceCol.value = list.mapping.netPrice || '';
  familyCol.value = list.mapping.family || '';
  colorCol.value = list.mapping.color || '';
}

async function switchActiveSheet(name) {
  const list = getActiveList();
  if (!list?.workbook || !name || name === list.sheetName) return;

  const extractedImages = list.sourceData
    ? await extractImagesForSheet(list.sourceData, name)
    : { images: {}, rowToImageId: {} };
  const replacement = buildPriceListFromSheet({
    id: list.id,
    fileName: list.fileName,
    fileSize: list.fileSize,
    lastModified: list.lastModified,
    workbook: list.workbook,
    sourceData: list.sourceData || null,
    images: extractedImages.images,
    imageRowMap: extractedImages.rowToImageId,
    enabled: list.enabled
  }, name);

  const index = state.priceLists.findIndex(x => x.id === list.id);
  state.priceLists[index] = replacement;
  state.offer = state.offer.filter(x => x.listId !== list.id);
  await savePriceList(replacement);
  refreshAll();
}

async function applyMapping() {
  const list = getActiveList();
  if (!list) return;

  const mapping = {
    article: articleCol.value,
    model: modelCol.value,
    listPrice: listPriceCol.value,
    priceListDiscount: priceListDiscountCol.value,
    netPrice: netPriceCol.value,
    family: familyCol.value,
    color: colorCol.value
  };

  if (!mapping.article && !mapping.model) {
    alert('Bitte mindestens Artikelnummer oder Modell auswählen.');
    return;
  }

  list.mapping = mapping;
  list.items = mapItems(list);
  list.savedAt = new Date().toISOString();
  state.offer = state.offer.filter(x => x.listId !== list.id);
  await savePriceList(list);
  fileInfo.textContent = `Zuordnung für „${list.fileName}“ gespeichert.`;
  refreshAll();
}

function allSearchItems() {
  return state.priceLists.filter(x => x.enabled).flatMap(x => x.items);
}

function getSearchMatches() {
  const q = normalize(searchInput.value);
  const tokens = q.split(/\s+/).filter(Boolean);
  let items = allSearchItems();
  if (state.searchSettings.filtersEnabled) {
    if (state.searchSettings.source) items = items.filter(item => item.listId === state.searchSettings.source);
    if (state.searchSettings.family) items = items.filter(item => normalize(item.family) === normalize(state.searchSettings.family));
    if (state.searchSettings.color) items = items.filter(item => normalize(item.color) === normalize(state.searchSettings.color));
  }
  if (!tokens.length) return items.slice(0, 100);

  return items
    .filter(item => tokens.every(t => item.searchText.includes(t)))
    .map((item, originalIndex) => {
      const article = normalize(item.article);
      const model = normalize(item.model);
      let score = 0;
      if (article === q) score += 1000;
      else if (article.startsWith(q)) score += 700;
      else if (article.includes(q)) score += 450;
      if (model === q) score += 850;
      else if (model.startsWith(q)) score += 600;
      else if (model.includes(q)) score += 350;
      score += tokens.reduce((sum, token) => sum + (article.startsWith(token) ? 35 : 0) + (model.startsWith(token) ? 25 : 0), 0);
      return { item, score, originalIndex };
    })
    .sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex)
    .map(x => x.item);
}

function renderResults() {
  if (!state.priceLists.length) return;
  const matches = getSearchMatches();
  const limited = matches.slice(0, 300);
  resultCount.textContent = `${matches.length} Treffer${matches.length > limited.length ? ` · ${limited.length} angezeigt` : ''}`;

  if (!limited.length) {
    resultsBody.innerHTML = '<tr><td colspan="10" class="empty">Keine passenden Artikel gefunden.</td></tr>';
    return;
  }

  resultsBody.innerHTML = limited.map(item => {
    const selected = state.offer.some(o => o.uid === item.uid);
    const image = getItemImage(item);
    return `<tr>
      <td><input class="result-check" type="checkbox" data-offer-uid="${escapeAttr(item.uid)}" ${selected ? 'checked' : ''} /></td>
      <td class="image-cell">${renderProductImage(image, item, false)}</td>
      <td><span class="source-pill">${escapeHtml(shortFileName(item.source))}</span></td>
      <td>${escapeHtml(item.article)}</td>
      <td>${escapeHtml(item.model)}</td>
      <td>${renderRal(item.color)}</td>
      <td>${escapeHtml(item.family)}</td>
      <td class="num">${formatNumber(item.listPrice)}</td>
      <td class="num">${formatPercent(item.priceListDiscount)}</td>
      <td class="num">${formatNumber(item.netPrice)}</td>
    </tr>`;
  }).join('');
}

function quickAddTopResult() {
  const matches = getSearchMatches();
  if (!normalize(searchInput.value)) return;
  const item = matches[0];
  if (!item) {
    resultCount.textContent = 'Kein Treffer';
    return;
  }

  const existing = state.offer.find(o => o.uid === item.uid);
  if (existing) existing.qty += 1;
  else state.offer.push({ ...item, qty: 1, extraDiscount: 0 });

  searchInput.value = '';
  renderOffer();
  renderResults();
  autoSaveDraft();
  searchInput.focus();
}

function toggleOffer(uid, checked) {
  const item = allSearchItems().find(x => x.uid === uid);
  if (!item) return;

  if (checked) {
    if (!state.offer.some(o => o.uid === uid)) state.offer.push({ ...item, qty: 1, extraDiscount: 0 });
  } else {
    state.offer = state.offer.filter(o => o.uid !== uid);
  }
  renderOffer();
  autoSaveDraft();
}

function renderOffer() {
  if (!state.offer.length) {
    offerBody.innerHTML = '<tr><td colspan="13" class="empty">Noch keine Positionen ausgewählt.</td></tr>';
    grandTotal.textContent = money(0);
    return;
  }

  offerBody.innerHTML = state.offer.map((item, idx) => {
    const finalUnitPrice = item.netPrice * (1 - item.extraDiscount / 100);
    const total = finalUnitPrice * item.qty;
    const image = getItemImage(item);

    return `<tr>
      <td>${idx + 1}</td>
      <td class="image-cell">${renderProductImage(image, item, true)}</td>
      <td>${escapeHtml(item.article)}</td>
      <td>${escapeHtml(item.model)}</td>
      <td>${renderRal(item.color)}</td>
      <td><input class="small-input qty-input" type="number" min="1" step="1" value="${item.qty}" data-offer-uid="${escapeAttr(item.uid)}" data-offer-field="qty" /></td>
      <td class="num">${formatNumber(item.listPrice)}</td>
      <td class="num">${formatPercent(item.priceListDiscount)}</td>
      <td class="num">${formatNumber(item.netPrice)}</td>
      <td><input class="small-input" type="number" min="0" max="100" step="0.1" value="${item.extraDiscount}" data-offer-uid="${escapeAttr(item.uid)}" data-offer-field="extraDiscount" /></td>
      <td class="num">${formatNumber(finalUnitPrice)}</td>
      <td class="num">${formatNumber(total)}</td>
      <td><button class="remove-btn" data-remove-offer="${escapeAttr(item.uid)}">Entfernen</button></td>
    </tr>`;
  }).join('');

  const total = state.offer.reduce((sum, item) => sum + item.netPrice * (1 - item.extraDiscount / 100) * item.qty, 0);
  grandTotal.textContent = money(total);
}

function updateOffer(uid, field, value) {
  const item = state.offer.find(x => x.uid === uid);
  if (!item) return;
  if (field === 'qty') item.qty = Math.max(1, Math.round(Number(value) || 1));
  if (field === 'extraDiscount') item.extraDiscount = Math.min(100, Math.max(0, Number(value) || 0));
  renderOffer();
  autoSaveDraft();
}

function removeOffer(uid) {
  state.offer = state.offer.filter(o => o.uid !== uid);
  renderOffer();
  renderResults();
  autoSaveDraft();
}

function renderExportOptions() {
  if (!exportOptionsGrid) return;
  const order = [
    'position', 'article', 'model', 'color', 'family', 'qty', 'listPrice',
    'priceListDiscount', 'netPrice', 'extraDiscount', 'finalUnitPrice',
    'total', 'source'
  ];
  exportOptionsGrid.innerHTML = order.map(key => `
    <label class="export-option">
      <input type="checkbox" data-export-option="${key}" ${state.exportOptions[key] ? 'checked' : ''} />
      <span>${EXPORT_FIELD_LABELS[key]}</span>
    </label>
  `).join('');
}

function loadExportOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPORT_OPTIONS_KEY) || '{}');
    return { ...DEFAULT_EXPORT_OPTIONS, ...saved };
  } catch (err) {
    console.warn('Export-Optionen konnten nicht geladen werden.', err);
    return { ...DEFAULT_EXPORT_OPTIONS };
  }
}

function saveExportOptions() {
  try {
    localStorage.setItem(EXPORT_OPTIONS_KEY, JSON.stringify(state.exportOptions));
  } catch (err) {
    console.warn('Export-Optionen konnten nicht gespeichert werden.', err);
  }
}

function excelColumnName(index) {
  let n = index + 1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function getSelectedExportFields(currency) {
  const definitions = [
    { key: 'position', header: 'Pos.', width: 7 },
    { key: 'article', header: 'Artikelnummer', width: 24 },
    { key: 'model', header: 'Modell', width: 34 },
    { key: 'color', header: 'Farbe / RAL', width: 18 },
    { key: 'family', header: 'Family / Gruppe', width: 24 },
    { key: 'qty', header: 'Menge', width: 10 },
    { key: 'listPrice', header: `List Price ${currency}`, width: 18, numberFormat: '#,##0.00' },
    { key: 'priceListDiscount', header: 'Discount', width: 14, numberFormat: '0.00%' },
    { key: 'netPrice', header: `Net Price ${currency}`, width: 18, numberFormat: '#,##0.00' },
    { key: 'extraDiscount', header: 'Second Discount', width: 18, numberFormat: '0.00%' },
    { key: 'finalUnitPrice', header: `Angebot/Stk. ${currency}`, width: 20, numberFormat: '#,##0.00' },
    { key: 'total', header: `Gesamt ${currency}`, width: 18, numberFormat: '#,##0.00' },
    { key: 'source', header: 'Preisliste / Quelle', width: 24 }
  ];
  return definitions.filter(field => state.exportOptions[field.key]);
}

function buildFinalUnitFormula(item, rowNum, colByKey) {
  let baseExpr;
  if (colByKey.netPrice) {
    baseExpr = `${colByKey.netPrice}${rowNum}`;
  } else if (colByKey.listPrice) {
    const discountExpr = colByKey.priceListDiscount
      ? `${colByKey.priceListDiscount}${rowNum}`
      : String(item.priceListDiscount / 100);
    baseExpr = `${colByKey.listPrice}${rowNum}*(1-${discountExpr})`;
  } else {
    baseExpr = String(round2(item.netPrice));
  }

  const extraExpr = colByKey.extraDiscount
    ? `${colByKey.extraDiscount}${rowNum}`
    : String(item.extraDiscount / 100);
  return `(${baseExpr})*(1-${extraExpr})`;
}

function exportOffer() {
  if (!state.offer.length) {
    alert('Bitte zuerst mindestens eine Position auswählen.');
    return;
  }

  const customer = el('customerName').value.trim();
  const offerNo = el('offerNumber').value.trim();
  const currency = el('currency').value;
  const fields = getSelectedExportFields(currency);
  if (!fields.length) {
    alert('Bitte in den Optionen mindestens eine Spalte für die Excel-Übertragung aktivieren.');
    return;
  }

  const today = new Date();
  const selectedDate = el('offerDate').value ? new Date(`${el('offerDate').value}T12:00:00`) : today;
  const dateText = selectedDate.toLocaleDateString('de-DE');
  const headerRow = 8;
  const firstDataRow = 9;
  const lastDataRow = firstDataRow + state.offer.length - 1;
  const totalRow = lastDataRow + 2;
  const dataColumnCount = fields.length;
  const sheetColumnCount = Math.max(dataColumnCount, 4);
  const lastSheetCol = excelColumnName(sheetColumnCount - 1);
  const lastDataCol = excelColumnName(dataColumnCount - 1);
  const colByKey = Object.fromEntries(fields.map((field, idx) => [field.key, excelColumnName(idx)]));

  const metaRightLabelIndex = Math.max(2, sheetColumnCount - 2);
  const metaRightValueIndex = metaRightLabelIndex + 1;
  const metaRow3 = Array(sheetColumnCount).fill('');
  const metaRow4 = Array(sheetColumnCount).fill('');
  metaRow3[0] = 'Kunde';
  metaRow3[1] = customer;
  metaRow3[metaRightLabelIndex] = 'Angebotsnummer';
  metaRow3[metaRightValueIndex] = offerNo;
  metaRow4[0] = 'Datum';
  metaRow4[1] = dateText;
  metaRow4[metaRightLabelIndex] = 'Währung';
  metaRow4[metaRightValueIndex] = currency;

  const aoa = [
    ['ANGEBOT'],
    [],
    metaRow3,
    metaRow4,
    [],
    [],
    [],
    fields.map(field => field.header)
  ];

  state.offer.forEach((item, idx) => {
    const rowNum = firstDataRow + idx;
    const finalFormula = buildFinalUnitFormula(item, rowNum, colByKey);
    const row = fields.map(field => {
      switch (field.key) {
        case 'position': return idx + 1;
        case 'article': return item.article;
        case 'model': return item.model;
        case 'color': return item.color;
        case 'family': return item.family;
        case 'qty': return item.qty;
        case 'listPrice': return round2(item.listPrice);
        case 'priceListDiscount': return item.priceListDiscount / 100;
        case 'netPrice': return round2(item.netPrice);
        case 'extraDiscount': return item.extraDiscount / 100;
        case 'finalUnitPrice': return { f: finalFormula };
        case 'total': {
          const unitExpr = colByKey.finalUnitPrice ? `${colByKey.finalUnitPrice}${rowNum}` : `(${finalFormula})`;
          const qtyExpr = colByKey.qty ? `${colByKey.qty}${rowNum}` : String(item.qty);
          return { f: `${unitExpr}*${qtyExpr}` };
        }
        case 'source': return shortFileName(item.source);
        default: return '';
      }
    });
    aoa.push(row);
  });

  aoa.push([]);
  const totalFieldIndex = fields.findIndex(field => field.key === 'total');
  if (totalFieldIndex >= 0) {
    const summaryWidth = Math.max(dataColumnCount, totalFieldIndex === 0 ? 2 : dataColumnCount);
    const summaryRow = Array(summaryWidth).fill('');
    const labelIndex = totalFieldIndex > 0 ? totalFieldIndex - 1 : 0;
    const valueIndex = totalFieldIndex > 0 ? totalFieldIndex : 1;
    const totalCol = colByKey.total;
    summaryRow[labelIndex] = 'GESAMTSUMME';
    summaryRow[valueIndex] = { f: `SUM(${totalCol}${firstDataRow}:${totalCol}${lastDataRow})` };
    aoa.push(summaryRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [XLSX.utils.decode_range(`A1:${lastSheetCol}1`)];
  ws['!cols'] = Array.from({ length: sheetColumnCount }, (_, idx) => ({
    wch: fields[idx]?.width || 18
  }));
  ws['!freeze'] = { xSplit: 0, ySplit: 8 };
  ws['!autofilter'] = { ref: `A${headerRow}:${lastDataCol}${lastDataRow}` };

  const titleStyle = {
    font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '17365D' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F4E78' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: borderStyle()
  };
  const bodyStyle = { border: borderStyle(), alignment: { vertical: 'center' } };
  const totalStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: 'D9EAF7' } },
    border: borderStyle()
  };

  for (let c = 0; c < sheetColumnCount; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = titleStyle;
  }
  for (let c = 0; c < dataColumnCount; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: headerRow - 1, c })];
    if (cell) cell.s = headerStyle;
  }

  for (let r = firstDataRow - 1; r <= lastDataRow - 1; r++) {
    fields.forEach((field, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = { ...bodyStyle };
      if (field.numberFormat) ws[addr].z = field.numberFormat;
    });
  }

  if (colByKey.color) {
    const colorColIndex = XLSX.utils.decode_col(colByKey.color);
    state.offer.forEach((item, idx) => {
      const hex = ralPrimaryHex(item.color);
      if (!hex) return;
      const addr = XLSX.utils.encode_cell({ r: firstDataRow - 1 + idx, c: colorColIndex });
      if (!ws[addr]) return;
      ws[addr].s = {
        ...bodyStyle,
        fill: { fgColor: { rgb: hex.replace('#', '').toUpperCase() } },
        font: { color: { rgb: isDarkHex(hex) ? 'FFFFFF' : '111827' }, bold: true }
      };
    });
  }

  if (totalFieldIndex >= 0) {
    const valueColIndex = totalFieldIndex > 0 ? totalFieldIndex : 1;
    const labelColIndex = totalFieldIndex > 0 ? totalFieldIndex - 1 : 0;
    for (const c of [labelColIndex, valueColIndex]) {
      const addr = XLSX.utils.encode_cell({ r: totalRow - 1, c });
      if (ws[addr]) ws[addr].s = totalStyle;
    }
    const valueAddr = XLSX.utils.encode_cell({ r: totalRow - 1, c: valueColIndex });
    if (ws[valueAddr]) ws[valueAddr].z = '#,##0.00';
  }

  const rightLabelCol = excelColumnName(metaRightLabelIndex);
  [`A3`, `A4`, `${rightLabelCol}3`, `${rightLabelCol}4`].forEach(addr => {
    if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: '44546A' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Angebot');
  wb.Props = {
    Title: offerNo ? `Angebot ${offerNo}` : 'Angebot',
    Subject: customer ? `Angebot für ${customer}` : 'Angebot',
    Author: 'Preislisten-Analyzer',
    CreatedDate: today
  };

  const safeCustomer = customer ? `_${safeFile(customer)}` : '';
  const safeNo = offerNo ? `_${safeFile(offerNo)}` : '';
  XLSX.writeFile(wb, `Angebot${safeCustomer}${safeNo}.xlsx`);
}


function initializeOfferMeta() {
  if (!el('offerDate').value) el('offerDate').value = localDateInputValue(new Date());
}

function applyQuantityToAll() {
  if (!state.offer.length) return;
  const qty = Math.max(1, Math.round(Number(el('bulkQty').value) || 1));
  state.offer.forEach(item => { item.qty = qty; });
  renderOffer();
  autoSaveDraft();
}

function applyDiscountToAll() {
  if (!state.offer.length) return;
  const discount = clampPercent(Number(el('bulkDiscount').value) || 0);
  state.offer.forEach(item => { item.extraDiscount = discount; });
  renderOffer();
  autoSaveDraft();
}

function generateOfferNumber() {
  const date = el('offerDate').value || localDateInputValue(new Date());
  const compact = date.replace(/-/g, '');
  let data = {};
  try { data = JSON.parse(localStorage.getItem(OFFER_SEQUENCE_KEY) || '{}'); } catch (_) {}
  const next = data.date === date ? (Number(data.seq) || 0) + 1 : 1;
  localStorage.setItem(OFFER_SEQUENCE_KEY, JSON.stringify({ date, seq: next }));
  return `AN-${compact}-${String(next).padStart(3, '0')}`;
}

function getDraftPayload() {
  return {
    savedAt: new Date().toISOString(),
    customer: el('customerName').value.trim(),
    offerNumber: el('offerNumber').value.trim(),
    offerDate: el('offerDate').value,
    currency: el('currency').value,
    offer: state.offer.map(item => ({ ...item }))
  };
}

function saveDraft(showMessage = false) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getDraftPayload()));
    updateDraftStatus();
    if (showMessage) draftStatus.textContent = 'Entwurf gespeichert';
  } catch (err) {
    console.warn('Entwurf konnte nicht gespeichert werden.', err);
    if (showMessage) alert('Der Entwurf konnte im Browser nicht gespeichert werden.');
  }
}

function autoSaveDraft() {
  saveDraft(false);
}

function loadDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { draft = null; }
  if (!draft) {
    alert('Es ist noch kein gespeicherter Angebotsentwurf vorhanden.');
    return;
  }
  state.offer = Array.isArray(draft.offer) ? draft.offer.map(item => {
    const current = allSearchItems().find(candidate => candidate.uid === item.uid);
    return current ? { ...current, ...item, color: item.color || current.color, imageId: item.imageId || current.imageId } : { ...item };
  }) : [];
  el('customerName').value = draft.customer || '';
  el('offerNumber').value = draft.offerNumber || '';
  el('offerDate').value = draft.offerDate || localDateInputValue(new Date());
  if (draft.currency && Array.from(el('currency').options).some(o => o.value === draft.currency)) el('currency').value = draft.currency;
  renderOffer();
  renderResults();
  updateDraftStatus();
}

function newOffer() {
  const hasContent = state.offer.length || el('customerName').value.trim() || el('offerNumber').value.trim();
  if (hasContent && !confirm('Aktuelles Angebot leeren und ein neues Angebot beginnen?')) return;
  state.offer = [];
  el('customerName').value = '';
  el('offerDate').value = localDateInputValue(new Date());
  el('offerNumber').value = generateOfferNumber();
  renderOffer();
  renderResults();
  autoSaveDraft();
  searchInput.focus();
}

function updateDraftStatus() {
  if (!draftStatus) return;
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { draft = null; }
  if (!draft?.savedAt) {
    draftStatus.textContent = 'Noch kein Entwurf gespeichert';
    return;
  }
  const saved = new Date(draft.savedAt);
  const time = saved.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const count = Array.isArray(draft.offer) ? draft.offer.length : 0;
  draftStatus.textContent = `Automatisch gespeichert · ${time} · ${count} Pos.`;
}

function localDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function borderStyle() {
  return {
    top: { style: 'thin', color: { rgb: 'D9E2F3' } },
    bottom: { style: 'thin', color: { rgb: 'D9E2F3' } },
    left: { style: 'thin', color: { rgb: 'D9E2F3' } },
    right: { style: 'thin', color: { rgb: 'D9E2F3' } }
  };
}


function loadSearchSettings() {
  const defaults = { filtersEnabled: true, source: '', family: '', color: '' };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SEARCH_SETTINGS_KEY) || '{}') };
  } catch (_) {
    return defaults;
  }
}

function saveSearchSettings() {
  try { localStorage.setItem(SEARCH_SETTINGS_KEY, JSON.stringify(state.searchSettings)); } catch (_) {}
}

function renderFilters() {
  if (!filterPanel) return;
  filtersEnabledToggle.checked = state.searchSettings.filtersEnabled !== false;
  filterPanel.classList.toggle('filters-off', !filtersEnabledToggle.checked);

  const enabledLists = state.priceLists.filter(list => list.enabled);
  const sourceOptions = enabledLists.map(list => ({ value: list.id, label: shortFileName(list.fileName) }));
  sourceFilter.dataset.settingKey = 'source';
  familyFilter.dataset.settingKey = 'family';
  colorFilter.dataset.settingKey = 'color';
  fillFilterSelect(sourceFilter, sourceOptions, 'Alle Preislisten', state.searchSettings.source);

  const baseItems = allSearchItems().filter(item => !state.searchSettings.source || item.listId === state.searchSettings.source);
  const families = uniqueSorted(baseItems.map(item => item.family).filter(Boolean)).map(v => ({ value: v, label: v }));
  const colors = uniqueSorted(baseItems.map(item => item.color).filter(Boolean)).map(v => ({ value: v, label: v }));
  fillFilterSelect(familyFilter, families, 'Alle Families', state.searchSettings.family);
  fillFilterSelect(colorFilter, colors, 'Alle Farben', state.searchSettings.color);

}

function fillFilterSelect(select, options, emptyLabel, currentValue) {
  const valid = options.some(option => option.value === currentValue);
  if (currentValue && !valid) {
    const key = select.dataset.settingKey;
    if (key) state.searchSettings[key] = '';
    currentValue = '';
  }
  select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>` + options.map(option =>
    `<option value="${escapeAttr(option.value)}">${escapeHtml(option.label)}</option>`
  ).join('');
  select.value = currentValue || '';
}

function clearFilters() {
  state.searchSettings.source = '';
  state.searchSettings.family = '';
  state.searchSettings.color = '';
  saveSearchSettings();
  renderFilters();
  renderResults();
}

function uniqueSorted(values) {
  return Array.from(new Set(values.map(v => String(v).trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'de', { numeric: true, sensitivity: 'base' }));
}

function getItemImage(item) {
  if (!item?.imageId) return '';
  const list = state.priceLists.find(x => x.id === item.listId);
  return list?.images?.[item.imageId] || '';
}

function renderProductImage(src, item, compact) {
  if (!src) return `<span class="image-placeholder ${compact ? 'offer-placeholder' : ''}">kein Bild</span>`;
  const caption = [item.article, item.model].filter(Boolean).join(' · ');
  return `<img class="product-thumb ${compact ? 'offer-thumb' : ''}" loading="lazy" src="${escapeAttr(src)}" alt="${escapeAttr(caption || 'Produktbild')}" data-image-preview="1" data-image-caption="${escapeAttr(caption)}" />`;
}

function openImagePreview(src, caption) {
  if (!src || !imageDialog) return;
  imageDialogImg.src = src;
  imageDialogCaption.textContent = caption || 'Produktbild';
  imageDialog.showModal();
}

const RAL_HEX = {
  '1028': '#FF9B00',
  '3000': '#AF2B1E',
  '5013': '#193153',
  '5015': '#2874B2',
  '7004': '#969992',
  '7015': '#51565C',
  '7016': '#383E42',
  '7035': '#CBD0CC',
  '7040': '#9DA3A6',
  '9005': '#0A0A0D',
  '9006': '#A5A5A5',
  '9007': '#8F8F8C'
};

function ralCodes(text) {
  return Array.from(String(text || '').matchAll(/RAL\s*(\d{4})/gi), match => match[1]);
}

function ralPrimaryHex(text) {
  const code = ralCodes(text)[0];
  return code ? (RAL_HEX[code] || '') : '';
}

function renderRal(text) {
  const value = String(text || '').trim();
  if (!value) return '';
  const codes = ralCodes(value);
  const swatches = codes.map(code => {
    const hex = RAL_HEX[code];
    return hex ? `<span class="ral-swatch" style="background:${hex}" title="RAL ${code} · Bildschirm-Näherung"></span>` : '';
  }).join('');
  return `<span class="ral-display"><span class="ral-swatches">${swatches}</span><span class="ral-text">${escapeHtml(value)}</span></span>`;
}

function isDarkHex(hex) {
  const clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 145;
}

async function extractImagesForSheet(arrayBuffer, sheetName) {
  const empty = { images: {}, rowToImageId: {} };
  if (!arrayBuffer || typeof JSZip === 'undefined') return empty;
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const parser = new DOMParser();
    const readXml = async path => {
      const file = zip.file(path);
      if (!file) return null;
      return parser.parseFromString(await file.async('text'), 'application/xml');
    };

    const workbookDoc = await readXml('xl/workbook.xml');
    const workbookRelsDoc = await readXml('xl/_rels/workbook.xml.rels');
    if (!workbookDoc || !workbookRelsDoc) return empty;

    const sheetNode = Array.from(workbookDoc.getElementsByTagNameNS('*', 'sheet'))
      .find(node => node.getAttribute('name') === sheetName);
    if (!sheetNode) return empty;
    const sheetRelId = sheetNode.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || sheetNode.getAttribute('r:id');
    const workbookRel = Array.from(workbookRelsDoc.getElementsByTagNameNS('*', 'Relationship'))
      .find(node => node.getAttribute('Id') === sheetRelId);
    if (!workbookRel) return empty;
    const sheetPath = resolveZipPath('xl/workbook.xml', workbookRel.getAttribute('Target'));
    const sheetDoc = await readXml(sheetPath);
    if (!sheetDoc) return empty;

    const cellsWithRichValue = Array.from(sheetDoc.getElementsByTagNameNS('*', 'c'))
      .filter(cell => cell.hasAttribute('vm'));
    if (!cellsWithRichValue.length) return empty;

    const metadataDoc = await readXml('xl/metadata.xml');
    const richValuesDoc = await readXml('xl/richData/rdrichvalue.xml');
    const richValueRelDoc = await readXml('xl/richData/richValueRel.xml');
    const richValueRelsDoc = await readXml('xl/richData/_rels/richValueRel.xml.rels');
    if (!metadataDoc || !richValuesDoc || !richValueRelDoc || !richValueRelsDoc) return empty;

    const futureMetadata = Array.from(metadataDoc.getElementsByTagNameNS('*', 'futureMetadata'))
      .find(node => node.getAttribute('name') === 'XLRICHVALUE');
    if (!futureMetadata) return empty;
    const metadataBlocks = Array.from(futureMetadata.getElementsByTagNameNS('*', 'bk'));
    const richValues = Array.from(richValuesDoc.getElementsByTagNameNS('*', 'rv'));
    const richRelations = Array.from(richValueRelDoc.getElementsByTagNameNS('*', 'rel'));
    const relTargetById = Object.fromEntries(Array.from(richValueRelsDoc.getElementsByTagNameNS('*', 'Relationship'))
      .map(node => [node.getAttribute('Id'), node.getAttribute('Target')]));

    const images = {};
    const rowToImageId = {};
    const imageCacheByPath = {};

    for (const cell of cellsWithRichValue) {
      const address = cell.getAttribute('r') || '';
      const rowMatch = address.match(/(\d+)$/);
      const vm = Number(cell.getAttribute('vm'));
      if (!rowMatch || !vm || !metadataBlocks[vm - 1]) continue;

      const rvb = metadataBlocks[vm - 1].getElementsByTagNameNS('*', 'rvb')[0];
      const richIndex = Number(rvb?.getAttribute('i'));
      const richValue = richValues[richIndex];
      if (!richValue) continue;
      const values = Array.from(richValue.getElementsByTagNameNS('*', 'v'));
      const localImageIndex = Number(values[0]?.textContent);
      const relation = richRelations[localImageIndex];
      if (!relation) continue;
      const relationId = relation.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || relation.getAttribute('r:id');
      const target = relTargetById[relationId];
      if (!target) continue;
      const mediaPath = resolveZipPath('xl/richData/richValueRel.xml', target);
      const mediaFile = zip.file(mediaPath);
      if (!mediaFile) continue;

      let dataUrl = imageCacheByPath[mediaPath];
      if (!dataUrl) {
        const ext = mediaPath.split('.').pop().toLowerCase();
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png';
        dataUrl = `data:${mime};base64,${await mediaFile.async('base64')}`;
        imageCacheByPath[mediaPath] = dataUrl;
      }
      const imageId = mediaPath;
      images[imageId] = dataUrl;
      rowToImageId[Number(rowMatch[1])] = imageId;
    }
    return { images, rowToImageId };
  } catch (err) {
    console.warn('Produktbilder konnten aus dieser Datei nicht gelesen werden.', err);
    return empty;
  }
}

function resolveZipPath(baseFile, target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.replace(/^\/+/, '');
  const parts = baseFile.split('/');
  parts.pop();
  for (const segment of target.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

async function clearAllLists() {
  if (!state.priceLists.length) return;
  if (!confirm('Alle lokal gespeicherten Preislisten löschen?')) return;
  await clearPriceListStore();
  state.priceLists = [];
  state.activeListId = null;
  state.offer = [];
  fileInfo.textContent = 'Alle gespeicherten Preislisten wurden gelöscht.';
  refreshAll();
}

function makeListId(file) {
  return `${file.name}__${file.size}__${file.lastModified}`;
}

function serializeList(list) {
  const { workbook, sourceData, ...plain } = list;
  return plain;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllPriceLists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function savePriceList(list) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(serializeList(list));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error(err);
    alert('Die Preisliste konnte nicht dauerhaft im Browser gespeichert werden. Möglicherweise ist der lokale Speicher voll.');
  }
}

async function deletePriceList(id) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function clearPriceListStore() {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function parsePrice(value) {
  if (typeof value === 'number') return value;
  let s = String(value ?? '').trim();
  if (!s) return 0;
  s = s.replace(/[^0-9,.-]/g, '');
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma !== -1) s = s.replace(/,/g, '');
  else if (lastComma !== -1) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDiscount(value) {
  if (typeof value === 'number') return clampPercent(Math.abs(value) <= 1 ? value * 100 : value);
  const original = String(value ?? '').trim();
  if (!original) return 0;
  const hasPercentSign = original.includes('%');
  const n = parsePrice(original);
  if (!Number.isFinite(n)) return 0;
  return clampPercent(!hasPercentSign && Math.abs(n) <= 1 ? n * 100 : n);
}

function clampPercent(n) {
  return Math.min(100, Math.max(0, Number(n) || 0));
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_./]+/g, ' ')
    .trim();
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatPercent(n) {
  return `${Number(n || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
}
function money(n) { return `${formatNumber(n)} ${el('currency').value}`; }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function safeFile(s) { return s.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 60); }
function shortFileName(s) { return String(s || '').replace(/\.(xlsx|xls|csv)$/i, ''); }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
