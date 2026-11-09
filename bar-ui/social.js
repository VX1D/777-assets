// House card + the bar window's rows (rail, regulars' talk, stamp, flair, pour-off).
// Every number below is the live client's config (the `Club bar` block and its flair part). Anything the server owns (other cats, tickets, the bag)
// is SAMPLE and says so in the UI. No hand-holding: nothing marks what to press next; judgement comes after.
import { GAME, P, DRINKS, BACK, REGULARS, ART, h, img, now, clamp, pick, emit, on, sfx, cardOn } from './state.js';
import { glassSVG, pourSVG, shakerSVG, Liquid } from './glassware.js';
import { pourDone, tip } from './sound.js';

/* ───────── real config (client) ───────── */
const CLUB = {
  ...GAME.club,                                          // menu, bottles, zone, perfect, good, rush, every, wait, step, swing, pour
  gap: 2, hold: 8,
  jar: { after: 300, half: 100, floor: .02, drain: 12 },
  drunk: { menu: ['drink:mead', 'drink:cider'] },              // the kicked drinks on the House card
};
const FLAIR = {
  slack: 1.5, near: 120, duo: 96,
  tricks: {
    toss: { name: 'Toss and catch', node: 'toss', rings: [[1.2, 3.4]] },
    spin: { name: 'Spin', node: 'spin', rings: [[1.2, 3.4], [4.2, 6.4]] },
    behind: { name: 'Behind the back', node: 'behind', rings: [[1, 3], [3.5, 5.6], [6.2, 8.3]] },
    roll: { name: 'Tin roll', node: 'tin-roll', rings: [[1, 3.2]], tins: true },
    stack: { name: 'Stack', node: 'stack', rings: [[1, 3.2], [4, 6.2]], tins: true },
    split: { name: 'Split pour', node: 'split', rings: [[1, 3.2]], tins: true, split: true },
    duo: { name: 'Duo', node: 'duo', rings: [[4.6, 6.8]], mate: [[.8, 3]] },
    flame: { name: 'Flame', node: 'flame', rings: [[1.2, 3.4]], fire: 'flash' },
    blue: { name: 'Flaming float', node: 'flaming-float', rings: [[1, 3.2], [4, 6.2]], fire: 'blue', layered: true },
    line: { name: 'Fire line', node: 'fire-line', rings: [[1, 3.2], [3.8, 6]], fire: 'line', peak: true },
  },
  peaks: [{ id: 'work', at: 17.5, len: .5, rush: false }, { id: 'late', at: 23, len: .5, rush: true }],
};
const CRAFT = ['Rough', 'Good', 'Fine', 'Jade'];           // farm-goods grades in the client

/* ───────── shared helpers ───────── */
const S = P.soc;
const dn = id => DRINKS[id]?.name ?? id;
const POOL = [...CLUB.menu, ...CLUB.drunk.menu].map(id => DRINKS[id]).filter(d => d?.house);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const isLearned = node => P.tech.has(node) || P.flairTech.has(node);

// A scope per mounted root: timers + one rAF loop, all gone when the root leaves the DOM or gets re-mounted.
const changed = () => emit('state');

/* ───────── shared world (sample, the server owns it) ───────── */
const W = (P.socWorld ??= {
  rail: [],   // player tickets on the rail (sample ones arrive over the first minute): they paid up front, the pourer gets the stars
  near: ['Moth', 'kiko', 'Bramble'],      // sample cats within reach
  clock0: now(),
});
// island clock (sample): starts at 23:20 and runs a minute every two seconds so the late peak (rush) comes round
const island = () => { const m = (23 * 60 + 20 + (now() - W.clock0) / 2) % 1440; return m / 60; };
const atPeak = hr => FLAIR.peaks.find(p => hr >= p.at && hr < p.at + p.len);

/* ════════════════════════════ TEND STATE (shared by the House card and the rows) ════════════════════════════ */
// 1:1 with the client's outer bar window: one order at a time (`sh.o`), a served count and a
// row (`sh.n`, `sh.r`), the ticket rail, the stamp after each pour, the flair row and the pour-off row. The server's
// side (patrons, tickets, other bartenders, judging) is simulated here with the client's own config numbers.
const NIGHTS = { wander: { amp: .1, period: 6, back: .2 }, share: .5,
  want: { static: ['cold', 'fresh'], moths: ['sweet'], race: ['fizzy'], derby: ['strong'], rain: ['warm'], fans: ['cold'], reboot: ['fresh', 'sour'], openmic: ['sweet', 'fizzy'], eclipse: ['bitter', 'smoky'], packets: ['sour'], jackpot: ['sweet', 'fizzy'], highroll: ['strong', 'smoky'], neon: ['sour', 'fresh'], ghost: ['cold', 'bitter'] },
  say: { bloom: 'Something fresh, like the first warm night.', derby: 'Something strong. My beetle runs in the next heat.', eclipse: 'Something dark and bitter, to match the sky.', fans: 'Something cold, before I melt into the stool.', fools: 'Something sour. And no tricks, please.', ghost: 'Something cold. That machine just winked at me.', halloween: 'Something dark and sweet. Trick or treat.', harvest: 'Something warm and sweet, like the last of the harvest.', hearts: 'Something sweet, to say what I cannot.', highroll: 'Something strong, and make it look expensive.', jackpot: 'Something sweet with bubbles, for luck.', midsummer: 'Something cold and fresh, it is still warm out.', midwinter: 'Something warm and creamy, the night is long.', moths: 'Something sweet, while the moths are out.', neon: 'Something sharp, so I can keep my eyes on the wheel.', newyear: 'Something with bubbles, before the clock runs out.', openmic: 'Something sweet and fizzy to cheer them on.', packets: 'Something sour. My messages came in the wrong order again.', powercut: 'Lovely by candlelight. Whatever you can pour without the power.', quiet: 'Nice and quiet tonight. Take your time.', race: 'Something with bubbles before the next lap!', rain: 'Something warm, it is pouring out there.', reboot: 'Something fresh, for a fresh start.', starfall: 'Something cold and sweet, for watching the sky.', static: 'The screens are all snow tonight.' } };
const MOODS = { tired: ['warm', 'creamy'], celebrating: ['fizzy', 'sweet'], heartbroken: ['sour', 'bitter'], restless: ['fresh', 'cold'], homesick: ['sweet', 'warm'], low: ['cold', 'bitter'] };
const POURS = ['Terrible pour', 'Sloppy', 'Fine', 'Clean', 'Perfect pour'];
const ME = 'you';
const zl = t => { const n = Math.max(0, t) % CLUB.swing / CLUB.swing; return n < .5 ? n * 2 : 2 - n * 2; };          // the needle
const Bl = r => Math.min(CLUB.rush.max, Math.floor(r / CLUB.rush.step));                                            // rush bonus
const RS = w => w % 997 / 997 * Math.PI * 2;
const zS = (o, t) => o.w ? clamp(o.z + NIGHTS.wander.amp * Math.sin(Math.max(0, t) / NIGHTS.wander.period * Math.PI * 2 + RS(o.w)), CLUB.zone.least, CLUB.zone.most) : o.z;
const since = o => now() - Math.max(o.t, o.br ?? -Infinity);
const recipeOf = id => DRINKS[id]?.house || [];
const shakenOf = d => d.house ? d.house.includes('shake') : d.method === 'shake';
const CARDLIST = [...CLUB.menu, ...CLUB.drunk.menu];
function jarMult() { const j = CLUB.jar; return S.jarStars <= j.after ? 1 : Math.max(j.floor, .5 ** ((S.jarStars - j.after) / j.half)); }

