# Preislisten-Analyzer & Angebotsgenerator V8

GitHub-Pages-Webapp zum Durchsuchen mehrerer Preislisten und schnellen Erstellen eines Excel-Angebots.

## Neu in V8

- Die bisherige manuelle Zusatzrabatt-Spalte heißt jetzt **Second Discount %**.
- Second Discount wird nach dem Net Price angewendet: `Net Price × (1 − Second Discount)` = Angebot/Stk.
- Second Discount kann pro Position oder gesammelt für alle Positionen gesetzt werden.
- Im Excel-Export ist **Second Discount** separat über die Exportoptionen ein-/ausschaltbar.

- **Produktbilder in der Suche:** eingebettete Excel-Zellbilder werden bei `.xlsx`-Preislisten ausgelesen und als Thumbnail angezeigt. Ein Klick öffnet das Bild größer.
- **Bilder auch in der Angebotsauswahl:** zur schnellen visuellen Kontrolle; sie werden weiterhin **nicht** in die Angebots-Excel exportiert.
- **Farbe / RAL:** automatische Erkennung der Spalte `COLOR`, `RAL` oder `Farbe`.
- **RAL als Text + Farbfeld:** z. B. `RAL 5015`; Kombinationen wie `RAL 7015 / RAL 9005` zeigen mehrere Farbfelder.
- **Farbe / RAL als optionale Excel-Spalte:** über die Exportoptionen ein-/ausschaltbar. In Excel wird der Text ausgegeben und bei bekannten RAL-Farben die Zelle näherungsweise eingefärbt.
- **Suchfilter:** nach Preisliste, Family/Gruppe und Farbe/RAL.
- **Filter komplett deaktivierbar:** über den Schalter `Filter aktiv` im Suchbereich. Die Einstellung wird lokal gespeichert.

> RAL-Farbfelder sind nur eine RGB-/Bildschirm-Näherung. Für die eindeutige Farbangabe gilt immer die RAL-Nummer.

## Schnellangebot aus V6

- Artikelnummer oder Modell eingeben und `Enter` drücken
- gleicher Artikel erneut → Menge wird um 1 erhöht
- Menge auf alle Positionen setzen
- Second Discount auf alle Positionen setzen
- Angebotsnummer automatisch erzeugen
- Angebotsdatum und Währung
- Entwurf speichern / laden
- automatische lokale Entwurfssicherung

## Frei wählbare Excel-Spalten

Unter **Optionen für Excel-Übertragung** lässt sich jede Spalte separat an- oder ausschalten:

- Pos.
- Artikelnummer
- Modell
- Farbe / RAL
- Family / Gruppe
- Menge
- List Price
- Discount / Preislistenrabatt
- Net Price
- Second Discount
- Angebot/Stk.
- Gesamt
- Preisliste / Quelle

`DESCRIPTION` und Produktbilder werden nicht in das Angebot exportiert.

## Hofmann 2026

Für die bereitgestellte Hofmann-Preisliste werden insbesondere erkannt:

- `P/N` → Artikelnummer
- `MODEL` → Modell
- `COLOR` → Farbe / RAL
- `List Price` → Listenpreis
- `Discount` → Preislistenrabatt
- `Net Price` → Netto/Stk.
- `FAMILY` → Produktgruppe
- `PRODUCT IMAGE` → eingebettetes Produktbild (bei erneutem Import in V8)

Die lange `DESCRIPTION` kann bei der Suche helfen, wird aber nicht in das Angebot übernommen.

## Wichtig beim Update auf V8

Bereits in V6 gespeicherte Preislisten enthalten die eingebetteten Bilddateien nicht. Nach dem Austausch von `index.html`, `styles.css` und `app.js` deshalb die originale `.xlsx`-Preisliste **einmal erneut über „Preislisten hinzufügen“ importieren**. Danach werden die Bilder zusammen mit der Preisliste lokal im Browser gespeichert.

## GitHub Pages aktualisieren

1. Im bestehenden Repository `index.html`, `styles.css` und `app.js` durch die V8-Dateien ersetzen.
2. Änderungen auf dem `main`-Branch speichern/committen.
3. GitHub Pages aktualisiert die Website automatisch.
4. Seite neu laden. Falls noch die alte Version sichtbar ist, einmal mit `Strg + F5` hart aktualisieren.
5. Die originale Preislisten-Excel einmal neu importieren, damit V8 die Produktbilder speichern kann.

## Datenschutz / Speicherung

Preislisten, Produktbilder, Exportoptionen, Suchfilter und Angebotsentwurf werden lokal im Browser gespeichert und nicht auf einen eigenen Server hochgeladen. Werden Browser-/Website-Daten gelöscht oder eine andere GitHub-Pages-Adresse verwendet, sind diese lokalen Daten nicht mehr verfügbar.
