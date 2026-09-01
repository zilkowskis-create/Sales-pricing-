# Preislisten-Analyzer & Angebotsgenerator V6

GitHub-Pages-Webapp zum Durchsuchen mehrerer Preislisten und schnellen Erstellen eines Excel-Angebots.

## Neu in V6: Schnellangebot

Die Angebotsbearbeitung wurde für möglichst wenige Klicks erweitert:

- **Enter-Schnellsuche:** Suchbegriff oder Artikelnummer eingeben und `Enter` drücken. Der erste Treffer wird sofort ins Angebot übernommen. Ist der Artikel bereits enthalten, wird seine Menge um 1 erhöht.
- **Menge auf alle:** Eine Menge kann mit einem Klick auf alle ausgewählten Positionen gesetzt werden.
- **Rabatt auf alle:** Ein zusätzlicher Rabatt kann mit einem Klick auf alle Positionen gesetzt werden.
- **Automatische Angebotsnummer:** erzeugt Nummern nach dem Muster `AN-20260831-001`.
- **Angebotsdatum:** wird im Kopf der Excel-Datei verwendet.
- **Entwurf speichern / letzten laden:** das aktuelle Angebot kann lokal im Browser gespeichert und später fortgesetzt werden.
- **Automatische Entwurfssicherung:** Änderungen an Positionen, Menge, Rabatt und Angebotsdaten werden lokal gespeichert.
- **Neues Angebot:** leert Positionen und Kundendaten und erzeugt direkt eine neue Angebotsnummer.

## Frei wählbare Excel-Spalten

Unter **Optionen für Excel-Übertragung** lässt sich jede Spalte separat an- oder ausschalten:

- Pos.
- Artikelnummer
- Modell
- Family / Gruppe
- Menge
- List Price
- Discount / Preislistenrabatt
- Net Price
- Zusatzrabatt
- Angebot/Stk.
- Gesamt
- Preisliste / Quelle

Die Auswahl wird im Browser gespeichert. `DESCRIPTION` und Produktbilder werden nicht in das Angebot exportiert.

## Weitere Funktionen

- Mehrere Excel-/XLS-/CSV-Preislisten gleichzeitig laden
- Preislisten dauerhaft in IndexedDB im Browser speichern
- Einzelne Preislisten aktivieren/deaktivieren
- Eine Suche über alle aktiven Preislisten
- Suche nach Artikelnummer, Modell und weiteren Inhalten der Preislistenzeile
- Menge pro Position
- Zusätzlicher Rabatt pro Position
- Automatischer Excel-Angebotsexport mit Formeln
- Kunde, Angebotsnummer, Angebotsdatum und Währung

## Hofmann 2026

Für die bereitgestellte Hofmann-Preisliste werden insbesondere erkannt:

- `P/N` → Artikelnummer
- `MODEL` → Modell
- `List Price` → Listenpreis
- `Discount` → Preislistenrabatt
- `Net Price` → Netto/Stk.
- `FAMILY` → Produktgruppe

Die lange `DESCRIPTION` kann bei der Suche helfen, wird aber nicht in das Angebot übernommen.

## GitHub Pages

1. Neues Repository erstellen oder bestehendes Repository öffnen.
2. `index.html`, `styles.css` und `app.js` hochladen/ersetzen.
3. GitHub: **Settings → Pages**.
4. Haupt-Branch und `/ (root)` auswählen.
5. Seite öffnen und Preislisten einmalig importieren.

## Datenschutz / Speicherung

Preislisten, Exportoptionen und Angebotsentwurf werden lokal im Browser gespeichert und nicht auf einen Server hochgeladen. Werden Browser-/Website-Daten gelöscht oder eine andere GitHub-Pages-Adresse verwendet, sind diese lokalen Daten nicht mehr verfügbar.