const T = (W.tend ??= {
  o: null, last: -1e9, lastOrder: -1e9, nextAt: now() + 1.5, msg: 'Waiting for the first patron…', mix: [], busy: 0,
  po: { ask: null, vs: null, with: [] },                      // sample bartenders behind the bar with you (arrive later)
  fl: null, pass: null, flairPick: '', back: null,
});
try { T.flairPick = localStorage.getItem('bb_bar_flair') ?? ''; } catch { /* storage off */ }
// SAMPLE traffic the server would send: two player tickets and a pour-off ask over the first minute
if (!T.seeded) {
  T.seeded = true;
  const t0 = now();
  W.rail.push({ id: 1, who: 'kiko', d: 'drink:ping-fizz', st: 'open', at: t0 });
  setTimeout(() => { W.rail.push({ id: 2, who: 'loam', d: 'drink:mojito', st: 'open', at: t0 + 20 }); bump(); }, 20000);
  setTimeout(() => { W.rail.push({ id: 3, who: 'Moth', d: 'drink:ping-fizz', st: 'taken', by: 'Moth', at: t0 + 35 }); bump(); }, 35000);
  setTimeout(() => { T.po.with = ['kiko', 'Moth']; if (!T.po.vs) T.po.ask = 'kiko'; bump(); }, 50000);
}
const bump = () => emit('tend', T);
const ord = () => T.o || T.back;                              // the order flair and pour-off look at (House card or Back bar)

on('card', () => bump());
on('back-order', o => { T.back = o || null; bump(); });          // the Back bar's current order, so flair works there too
on('served', e => {                                             // a back-bar serve (drink, ticket or mood order) closes the shared order
  if (!e || e.house) return;
  const o = T.o;
  if (o && (e.t === o.t || (o.tk && o.d === e.drink))) {
    if (o.tk) o.tk.st = 'done';
    if (o.rg) heard(o, { ok: (e.grade ?? 0) >= 2, perfect: e.grade === 4, madeId: e.drink });
    if (o.po) T.po.vs = null;
    T.last = now(); T.nextAt = Math.max(T.lastOrder + CLUB.every, now() + CLUB.gap);
    setOrder(null);
  } else { const t = W.rail.find(t => t.st === 'taken' && t.by === ME && t.d === e.drink); if (t) { t.st = 'done'; bump(); } }
});

function setOrder(o) {
  if (!T.o && o) sfx('click');
  T.o = o; T.mix = [];
  if (o) { T.msg = ''; T.lastOrder = now(); }
  else T.msg = P.served ? 'Next patron coming…' : 'Waiting for the first patron…';
  emit('order', o); bump();
}
function newPatron() {
  const t = now(), hr = island(), peak = atPeak(hr), night = P.hosted?.c;
  const z = CLUB.zone.least + Math.random() * (CLUB.zone.most - CLUB.zone.least);
  const o = { t, z, who: pick(REGULARS), kind: 'patron', ...(peak?.rush && { w: 1 + Math.floor(Math.random() * 5000), wb: NIGHTS.wander.back }) };
  const due = dueRegulars();
  const can = BACK.filter(d => P.known.has(d.id) && (d.method !== 'stir' || P.tech.has('stir')) && (!d.float || P.tech.has('float')) && (P.night !== 'dark' || d.method === 'stir'));
  if (due.length && Math.random() < STORY.chance) {               // a regular who is due: their beat's mood, the beat's drink lit on the card
    const c = pick(due), n = told(c), b = c.beats[n];
    R.seen[c.id] = t;
    Object.assign(o, { rg: c.id, who: c.name, md: b.md, d: b.d, kind: 'mood', rp: lastAns(c) });
  } else if (can.length && SIDE === 'back') {     // on Back bar, patrons ask for a back-bar drink you can make
    const d = pick(can); o.d = d.id;
    const want = night && NIGHTS.want[night]; if (want && d.taste?.some(x => want.includes(x)) && NIGHTS.say[night]) o.nl = night;
  } else {
    const want = night && NIGHTS.want[night], fit = want ? POOL.filter(d => d.taste?.some(x => want.includes(x))) : [];
    const d = fit.length && Math.random() < NIGHTS.share ? pick(fit) : pick(POOL);
    o.d = d.id; if (night && NIGHTS.say[night] && fit.includes(d)) o.nl = night;
  }
  setOrder(o);
}
function tendTick(t) {
  if (!T.o && !T.po.vs && t >= T.nextAt) newPatron();
  if (T.o && T.o.kind !== 'ticket' && !T.o.po && !T.busy && t - T.o.t > CLUB.wait) { T.nextAt = t + CLUB.gap; setOrder(null); }   // left: the client just shows the next-patron line
  if (T.fl && !T.fl.done) flairTick(t);
}
function tapHouse(k) {
  const o = T.o; if (!o) return;
  if (k === 'pour') {
    if (!T.mix.length || T.busy) return;
    T.busy = performance.now(); sfx('click'); judge(o, T.mix.slice(), now()); return;
  }
  if (k === 'clear') { T.mix = []; sfx('click'); } else if (T.mix.length < 8) { T.mix.push(k); if (k === 'shake') sfx('shakeLong'); else pourDone(k, T.mix.filter(x => x !== 'shake').length - 1); }
  T.msg = ''; bump();
}
function judge(o, mix, t) {
  const rushOn = P.row >= CLUB.rush.step;
  const made = POOL.find(p => same(p.house, mix));
  let q;
  if (o.md) q = made && made.taste?.some(x => MOODS[o.md].includes(x)) ? 'ok' : 'wrong';
  else q = same(mix, recipeOf(o.d)) ? 'ok' : 'wrong';
  const want = o.md ? made : DRINKS[o.d];
  if (q === 'ok') {
    if (t - (o.mixAt ?? o.t) < mix.length * CLUB.step) q = 'spill';              // mixed sooner than the steps take → spilled
    else { const dist = Math.abs(zl(since(o)) - zS(o, since(o))); q = dist <= CLUB.perfect ? 'perfect' : dist <= CLUB.good ? 'good' : 'spill'; }
  }
  const stopX = zl(since(o)), poured = mix.slice();
  setTimeout(() => {                                                            // the server answers a beat later
    T.busy = 0; T.mix = [];
    T.fx = { k: q === 'wrong' ? 'wrong' : q === 'spill' ? 'spill' : 'pay', q, x: stopX, mix: poured, at: performance.now(), pay: 0 };   // for the station's feedback
    if (q === 'wrong') {
      T.msg = o.md ? 'That does not fit how they feel. Any drink with the right taste will do.'
        : (made ? `That is a ${made.name}, not a ${dn(o.d)}. Check the card.` : `That is not a ${dn(o.d)}. Check the card.`) + (rushOn ? ' The rush is over.' : '');
      sfx('fail'); P.row = 0; o.br = now(); changed();
      if (o.rg) { heard(o, { wrong: true }); T.nextAt = now() + CLUB.gap; setOrder(null); T.msg = ''; }
      bump(); return;
    }
    if (q === 'spill') {
      T.msg = rushOn ? 'Spilled it! Mix it again and stop the bar in the green. The rush is over.' : 'Spilled it! Mix it again and stop the bar in the green.';
      sfx('spill'); P.row = 0; o.br = now(); changed(); bump(); return;
    }
    const tn = now();
    if (tn - T.last > CLUB.rush.gap) P.row = 0;
    const bonus = Bl(P.row);
    const base = o.kind === 'ticket' ? (DRINKS[o.d]?.pay || 1) : (want.pay || 1) + (q === 'perfect' ? 1 : 0) + bonus;
    const pay = o.kind === 'ticket' ? base : Math.round(base * jarMult());
    T.last = tn; S.jarStars += pay; P.stars += pay; P.points++; P.served++; P.row++; P.shift.poured++; if (q === 'perfect') P.shift.perfect++;   // P.served / P.row are shared with the back bar: count up, never overwrite
    T.fx.pay = pay;
    const e = pay ? (q === 'perfect' ? `Perfect! +${pay} ★` : bonus ? `Rush! +${pay} ★` : `+${pay} ★`) : 'Tip jar full';
    if (pay) tip(P.row, q === 'perfect'); else sfx('click');
    const mk = q === 'perfect' ? 4 : 3;                                         // sample mapping: the server sends the mark
    emit('stamp', { mk, g: mk === 4 ? 2 : 1, d: want.id });
    emit('served', { drink: want.id, grade: q, pay, house: true });
    if (o.tk) o.tk.st = 'done';
    if (o.rg) heard(o, { ok: true, perfect: q === 'perfect', madeId: want.id });
    const nearFull = S.jarStars > CLUB.jar.after * .9 && S.jarStars - pay <= CLUB.jar.after * .9;
    if (o.po) T.po.vs = null;
    T.nextAt = Math.max(T.lastOrder + CLUB.every, tn + CLUB.gap);
    setOrder(null);
    T.msg = `${e} · ${T.msg}`;
    if (nearFull) T.msg += ' The tip jar is nearly full. It empties again as the evening goes on, and patrons still love a drink.';
    changed(); bump();
  }, 250);
}

