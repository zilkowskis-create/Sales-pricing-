(() => {
  'use strict';

  const IMAGE_OPTION_KEY = 'includeProductImages';

  function disableImageExport() {
    try {
      if (typeof state !== 'undefined' && state.exportOptions) {
        state.exportOptions[IMAGE_OPTION_KEY] = false;
        if (typeof saveExportOptions === 'function') saveExportOptions();
      }
    } catch (err) {
      console.warn('Could not disable legacy image export option.', err);
    }

    document.querySelectorAll('[data-export-option="includeProductImages"]').forEach(input => {
      input.checked = false;
      const label = input.closest('label');
      if (label) label.style.display = 'none';
    });
  }

  function keepDisabled() {
    disableImageExport();
    const grid = document.getElementById('exportOptionsGrid');
    if (grid && !grid.dataset.v32Observed) {
      grid.dataset.v32Observed = '1';
      new MutationObserver(() => disableImageExport()).observe(grid, { childList: true, subtree: true });
    }
  }

  function init() {
    keepDisabled();
    setTimeout(keepDisabled, 100);
    setTimeout(keepDisabled, 500);
    const badge = document.querySelector('.badge');
    if (badge) badge.textContent = 'V32 · Standard Excel export';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
