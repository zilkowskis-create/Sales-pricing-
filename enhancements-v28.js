(() => {
  'use strict';

  const KEY = 'salesPricingV28MappingCollapsed';
  const $ = id => document.getElementById(id);

  function mappingNeedsAttention() {
    if (typeof state === 'undefined') return false;
    const list = state.priceLists?.find(x => x.id === state.activeListId);
    if (!list) return false;
    const m = list.mapping || {};
    const hasIdentity = Boolean(m.article || m.model);
    const hasPrice = Boolean(m.listPrice || m.netPrice);
    return !hasIdentity || !hasPrice;
  }

  function setCollapsed(collapsed, persist = true) {
    const card = $('mappingCard');
    const btn = $('v28MappingToggle');
    if (!card || !btn) return;

    card.classList.toggle('v28-mapping-collapsed', collapsed);
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.textContent = collapsed ? '+' : '−';
    btn.title = collapsed ? 'Expand column mapping' : 'Collapse column mapping';

    if (persist) localStorage.setItem(KEY, collapsed ? 'true' : 'false');
  }

  function syncState() {
    if (!$('v28MappingToggle')) return;
    if (mappingNeedsAttention()) {
      setCollapsed(false, false);
      return;
    }
    const saved = localStorage.getItem(KEY);
    setCollapsed(saved !== 'false', false);
  }

  function install() {
    const card = $('mappingCard');
    if (!card || $('v28MappingToggle')) return;

    const head = card.querySelector('.section-head');
    const title = head?.querySelector('h2');
    if (!head || !title) return;

    title.textContent = 'Column mapping';
    head.classList.add('v28-mapping-head');

    const textWrap = title.parentElement;
    if (textWrap) textWrap.classList.add('v28-mapping-title-wrap');

    const toggle = document.createElement('button');
    toggle.id = 'v28MappingToggle';
    toggle.type = 'button';
    toggle.className = 'v28-mapping-toggle';
    toggle.setAttribute('aria-controls', 'mappingCard');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '+';
    toggle.title = 'Expand column mapping';
    title.insertAdjacentElement('afterend', toggle);

    const saveBtn = $('applyMappingBtn');
    if (saveBtn) saveBtn.classList.add('v28-mapping-detail');
    head.querySelector('.muted')?.classList.add('v28-mapping-detail');
    card.querySelector('.mapping-grid')?.classList.add('v28-mapping-detail');

    toggle.addEventListener('click', () => {
      setCollapsed(!card.classList.contains('v28-mapping-collapsed'));
    });

    $('priceListSelect')?.addEventListener('change', () => setTimeout(syncState, 0));
    $('sheetSelect')?.addEventListener('change', () => setTimeout(syncState, 0));
    $('applyMappingBtn')?.addEventListener('click', () => setTimeout(() => {
      if (!mappingNeedsAttention()) setCollapsed(true);
    }, 100));

    const observer = new MutationObserver(() => {
      if (!card.classList.contains('hidden') && mappingNeedsAttention()) setCollapsed(false, false);
    });
    observer.observe(card, { attributes: true, attributeFilter: ['class'] });

    syncState();
  }

  function init() {
    install();
    setTimeout(install, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
