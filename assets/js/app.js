(() => {
'use strict';
const HAS3D = typeof THREE !== 'undefined';
const CFG = Object.assign({ adsenseClient: '', adSlots: {}, siteUrl: '', donateUrl: '' }, window.EBX_CONFIG || {});
// In der Claude-Vorschau gibt es keine Werbung, keinen Service Worker und keine Teilen-Links
const IN_ARTIFACT = !!window.claude || /claude|anthropic/i.test(location.hostname);
const ON_WEB = /^https?:$/.test(location.protocol) && !IN_ARTIFACT;

/* ---------- Sprache ---------- */
const I18N = window.EBX_I18N || { de: {}, en: {} };
const LANG_KEY = 'ebx-lang';
let LANG = (() => {
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'de' || s === 'en') return s; } catch { /* egal */ }
  return /^de\b/i.test(navigator.language || '') ? 'de' : 'en';
})();
const t = (k, v = {}) => String((I18N[LANG] && I18N[LANG][k]) ?? I18N.de[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => v[n] ?? '');
// Einzahl/Mehrzahl: Wörterbuch-Eintrag "Teil|Teile"
const tn = (k, n, v = {}) => { const p = t(k, { n, ...v }).split('|'); return (n === 1 ? p[0] : p[1] ?? p[0]); };
const locale = () => (LANG === 'de' ? 'de-DE' : 'en-US');

/* ---------- Grundwerte ---------- */
const DEFAULTS = {
  foot: '43', stacked: true,
  L: 355, W: 255, outerH: 120, stackLoss: 27,
  slope: 3.5,            // Wandschräge der Box: mm nach außen je 100 mm Höhe und Seite
  wall: 1.6, floor: 1.2, divider: 1.2, gap: 0.6, stackGap: 0.4,
  radius: 4, boxRadius: 12, holeRadius: 2,
  printer: 'bambu', bedX: 256, bedY: 256, bedZ: 256,
};
const DIM_KEYS = Object.keys(DEFAULTS).filter(k => typeof DEFAULTS[k] === 'number');
// Innenmaße am Boden geschätzt; Stapelverlust nach Auer-Datenblättern ("nutzbare Innenhöhe im Stapel")
const FOOTPRINTS = [
  { id: '32', name: '30 × 20', L: 255, W: 155, boxRadius: 10, stackLoss: 27 },
  { id: '43', name: '40 × 30', L: 355, W: 255, boxRadius: 12, stackLoss: 27 },
  { id: '64', name: '60 × 40', L: 555, W: 355, boxRadius: 14, stackLoss: 17 },
  { id: '86', name: '80 × 60', L: 755, W: 555, boxRadius: 16, stackLoss: 17 },
];
const HEIGHTS = [75, 120, 170, 220, 270, 320, 420];
// Bauraum in mm (Herstellerangaben)
const PRINTERS = [
  { id: 'bambu-mini', name: 'Bambu Lab A1 mini', x: 180, y: 180, z: 180 },
  { id: 'bambu', name: 'Bambu Lab A1 / P1S / X1C', x: 256, y: 256, z: 256 },
  { id: 'bambu-h2d', name: 'Bambu Lab H2D', x: 325, y: 320, z: 325 },
  { id: 'prusa-mk4', name: 'Prusa MK4S', x: 250, y: 210, z: 220 },
  { id: 'prusa-core', name: 'Prusa Core One', x: 250, y: 220, z: 270 },
  { id: 'prusa-mini', name: 'Prusa MINI+', x: 180, y: 180, z: 180 },
  { id: 'ender3v3', name: 'Creality Ender-3 V3', x: 220, y: 220, z: 250 },
  { id: 'k1', name: 'Creality K1 / K1C', x: 220, y: 220, z: 250 },
  { id: 'k1max', name: 'Creality K1 Max', x: 300, y: 300, z: 300 },
  { id: 'neptune4', name: 'Elegoo Neptune 4 Pro', x: 225, y: 225, z: 265 },
  { id: 'voron350', name: 'Voron 2.4 (350)', x: 350, y: 350, z: 340 },
];
const BED_MARGIN = 3; // Platz für Skirt/Brim
const FILAMENTS = [
  { id: 'weiss', c: '#f1f1ee' }, { id: 'grau', c: '#9a9da2' }, { id: 'schwarz', c: '#2e2e31' },
  { id: 'blau', c: '#2f7cf6' }, { id: 'orange', c: '#f3922b' }, { id: 'gruen', c: '#3fb36b' },
];
const BOXCOLORS = [{ id: 'grau', c: '#8b9096' }, { id: 'blau', c: '#2b62c4' }, { id: 'rot', c: '#c63a31' }, { id: 'schwarz', c: '#2b2c2f' }];
const BOX_FLOOR = 5;
const MIN_LAYER = 15, MAX_LAYERS = 4, MAX_CELLS = 24, MIN_COMP = 8;
const LABEL_D = 12, LABEL_T = 1.2, TEXT_H = 0.8, TEXT_MAX = 18;
// Verzahnung: Stapelrand oben am unteren Teil, passender Fuß unten am oberen Teil
const LIP_H = 4, LEDGE = 2, FOOT_H = LIP_H + 0.4;
const PLA = 1.24; // g/cm³

const b = (x, y, w, h, dx = 1, dy = 1, hp = 100, scoop = false, label = false) => ({ x, y, w, h, dx, dy, hp, scoop, label });
const grid = (cols, rows, fn) => { const r = []; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) r.push(fn(x, y)); return r; };
const TEMPLATES = [
  { id: 'kabel', layers: [{ f: 1, cols: 2, rows: 3, bins: grid(2, 3, (x, y) => b(x, y, 1, 1)) }] },
  { id: 'netzteile', layers: [{ f: 1, cols: 4, rows: 3, bins: [b(0,0,2,1), b(2,0,2,1), b(0,1,1,2), b(1,1,1,2), b(2,1,1,2), b(3,1,1,2)] }] },
  { id: 'lader', layers: [{ f: 1, cols: 3, rows: 2, bins: grid(3, 2, (x, y) => b(x, y, 1, 1, 1, 2, 100, false, true)) }] },
  { id: 'gemischt', layers: [{ f: 1, cols: 4, rows: 4, bins: [b(0,0,2,2), b(2,0,2,1,2,1), b(2,1,1,1), b(3,1,1,1), b(0,2,1,2), b(1,2,1,2), b(2,2,2,2,1,2)] }] },
  { id: 'kleinteile', layers: [{ f: 1, cols: 6, rows: 4, bins: grid(6, 4, (x, y) => b(x, y, 1, 1, 1, 1, 100, true, true)) }] },
  { id: 'werkstatt', layers: [{ f: 1, cols: 4, rows: 3, bins: [b(0,0,2,1,2,1), b(2,0,2,1,2,1), b(0,1,2,2,2,1, 100, true), b(2,1,1,1,1,1,100,true,true), b(3,1,1,1,1,1,100,true,true), b(2,2,1,1,1,1,100,true,true), b(3,2,1,1,1,1,100,true,true)] }] },
  { id: 'zwei', multi: true, layers: [
    { f: 0.6, cols: 4, rows: 2, bins: grid(4, 2, (x, y) => b(x, y, 1, 1)) },
    { f: 0.4, lock: true, cols: 4, rows: 2, bins: grid(4, 2, (x, y) => b(x, y, 1, 1, 1, 2, 100, true, true)) },
  ] },
  { id: 'drei', multi: true, layers: [
    { f: 0.45, cols: 3, rows: 2, bins: grid(3, 2, (x, y) => b(x, y, 1, 1)) },
    { f: 0.3, lock: true, cols: 3, rows: 2, bins: grid(3, 2, (x, y) => b(x, y, 1, 1, 1, 2)) },
    { f: 0.25, lock: true, cols: 3, rows: 2, bins: grid(3, 2, (x, y) => b(x, y, 1, 1, 2, 1, 100, true, false)) },
  ] },
  { id: 'raster', grid: true },
];

const STORE_KEY = 'eurobox-inlay-v5';
const OLD_KEYS = ['eurobox-inlay-v4'];
let nextId = 1;
const nid = () => nextId++;
const withIds = bins => bins.map(o => ({ ...o, texts: [], id: nid() }));
const gridLayout = (cols, rows) => ({ cols, rows, bins: withIds(grid(cols, rows, (x, y) => b(x, y, 1, 1))) });