/* ═══ The House side: the client's information and rules, in our own station design (social.css) ═══ */
// a lifetime for one element: a frame loop + listeners that end when the element leaves the page
function life(el) {
  const s = { alive: true, fns: new Set(), offs: [], timers: new Set(), seen: false };
  s.stop = () => { s.alive = false; cancelAnimationFrame(s.raf); s.timers.forEach(clearTimeout); s.offs.forEach(f => f()); };
  s.on = (ev, fn) => s.offs.push(on(ev, fn));
  s.after = (sec, fn) => { const t = setTimeout(() => { s.timers.delete(t); if (s.alive) fn(); }, sec * 1000); s.timers.add(t); };
  s.key = fn => { const k = e => { if (s.alive && el.isConnected && !e.target.closest?.('input,textarea,select')) fn(e); }; window.addEventListener('keydown', k, true); s.offs.push(() => window.removeEventListener('keydown', k, true)); };
  const loop = () => { if (!s.alive) return; if (el.isConnected) s.seen = true; else if (s.seen) return s.stop(); const t = now(); for (const f of s.fns) f(t); s.raf = requestAnimationFrame(loop); };
  s.raf = requestAnimationFrame(loop);
  return s;
}
const button = (text, onclick, a = {}) => h('button', { 'data-sfx': '', onclick, ...a }, text);
const chip = b => b === 'shake' ? h('i', { class: 'shake' }, '⇅') : h('i', { style: `--c: ${CLUB.bottles[b]?.col ?? '#fff'};` });
// the client's mood face (DQ): a 12×12 pixel face drawn at 2× into a canvas.pix.mood
const MQ = ['....kkkk....', '..kkyyyykk..', '.kyyyyyyyyk.', '.kyyyyyyyyk.', 'kyyyyyyyyyyk', 'kyyyyyyyyyyk', 'kyyyyyyyyyyk', 'kyyyyyyyyyyk', '.kyyyyyyyyk.', '.kyyyyyyyyk.', '..kkyyyykk..', '....kkkk....'];
const HQ = { tired: [[2, 4, 'g', 3], [7, 4, 'g', 3], [2, 5, 'k', 3], [7, 5, 'k', 3], [5, 8, 'k', 2], [10, 1, 'b'], [11, 0, 'b']], celebrating: [[3, 4, 'k'], [2, 5, 'k'], [4, 5, 'k'], [8, 4, 'k'], [7, 5, 'k'], [9, 5, 'k'], [3, 7, 'k', 6], [4, 8, 'r', 4], [5, 9, 'k', 2], [1, 7, 'p'], [10, 7, 'p'], [0, 1, 'r'], [11, 2, 'b'], [10, 0, 'y']], heartbroken: [[2, 3, 'k'], [3, 4, 'k'], [9, 3, 'k'], [8, 4, 'k'], [3, 5, 'k'], [8, 5, 'k'], [3, 6, 'b'], [3, 7, 'b'], [4, 8, 'k', 4], [3, 9, 'k'], [8, 9, 'k']], restless: [[3, 4, 'k'], [3, 5, 'k'], [8, 4, 'k'], [8, 5, 'k'], [2, 3, 'k', 2], [8, 3, 'k', 2], [3, 8, 'k'], [4, 9, 'k'], [5, 8, 'k'], [6, 9, 'k'], [7, 8, 'k'], [8, 9, 'k'], [11, 2, 'b'], [11, 3, 'b']], homesick: [[3, 3, 'k'], [4, 2, 'k'], [8, 3, 'k'], [7, 2, 'k'], [3, 6, 'k'], [8, 6, 'k'], [4, 9, 'k'], [5, 8, 'k', 2], [7, 9, 'k'], [2, 7, 'p'], [9, 7, 'p']], low: [[2, 5, 'g', 3], [7, 5, 'g', 3], [3, 6, 'k', 2], [7, 6, 'k', 2], [4, 9, 'k', 4], [10, 1, 'g', 2], [9, 0, 'g', 2]] };
const GQ = { k: 2366778, y: 16767370, b: 6211839, p: 16751288, r: 14694462, g: 9076654, w: 16777215 };   // the client's gQ
export function moodFace(md, t = 2) {
  const c = h('canvas', { class: 'pix mood' }); c.width = c.height = 12 * t;
  const x = c.getContext('2d'), px = (a, b, col, w = 1) => { if (!x) return; x.fillStyle = `#${col.toString(16).padStart(6, '0')}`; x.fillRect(a * t, b * t, w * t, t); };
  MQ.forEach((row, y) => { for (let i = 0; i < row.length; i++) { const col = GQ[row[i]]; if (col !== undefined) px(i, y, col); } });
  for (const [a, b, k, w = 1] of HQ[md] ?? []) px(a, b, GQ[k] ?? 0, w);
  return c;
}
// the client's drop (QQ) for the stamp's five drops
const QQ = ['..X..', '..X..', '.XXX.', 'XXXXX', 'XXSXX', 'XXXXX', '.XXX.'].flatMap((r, y) => [...r].map((ch, x) => ch === '.' ? '' : `${x * 2}px ${y * 2}px 0 ${ch === 'S' ? '#fff8' : 'currentColor'}`)).filter(Boolean).join(',');

// side: the client hides the House parts with .off on the Back-bar side; the rows stay
let SIDE = 'house';
on('side', v => {
  SIDE = v || 'house';
  if (SIDE === 'back' && (!T.o || (!T.o.md && !DRINKS[T.o.d]?.steps)) && !T.mix.length && !T.po.vs) {
    const can = BACK.filter(d => P.known.has(d.id) && (d.method !== 'stir' || P.tech.has('stir')) && (!d.float || P.tech.has('float')) && (P.night !== 'dark' || d.method === 'stir'));
    if (can.length) newPatron();
  } else if (SIDE === 'house' && (!T.o || (!T.o.md && !DRINKS[T.o.d]?.house)) && !T.mix.length && !T.po.vs) {
    newPatron();
  }
  bump();
});

