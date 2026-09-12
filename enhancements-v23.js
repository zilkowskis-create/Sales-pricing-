(() => {
  'use strict';

  const descriptionCandidates = [
    'description', 'long description', 'product description', 'item description',
    'beschreibung', 'langbeschreibung', 'long text', 'text'
  ];

  const normal = value => String(value ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_./]+/g, ' ')
    .trim();

  function findDescriptionHeader(list) {
    if (!list) return '';
    if (list.mapping?.description && list.headers?.includes(list.mapping.description)) return list.mapping.description;
    const headers = list.headers || [];
    for (const candidate of descriptionCandidates) {
      const exact = headers.find(h => normal(h) === normal(candidate));
      if (exact) return exact;
    }
    for (const candidate of descriptionCandidates) {
      const partial = headers.find(h => normal(h).includes(normal(candidate)));
      if (partial) return partial;
    }
    return '';
  }

  function descriptionForItem(item) {
    if (!item || typeof state === 'undefined') return '';
    const list = state.priceLists.find(x => x.id === item.listId);
    if (!list) return '';
    const header = findDescriptionHeader(list);
    if (!header) return '';
    return String(list.rawRows?.[item.rowIndex]?.[header] ?? '').trim();
  }

  function itemByUid(uid) {
    if (!uid || typeof state === 'undefined') return null;
    for (const list of state.priceLists || []) {
      const item = (list.items || []).find(x => x.uid === uid);
      if (item) return item;
    }
    return (state.offer || []).find(x => x.uid === uid) || null;
  }

  function infoCell(item) {
    const td = document.createElement('td');
    td.className = 'description-info-cell v23-added-info';
    const description = descriptionForItem(item);
    if (!description) {
      td.innerHTML = '<span class="info-icon info-icon-empty" aria-label="No description">i</span>';
      return td;
    }
    td.innerHTML = `
      <span class="description-tooltip" tabindex="0">
        <span class="info-icon" aria-label="Show description">i</span>
        <span class="description-tooltip-content"></span>
      </span>`;
    td.querySelector('.description-tooltip-content').textContent = description;
    return td;
  }

  function decorateResultRows() {
    const body = document.getElementById('resultsBody');
    if (!body) return;
    for (const row of body.querySelectorAll('tr')) {
      if (row.querySelector('.v23-added-info')) continue;
      const checkbox = row.querySelector('[data-offer-uid]');
      if (!checkbox) continue;
      const item = itemByUid(checkbox.dataset.offerUid);
      const cells = row.children;
      if (cells.length < 5) continue;
      const td = infoCell(item);
      cells[4].insertAdjacentElement('afterend', td);
    }
  }

  function setupDescriptionMapping() {
    const select = document.getElementById('descriptionCol');
    if (!select || typeof state === 'undefined') return;
    const list = state.priceLists.find(x => x.id === state.activeListId);
    if (!list) return;
    const current = list.mapping?.description || findDescriptionHeader(list);
    const existingValues = new Set(Array.from(select.options).map(o => o.value));
    if (!existingValues.size || (list.headers || []).some(h => !existingValues.has(h))) {
      select.innerHTML = '<option value="">— do not use —</option>' + (list.headers || [])
        .map(h => `<option value="${escapeHtmlV23(h)}">${escapeHtmlV23(h)}</option>`).join('');
    }
    select.value = current || '';
  }

  function saveDescriptionMapping() {
    const select = document.getElementById('descriptionCol');
    if (!select || typeof state === 'undefined') return;
    const list = state.priceLists.find(x => x.id === state.activeListId);
    if (!list) return;
    list.mapping = { ...(list.mapping || {}), description: select.value || '' };
    if (typeof savePriceList === 'function') savePriceList(list);
  }

  function escapeHtmlV23(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[c]));
  }

  function decorateOfferRows() {
    const body = document.getElementById('offerBody');
    if (!body || typeof state === 'undefined') return;
    const rows = Array.from(body.querySelectorAll('tr'));
    for (const row of rows) {
      const input = row.querySelector('[data-offer-uid]');
      const remove = row.querySelector('[data-remove-offer]');
      const uid = input?.dataset.offerUid || remove?.dataset.removeOffer;
      if (!uid || !row.children.length) continue;
      row.draggable = true;
      row.dataset.offerRow = uid;
      row.classList.add('reorderable-offer-row');

      const index = state.offer.findIndex(x => x.uid === uid);
      const firstCell = row.children[0];
      if (!firstCell || firstCell.querySelector('.drag-handle-v23')) continue;
      firstCell.classList.add('offer-position-cell-v23');
      firstCell.innerHTML = `
        <span class="drag-handle-v23" title="Drag to change position" aria-label="Drag to change position">⋮⋮</span>
        <strong class="position-number-v23">${index + 1}</strong>
        <span class="position-buttons-v23">
          <button type="button" class="position-btn-v23" data-move-v23="${escapeHtmlV23(uid)}" data-direction-v23="up" title="Move up" ${index <= 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="position-btn-v23" data-move-v23="${escapeHtmlV23(uid)}" data-direction-v23="down" title="Move down" ${index >= state.offer.length - 1 ? 'disabled' : ''}>↓</button>
        </span>`;
    }
  }

  function moveOfferV23(uid, direction) {
    if (typeof state === 'undefined') return;
    const index = state.offer.findIndex(x => x.uid === uid);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= state.offer.length) return;
    const [item] = state.offer.splice(index, 1);
    state.offer.splice(target, 0, item);
    if (typeof renderOffer === 'function') renderOffer();
    if (typeof autoSaveDraft === 'function') autoSaveDraft();
  }

  function reorderOfferV23(draggedUid, targetUid) {
    if (typeof state === 'undefined' || !draggedUid || !targetUid || draggedUid === targetUid) return;
    const from = state.offer.findIndex(x => x.uid === draggedUid);
    const to = state.offer.findIndex(x => x.uid === targetUid);
    if (from < 0 || to < 0) return;
    const [item] = state.offer.splice(from, 1);
    const insertAt = from < to ? to - 1 : to;
    state.offer.splice(insertAt, 0, item);
    if (typeof renderOffer === 'function') renderOffer();
    if (typeof autoSaveDraft === 'function') autoSaveDraft();
  }

  function installReorderEvents() {
    const body = document.getElementById('offerBody');
    if (!body || body.dataset.reorderV23 === '1') return;
    body.dataset.reorderV23 = '1';

    body.addEventListener('click', event => {
      const btn = event.target.closest('[data-move-v23]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      moveOfferV23(btn.dataset.moveV23, btn.dataset.directionV23);
    });

    body.addEventListener('dragstart', event => {
      const row = event.target.closest('[data-offer-row]');
      if (!row) return;
      row.classList.add('dragging-v23');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.dataset.offerRow);
    });

    body.addEventListener('dragend', event => {
      event.target.closest('[data-offer-row]')?.classList.remove('dragging-v23');
      body.querySelectorAll('.drag-over-v23').forEach(el => el.classList.remove('drag-over-v23'));
    });

    body.addEventListener('dragover', event => {
      const row = event.target.closest('[data-offer-row]');
      if (!row) return;
      event.preventDefault();
      body.querySelectorAll('.drag-over-v23').forEach(el => el.classList.remove('drag-over-v23'));
      row.classList.add('drag-over-v23');
    });

    body.addEventListener('drop', event => {
      const row = event.target.closest('[data-offer-row]');
      if (!row) return;
      event.preventDefault();
      const draggedUid = event.dataTransfer.getData('text/plain');
      reorderOfferV23(draggedUid, row.dataset.offerRow);
      body.querySelectorAll('.drag-over-v23').forEach(el => el.classList.remove('drag-over-v23'));
    });
  }

  function installObservers() {
    const results = document.getElementById('resultsBody');
    const offer = document.getElementById('offerBody');
    if (results) new MutationObserver(decorateResultRows).observe(results, { childList: true, subtree: true });
    if (offer) new MutationObserver(decorateOfferRows).observe(offer, { childList: true, subtree: true });
  }

  function initV23() {
    setupDescriptionMapping();
    decorateResultRows();
    decorateOfferRows();
    installReorderEvents();
    installObservers();

    document.getElementById('priceListSelect')?.addEventListener('change', () => setTimeout(setupDescriptionMapping, 0));
    document.getElementById('sheetSelect')?.addEventListener('change', () => setTimeout(setupDescriptionMapping, 0));
    document.getElementById('applyMappingBtn')?.addEventListener('click', () => setTimeout(saveDescriptionMapping, 0));
    document.getElementById('sheetTogglePanel')?.addEventListener('click', () => setTimeout(setupDescriptionMapping, 0));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(initV23, 0));
  else setTimeout(initV23, 0);
})();
