// End-to-End-Test: node tests/e2e.mjs <ausgabeordner>
// Braucht Playwright (Chromium). Prüft Fehler, Sprachen, Bedienung und Exporte.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'tests', 'out'));
fs.mkdirSync(out, { recursive: true });
const url = 'file://' + path.join(root, 'index.html');
const errs = [];
const ok = (cond, msg) => { if (!cond) { errs.push('FEHLER: ' + msg); console.log('✗', msg); } else console.log('✓', msg); };

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, locale: 'de-DE' });
const page = await ctx.newPage();
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(1500);
const dl = async (sel, name) => { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); const f = path.join(out, name || d.suggestedFilename()); await d.saveAs(f); return f; };

ok(await page.locator('canvas').count() === 1, '3D-Ansicht vorhanden');
ok((await page.textContent('#h-box')).includes('Deine Box'), 'Deutsch als Startsprache');
await page.click('#lang-en'); await page.waitForTimeout(200);
ok((await page.textContent('#h-box')).includes('Your box'), 'Umschalten auf Englisch');
ok((await page.textContent('#tpl-kabel')).includes('Cable lanes'), 'Vorlagen übersetzt');
await page.click('#lang-de'); await page.waitForTimeout(200);

// Druckerprofil
await page.selectOption('#printer', 'bambu-mini'); await page.waitForTimeout(200);
ok((await page.textContent('#bed-info')).includes('180'), 'Druckerprofil A1 mini gesetzt');
const fitsAll = await page.evaluate(() => window.__ebx.parts().parts.every(p => { const s = p.spec; const w = s.top[2] - s.top[0], h = s.top[3] - s.top[1]; return Math.max(w, h) <= 177 && Math.min(w, h) <= 177; }));
ok(fitsAll, 'Alle Teile passen aufs kleine Bett');
await page.selectOption('#printer', 'bambu'); await page.waitForTimeout(200);

// Beschriftung
await page.click('#tpl-lader'); await page.click('#plan g.bin >> nth=0'); await page.waitForTimeout(200);
await page.fill('#ed-txt-0', 'USB-C'); await page.fill('#ed-txt-1', 'HDMI'); await page.waitForTimeout(600);
ok(await page.evaluate(() => window.__ebx.parts().parts.some(p => p.spec.texts.includes('USB-C'))), 'Beschriftung im Teil');
ok(await page.inputValue('#ed-txt-1') === 'HDMI', 'Eingabe bleibt beim Tippen erhalten');
await page.screenshot({ path: path.join(out, 'desktop-label.png') });

// Exporte
const zip = await dl('#dl-all'); ok(fs.statSync(zip).size > 1000, 'STL-ZIP geladen');
const mf = await dl('#dl-3mf'); ok(fs.statSync(mf).size > 1000, '3MF geladen');
for (const tp of ['kabel', 'netzteile', 'gemischt', 'kleinteile', 'werkstatt', 'zwei', 'drei', 'raster']) {
  await page.click('#tpl-' + tp); await page.waitForTimeout(100);
  await dl('#dl-all', `tpl-${tp}.zip`);
}
await page.click('#hc-220'); await page.click('#tpl-zwei'); await page.waitForTimeout(200);
await dl('#dl-3mf', 'zwei-220.3mf');
const fit = await dl('#dl-test', 'fit-test.zip'); ok(fs.statSync(fit).size > 500, 'Passform-Test geladen');

// Rückgängig, Design speichern/öffnen
await page.click('#layer-0');
const n0 = await page.locator('#plan g.bin').count();
await page.click('#plan g.bin >> nth=0'); await page.click('#ed-split-x'); await page.click('#undo');
ok(await page.locator('#plan g.bin').count() === n0, 'Rückgängig');
const design = await dl('#design-save', 'design.json');
await page.click('#tpl-kabel');
await page.setInputFiles('#design-file', design); await page.waitForTimeout(300);
ok(await page.locator('#layer-seg button').count() === 2, 'Design wieder geöffnet');

// Ansichten
for (const v of ['none', 'box', 'cut']) { await page.click('#view-' + v); await page.waitForTimeout(150); }
await page.click('#view-box');
await page.screenshot({ path: path.join(out, 'desktop.png') });
await page.screenshot({ path: path.join(out, 'desktop-full.png'), fullPage: true });

// Handy, dunkel, Englisch
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'en-US' });
const mp = await m.newPage();
mp.on('pageerror', e => errs.push('mobile pageerror: ' + e.message));
await mp.goto(url); await mp.waitForTimeout(1500);
ok(await mp.evaluate(() => document.documentElement.scrollWidth) <= 390, 'Kein seitliches Scrollen am Handy');
ok((await mp.textContent('#h-box')).includes('Your box'), 'Englisch bei englischem Browser');
await mp.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });

await browser.close();
console.log(errs.length ? errs.join('\n') : 'Alles in Ordnung');
process.exit(errs.length ? 1 : 0);