function freshState() {
  const tp = TEMPLATES[0];
  return { ...structuredClone(DEFAULTS), gridCols: 4, gridRows: 3, active: 0, selected: null, explode: false,
    view: 'box', fil: 'weiss', boxc: 'grau', ghost: false,
    layers: tp.layers.map(l => ({ f: l.f, tpl: tp.id, edited: false, lock: !!l.lock, layout: { cols: l.cols, rows: l.rows, bins: withIds(l.bins) } })) };
}
function loadState() {
  try {
    let raw = localStorage.getItem(STORE_KEY);
    if (!raw) for (const k of OLD_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch { return null; }
}
const clampNum = (v, a, z) => Math.min(z, Math.max(a, v));
function normalize(s) {
  try {
    if (!s || !Array.isArray(s.layers) || !s.layers.length || s.layers.length > MAX_LAYERS) return null;
    if (!s.layers.every(l => l && l.layout && Array.isArray(l.layout.bins) && l.layout.cols > 0 && l.layout.rows > 0 && l.layout.cols <= MAX_CELLS && l.layout.rows <= MAX_CELLS)) return null;
    if (typeof s.bed === 'number' && typeof s.bedX !== 'number') { s.bedX = s.bedY = s.bedZ = s.bed; s.printer = 'custom'; }
    for (const k of DIM_KEYS) if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = DEFAULTS[k];
    s.outerH = clampNum(Math.round(s.outerH), 50, 450);
    if (typeof s.foot !== 'string') s.foot = '43';
    if (typeof s.printer !== 'string') s.printer = DEFAULTS.printer;
    s.stacked = s.stacked !== false;
    if (!['box', 'none', 'cut'].includes(s.view)) s.view = 'box';
    if (!FILAMENTS.some(f => f.id === s.fil)) s.fil = 'weiss';
    if (!BOXCOLORS.some(f => f.id === s.boxc)) s.boxc = 'grau';
    s.active = Math.min(Math.max(0, s.active | 0), s.layers.length - 1);
    const all = s.layers.flatMap(l => l.layout.bins);
    for (const o of all) {
      for (const k of ['x', 'y', 'w', 'h', 'dx', 'dy']) o[k] = Math.max(k === 'x' || k === 'y' ? 0 : 1, Math.round(Number(o[k]) || 0));
      o.hp = [100, 75, 50, 33].includes(o.hp) ? o.hp : 100;
      o.scoop = !!o.scoop; o.label = !!o.label;
      o.texts = Array.isArray(o.texts) ? o.texts.slice(0, 144).map(x => String(x || '').slice(0, TEXT_MAX)) : [];
    }
    nextId = Math.max(0, ...all.map(o => Number(o.id) || 0)) + 1;
    all.forEach(o => { if (!o.id) o.id = nid(); });
    s.layers.forEach(l => {
      l.lock = !!l.lock; l.edited = !!l.edited;
      if (typeof l.f !== 'number' || !(l.f > 0)) l.f = 1 / s.layers.length;
      l.layout.bins = l.layout.bins.filter(o => o.x + o.w <= l.layout.cols && o.y + o.h <= l.layout.rows);
    });
    if (typeof s.gridCols !== 'number') s.gridCols = 4;
    if (typeof s.gridRows !== 'number') s.gridRows = 3;
    s.ghost = !!s.ghost; s.explode = !!s.explode; s.selected = null;
    return s;
  } catch { return null; }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { /* Speicher nicht verfügbar */ }
}
let S = loadState() || freshState();

/* ---------- Abgeleitete Maße ---------- */
const r2 = v => Math.round(v * 100) / 100;
const fmt = v => (Math.round(v * 10) / 10).toLocaleString(locale());
const innerH = () => S.outerH - BOX_FLOOR;
const maxH = () => Math.max(MIN_LAYER, Math.min(innerH(), S.stacked ? S.outerH - S.stackLoss : innerH()));
const footName = () => (FOOTPRINTS.find(f => f.id === S.foot) || { name: `${Math.round(S.L)} × ${Math.round(S.W)}` }).name;
const grow = z => S.slope * z / 100;
const lay = () => S.layers[S.active].layout;
const isTop = li => li === S.layers.length - 1;

function layerHeights() {
  const m = maxH();
  const sumF = S.layers.reduce((a, l) => a + l.f, 0) || 1;
  const hs = S.layers.map(l => r2(l.f / sumF * m));
  hs[hs.length - 1] = r2(m - hs.slice(0, -1).reduce((a, v) => a + v, 0));
  return hs;
}
function setHeights(hs) {
  const m = maxH();
  S.layers.forEach((l, i) => { l.f = hs[i] / m; });
}
function layerBase(li) { return layerHeights().slice(0, li).reduce((a, v) => a + v, 0); }

function binSpec(bin, li) {
  const { cols, rows } = S.layers[li].layout;
  const cw = S.L / cols, ch = S.W / rows;
  const hs = layerHeights();
  const zb = hs.slice(0, li).reduce((a, v) => a + v, 0);
  const hp = isTop(li) ? bin.hp : 100;
  const foot = li > 0 && !!S.layers[li].lock;
  const lip = li < S.layers.length - 1 && !!S.layers[li + 1].lock;
  const H = r2(hs[li] * hp / 100 + (foot ? LIP_H : 0));
  const bw = r2(bin.w * cw - S.gap), bh = r2(bin.h * ch - S.gap);
  const R = Math.max(0.5, S.radius), BR = Math.max(R, S.boxRadius);
  const left = bin.x === 0, right = bin.x + bin.w === cols, back = bin.y === 0, front = bin.y + bin.h === rows;
  // Modellecken: vorne-links, vorne-rechts, hinten-rechts, hinten-links (hinten = oben im Plan)
  const radii = [front && left ? BR : R, front && right ? BR : R, back && right ? BR : R, back && left ? BR : R];
  // Randteile wachsen mit der Wandschräge der Box nach außen
  const ext = z => [left ? -grow(z) : 0, front ? -grow(z) : 0, bw + (right ? grow(z) : 0), bh + (back ? grow(z) : 0)].map(r2);
  const n = bin.dx * bin.dy;
  const texts = bin.label && HAS3D && window.EBX_FONT ? Array.from({ length: n }, (_, i) => (bin.texts && bin.texts[i] || '').trim()) : [];
  return {
    bw, bh, H, dx: bin.dx, dy: bin.dy, radii, base: ext(foot ? zb - LIP_H + FOOT_H : zb), top: ext(zb + hs[li] * hp / 100),
    wall: S.wall, wi: S.wall + (foot || lip ? LEDGE : 0), foot, lip, sg: foot ? S.stackGap : 0,
    floor: S.floor, div: S.divider, hr: S.holeRadius, scoop: !!bin.scoop, label: !!bin.label,
    texts: texts.some(Boolean) ? texts : [],
  };
}
const specKey = s => [s.bw, s.bh, s.H, s.dx, s.dy, s.radii.join('/'), s.base.join('/'), s.top.join('/'),
  s.wall, s.wi, s.floor, s.div, s.hr, s.scoop ? 'S' : '', s.label ? 'L' : '', s.foot ? 'F' + s.sg : '', s.lip ? 'R' : '',
  s.texts.length ? JSON.stringify(s.texts) : ''].join('|');
const compartment = s => ({
  w: (s.bw - 2 * s.wi - (s.dx - 1) * s.div) / s.dx,
  h: (s.bh - 2 * s.wi - (s.dy - 1) * s.div) / s.dy,
});
const outerSize = s => ({ w: s.top[2] - s.top[0], h: s.top[3] - s.top[1] });
const bedFit = (w, h) => { const X = S.bedX - BED_MARGIN, Y = S.bedY - BED_MARGIN; return (w <= X && h <= Y) || (w <= Y && h <= X); };
const fitsXY = s => { const o = outerSize(s); return bedFit(o.w, o.h); };
const fitsBed = s => fitsXY(s) && s.H <= S.bedZ;
const depth = s => s.H - (s.lip ? LIP_H : 0) - s.floor;
const scoopR = (s, c) => Math.min(18, c.h * 0.4, depth(s) * 0.6);
const scoopOk = (s, c) => scoopR(s, c) >= 5;
const labelOk = (s, c) => c.h >= LABEL_D + 12 && depth(s) >= LABEL_D + LABEL_T + 8;
const maxDiv = (len, wall, div) => Math.max(1, Math.min(12, Math.floor((len - 2 * wall + div) / (MIN_COMP + div))));

/* ---------- Geometrie ---------- */
// Abgerundetes Rechteck, gegen den Uhrzeigersinn, immer gleich viele Punkte (für die schräge Außenwand)
function rrect(x0, y0, x1, y1, radii, seg = 8) {
  const m = Math.min(x1 - x0, y1 - y0) / 2 - 0.05;
  const corners = [[x0, y0, 180, 1, 1], [x1, y0, 270, -1, 1], [x1, y1, 0, -1, -1], [x0, y1, 90, 1, -1]];
  const pts = [];
  corners.forEach(([cx, cy, a0, sx, sy], i) => {
    const r = Math.max(0.3, Math.min(radii[i], m));
    const ox = cx + sx * r, oy = cy + sy * r;
    for (let k = 0; k <= seg; k++) {
      const a = (a0 + 90 * k / seg) * Math.PI / 180;
      pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
    }
  });
  return pts;
}
// Profil in der Y-Z-Ebene (gegen den Uhrzeigersinn, vom ersten Punkt aus fächerbar) entlang X extrudieren
function extrudeX(tri, prof, xa, xb) {
  const n = prof.length, A = p => [xa, p[0], p[1]], B = p => [xb, p[0], p[1]];
  for (let k = 1; k < n - 1; k++) { tri(B(prof[0]), B(prof[k]), B(prof[k + 1])); tri(A(prof[0]), A(prof[k + 1]), A(prof[k])); }
  for (let k = 0; k < n; k++) {
    const a = prof[k], q = prof[(k + 1) % n];
    tri(A(a), A(q), B(q)); tri(A(a), B(q), B(a));
  }
}
// Text als Umrisse aus der eingebetteten Schrift (Nachbau von THREE.Font.generateShapes)
const shapeCache = new Map();
function textShapes(str) {
  if (shapeCache.has(str)) return shapeCache.get(str);
  const F = window.EBX_FONT, scale = 10 / F.resolution, shapes = [];
  let ox = 0;
  for (const ch of Array.from(str)) {
    const g = F.glyphs[ch] || F.glyphs['?'];
    if (!g) continue;
    const path = new THREE.ShapePath();
    if (g.o) {
      const o = g.o.split(' ');
      for (let i = 0; i < o.length;) {
        const a = o[i++], X = () => o[i++] * scale + ox, Y = () => o[i++] * scale;
        if (a === 'm') path.moveTo(X(), Y());
        else if (a === 'l') path.lineTo(X(), Y());
        else if (a === 'q') { const cx = X(), cy = Y(), x1 = X(), y1 = Y(); path.quadraticCurveTo(x1, y1, cx, cy); }
        else if (a === 'b') { const cx = X(), cy = Y(), x1 = X(), y1 = Y(), x2 = X(), y2 = Y(); path.bezierCurveTo(x1, y1, x2, y2, cx, cy); }
      }
    }
    shapes.push(...path.toShapes());
    ox += g.ha * scale;
  }
  shapeCache.set(str, shapes);
  if (shapeCache.size > 400) shapeCache.delete(shapeCache.keys().next().value);
  return shapes;
}
// Erhabene Schrift, eingepasst in das Rechteck x0..x1 / y0..y1, von z0 bis z1
function textTris(out, str, x0, x1, y0, y1, z0, z1) {
  const shapes = textShapes(str);
  if (!shapes.length) return;
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: z1 - z0, bevelEnabled: false, curveSegments: 4 });
  geo.computeBoundingBox();
  const bb = geo.boundingBox, w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y;
  const k = Math.min((x1 - x0) / w, (y1 - y0) / h, 0.75);
  const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) out.push((p[i] - cx) * k + mx, (p[i + 1] - cy) * k + my, p[i + 2] + z0);
  geo.dispose();
}

function buildBin(s) {
  const T = [], X = [];
  const tri = (a, b, c) => T.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const P = (p, z) => [p[0], p[1], z];
  const H = s.H, F = s.floor, Hs = s.lip ? H - LIP_H : H, zo = s.foot ? FOOT_H : 0;
  const ob = rrect(...s.base, s.radii), ot = rrect(...s.top, s.radii);
  // Verschiebung der schrägen Außenwand gegenüber dem Nennmaß bei Höhe z: [links, vorne, rechts, hinten]
  const lerp = (k, z) => s.base[k] + (s.top[k] - s.base[k]) * (z - zo) / (H - zo);
  const off = z => [lerp(0, z), lerp(1, z), lerp(2, z) - s.bw, lerp(3, z) - s.bh];
  // Rechteck, dessen Seiten an der Boxwand der Schräge folgen
  const inset = (x0, y0, x1, y1, z, sides = [true, true, true, true]) => {
    const o = off(z);
    return [x0 + (sides[0] ? o[0] : 0), y0 + (sides[1] ? o[1] : 0), x1 + (sides[2] ? o[2] : 0), y1 + (sides[3] ? o[3] : 0)];
  };
  const c = compartment(s);
  const hr = Math.max(0, Math.min(s.hr, c.w / 2 - 0.1, c.h / 2 - 0.1));
  const v2 = p => new THREE.Vector2(p[0], p[1]);
  const face = (outer, inner, z, up) => {
    const all = outer.concat(...inner);
    for (const [ia, ib, ic] of THREE.ShapeUtils.triangulateShape(outer.map(v2), inner.map(h => h.map(v2)))) {
      const A = all[ia], B = all[ib], C = all[ic];
      const cz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if ((cz >= 0) === up) tri(P(A, z), P(B, z), P(C, z)); else tri(P(A, z), P(C, z), P(B, z));
    }
  };
  const fan = (poly, z, up) => {
    for (let k = 1; k < poly.length - 1; k++) up ? tri(P(poly[0], z), P(poly[k], z), P(poly[k + 1], z)) : tri(P(poly[0], z), P(poly[k + 1], z), P(poly[k], z));
  };
  const loft = (lo, hi, z0, z1, outward) => {
    const n = lo.length;
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n;
      if (outward) { tri(P(lo[k], z0), P(lo[q], z0), P(hi[q], z1)); tri(P(lo[k], z0), P(hi[q], z1), P(hi[k], z1)); }
      else { tri(P(lo[k], z0), P(hi[q], z1), P(lo[q], z0)); tri(P(lo[k], z0), P(hi[k], z1), P(hi[q], z1)); }
    }
  };
  const holesTop = [];
  for (let j = 0; j < s.dy; j++) for (let i = 0; i < s.dx; i++) {
    const x0 = s.wi + i * (c.w + s.div), y0 = s.wi + j * (c.h + s.div);
    // Fächer in den Außenecken folgen dem Eckradius, damit die Wand überall trägt
    const isCorner = [i === 0 && j === 0, i === s.dx - 1 && j === 0, i === s.dx - 1 && j === s.dy - 1, i === 0 && j === s.dy - 1];
    const rad = isCorner.map((on, k) => on ? Math.max(hr, s.radii[k] - s.wi) : hr);
    const sides = [i === 0, j === 0, i === s.dx - 1, j === s.dy - 1];
    const rb = inset(x0, y0, x0 + c.w, y0 + c.h, F, sides), rt = inset(x0, y0, x0 + c.w, y0 + c.h, Hs, sides);
    const hb = rrect(...rb, rad), ht = rrect(...rt, rad);
    fan(hb, F, true); loft(hb, ht, F, Hs, false); holesTop.push(ht);
    // Extras als eigene Körper, die mit Wand und Boden überlappen (Slicer vereinen sie)
    const xa = x0 + Math.max(rad[0], rad[3]), xb = x0 + c.w - Math.max(rad[1], rad[2]);
    if (s.scoop && scoopOk(s, c) && xb - xa > 2) {
      const R = scoopR(s, c), yf = rb[1], e = 0.3 + Math.abs(inset(x0, y0, x0, y0, F + R, sides)[1] - yf);
      const prof = [[yf - e, F - 0.3], [yf + R, F - 0.3], [yf + R, F]];
      for (let k = 1; k < 12; k++) { const a = (270 - 90 * k / 12) * Math.PI / 180; prof.push([yf + R + R * Math.cos(a), F + R + R * Math.sin(a)]); }
      prof.push([yf, F + R], [yf - e, F + R]);
      extrudeX(tri, prof, xa, xb);
    }
    if (s.label && labelOk(s, c) && xb - xa > 2) {
      // Feld liegt etwas tiefer, wenn es beschriftet ist, damit die Schrift nicht übersteht
      const txt = s.texts[j * s.dx + i] || '';
      const top = txt ? Hs - TEXT_H : Hs, y1 = rt[3], e = 0.3;
      extrudeX(tri, [[y1 + e, top], [y1 - LABEL_D, top], [y1 - LABEL_D, top - LABEL_T], [y1 + e, top - LABEL_T - LABEL_D - e]], xa, xb);
      if (txt) textTris(X, txt, xa + 1, xb - 1, y1 - LABEL_D + 1.2, y1 - 0.8, top - 0.2, Hs - 0.05);
    }
  }
  // Außen: optional Stapelfuß, dann schräge Außenwand
  if (s.foot) {
    const g = s.wall + Math.min(s.sg, LEDGE - 0.2), rf = s.radii.map(r => r - g);
    const fb = rrect(...inset(g, g, s.bw - g, s.bh - g, 0), rf), ft = rrect(...inset(g, g, s.bw - g, s.bh - g, zo), rf);
    fan(fb, 0, false);
    loft(fb, ft, 0, zo, true);
    face(ob, [ft], zo, false);
  } else fan(ob, 0, false);
  loft(ob, ot, zo, H, true);
  // Oben: optional Stapelrand mit Auflagekante
  if (s.lip) {
    const w = s.wall, ri = s.radii.map(r => r - w);
    const Ib = rrect(...inset(w, w, s.bw - w, s.bh - w, Hs), ri), It = rrect(...inset(w, w, s.bw - w, s.bh - w, H), ri);
    face(ot, [It], H, true);
    loft(Ib, It, Hs, H, false);
    face(Ib, holesTop, Hs, true);
  } else face(ot, holesTop, H, true);
  return { body: new Float32Array(T), text: new Float32Array(X) };
}

