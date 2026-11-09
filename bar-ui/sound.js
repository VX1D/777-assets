// Bar sounds. Each sound is synthesised once, offline, into a few short buffers right after the page loads (in idle
// time); during play only those buffers are started, so the bar costs no synthesis while you pour. No audio files.
// One-shots go through play(name); the pour and the stir are pre-rendered loops that run while the control is held
// (the pour's pitch rises with the jigger's level through the playback rate).
// Every bottle pours in its own voice (a family of liquids, then its own tuning), each layer of a drink plays the next
// note of a pentatonic scale, the jigger dings when it reaches the line, and tips ring higher the longer the row.
// The live context starts on the first sound, which always follows a tap or a key, so browsers allow it.

const RATE = 44100, VARIANTS = 3;
let ctx = null, out = null;                  // the live context: only buffer sources and gains run in it
let bake = null, bus = null, noiseBuf = null; // the offline context a sound is being rendered into
const BANK = {};                             // name → [AudioBuffer, …] (a few takes, so repeats do not sound identical)
const LOOPS = {};                            // 'pour:<liquid>' | 'stir' → AudioBuffer

const rnd = (a, b) => a + Math.random() * (b - a);

/* ── synthesis (runs only while baking) ── */
function env(t, peak, attack, decay, dest = bus) {
  const g = bake.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(.0001, t + attack + decay); g.connect(dest); return g;
}
function tone(t, f, dur, vol, { type = 'sine', to = null, attack = .004 } = {}) {
  const o = bake.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.connect(env(t, vol, attack, dur)); o.start(t); o.stop(t + attack + dur + .02);
}
// steady: a constant level for the whole length (the bed of a loop) instead of a strike that dies away
function noise(t, dur, vol, { type = 'bandpass', f = 1000, q = 1, to = null, attack = .003, steady = false } = {}) {
  const s = bake.createBufferSource(); s.buffer = noiseBuf; s.loop = steady; s.playbackRate.value = rnd(.9, 1.1);
  const fl = bake.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  let g; if (steady) { g = bake.createGain(); g.gain.value = vol; g.connect(bus); } else g = env(t, vol, attack, dur);
  s.connect(fl).connect(g); s.start(t, rnd(0, 1.5)); s.stop(t + attack + dur + .02);
}
// a struck glass: a few inharmonic partials ringing out
function ting(t, f, vol, decay = .3) {
  [[1, 1], [2.76, .5], [5.4, .25]].forEach(([m, a], i) => tone(t, f * m, decay / (i + 1), vol * a));
}
function clinks(t, n, spread, vol) {
  for (let i = 0; i < n; i++) { const at = t + rnd(0, spread); ting(at, rnd(2400, 4200), vol, .07); noise(at, .02, vol * .8, { type: 'highpass', f: 3000 }); }
}
// a bubble in liquid rings at a pitch set by its size and sweeps up as it rises and closes
function bubble(t, f, vol, len = 1) {
  tone(t, f, rnd(.035, .06) * Math.sqrt(700 / f) * len, vol, { to: f * rnd(1.6, 2), attack: .003 });
}
// a low glug: a big bubble from the neck of the bottle
const glug = (t, vol, [lo, hi] = [180, 320]) => tone(t, rnd(lo, hi), .07, vol, { to: rnd(lo, hi) * 1.8, attack: .004 });

// how each family of liquids pours: bubble pitch range, spacing, length, glugs (gap, pitch) and fizz
const LIQUIDS = {
  spirit: { lo: 380, hi: 950, gap: [.035, .08], len: 1, glug: [.2, .32], glugF: [180, 320] },
  wine: { lo: 300, hi: 760, gap: [.045, .095], len: 1.15, glug: [.18, .28], glugF: [160, 280] },
  syrup: { lo: 170, hi: 430, gap: [.09, .17], len: 1.9, glug: [.14, .22], glugF: [110, 190] },
  fizzy: { lo: 900, hi: 1700, gap: [.02, .045], len: .6, fizz: true },
  juice: { lo: 520, hi: 1250, gap: [.028, .065], len: .9, glug: [.25, .4], glugF: [220, 360] },
  creamy: { lo: 220, hi: 560, gap: [.07, .13], len: 1.5, glug: [.22, .34], glugF: [140, 240] },
};
const KIND = { clear: 'spirit', gin: 'spirit', rum: 'spirit', bitters: 'spirit', wine: 'wine', grape: 'wine', sweet: 'syrup', honey: 'syrup',
  soda: 'fizzy', tonic: 'fizzy', dew: 'fizzy', sour: 'juice', apple: 'juice', berry: 'juice', mint: 'juice', tea: 'juice',
  cream: 'creamy', milk: 'creamy', shot: 'creamy' };
