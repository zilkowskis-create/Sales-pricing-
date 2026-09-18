(() => {
  'use strict';

  const REGION_MAP_KEY = 'salesPricingPriceListRegionsV35';
  const REGION_FILTER_KEY = 'salesPricingRegionFilterV35';
  const COMMON_REGIONS = ['Europe', 'Central Europe', 'Eastern Europe', 'Nordics', 'UK & Ireland', 'Central Asia', 'Middle East & Africa', 'Export'];

  const loadRegionMap = () => {
    try { return JSON.parse(localStorage.getItem(REGION_MAP_KEY) || '{}') || {}; }
    catch { return {}; }
  };
  const saveRegionMap = map => localStorage.setItem(REGION_MAP_KEY, JSON.stringify(map));
  const norm = value => String(value || '').trim();

  function groupRegion(group) {
    if (!group) return '';
    const direct = group.lists?.map(list => norm(list.region)).find(Boolean);
    if (direct) return direct;
    const map = loadRegionMap();
    return norm(map[group.key] || map[group.fileName]);
  }

  async function setGroupRegion(groupKey, value) {
    const group = getPriceListGroups().find(g => g.key === groupKey);
    if (!group) return;
    const region = norm(value);
    const map = loadRegionMap();
    map[group.key] = region;
    if (group.fileName) map[group.fileName] = region;
    saveRegionMap(map);
    for (const list of group.lists) {
      list.region = region;
      await savePriceList(list);
    }
    updateRegionFilterOptions();
    applyRegionVisibility();
    renderResults();
  }

  function applyRememberedRegions() {
    if (typeof state === 'undefined' || !Array.isArray(state.priceLists)) return;
    const map = loadRegionMap();
    for (const group of getPriceListGroups()) {
      const remembered = norm(map[group.key] || map[group.fileName]);
      if (!remembered) continue;
      for (const list of group.lists) {
        if (!norm(list.region)) {
          list.region = remembered;
          savePriceList(list).catch(() => {});
        }
      }
    }
  }

  function ensureRegionDatalist() {
    if (document.getElementById('regionOptionsV35')) return;
    const datalist = document.createElement('datalist');
    datalist.id = 'regionOptionsV35';
    document.body.appendChild(datalist);
  }

  function updateRegionDatalist() {
    ensureRegionDatalist();
    const datalist = document.getElementById('regionOptionsV35');
    const assigned = getPriceListGroups().map(groupRegion).filter(Boolean);
    const values = [...new Set([...COMMON_REGIONS, ...assigned])].sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = values.map(v => `<option value="${escapeAttr(v)}"></option>`).join('');
  }

  function enhanceManagePriceLists() {
    if (!document.getElementById('savedLists')) return;
    applyRememberedRegions();
    updateRegionDatalist();

    document.querySelectorAll('[data-edit-price-file]').forEach(editBtn => {
      const key = editBtn.dataset.editPriceFile;
      const row = editBtn.closest('.saved-list-row,.saved-list-item,.saved-list') || editBtn.parentElement?.parentElement;
      if (!row || row.querySelector(`[data-region-group-v35="${CSS.escape(key)}"]`)) return;
      const group = getPriceListGroups().find(g => g.key === key);
      if (!group) return;

      const control = document.createElement('label');
      control.className = 'region-control-v35';
      control.dataset.regionGroupV35 = key;
      control.innerHTML = `<span>Region</span><input type="text" list="regionOptionsV35" placeholder="Select or type region" value="${escapeAttr(groupRegion(group))}" />`;
      const buttonRow = editBtn.parentElement;
      if (buttonRow) buttonRow.insertBefore(control, editBtn);

      const input = control.querySelector('input');
      input.addEventListener('change', () => setGroupRegion(key, input.value));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
      });
    });
  }

  function ensureRegionFilter() {
    const panel = document.getElementById('filterPanel');
    if (!panel) return;
    let select = document.getElementById('regionFilterV35');
    if (select) return select;

    const label = document.createElement('label');
    label.className = 'region-filter-v35';
    label.innerHTML = '<span>Region</span><select id="regionFilterV35"><option value="">All regions</option></select>';
    panel.insertBefore(label, panel.firstChild);
    select = label.querySelector('select');
    select.value = localStorage.getItem(REGION_FILTER_KEY) || '';
    select.addEventListener('change', () => {
      localStorage.setItem(REGION_FILTER_KEY, select.value);
      if (typeof state !== 'undefined' && state.searchSettings) {
        state.searchSettings.source = '';
        if (typeof saveSearchSettings === 'function') saveSearchSettings();
      }
      if (typeof renderFilters === 'function') renderFilters();
      if (typeof renderPriceListTabs === 'function') renderPriceListTabs();
      if (typeof renderSheetToggles === 'function') renderSheetToggles();
      if (typeof renderResults === 'function') renderResults();
      applyRegionVisibility();
    });
    return select;
  }

  function selectedRegion() {
    return norm(document.getElementById('regionFilterV35')?.value || localStorage.getItem(REGION_FILTER_KEY));
  }

  function updateRegionFilterOptions() {
    const select = ensureRegionFilter();
    if (!select) return;
    const current = selectedRegion();
    const regions = [...new Set(getPriceListGroups().map(groupRegion).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">All regions</option>' + regions.map(r => `<option value="${escapeAttr(r)}">${escapeHtml(r)}</option>`).join('');
    select.value = regions.includes(current) ? current : '';
    if (current && !regions.includes(current)) localStorage.removeItem(REGION_FILTER_KEY);
  }

  function applyRegionVisibility() {
    const region = selectedRegion();
    const allowedGroups = new Set(getPriceListGroups().filter(g => !region || groupRegion(g) === region).map(g => g.key));
    const allowedLists = new Set(state.priceLists.filter(list => {
      const group = getPriceListGroups().find(g => g.key === getParentKey(list));
      return !region || groupRegion(group) === region;
    }).map(list => list.id));

    document.querySelectorAll('[data-price-list-tab]').forEach(tab => {
      tab.hidden = region ? !allowedGroups.has(tab.dataset.priceListTab) : false;
    });
    document.querySelectorAll('[data-sheet-tab]').forEach(tab => {
      tab.hidden = region ? !allowedLists.has(tab.dataset.sheetTab) : false;
    });

    const source = document.getElementById('sourceFilter');
    if (source) {
      Array.from(source.options).forEach(option => {
        if (!option.value) { option.hidden = false; return; }
        option.hidden = region ? !allowedGroups.has(option.value) : false;
      });
      if (source.value && !allowedGroups.has(source.value)) source.value = '';
    }
  }

  function installSearchRegionFilter() {
    if (typeof allSearchItems === 'function' && !allSearchItems.__v35RegionWrapped) {
      const originalAllSearchItems = allSearchItems;
      const wrapped = function() {
        const items = originalAllSearchItems();
        const region = selectedRegion();
        if (!region) return items;
        const allowed = new Set(state.priceLists.filter(list => {
          const group = getPriceListGroups().find(g => g.key === getParentKey(list));
          return groupRegion(group) === region;
        }).map(list => list.id));
        return items.filter(item => allowed.has(item.listId));
      };
      wrapped.__v35RegionWrapped = true;
      allSearchItems = wrapped;
    }
  }

  function installRenderHooks() {
    ['renderFilters', 'renderPriceListTabs', 'renderSheetToggles', 'renderSavedLists'].forEach(name => {
      const fn = globalThis[name];
      if (typeof fn !== 'function' || fn.__v35RegionHook) return;
      const wrapped = function(...args) {
        const result = fn.apply(this, args);
        queueMicrotask(() => {
          enhanceManagePriceLists();
          updateRegionFilterOptions();
          applyRegionVisibility();
        });
        return result;
      };
      wrapped.__v35RegionHook = true;
      try { globalThis[name] = wrapped; } catch {}
    });
  }

  function observeUi() {
    const saved = document.getElementById('savedLists');
    if (saved && !saved.dataset.regionObservedV35) {
      saved.dataset.regionObservedV35 = '1';
      new MutationObserver(() => setTimeout(enhanceManagePriceLists, 0)).observe(saved, { childList: true, subtree: true });
    }
    const tabs = document.getElementById('priceListTabs');
    if (tabs && !tabs.dataset.regionObservedV35) {
      tabs.dataset.regionObservedV35 = '1';
      new MutationObserver(applyRegionVisibility).observe(tabs, { childList: true, subtree: true });
    }
    const sheets = document.getElementById('sheetTogglePanel');
    if (sheets && !sheets.dataset.regionObservedV35) {
      sheets.dataset.regionObservedV35 = '1';
      new MutationObserver(applyRegionVisibility).observe(sheets, { childList: true, subtree: true });
    }
  }

  function init() {
    ensureRegionFilter();
    installSearchRegionFilter();
    installRenderHooks();
    observeUi();
    setTimeout(() => {
      applyRememberedRegions();
      enhanceManagePriceLists();
      updateRegionFilterOptions();
      applyRegionVisibility();
      if (typeof renderResults === 'function') renderResults();
    }, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