/* ---------- STL, 3MF & ZIP ---------- */
function toSTL(tris, name) {
  const n = tris.length / 9;
  const buf = new ArrayBuffer(84 + n * 50);
  const dv = new DataView(buf);
  const head = new TextEncoder().encode(('Eurobox Inlay ' + name).slice(0, 79));
  new Uint8Array(buf, 0, head.length).set(head);
  dv.setUint32(80, n, true);
  let o = 84;
  for (let k = 0; k < n; k++) {
    const i = k * 9;
    const ux = tris[i + 3] - tris[i], uy = tris[i + 4] - tris[i + 1], uz = tris[i + 5] - tris[i + 2];
    const vx = tris[i + 6] - tris[i], vy = tris[i + 7] - tris[i + 1], vz = tris[i + 8] - tris[i + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
    for (let q = 0; q < 9; q++) dv.setFloat32(o + 12 + q * 4, tris[i + q], true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Uint8Array(buf);
}
// Dreiecksliste in indizierte Punkte umwandeln (für 3MF)
function indexMesh(tris) {
  const map = new Map(), V = [], I = [];
  for (let i = 0; i < tris.length; i += 3) {
    const k = `${tris[i].toFixed(3)},${tris[i + 1].toFixed(3)},${tris[i + 2].toFixed(3)}`;
    let id = map.get(k);
    if (id === undefined) { id = V.length / 3; map.set(k, id); V.push(tris[i], tris[i + 1], tris[i + 2]); }
    I.push(id);
  }
  return { V, I };
}
// 3MF: jede Teil-Variante ein Objekt, so oft platziert wie gebraucht, auf Druckbetten verteilt
function make3MF(parts) {
  const xmlEsc = s => String(s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  let res = '', build = '';
  const gapMM = 8, BX = S.bedX - BED_MARGIN, BY = S.bedY - BED_MARGIN;
  let plate = 0, cx = 0, cy = 0, rowH = 0;
  parts.forEach((p, idx) => {
    const tris = binTris(p.spec), { V, I } = indexMesh(tris);
    let mesh = '<mesh><vertices>';
    for (let i = 0; i < V.length; i += 3) mesh += `<vertex x="${V[i].toFixed(3)}" y="${V[i + 1].toFixed(3)}" z="${V[i + 2].toFixed(3)}"/>`;
    mesh += '</vertices><triangles>';
    for (let i = 0; i < I.length; i += 3) if (I[i] !== I[i + 1] && I[i + 1] !== I[i + 2] && I[i] !== I[i + 2]) mesh += `<triangle v1="${I[i]}" v2="${I[i + 1]}" v3="${I[i + 2]}"/>`;
    mesh += '</triangles></mesh>';
    res += `<object id="${idx + 1}" name="${xmlEsc(partFileName(p).replace(/\.stl$/, ''))}" type="model">${mesh}</object>`;
    const o = outerSize(p.spec), minX = p.spec.top[0], minY = p.spec.top[1];
    for (let n = 0; n < p.count; n++) {
      if (cx + o.w > BX) { cx = 0; cy += rowH + gapMM; rowH = 0; }
      if (cy + o.h > BY) { plate++; cx = 0; cy = 0; rowH = 0; }
      const tx = plate * (S.bedX + 40) + cx - minX + BED_MARGIN / 2, ty = cy - minY + BED_MARGIN / 2;
      build += `<item objectid="${idx + 1}" transform="1 0 0 0 1 0 0 0 1 ${tx.toFixed(2)} ${ty.toFixed(2)} 0"/>`;
      cx += o.w + gapMM; rowH = Math.max(rowH, o.h);
    }
  });
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="${LANG}" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="Title">Eurobox Inlay ${xmlEsc(footName())} x ${S.outerH}</metadata><metadata name="Application">Eurobox Inlay Generator</metadata>` +
    `<resources>${res}</resources><build>${build}</build></model>`;
  const enc = new TextEncoder();
  return [
    { name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>') },
    { name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>') },
    { name: '3D/3dmodel.model', data: enc.encode(model) },
  ];
}

const CRC_TABLE = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; tb[n] = c >>> 0; }
  return tb;
})();
function crc32(u) { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC_TABLE[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function deflate(u) {
  if (typeof CompressionStream === 'undefined') return null;
  try { return new Uint8Array(await new Response(new Blob([u]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()); }
  catch { return null; }
}
// ZIP mit Deflate-Kompression, wo der Browser sie kann, sonst unkomprimiert
async function makeZip(files, type = 'application/zip') {
  const enc = new TextEncoder();
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const local = [], central = [];
  let off = 0, cdSize = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
    const z = await deflate(f.data), method = z && z.length < sz ? 8 : 0, body = method ? z : f.data;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
    lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, body.length, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    local.push(new Uint8Array(lh.buffer), nm, body);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
    ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, body.length, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + body.length; cdSize += 46 + nm.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...local, ...central, new Uint8Array(end.buffer)], { type });
}

/* Downloads: im Claude-Viewer über die downloads-Fähigkeit (nur bestimmte Endungen), sonst normaler Browser-Download */
let downloadsApi = null;
const downloadsReady = (async () => {
  try { if (window.claude && typeof window.claude.use === 'function') downloadsApi = await window.claude.use('downloads'); } catch { downloadsApi = null; }
})();
async function offerFile(filename, blob) {
  if (downloadsApi) {
    try { await downloadsApi.save({ filename, data: blob }); toast(t('toast.saved', { f: filename })); }
    catch (e) {
      const code = e && e.code;
      toast(code === 'declined' ? t('toast.dlCancel') : code === 'rate_limited' ? t('toast.dlWait') : t('toast.dlNo'));
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(t('toast.dlStart', { f: filename }));
}

/* ---------- Teile & Stückliste ---------- */
const geoCache = new Map();
function binGeo(spec) {
  const key = specKey(spec);
  let g = geoCache.get(key);
  if (!g) {
    if (geoCache.size > 300) geoCache.clear();
    const { body, text } = buildBin(spec);
    const all = new Float32Array(body.length + text.length); all.set(body); all.set(text, body.length);
    g = { body, text, all, grams: volume(body) / 1000 * PLA + volume(text) / 1000 * PLA };
    geoCache.set(key, g);
  }
  return g;
}
const binTris = spec => binGeo(spec).all;
function volume(tr) {
  let v = 0;
  for (let i = 0; i < tr.length; i += 9) {
    v += (tr[i] * (tr[i + 4] * tr[i + 8] - tr[i + 5] * tr[i + 7]) - tr[i + 1] * (tr[i + 3] * tr[i + 8] - tr[i + 5] * tr[i + 6]) + tr[i + 2] * (tr[i + 3] * tr[i + 7] - tr[i + 4] * tr[i + 6])) / 6;
  }
  return Math.abs(v);
}
const grams = spec => (HAS3D ? binGeo(spec).grams : 0);
function computeParts() {
  const parts = new Map(), byBin = new Map();
  S.layers.forEach((l, li) => {
    [...l.layout.bins].sort((p, q) => p.y - q.y || p.x - q.x).forEach(bin => {
      const spec = binSpec(bin, li), key = specKey(spec);
      if (!parts.has(key)) parts.set(key, { key, spec, count: 0, letter: '', ids: [], layers: new Set() });
      const p = parts.get(key);
      p.count++; p.ids.push(bin.id); p.layers.add(li + 1);
      byBin.set(bin.id, p);
    });
  });
  [...parts.values()].forEach((p, i) => { p.letter = i < 26 ? String.fromCharCode(65 + i) : 'Z' + (i - 25); });
  return { parts: [...parts.values()], byBin };
}
const slug = s => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
function partFileName(p) {
  const s = p.spec, o = outerSize(s);
  const div = s.dx * s.dy > 1 ? `_${s.dx}x${s.dy}-${t('file.comp')}` : '';
  const ext = (s.scoop ? '_' + t('file.scoop') : '') + (s.label ? '_label' : '') + (s.foot ? '_' + t('file.foot') : '') + (s.lip ? '_' + t('file.lip') : '');
  const txt = s.texts.filter(Boolean).length ? '_' + slug(s.texts.filter(Boolean).slice(0, 2).join('-')) : '';
  return `${p.letter}_${t('file.layer')}${[...p.layers].join('-')}_${Math.round(o.w)}x${Math.round(o.h)}x${Math.round(s.H)}mm${div}${ext}${txt}_${p.count}${t('file.pcs')}.stl`;
}
const boxSlug = () => (S.foot === 'custom' ? `${Math.round(S.L)}x${Math.round(S.W)}` : footName().replace(/ × /g, 'x')) + `x${S.outerH}mm`;
// Grobe Druckzeit: übliche Drucker schaffen mit 0,4-mm-Düse etwa 10–22 g Filament pro Stunde
const printHours = g => [g / 22, g / 10];
const fmtHours = h => (h < 1 ? '<1' : Math.round(h).toLocaleString(locale()));
const fmtGrams = g => (g >= 1000 ? fmt(g / 1000) + ' kg' : Math.round(g) + ' g');

/* ---------- Layout-Operationen (gewählte Ebene) ---------- */
const binById = id => lay().bins.find(o => o.id === id);
function occupancy() {
  const { cols, rows, bins } = lay();
  const g = new Array(cols * rows).fill(0);
  for (const o of bins) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) g[y * cols + x] = o.id;
  return g;
}
function refine(axis) {
  const L = lay();
  if (axis === 'x') { L.cols *= 2; L.bins.forEach(o => { o.x *= 2; o.w *= 2; }); }
  else { L.rows *= 2; L.bins.forEach(o => { o.y *= 2; o.h *= 2; }); }
}
function coarsen() {
  const L = lay();
  while (L.cols % 2 === 0 && L.bins.every(o => o.x % 2 === 0 && o.w % 2 === 0)) { L.cols /= 2; L.bins.forEach(o => { o.x /= 2; o.w /= 2; }); }
  while (L.rows % 2 === 0 && L.bins.every(o => o.y % 2 === 0 && o.h % 2 === 0)) { L.rows /= 2; L.bins.forEach(o => { o.y /= 2; o.h /= 2; }); }
}
const canSplit = (bin, axis) => axis === 'x' ? bin.w >= 2 || lay().cols * 2 <= MAX_CELLS : bin.h >= 2 || lay().rows * 2 <= MAX_CELLS;
function split(bin, axis) {
  if (!canSplit(bin, axis)) return;
  if (axis === 'x') {
    if (bin.w < 2) refine('x');
    const w1 = Math.floor(bin.w / 2), half = Math.max(1, Math.round(bin.dx / 2));
    lay().bins.push({ ...bin, texts: [], id: nid(), x: bin.x + w1, w: bin.w - w1, dx: half });
    bin.w = w1; bin.dx = half;
  } else {
    if (bin.h < 2) refine('y');
    const h1 = Math.floor(bin.h / 2), half = Math.max(1, Math.round(bin.dy / 2));
    lay().bins.push({ ...bin, texts: [], id: nid(), y: bin.y + h1, h: bin.h - h1, dy: half });
    bin.h = h1; bin.dy = half;
  }
  clampDividers();
}
const neighbor = (bin, dir) => lay().bins.find(o => dir === 'right'
  ? o.x === bin.x + bin.w && o.y === bin.y && o.h === bin.h
  : o.y === bin.y + bin.h && o.x === bin.x && o.w === bin.w);
function merge(bin, dir) {
  const n = neighbor(bin, dir);
  if (!n) return;
  if (dir === 'right') { bin.w += n.w; bin.dx += n.dx; } else { bin.h += n.h; bin.dy += n.dy; }
  bin.texts = [];
  lay().bins = lay().bins.filter(o => o !== n);
  coarsen(); clampDividers();
}
function clampDividers() {
  S.layers.forEach((l, li) => l.layout.bins.forEach(o => {
    const s = binSpec(o, li);
    o.dx = Math.min(o.dx, maxDiv(s.bw, s.wi, S.divider));
    o.dy = Math.min(o.dy, maxDiv(s.bh, s.wi, S.divider));
  }));
}
// Teile, die größer als das Druckbett sind, so lange halbieren, bis sie passen
function autoFit() {
  const keep = S.active;
  let n = 0;
  S.layers.forEach((l, li) => {
    if (isLocked(li)) return;
    S.active = li;
    syncLocks();
    for (let guard = 0; guard < 60; guard++) {
      const big = lay().bins.map(o => ({ o, z: outerSize(binSpec(o, li)) })).find(({ z }) => !bedFit(z.w, z.h));
      if (!big) break;
      const lim = Math.max(S.bedX, S.bedY) - BED_MARGIN;
      const ax = big.z.w >= big.z.h ? 'x' : 'y', other = ax === 'x' ? 'y' : 'x';
      const use = canSplit(big.o, ax) ? ax : canSplit(big.o, other) && (ax === 'x' ? big.z.h : big.z.w) > Math.min(lim, Math.min(S.bedX, S.bedY) - BED_MARGIN) ? other : null;
      if (!use) break;
      split(big.o, use); n++;
    }
  });
  S.active = keep;
  syncLocks();
  return n;
}
// Verzahnte Ebenen übernehmen den Grundriss der Ebene darunter; Fächer und Extras bleiben pro Teil erhalten
const isLocked = li => li > 0 && !!S.layers[li].lock;
function syncLocks() {
  for (let li = 1; li < S.layers.length; li++) {
    const L = S.layers[li];
    if (!L.lock) continue;
    const below = S.layers[li - 1].layout, old = L.layout;
    const same = (q, o) => q.x / old.cols === o.x / below.cols && q.y / old.rows === o.y / below.rows
      && q.w / old.cols === o.w / below.cols && q.h / old.rows === o.h / below.rows;
    L.layout = { cols: below.cols, rows: below.rows, bins: below.bins.map(o => {
      const m = old.bins.find(q => same(q, o));
      return m ? { ...m, x: o.x, y: o.y, w: o.w, h: o.h } : { ...b(o.x, o.y, o.w, o.h, 1, 1, 100, true, false), texts: [], id: nid() };
    }) };
  }
  if (S.selected && !lay().bins.some(o => o.id === S.selected)) S.selected = null;
}
function markEdited() { S.layers[S.active].edited = true; }

/* ---------- Ebenen ---------- */
function addLayer() {
  if (S.layers.length >= MAX_LAYERS) return;
  const hs = layerHeights(), last = hs.length - 1;
  if (hs[last] < MIN_LAYER * 2) { toast(t('toast.layerFlat', { n: MIN_LAYER * 2 })); return; }
  const half = r2(hs[last] / 2);
  hs[last] = r2(hs[last] - half); hs.push(half);
  S.layers.push({ f: 0, tpl: null, edited: true, lock: true, layout: { cols: 1, rows: 1, bins: [] } });
  setHeights(hs);
  S.active = S.layers.length - 1; S.selected = null;
  clampDividers();
}
function removeLayer() {
  if (S.layers.length < 2) return;
  const hs = layerHeights(), i = S.active, into = i > 0 ? i - 1 : 1;
  hs[into] += hs[i]; hs.splice(i, 1);
  S.layers.splice(i, 1);
  setHeights(hs);
  S.active = Math.max(0, i - 1); S.selected = null;
  clampDividers();
}
function changeLayerHeight(d) {
  const hs = layerHeights(), i = S.active, last = hs.length - 1;
  if (i === last) return;
  const nh = Math.max(MIN_LAYER, Math.min(hs[i] + d, hs[i] + hs[last] - MIN_LAYER));
  hs[last] = r2(hs[last] - (nh - hs[i])); hs[i] = r2(nh);
  setHeights(hs); clampDividers();
}

/* ---------- UI-Helfer ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) { const [a, k] = pair.split(':'); if (a && k) el.setAttribute(a.trim(), t(k.trim())); }
  });
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.desc'));
  document.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === LANG)));
  const sel = $('#printer');
  if (sel) {
    sel.innerHTML = PRINTERS.map(p => `<option value="${p.id}">${esc(p.name)} (${p.x} × ${p.y})</option>`).join('') + `<option value="custom">${esc(t('printer.custom'))}</option>`;
  }
}
function setLang(l) {
  if (l !== 'de' && l !== 'en') return;
  LANG = l;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* egal */ }
  applyStaticI18n(); update({ rebuild: false });
}

/* ---------- Render ---------- */
function miniSVG(tp) {
  const L = 355, W = 255;
  const src = tp.grid ? [{ cols: 4, rows: 3, bins: grid(4, 3, (x, y) => b(x, y, 1, 1)) }] : tp.layers;
  const top = src[src.length - 1];
  const cw = L / top.cols, ch = W / top.rows, g = 6, extra = src.length > 1 ? src.length * 8 : 0;
  let s = `<svg viewBox="-4 ${-4 - extra} ${L + 8} ${W + 8 + extra}" aria-hidden="true"><rect x="-2" y="-2" width="${L + 4}" height="${W + 4}" rx="16" fill="none" stroke="var(--fg-3)" stroke-width="3"/>`;
  if (src.length > 1) s += src.slice(0, -1).map((_, i) => `<rect x="${8 + i * 8}" y="${-12 - i * 8}" width="${L - 16 - i * 16}" height="6" rx="3" fill="var(--fg-3)" opacity=".5"/>`).join('');
  for (const o of top.bins) {
    const x = o.x * cw + g / 2, y = o.y * ch + g / 2, w = o.w * cw - g, h = o.h * ch - g;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--surface)" stroke="var(--fg-3)" stroke-width="3"${tp.grid ? ' stroke-dasharray="10 8"' : ''}/>`;
    for (let i = 1; i < o.dx; i++) { const xx = x + w * i / o.dx; s += `<line x1="${xx}" y1="${y + 8}" x2="${xx}" y2="${y + h - 8}" stroke="var(--fg-3)" stroke-width="3"/>`; }
    for (let j = 1; j < o.dy; j++) { const yy = y + h * j / o.dy; s += `<line x1="${x + 8}" y1="${yy}" x2="${x + w - 8}" y2="${yy}" stroke="var(--fg-3)" stroke-width="3"/>`; }
  }
  return s + '</svg>';
}
function renderTemplates() {
  const cur = S.layers[S.active].tpl;
  $('#templates').innerHTML = TEMPLATES.map(tp =>
    `<button type="button" class="tpl" id="tpl-${tp.id}" data-tpl="${tp.id}" aria-pressed="${tp.id === cur}">${miniSVG(tp)}<strong>${esc(t(`tpl.${tp.id}.name`))}</strong><small>${esc(t(`tpl.${tp.id}.desc`))}</small></button>`).join('');
}

function renderBox() {
  $('#foot-seg').innerHTML = FOOTPRINTS.map(f => `<button type="button" id="foot-${f.id}" data-foot="${f.id}" aria-pressed="${S.foot === f.id}">${f.name}</button>`).join('')
    + `<button type="button" id="foot-custom" data-foot="custom" aria-pressed="${S.foot === 'custom'}">${esc(t('box.custom'))}</button>`;
  $('#h-chips').innerHTML = HEIGHTS.map(h => `<button type="button" id="hc-${h}" data-h="${h}" aria-pressed="${S.outerH === h}">${h}</button>`).join('');
  if (document.activeElement !== $('#in-outerH')) $('#in-outerH').value = S.outerH;
  $('#rng-outerH').value = S.outerH;
  $('#stack-toggle').setAttribute('aria-checked', String(S.stacked));
  $('#f-area').textContent = `${fmt(S.L)} × ${fmt(S.W)}`;
  $('#stack-viz').innerHTML = stackSVG();
  $('#f-height').textContent = `${fmt(maxH())} mm`;
  $('#f-height-note').textContent = S.stacked
    ? t('box.maxNote', { h: fmt(S.outerH), l: fmt(S.stackLoss) })
    : t('box.maxNoteFree');
  document.querySelectorAll('.fields input').forEach(inp => {
    const k = inp.dataset.k;
    const v = k === 'Ltop' ? r2(S.L + 2 * grow(innerH())) : S[k];
    if (document.activeElement !== inp) inp.value = v;
  });
  const sel = $('#printer');
  if (sel && document.activeElement !== sel) sel.value = PRINTERS.some(p => p.id === S.printer) ? S.printer : 'custom';
  $('#bed-info').textContent = t('print.bed', { x: fmt(S.bedX), y: fmt(S.bedY), z: fmt(S.bedZ) });
}

function stackSVG() {
  const base = 150, top = 26, bx = 38, bw = 196, tilt = 5;
  const k = (base - top) / S.outerH, y = mm => base - mm * k;
  const xl = mm => bx + tilt - tilt * mm / S.outerH, xr = mm => bx + bw - tilt + tilt * mm / S.outerH;
  const hs = layerHeights(), mh = maxH();
  let s = '';
  // Box darüber (nur der untere Teil)
  if (S.stacked) {
    const yf = y(mh);
    const yr = y(S.outerH), L0 = xl(mh) + 7, R0 = xr(mh) - 7, Lr = xl(S.outerH), Rr = xr(S.outerH);
    const pts = `${L0} ${yf} L${R0} ${yf} L${Rr - 3} ${yr} L${Rr + 3} ${yr - 3} L${Rr + 5} 2 L${Lr - 5} 2 L${Lr - 3} ${yr - 3} L${Lr + 3} ${yr}`;
    s += `<path d="M${pts} Z" fill="var(--limit)" fill-opacity=".12" stroke="none"/>`;
    s += `<path d="M${Lr - 5} 2 L${Lr - 3} ${yr - 3} L${Lr + 3} ${yr} L${L0} ${yf} L${R0} ${yf} L${Rr - 3} ${yr} L${Rr + 3} ${yr - 3} L${Rr + 5} 2" fill="none" stroke="var(--limit)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
    s += `<text x="${bx + bw / 2}" y="14" text-anchor="middle" font-size="10.5" fill="var(--limit)">${esc(t('viz.boxAbove'))}</text>`;
  }
  // Untere Box
  s += `<path d="M${xl(S.outerH)} ${y(S.outerH)} L${xl(0)} ${base} L${xr(0)} ${base} L${xr(S.outerH)} ${y(S.outerH)}" fill="none" stroke="var(--fg-2)" stroke-width="2.5" stroke-linejoin="round"/>`;
  // Einsätze, je Ebene ein Band
  let z = 0;
  hs.forEach((h, i) => {
    const z0 = z + (i === 0 ? BOX_FLOOR : 0), z1 = z + h; z += h;
    s += `<path d="M${xl(z0) + 2} ${y(z0)} L${xr(z0) - 2} ${y(z0)} L${xr(z1) - 2} ${y(z1) + 1} L${xl(z1) + 2} ${y(z1) + 1} Z" fill="var(--accent)" fill-opacity="${i % 2 ? 0.28 : 0.5}" stroke="var(--accent)" stroke-width="1"/>`;
    if (hs.length > 1 && y(z0) - y(z1) > 12) s += `<text x="${bx + bw / 2}" y="${(y(z0) + y(z1)) / 2 + 4}" text-anchor="middle" font-size="10" fill="var(--fg)">${esc(t('layer.n', { n: i + 1 }))}</text>`;
  });
  if (hs.length === 1 && y(BOX_FLOOR) - y(mh) > 14) s += `<text x="${bx + bw / 2}" y="${(y(BOX_FLOOR) + y(mh)) / 2 + 4}" text-anchor="middle" font-size="11" fill="var(--fg)">${esc(t('viz.inserts'))}</text>`;
  // Maßlinien
  const dx = bx + bw + 16, dim = (a, bb, label, col) => {
    const ya = y(a), yb = y(bb);
    return `<path d="M${dx - 4} ${ya}h8M${dx - 4} ${yb}h8M${dx} ${ya}V${yb}" stroke="${col}" stroke-width="1.2" fill="none"/>` +
      `<text x="${dx + 9}" y="${(ya + yb) / 2 + 4}" font-size="11.5" font-weight="600" fill="${col}">${label}</text>`;
  };
  s += dim(0, mh, `${fmt(mh)} mm`, 'var(--accent)');
  if (S.stacked) s += dim(mh, S.outerH, `${fmt(S.stackLoss)} mm`, 'var(--limit)');
  s += `<text x="${bx - 8}" y="${y(S.outerH) + 4}" text-anchor="end" font-size="10.5" fill="var(--fg-2)">${S.outerH}</text>`;
  s += `<text x="${bx - 8}" y="${base + 4}" text-anchor="end" font-size="10.5" fill="var(--fg-2)">0</text>`;
  s += `<text x="${bx + bw / 2}" y="${base + 15}" text-anchor="middle" font-size="10.5" fill="var(--fg-2)">${esc(t('viz.caption'))}</text>`;
  return s;
}

function renderLayers() {
  const hs = layerHeights(), n = S.layers.length;
  $('#layer-seg').innerHTML = S.layers.map((l, i) =>
    `<button type="button" id="layer-${i}" data-layer="${i}" aria-pressed="${i === S.active}">${n === 1 ? esc(t('layer.n', { n: 1 })) : i === 0 ? esc(t('layer.bottom')) : i === n - 1 ? esc(t('layer.top', { n: i + 1 })) : i + 1}</button>`).join('');
  const i = S.active;
  const z0 = layerBase(i);
  const row = $('#layer-height-row');
  if (n === 1) row.innerHTML = `<span>${esc(t('layer.height'))}</span><span class="tag">${esc(t('layer.full', { h: fmt(hs[0]) }))}</span>`;
  else if (i === n - 1) row.innerHTML = `<span>${esc(t('layer.height'))} <small class="tag">${esc(t('layer.from', { z: fmt(z0) }))}</small></span><span class="tag">${esc(t('layer.rest', { h: fmt(hs[i]) }))}</span>`;
  else row.innerHTML = `<span>${esc(t('layer.height'))} <small class="tag">${esc(t('layer.from', { z: fmt(z0) }))}</small></span>${stepper('lh', fmt(hs[i]) + ' mm', hs[i] <= MIN_LAYER, hs[n - 1] <= MIN_LAYER, t('layer.heightAria'))}`;
  const lr = $('#layer-lock-row');
  lr.hidden = i === 0;
  if (i > 0) lr.innerHTML = `<span>${esc(t('layer.lock', { n: i }))}<br><small class="tag">${esc(S.layers[i].lock ? t('layer.lockOn') : t('layer.lockOff'))}</small></span>${toggle('lock-toggle', S.layers[i].lock, t('layer.lockAria'))}`;
  $('#layer-add').disabled = n >= MAX_LAYERS;
  $('#layer-del').disabled = n < 2;
  $('#explode').hidden = n < 2;
  $('#explode').setAttribute('aria-pressed', String(!!S.explode));
  $('#explode').textContent = S.explode ? t('hud.lower') : t('hud.raise');
}

let partsInfo = computeParts();

function renderPlan() {
  const svg = $('#plan');
  const { cols, rows, bins } = lay();
  const cw = S.L / cols, ch = S.W / rows, pad = 6;
  const fv = Math.max(9, S.L * 0.026);
  svg.setAttribute('viewBox', `${-pad} ${-pad} ${S.L + pad * 2} ${S.W + pad * 2 + fv + 4}`);
  const fs = Math.max(11, Math.min(26, Math.min(cw, ch) * 0.3));
  let s = `<rect x="-3" y="-3" width="${S.L + 6}" height="${S.W + 6}" rx="${S.boxRadius + 3}" fill="none" stroke="var(--fg-3)" stroke-width="2"/>`;
  s += `<text x="${S.L / 2}" y="${S.W + 6 + fv}" text-anchor="middle" font-size="${fv}" fill="var(--fg-3)" style="font-family:var(--font)">${esc(t('plan.front'))}</text>`;
  const occ = occupancy();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (occ[y * cols + x] || isLocked(S.active)) continue;
    const X = x * cw + S.gap / 2 + 2, Y = y * ch + S.gap / 2 + 2, w = cw - S.gap - 4, h = ch - S.gap - 4;
    s += `<g class="empty" data-cell="${x},${y}" role="button" tabindex="0" aria-label="${esc(t('plan.add'))}"><rect x="${X}" y="${Y}" width="${w}" height="${h}" rx="6" fill="transparent" stroke="var(--fg-3)" stroke-width="1.5" stroke-dasharray="5 5"/>` +
      `<text x="${X + w / 2}" y="${Y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" fill="var(--fg-3)">+</text></g>`;
  }
  for (const o of bins) {
    const spec = binSpec(o, S.active);
    const p = partsInfo.byBin.get(o.id);
    const sel = o.id === S.selected, warn = !fitsBed(spec);
    const x = o.x * cw + S.gap / 2, y = o.y * ch + S.gap / 2, w = spec.bw, h = spec.bh;
    const fill = sel ? 'var(--accent-soft)' : warn ? 'var(--warn-soft)' : 'var(--surface)';
    const stroke = sel ? 'var(--accent)' : warn ? 'var(--warn)' : 'var(--fg-2)';
    s += `<g class="bin" data-id="${o.id}" role="button" tabindex="0" aria-pressed="${sel}" aria-label="${esc(t('part.n', { l: p ? p.letter : '' }))}">`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(S.radius, w / 2, h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${sel ? 3 : 1.5}"/>`;
    for (let i = 1; i < o.dx; i++) { const xx = x + w * i / o.dx; s += `<line x1="${xx}" y1="${y + 4}" x2="${xx}" y2="${y + h - 4}" stroke="${stroke}" stroke-width="1" opacity=".7"/>`; }
    for (let j = 1; j < o.dy; j++) { const yy = y + h * j / o.dy; s += `<line x1="${x + 4}" y1="${yy}" x2="${x + w - 4}" y2="${yy}" stroke="${stroke}" stroke-width="1" opacity=".7"/>`; }
    const cc = compartment(spec);
    for (let j = 0; j < o.dy; j++) for (let i = 0; i < o.dx; i++) {
      const cx0 = x + w * i / o.dx + 5, cxw = w / o.dx - 10, top = y + h * j / o.dy, bot = y + h * (j + 1) / o.dy;
      if (o.label && labelOk(spec, cc)) {
        const lh = Math.min(LABEL_D, (bot - top) / 4);
        s += `<rect x="${cx0}" y="${top + 3}" width="${cxw}" height="${lh}" rx="2" fill="${stroke}" opacity=".18"/>`;
        const txt = (o.texts && o.texts[j * o.dx + i] || '').trim();
        if (txt) s += `<text x="${cx0 + cxw / 2}" y="${top + 3 + lh / 2}" text-anchor="middle" dominant-baseline="central" font-size="${Math.min(lh * 0.8, cxw / Math.max(3, txt.length) * 1.6)}" font-weight="700" fill="${stroke}" style="font-family:var(--font)">${esc(txt)}</text>`;
      }
      if (o.scoop && scoopOk(spec, cc)) s += `<path d="M${cx0} ${bot - 4} Q${cx0 + cxw / 2} ${bot - 4 - scoopR(spec, cc) * 0.9} ${cx0 + cxw} ${bot - 4}" fill="none" stroke="${stroke}" stroke-width="1" opacity=".55"/>`;
    }
    const label = (p ? p.letter : '') + (isTop(S.active) && o.hp < 100 ? ` · ${o.hp}%` : '');
    s += `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" dominant-baseline="central" font-size="${fs}" font-weight="600" fill="${sel ? 'var(--accent)' : 'var(--fg)'}" style="font-family:var(--font)">${label}</text></g>`;
  }
  svg.innerHTML = s;
}

function stepper(id, value, minReached, maxReached, label) {
  return `<span class="stepper"><button type="button" id="${id}-dec" data-step="${id}" data-d="-1" aria-label="${esc(t('aria.dec', { l: label }))}" ${minReached ? 'disabled' : ''}>−</button>` +
    `<output>${value}</output><button type="button" id="${id}-inc" data-step="${id}" data-d="1" aria-label="${esc(t('aria.inc', { l: label }))}" ${maxReached ? 'disabled' : ''}>+</button></span>`;
}
function toggle(id, on, label) {
  return `<button type="button" class="switch" role="switch" id="${id}" aria-checked="${!!on}" aria-label="${esc(label)}"><span></span></button>`;
}
function renderEditor() {
  const el = $('#editor');
  const bin = binById(S.selected);
  if (!bin) { el.innerHTML = `<div class="empty-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3v11.5l2.6-2.3 2 4.6 2-.9-2-4.5H17L9 3z" fill="currentColor"/></svg><span>${esc(t('ed.empty'))}</span></div>`; return; }
  const spec = binSpec(bin, S.active);
  const p = partsInfo.byBin.get(bin.id);
  const c = compartment(spec), o = outerSize(spec);
  const mx = maxDiv(spec.bw, spec.wi, S.divider), my = maxDiv(spec.bh, spec.wi, S.divider);
  const top = isTop(S.active), n = bin.dx * bin.dy;
  const canLabel = labelOk(spec, c), fontOk = HAS3D && !!window.EBX_FONT;
  const texts = bin.label && canLabel && fontOk ? `<div class="txt-grid" style="--cols:${Math.min(bin.dx, 3)}">${Array.from({ length: Math.min(n, 36) }, (_, k) =>
    `<input type="text" id="ed-txt-${k}" data-txt="${k}" maxlength="${TEXT_MAX}" value="${esc(bin.texts && bin.texts[k] || '')}" placeholder="${esc(t('ed.txtPh', { n: k + 1 }))}" aria-label="${esc(t('ed.txtAria', { n: k + 1 }))}" autocomplete="off" spellcheck="false">`).join('')}</div>
    <p class="hint">${esc(t('ed.txtHint'))}</p>` : '';
  el.innerHTML = `<div class="editor">
    <div class="ed-head"><strong>${esc(t('part.n', { l: p ? p.letter : '' }))}</strong><span>${fmt(o.w)} × ${fmt(o.h)} × ${fmt(spec.H)} mm · ${fmtGrams(grams(spec))}</span></div>
    ${!fitsXY(spec) ? `<span class="chip warn">${esc(t('ed.tooBig', { x: fmt(S.bedX), y: fmt(S.bedY) }))}</span>` : spec.H > S.bedZ ? `<span class="chip warn">${esc(t('ed.tooHigh', { z: fmt(S.bedZ) }))}</span>` : ''}
    <div class="row"><span>${esc(t('ed.dx'))}</span>${stepper('ed-dx', bin.dx, bin.dx <= 1, bin.dx >= mx, t('ed.dx'))}</div>
    <div class="row"><span>${esc(t('ed.dy'))}</span>${stepper('ed-dy', bin.dy, bin.dy <= 1, bin.dy >= my, t('ed.dy'))}</div>
    <p class="hint">${esc(t('ed.size', { w: fmt(c.w), h: fmt(c.h), d: fmt(depth(spec)) }))}</p>
    ${top ? `<div class="row"><span>${esc(t('layer.height'))}</span><div class="seg" role="group" aria-label="${esc(t('layer.height'))}" style="min-width:180px">
      ${[[100, t('ed.full')], [75, '¾'], [50, '½'], [33, '⅓']].map(([v, tx]) => `<button type="button" id="ed-hp-${v}" data-hp="${v}" aria-pressed="${bin.hp === v}">${esc(tx)}</button>`).join('')}
    </div></div>` : `<p class="hint">${esc(t('ed.fullBelow'))}</p>`}
    <div class="row"><span>${esc(t('ed.scoop'))}${scoopOk(spec, c) ? '' : ` <small class="tag">${esc(t('ed.small'))}</small>`}</span>${toggle('ed-scoop', bin.scoop, t('ed.scoop'))}</div>
    <div class="row"><span>${esc(t('ed.label'))}${canLabel ? '' : ` <small class="tag">${esc(t('ed.small'))}</small>`}</span>${toggle('ed-label', bin.label, t('ed.label'))}</div>
    ${texts}
    ${spec.lip || spec.foot ? `<p class="hint">${esc(spec.foot && spec.lip ? t('ed.footLip') : spec.foot ? t('ed.foot') : t('ed.lip'))}</p>` : ''}
    ${isLocked(S.active) ? `<p class="hint">${esc(t('ed.lockedHint', { n: S.active }))}</p>` : `<div class="btns">
      <button type="button" class="btn" id="ed-split-x" ${canSplit(bin, 'x') ? '' : 'disabled'}>${esc(t('ed.splitX'))}</button>
      <button type="button" class="btn" id="ed-split-y" ${canSplit(bin, 'y') ? '' : 'disabled'}>${esc(t('ed.splitY'))}</button>
      <button type="button" class="btn" id="ed-merge-r" ${neighbor(bin, 'right') ? '' : 'disabled'}>${esc(t('ed.mergeR'))}</button>
      <button type="button" class="btn" id="ed-merge-d" ${neighbor(bin, 'down') ? '' : 'disabled'}>${esc(t('ed.mergeD'))}</button>
      <button type="button" class="btn danger" id="ed-del">${esc(t('ed.del'))}</button>
    </div>`}
    <button type="button" class="btn" id="ed-all">${esc(t('ed.all'))}</button>
  </div>`;
}

function renderBom() {
  const rows = partsInfo.parts.map(p => {
    const s = p.spec, o = outerSize(s);
    const sel = S.selected && p.ids.includes(S.selected);
    const st = !fitsXY(s) ? `<span class="chip warn">${esc(t('bom.big'))}</span>` : s.H > S.bedZ ? `<span class="chip warn">${esc(t('bom.high'))}</span>` : `<span class="chip ok">${esc(t('bom.ok'))}</span>`;
    return `<tr class="${sel ? 'sel' : ''}"><td><span class="letter">${p.letter}</span></td><td>${[...p.layers].join(', ')}</td>
      <td>${Math.round(o.w)} × ${Math.round(o.h)} × ${Math.round(s.H)}</td>
      <td>${s.dx * s.dy}</td><td>${p.count}×</td><td>${Math.round(grams(s) * p.count)}</td><td>${st}</td></tr>`;
  }).join('');
  $('#bom').innerHTML = `<thead><tr><th>${esc(t('bom.part'))}</th><th>${esc(t('bom.layer'))}</th><th>${esc(t('bom.size'))}</th><th>${esc(t('bom.comp'))}</th><th>${esc(t('bom.qty'))}</th><th>g</th><th>${esc(t('bom.bed'))}</th></tr></thead><tbody>${rows}</tbody>`;
  const total = S.layers.reduce((a, l) => a + l.layout.bins.length, 0);
  $('#export-sum').textContent = t('bom.sum', { n: total, v: partsInfo.parts.length });
  $('#dl-all').disabled = $('#dl-3mf').disabled = total === 0;
  const g = partsInfo.parts.reduce((a, p) => a + grams(p.spec) * p.count, 0);
  const [h1, h2] = printHours(g);
  $('#dl-sub').textContent = t('dl.sub', { f: partsInfo.parts.length, n: total, g: fmtGrams(g) });
  $('#print-est').textContent = total ? t('print.est', { g: fmtGrams(g), c: (g / 1000 * 20).toLocaleString(locale(), { maximumFractionDigits: 0 }), a: fmtHours(h1), b: fmtHours(h2) }) : '';
  $('#dl-one').disabled = !binById(S.selected);
  $('#dl-test-sub').textContent = HAS3D ? `· ${t('test.sub', { g: Math.round(testGrams()) })}` : '';
  $('#fit-bed').hidden = partsInfo.parts.every(p => fitsXY(p.spec));
  const L = S.layers[S.active];
  const tp = TEMPLATES.find(x => x.id === L.tpl);
  $('#tpl-state').textContent = t('tpl.state', { n: S.active + 1, t: tp ? (L.edited ? t('tpl.edited', { t: t(`tpl.${tp.id}.name`) }) : t(`tpl.${tp.id}.name`)) : t('tpl.own') });
  $('#grid-opts').hidden = L.tpl !== 'raster';
  $('#gc-val').textContent = S.gridCols; $('#gr-val').textContent = S.gridRows;
  $('#mbar-info').textContent = t('mbar.info', { n: total, g: fmtGrams(g) });
  $('#hud-stats').textContent = t('hud.stats', { l: tn('hud.layers', S.layers.length), n: total, h: fmt(maxH()) });
}

function renderLook() {
  const sw = (list, cur, kind) => list.map(o => `<button type="button" class="sw" id="${kind}-${o.id}" data-${kind}="${o.id}" style="background:${o.c}" aria-pressed="${cur === o.id}" aria-label="${esc(t('color.' + o.id))}" title="${esc(t('color.' + o.id))}"></button>`).join('');
  $('#fil-sw').innerHTML = sw(FILAMENTS, S.fil, 'fil');
  $('#box-sw').innerHTML = sw(BOXCOLORS, S.boxc, 'boxc');
  document.querySelectorAll('#view-seg button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.view === S.view)));
  $('#ghost-toggle').setAttribute('aria-checked', String(!!S.ghost));
}

/* ---------- Verlauf (Rückgängig/Wiederholen); Ansichtseinstellungen zählen nicht dazu ---------- */
const LOOK_KEYS = ['selected', 'explode', 'view', 'fil', 'boxc', 'ghost', 'active'];
const snap = () => JSON.stringify(S, (k, v) => LOOK_KEYS.includes(k) ? undefined : v);
let past = [], future = [], lastSnap = null, lastPush = 0, replaying = false, mergeNext = false;
function record() {
  const now = snap(), merge = mergeNext;
  mergeNext = false;
  if (lastSnap === null) { lastSnap = now; return; }
  if (now === lastSnap || replaying) { lastSnap = now; return; }
  // Ziehen am Regler und Tippen werden zu einem Schritt zusammengefasst, Klicks nicht
  if (!merge || Date.now() - lastPush > 900 || !past.length) past.push(lastSnap);
  if (past.length > 80) past.shift();
  lastPush = Date.now(); future = []; lastSnap = now;
}
function restore(json) {
  const keep = Object.fromEntries(LOOK_KEYS.map(k => [k, S[k]]));
  const s = normalize(JSON.parse(json));
  if (!s) return false;
  S = Object.assign(s, keep, { selected: null });
  S.active = clampNum(S.active | 0, 0, S.layers.length - 1);
  replaying = true; update(); replaying = false; lastSnap = snap();
  return true;
}
function undo() { if (!past.length) return; future.push(lastSnap); restore(past.pop()); lastPush = 0; toast(t('toast.undo')); }
function redo() { if (!future.length) return; past.push(lastSnap); restore(future.pop()); lastPush = 0; toast(t('toast.redo')); }

function update({ rebuild = true, editor = true } = {}) {
  syncLocks();
  clampDividers();
  partsInfo = computeParts();
  renderBox(); renderLayers(); renderTemplates(); renderPlan(); if (editor) renderEditor(); renderBom(); renderLook();
  if (scene) { try { if (rebuild) rebuildScene(); else recolor(); } catch (err) { console.error(err); } }
  record();
  $('#undo').disabled = !past.length; $('#redo').disabled = !future.length;
  saveState();
}

/* ---------- Ereignisse ---------- */
function afterDims({ view = true } = {}) {
  clampDividers();
  const n = autoFit();
  update();
  if (view) fitView();
  if (n) toast(tn('toast.split', n));
}
$('#foot-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-foot]'); if (!btn) return;
  const f = FOOTPRINTS.find(x => x.id === btn.dataset.foot);
  if (!f) { S.foot = 'custom'; $('#adv').open = true; update({ rebuild: false }); $('#in-L').focus(); return; }
  Object.assign(S, { foot: f.id, L: f.L, W: f.W, boxRadius: f.boxRadius, stackLoss: f.stackLoss });
  afterDims();
});
function setOuterH(v, { view = false } = {}) {
  if (!isFinite(v)) { renderBox(); return; }
  S.outerH = Math.round(clampNum(v, 50, 450));
  afterDims({ view });
}
$('#rng-outerH').addEventListener('input', e => { mergeNext = true; setOuterH(Number(e.target.value)); });
$('#rng-outerH').addEventListener('change', () => fitView());
$('#in-outerH').addEventListener('change', e => setOuterH(parseFloat(String(e.target.value).replace(',', '.')), { view: true }));
$('#h-chips').addEventListener('click', e => {
  const btn = e.target.closest('button[data-h]'); if (!btn) return;
  setOuterH(Number(btn.dataset.h), { view: true });
});
$('#stack-toggle').addEventListener('click', () => { S.stacked = !S.stacked; afterDims(); });
document.querySelectorAll('.fields input').forEach(inp => inp.addEventListener('change', () => {
  const k = inp.dataset.k;
  let v = parseFloat(String(inp.value).replace(',', '.'));
  if (!isFinite(v)) { renderBox(); return; }
  v = clampNum(v, parseFloat(inp.min), parseFloat(inp.max));
  if (k === 'L' || k === 'W') { S[k] = v; S.foot = 'custom'; }
  else if (k === 'Ltop') S.slope = r2(clampNum((v - S.L) / 2 / innerH() * 100, 0, 15));
  else if (k === 'bedX' || k === 'bedY' || k === 'bedZ') { S[k] = v; S.printer = 'custom'; }
  else S[k] = v;
  afterDims();
}));
$('#printer').addEventListener('change', e => {
  const p = PRINTERS.find(x => x.id === e.target.value);
  if (p) Object.assign(S, { printer: p.id, bedX: p.x, bedY: p.y, bedZ: p.z });
  else { S.printer = 'custom'; $('#adv').open = true; }
  afterDims({ view: false });
});
$('#reset-dims').addEventListener('click', () => {
  const keep = { outerH: S.outerH, printer: S.printer, bedX: S.bedX, bedY: S.bedY, bedZ: S.bedZ };
  const f = FOOTPRINTS.find(x => x.id === S.foot) || FOOTPRINTS[1];
  for (const k of DIM_KEYS) S[k] = DEFAULTS[k];
  Object.assign(S, { foot: f.id, L: f.L, W: f.W, boxRadius: f.boxRadius, stackLoss: f.stackLoss }, keep);
  afterDims(); toast(t('toast.reset'));
});
$('#templates').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tpl]'); if (!btn) return;
  const tp = TEMPLATES.find(x => x.id === btn.dataset.tpl);
  S.selected = null;
  if (tp.multi) {
    S.layers = tp.layers.map(l => ({ f: l.f, tpl: tp.id, edited: false, lock: !!l.lock, layout: { cols: l.cols, rows: l.rows, bins: withIds(l.bins) } }));
    S.active = S.layers.length - 1;
    if (maxH() < 120 && tp.layers.length > 2) toast(t('toast.threeTip'));
  } else {
    const src = tp.grid ? gridLayout(S.gridCols, S.gridRows) : { cols: tp.layers[0].cols, rows: tp.layers[0].rows, bins: withIds(tp.layers[0].bins) };
    if (isLocked(S.active)) toast(t('toast.unlocked'));
    Object.assign(S.layers[S.active], { tpl: tp.id, edited: false, lock: false, layout: src });
  }
  afterDims({ view: false });
});
function setGrid(dc, dr) {
  S.gridCols = clampNum(S.gridCols + dc, 1, 8);
  S.gridRows = clampNum(S.gridRows + dr, 1, 8);
  Object.assign(S.layers[S.active], { tpl: 'raster', edited: false, lock: false, layout: gridLayout(S.gridCols, S.gridRows) });
  S.selected = null; afterDims({ view: false });
}
$('#gc-dec').addEventListener('click', () => setGrid(-1, 0));
$('#gc-inc').addEventListener('click', () => setGrid(1, 0));
$('#gr-dec').addEventListener('click', () => setGrid(0, -1));
$('#gr-inc').addEventListener('click', () => setGrid(0, 1));

