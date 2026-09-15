(() => {
  'use strict';

  function resolveImageFromList(item) {
    if (typeof state === 'undefined' || !item) return '';
    const list = state.priceLists?.find(x => x.id === item.listId);
    if (!list) return '';

    let imageId = item.imageId || '';
    let current = null;
    if (!imageId && item.uid) current = (list.items || []).find(x => x.uid === item.uid) || null;
    if (!current && item.article) {
      current = (list.items || []).find(x => x.article === item.article && (!item.model || x.model === item.model)) || null;
    }
    if (!imageId) imageId = current?.imageId || '';

    if (!imageId) {
      const rowIndex = Number.isInteger(current?.rowIndex) ? current.rowIndex : (Number.isInteger(item.rowIndex) ? item.rowIndex : -1);
      const excelRow = rowIndex >= 0 ? Number(list.rawRows?.[rowIndex]?.__excelRow) : NaN;
      if (Number.isFinite(excelRow)) imageId = list.imageRowMap?.[excelRow] || '';
    }

    if (!imageId && item.uid) {
      const offerRow = Array.from(document.querySelectorAll('#offerBody tr')).find(row => {
        return row.dataset.offerRow === item.uid || row.querySelector(`[data-remove-offer="${CSS.escape(item.uid)}"]`);
      });
      const img = offerRow?.querySelector('img[data-image-preview], img.product-thumb');
      if (img?.src?.startsWith('data:image/')) return img.src;

      const resultCheckbox = document.querySelector(`#resultsBody [data-offer-uid="${CSS.escape(item.uid)}"]`);
      const resultImg = resultCheckbox?.closest('tr')?.querySelector('img[data-image-preview], img.product-thumb');
      if (resultImg?.src?.startsWith('data:image/')) return resultImg.src;
    }

    if (imageId && list.images?.[imageId]) {
      if (!item.imageId) item.imageId = imageId;
      return list.images[imageId];
    }
    return '';
  }

  function installImageResolver() {
    const oldGetItemImage = typeof window.getItemImage === 'function' ? window.getItemImage : null;
    window.getItemImage = function(item) {
      try {
        const direct = oldGetItemImage ? oldGetItemImage(item) : '';
        if (direct) return direct;
      } catch (err) {
        console.warn('Primary product image lookup failed.', err);
      }
      return resolveImageFromList(item);
    };
  }

  function showRalColourColumn() {
    const searchCard = document.getElementById('searchCard');
    if (!searchCard) return;
    const table = searchCard.querySelector('table');
    if (!table) return;
    const rows = table.querySelectorAll('tr');
    rows.forEach(row => {
      if (row.children[6]) row.children[6].style.display = '';
      if (row.children[7]) row.children[7].style.display = 'none';
    });
  }

  function init() {
    installImageResolver();
    showRalColourColumn();
    const results = document.getElementById('resultsBody');
    if (results) new MutationObserver(showRalColourColumn).observe(results, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
