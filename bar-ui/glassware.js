// Glassware for both stations: real glass silhouettes in SVG (open rim, see-through walls, thick base),
// the liquid in coloured layers, ice, garnish on the rim, and the pouring bottle + stream above the glass.
// One drawing for the Back bar (live, every frame while a bottle is held) and the House card (per tap).
// viewBox is 0 0 120 140 for every vessel, base on y≈137, so all glasses stand on the same counter line.

const S = {
  high:  { out: 'M32 8 L34 132 Q34.5 137 40 137 L80 137 Q85.5 137 86 132 L88 8', inn: 'M35.5 9.5 L37 121 L83 121 L84.5 9.5 Z', top: 13, bot: 121,
           base: 'M37 122 L83 122 L84 131.5 Q84 135 80 135 L40 135 Q36 135 36 131.5 Z', rim: [60, 8, 28, 3.4], hl: 'M39.5 18 L40.6 112' },
  rocks: { out: 'M22 52 L25.5 131 Q26 137 32 137 L88 137 Q94 137 94.5 131 L98 52', inn: 'M25.6 53.5 L28 120 L92 120 L94.4 53.5 Z', top: 58, bot: 120,
           base: 'M28 121 L92 121 L93 131 Q93 134.8 88 134.8 L32 134.8 Q27 134.8 27 131 Z', rim: [60, 52, 38, 4.4], hl: 'M30.5 62 L32 112' },
  coupe: { out: 'M12 44 Q14 82 52 85.5 L56.5 87 L57 127 Q45 129.5 36.5 133.5 Q35 136.8 40 137 L80 137 Q85 136.8 83.5 133.5 Q75 129.5 63 127 L63.5 87 L68 85.5 Q106 82 108 44',
           inn: 'M15.2 45.5 Q17.5 79 53 82.4 L67 82.4 Q102.5 79 104.8 45.5 Z', top: 48, bot: 82.4, rim: [60, 44, 48, 4.8], hl: 'M22 52 Q24 70 40 77',
           stem: 'M57.3 86 L62.7 86 L62.6 127.5 L57.4 127.5 Z' },
  nick:  { out: 'M26 34 Q26 80 54 87 L56.5 88.5 L57 127 Q47 129.5 39.5 133.5 Q38 136.8 42 137 L78 137 Q82 136.8 80.5 133.5 Q73 129.5 63 127 L63.5 88.5 L66 87 Q94 80 94 34',
           inn: 'M29.2 35.5 Q29.6 77 55 84 L65 84 Q90.4 77 90.8 35.5 Z', top: 38, bot: 84, rim: [60, 34, 34, 4], hl: 'M33 44 Q34 66 46 77',
           stem: 'M57.4 87 L62.6 87 L62.5 127.5 L57.5 127.5 Z' },
  tin:   { solid: 'metal', out: 'M30 18 L37 133.5 Q37.4 137 41 137 L79 137 Q82.6 137 83 133.5 L90 18 Z', rim: [60, 18, 30, 4.4], band: 'M31.4 40 L88.6 40' },
  mug:   { solid: 'metal', out: 'M28 40 L28 133 Q28 137 32 137 L82 137 Q86 137 86 133 L86 40 Z', rim: [57, 40, 29, 4.4], band: 'M28 50 L86 50',
           handle: 'M86 58 Q103 58 103 76 L103 94 Q103 112 86 112' },
  cup:   { solid: 'china', out: 'M26 78 L28 104 Q31 128.5 59 128.5 Q87 128.5 90 104 L92 78 Z', rim: [59, 78, 33, 4.4],
           handle: 'M90 88 Q106 88 104.5 101 Q103 112 88.5 110', saucer: [59, 133.5, 45, 4.6] },
};
S.jig = { inn: 'M17.4 17.5 L22.6 124 L57.4 124 L62.6 17.5 Z', top: 20, bot: 124, rim: [40, 16, 26, 3.2] };
S.house = { out: 'M26 20 L29 131 Q29.5 137 36 137 L84 137 Q90.5 137 91 131 L94 20', inn: 'M29.6 21.5 L32 121 L88 121 L90.4 21.5 Z', top: 25, bot: 121,
           base: 'M32 122 L88 122 L89 131.5 Q89 135 84 135 L36 135 Q31 135 31 131.5 Z', rim: [60, 20, 34, 4], hl: 'M35 30 L36.6 112' };