$('#layer-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-layer]'); if (!btn) return;
  S.active = Number(btn.dataset.layer); S.selected = null; update({ rebuild: false });
});
$('#layer-height-row').addEventListener('click', e => {
  const btn = e.target.closest('button[data-step]'); if (!btn || btn.disabled) return;
  changeLayerHeight(5 * Number(btn.dataset.d)); update();
  document.getElementById(btn.id)?.focus();
});
$('#layer-lock-row').addEventListener('click', e => {
  if (!e.target.closest('#lock-toggle')) return;
  const L = S.layers[S.active];
  L.lock = !L.lock; L.edited = true;
  if (L.lock) toast(t('toast.locked'));
  S.selected = null; update();
  document.getElementById('lock-toggle')?.focus();
});
$('#layer-add').addEventListener('click', () => { addLayer(); update(); });
$('#layer-del').addEventListener('click', () => { removeLayer(); update(); });
$('#fit-bed').addEventListener('click', () => { S.selected = null; afterDims({ view: false }); });
$('#explode').addEventListener('click', () => { S.explode = !S.explode; update(); fitView(); });

function select(id) { S.selected = id; update({ rebuild: false }); }
$('#plan').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const g = e.target.closest('g[tabindex]'); if (!g) return;
  e.preventDefault();
  const sel = g.dataset.id ? `g[data-id="${g.dataset.id}"]` : `g[data-cell="${g.dataset.cell}"]`;
  g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  document.querySelector('#plan ' + sel)?.focus();
});
$('#plan').addEventListener('click', e => {
  const g = e.target.closest('g');
  if (!g) { select(null); return; }
  if (g.dataset.id) { const id = Number(g.dataset.id); select(S.selected === id ? null : id); return; }
  if (g.dataset.cell) {
    const [x, y] = g.dataset.cell.split(',').map(Number);
    const nb = { ...b(x, y, 1, 1), texts: [], id: nid() };
    lay().bins.push(nb); S.selected = nb.id; markEdited();
    update();
  }
});
$('#editor').addEventListener('click', e => {
  const bin = binById(S.selected); if (!bin) return;
  const btn = e.target.closest('button'); if (!btn || btn.disabled) return;
  const spec = binSpec(bin, S.active);
  if (btn.dataset.step) {
    const d = Number(btn.dataset.d);
    if (btn.dataset.step === 'ed-dx') bin.dx = clampNum(bin.dx + d, 1, maxDiv(spec.bw, spec.wi, S.divider));
    else bin.dy = clampNum(bin.dy + d, 1, maxDiv(spec.bh, spec.wi, S.divider));
  } else if (btn.dataset.hp) bin.hp = Number(btn.dataset.hp);
  else if (btn.id === 'ed-scoop') bin.scoop = !bin.scoop;
  else if (btn.id === 'ed-label') bin.label = !bin.label;
  else if (btn.id === 'ed-all') {
    for (const o of lay().bins) Object.assign(o, { hp: bin.hp, scoop: bin.scoop, label: bin.label, dx: bin.dx, dy: bin.dy });
    clampDividers(); toast(t('toast.all'));
  }
  else if (btn.id === 'ed-split-x') split(bin, 'x');
  else if (btn.id === 'ed-split-y') split(bin, 'y');
  else if (btn.id === 'ed-merge-r') merge(bin, 'right');
  else if (btn.id === 'ed-merge-d') merge(bin, 'down');
  else if (btn.id === 'ed-del') { lay().bins = lay().bins.filter(o => o !== bin); S.selected = null; coarsen(); }
  else return;
  markEdited();
  const focusId = btn.id;
  update();
  const again = document.getElementById(focusId);
  if (again && !again.disabled) again.focus();
});
// Beschriftung tippen: Editor nicht neu aufbauen, damit der Cursor bleibt
let txtTimer;
$('#editor').addEventListener('input', e => {
  const inp = e.target.closest('input[data-txt]'); if (!inp) return;
  const bin = binById(S.selected); if (!bin) return;
  bin.texts = bin.texts || [];
  bin.texts[Number(inp.dataset.txt)] = inp.value.slice(0, TEXT_MAX);
  markEdited();
  clearTimeout(txtTimer);
  txtTimer = setTimeout(() => { mergeNext = true; update({ editor: false }); }, 350);
});

