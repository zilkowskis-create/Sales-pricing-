(() => {
  'use strict';

  const VIEW_KEY = 'salesPricingV27View';
  const PRICE_COLLAPSE_KEY = 'salesPricingV27PriceListsCollapsed';
  const FILTER_COLLAPSE_KEY = 'salesPricingV27FiltersCollapsed';
  const EXPORT_COLLAPSE_KEY = 'salesPricingV27ExportCollapsed';
  let dirty = false;

  const $ = id => document.getElementById(id);
  const moneyText = value => {
    const currency = $('currency')?.value || 'EUR';
    try { return new Intl.NumberFormat('en-GB', { style:'currency', currency, maximumFractionDigits:2 }).format(Number(value)||0); }
    catch { return `${Number(value||0).toFixed(2)} ${currency}`; }
  };

  function currentTotal() {
    if (typeof state === 'undefined') return 0;
    return (state.offer || []).reduce((sum, item) => sum + Number(item.netPrice || 0) * (1 - Number(item.extraDiscount || 0) / 100) * Number(item.qty || 1), 0);
  }

  function installHeader() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const title = topbar.querySelector('h1');
    const sub = topbar.querySelector('p');
    const badge = topbar.querySelector('.badge');
    if (title) title.textContent = 'Sales Pricing';
    if (sub) sub.textContent = 'Quotation & Pricing Tool';
    if (badge) badge.textContent = 'V27 · Business UI';
    document.title = 'Sales Pricing · Quotation & Pricing Tool';

    if (document.querySelector('.v27-nav')) return;
    const nav = document.createElement('nav');
    nav.className = 'v27-nav';
    nav.innerHTML = `
      <div class="v27-nav-main">
        <button class="v27-nav-btn" data-v27-view="products">Products</button>
        <button class="v27-nav-btn" data-v27-view="quotation">Quotation <span id="v27NavQuoteCount" class="v27-nav-count">0</span></button>
        <button class="v27-nav-btn" data-v27-view="drafts">Drafts</button>
      </div>
      <div class="v27-nav-spacer"></div>
      <button class="v27-settings-btn" data-v27-view="settings">⚙ Settings</button>`;
    topbar.insertAdjacentElement('afterend', nav);
    nav.addEventListener('click', e => {
      const btn = e.target.closest('[data-v27-view]');
      if (!btn) return;
      setView(btn.dataset.v27View);
    });
  }

  function setView(view) {
    const allowed = ['products','quotation','drafts','settings'];
    if (!allowed.includes(view)) view = 'products';
    document.body.dataset.v27View = view;
    localStorage.setItem(VIEW_KEY, view);
    document.querySelectorAll('.v27-nav-btn,.v27-settings-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.v27View === view));
    if (view === 'settings') setPriceListsCollapsed(false);
    if (view === 'drafts') setTimeout(installDraftTools, 50);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function installPriceListManager() {
    const card = document.querySelector('.upload-card');
    const head = card?.querySelector('.compact-head');
    if (!card || !head || card.querySelector('.v27-manage-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'v27-manage-toggle';
    btn.addEventListener('click', () => setPriceListsCollapsed(!card.classList.contains('v27-collapsed')));
    head.appendChild(btn);
    const initial = localStorage.getItem(PRICE_COLLAPSE_KEY) !== 'false';
    setPriceListsCollapsed(initial);
  }

  function setPriceListsCollapsed(collapsed) {
    const card = document.querySelector('.upload-card');
    if (!card) return;
    card.classList.toggle('v27-collapsed', collapsed);
    localStorage.setItem(PRICE_COLLAPSE_KEY, collapsed ? 'true' : 'false');
    const btn = card.querySelector('.v27-manage-toggle');
    if (btn) btn.textContent = collapsed ? 'Manage' : 'Collapse';
  }

  function installSettingsPanel() {
    const card = $('mappingCard');
    if (card) card.classList.add('v27-settings-panel');
  }

  function filterCount() {
    if (typeof state === 'undefined') return 0;
    let n = 0;
    if (state.searchSettings?.family) n++;
    if (state.searchSettings?.color) n++;
    return n;
  }

  function installFilterToggle() {
    const headRow = $('searchCard')?.querySelector('.section-head .button-row');
    const panel = $('filterPanel');
    if (!headRow || !panel || $('v27FilterToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'v27FilterToggle';
    btn.type = 'button';
    btn.className = 'v27-filter-toggle';
    headRow.insertBefore(btn, headRow.firstChild);
    btn.addEventListener('click', () => {
      const collapsed = !panel.classList.contains('v27-collapsed');
      setFiltersCollapsed(collapsed);
    });
    setFiltersCollapsed(localStorage.getItem(FILTER_COLLAPSE_KEY) !== 'false');
  }

  function setFiltersCollapsed(collapsed) {
    const panel = $('filterPanel');
    const btn = $('v27FilterToggle');
    if (!panel || !btn) return;
    panel.classList.toggle('v27-collapsed', collapsed);
    localStorage.setItem(FILTER_COLLAPSE_KEY, collapsed ? 'true' : 'false');
    const n = filterCount();
    btn.textContent = `Filters (${n})`;
    btn.classList.toggle('active', n > 0 || !collapsed);
  }

  function fixProductTable() {
    const body = $('resultsBody');
    if (!body) return;
    body.querySelectorAll('tr').forEach(row => {
      const info = row.querySelector('.v23-added-info,.description-info-cell');
      if (info && row.children.length >= 5) {
        const modelCell = row.children[3];
        if (modelCell?.nextElementSibling !== info) modelCell.insertAdjacentElement('afterend', info);
      }
      const checkbox = row.querySelector('[data-offer-uid]');
      row.classList.toggle('v27-selected', Boolean(checkbox?.checked));
    });
  }

  function installResultObserver() {
    const body = $('resultsBody');
    if (!body || body.dataset.v27Observed) return;
    body.dataset.v27Observed = '1';
    new MutationObserver(() => { fixProductTable(); updateQuoteCounter(); }).observe(body, { childList:true, subtree:true });
    body.addEventListener('change', () => setTimeout(() => { fixProductTable(); updateQuoteCounter(); markDirty(); }, 0));
    fixProductTable();
  }

  function installQuoteCounter() {
    if ($('v27QuoteCounter')) return;
    const btn = document.createElement('button');
    btn.id = 'v27QuoteCounter';
    btn.type = 'button';
    btn.className = 'v27-quote-counter';
    btn.innerHTML = '<div><strong id="v27QuoteCounterTitle">Quotation · 0 items</strong><span id="v27QuoteCounterTotal">0.00</span></div><div class="arrow">→</div>';
    btn.addEventListener('click', () => setView('quotation'));
    document.body.appendChild(btn);
    updateQuoteCounter();
  }

  function updateQuoteCounter() {
    const count = typeof state !== 'undefined' ? (state.offer || []).length : 0;
    const title = $('v27QuoteCounterTitle');
    const total = $('v27QuoteCounterTotal');
    const navCount = $('v27NavQuoteCount');
    if (title) title.textContent = `Quotation · ${count} item${count === 1 ? '' : 's'}`;
    if (total) total.textContent = moneyText(currentTotal());
    if (navCount) navCount.textContent = String(count);
  }

  function installOfferObserver() {
    const body = $('offerBody');
    if (!body || body.dataset.v27Observed) return;
    body.dataset.v27Observed = '1';
    new MutationObserver(() => updateQuoteCounter()).observe(body, { childList:true, subtree:true });
    body.addEventListener('change', () => { updateQuoteCounter(); markDirty(); });
    body.addEventListener('click', e => { if (e.target.closest('[data-remove-offer],[data-move-v23]')) setTimeout(() => { updateQuoteCounter(); markDirty(); }, 0); });
    $('currency')?.addEventListener('change', updateQuoteCounter);
  }

  function installExportCollapse() {
    const box = document.querySelector('.export-options');
    const row = box?.querySelector('.export-options-head .button-row');
    if (!box || !row || $('v27ExportToggle')) return;
    const btn = document.createElement('button');
    btn.id = 'v27ExportToggle';
    btn.type = 'button';
    btn.className = 'v27-export-toggle';
    row.insertBefore(btn, row.firstChild);
    btn.addEventListener('click', () => setExportCollapsed(!box.classList.contains('v27-collapsed')));
    setExportCollapsed(localStorage.getItem(EXPORT_COLLAPSE_KEY) !== 'false');
    const grid = $('exportOptionsGrid');
    if (grid) new MutationObserver(moveImageOption).observe(grid, { childList:true, subtree:true });
    moveImageOption();
  }

  function setExportCollapsed(collapsed) {
    const box = document.querySelector('.export-options');
    const btn = $('v27ExportToggle');
    if (!box || !btn) return;
    box.classList.toggle('v27-collapsed', collapsed);
    localStorage.setItem(EXPORT_COLLAPSE_KEY, collapsed ? 'true' : 'false');
    btn.textContent = collapsed ? 'Customize columns ▾' : 'Hide columns ▴';
  }

  function moveImageOption() {
    const input = document.querySelector('[data-export-option="includeProductImages"]');
    const label = input?.closest('label');
    const row = document.querySelector('.export-options-head .button-row');
    if (!label || !row || label.classList.contains('v27-image-option')) return;
    label.classList.add('v27-image-option');
    row.insertBefore(label, row.firstChild);
  }

  function installDraftTools() {
    const library = $('draftLibraryV25');
    const list = $('draftListV25');
    if (!library || !list) return;
    if (!$('v27DraftTools')) {
      const tools = document.createElement('div');
      tools.id = 'v27DraftTools';
      tools.className = 'v27-draft-tools';
      tools.innerHTML = '<input id="v27DraftSearch" class="v27-draft-search" type="search" placeholder="Search drafts by name, customer or quotation no."/><span id="v27SaveState" class="v27-save-state saved">✓ Saved</span>';
      const status = $('draftLibraryStatusV25');
      status?.insertAdjacentElement('afterend', tools);
      $('v27DraftSearch')?.addEventListener('input', filterDrafts);
    }
    installAutoDraftSuggestion();
  }

  function filterDrafts() {
    const q = String($('v27DraftSearch')?.value || '').toLowerCase().trim();
    document.querySelectorAll('#draftListV25 .draft-row-v25').forEach(row => {
      row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  function installAutoDraftSuggestion() {
    const btn = $('saveNewDraftV25');
    if (!btn || btn.dataset.v27Prompt) return;
    btn.dataset.v27Prompt = '1';
    btn.addEventListener('click', () => {
      const originalPrompt = window.prompt;
      const customer = $('customerName')?.value.trim() || '';
      const quote = $('offerNumber')?.value.trim() || '';
      const suggested = [customer, quote].filter(Boolean).join(' · ') || 'New quotation';
      window.prompt = function(message, defaultValue) {
        if (String(message).toLowerCase().includes('draft name')) return originalPrompt.call(window, message, suggested);
        return originalPrompt.call(window, message, defaultValue);
      };
      setTimeout(() => { window.prompt = originalPrompt; }, 0);
    }, true);
  }

  function hasActiveDraft() {
    return Boolean(document.querySelector('#draftListV25 .draft-active-v25'));
  }

  function markDirty() {
    if (!hasActiveDraft()) return;
    dirty = true;
    const status = $('v27SaveState');
    if (status) { status.textContent = '• Unsaved changes'; status.className = 'v27-save-state unsaved'; }
  }

  function markSaved() {
    dirty = false;
    const status = $('v27SaveState');
    if (status) { status.textContent = '✓ Saved'; status.className = 'v27-save-state saved'; }
  }

  function installDirtyTracking() {
    ['customerName','offerNumber','offerDate','currency'].forEach(id => $(id)?.addEventListener(id === 'offerDate' || id === 'currency' ? 'change' : 'input', markDirty));
    document.addEventListener('click', e => {
      if (e.target.closest('#updateDraftV25,[data-draft-action-v25="load"],#saveNewDraftV25')) setTimeout(() => { installDraftTools(); markSaved(); }, 80);
      if (e.target.closest('#newOfferBtn')) setTimeout(markSaved, 30);
    });
  }

  function updateDynamicUi() {
    setFiltersCollapsed($('filterPanel')?.classList.contains('v27-collapsed') ?? true);
    installDraftTools();
    fixProductTable();
    updateQuoteCounter();
  }

  function init() {
    installHeader();
    installPriceListManager();
    installSettingsPanel();
    installFilterToggle();
    installResultObserver();
    installQuoteCounter();
    installOfferObserver();
    installExportCollapse();
    installDraftTools();
    installDirtyTracking();
    setView(localStorage.getItem(VIEW_KEY) || 'products');
    const main = document.querySelector('main');
    if (main) new MutationObserver(() => setTimeout(updateDynamicUi, 0)).observe(main, { childList:true, subtree:true });
    setTimeout(updateDynamicUi, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
