// Baut eine einzelne HTML-Datei für die Vorschau als Claude-Artifact:
// CSS und JS werden eingebettet, three.js kommt vom erlaubten CDN,
// Dinge, die nur auf der eigenen Webseite Sinn ergeben, fliegen raus.
// Aufruf: node tools/build-artifact.mjs <ausgabe.html>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2];
if (!out) { console.error('Ausgabedatei fehlt'); process.exit(1); }

const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');

// Stylesheets und Skripte einbetten
html = html.replace(/<link rel="stylesheet" href="(assets\/[^"]+)">/g, (_, p) => `<style>\n${read(p)}</style>`);
html = html.replace('<script src="assets/vendor/three.min.js"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js"></script>');
html = html.replace(/<script src="(assets\/js\/[^"]+)"( defer)?><\/script>/g, (_, p) => `<script>\n${read(p).replace(/<\/script/gi, '<\\/script')}</script>`);

// Nur-Webseite-Teile entfernen (markiert mit <!--site-only-->…<!--/site-only-->)
html = html.replace(/<!--site-only-->[\s\S]*?<!--\/site-only-->/g, '');

// Dokumentgerüst entfernen, das Artifact bringt sein eigenes mit
html = html
  .replace(/^<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body[^>]*>\s*/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '');

fs.writeFileSync(out, html);
console.log(`Artifact gebaut: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