/* ---------- Export ---------- */
const need3D = () => { if (!HAS3D) toast(t('toast.need3d')); return HAS3D; };
function partsList() {
  const hs = layerHeights();
  return [
    t('list.title', { b: footName(), h: S.outerH, s: S.stacked ? t('list.stackable') : '' }),
    t('list.area', { l: fmt(S.L), w: fmt(S.W), h: fmt(maxH()) }),
    t('list.params', { s: fmt(S.slope), w: S.wall, f: S.floor, d: S.divider, g: S.gap }),
    t('list.printer', { p: (PRINTERS.find(p => p.id === S.printer) || { name: t('printer.custom') }).name, x: S.bedX, y: S.bedY, z: S.bedZ }),
    '',
    t('list.layers'),
    ...hs.map((h, i) => t('list.layer', { n: i + 1, h: fmt(h), z: fmt(layerBase(i)) })),
    '',
    t('list.parts'),
    ...partsInfo.parts.map(p => {
      const o = outerSize(p.spec), s = p.spec, ex = [];
      if (s.scoop) ex.push(t('ed.scoop'));
      if (s.label) ex.push(t('ed.label'));
      if (s.foot) ex.push(t('list.foot'));
      if (s.lip) ex.push(t('list.lip'));
      let line = t('list.part', { l: p.letter, n: p.count, ly: [...p.layers].join('/'), w: fmt(o.w), d: fmt(o.h), h: fmt(s.H), c: s.dx * s.dy, g: Math.round(grams(s)) });
      if (ex.length) line += ', ' + ex.join(', ');
      if (s.texts.length) line += '\n   ' + t('list.texts', { t: s.texts.filter(Boolean).join(' | '), z: fmt(s.H - (s.lip ? LIP_H : 0) - TEXT_H) });
      if (!fitsBed(s)) line += '  ' + t('list.tooBig');
      return line;
    }),
    '',
    t('list.tip'),
    '',
    t('list.made', { u: CFG.siteUrl || 'Eurobox Inlay Generator' }),
  ].join('\r\n');
}
$('#dl-all').addEventListener('click', async () => {
  if (!need3D()) return;
  const btn = $('#dl-all'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  try {
    await downloadsReady;
    const files = partsInfo.parts.map(p => ({ name: partFileName(p), data: toSTL(binTris(p.spec), p.letter) }));
    files.push({ name: t('file.list'), data: new TextEncoder().encode(partsList()) });
    await offerFile(`eurobox-inlay-${boxSlug()}.zip`, await makeZip(files));
  } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
});
$('#dl-3mf').addEventListener('click', async () => {
  if (!need3D()) return;
  const btn = $('#dl-3mf'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  try {
    await downloadsReady;
    const blob = await makeZip(make3MF(partsInfo.parts), 'model/3mf');
    const name = `eurobox-inlay-${boxSlug()}.3mf`;
    // Die Claude-Vorschau erlaubt kein .3mf, dort kommt die Datei in ein ZIP
    if (downloadsApi) await offerFile(name.replace(/\.3mf$/, '-3mf.zip'), await makeZip([{ name, data: new Uint8Array(await blob.arrayBuffer()) }, { name: t('file.list'), data: new TextEncoder().encode(partsList()) }]));
    else await offerFile(name, blob);
  } finally { btn.disabled = false; btn.removeAttribute('aria-busy'); }
});
// Passform-Test: flaches Eckstück (Eckradius und Wandschräge) und bei Verzahnung ein Rand/Fuß-Paar
function testSpecs() {
  const R = Math.max(0.5, S.radius), BR = Math.max(R, S.boxRadius), base = { wall: S.wall, floor: S.floor, div: S.divider, hr: S.holeRadius,
    scoop: false, label: false, texts: [], dx: 1, dy: 1, foot: false, lip: false, sg: 0 };
  const n = 60, h = 12, g = r2(grow(h));
  const out = [{ name: t('test.corner'), spec: { ...base, bw: n, bh: n, H: h, radii: [BR, R, R, R], base: [0, 0, n, n], top: [-g, -g, n, n], wi: S.wall } }];
  if (S.layers.some((l, i) => isLocked(i))) {
    const m = 50, hl = 14;
    out.push({ name: t('test.lip'), spec: { ...base, bw: m, bh: m, H: hl, radii: [R, R, R, R], base: [0, 0, m, m], top: [0, 0, m, m], wi: S.wall + LEDGE, lip: true } });
    out.push({ name: t('test.foot'), spec: { ...base, bw: m, bh: m, H: hl + LIP_H, radii: [R, R, R, R], base: [0, 0, m, m], top: [0, 0, m, m], wi: S.wall + LEDGE, foot: true, sg: S.stackGap } });
  }
  return out;
}
const testGrams = () => (HAS3D ? testSpecs().reduce((a, x) => a + grams(x.spec), 0) : 0);
$('#dl-test').addEventListener('click', async () => {
  if (!need3D()) return;
  await downloadsReady;
  const files = testSpecs().map(x => ({ name: `${slug(x.name)}.stl`, data: toSTL(binTris(x.spec), x.name) }));
  files.push({ name: t('file.testInfo'), data: new TextEncoder().encode(t('test.info', { g: S.gap, s: S.stackGap })) });
  await offerFile(`eurobox-${t('file.test')}-${boxSlug()}.zip`, await makeZip(files));
});
$('#dl-one').addEventListener('click', async () => {
  if (!need3D()) return;
  await downloadsReady;
  const p = partsInfo.byBin.get(S.selected); if (!p) return;
  const name = partFileName(p);
  const stl = toSTL(binTris(p.spec), p.letter);
  if (downloadsApi) await offerFile(name.replace(/\.stl$/, '.zip'), await makeZip([{ name, data: stl }]));
  else await offerFile(name, new Blob([stl], { type: 'model/stl' }));
});
$('#design-save').addEventListener('click', async () => {
  await downloadsReady;
  const data = JSON.stringify({ app: 'eurobox-inlay', version: 2, design: JSON.parse(snap()) }, null, 1);
  await offerFile(`eurobox-design-${boxSlug()}.json`, new Blob([data], { type: 'application/json' }));
});
$('#design-load').addEventListener('click', () => $('#design-file').click());
$('#design-file').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    if (f.size > 5e6) throw new Error('size');
    const j = JSON.parse(await f.text());
    const d = normalize(j && j.design ? j.design : j);
    if (!d) throw new Error('format');
    if (lastSnap) { past.push(lastSnap); future = []; }
    restore(JSON.stringify(d)); fitView(); toast(t('toast.loaded'));
  } catch { toast(t('toast.badFile')); }
});