/* ═══ Regulars with a story (client: club.story, main `jQ`; lines bar.rg.*) ═══
   When one is due for this bartender, half the walk-ins are a regular (story.chance .5); the same one comes back after
   story.again minutes at the soonest. Their order is the beat's mood (+ the beat's drink lit on the card). A pour at Fine
   or better tells the next beat (7 in all); the beat's own drink adds the ".r" line. After a beat: Listen or Joke. The
   seventh beat ends with the keepsake. Under Fine: "{name} keeps the rest for another night." */
const STORY = GAME.story;
const txt = (k, f = '') => GAME.strings?.[k] ?? f;
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
// regulars who arrive with the bar's year (club.year.months[].cast, from 2026-11): month they first come in
const ARRIVES = { wick: 1, nib: 2, fern: 3, clover: 4, wren: 5, fig: 6, pip: 7, juniper: 8, sorrel: 12 };
const arrived = id => { const m = ARRIVES[id]; if (!m) return true; return new Date() >= new Date(m >= 11 ? 2026 : 2027, m - 1, 1); };
// keepsake names: the server owns the item names; these are read off each regular's ".done" line (sample wording)
const KEEP_NAME = { 'trinket:rack-key': 'Old rack key', 'trinket:setlist': 'Signed setlist', 'trinket:wave-stone': 'Wave-marked stone', 'trinket:bus-ticket': 'Night bus ticket',
  'trinket:lamp-glass': 'Smoky lamp glass', 'trinket:pen-nib': 'Worn pen nib', 'trinket:seed-tin': 'Dented seed tin', 'trinket:pressed-clover': 'Pressed clover',
  'trinket:mixtape': 'Mixtape', 'trinket:recipe-card': 'Recipe card', 'trinket:courier-tag': 'Courier tag', 'trinket:star-chart': 'Star chart' };
