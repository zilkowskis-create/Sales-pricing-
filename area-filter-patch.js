// V13 patch: "Price list" filter becomes "Bereich" and shows worksheet/section names.
// Load this file AFTER app.js in index.html.
(() => {
  if (typeof renderFilters !== 'function' || typeof state === 'undefined') {
    console.warn('Bereich-Filter Patch: app.js ist noch nicht geladen.');
    return;
  }

  const setLabelText = (select, text) => {
    const label = select?.closest('label');
    if (!label) return;
    const textNode = Array.from(label.childNodes).find(
      node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
    if (textNode) textNode.textContent = text;
  };

  // Keep the existing list-id filter logic, but present each worksheet as a "Bereich".
  renderFilters = function renderFiltersBereich() {
    if (!filterPanel) return;

    filtersEnabledToggle.checked = state.searchSettings.filtersEnabled !== false;
    filterPanel.classList.toggle('filters-off', !filtersEnabledToggle.checked);

    const enabledLists = state.priceLists.filter(list => list.enabled);
    const sheetNameCounts = enabledLists.reduce((counts, list) => {
      const name = String(list.sheetName || '').trim() || shortFileName(list.fileName);
      counts[name] = (counts[name] || 0) + 1;
      return counts;
    }, {});

    const areaOptions = enabledLists.map(list => {
      const area = String(list.sheetName || '').trim() || shortFileName(list.fileName);
      const duplicate = sheetNameCounts[area] > 1;
      return {
        value: list.id,
        label: duplicate ? `${area} · ${shortFileName(list.fileName)}` : area
      };
    });

    sourceFilter.dataset.settingKey = 'source';
    familyFilter.dataset.settingKey = 'family';
    colorFilter.dataset.settingKey = 'color';

    fillFilterSelect(sourceFilter, areaOptions, 'Alle Bereiche', state.searchSettings.source);

    const baseItems = allSearchItems().filter(
      item => !state.searchSettings.source || item.listId === state.searchSettings.source
    );
    const families = uniqueSorted(baseItems.map(item => item.family).filter(Boolean))
      .map(v => ({ value: v, label: v }));
    const colors = uniqueSorted(baseItems.map(item => item.color).filter(Boolean))
      .map(v => ({ value: v, label: v }));

    fillFilterSelect(familyFilter, families, 'All families', state.searchSettings.family);
    fillFilterSelect(colorFilter, colors, 'All colours', state.searchSettings.color);
  };

  setLabelText(sourceFilter, 'Bereich');
  const toggleLabel = filtersEnabledToggle?.closest('label');
  if (toggleLabel) {
    toggleLabel.title = 'Zusatzfilter für Bereich, Family und Colour an- oder ausschalten';
  }

  // Re-render once the existing app has loaded its saved price lists.
  const refreshPatch = () => {
    setLabelText(sourceFilter, 'Bereich');
    renderFilters();
    if (typeof renderResults === 'function') renderResults();
  };

  setTimeout(refreshPatch, 0);
  setTimeout(refreshPatch, 300);
})();
