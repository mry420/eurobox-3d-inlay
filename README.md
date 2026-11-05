# Eurobox Inlay Generator

Kostenloser Web-Generator für **stapelbare 3D-Druck-Einsätze in Euroboxen** (Eurobehälter nach VDA 4500), zum Beispiel für Kabel, Netzteile, Werkzeug und Kleinteile. Läuft komplett im Browser, auf Deutsch und Englisch.

## Funktionen

- **Alle gängigen Größen**: Grundflächen 30 × 20, 40 × 30, 60 × 40 und 80 × 60 cm oder eigene Innenmaße, Außenhöhe per Schieberegler von 50 bis 450 mm.
- **Box bleibt stapelbar**: Die Einsatzhöhe richtet sich nach Herstellerdaten (Auer: Außenhöhe − 27 mm bei 30 × 20/40 × 30, − 17 mm bei 60 × 40/80 × 60) und ist einstellbar. Eine Seitenansicht zeigt live, wo die nächste Box aufsitzt.
- **Bündiger Sitz**: Randteile folgen der Wandschräge und dem Eckradius der Box. Die Wände bleiben überall gleich dünn.
- **Ebenen, verzahnt stapelbar**: Bis zu vier Lagen. Verzahnte Ebenen bekommen unten einen Stapelrand und oben einen passenden Fuß.
- **Vorlagen**: Kabel-Bahnen, Kabel & Netzteile, Ladegeräte, Gemischt, Kleinteile, Werkstatt, Zwei Ebenen, Drei Ebenen, eigenes Raster.
- **Editor**: Teile teilen, verbinden, entfernen, Fächer pro Teil, Griffmulde, Beschriftungsfeld mit **erhabener Schrift** (z. B. „USB-C“), Höhe der obersten Ebene, Rückgängig und Wiederholen.
- **Druckerprofile**: Bambu Lab, Prusa, Creality, Elegoo, Voron oder eigene Maße. Zu große Teile werden automatisch geteilt.
- **Export**: ZIP mit STL je Teil-Variante (Stückzahl im Dateinamen, Stückliste mit Farbwechsel-Höhe) oder eine **3MF-Datei** mit allen Teilen in richtiger Anzahl, auf Druckbetten verteilt.
- **3D-Vorschau** in einer Eurobox, im Schnitt oder ohne Box, mit Filament- und Boxfarbe und der nächsten Box als Geist.
- **Teilen**: Design als Datei speichern und öffnen oder als Link kopieren.
- Filamentverbrauch, Kosten und grobe Druckzeit, hell und dunkel, Handy-tauglich, offline nutzbar (PWA).

## Aufbau

| Pfad | Inhalt |
|---|---|
| `index.html` | Seite mit Generator, Anleitung, FAQ, Footer |
| `assets/js/app.js` | Generator, Geometrie, Export, 3D-Vorschau |
| `assets/js/i18n.js` | Alle Texte auf Deutsch und Englisch |
| `assets/js/config.js` | Werbung, Domain, Spendenlink |
| `assets/js/font.js` | Schrift für Beschriftungen (Droid Sans Bold, Apache 2.0) |
| `assets/vendor/three.min.js` | three.js r159 (MIT), lokal, kein CDN nötig |
| `impressum.html`, `datenschutz.html` | Vorlagen zum Ausfüllen |
| `sw.js`, `manifest.webmanifest` | Offline-Nutzung und App-Installation |
| `tests/` | End-to-End-Test und Prüfung der exportierten Körper |
| `tools/build-artifact.mjs` | baut eine Einzeldatei für die Claude-Vorschau |
| `docs/LAUNCH.md` | **Anleitung zum Veröffentlichen mit Domain und Werbung** |

Es gibt keinen Build-Schritt: `index.html` im Browser öffnen oder den Ordner auf einen beliebigen Webspace legen.

## Entwickeln und testen

```bash
npm i -D playwright
node tests/e2e.mjs tests/out          # Bedienung, Sprachen, Exporte
python3 tests/check_meshes.py tests/out  # alle STL/3MF-Körper geschlossen?
```

## Lizenzen

- three.js: MIT (`assets/vendor/three.LICENSE`)
- Droid Sans: Apache License 2.0 (`assets/vendor/droid-sans.NOTICE`)
