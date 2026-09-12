// V22 patch: show Excel DESCRIPTION as an on-demand tooltip in the online product table.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    .info-head,.description-info-cell{width:44px;text-align:center}
    .description-tooltip{position:relative;display:inline-flex;align-items:center;justify-content:center;outline:none}
    .info-icon{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#eef3ff;color:#2453a6;border:1px solid #bfd0f5;font-size:13px;font-weight:800;cursor:help;user-select:none}
    .info-icon-empty{opacity:.35;cursor:default}
    .description-tooltip-content{position:absolute;z-index:1000;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);width:max-content;max-width:min(520px,70vw);min-width:240px;padding:10px 12px;border-radius:10px;background:#101828;color:#fff;text-align:left;font-size:13px;font-weight:500;line-height:1.45;white-space:normal;box-shadow:0 12px 32px rgba(15,23,42,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s ease,visibility .12s ease}
    .description-tooltip-content::after{content:'';position:absolute;left:50%;top:100%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#101828}
    .description-tooltip:hover .description-tooltip-content,.description-tooltip:focus .description-tooltip-content,.description-tooltip:focus-within .description-tooltip-content{opacity:1;visibility:visible}
    @media (max-width:700px){.description-tooltip-content{position:fixed;left:16px;right:16px;bottom:20px;transform:none;width:auto;max-width:none}.description-tooltip-content::after{display:none}}
  `;
  document.head.appendChild(style);

  const descriptionHeaderCache = new Map();

  function findDescriptionHeader(list) {
    if (!list) return '';
    if (descriptionHeaderCache.has(list.id)) return descriptionHeaderCache.get(list.id);
    const headers = list.headers || [];
    const candidates = ['description', 'long description', 'product description', 'item description', 'beschreibung', 'langtext', 'long text'];
    let found = '';
    for (const candidate of candidates) {
      const exact = headers.find(h => normalize(h) === normalize(candidate));
      if (exact) { found = exact; break; }
    }
    if (!found) {
      found = headers.find(h => {
        const n = normalize(h);
        return n.includes('description') || n.includes('beschreibung') || n.includes('langtext') || n.includes('long text');
      }) || '';
    }
    descriptionHeaderCache.set(list.id, found);
    return found;
  }

  function getDescription(item) {
    if (!item) return '';
    if (item.description) return String(item.description).trim();
    const list = state.priceLists.find(x => x.id === item.listId);
    const header = findDescriptionHeader(list);
    if (!header) return '';
    const row = list?.rawRows?.[item.rowIndex];
    return String(row?.[header] ?? '').trim();
  }

  function renderDescriptionInfoV22(item) {
    const text = getDescription(item);
    if (!text) return '<span class="info-icon info-icon-empty" aria-label="No description available">i</span>';
    return `<span class="description-tooltip" tabindex="0" aria-label="Product description"><span class="info-icon">i</span><span class="description-tooltip-content" role="tooltip">${escapeHtml(text)}</span></span>`;
  }

  // Replace only the result-table renderer. All pricing, selection, filters and quotation logic remain unchanged.
  renderResults = function () {
    if (!state.priceLists.length) return;
    const matches = getSearchMatches();
    resultCount.textContent = `${matches.length} results · all shown`;

    if (!matches.length) {
      resultsBody.innerHTML = '<tr><td colspan="14" class="empty">No matching products found.</td></tr>';
      return;
    }

    resultsBody.innerHTML = matches.map(item => {
      const offerItem = state.offer.find(o => o.uid === item.uid);
      const selected = Boolean(offerItem);
      const qty = offerItem?.qty ?? 1;
      const secondDiscount = offerItem?.extraDiscount ?? 0;
      const total = item.netPrice * (1 - secondDiscount / 100) * qty;
      const image = getItemImage(item);
      return `<tr>
        <td><input class="result-check" type="checkbox" data-offer-uid="${escapeAttr(item.uid)}" ${selected ? 'checked' : ''} /></td>
        <td class="image-cell">${renderProductImage(image, item, false)}</td>
        <td>${escapeHtml(item.article)}</td>
        <td>${escapeHtml(item.model)}</td>
        <td>${renderRalText(item.color)}</td>
        <td class="description-info-cell">${renderDescriptionInfoV22(item)}</td>
        <td class="ral-color-cell">${renderRalSwatches(item.color)}</td>
        <td>${escapeHtml(item.family)}</td>
        <td class="num">${formatNumber(item.listPrice)}</td>
        <td class="num">${formatPercent(item.priceListDiscount)}</td>
        <td class="num">${formatNumber(item.netPrice)}</td>
        <td><input class="result-price-input" type="number" min="0" max="100" step="0.1" value="${secondDiscount}" data-result-field="extraDiscount" data-result-uid="${escapeAttr(item.uid)}" aria-label="Second Discount" /></td>
        <td><input class="result-price-input result-units-input" type="number" min="1" step="1" value="${qty}" data-result-field="qty" data-result-uid="${escapeAttr(item.uid)}" aria-label="Units" /></td>
        <td class="num result-total" data-result-total="${escapeAttr(item.uid)}">${formatNumber(total)}</td>
      </tr>`;
    }).join('');
  };

  // Re-render once in case the stored price list was already loaded before this patch executed.
  try { renderResults(); } catch (err) { console.warn('V22 description tooltip patch:', err); }
})();