/* ---------- Teilen-Link (nur auf der eigenen Webseite) ---------- */
const b64u = u => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
async function encodeDesign() {
  const raw = new TextEncoder().encode(snap());
  const z = await deflate(raw);
  return z ? 'z' + b64u(z) : 'r' + b64u(raw);
}
async function decodeDesign(code) {
  const kind = code[0], bytes = unb64u(code.slice(1));
  if (kind === 'r') return new TextDecoder().decode(bytes);
  const ds = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
  return await ds.text();
}
if (ON_WEB) {
  $('#share-link').hidden = false;
  $('#share-link').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#d=${await encodeDesign()}`;
    try { await navigator.clipboard.writeText(url); toast(t('toast.linkCopied')); }
    catch { history.replaceState(null, '', url); toast(t('toast.linkInBar')); }
  });
}

/* ---------- 3D ---------- */
let scene, camera, renderer, controls, world, binsGroup, shellGroup, boxGroup;
const clipPlane = HAS3D ? new THREE.Plane(new THREE.Vector3(0, 0, -1), 0) : null;
const mats = {};
const stage = $('#stage');
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const EXPLODE = 45;

// Eigene Kamera-Steuerung: ziehen = drehen, rechte Maustaste/Shift oder zwei Finger = verschieben, Rad/Pinch = zoomen
class Orbit {
  constructor(cam, el, onChange) {
    this.cam = cam; this.el = el; this.onChange = onChange;
    this.target = new THREE.Vector3();
    this.sph = new THREE.Spherical();
    this.pts = new Map();
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture?.(e.pointerId);
      this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
      this.pinch = null;
    });
    el.addEventListener('pointermove', e => {
      const prev = this.pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (this.pts.size === 1) {
        const dx = cur.x - prev.x, dy = cur.y - prev.y;
        if (this.mode === 'pan') this.pan(dx, dy); else this.rotate(dx, dy);
      } else if (this.pts.size === 2) {
        const [a, bb] = [...this.pts.entries()].map(([id, p]) => id === e.pointerId ? cur : p);
        const d = Math.hypot(a.x - bb.x, a.y - bb.y), m = { x: (a.x + bb.x) / 2, y: (a.y + bb.y) / 2 };
        if (this.pinch) { this.zoom(this.pinch.d / d); this.pan(m.x - this.pinch.m.x, m.y - this.pinch.m.y); }
        this.pinch = { d, m };
      }
      this.pts.set(e.pointerId, cur);
    });
    const up = e => { this.pts.delete(e.pointerId); this.pinch = null; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // Mausrad zoomt nur mit gedrückter Strg/⌘-Taste oder wenn die Ansicht den Fokus hat, sonst scrollt die Seite weiter
    el.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey || document.activeElement === el || stage.matches(':hover') && innerWidth > 860)) return;
      e.preventDefault(); this.zoom(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)));
    }, { passive: false });
  }
  sync() { this.sph.setFromVector3(this.cam.position.clone().sub(this.target)); this.apply(); }
  apply() {
    this.sph.phi = clampNum(this.sph.phi, 0.05, Math.PI * 0.49);
    this.sph.radius = clampNum(this.sph.radius, 60, 6000);
    this.cam.position.copy(this.target).add(new THREE.Vector3().setFromSpherical(this.sph));
    this.cam.lookAt(this.target);
    this.onChange();
  }
  rotate(dx, dy) {
    const h = this.el.clientHeight || 1;
    this.sph.theta -= 2 * Math.PI * dx / h; this.sph.phi -= 2 * Math.PI * dy / h;
    this.apply();
  }
  pan(dx, dy) {
    const f = 2 * this.sph.radius * Math.tan(this.cam.fov * Math.PI / 360) / (this.el.clientHeight || 1);
    this.cam.updateMatrix();
    const right = new THREE.Vector3().setFromMatrixColumn(this.cam.matrix, 0).multiplyScalar(-dx * f);
    const upV = new THREE.Vector3().setFromMatrixColumn(this.cam.matrix, 1).multiplyScalar(dy * f);
    this.target.add(right).add(upV);
    this.apply();
  }
  zoom(k) { this.sph.radius *= k; this.apply(); }
}
function stageMsg(html) { stage.insertAdjacentHTML('beforeend', `<div class="stage-msg"><div>${html}</div></div>`); }
function initThree() {
  if (!HAS3D) { stageMsg(`<strong>${esc(t('err.libTitle'))}</strong><br>${esc(t('err.lib'))}`); return; }
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  } catch (err) {
    renderer = null;
    stageMsg(`<strong>${esc(t('err.glTitle'))}</strong><br>${esc(t('err.gl'))}`);
    return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.localClippingEnabled = true;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', t('hud.canvasAria'));
  stage.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, 1, 1, 6000);
  controls = new Orbit(camera, renderer.domElement, requestRender);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a90, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-300, 600, 400);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5);
  fill.position.set(400, 200, -300);
  scene.add(fill);

  world = new THREE.Group();
  world.rotation.x = -Math.PI / 2; // Modell ist Z-oben, Three.js ist Y-oben
  scene.add(world);
  binsGroup = new THREE.Group(); shellGroup = new THREE.Group(); boxGroup = new THREE.Group();
  world.add(binsGroup, shellGroup, boxGroup);

  mats.bin = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
  mats.dim = new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  mats.sel = new THREE.MeshStandardMaterial({ roughness: 0.45, side: THREE.DoubleSide });
  mats.warn = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
  mats.text = new THREE.MeshStandardMaterial({ roughness: 0.5, side: THREE.DoubleSide });
  mats.box = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide });
  mats.handle = new THREE.MeshBasicMaterial({ color: 0x111113, side: THREE.DoubleSide });
  mats.ghost = new THREE.MeshStandardMaterial({ roughness: 0.75, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  mats.edge = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
  mats.edgeDim = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.12 });
  mats.shell = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 });
  mats.floor = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  mats.limit = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
  mats.limitLine = new THREE.LineBasicMaterial();
  applyColors();

  new ResizeObserver(resize).observe(stage);
  resize();

  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(binsGroup.children.filter(o => o.isMesh && o.userData.id), false)[0];
    if (!hit) { select(null); return; }
    const { id, li } = hit.object.userData;
    if (li !== S.active) S.active = li;
    S.selected = id; update({ rebuild: false });
  });
  // Tastatur: Pfeile drehen, +/− zoomen
  renderer.domElement.addEventListener('keydown', e => {
    const k = e.key, st = 18;
    if (k === 'ArrowLeft') controls.rotate(-st, 0); else if (k === 'ArrowRight') controls.rotate(st, 0);
    else if (k === 'ArrowUp') controls.rotate(0, -st); else if (k === 'ArrowDown') controls.rotate(0, st);
    else if (k === '+' || k === '=') controls.zoom(0.9); else if (k === '-') controls.zoom(1.1);
    else return;
    e.preventDefault();
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyColors(); requestRender(); });
  new MutationObserver(() => { applyColors(); requestRender(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

function applyColors() {
  if (!scene) return;
  scene.background = new THREE.Color(css('--scene'));
  const fil = FILAMENTS.find(f => f.id === S.fil) || FILAMENTS[0];
  mats.bin.color.set(fil.c);
  mats.dim.color.set(fil.c);
  mats.box.color.set((BOXCOLORS.find(f => f.id === S.boxc) || BOXCOLORS[0]).c);
  mats.ghost.color.copy(mats.box.color);
  const light = new THREE.Color(fil.c).getHSL({}).l > 0.5;
  mats.text.color.set(light ? '#2b2c30' : '#f4f4f2');
  mats.sel.color.set(css('--accent'));
  mats.warn.color.set(css('--limit'));
  mats.edge.color.set(light ? '#000000' : '#ffffff');
  mats.edgeDim.color.set(light ? '#000000' : '#ffffff');
  mats.edge.opacity = light ? 0.22 : 0.3;
  mats.shell.color.set(css('--shell'));
  mats.floor.color.set(css('--shell'));
  mats.limit.color.set(css('--limit'));
  mats.limitLine.color.set(css('--limit'));
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  requestRender();
}

let renderQueued = false;
function requestRender() {
  if (renderQueued || !renderer) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderer.render(scene, camera);
  });
}

// Kleine Helfer zum Aufbau geschlossener Körper (für das Box-Modell)
function mesher() {
  const T = [];
  const tri = (a, b, c) => T.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  const P = (p, z) => [p[0], p[1], z];
  const v2 = p => new THREE.Vector2(p[0], p[1]);
  const fan = (poly, z, up) => { for (let k = 1; k < poly.length - 1; k++) up ? tri(P(poly[0], z), P(poly[k], z), P(poly[k + 1], z)) : tri(P(poly[0], z), P(poly[k + 1], z), P(poly[k], z)); };
  const loft = (lo, hi, z0, z1, out) => {
    for (let k = 0; k < lo.length; k++) {
      const q = (k + 1) % lo.length;
      if (out) { tri(P(lo[k], z0), P(lo[q], z0), P(hi[q], z1)); tri(P(lo[k], z0), P(hi[q], z1), P(hi[k], z1)); }
      else { tri(P(lo[k], z0), P(hi[q], z1), P(lo[q], z0)); tri(P(lo[k], z0), P(hi[k], z1), P(hi[q], z1)); }
    }
  };
  const face = (outer, inner, z, up) => {
    const all = outer.concat(...inner);
    for (const [ia, ib, ic] of THREE.ShapeUtils.triangulateShape(outer.map(v2), inner.map(h => h.map(v2)))) {
      const A = all[ia], B = all[ib], C = all[ic];
      const cz = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if ((cz >= 0) === up) tri(P(A, z), P(B, z), P(C, z)); else tri(P(A, z), P(C, z), P(B, z));
    }
  };
  return { T, tri, fan, loft, face };
}
function boxOuter() {
  const f = FOOTPRINTS.find(x => x.id === S.foot);
  if (f) { const [a, c] = f.name.split(' × ').map(Number); return { OL: a * 10, OW: c * 10 }; }
  return { OL: S.L + 45, OW: S.W + 45 };
}
// Vereinfachte Eurobox: schräge Wanne, breiter Rand oben, Rippen und Griffe an den Stirnseiten
function buildBox() {
  const m = mesher();
  const H = S.outerH, g = grow(innerH()), tw = 2.5, R = Math.max(1, S.boxRadius), RIM = Math.min(16, H * 0.2);
  const { OL, OW } = boxOuter(), ox = (OL - S.L) / 2, oy = (OW - S.W) / 2;
  const rr = (x0, y0, x1, y1, r) => rrect(x0, y0, x1, y1, [r, r, r, r]);
  const inB = rr(0, 0, S.L, S.W, R), inT = rr(-g, -g, S.L + g, S.W + g, R);
  const outB = rr(-tw, -tw, S.L + tw, S.W + tw, R + tw), outT = rr(-g - tw, -g - tw, S.L + g + tw, S.W + g + tw, R + tw);
  m.fan(outB, 0, false); m.loft(outB, outT, 0, H - 0.2, true); m.face(outT, [inT], H - 0.2, true);
  m.loft(inB, inT, BOX_FLOOR, H - 0.2, false); m.fan(inB, BOX_FLOOR, true);
  const rimO = rr(-ox, -oy, S.L + ox, S.W + oy, R + 10), rimI = rr(-g - tw / 2, -g - tw / 2, S.L + g + tw / 2, S.W + g + tw / 2, R + tw / 2);
  m.loft(rimO, rimO, H - RIM, H, true); m.loft(rimI, rimI, H - RIM, H, false);
  m.face(rimO, [rimI], H, true); m.face(rimO, [rimI], H - RIM, false);
  // Rippen unter dem Rand
  const zr = H - RIM, z0 = Math.max(BOX_FLOOR, zr - H * 0.55), wR = 2.5;
  const wallAt = z => tw + grow(z) - 0.6;
  const prism = (prof, a0, a1, axis, mirror) => {
    const tmp = mesher();
    let pr = prof;
    const area = pr.reduce((acc, p, i) => { const q = pr[(i + 1) % pr.length]; return acc + p[0] * q[1] - q[0] * p[1]; }, 0);
    if (area < 0) pr = [...pr].reverse();
    extrudeX(tmp.tri, pr, a0, a1);
    const A = tmp.T;
    for (let i = 0; i < A.length; i += 9) {
      const v = [0, 3, 6].map(o => {
        let [x, y, z] = [A[i + o], A[i + o + 1], A[i + o + 2]];
        if (mirror) y = (axis === 'x' ? S.W : S.L) - y;
        return axis === 'x' ? [x, y, z] : [y, x, z];
      });
      // Spiegeln oder Achsen tauschen dreht die Orientierung um
      if (mirror !== (axis === 'y')) m.tri(v[0], v[2], v[1]); else m.tri(v[0], v[1], v[2]);
    }
  };
  const ribs = (len, n) => Array.from({ length: n }, (_, i) => len * (i + 1) / (n + 1));
  for (const x of ribs(S.L, Math.max(2, Math.round(S.L / 95)))) {
    const prof = [[-wallAt(z0), z0], [-wallAt(zr), zr], [-oy + 1, zr]];
    prism(prof, x - wR / 2, x + wR / 2, 'x', false); prism(prof, x - wR / 2, x + wR / 2, 'x', true);
  }
  for (const y of ribs(S.W, Math.max(1, Math.round(S.W / 140)))) {
    const prof = [[-wallAt(z0), z0], [-wallAt(zr), zr], [-ox + 1, zr]];
    prism(prof, y - wR / 2, y + wR / 2, 'y', false); prism(prof, y - wR / 2, y + wR / 2, 'y', true);
  }
  return new Float32Array(m.T);
}
function rebuildBox() {
  boxGroup.children.forEach(o => o.geometry.dispose());
  boxGroup.clear();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buildBox(), 3));
  g.computeVertexNormals();
  boxGroup.add(new THREE.Mesh(g, mats.box));
  // Nächste Box im Stapel: Ihr tiefster Punkt liegt auf der Stapelgrenze
  const gh = new THREE.Mesh(g, mats.ghost);
  gh.position.z = maxH() + (S.explode ? EXPLODE * (S.layers.length - 1) : 0);
  gh.userData.ghost = true;
  gh.renderOrder = 2;
  boxGroup.add(gh);
  // Griffmulden an den Stirnseiten
  const { OL } = boxOuter(), ox = (OL - S.L) / 2, RIM = Math.min(16, S.outerH * 0.2);
  const hw = Math.min(110, S.W * 0.45), hh = Math.max(4, RIM * 0.55);
  for (const side of [-1, 1]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(hh, hw), mats.handle);
    pl.rotation.y = side * Math.PI / 2;
    pl.position.set(side < 0 ? -ox - 0.4 : S.L + ox + 0.4, S.W / 2, S.outerH - RIM / 2);
    boxGroup.add(pl);
  }
}
function applyView() {
  if (!scene) return;
  const show = S.view !== 'none';
  boxGroup.visible = show;
  boxGroup.children.forEach(o => { if (o.userData.ghost) o.visible = !!S.ghost && S.stacked && S.view === 'box'; });
  shellGroup.children.forEach(o => { if (!o.userData.limit) o.visible = !show; });
  // Schnitt mitten durch eine Teile-Reihe, damit Fuß und Rand sichtbar werden
  const L0 = S.layers[0].layout, ch = S.W / L0.rows;
  clipPlane.constant = (Math.floor(L0.rows / 2) + 0.5) * ch - S.W / 2;
  const planes = S.view === 'cut' ? [clipPlane] : [];
  for (const k of ['bin', 'dim', 'sel', 'warn', 'text', 'box', 'handle', 'edge', 'edgeDim', 'limit', 'limitLine']) { mats[k].clippingPlanes = planes; mats[k].needsUpdate = true; }
  recolor();
}

