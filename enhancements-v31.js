(() => {
  'use strict';

  const FINAL_VERSION_LABEL = 'V31 · Table alignment';

  function normalizeResultTable() {
    const table = document.querySelector('#searchCard table');
    const body = document.getElementById('resultsBody');
    if (!table || !body) return;

    const headerRow = table.querySelector('thead tr');
    if (!headerRow) return;

    const headers = Array.from(headerRow.children);
    const familyIndex = headers.findIndex(cell => cell.textContent.trim().toLowerCase() === 'family');

    for (const row of Array.from(body.querySelectorAll('tr'))) {
      if (row.classList.contains('empty')) continue;

      const info = row.querySelector('.v23-added-info,.description-info-cell');
      const modelCell = row.children[3];
      if (info && modelCell && modelCell.nextElementSibling !== info) {
        modelCell.insertAdjacentElement('afterend', info);
      }

      /* Wait until the info cell has been inserted so the final 14-column
         structure is stable. */
      if (row.children.length < headers.length) continue;

      Array.from(row.children).forEach(cell => cell.style.removeProperty('display'));
      if (familyIndex >= 0 && row.children[familyIndex]) {
        row.children[familyIndex].style.display = 'none';
      }
    }
  }

  function scheduleNormalize() {
    requestAnimationFrame(() => {
      normalizeResultTable();
      setTimeout(normalizeResultTable, 30);
    });
  }

  function keepVersionBadgeCurrent() {
    const badge = document.querySelector('.badge');
    if (badge) badge.textContent = FINAL_VERSION_LABEL;
  }

  function init() {
    scheduleNormalize();

    const body = document.getElementById('resultsBody');
    if (body && !body.dataset.v31Observed) {
      body.dataset.v31Observed = '1';
      new MutationObserver(scheduleNormalize).observe(body, { childList: true, subtree: true });
    }

    ['searchInput','priceListTabs','sheetTogglePanel','sourceFilter','familyFilter','colorFilter']
      .forEach(id => document.getElementById(id)?.addEventListener('change', scheduleNormalize));

    keepVersionBadgeCurrent();
    setTimeout(keepVersionBadgeCurrent, 100);
    setTimeout(keepVersionBadgeCurrent, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