let uid = 0;
const esc = s => String(s).replace(/"/g, '&quot;');
const mixHex = cols => {                                                   // average of the layer colours (what a shake leaves)
  if (!cols.length) return '#ffffff';
  const v = [0, 0, 0]; for (const c of cols) { const n = parseInt(c.slice(1, 7), 16); v[0] += n >> 16; v[1] += n >> 8 & 255; v[2] += n & 255; }
  return '#' + v.map(x => Math.round(x / cols.length).toString(16).padStart(2, '0')).join('');
};
export { mixHex };

// layers: [{ c:'#hex', v: amount }] bottom→top · fill: 0..1 of the glass · ice: 'none'|'cubes'|'crushed'|'block'
// gar: garnish sprite url or '' · blend: the mix was shaken (one colour)
export function glassSVG(kind, { layers = [], fill = 0, ice = 'none', gar = '', blend = false } = {}) {
  const g = S[kind] || S.high, id = `gw${++uid}`;
  const [rx0, ry0, rrx, rry] = g.rim;
  const total = layers.reduce((a, l) => a + l.v, 0);
  const out = [];
  out.push(`<svg class="gw" data-g="${esc(kind)}" viewBox="0 0 120 140" aria-hidden="true">`);
  out.push(`<defs><linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".18" stop-color="#000" stop-opacity="0"/>`
    + `<stop offset=".3" stop-color="#fff" stop-opacity=".16"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".82" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient>`
    + (g.solid === 'metal' ? `<linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#6d7282"/><stop offset=".28" stop-color="#e9ecf4"/><stop offset=".42" stop-color="#b7bccb"/><stop offset=".8" stop-color="#8a8fa0"/><stop offset="1" stop-color="#5a5e6c"/></linearGradient>` : '')
    + (g.solid === 'china' ? `<linearGradient id="${id}m" x1="0" x2="1"><stop offset="0" stop-color="#b9b4c4"/><stop offset=".3" stop-color="#fbf8f2"/><stop offset=".75" stop-color="#e2ddd6"/><stop offset="1" stop-color="#a8a2b2"/></linearGradient>` : '')
    + (g.inn ? `<clipPath id="${id}c"><path d="${g.inn}"/></clipPath>` : '') + `</defs>`);
  // contact shadow on the counter
  out.push(`<ellipse cx="${rx0}" cy="137.5" rx="${(g.saucer?.[2] ?? rrx) + 2}" ry="3" fill="#000" opacity=".42"/>`);
  if (g.saucer) { const [x, y, a, b] = g.saucer; out.push(`<ellipse cx="${x}" cy="${y}" rx="${a}" ry="${b}" fill="url(#${id}m)"/><ellipse cx="${x}" cy="${y - 1.2}" rx="${a - 10}" ry="${b - 2}" fill="#0002"/>`); }
  const surfY = g.inn ? g.bot - (g.bot - g.top) * Math.min(1, fill) : ry0;
  if (g.solid) {
    if (g.handle) out.push(`<path d="${g.handle}" fill="none" stroke="url(#${id}m)" stroke-width="6" stroke-linecap="round"/>`);
    out.push(`<path d="${g.out}" fill="url(#${id}m)"/>`);
    if (g.band) out.push(`<path d="${g.band}" stroke="#ffffff55" stroke-width="1.4"/><path d="${g.band}" transform="translate(0 2)" stroke="#0003" stroke-width="1.2"/>`);
    out.push(`<ellipse cx="${rx0}" cy="${ry0}" rx="${rrx}" ry="${rry}" fill="${g.solid === 'metal' ? '#2a2733' : '#3a3440'}"/>`);
    if (total > 0) {                                                          // we look down into it: the surface just under the rim
      const top = blend ? mixHex(layers.map(l => l.c)) : layers[layers.length - 1].c;
      const k = .55 + .4 * Math.min(1, fill);
      out.push(`<ellipse class="gw-surf" cx="${rx0}" cy="${ry0 + .6}" rx="${(rrx - 3) * k}" ry="${(rry - .9) * k}" fill="${top}"/>`);
      out.push(`<ellipse cx="${rx0 - rrx * .25 * k}" cy="${ry0}" rx="${rrx * .22 * k}" ry=".9" fill="#fff" opacity=".45"/>`);
    }
    out.push(`<ellipse cx="${rx0}" cy="${ry0}" rx="${rrx}" ry="${rry}" fill="none" stroke="${g.solid === 'metal' ? '#f2f4fa' : '#fffdf7'}" stroke-width="1.6"/>`);
  } else {
    if (g.stem) out.push(`<path d="${g.stem}" fill="#e7ebff" opacity=".22"/>`);
    out.push(`<path d="${g.out}${g.stem ? '' : ' Z'}" fill="#dfe6ff" opacity=".045"/>`);
    out.push(`<g clip-path="url(#${id}c)">`);
    if (total > 0 && fill > 0) {
      const h = (g.bot - g.top) * Math.min(1, fill);
      let y = g.bot;
      const col = blend ? [{ c: mixHex(layers.map(l => l.c)), v: total }] : layers;
      for (const l of col) {
        const lh = h * l.v / total;
        out.push(`<rect x="0" y="${(y - lh).toFixed(2)}" width="120" height="${(lh + .6).toFixed(2)}" fill="${l.c}" opacity=".9"/>`);
        y -= lh;
      }
      const top = col[col.length - 1].c;
      out.push(`<rect class="gw-surf" x="0" y="${(surfY - .4).toFixed(2)}" width="120" height="2.6" fill="${top}"/><rect x="0" y="${(surfY - .4).toFixed(2)}" width="120" height="1.1" fill="#fff" opacity=".5"/>`);
      if (blend || layers.some(l => /fizz|soda|tonic/.test(l.k || ''))) for (let i = 0; i < 6; i++)
        out.push(`<circle class="gw-bub" style="--d:${(i * .37) % 1.6}s" cx="${44 + (i * 13) % 34}" cy="${g.bot - 4}" r="${.9 + (i % 3) * .35}" fill="#fff" opacity=".55"/>`);
    }
    if (ice !== 'none') {                                                      // ice sits in the glass, half under the surface
      const span = g.bot - g.top, x0 = rx0 - rrx + 8, w = rrx * 2 - 16;
      if (ice === 'cubes') for (const [fx, fy, r] of [[.12, .18, -8], [.55, .1, 12], [.3, .45, 6], [.68, .5, -14], [.18, .72, 18]]) {
        const s = Math.min(22, w * .34), x = x0 + fx * (w - s), y = g.bot - (fy * span * .62) - s - 2;
        if (y < g.top - 4) continue;
        out.push(`<rect class="gw-ice" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s}" height="${s}" rx="3.2" transform="rotate(${r} ${(x + s / 2).toFixed(1)} ${(y + s / 2).toFixed(1)})" fill="#eaf6ff" fill-opacity=".2" stroke="#fff" stroke-opacity=".7" stroke-width="1.1"/>`);
      }
      else if (ice === 'crushed') for (let i = 0; i < 46; i++) {
        const x = x0 + ((i * 37) % 100) / 100 * w, y = g.bot - 3 - ((i * 53) % 100) / 100 * span * .7;
        out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${3 + i % 3}" height="${3 + (i + 1) % 3}" rx="1" transform="rotate(${(i * 29) % 90} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#fff" opacity="${.35 + (i % 4) * .1}"/>`);
      }
      else if (ice === 'block') { const s = Math.min(w * .62, span * .7), x = rx0 - s / 2, y = g.bot - s - 3;
        out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" rx="4" fill="#f2f9ff" fill-opacity=".26" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/><path d="M${(x + 5).toFixed(1)} ${(y + 6).toFixed(1)} l${(s * .3).toFixed(1)} 0" stroke="#fff" stroke-opacity=".6" stroke-width="1.4"/>`); }
    }
    out.push(`<rect x="0" y="0" width="120" height="140" fill="url(#${id}s)"/></g>`);
    if (g.base) out.push(`<path d="${g.base}" fill="#e9eeff" opacity=".2"/><path d="${g.base}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".8"/>`);
    out.push(`<path d="${g.out}" fill="none" stroke="#eef1ff" stroke-opacity=".82" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
    out.push(`<path d="${g.hl}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.2" stroke-linecap="round"/>`);
    out.push(`<ellipse cx="${rx0}" cy="${ry0}" rx="${rrx}" ry="${rry}" fill="none" stroke="#f4f6ff" stroke-opacity=".9" stroke-width="1.5"/>`);
    out.push(`<path d="M${rx0 - rrx} ${ry0} A${rrx} ${rry} 0 0 0 ${rx0 + rrx} ${ry0}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.4"/>`);
  }
  if (gar) out.push(`<image class="gw-gar" href="${esc(gar)}" x="${rx0 + rrx - 14}" y="${ry0 - 20}" width="26" height="26"/>`);
  out.push(`</svg>`);
  return out.join('');
}

// Where the liquid surface is (viewBox y) for a glass filled to `fill`.
function surfaceY(kind, fill) { const g = S[kind] || S.high; return g.inn ? Math.max(g.rim[1], g.bot - (g.bot - g.top) * Math.min(1, fill)) : g.rim[1] + 1; }
// The pouring bottle, as its own layer over the glass (so the glass can redraw every frame without restarting this animation):
// tilted over the rim, mouth just above it, a stream down to the surface. once: a single short pour (House card tap).
export function pourSVG(kind, { src, c, fill = 0, once = false }) {
  const g = S[kind] || S.high, [rx0, ry0] = g.rim;
  const mx = rx0 + 2, my = ry0 - 16, cx = mx + 21, cy = my - 21, sy = surfaceY(kind, fill);
  return `<svg class="gw gw-over" viewBox="0 0 ${kind === 'jig' ? 80 : 120} 140" aria-hidden="true"><g class="gw-pour${once ? ' once' : ''}" style="--c:${c}">`
    + `<line class="gw-stream" x1="${mx}" y1="${my + 1}" x2="${mx}" y2="${sy}" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/>`
    + `<line class="gw-flow" x1="${mx}" y1="${my + 1}" x2="${mx}" y2="${sy}" stroke="#fff" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="3 7"/>`
    + `<ellipse class="gw-ripple" cx="${mx}" cy="${sy}" rx="5" ry="1.4" fill="none" stroke="${c}" stroke-width="1.4"/>`
    + `<image class="gw-btl" href="${esc(src)}" x="${cx - 28}" y="${cy - 28}" width="56" height="56"/></g></svg>`;
}
// Move the stream's end to the current surface (Back bar: the level rises while the bottle is held).
export function setPourLevel(over, kind, fill) {
  const sy = surfaceY(kind, fill);
  for (const l of over.querySelectorAll('line')) l.setAttribute('y2', sy);
  over.querySelector('.gw-ripple')?.setAttribute('cy', sy);
}

// The jigger: a small graduated measuring glass with a spout. The fill, the white line at what the order takes and
// the ticks per dot are moved by setJigger every frame (same information as before, drawn as a whole vessel).
const J = { top: 20, bot: 124 };
export function jiggerSVG() {
  return `<svg class="gw jsv" viewBox="0 0 80 140" aria-hidden="true"><defs>`
    + `<clipPath id="jgc"><path d="M17.4 17.5 L22.6 124 L57.4 124 L62.6 17.5 Z"/></clipPath>`
    + `<linearGradient id="jgs" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset=".2" stop-color="#000" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".16"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></linearGradient></defs>`
    + `<ellipse cx="40" cy="137.5" rx="24" ry="2.6" fill="#000" opacity=".42"/>`
    + `<path d="M14 16 L20 130 Q20.5 136 26 136 L54 136 Q59.5 136 60 130 L66 16 Z" fill="#dfe6ff" opacity=".045"/>`
    + `<g clip-path="url(#jgc)"><rect class="jg" x="0" y="124" width="80" height="0" opacity=".26"/><rect class="jf" x="0" y="124" width="80" height="0"/><rect class="jfs" x="0" y="124" width="80" height="1.2" fill="#fff" opacity="0"/>`
    + `<g class="jt"></g><rect x="0" y="0" width="80" height="140" fill="url(#jgs)"/></g>`
    + `<path d="M22.6 125 L57.4 125 L58.2 131 Q58.2 134.6 54 134.6 L26 134.6 Q21.8 134.6 21.8 131 Z" fill="#e9eeff" opacity=".2"/>`
    + `<path d="M14 16 L20 130 Q20.5 136 26 136 L54 136 Q59.5 136 60 130 L66 16" fill="none" stroke="#eef1ff" stroke-opacity=".82" stroke-width="2" stroke-linejoin="round"/>`
    + `<path d="M21 26 L25 116" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M14.4 16 Q9 12.5 6.5 14.6" fill="none" stroke="#eef1ff" stroke-opacity=".85" stroke-width="1.8" stroke-linecap="round"/>`
    + `<ellipse cx="40" cy="16" rx="26" ry="3.2" fill="none" stroke="#f4f6ff" stroke-opacity=".9" stroke-width="1.5"/>`
    + `<line class="jw" x1="15" x2="65" y1="0" y2="0" stroke-width="2.6" stroke-linecap="round" visibility="hidden"/></svg>`;
}
const jy = k => J.bot - (J.bot - J.top) * Math.max(0, Math.min(1, k));
const jx = y => { const t = (y - 17.5) / (124 - 17.5); return [17.4 + 5.2 * t, 62.6 - 5.2 * t]; };   // inner walls at height y
// fill / want: 0..1 of the jigger (want null = no line) · tick: one dot's share (0 = no ticks) · c: the bottle's colour
// base: the part of the fill that is this bottle's earlier measure, drawn as a pale shadow under the new pour
export function setJigger(svg, { fill = 0, base = 0, want = null, tick = 0, c = 'transparent' }) {
  const y = jy(fill), yb = jy(Math.min(base, fill)), f = svg.querySelector('.jf'), fs = svg.querySelector('.jfs'), g = svg.querySelector('.jg');
  g.setAttribute('y', yb); g.setAttribute('height', J.bot - yb + 1); g.setAttribute('fill', c);
  f.setAttribute('y', y); f.setAttribute('height', Math.max(0, yb - y + .5)); f.setAttribute('fill', c);
  fs.setAttribute('y', y - .2); fs.setAttribute('opacity', fill > 0 ? .55 : 0);
  const w = svg.querySelector('.jw');
  if (want == null) w.setAttribute('visibility', 'hidden');
  else { const wy = jy(want), [a, b] = jx(wy); w.setAttribute('visibility', 'visible'); w.setAttribute('y1', wy); w.setAttribute('y2', wy); w.setAttribute('x1', a - 3); w.setAttribute('x2', b + 3); }
  const t = svg.querySelector('.jt'), key = tick ? tick.toFixed(4) : '';
  if (t.dataset.k !== key) {
    t.dataset.k = key; let s = '';
    if (tick > 0) for (let k = tick; k < 1.0001; k += tick) { const ty = jy(k), [, b] = jx(ty); s += `<line x1="${b - 9}" x2="${b}" y1="${ty}" y2="${ty}" stroke="#fff" stroke-opacity=".75" stroke-width="1.2"/>`; }
    t.innerHTML = s;
  }
}

// A cobbler shaker in the same hand as the glassware: cap, strainer, metal body; frost once it has been shaken.
export function shakerSVG(frost = false) {
  const id = `sk${++uid}`;
  const dots = frost ? Array.from({ length: 34 }, (_, i) => `<circle cx="${25 + (i * 37) % 30}" cy="${48 + (i * 53) % 80}" r="${.7 + (i % 3) * .35}" fill="#fff" opacity="${.35 + (i % 4) * .1}"/>`).join('') : '';
  return `<svg class="gw sk" viewBox="0 0 80 140" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="1">`
    + `<stop offset="0" stop-color="#5f6474"/><stop offset=".22" stop-color="#eef1f8"/><stop offset=".36" stop-color="#b9bfcd"/><stop offset=".78" stop-color="#868b9c"/><stop offset="1" stop-color="#4f5361"/></linearGradient></defs>`
    + `<ellipse cx="40" cy="137.5" rx="19" ry="2.8" fill="#000" opacity=".45"/>`
    + `<g class="sk-body"><path d="M22 44 L58 44 L54.5 131 Q54.3 136 49 136 L31 136 Q25.7 136 25.5 131 Z" fill="url(#${id})"/>`
    + `<path d="M27 54 L30 126" stroke="#fff" stroke-opacity=".5" stroke-width="2.4" stroke-linecap="round"/>`
    + `<path d="M22.3 50 L57.7 50" stroke="#2c2f3a" stroke-opacity=".35" stroke-width="1"/>${dots}</g>`
    + `<g class="sk-top"><path d="M24 44 L56 44 L52 22 L28 22 Z" fill="url(#${id})"/><path d="M21 40.5 L59 40.5 L59 46 L21 46 Z" fill="url(#${id})"/>`
    + `<path d="M21 40.5 L59 40.5" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>`
    + `<path d="M31 22 L49 22 L48 13 Q48 9.5 44.5 9.5 L35.5 9.5 Q32 9.5 32 13 Z" fill="url(#${id})"/><path d="M34 12 L35 20" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/></g></svg>`;
}
// The bar spoon, stirring: a twisted stem down into the glass, turning around the middle while Stir is held.
export function spoonSVG() {
  let tw = ''; for (let y = -26; y < 96; y += 6) tw += `<path d="M${60 + (y + 26) * .05 - 1.6} ${y} l3.2 2.4" stroke="#6d7282" stroke-width="1"/>`;
  return `<svg class="gw gw-spoon" viewBox="0 0 120 140" aria-hidden="true"><g class="sp-turn">`
    + `<line x1="60" y1="-30" x2="66" y2="102" stroke="#e3e7f0" stroke-width="2.6" stroke-linecap="round"/>${tw}`
    + `<ellipse cx="66.4" cy="108" rx="3.2" ry="6" fill="#d2d7e2" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`
    + `<circle cx="60" cy="-32" r="3" fill="#d2d7e2"/></g></svg>`;
}
