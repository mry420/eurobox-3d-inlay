# Eurobox Inlay Generator

Browser-Generator für stapelbare 3D-Druck-Einsätze in Euroboxen **40 × 30 × 12 cm** und **40 × 30 × 17 cm**, z. B. um Kabel, Netzteile und Kleinteile zu sortieren.

Einfach `index.html` im Browser öffnen, ohne Installation und ohne Build. Three.js wird vom CDN geladen.

## Funktionen

- **Vorlagen**: Kabel-Bahnen, Kabel & Netzteile, Ladegeräte, Gemischt, Kleinteile, Zwei Ebenen, Drei Ebenen, eigenes Raster
- **Ebenen**: Einsätze in bis zu 4 Lagen übereinander. Jede Ebene hat ihr eigenes Layout und füllt die ganze Bodenfläche, die obere liegt eben auf der unteren auf.
- **Bündiger Sitz in der Box**: Die Außenwände der Randteile folgen der Wandschräge der Eurobox, die Eckteile dem Eckradius der Box. Dadurch verrutscht nichts.
- **Stapelbare Boxen**: Die Einsätze enden unter der Stapelgrenze (Innenhöhe minus Stapel-Freiraum), damit die nächste Eurobox noch draufpasst.
- **Layout-Editor**: Teile teilen, verbinden, entfernen, hinzufügen. Fächer pro Teil, Griffmulde vorne, Beschriftungsfeld hinten, Höhe der obersten Ebene (voll, ¾, ½, ⅓).
- **Druckbett-Prüfung**: Teile, die größer als dein Druckbett sind, werden markiert.
- **Export**: ZIP mit einer STL pro Teil-Variante (gleiche Teile nur einmal, Stückzahl im Dateinamen) plus Stückliste.
- Hell und dunkel, läuft auch auf dem Handy. Einstellungen bleiben im Browser gespeichert.

## Maße

Standardwerte (unter „Maße & Druck anpassen“ änderbar, am besten an deiner Box nachmessen):

| Wert | Standard |
|---|---|
| Innenmaß am Boden | 355 × 255 mm |
| Innenlänge oben (Wandschräge) | ca. 363 mm (12er) |
| Innenhöhe | 115 mm (12er), 165 mm (17er) |
| Stapel-Freiraum | 15 mm |
| Wand / Boden / Trennwand | 1,6 / 1,2 / 1,2 mm |
| Spiel zwischen Teilen | 0,6 mm |
| Druckbett | 256 mm |

## Drucken

Offene Seite nach oben, ohne Stützen. Griffmulden und Beschriftungsfelder sind eigene Körper, die mit Wand und Boden überlappen. Gängige Slicer (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura) vereinen sie automatisch.

## Online stellen

Über GitHub Pages: Repository-Einstellungen → Pages → Branch wählen, Ordner `/ (root)`.
