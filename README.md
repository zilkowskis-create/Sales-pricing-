# Price List Analyzer V16

V16 fixes product-picture extraction from Excel workbooks that use Microsoft 365 **Picture in Cell / Rich Value** images.

## V16 changes
- Robust OOXML parsing for in-cell product images.
- Keeps support for traditional floating worksheet images.
- Adds console diagnostics with the number of images loaded per sheet.
- Keeps price-list tabs, sheet selection, RAL/colour, Second Discount and quotation export.
- Cache-busted `app.js` and `styles.css` references so GitHub Pages loads the V16 files.

After deploying V16, delete the old locally stored price list once and re-import the original Excel workbook so the images are extracted and stored again.