const rectLine = (x0, y0, x1, y1, z) => [x0, y0, z, x1, y0, z, x1, y0, z, x1, y1, z, x1, y1, z, x0, y1, z, x0, y1, z, x0, y0, z];
function rebuildShell() {
  shellGroup.children.forEach(o => o.geometry.dispose());
  shellGroup.clear();
  const L = S.L, W = S.W, H = innerH(), tg = grow(H);
  const v = [
    ...rectLine(0, 0, L, W, 0),
    ...rectLine(-tg, -tg, L + tg, W + tg, H),
    0, 0, 0, -tg, -tg, H, L, 0, 0, L + tg, -tg, H, L, W, 0, L + tg, W + tg, H, 0, W, 0, -tg, W + tg, H,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  shellGroup.add(new THREE.LineSegments(g, mats.shell));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), mats.floor);
  floor.position.set(L / 2, W / 2, -0.5);
  shellGroup.add(floor);
  const mh = maxH(), tm = grow(mh);
  const lim = new THREE.Mesh(new THREE.PlaneGeometry(L + 2 * tm, W + 2 * tm), mats.limit);
  lim.position.set(L / 2, W / 2, mh + (S.explode ? EXPLODE * (S.layers.length - 1) : 0));
  lim.userData.limit = true;
  shellGroup.add(lim);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(rectLine(-tm, -tm, L + tm, W + tm, lim.position.z), 3));
  const ll = new THREE.LineSegments(lg, mats.limitLine);
  ll.userData.limit = true;
  shellGroup.add(ll);
}

