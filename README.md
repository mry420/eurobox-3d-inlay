# Eurobox Inlay Generator

Browser-Generator für stapelbare 3D-Druck-Einsätze in Euroboxen, z. B. um Kabel, Netzteile und Kleinteile zu sortieren. Grundflächen **30 × 20, 40 × 30, 60 × 40, 80 × 60 cm** oder eigene Maße, die Höhe der Box stellst du per Schieberegler ein.

Einfach `index.html` im Browser öffnen, ohne Installation und ohne Build. Three.js wird vom CDN geladen.

## Funktionen

- **Vorlagen**: Kabel-Bahnen, Kabel & Netzteile, Ladegeräte, Gemischt, Kleinteile, Zwei Ebenen, Drei Ebenen, eigenes Raster
- **Ebenen, verzahnt stapelbar**: Einsätze in bis zu 4 Lagen übereinander. Verzahnte Ebenen haben denselben Grundriss wie die Ebene darunter: Die unteren Teile bekommen oben einen 4 mm hohen Stapelrand, die oberen Teile unten einen passenden Fuß (0,4 mm Spiel). So sitzen die Behälter formschlüssig aufeinander und lassen sich einzeln herausheben. Nicht verzahnte Ebenen haben ein eigenes Layout und liegen flach auf.
- **3D-Vorschau in der Box**: Ansicht ohne Box, in einer Eurobox oder im Schnitt, mit wählbarer Filament- und Boxfarbe.
- **Bündiger Sitz in der Box**: Die Außenwände der Randteile folgen der Wandschräge der Eurobox, die Eckteile dem Eckradius der Box. Dadurch verrutscht nichts.
- **Stapelbare Boxen**: Die Einsätze enden unter der Stapelgrenze, damit die nächste Eurobox noch draufpasst. Ohne Stapeln (Schalter aus) nutzen sie die volle Innenhöhe.
- **Automatisch druckbar**: Teile, die größer als das Druckbett sind, werden automatisch geteilt.
- **Layout-Editor**: Teile teilen, verbinden, entfernen, hinzufügen. Fächer pro Teil, Griffmulde vorne, Beschriftungsfeld hinten, Höhe der obersten Ebene (voll, ¾, ½, ⅓).
- **Druckbett-Prüfung**: Teile, die größer als dein Druckbett sind, werden markiert.
- **Wand folgt der Box-Schräge**: Auch die Fächer der Randteile laufen schräg mit, die Wand bleibt überall gleich dünn. Das spart rund ein Viertel Filament.
- **Filamentverbrauch**: Gramm pro Teil und gesamt (PLA, 1,24 g/cm³).
- **Rückgängig/Wiederholen**: Knöpfe oder ⌘Z / Strg+Z, ⇧⌘Z / Strg+Y.
- **Design speichern und öffnen** als JSON-Datei, zum Weitergeben an andere.
- **Nächste Box darüber** als durchsichtige Vorschau, damit man den Stapelplatz sieht.
- **Export**: ZIP mit einer STL pro Teil-Variante (gleiche Teile nur einmal, Stückzahl im Dateinamen) plus Stückliste mit Gewicht.
- Hell und dunkel, läuft auch auf dem Handy. Einstellungen bleiben im Browser gespeichert.

## Maße

### Wie hoch dürfen die Einsätze sein?

Steht eine Eurobox auf einer anderen, ragt ihr Fuß in die untere Box hinein. Auer nennt in seinen Datenblättern die „nutzbare Innenhöhe im Stapel“:

| Box | Außenhöhe | nutzbar im Stapel | Verlust |
|---|---|---|---|
| 40 × 30 | 120 mm | 93 mm | 27 mm |
| 40 × 30 | 170 mm | 143 mm | 27 mm |
| 40 × 30 | 220 mm | 193 mm | 27 mm |
| 60 × 40 | 170 mm | 153 mm | 17 mm |
| 60 × 40 | 220 mm | 203 mm | 17 mm |
| 60 × 40 | 320 mm | 303 mm | 17 mm |

Der Generator rechnet daher mit **Außenhöhe − 27 mm** (30 × 20 und 40 × 30) bzw. **Außenhöhe − 17 mm** (60 × 40 und 80 × 60). Das deckt sich mit Einsätzen von 58 mm für 75 mm hohe Boxen. Andere Hersteller können abweichen: Leere Box draufstellen, vom Boden der unteren Box bis zur tiefsten Stelle der oberen messen und den Wert unter „Maße & Druck anpassen“ eintragen. Für 30 × 20 und 80 × 60 sind die Werte übernommen, nicht aus einem Datenblatt.

### Standardwerte

Alles unter „Maße & Druck anpassen“ änderbar, am besten an deiner Box nachmessen:

| Grundfläche | Innenmaß am Boden (geschätzt) | Eckradius innen |
|---|---|---|
| 30 × 20 | 255 × 155 mm | 10 mm |
| 40 × 30 | 355 × 255 mm | 12 mm |
| 60 × 40 | 555 × 355 mm | 14 mm |
| 80 × 60 | 755 × 555 mm | 16 mm |

Weitere Werte: Wandschräge 3,5 mm je 100 mm Höhe, Boxboden 5 mm, Wand / Boden / Trennwand der Einsätze 1,6 / 1,2 / 1,2 mm, Spiel 0,6 mm, Druckbett 256 mm.

## Drucken

Offene Seite nach oben, ohne Stützen. Griffmulden und Beschriftungsfelder sind eigene Körper, die mit Wand und Boden überlappen. Gängige Slicer (Bambu Studio, OrcaSlicer, PrusaSlicer, Cura) vereinen sie automatisch.

## Online stellen

Über GitHub Pages: Repository-Einstellungen → Pages → Branch wählen, Ordner `/ (root)`.