const kindOf = b => KIND[b] ?? 'spirit';
// each bottle's own tuning inside its family: a fixed offset of up to ±3 semitones from its id
const tuneOf = b => 2 ** (([...String(b)].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % 7 - 3) / 12);
// `dense` packs the bubbles closer (a jigger tipped out at once) than a steady pour
function liquid(t, dur, kind, vol, dense = 1) {
  const L = LIQUIDS[kind];
  for (let at = t; at < t + dur - .02; at += rnd(...L.gap) / dense) bubble(at, rnd(L.lo, L.hi), vol * rnd(.45, 1), L.len);
  if (L.fizz) for (let at = t; at < t + dur - .02; at += rnd(.02, .05) / dense) bubble(at, rnd(1800, 3000), vol * rnd(.15, .35), .35);
  if (L.glug) for (let at = t + rnd(0, .08); at < t + dur; at += rnd(...L.glug) / dense) glug(at, vol * 1.3, L.glugF);
}

// [length in s, peak level it is normalised to, draw]
const SOUNDS = {
  click: [.06, .1, t => { tone(t, 1800, .025, .04); noise(t, .012, .05, { type: 'highpass', f: 4000 }); }],
  // a bottle lifted off the shelf: a low glass clunk
  pop: [.2, .3, t => { tone(t, 170, .12, .22, { to: 120 }); noise(t, .05, .1, { f: 900, q: 2 }); ting(t + .01, 2300, .025, .1); }],
  glass: [.45, .35, t => { tone(t, 110, .06, .14); ting(t, 1450, .07, .4); }],
  ice: [.4, .4, t => clinks(t, 4, .22, .06)],
  garnish: [.1, .2, t => { noise(t, .05, .12, { f: 620 }); tone(t, 300, .05, .05); }],
  // one shake beat: ice hitting tin
  shake: [.18, .38, t => { noise(t, .09, .32, { f: 2600, q: .8 }); clinks(t, 3, .06, .035); tone(t, 220, .05, .1, { type: 'triangle' }); }],
  shakeLong: [.6, .36, t => { for (let i = 0; i < 5; i++) SOUNDS.shake[2](t + i * .085); }],
  // a note for each layer of a drink (played up a pentatonic scale), and the ding when the jigger meets its line
  pluck: [.6, .3, t => { tone(t, 523.25, .5, .5); tone(t, 1046.5, .18, .2); tone(t, 2093, .06, .12); tone(t, 1569.75, .1, .08, { type: 'triangle' }); }],
  mark: [.4, .3, t => { ting(t, 1568, .3, .35); ting(t + .04, 2349, .2, .25); }],
  build: [.35, .3, t => { tone(t, 95, .08, .2); ting(t + .01, 1300, .05, .3); }],
  // paid: a coin into the tip jar
  tip: [.5, .38, t => { ting(t, 2637, .06, .35); ting(t + .07, 3136, .06, .45); noise(t + .07, .18, .05, { type: 'highpass', f: 6500 }); }],
  perfect: [.75, .42, t => { SOUNDS.tip[2](t); [1046, 1318, 1568, 2093].forEach((f, i) => tone(t + .14 + i * .06, f, .25, .06, { type: 'triangle' })); }],
  fail: [.4, .38, t => { tone(t, 230, .28, .14, { type: 'triangle', to: 120 }); noise(t, .08, .1, { type: 'lowpass', f: 400 }); }],
  spill: [.6, .55, t => { liquid(t, .25, 'juice', .3, 1.6); SOUNDS.fail[2](t + .12); }],
  claim: [.75, .36, t => [880, 1108, 1318].forEach((f, i) => tone(t + i * .08, f, .45, .07, { type: 'triangle' }))],
  // flair: the throw, and the catch
  send: [.5, .34, t => noise(t, .35, .22, { f: 400, to: 2400, q: 1.5, attack: .08 })],
  catch: [.1, .36, t => { noise(t, .03, .22, { f: 1500, q: 1.2 }); tone(t, 520, .05, .08); }],
  react: [.15, .14, t => tone(t, 740, .08, .06, { to: 980 })],
};
// the jigger tipped into the glass (also a House card pour), one per liquid
for (const kind of Object.keys(LIQUIDS)) SOUNDS[`dump:${kind}`] = [.55, .36, t => liquid(t + .1, .32, kind, .3, 1.7)];

// the pour (bubbles and glugs, one loop per liquid); the stir: a soft swirl and the spoon on the glass every 250 ms
const LOOP_DRAW = {
  ...Object.fromEntries(Object.keys(LIQUIDS).map(kind => [`pour:${kind}`, [2, .3, t => liquid(t, 2, kind, .2)]])),
  stir: [1, .2, t => {
    noise(t, 1.1, .12, { type: 'lowpass', f: 700, q: .7, steady: true });
    for (let k = 0; k < 4; k++) { ting(t + k * .25, rnd(3000, 3500), .125, .06); if (k === 1) clinks(t + k * .25 + .05, 1, .05, .15); }
  }],
};