const castOf = id => STORY.cast.find(c => c.id === id);
const told = c => P.regulars?.[c.name] ?? 0;                     // story parts told (shared with the book's Regulars tab)
const lastAns = c => (P.heard?.[c.name] ?? []).slice(-1)[0];
const R = (W.story ??= { seen: {}, talk: null });              // talk: {q:[lines], qi, at, who, hue, ans, gift}
const dueRegulars = () => STORY.on === false ? [] : STORY.cast.filter(c => arrived(c.id) && told(c) < c.beats.length && (now() - (R.seen[c.id] ?? -1e9)) / 60 >= STORY.again);
// sentences of a long line, split like the client (OQ): two bubbles when it runs past ~90 characters
const sentences = s => { const p = s.match(/[^.!?]+(?:[.!?]+["')’”]*|$)/g)?.map(x => x.trim()).filter(Boolean) ?? []; if (s.length <= 90 || p.length < 2) return [s]; let n = 1, best = 1e9, acc = 0; for (let i = 1; i < p.length; i++) { acc += p[i - 1].length + 1; const d = Math.abs(acc - s.length / 2); if (d < best) { best = d; n = i; } } return [p.slice(0, n).join(' '), p.slice(n).join(' ')]; };
// what the client's heard() shows after a regular's drink
function heard(o, { ok, perfect, wrong, madeId }) {
  const c = castOf(o.rg); if (!c) return;
  const name = c.name, lines = [];
  if (wrong) lines.push({ act: 1, text: fill(txt('bar.rg.spit', '{name} sprays it across the bar.'), { name }) });                  // sample: a wrong mix gets the spit
  else if (perfect) lines.push({ act: 1, text: fill(txt('bar.rg.nod', '{name} gives you a slow nod.'), { name }) });                  // sample: a Perfect gets the nod
  let ans = null, gift = null;
  if (ok) {
    const n = told(c);
    lines.push(...sentences(txt(`bar.rg.${c.id}.${n}`)).filter(Boolean).map(text => ({ text })));
    if (madeId && madeId === c.beats[n]?.d) { const r = txt(`bar.rg.${c.id}.${n}.r`); if (r) lines.push({ text: r, ic: 'glass' }); }
    (P.regulars ??= {})[c.name] = n + 1;
    if (n + 1 >= c.beats.length) { gift = c.keep; lines.push({ act: 1, gift: 1, text: txt(`bar.rg.${c.id}.done`) }); }
    else ans = { id: c.id, name: c.name, n, hue: c.hue };
    changed();
  } else lines.push({ act: 1, ic: 'later', text: fill(txt('bar.rg.wait', '{name} keeps the rest for another night.'), { name }) });
  R.talk = { q: lines.filter(l => l.text), qi: 0, at: now(), who: name, hue: c.hue, ans, gift, giftAt: -1 };
  bump();
}
function answer(k) {
  const a = R.talk?.ans; if (!a) return;
  ((P.heard ??= {})[a.name] ??= []).push(k); changed();
  R.talk = { q: [{ text: txt(`bar.rg.${a.id}.${a.n}.${k}`) }].filter(l => l.text), qi: 0, at: now(), who: a.name, hue: a.hue, ans: null, emote: k, emoteAt: now() };
  sfx(k === 'l' ? 'react' : 'click'); bump();
}
function talkTick(t) {
  const k = R.talk; if (!k) return;
  if (k.qi < k.q.length - 1 && t - k.at > 9) { k.qi++; k.at = t; bump(); }
  const last = k.qi >= k.q.length - 1, line = k.q[k.qi];
  if (line?.gift && k.giftAt < 0) { k.giftAt = t; sfx('claim'); bump(); }
  if (k.giftAt >= 0 && t - k.giftAt > 9 && k.gift) { k.gift = null; bump(); }
  if (last && !k.ans && !k.gift && t - k.at > 9) { R.talk = null; bump(); }
}

/* pixel art in the client's way (TZ): rows + palette, a dark outline and a lit top edge */
function pix(rows, pal, scale = 2, cls = 'pix') {
  const w = Math.max(...rows.map(r => r.length)), hgt = rows.length, c = h('canvas', { class: cls }); c.width = (w + 2) * scale; c.height = (hgt + 2) * scale;
  const x = c.getContext('2d'); if (!x) return c;
  const at = (i, j) => rows[j]?.[i] ?? '.', col = ch => (pal[ch] ?? '#ff00ff').replace(/^[=~]/, ''), mode = ch => (pal[ch] ?? '#')[0];
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), mix = (a, b, f) => a.map((v, i) => Math.round(v + (b[i] - v) * f)), css = a => `rgb(${a.join(',')})`;
  for (let j = -1; j <= hgt; j++) for (let i = -1; i <= w; i++) {
    const ch = at(i, j); let fillc = null;
    if (ch === '.') { const n = [at(i, j - 1), at(i - 1, j), at(i + 1, j), at(i, j + 1)].find(v => v !== '.' && mode(v) !== '~'); if (n) fillc = mix(rgb(col(n)), [20, 14, 30], .75); }
    else { const base = rgb(col(ch)); fillc = mode(ch) === '#' ? (at(i, j - 1) === '.' ? mix(base, [255, 255, 255], .3) : (at(i, j + 1) === '.' || at(i + 1, j) === '.') ? mix(base, [36, 29, 58], .3) : base) : base; }
    if (fillc) { x.fillStyle = css(fillc); x.fillRect((i + 1) * scale, (j + 1) * scale, scale, scale); }
  }
  return c;
}
const hueHex = (hue, s = .7, l = .45) => { const f = n => { const k = (n + hue / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255).toString(16).padStart(2, '0'); }; return `#${f(0)}${f(8)}${f(4)}`; };
const face = (hue, scale = 3) => pix(['h......h', 'hh....hh', 'hph..hph', 'hhhhhhhh', 'hkhhhhkh', 'hhhhhhhh', '.hhnnhh.', '..hhhh..'], { h: hueHex(hue), p: '=#ff9ab8', k: '=#241d3a', n: '=#ff9ab8' }, scale, 'pix face');
const ICON = {
  ear: [['f.........', 'ff.....s..', 'fpf.....s.', 'fppf..s..s', 'fpppf..s.s', 'fpppf..s.s', 'fppf..s..s', 'fpf.....s.', 'ff.....s..', 'f.........'], { f: '#ffd98a', p: '#ff9ab8', s: '=#5ec8ff' }],
  grin: [['...yyyy...', '.yyyyyyyy.', 'yyyyyyyyyy', 'yykyyyykyy', 'ykykyykyky', 'yyyyyyyyyy', 'ykkkkkkkky', 'yykrrrrkyy', '.yykkkkyy.', '...yyyy...'], { y: '#ffd98a', k: '=#241d3a', r: '=#e0383e' }],
  glass: [['ggggggg', '.gcccg.', '..gcg..', '...g...', '...g...', '.ggggg.'], { g: '#e6f5ff', c: '#ff4d8a' }],
  later: [['..mmm.', '.mm...', 'mm....', 'mm....', 'mm....', '.mm...', '..mmm.'], { m: '#ffe9a8' }],
};
const icon = (k, scale = 2) => pix(ICON[k][0], ICON[k][1], scale, 'pix ic');

/* the talk at the bar: the regular's ask bubble, the story bubble (tap to go on), Listen / Joke, the keepsake popup.
   It belongs to the bar, so it stays on both sides. */
function talkEl() {
  const el = h('div', { class: 'soc-row soc-talk', 'aria-live': 'polite' }), s = life(el);
  let askOpen = 0, key = '';
  const render = () => {
    const o = T.o, k = R.talk, c = o?.rg && castOf(o.rg);
    const kk = JSON.stringify([o?.t, o?.rg, k && [k.qi, k.q.length, !!k.ans, !!k.gift, k.giftAt >= 0, k.emote], askOpen > now(), SIDE]);
    if (kk === key) return; key = kk;
    const parts = [];
    if (k && k.q.length) {
      const line = k.q[k.qi], more = k.qi < k.q.length - 1;
      parts.push(h('div', { class: 'tk-bubble talk' + (line.act ? ' act' : ''), role: 'button', tabindex: 0, onclick: () => { if (more) { k.qi++; k.at = now(); bump(); } } },
        h('span', { class: 'tk-face' }, face(k.hue)), h('b', {}, k.who),
        h('p', {}, line.ic ? icon(line.ic) : null, line.text), more ? h('i', { class: 'tk-more', 'aria-label': 'More' }, '▾') : null));
      if (k.emote && now() - k.emoteAt < 1.6) parts.push(h('span', { class: `tk-emote ${k.emote}` }));
      if (k.ans && k.qi >= k.q.length - 1) parts.push(h('div', { class: 'tk-answers' }, h('span', { class: 'tk-face' }, face(k.ans.hue, 2)),
        button([icon('ear'), h('span', {}, txt('bar.rg.listen', 'Listen'))], () => answer('l'), { class: 'listen' }),
        button([icon('grin'), h('span', {}, txt('bar.rg.joke', 'Joke'))], () => answer('j'), { class: 'joke' })));
      if (k.gift && k.giftAt >= 0) parts.push(h('div', { class: 'tk-gift', role: 'status', onclick: () => { k.gift = null; bump(); } },
        img(`assets/${k.gift.replace(':', '-')}.png`, KEEP_NAME[k.gift] ?? k.gift, 'px'), h('span', {}, h('b', {}, KEEP_NAME[k.gift] ?? k.gift), txt('bar.rg.keep', ' is in your bag now.'))));
    } else if (c && SIDE !== 'back') {                      // the Back bar's order card already shows the mood line: no second copy there
      const text = [o.rp ? txt(`bar.rg.${o.rg}.hi.${o.rp}`) : '', txt(`bar.md.${o.md}`)].filter(Boolean).join(' ');
      const open = askOpen > now();
      parts.push(h('div', { class: 'tk-bubble ask' + (open ? '' : ' fold'), role: 'button', tabindex: 0, title: open ? '' : 'Tap to hear them', onclick: () => { askOpen = now() + 6; render(); } },
        h('span', { class: 'tk-face' }, face(c.hue)), h('b', {}, c.name), open ? h('p', {}, text) : h('i', { class: 'tk-more' }, '▾')));
    }
    el.replaceChildren(...parts);
    el.hidden = !parts.length;
  };
  let lastT = null;
  s.on('tend', () => { if (T.o?.t !== lastT) { lastT = T.o?.t; if (T.o?.rg) askOpen = now() + 6; } render(); });
  s.fns.add(t => { talkTick(t); if (askOpen && askOpen < t && askOpen > t - .1) render(); if (R.talk?.emote && t - R.talk.emoteAt > 1.6 && t - R.talk.emoteAt < 1.7) render(); });
  render();
  return { el, s };
}

// The House station: our design, the client's logic. Fills the width it gets:
//   menu board (the House card: recipes, Card on/off) · the pour (order, glass, meter, stamp + say, the house bottles) ·
//   the room (ticket rail, flair, pour-off — each hidden until needed). Same information as the client's House side.
const HBOT = { dew: 'soda', berry: 'berry', honey: 'honey', mint: 'mint' };       // house bottle → nearest real bottle sprite (no Dew sprite exists)
export function mountHouseCard(root, { rows = true } = {}) {
  root._socStop?.();
  const wrap = h('div', { class: 'soc soc-house' }), grid = h('div', { class: 'soc-hs' });   // .soc is the size container
  // menu board
  const recipes = h('div', { class: 'hs-recipes' });
  const legend = h('div', { class: 'hs-legend' },
    ...Object.entries(CLUB.bottles).map(([b, v], i) => h('span', {}, chip(b), `${i + 1} ${v.name}`)),
    h('span', {}, chip('shake'), '5 Shake'));
  const board = h('section', { class: 'hs-board', 'aria-label': 'House card' }, h('h3', {}, 'House card'), recipes, legend);
  // the pour
  const order = h('p', { class: 'hs-order', 'aria-live': 'polite' });
  // phone: the card's lit row (the drink ordered) pinned right under the order; the whole card opens as a sheet
  const pin = h('div', { class: 'hs-pin' });
  const shakeMark = h('span', { class: 'hs-shook', hidden: true }, '⇅');
  const glassLayer = h('div', { class: 'gw-glass' }), pourLayer = h('div', { class: 'gw-layer' });
  const glassArt = h('div', { class: 'hs-glass', 'aria-hidden': 'true' }, glassLayer, pourLayer, shakeMark);
  const shakerArt = h('span', { class: 'hs-skart' }); shakerArt.innerHTML = shakerSVG(false);
  const shaker = button([shakerArt, h('kbd', {}, 5)], () => tapHouse('shake'), { class: 'hs-shaker', title: 'Shake [5]', 'aria-label': 'Shake' });
  const neon = img('assets/club-barneon.png', '', 'px hs-neon');
  const floatEl = h('span', { class: 'hs-float', 'aria-hidden': 'true' }), stopTick = h('i', { class: 'stop' });
  const crowd = h('div', { class: 'hs-crowd', 'aria-hidden': 'true' }), crowdN = h('small', { class: 'hs-crowd-n' }), fire = h('div', { class: 'hs-fire', 'aria-hidden': 'true' }), flame = h('span', { class: 'hs-flame', hidden: true });
  const glass = h('div', { class: 'hs-mix', 'aria-label': 'Your mix' });
  const say = h('p', { class: 'hs-say', 'aria-live': 'polite' });
  const meter = h('div', { class: 'hs-meter', 'aria-label': 'Pour bar' }), good = h('i', { class: 'good' }), perfect = h('i', { class: 'perfect' }), needle = h('b');
  meter.append(good, perfect, needle, stopTick);
  // the House glass: one layer per tap (the same Liquid as the Back bar: it settles, sinks and diffuses), all of it run together by a shake
  const hliq = new Liquid();
  let lastFx = 0, lastLen = 0, pourAt = 0, pourId = 0, shakeAt = 0, houseKey = null, houseBusy = false, lastHouse = 0;
  const houseFill = n => Math.min(.9, n * .17);
  // the House glass: one layer per pour, everything before a shake blended into one colour; the newest pour rises while the bottle tips
  function drawHouse() {
    const t = performance.now() / 1000, dt = Math.min(.1, Math.max(0, t - lastHouse)); lastHouse = t;
    const busy = hliq.step(dt, t);
    const p = pourAt ? clamp((performance.now() - pourAt - 130) / 220, 0, 1) : 1;       // the newest pour rises while the bottle tips
    const { layers, sink, foam } = hliq.view(t, p < 1 ? { id: pourId, sub: 1 - p } : null);
    const n = layers.reduce((a, l) => a + l.v, 0);
    const ss = shakeAt ? (performance.now() - shakeAt) / 1000 : 9;          // the slosh after a shake dies away in about a second
    const motion = ss < 1.1 ? { slosh: { amp: Math.exp(-ss * 3.2), phase: ss * 19 } } : null;
    houseBusy = busy || !!motion || p < 1;
    const key = layers.map(l => l.c + l.v.toFixed(2) + l.soft.toFixed(2)).join(',') + (houseBusy ? t.toFixed(2) : '') + foam;
    if (key === houseKey) return; houseKey = key;
    glassLayer.innerHTML = glassSVG('house', { layers, fill: houseFill(n), motion, sink, foam });
  }
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const keyBtn = (b, v, i) => button([h('kbd', {}, i + 1), img(ART.bottle(HBOT[b] || 'clear'), v.name), h('span', {}, h('i', { class: 'bdot', style: `--c: ${v.col};` }), v.name)], () => tapHouse(b), { class: 'hs-btl', style: `--c: ${v.col};`, title: `${v.name} [${i + 1}]` });
  const pourBtn = button(['Pour', h('kbd', {}, 'Space')], () => tapHouse('pour'), { class: 'hs-go' });
  const shelf = h('div', { class: 'hs-shelf' },
    h('div', { class: 'hs-bottles' },
      Object.entries(CLUB.bottles).map(([b, v], i) => keyBtn(b, v, i))));
  const keys = h('div', { class: 'hs-keys' },
    shelf,
    h('div', { class: 'hs-acts' }, button(['Clear', h('kbd', {}, '⌫')], () => tapHouse('clear'), { class: 'hs-clear' }), pourBtn));
  const rail = rows ? railEl() : null, stamp = rows ? stampEl() : null, flair = rows ? flairEl() : null, po = rows ? pourOffEl() : null, talk = rows ? talkEl() : null;
  const bench = h('div', { class: 'hs-bench' }, h('div', { class: 'hs-counter' }, neon, crowd, h('span', { class: 'hs-top', 'aria-hidden': 'true' }), glassArt, shaker, flame, floatEl, fire), crowdN, glass);
  const pour = h('section', { class: 'hs-pour' }, talk?.el, order, pin, bench, meter,
    h('div', { class: 'hs-result' }, stamp?.el, say), flair?.el, keys);
  const room = h('aside', { class: 'hs-room', 'aria-label': 'Tickets and pour-offs' }, rail?.el, po?.el);
  grid.append(board, pour, room); wrap.append(grid);
  grid.addEventListener('click', e => { if (e.target === grid) grid.classList.remove('sheet'); });   // tap outside the card sheet closes it
  root.append(wrap);
  const s = life(wrap);
  const subs = [rail, stamp, flair, po, talk].filter(Boolean);
  root._socStop = () => { s.stop(); subs.forEach(x => x.s.stop()); wrap.remove(); root._socStop = null; };
  const setZone = o => { const z = o ? zS(o, since(o)) : .5; good.style.left = `${(z - CLUB.good) * 100}%`; good.style.right = `${(1 - z - CLUB.good) * 100}%`; perfect.style.left = `${(z - CLUB.perfect) * 100}%`; perfect.style.right = `${(1 - z - CLUB.perfect) * 100}%`; };
  function render() {
    const o = T.o;
    const back = SIDE !== 'house';                      // Back bar / other tabs: only the House parts go; the shared rows stay (client .off)
    for (const e of [order, bench, meter, keys, say]) e.classList.toggle('off', back);
    grid.classList.toggle('on-back', back);
    board.hidden = back || !cardOn();
    const lit = o?.d && CARDLIST.includes(o.d) && cardOn() && !back;
    pin.hidden = back || !cardOn();
    pin.replaceChildren(
      lit ? h('span', { class: 'hs-row now' }, img(ART.drink(o.d), '', 'px hs-dkico'), h('b', {}, dn(o.d)), h('span', {}, recipeOf(o.d).map(chip)), h('small', {}, `★${Number(DRINKS[o.d]?.pay ?? 0)}`))
        : h('span', { class: 'hs-pin-idle' }, 'House card'),
      button(['Card ', h('i', { 'aria-hidden': 'true' }, '▴')], () => { grid.classList.add('sheet'); }, { class: 'hs-pin-open' }));
    if (!board.querySelector('.hs-sheet-x')) board.append(button('×', () => grid.classList.remove('sheet'), { class: 'hs-sheet-x', 'aria-label': 'Close the card' }));
    recipes.replaceChildren(...CARDLIST.map(id => h('div', { class: 'hs-row' + (o?.d === id ? ' now' : '') },
      img(ART.drink(id), '', 'px hs-dkico'),
      h('b', {}, dn(id)),
      h('span', {}, recipeOf(id).map(chip)),
      h('small', {}, `★${Number(DRINKS[id]?.pay ?? 0)}`))));
    if (o) {
      const c = o.rg ? castOf(o.rg) : null;
      const hue = c ? c.hue : ((o.who || 'Cat').split('').reduce((a, ch) => a + ch.charCodeAt(0) * 37, 0) % 360);
      const who = h('b', { class: 'who' }, o.who), d = h('b', { class: 'dk' }, dn(o.d));
      const dkImg = o.d ? img(ART.drink(o.d), '', 'px hs-ordico') : null;
      if (o.po) order.replaceChildren('Pour-off: ', dkImg, d);
      else if (o.md) order.replaceChildren(who, ' ', moodFace(o.md));
      else order.replaceChildren(face(hue, 2), who, ' wants a ', dkImg, d);
      if (o.nl && NIGHTS.say[o.nl]) order.append(h('small', { class: 'nl' }, NIGHTS.say[o.nl]));
    } else order.replaceChildren(h('span', { class: 'idle' }, T.msg || 'Waiting for a patron…'));
    glass.replaceChildren(...(T.mix.length ? T.mix.map(chip) : [h('span', {}, 'Tap 1–4 to pour · 5 to shake · Space on the mark')]));
    const fx = T.fx, fresh = fx && performance.now() - fx.at < 900;
    if (fx && fx.at !== lastFx) {                              // feedback once per pour: where it stopped, and what came of it
      lastFx = fx.at;
      stopTick.style.left = `${fx.x * 100}%`; replay(meter, 'fx-stop'); meter.dataset.fx = fx.k;
      replay(bench, `fx-${fx.k}`);
      floatEl.textContent = fx.k === 'pay' ? (fx.pay ? `+${fx.pay} ★` : '') : '';
      if (fx.k === 'pay') replay(floatEl, 'go');
      s.after(.95, render);
    }
    const nb = T.mix.filter(b => b !== 'shake').length, last = T.mix[T.mix.length - 1];
    if (T.mix.length > lastLen && last !== 'shake' && nb > 0) {             // a new pour: the bottle comes in over the glass
      pourAt = performance.now(); pourId = hliq.pour(last, CLUB.bottles[last]?.col ?? '#fff', 1, pourAt / 1000, last === 'dew').id;
      pourLayer.innerHTML = pourSVG('house', { src: ART.bottle(HBOT[last] || 'clear'), c: CLUB.bottles[last]?.col ?? '#fff', fill: houseFill(nb), once: true });
      clearTimeout(pourLayer._t); pourLayer._t = setTimeout(() => { pourLayer.innerHTML = ''; }, 520);
    }
    if (T.mix.length > lastLen && last === 'shake') {                       // the shaker on the counter rattles
      replay(shaker, 'go'); replay(glassArt, 'shaken'); shakeAt = performance.now(); hliq.agitate(1); hliq.foam = 1;
    }
    if (!T.mix.length) { pourLayer.innerHTML = ''; pourAt = 0; shakeAt = 0; if (!fresh) hliq.clear(); }   // a served drink stays a moment
    const frost = T.mix.includes('shake'); if (shaker._f !== frost) { shaker._f = frost; shakerArt.innerHTML = shakerSVG(frost); }
    lastLen = T.mix.length;
    shakeMark.hidden = !T.mix.includes('shake');
    drawHouse();
    say.textContent = o ? T.msg : '';
    say.hidden = !say.textContent;
    setZone(o);
    meter.classList.toggle('idle', !o);
    pourBtn.disabled = !o || !T.mix.length || !!T.busy;
    // Crowd (learned): cats close by turn to watch while you flair; they hop on each clean catch
    const watching = isLearned('crowd') && (T.fl || T.pass || (T.flairFx && performance.now() - T.flairFx.at < 2500));
    if (watching && !crowd.childElementCount) {                      // the cats close by (sample: the room's near list), on both sides of the glass
      const cats = [...W.near, 'Tansy', 'Fig'].slice(0, 5).map((n, i) => h('span', { style: `--i:${i}`, title: n }, face((i * 67 + 200) % 360, 2)));
      crowd.replaceChildren(...cats.slice(0, 2), h('i', { class: 'gap' }), ...cats.slice(2));
    }
    crowd.classList.toggle('on', !!watching); crowdN.hidden = !watching; crowdN.textContent = watching ? `${crowd.querySelectorAll('span').length} watching` : '';
    if (!watching && !crowd.classList.contains('on')) crowd.replaceChildren();
    if (T.catchAt && T.catchAt !== crowd._c) { crowd._c = T.catchAt; replay(crowd, 'hop'); }
    // fire flair: a flash over the glass, a blue flame served lit on the drink, a line of flame along the bar
    const ff = T.flairFx;
    if (ff && ff.at !== fire._at) { fire._at = ff.at; fire.className = 'hs-fire'; if (ff.fire) { fire.className = `hs-fire ${ff.fire}`; replay(fire, 'go'); } if (!ff.ok && isLearned('crowd')) replay(crowd, 'boo'); s.after(2.6, render); }
    flame.hidden = !(o && o.lit);
    room.hidden = [rail?.el, po?.el].every(e => !e || e.hidden);
    grid.classList.toggle('no-board', board.hidden);
    grid.classList.toggle('no-room', room.hidden);
  }
  s.on('tend', render); s.on('card', render); s.on('side', render);
  s.fns.add(t => {
    tendTick(t);
    const o = T.o;
    if (T.busy && performance.now() - T.busy > 3000) { T.busy = 0; render(); }
    needle.style.left = `${o ? zl(since(o)) * 100 : 0}%`;
    if (houseBusy) drawHouse();
    if (o?.w) setZone(o);
  });
  s.key(e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((SIDE === 'house' || SIDE === 'back') && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) flairGo(); return; }
    if (SIDE !== 'house') return;
    const k = { 5: 'shake', ' ': 'pour', Backspace: 'clear' }[e.key] ?? Object.keys(CLUB.bottles)[Number(e.key) - 1];
    if (k) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) tapHouse(k); }
  });
  render();
}
// the mix's first tap starts the step clock (the client sends `at`; the server checks steps × `step`)
on('tend', () => { if (T.o && T.mix.length === 1 && T.o.mixAt == null) T.o.mixAt = now(); if (T.o && !T.mix.length) T.o.mixAt = null; });

