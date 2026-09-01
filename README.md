# Price List Analyzer V12

Browser-based GitHub Pages application for searching multiple Excel price lists and creating Excel quotations.

## Main features
- Load and store multiple Excel price lists locally in the browser
- Select individual price-list sheets such as HOFMANN 2026, OEM and accessory sheets
- Search by Part No., model or keyword
- Product images in search and quotation selection where available
- RAL code plus colour swatch
- Filters can be enabled or disabled
- Quantity and Second Discount per item
- Bulk quantity and Second Discount actions
- Save and reload quotation drafts
- Configurable Excel export columns
- Automatic Excel quotation generation

## GitHub Pages
Upload `index.html`, `app.js`, `styles.css` and this `README.md` to the root of your repository. Then enable GitHub Pages under **Settings → Pages → Deploy from a branch → main → /(root)**.

After updating from an older version, delete the previously stored price list in the app and import the Excel file again so that all sheet and image data is rebuilt.
