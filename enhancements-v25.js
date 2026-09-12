(() => {
  'use strict';

  const KEY = 'preislistenAnalyzerDraftLibraryV25';
  let activeDraftId = null;

  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const uid = () => 'draft-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

  function readDrafts() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function writeDrafts(drafts) {
    localStorage.setItem(KEY, JSON.stringify(drafts));
  }

  function snapshot(name) {
    return {
      id: uid(),
      name: name || 'Untitled draft',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      customerName: $('customerName')?.value || '',
      offerNumber: $('offerNumber')?.value || '',
      offerDate: $('offerDate')?.value || '',
      currency: $('currency')?.value || 'EUR',
      offer: typeof state !== 'undefined' ? JSON.parse(JSON.stringify(state.offer || [])) : [],
      exportOptions: typeof state !== 'undefined' ? { ...(state.exportOptions || {}) } : {}
    };
  }

  function applyDraft(draft) {
    if (!draft || typeof state === 'undefined') return;
    state.offer = JSON.parse(JSON.stringify(draft.offer || []));
    state.exportOptions = { ...(draft.exportOptions || state.exportOptions || {}) };
    if ($('customerName')) $('customerName').value = draft.customerName || '';
    if ($('offerNumber')) $('offerNumber').value = draft.offerNumber || '';
    if ($('offerDate')) $('offerDate').value = draft.offerDate || '';
    if ($('currency')) $('currency').value = draft.currency || 'EUR';
    if (typeof saveExportOptions === 'function') saveExportOptions();
    if (typeof renderExportOptions === 'function') renderExportOptions();
    if (typeof renderOffer === 'function') renderOffer();
    if (typeof renderResults === 'function') renderResults();
    if (typeof autoSaveDraft === 'function') autoSaveDraft();
    activeDraftId = draft.id;
    renderLibrary(`Loaded “${draft.name}”`);
  }

  function saveNewDraft() {
    const suggested = $('customerName')?.value || $('offerNumber')?.value || 'New quotation';
    const name = prompt('Draft name', suggested);
    if (!name) return;
    const drafts = readDrafts();
    const draft = snapshot(name.trim());
    drafts.unshift(draft);
    writeDrafts(drafts);
    activeDraftId = draft.id;
    renderLibrary(`Saved “${draft.name}”`);
  }

  function updateActiveDraft() {
    if (!activeDraftId) return saveNewDraft();
    const drafts = readDrafts();
    const index = drafts.findIndex(d => d.id === activeDraftId);
    if (index < 0) return saveNewDraft();
    const old = drafts[index];
    const fresh = snapshot(old.name);
    fresh.id = old.id;
    fresh.createdAt = old.createdAt;
    drafts[index] = fresh;
    writeDrafts(drafts);
    renderLibrary(`Updated “${fresh.name}”`);
  }

  function renameDraft(id) {
    const drafts = readDrafts();
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    const name = prompt('Rename draft', draft.name);
    if (!name) return;
    draft.name = name.trim();
    draft.updatedAt = nowIso();
    writeDrafts(drafts);
    renderLibrary();
  }

  function duplicateDraft(id) {
    const drafts = readDrafts();
    const source = drafts.find(d => d.id === id);
    if (!source) return;
    const copy = JSON.parse(JSON.stringify(source));
    copy.id = uid();
    copy.name = `${source.name} copy`;
    copy.createdAt = nowIso();
    copy.updatedAt = nowIso();
    drafts.unshift(copy);
    writeDrafts(drafts);
    renderLibrary(`Duplicated “${source.name}”`);
  }

  function deleteDraft(id) {
    const drafts = readDrafts();
    const draft = drafts.find(d => d.id === id);
    if (!draft) return;
    if (!confirm(`Delete draft “${draft.name}”?`)) return;
    writeDrafts(drafts.filter(d => d.id !== id));
    if (activeDraftId === id) activeDraftId = null;
    renderLibrary('Draft deleted');
  }

  function fmtMoney(value, currency) {
    try { return new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'EUR',maximumFractionDigits:2}).format(Number(value)||0); }
    catch { return `${Number(value||0).toFixed(2)} ${currency||'EUR'}`; }
  }

  function totalOf(draft) {
    return (draft.offer || []).reduce((sum, item) => {
      const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
      const net = Number(item.netPrice ?? item.finalUnitPrice ?? 0) || 0;
      const disc = Number(item.extraDiscount ?? item.secondDiscount ?? 0) || 0;
      const unit = item.finalUnitPrice != null ? Number(item.finalUnitPrice) : net * (1 - disc / 100);
      return sum + unit * qty;
    }, 0);
  }

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));
  }

  function renderLibrary(status='') {
    const list = $('draftListV25');
    const statusEl = $('draftLibraryStatusV25');
    if (!list) return;
    const drafts = readDrafts();
    if (statusEl) statusEl.textContent = status || `${drafts.length} saved draft${drafts.length === 1 ? '' : 's'}`;
    if (!drafts.length) {
      list.innerHTML = '<div class="draft-empty-v25">No saved drafts yet.</div>';
      return;
    }
    list.innerHTML = drafts.map(d => `
      <div class="draft-row-v25 ${d.id===activeDraftId?'draft-active-v25':''}" data-draft-row-v25="${esc(d.id)}">
        <div><strong>${esc(d.name)}</strong><div class="draft-meta-v25">${esc(d.customerName || 'No customer')}</div></div>
        <div><div>${esc(d.offerNumber || 'No quotation no.')}</div><div class="draft-meta-v25">${esc(d.offerDate || '')}</div></div>
        <div><strong>${(d.offer||[]).length} item${(d.offer||[]).length===1?'':'s'}</strong></div>
        <div><strong>${esc(fmtMoney(totalOf(d), d.currency))}</strong></div>
        <div class="draft-buttons-v25">
          <button class="draft-btn-v25 primary" data-draft-action-v25="load" data-draft-id-v25="${esc(d.id)}">Load</button>
          <button class="draft-btn-v25" data-draft-action-v25="rename" data-draft-id-v25="${esc(d.id)}">Rename</button>
          <button class="draft-btn-v25" data-draft-action-v25="duplicate" data-draft-id-v25="${esc(d.id)}">Duplicate</button>
          <button class="draft-btn-v25 danger" data-draft-action-v25="delete" data-draft-id-v25="${esc(d.id)}">Delete</button>
        </div>
      </div>`).join('');
  }

  function installUi() {
    const quick = document.querySelector('.quick-offer-panel');
    if (!quick || $('draftLibraryV25')) return;
    const box = document.createElement('div');
    box.id = 'draftLibraryV25';
    box.className = 'draft-library-v25';
    box.innerHTML = `
      <div class="draft-library-head-v25">
        <div><h3>Draft Library</h3><p class="muted">Save and reopen multiple quotations.</p></div>
        <div class="draft-library-actions-v25">
          <button id="saveNewDraftV25" class="secondary-btn" type="button">Save as new draft</button>
          <button id="updateDraftV25" class="mini-btn" type="button">Update current draft</button>
        </div>
      </div>
      <div id="draftLibraryStatusV25" class="draft-library-status-v25"></div>
      <div id="draftListV25" class="draft-list-v25"></div>`;
    quick.insertAdjacentElement('afterend', box);

    $('saveNewDraftV25')?.addEventListener('click', saveNewDraft);
    $('updateDraftV25')?.addEventListener('click', updateActiveDraft);
    box.addEventListener('click', e => {
      const btn = e.target.closest('[data-draft-action-v25]');
      if (!btn) return;
      const id = btn.dataset.draftIdV25;
      const action = btn.dataset.draftActionV25;
      const drafts = readDrafts();
      const draft = drafts.find(d => d.id === id);
      if (action === 'load') applyDraft(draft);
      if (action === 'rename') renameDraft(id);
      if (action === 'duplicate') duplicateDraft(id);
      if (action === 'delete') deleteDraft(id);
    });

    const oldSave = $('saveDraftBtn');
    const oldLoad = $('loadDraftBtn');
    if (oldSave) { oldSave.textContent = 'Save as new draft'; oldSave.onclick = null; oldSave.addEventListener('click', e => { e.stopImmediatePropagation(); saveNewDraft(); }, true); }
    if (oldLoad) { oldLoad.textContent = 'Open Draft Library'; oldLoad.onclick = null; oldLoad.addEventListener('click', e => { e.stopImmediatePropagation(); box.scrollIntoView({behavior:'smooth',block:'center'}); }, true); }

    renderLibrary();
  }

  function init() {
    installUi();
    setTimeout(renderLibrary, 200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