async function render(len, draw) {
  bake = new OfflineAudioContext(1, Math.ceil(len * RATE), RATE);
  bus = bake.createGain(); bus.connect(bake.destination);
  draw(0);
  return bake.startRendering();
}
// scale each take so its loudest sample lands on `peak`: every take of a sound plays at the same level
function normalise(bufs, peak) {
  for (const b of bufs) {
    const d = b.getChannelData(0); let max = 0; for (const x of d) max = Math.max(max, Math.abs(x));
    if (max) for (let i = 0; i < d.length; i++) d[i] *= peak / max;
  }
  return bufs;
}
// make a loop seamless: cross-fade its extra last 80 ms into its start, then cut them off
function seamless(buf) {
  const d = buf.getChannelData(0), n = Math.floor(.08 * RATE), L = d.length - n;
  for (let i = 0; i < n; i++) { const k = i / n; d[i] = d[i] * k + d[L + i] * (1 - k); }
  const b = new AudioBuffer({ length: L, sampleRate: RATE }); b.copyToChannel(d.subarray(0, L), 0); return b;
}
let baking = null;
function bakeAll() {
  if (baking) return baking;
  noiseBuf = new AudioBuffer({ length: RATE * 2, sampleRate: RATE });
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  baking = (async () => {
    for (const [name, [len, peak, draw]] of Object.entries(SOUNDS)) {
      const takes = []; for (let v = 0; v < VARIANTS; v++) takes.push(await render(len, draw));
      BANK[name] = normalise(takes, peak);
    }
    for (const [name, [len, peak, draw]] of Object.entries(LOOP_DRAW)) LOOPS[name] = normalise([seamless(await render(len + .08, draw))], peak)[0];
    bake = bus = null;
  })().catch(() => { /* no audio: silent */ });
  return baking;
}
if (typeof OfflineAudioContext === 'function') (window.requestIdleCallback || (f => setTimeout(f, 300)))(bakeAll);

/* ── playback (live context: buffer sources only) ── */
function live() {
  if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 1; out.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function start(buf, { loop = false, rate = 1, fade = 0, delay = 0 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate;
  const g = ctx.createGain(); g.gain.value = fade ? 0 : 1; if (fade) g.gain.setTargetAtTime(1, ctx.currentTime, fade);
  s.connect(g).connect(out); s.start(ctx.currentTime + delay); return { s, g };
}
function stop(v) {
  if (!v) return;
  try { v.g.gain.setTargetAtTime(0, ctx.currentTime, .03); v.s.stop(ctx.currentTime + .2); } catch { /* already stopped */ }
}

export function play(name, { rate = 1, delay = 0 } = {}) {
  const takes = BANK[name]; if (!takes?.length) return;
  try { live(); start(takes[Math.floor(Math.random() * takes.length)], { rate, delay }); } catch { /* no audio: silent */ }
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];           // major pentatonic, in semitones
const note = i => 2 ** (SCALE[Math.min(i, SCALE.length - 1)] / 12);
// a layer lands in the glass: that bottle's splash, then the next note of the drink
export function pourDone(bottle, layer) {
  play(`dump:${kindOf(bottle)}`, { rate: tuneOf(bottle) });
  play('pluck', { rate: note(layer), delay: .14 });
}
// a tip: the coin rings a semitone higher for every drink in the row (up to an octave)
export function tip(row, perfect) { play(perfect ? 'perfect' : 'tip', { rate: 2 ** (Math.min(Math.max(row - 1, 0), 12) / 12) }); }

let pourV = null, stirV = null;
const pourRate = level => pourV.base * (.8 + level * .6);
export function pourStart(level = 0, bottle = 'clear') {
  const buf = LOOPS[`pour:${kindOf(bottle)}`];
  if (pourV || !buf) return;
  try { live(); pourV = { base: tuneOf(bottle) }; Object.assign(pourV, start(buf, { loop: true, rate: pourRate(level), fade: .02 })); } catch { pourV = null; }
}
export function pourLevel(level) { if (pourV) pourV.s.playbackRate.setTargetAtTime(pourRate(level), ctx.currentTime, .05); }
export function pourStop() { stop(pourV); pourV = null; }
export function stirStart() {
  if (stirV || !LOOPS.stir) return;
  try { live(); stirV = start(LOOPS.stir, { loop: true, fade: .03 }); } catch { stirV = null; }
}
export function stirStop() { stop(stirV); stirV = null; }