export function toggleTicket(t) {
  if (!t) return;
  if (t.st === 'open') { t.st = 'taken'; t.by = ME; setOrder({ d: t.d, who: t.who, t: now(), z: CLUB.zone.least + Math.random() * (CLUB.zone.most - CLUB.zone.least), kind: 'ticket', tk: t }); }
  else if (t.st === 'taken' && t.by === ME) { t.st = 'open'; t.by = null; if (T.o?.tk === t) { T.nextAt = now() + CLUB.gap; setOrder(null); } }
  bump();
}
/* ═══ Rail: hanging player ticket rail ═══ */
function railEl() {
  const el = h('div', { class: 'soc-row soc-rail' }), s = life(el);
  const take = toggleTicket;
  const render = () => {
    const list = W.rail.filter(t => t.st === 'open' || t.st === 'taken');
    el.hidden = !list.length;
    el.replaceChildren(
      h('span', { class: 'hs-rbar', 'aria-hidden': 'true' }),
      h('div', { class: 'hs-slips' }, ...list.map(t => {
        const mine = t.st === 'taken' && t.by === ME;
        return h('div', { class: `hs-slip ${mine ? 'mine' : t.st}` },
          h('span', { class: 'pin', 'aria-hidden': 'true' }),
          img(ART.drink(t.d), '', 'px hs-tkico'),
          h('div', { class: 'hs-tkmeta' },
            h('small', {}, t.who || 'A cat'),
            h('b', {}, dn(t.d))),
          mine ? button('Yours', () => take(t)) : t.st === 'open' ? button('Take', () => take(t)) : button(t.by || 'A cat', null, { disabled: true }));
      })));
  };
  s.on('tend', render); render();
  return { el, s };
}
/* ═══ Stamp: p.stamp[data-m] > span.drops > 5 i(.on) · b pour name · small "a {grade} drink" ═══ */
let lastStamp = null;
on('stamp', st => { lastStamp = st; });
function stampEl() {
  const el = h('p', { class: 'soc-row soc-stamp' }), s = life(el);
  const render = st => {
    if (!st) return el.replaceChildren();
    el.dataset.m = String(st.mk);
    el.replaceChildren(h('span', { class: 'soc-drops', title: POURS[st.mk] }, Array.from({ length: 5 }, (_, i) => h('i', { class: i < st.mk + 1 ? 'on' : '', style: `--px: ${QQ};` }))),
      h('b', {}, POURS[st.mk]), h('small', {}, `a ${CRAFT[st.g] ?? CRAFT[0]} drink`));
  };
  s.on('stamp', render); render(lastStamp);
  return { el, s };
}
/* ═══ Flair row: div.flair > span + trick buttons, or span + div.rings(i.mine/theirs/got, b) + button.fcatch ═══ */
const trickOk = (k, o) => {
  const t = FLAIR.tricks[k], d = o && DRINKS[o.d];
  if (!isLearned(t.node)) return false;
  if (!d) return !t.tins && !t.split && !t.layered;
  if (t.tins && !shakenOf(d)) return false;
  if (t.split && W.rail.filter(x => x.d === d.id && x.st !== 'done').length < 2) return false;
  if (t.layered && !(d.float || d.fam === 'layered')) return false;
  if (t.peak && !atPeak(island())) return false;
  if (k === 'duo' && !W.near.length) return false;
  return true;
};
const ringsOf = t => [...(t.mate || []).map(r => ({ at: r[0], to: r[1], mate: true })), ...t.rings.map(r => ({ at: r[0], to: r[1], mate: false }))].sort((a, b) => a.at - b.at);
const endOf = t => Math.max(...[...t.rings, ...(t.mate || [])].map(r => r[1]));
const flairNow = () => T.pass ? { ...T.pass, pass: true } : T.fl && !T.fl.done ? { ...T.fl, pass: false } : null;
function throwIt(k) {
  const o = ord(); if (!o || o.fl) return;
  T.flairPick = k; try { localStorage.setItem('bb_bar_flair', k); } catch { /* storage off */ }
  sfx('send'); T.fl = { k, t0: now(), n: 0 }; bump();
}
function flairGo() {
  const f = flairNow();
  if (f) { sfx('catch'); flairTap(); return; }
  const tk = Object.keys(FLAIR.tricks).filter(k => trickOk(k, ord()));
  const k = tk.includes(T.flairPick) ? T.flairPick : tk[0];
  if (k && ord()) throwIt(k);
}
function flairTap() {                                         // the server's check: the tap must land in the next ring that is yours
  const f = flairNow(), tr = FLAIR.tricks[f.k], e = now() - f.t0;
  const mine = ringsOf(tr).filter(r => f.pass ? r.mate : !r.mate), r = mine[f.n];
  if (r && e >= r.at && e <= r.to) { (f.pass ? T.pass : T.fl).n++; T.catchAt = performance.now(); if (f.n + 1 >= mine.length) flairEnd(true); else { if (isLearned('crowd')) sfx('react'); bump(); } }
  else flairEnd(false);
}
function flairEnd(ok) {
  sfx(ok ? 'claim' : 'fail');
  if (T.pass) { T.pass = null; return bump(); }
  const o = ord(), tr = FLAIR.tricks[T.fl.k];
  if (ok && o) { o.fl = T.fl.k; if (tr.fire === 'blue') o.lit = true; }
  T.flairFx = { k: T.fl.k, ok, fire: ok ? tr.fire : null, at: performance.now() };
  T.fl = null; bump();
}
function flairTick(t) {
  const f = flairNow(); if (!f) return;
  const tr = FLAIR.tricks[f.k], mine = ringsOf(tr).filter(r => f.pass ? r.mate : !r.mate), r = mine[f.n];
  if (r && t - f.t0 > r.to + FLAIR.slack) flairEnd(false);                    // the ring went by: dropped
}
on('flair-pass', p => { T.pass = { k: p?.k || 'duo', t0: now(), n: 0 }; bump(); });   // hook: a partner passes to you (server)
function flairEl() {
  const el = h('div', { class: 'soc-row soc-flair' }), mark = h('b'), s = life(el);
  let key = '';
  const render = () => {
    const o = ord(), f = flairNow(), tk = Object.keys(FLAIR.tricks).filter(k => trickOk(k, o));
    el.hidden = (!tk.length || !o) && !f;                                  // hidden until there is an order to flair
    if (el.hidden) { key = ''; return; }
    const k2 = f ? `${f.k}:${f.t0}:${f.n}:${f.pass}` : `pick:${tk.join()}:${T.flairPick}:${!!o}:${o?.fl ?? ''}`;
    if (k2 === key) return; key = k2;
    if (f) {
      const tr = FLAIR.tricks[f.k], total = endOf(tr) + .6, rings = h('div', { class: 'soc-rings' });
      let a = 0, b = 0;
      for (const r of ringsOf(tr)) {
        const mineR = f.pass ? r.mate : !r.mate, got = f.pass ? r.mate && a++ < f.n : !r.mate && b++ < f.n;
        rings.append(h('i', { class: (mineR ? 'mine' : 'theirs') + (got ? ' got' : ''), style: `left: ${r.at / total * 100}%; width: ${(r.to - r.at) / total * 100}%;` }));
      }
      rings.append(mark);
      el.replaceChildren(h('span', {}, f.pass ? 'Catch the pass' : tr.name), rings, button('Catch (F)', flairGo, { class: 'soc-catch' }));
      return;
    }
    const pickK = tk.includes(T.flairPick) ? T.flairPick : tk[0];
    el.replaceChildren(h('span', {}, o?.fl ? 'Flair done. Now pour it.' : 'Flair'),
      ...tk.map(k => button(FLAIR.tricks[k].name, () => throwIt(k), { class: k === pickK ? 'on' : '', disabled: !o || !!o.fl })));
  };
  s.on('tend', render);
  s.fns.add(t => {
    if (!document.querySelector('.recipes ~ .keys')) tendTick(t);           // no House card on the page: the row keeps the clock
    const f = flairNow(); if (f) mark.style.left = `${clamp((t - f.t0) / (endOf(FLAIR.tricks[f.k]) + .6) * 100, 0, 100)}%`;
  });
  render();
  return { el, s };
}
/* ═══ Pour-off row: div.pouroff > span + buttons ═══ */
function pourOffEl() {
  const el = h('div', { class: 'soc-row soc-pouroff' }), s = life(el);
  const start = name => {                                    // the same House drink for both, at the same moment
    T.po.ask = null; T.po.vs = name;
    setOrder({ d: pick(CLUB.menu), who: name, t: now(), z: CLUB.zone.least + Math.random() * (CLUB.zone.most - CLUB.zone.least), kind: 'po', po: true });
  };
  const render = () => {
    const po = T.po, idle = !T.o && !po.vs;
    if (po.ask) el.replaceChildren(h('span', {}, `${po.ask} asks you for a pour-off.`), button('Pour off', () => start(po.ask)), button('Not now', () => { po.ask = null; bump(); }));
    else if (po.vs) el.replaceChildren(h('span', {}, `Pour-off with ${po.vs}`));
    else if (idle && po.with.length) el.replaceChildren(h('span', {}, 'Pour-off with'), ...po.with.map(n => button(n, () => s.after(1.2, () => start(n)))));   // sample: they say yes
    else el.replaceChildren();
    el.hidden = !el.childElementCount;
  };
  s.on('tend', render); render();
  return { el, s };
}
// standalone rows for the shell to place (both sides): each appends its element to `root` and returns it
const standalone = make => root => { root._socStop?.(); const r = make(); root.classList.add('soc'); root.append(r.el); root._socStop = () => { r.s.stop(); r.el.remove(); root._socStop = null; }; return r.el; };
export const mountStamp = standalone(stampEl);
export const mountFlairRow = standalone(flairEl);
export const mountPourOffRow = standalone(pourOffEl);
export const mountTalk = standalone(talkEl);