function rebuildScene() {
  binsGroup.children.forEach(o => o.geometry.dispose());
  binsGroup.clear();
  const cache = new Map();
  const geo = arr => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals(); return g; };
  S.layers.forEach((l, li) => {
    const cw = S.L / l.layout.cols, ch = S.W / l.layout.rows;
    const z = layerBase(li) - (isLocked(li) ? LIP_H : 0) + (S.explode ? EXPLODE * li : 0);
    for (const bin of l.layout.bins) {
      const p = partsInfo.byBin.get(bin.id);
      if (!cache.has(p.key)) {
        const bg = binGeo(p.spec), g = geo(bg.body);
        cache.set(p.key, { g, e: new THREE.EdgesGeometry(g, 35), tx: bg.text.length ? geo(bg.text) : null });
      }
      const { g, e, tx } = cache.get(p.key);
      const mesh = new THREE.Mesh(g, mats.bin);
      mesh.position.set(bin.x * cw + S.gap / 2, S.W - (bin.y + bin.h) * ch + S.gap / 2, z); // Plan-oben = hinten
      mesh.userData = { id: bin.id, li };
      const edges = new THREE.LineSegments(e, mats.edge);
      edges.position.copy(mesh.position);
      edges.userData = { li };
      edges.raycast = () => {};
      binsGroup.add(mesh, edges);
      if (tx) {
        const tm = new THREE.Mesh(tx, mats.text);
        tm.position.copy(mesh.position); tm.userData = { li, text: true }; tm.raycast = () => {};
        binsGroup.add(tm);
      }
    }
  });
  rebuildShell();
  rebuildBox();
  world.position.set(-S.L / 2, 0, S.W / 2);
  applyView();
}

function recolor() {
  for (const o of binsGroup.children) {
    const dim = S.view === 'none' && S.layers.length > 1 && o.userData.li !== S.active;
    if (o.userData.text) { o.visible = !dim; continue; }
    if (!o.isMesh) { o.material = dim ? mats.edgeDim : mats.edge; continue; }
    const p = partsInfo.byBin.get(o.userData.id);
    o.material = o.userData.id === S.selected ? mats.sel : dim ? mats.dim : (p && !fitsBed(p.spec) ? mats.warn : mats.bin);
    o.renderOrder = dim ? 1 : 0;
  }
  requestRender();
}

function fitView() {
  if (!camera) return;
  const top = (S.ghost && S.stacked && S.view === 'box' ? maxH() + S.outerH : S.outerH) + (S.explode ? EXPLODE * (S.layers.length - 1) : 0);
  const { OL, OW } = S.view === 'none' ? { OL: S.L, OW: S.W } : boxOuter();
  const size = Math.hypot(OL, OW, top * 0.8) * 1.1;
  const fit = size / 2 / Math.tan(camera.fov * Math.PI / 360) / Math.min(1, camera.aspect);
  const dir = (S.view === 'cut' ? new THREE.Vector3(0.3, 0.45, 1) : new THREE.Vector3(0.35, 0.75, 0.9)).normalize();
  controls.target.set(0, top * 0.4, 0);
  camera.position.copy(dir.multiplyScalar(fit * 1.05)).add(controls.target);
  controls.sync();
  requestRender();
}
$('#view-reset').addEventListener('click', fitView);
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
document.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
$('#view-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-view]'); if (!btn) return;
  S.view = btn.dataset.view; renderLook(); applyView(); fitView(); saveState();
});
$('#ghost-toggle').addEventListener('click', () => {
  S.ghost = !S.ghost;
  if (S.ghost && S.view !== 'box') S.view = 'box';
  if (S.ghost && !S.stacked) toast(t('toast.ghostNeedsStack'));
  renderLook(); applyView(); fitView(); saveState();
});
$('#fil-sw').addEventListener('click', e => {
  const btn = e.target.closest('button[data-fil]'); if (!btn) return;
  S.fil = btn.dataset.fil; renderLook(); applyColors(); recolor(); saveState();
});
$('#box-sw').addEventListener('click', e => {
  const btn = e.target.closest('button[data-boxc]'); if (!btn) return;
  S.boxc = btn.dataset.boxc; renderLook(); applyColors(); requestRender(); saveState();
});
document.querySelectorAll('[data-lang]').forEach(el => el.addEventListener('click', () => setLang(el.dataset.lang)));

/* ---------- Werbung (nur auf der eigenen Webseite und nur, wenn in config.js eingetragen) ---------- */
function initAds() {
  const slots = [...document.querySelectorAll('.ad-slot[data-slot]')];
  const client = String(CFG.adsenseClient || '').trim();
  if (!ON_WEB || !/^ca-pub-\d{10,20}$/.test(client)) { slots.forEach(el => el.remove()); return; }
  const s = document.createElement('script');
  s.async = true; s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  document.head.appendChild(s);
  for (const el of slots) {
    const id = CFG.adSlots && CFG.adSlots[el.dataset.slot];
    if (!id) { el.remove(); continue; }
    el.hidden = false;
    el.insertAdjacentHTML('beforeend', `<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(client)}" data-ad-slot="${esc(id)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
  // Einwilligung widerrufen: öffnet den Dialog der Google-Datenschutzmitteilungen (CMP)
  const c = $('#consent-link');
  if (c) {
    c.hidden = false;
    c.addEventListener('click', () => {
      window.googlefc = window.googlefc || {}; window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      window.googlefc.callbackQueue.push(() => window.googlefc.showRevocationMessage && window.googlefc.showRevocationMessage());
    });
  }
}
// Handy: Leiste ausblenden, solange der Export-Bereich im Bild ist
function initMobileBar() {
  const bar = $('#mbar'), sec = $('#h-export')?.closest('section');
  if (!bar || !sec || !('IntersectionObserver' in window)) return;
  bar.hidden = false;
  let inView = false, pastApp = false;
  const set = () => bar.classList.toggle('on', !inView && pastApp);
  new IntersectionObserver(es => { inView = es.some(e => e.isIntersecting); set(); }).observe(sec);
  // erst zeigen, wenn man in die Werkzeuge scrollt
  new IntersectionObserver(es => { pastApp = !es[0].isIntersecting; set(); }, { rootMargin: '-40% 0px 0px 0px' }).observe($('#stage'));
}
function initSite() {
  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
  const don = String(CFG.donateUrl || '').trim();
  document.querySelectorAll('.donate').forEach(el => {
    if (ON_WEB && /^https:\/\//.test(don)) { el.hidden = false; el.href = don; } else el.remove();
  });
  if (!ON_WEB) document.querySelectorAll('[data-web-only]').forEach(el => el.remove());
  if (ON_WEB && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ---------- Start ---------- */
applyStaticI18n();
clampDividers();
try { initThree(); } catch (err) {
  console.error(err);
  renderer?.domElement?.remove(); scene = null; camera = null;
  stageMsg(`<strong>${esc(t('err.startTitle'))}</strong><br>${esc(err && err.message || err)}`);
}
update();
fitView();
initSite();
initAds();
initMobileBar();
// Design aus einem Teilen-Link öffnen
if (ON_WEB && location.hash.startsWith('#d=')) {
  decodeDesign(location.hash.slice(3)).then(json => {
    const d = normalize(JSON.parse(json));
    if (!d) throw new Error('format');
    if (lastSnap) { past.push(lastSnap); future = []; }
    restore(JSON.stringify(d)); fitView(); toast(t('toast.linkLoaded'));
    history.replaceState(null, '', location.pathname + location.search);
  }).catch(() => toast(t('toast.linkBad')));
}
// Für automatische Tests
window.__ebx = { state: () => S, parts: () => partsInfo, binTris, make3MF, setLang, t };
})();
