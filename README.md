# Price List Analyzer V15

English GitHub Pages app for Excel price lists and quotation creation.

## V15 fixes
- Adds support for both Excel **Picture in Cell (rich-value)** images and traditional worksheet drawing images.
- Keeps the result table columns aligned: Select | Image | Price list | Part No. | Model | RAL | Colour | Family | List Price | Discount | Net Price.
- Adds cache-busting (`?v=15`) for `app.js` and `styles.css`, so GitHub Pages does not combine a new HTML file with an older cached JavaScript/CSS file.
- Build marker changed to **V15 · Images & table fix**.

After deploying V15, delete the locally saved old price list once and re-import the original Excel file so images are extracted and stored.
