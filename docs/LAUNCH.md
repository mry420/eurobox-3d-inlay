# Veröffentlichen mit eigener Domain und Werbung

Diese Checkliste führt vom Repository zur öffentlichen Webseite mit Google AdSense. Sie ist kein Rechtsrat. Bei Fragen zu Impressum, Datenschutz oder Steuern hilft eine Fachperson.

## 1. Online stellen (kostenlos mit GitHub Pages)

1. Den Branch nach `main` übernehmen (Pull Request mergen).
2. Im Repository: **Settings → Pages → Build and deployment**: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft die Seite unter `https://<benutzer>.github.io/eurobox-3d-inlay/`.

Hinweis: GitHub Pages ist für private Repositories nur in bezahlten Tarifen verfügbar. Alternativ funktionieren Netlify, Cloudflare Pages oder jeder Webspace, denn es sind nur statische Dateien. Es gibt keinen Build-Schritt.

## 2. Eigene Domain (empfohlen für AdSense)

1. Domain kaufen, zum Beispiel `eurobox-inlay.de`.
2. In **Settings → Pages → Custom domain** eintragen und „Enforce HTTPS“ aktivieren.
3. Beim Domain-Anbieter die DNS-Einträge setzen, die GitHub anzeigt (`A`-Records auf GitHub Pages oder `CNAME` auf `<benutzer>.github.io`).
4. In `sitemap.xml` und `robots.txt` `DEINE-DOMAIN` ersetzen.
5. In `assets/js/config.js` `siteUrl` eintragen.

## 3. Rechtliches (Deutschland)

Mit Werbung gilt die Seite als geschäftsmäßig. Daraus folgt:

- **Impressum** (`impressum.html`): alle gelb markierten Platzhalter ausfüllen. Name und ladungsfähige Anschrift sind Pflicht, außerdem eine E-Mail-Adresse und ein zweiter schneller Kontaktweg.
- **Datenschutzerklärung** (`datenschutz.html`): Platzhalter ausfüllen, Hoster prüfen. Abschnitt 5 (AdSense) beschreibt die Werbung.
- **Einwilligung für Werbung**: Für Besucher aus EU, EWR, UK und der Schweiz verlangt Google eine zertifizierte Einwilligungsplattform (CMP). Am einfachsten ist die kostenlose Lösung in AdSense selbst, siehe Schritt 4.
- **Steuern/Gewerbe**: Werbeeinnahmen sind Einnahmen. Kläre mit dem Finanzamt oder einer Steuerberatung, ob ein Gewerbe nötig ist und wie die Einnahmen anzugeben sind.

## 4. Google AdSense einrichten

1. Konto anlegen unter <https://adsense.google.com> und die Domain hinzufügen.
2. **Publisher-ID** (`ca-pub-…`) in `assets/js/config.js` bei `adsenseClient` eintragen.
3. `ads.txt.example` in `ads.txt` umbenennen und die ID eintragen.
4. **Datenschutz & Mitteilungen → Einwilligung nach DSGVO**: Mitteilung erstellen und für die Domain veröffentlichen. Google blendet den Einwilligungsdialog dann automatisch ein. Der Footer-Link „Datenschutz-Einstellungen“ öffnet ihn erneut.
5. Nach der Freigabe unter **Anzeigen → Nach Anzeigenblock** drei Display-Anzeigenblöcke anlegen und ihre IDs in `adSlots` eintragen:
   - `banner`: volle Breite unter dem Generator
   - `sidebar`: unten in der Seitenleiste
   - `footer`: vor dem Seitenende
6. Auto-Anzeigen in AdSense besser ausschalten. Sie können sonst mitten im Werkzeug erscheinen und die Bedienung stören.

Solange `adsenseClient` leer ist, lädt die Seite keine Werbung und keine fremden Skripte. Leere Werbeplätze werden ausgeblendet.

## 5. Vor dem Start prüfen

```bash
# im Repository-Ordner
npm i -D playwright        # einmalig, Chromium wird mitgeladen
node tests/e2e.mjs tests/out
python3 tests/check_meshes.py tests/out
```

Danach die Seite auf dem Handy öffnen, einmal ein Eckteil drucken und den Sitz in einer echten Box prüfen.

## 6. Nach dem Start

- In der **Google Search Console** die Domain bestätigen und `sitemap.xml` einreichen.
- Bei Änderungen an den Dateien in `sw.js` die Versionsnummer `CACHE` erhöhen (`ebx-v2`, …), damit installierte Apps sicher aktualisieren.
- Reichweite: Die Seite in 3D-Druck-Communities vorstellen (Reddit r/3Dprinting und r/BambuLab, Printables, MakerWorld, Facebook-Gruppen) und dort Beispiel-Drucke zeigen.
