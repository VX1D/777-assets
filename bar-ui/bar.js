// Cyberia bar: the window, the Back bar station and the shared HUD.
// Tabs: House card · Back bar · Bar book · Perks & Prep. The House card lives in social.js, the books in book.js,
// the glassware drawing in glassware.js; this file owns the Back bar (the client's qQ state machine) and the window.
// Back bar layout: left = ticket rail, paper order ticket, regulars' talk, your evening (tip jar · row · stars);
// right = bottle shelf → counter (jigger · glass · shaker, methods, flair) → trays (glasses · ice · garnish) + stock.
import { glassSVG, pourSVG, setPourLevel, jiggerSVG, setJigger, shakerSVG, spoonSVG, Liquid, Swirl, Ice, surfaceY } from './glassware.js';
import { pourStart, pourLevel, pourStop, pourDone, stirStart, stirStop, tip } from './sound.js';
import { GAME, B, DRINKS, BACK, METHOD, TRACK, ART, P, on, emit, $, h, img, now, clamp, fmt, rankInfo, sfx, cardOn, setCardOn } from './state.js';

const STIR = B.stir, SHAKE = B.shake, TOL = B.tol, W = B.score, CLUB = GAME.club;
const COFFEE = GAME.coffee || { on: false, bottles: {}, glasses: {} };
const NIGHTS_CFG = GAME.nights || { wander: { back: 0 }, conds: [], peaks: [] };
const STORY = GAME.story || { on: false, moods: {}, cast: [] };
const STR = GAME.strings || {};

/* ── client helpers, ported (tv-CiHszRFz.js) ── */
const CFG = COFFEE.on && Object.keys(COFFEE.bottles).length
  ? { ...B, bottles: { ...B.bottles, ...COFFEE.bottles }, glasses: { ...B.glasses, ...COFFEE.glasses } } : B;
const PAGES = (() => { const k = Object.keys(CFG.bottles), per = Math.max(CFG.page, Math.ceil(k.length / 2)), out = []; for (let i = 0; i < k.length; i += per) out.push(k.slice(i, i + per)); return out; })();
const hS = b => !!COFFEE.on && b in COFFEE.bottles && !(b in B.bottles);
const vS = d => d.steps.map(s => s.b).filter(b => hS(b) || (!!COFFEE.on && b === 'cream' && ['coffee', 'dairy'].includes(d.fam)));
const CS = (o, i) => (o?.w ? 1 + (o.wb ?? 0) * Math.sin(o.w % 997 / 997 * Math.PI * 2 * (i + 2) + i * 2.1) : 1);
const wS = t => Math.max(0, t) * B.fill;
const TS = t => Math.min(1.5, Math.max(0, t) / STIR.line);
const KQ = n => Math.max(1, Math.round(n * 2));
const DS = (on, book, fn = () => true) => (on ? (book.length ? (book.some(e => e.known) ? (book.some(e => e.can) ? (book.some(e => e.can && fn(e.d)) ? 'wait' : 'dark') : 'cannot') : 'learn') : 'wait') : 'off');
const LS = (nt, d) => { const only = nt?.c && NIGHTS_CFG.conds.find(c => c.id === nt.c)?.only; if (!only) return true; if (!d?.steps) return only.includes('house'); return only.includes(d.method); };
const H = (k, def, vars) => (STR[k] || def).replace(/\{(\w+)\}/g, (_, v) => vars?.[v] ?? '');
const NR = (c, v) => (v === undefined ? '' : H(`bar.nt.${c}.${v}`, '')) || H(`bar.nt.${c}`, '');
const isBack = id => !!DRINKS[id]?.steps;

/* ── real config from the live client ── */
const JAR = { after: 300, half: 100, floor: .02, drain: 12 };
const JAR_CAP = JAR.after + JAR.half;
const ROW = CLUB.rush;
const ROLE = 'Bartender';
const PRAISE = [
  { text: 'A Perfect pour, the kind people remember.', ev: 'perfect', n: 1 },
  { text: 'Not one Terrible pour all shift.', ev: 'pour', n: 5, without: 'terrible' },
  { text: 'Kept a rush going like a pro.', ev: 'rush', n: 1 },
  { text: 'Not one bottle dropped, and the room was watching.', ev: 'flair', n: 3, without: 'drop' },
  { text: 'Passed a bottle across the bar and both of you caught it.', ev: 'duo', n: 1 },
  { text: 'Clean pours, most of the night.', ev: 'clean', n: 3 },
  { text: 'Poured a drink another player ordered.', ev: 'ticket', n: 1 },
  { text: 'Served right through last call.', ev: 'lastcall', n: 1 },
  { text: 'A bit of flair behind the bar tonight.', ev: 'flair', n: 1 },
  { text: 'The bottles won tonight. Keep practising.', ev: 'drop', n: 1 },
  { text: 'Steady hands behind the bar.', ev: 'fine', n: 1 },
  { text: 'Every bartender starts somewhere.', ev: 'pour', n: 1 },
];
const NIGHT_NAMES = { calm: 'Quiet', rush: 'Rush hour', last: 'Last call', dark: 'Power cut' };
function nt() {
  const host = P.hosted?.c && P.night !== 'dark' ? P.hosted : null;
  if (!host && P.night === 'calm') return null;
  return { c: P.night === 'dark' ? 'powercut' : host?.c ?? 'quiet', next: P.hosted?.next ?? 'quiet', ...(host?.by && { by: host.by }),
    ...((P.night === 'rush' || P.night === 'last') && { pk: 'late' }), ...(P.night === 'rush' && { rush: 1 }), ...(P.night === 'last' && { last: 1 }) };
}
const STAMP_DAYS = [0, B.stamps.bronze, B.stamps.silver, B.stamps.gold];
const BACK_PTS = 2;
const QUAL = [0, 0, 1, 2, 3];

/* ───────── window + station state ───────── */
let side = 'back', winOpen = true;
let bookSub = 'book';
let o = null, done = null, boardOpen = false, msgAt = -1, ticketNo = 41;
let page = 0, parts = [], held = null, m = null, glass = '', ice = 'none', gar = 'none', use = new Set(), busy = 0, msg = '';
let pendingRank = null;
const blankM = () => ({ k: 'build', h: 0, n: 0, first: 0, last: 0, at: null });
m = blankM();

const lineOf = d => [CFG.glasses[d.glass], B.ice[d.ice], B.garnish[d.gar]].filter(Boolean).join(' · ');
const canMake = d => P.known.has(d.id) && (d.method !== 'stir' || P.tech.has('stir')) && (!d.float || P.tech.has('float'))
  && (!(d.method === 'shake' && d.taste?.includes('creamy')) || P.tech.has('hard-shake')) && (!d.lit || P.tech.has('flaming-float'));
const book = () => BACK.filter(d => P.known.has(d.id) || P.rumours.has(d.id)).map(d => ({ d: d.id, known: P.known.has(d.id), can: canMake(d), line: lineOf(d), fam: d.fam, stamp: P.stamps[d.id] || 0 }));
const entry = id => book().find(e => e.d === id);

const bo = () => (o && o !== done && (o.md || isBack(o.d)) ? o : null);
function stampOrder(x) {
  if (x && !x.no) { x.no = ++ticketNo; x.at = new Date().toTimeString().slice(0, 5); }
}
function want(b) {
  const x = bo(), e = x && !x.md && entry(x.d); if (!x || x.md || !e?.known) return null;
  const st = DRINKS[x.d].steps, i = st.findIndex(s => s.b === b);
  return i < 0 ? null : st[i].n * CS(x, i);
}
const poured = b => wS((parts.find(p => p.b === b)?.h ?? 0) + (held?.b === b ? Math.max(0, now() - held.at) : 0));

function clear() { parts = []; liq.clear(); dump = null; held = null; lastB = null; use.clear(); m = blankM(); }
on('order', x => {
  const was = bo();
  o = x || null;
  if (o && bo() !== was && o.t !== was?.t) { clear(); msg = ''; boardOpen = false; }
  emit('back-order', bo() ? { d: bo().d, md: bo().md, who: bo().who } : null);
  render();
});
let lastRailKey = '';
on('tend', () => {
  if (side !== 'back') return;
  const rk = (P.socWorld?.rail || []).filter(t => t.st === 'open' || t.st === 'taken').map(t => `${t.id}:${t.st}:${t.by}`).join('|');
  if (rk !== lastRailKey) { lastRailKey = rk; render(); }
});
on('recipe', ({ id } = {}) => { if (id && DRINKS[id]) showRecipe(DRINKS[id]); });

/* ───────── the client's hands ───────── */
const SWAP = () => B.swap * (P.tech.has('quick-swap') ? .5 : 1);
let lastB = null;
// What the eye sees (the rules above stay the client's): every let-go is one pour, bottle → jigger → glass.
// liq = what is in the glass, layer by layer (glassware.js Liquid: mixing, diffusion, sinking); dump = the jigger tipping in.
const liq = new Liquid();
const swirl = new Swirl(), cubes = new Ice();     // the drink's momentum, and the ice as bodies in the glass
let dump = null;
const DUMP = .5;
function hold(b) {
  if (side !== 'back' || !winOpen) return;
  if (held) let_();
  if (!parts.some(p => p.b === b) && parts.length >= 8) return;
  const swap = lastB && lastB !== b ? SWAP() : 0;
  held = { b, at: now() + swap, swap }; lastB = b; dump = null; sfx('pop'); msg = ''; render();
}
function let_() {
  const e = held; if (!e) return; held = null; pourStop();
  const t = Math.min(20, Math.max(0, now() - e.at)), p = parts.find(x => x.b === e.b);
  const was = p?.h ?? 0;
  if (p) p.h = Math.min(20, p.h + t); else if (t > .05) parts.push({ b: e.b, h: t });
  const add = (parts.find(x => x.b === e.b)?.h ?? 0) - was;
  if (add > 0) {
    const l = liq.pour(e.b, CFG.bottles[e.b]?.col ?? '#fff', wS(add), now(), e.b === 'soda' || e.b === 'tonic');
    dump = { b: e.b, id: l.id, add: wS(add), at: now() }; pourDone(e.b, liq.layers.length - 1);
  }
  render();
}
function stirOn() { if (m.k !== 'stir') m = { ...blankM(), k: 'stir' }; m.at = now(); stirStart(); render(); }
function stirOff() { stirStop(); if (m.k === 'stir' && m.at != null) { m.h = Math.min(30, m.h + now() - m.at); m.at = null; render(); } }
function beat() {
  const e = now(); if (m.k !== 'shake') m = { ...blankM(), k: 'shake', first: e, last: e }; m.n++; m.last = e; m.h = m.n > 1 ? (e - m.first) * m.n / (m.n - 1) : 0;
  liq.agitate(1 / SHAKE.need); liq.foam = Math.min(1, liq.foam + 1 / SHAKE.need);   // each beat runs the layers together a step
  swirl.kick(); cubes.kick();
  sfx('shake'); render();
}
let buildAt = -9;
function build() { m = blankM(); buildAt = now(); sfx('build'); render(); }
function turn(d) { let_(); page = (page + d + PAGES.length) % PAGES.length; render(); }
function step(k, keys) { const cur = { glass, ice, gar }[k], v = keys[(keys.indexOf(cur) + 1) % keys.length]; if (k === 'glass') glass = v; else if (k === 'ice') ice = v; else gar = v; sfx({ glass: 'glass', ice: 'ice', gar: 'garnish' }[k]); render(); }
function pourPayload() {
  const stock = {}; for (const id of use) { const bb = GAME.stock[id]?.bb; if (bb) stock[bb] = id; }
  return { parts: parts.map(p => ({ b: p.b, h: Math.round(p.h * 100) / 100 })), m: { k: m.k, h: Math.round(m.h * 100) / 100, n: m.n }, glass, ice, gar, stock };
}

/* ───────── local judge (the server's job in the game) ───────── */
const setOf = bs => [...new Set(bs)].sort().join();
const madeOf = (bs, k) => BACK.find(d => setOf(d.steps.map(s => s.b)) === setOf(bs) && d.method === k) || BACK.find(d => setOf(d.steps.map(s => s.b)) === setOf(bs));
function judge(x, pay) {
  const bs = pay.parts.map(p => p.b), made = madeOf(bs, pay.m.k);
  if (x.md) {
    const tastes = STORY.moods[x.md] || [];
    if (!made || !P.known.has(made.id) || !made.taste.some(t => tastes.includes(t))) return { q: 'wrong' };
    return { q: 'ok', d: made, ...score(x, made, pay) };
  }
  const d = DRINKS[x.d];
  if (setOf(bs) !== setOf(d.steps.map(s => s.b))) return { q: 'wrong', d: made && made.id !== d.id ? made.id : undefined };
  const sc = score(x, d, pay);
  if (d.ice === 'block' && pay.ice === 'block' && pay.stock.ice && sc.grade < 4) { sc.grade++; sc.lift = true; }
  return { q: 'ok', d, ...sc };
}
function score(x, d, pay) {
  const free = P.tech.has('free-pour') ? TOL.free : 1, fixes = []; let sum = 0;
  d.steps.forEach((s, i) => {
    const got = wS(pay.parts.find(p => p.b === s.b)?.h ?? 0), n = s.n * CS(x, i), e = Math.abs(got - n);
    let v = e <= TOL.full * free ? 1 : e >= TOL.zero ? 0 : 1 - (e - TOL.full * free) / (TOL.zero - TOL.full * free);
    const name = CFG.bottles[s.b]?.name ?? s.b;
    if (s.float && pay.parts.at(-1)?.b !== s.b) { v = 0; fixes.push(`${name} floats: it goes in last`); }
    else if (v < .99) fixes.push(`${name} ${fmt(got)}, it takes ${fmt(n)}`);
    sum += v;
  });
  const measures = sum / d.steps.length;
  let meth = 0;
  if (pay.m.k !== d.method) fixes.push(`a ${d.name} is ${{ build: 'built', stir: 'stirred', shake: 'shaken' }[d.method]}`);
  else if (d.method === 'build') meth = 1;
  else if (d.method === 'stir') {
    const f = P.tech.has('throw') ? STIR.throw : 1, line = STIR.line * CS(x, 9), e = Math.abs(pay.m.h - line);
    meth = e <= STIR.full * f ? 1 : e >= STIR.zero * f ? 0 : 1 - (e - STIR.full * f) / (STIR.zero * f - STIR.full * f);
    if (meth < .99) fixes.push(pay.m.h > line ? 'stirred past the line' : 'not stirred to the line');
  } else {
    const hd = P.tech.has('hard-shake') ? SHAKE.hard : 1, lo = SHAKE.lo / hd, hi = SHAKE.hi * hd, p = pay.m.h > 0 ? pay.m.n / pay.m.h : 0, off = p < lo ? lo - p : p > hi ? p - hi : 0;
    meth = Math.min(1, pay.m.n / SHAKE.need) * clamp(1 - off / SHAKE.zero, 0, 1);
    if (meth < .99) fixes.push(pay.m.n < SHAKE.need ? `shaken ${pay.m.n} times, it wants ${SHAKE.need}` : p > hi ? 'shake beat too fast' : 'shake beat too slow');
  }
  const g = pay.glass === d.glass, i = pay.ice === d.ice, ga = pay.gar === d.gar;
  if (!g) fixes.push(`glass: ${CFG.glasses[d.glass]}`); if (!i) fixes.push(`ice: ${B.ice[d.ice]}`); if (!ga) fixes.push(`garnish: ${B.garnish[d.gar]}`);
  const total = [[measures, W.parts], [meth, W.method], [+g, W.glass], [+i, W.ice], [+ga, W.gar]].reduce((a, [v, w]) => a + v * w, 0);
  return { total, grade: total >= 92 ? 4 : total >= 78 ? 3 : total >= 58 ? 2 : total >= 35 ? 1 : 0, fixes };
}

/* ───────── progression ───────── */
const jarStars = () => P.soc.jarStars;
const setJar = s => { s = clamp(s, 0, JAR_CAP * 1.5); P.soc.jarStars = s; };
const jarMult = () => { const s = jarStars(); return s <= JAR.after ? 1 : Math.max(JAR.floor, .5 ** ((s - JAR.after) / JAR.half)); };
const rowBonus = row => Math.min(ROW.max, Math.floor(row / ROW.step));
const RULES = TRACK.trialRules || {};
const trialDone = () => !P.trial || P.trial.rank !== P.rank + 1 || P.trial.n >= P.trial.of;
function setTrial() { const t = RULES[P.rank + 1]; P.trial = t ? { rank: P.rank + 1, n: 0, of: t.n } : null; }
function trialStep(ev, grade) {
  const t = P.trial, r = t && RULES[t.rank]; if (!r || t.rank !== P.rank + 1 || t.n >= t.of) return false;
  const today = new Date().toDateString();
  if (r.day && t.day !== today) { t.day = today; t.n = 0; }
  const hit = ev.includes(r.ev) && QUAL[grade ?? 0] >= r.q;
  if (hit) t.n++; else if (r.run && ev.includes('pour')) t.n = 0;
  t.n = Math.min(t.n, t.of);
  return t.n >= t.of;
}
function checkRank() {
  const r = rankInfo();
  if (!r.next || P.points < r.hi || !trialDone()) return;
  P.rank++; P.free++;
  const fresh = BACK.filter(d => d.rank === P.rank && !P.known.has(d.id));
  fresh.forEach(d => { P.known.add(d.id); P.rumours.delete(d.id); });
  const heard = BACK.filter(d => d.rank === P.rank + 2 && !P.known.has(d.id) && !P.rumours.has(d.id));
  heard.forEach(d => P.rumours.add(d.id));
  setTrial();
  pendingRank = { title: TRACK.titles[P.rank - 1], rank: P.rank, fresh, heard };
  emit('rank-up', { rank: P.rank });
  showRankUp();
}
function stampStep(id, grade) {
  if (grade < 3) return null;
  const tierOf = () => { const d = P.stampDays[id] || 0; let t = d >= STAMP_DAYS[3] ? 3 : d >= STAMP_DAYS[2] ? 2 : d >= STAMP_DAYS[1] ? 1 : 0; if (t === 3 && (P.stampPerfect[id] || 0) >= B.stamps.neon) t = 4; return t; };
  if (!P.today.has(id)) { P.today.add(id); P.stampDays[id] = (P.stampDays[id] || 0) + 1; }
  if (grade === 4 && (P.stamps[id] || 0) >= 3 && !P.todayPerfect.has(id)) { P.todayPerfect.add(id); P.stampPerfect[id] = (P.stampPerfect[id] || 0) + 1; }
  const t = tierOf();
  if (t > (P.stamps[id] || 0)) { P.stamps[id] = t; if (P.shift.on) P.shift.stamps.push({ id, tier: t }); return t; }
  return null;
}
on('served', d => {
  const s = P.shift; if (!s.on) return;
  const house = !!d.house;
  const g = typeof d.grade === 'number' ? d.grade : d.grade === 'perfect' ? 4 : d.grade === 'spill' || d.grade === 'wrong' ? 0 : d.grade ? 2 : null;
  s.stars += d.pay || 0;
  if (!house) s.poured++;
  const ev = d.ev || ['pour', ...(g === 4 ? ['perfect'] : []), ...(g >= 3 ? ['clean'] : []), ...(g >= 2 ? ['fine'] : []), ...(g === 0 ? ['terrible'] : [])];
  if (g === 4 && !house) s.perfect++;
  for (const k of ev) s.ev[k] = (s.ev[k] || 0) + 1;
  s.best = Math.max(s.best, P.row);
  hud();
});

function serve() {
  let_(); stirOff();
  const x = bo();
  if (!x || !parts.length || busy || side !== 'back') return;
  busy = performance.now();
  const pay = pourPayload(), res = judge(x, pay);
  busy = 0;
  for (const id of Object.values(pay.stock)) if (P.stock[id] > 0) P.stock[id]--;
  if (res.q === 'wrong') {
    msg = x.md ? H('bar.md.wrong', 'That does not fit how they feel. Any drink with the right taste will do.')
      : res.d ? H('bar.back.wrong.made', 'That came out a {made}. Those are not the bottles of a {name}.', { made: DRINKS[res.d]?.name ?? '', name: DRINKS[x.d].name })
        : H('bar.back.wrong', 'Those are not the bottles of a {name}.', { name: DRINKS[x.d].name });
    P.row = 0; trialStep(['pour'], 0); msgAt = now(); sfx('fail');
    clear(); render(); emit('state'); return;
  }
  const s = res, d = res.d;
  P.row = s.grade === 0 ? 0 : P.row + 1;
  const base = Math.round((d.pay || 3) * [0, .5, 1, 1.3, 1.8][s.grade]);
  const bonus = s.grade ? rowBonus(P.row) : 0, rush = P.night === 'rush' && s.grade >= 1 ? 1 : 0;
  const mult = jarMult(), tips = base + bonus + rush, paid = tips ? Math.max(1, Math.round(tips * mult)) : 0;
  setJar(jarStars() + paid);
  P.stars += paid; P.served++; P.points += BACK_PTS;
  const ev = ['pour', ...(s.grade === 4 ? ['perfect'] : []), ...(s.grade >= 1 ? ['clean'] : []), ...(s.grade >= 2 ? ['fine'] : []), ...(s.grade === 0 ? ['terrible'] : []),
    ...(x.kind === 'ticket' ? ['ticket'] : []), ...(P.night === 'last' ? ['lastcall'] : []), ...(P.night === 'rush' && s.grade ? ['rush'] : [])];
  const passed = trialStep(ev, s.grade), tier = stampStep(d.id, s.grade);
  const head = paid ? (s.grade === 4 ? H('bar.pay.perfect', 'Perfect! +{n} ★', { n: paid }) : bonus ? H('bar.pay.rush', 'Rush! +{n} ★', { n: paid }) : H('bar.pay', '+{n} ★', { n: paid })) : H('bar.full', 'Tip jar full');
  msg = [head, x.md ? d.name : '', s.lift ? 'The clear block lifts it.' : '', s.fixes.length ? `Fix: ${s.fixes.slice(0, 2).join('; ')}.` : '', tier ? `${GAME.stamps[tier]} stamp for ${d.name}.` : '', passed ? 'Trial passed.' : ''].filter(Boolean).join(' · ');
  if (mult < 1 && jarStars() > JAR.after * .95) msg += ' ' + H('bar.jar', 'The tip jar is nearly full. It empties again as the evening goes on, and patrons still love a drink.');
  done = x; clear(); msgAt = now();
  emit('stamp', { mk: s.grade, g: QUAL[s.grade] });
  emit('served', { drink: d.id, grade: s.grade, pay: paid, ev, src: 'back', t: x.t, mood: !!x.md });
  emit('back-order', null);
  if (paid) tip(P.row, s.grade === 4); else sfx('fail');
  checkRank(); render(); emit('state');
}

let tryAt = -1e9;
function tryit() {
  let_(); if (!parts.length) return;
  if (now() - tryAt < B.try) return;
  tryAt = now();
  const hit = BACK.find(d => setOf(d.steps.map(s => s.b)) === setOf(parts.map(p => p.b)) && d.method === m.k);
  const found = hit && !P.known.has(hit.id);
  if (found) { P.known.add(hit.id); P.rumours.delete(hit.id); sfx('claim'); }
  msgAt = now();
  msg = found ? H('bar.back.found', 'A discovery! {name} is in your bar book.', { name: hit.name }) : hit ? H('bar.back.known', 'That makes a {name}. You know it already.', { name: hit.name }) : H('bar.back.none', 'Nothing comes of it.');
  clear(); render(); if (found) emit('state');
}
on('say', e => { if (e?.text) { msg = e.text; msgAt = now(); render(); } });
on('reply', e => {
  if (!e) return;
  if (e.stocked) msg = H('bar.back.stocked', 'Into your bag: {what}.', { what: Object.keys(e.stocked).map(id => GAME.stock[id]?.name ?? DRINKS[id]?.name ?? id).join(', ') });
  if (e.named) { msg = H('bar.sig.named', '{name} is yours. It is on the specials board while you are on shift.', { name: e.named }); sfx('claim'); }
  if (e.hint) msg = e.hint;
  if (e.error) { msg = e.error; busy = 0; }
  msgAt = now();
  render();
});

/* ───────── punch clock ───────── */
function clockIn() { P.shift = { on: true, since: Date.now(), poured: 0, perfect: 0, praise: [], stars: 0, best: 0, rank0: P.rank, ev: {}, stamps: [], tricks: [] }; hud(); emit('state'); }
const TRICK = { toss: 'Toss and catch', spin: 'Spin', behind: 'Behind the back', roll: 'Tin roll', stack: 'Stack', split: 'Split pour', duo: 'Duo', flame: 'Flame', blue: 'Flaming float', line: 'Fire line' };
const landed = new WeakSet();
on('tend', T => {
  if (!P.shift.on || !T) return;
  for (const x of [T.o, T.back]) if (x?.fl && !landed.has(x)) { landed.add(x); (P.shift.tricks ??= []).push(x.fl); P.shift.ev.flair = (P.shift.ev.flair || 0) + 1; }
});
function punchOut() {
  const s = P.shift; if (!s.on) return;
  s.on = false;
  s.praise = PRAISE.filter(p => (s.ev[p.ev] || 0) >= p.n && !(p.without && s.ev[p.without])).slice(0, 2).map(p => p.text);
  showShiftCard(s); hud(); emit('state');
}
const clockText = () => { const mins = Math.floor((Date.now() - P.shift.since) / 60000); return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}`; };

/* ───────── lazily loaded modules: book.js and social.js ───────── */
const LOADERS = { book: () => import('./book.js'), social: () => import('./social.js') };
const mods = {};
let socMod = null, bookMod = null;
async function mod(name) {
  if (!(name in mods)) mods[name] = LOADERS[name]().catch(e => { console.error(`[bar] ${name}.js failed to load:`, e); return null; });
  const m = await mods[name];
  if (name === 'social') socMod = m;
  if (name === 'book') bookMod = m;
  return m;
}
const quiet = (root, text) => root.replaceChildren(h('p', { class: 'quietph' }, text));
async function mountInto(root, modName, fn, args, fallback) {
  const mo = await mod(modName);
  if (typeof mo?.[fn] === 'function') { try { root.replaceChildren(); mo[fn](root, ...args); return true; } catch (e) { console.warn(`[bar] ${fn} failed:`, e); } }
  if (fallback != null) quiet(root, fallback); else root.replaceChildren();
  return false;
}

const houseRoot = $('#houseRoot'), backRoot = $('#backRoot'), bookRoot = $('#bookRoot'), perksRoot = $('#perksRoot');
// Persistent slots for the House card's live rows on the Back bar so their rAF loops stay smooth across re-renders
const pourOffSlot = h('div', { class: 'ticket-slot' });
const talkSlot = h('div', { class: 'ticket-slot' });
const stampSlot = h('div', { class: 'ticket-slot' });
const flairSlot = h('div', { class: 'counter-flair' });

Promise.all([mod('social'), mod('book')]).then(([soc]) => {
  if (!soc) { houseRoot.append(h('p', { class: 'quietph' }, H('bar.first', 'Waiting for the first patron…'))); return; }
  soc.mountHouseCard(houseRoot);
  soc.mountPourOffRow(pourOffSlot);
  soc.mountTalk(talkSlot);
  soc.mountStamp(stampSlot);
  soc.mountFlairRow(flairSlot);
  emit('side', side); emit('card', cardOn()); render();
});

/* ───────── Top-Level Tabs & Rendering ───────── */
const TOP_TABS = [
  ['house', () => H('bar.side.house', 'House card')],
  ['back', () => H('bar.side.back', 'Back bar')],
  ['book', () => H('bar.back.book', 'Bar book')],
  ['perks', () => 'Perks & Prep'],
];

let lastPaneKey = '';
function render() {
  const bar = $('.bar'); bar.hidden = !winOpen; $('#reopen').hidden = winOpen;
  bar.dataset.night = P.night; bar.dataset.side = side;
  hud();
  if (!winOpen) return;

  const n = P.served, r = P.row, cnt = $('#count');
  cnt.textContent = (n ? H('bar.served', '{n} served', { n }) : '') + (r ? (n ? ' · ' : '') + H('bar.row', '{n} in a row', { n: r }) : '');
  cnt.title = r && rowBonus(r + 1) > 0 ? H('bar.row.bonus', 'The next one pays a little extra') : '';
  const cb = $('#cardBtn'); cb.hidden = side !== 'house'; cb.classList.toggle('on', cardOn()); cb.setAttribute('aria-pressed', String(cardOn()));

  // Tonight strip
  const e = nt(), board = $('#board');
  board.hidden = !e;
  // one line on every tab (the window never changes height); a click opens the full board over the station
  board.classList.add('compact');
  board.classList.toggle('open', !!e && boardOpen);
  board.onclick = ev => { if (ev.target.closest('.nb-pop') && !ev.target.closest('.nb-x')) return; boardOpen = !boardOpen; render(); };
  if (e) {
    const pk = [e.rush ? H('bar.nt.rush', 'Rush hour: the sweet spot will not keep still.') : '', e.last ? H('bar.nt.last', 'Last call!') : ''].filter(Boolean).join(' ');
    const peak = [e.pk ? H(`bar.nt.pk.${e.pk}`, '') : '', pk].filter(Boolean).join(' ');
    board.replaceChildren(h('b', {}, H('bar.nt.board', 'Tonight at Cyberia')), h('span', {}, NR(e.c, e.v).split(':')[0]), ...(pk ? [h('span', { class: 'peak' }, pk)] : []),
      h('i', { class: 'nb-more', 'aria-hidden': 'true' }, boardOpen ? '▴' : '▾'),
      boardOpen ? h('div', { class: 'nb-pop', role: 'dialog', 'aria-label': 'Tonight' },
        h('p', {}, [NR(e.c, e.v), e.by ? H('bar.nt.by', 'Hosted by {who}.', { who: e.by }) : ''].filter(Boolean).join(' ')),
        h('small', {}, `${H('bar.nt.next', 'Tomorrow')}: ${NR(e.next, e.nv)}`),
        ...(peak ? [h('p', { class: 'peak' }, peak)] : []),
        h('button', { type: 'button', class: 'nb-x', 'aria-label': 'Close' }, '×')) : '');
  }

  // Top-level navigation tabs (built once, updated in-place so pointerup/render never swallows a click)
  const readyPrep = (P.prep || []).filter(j => !(j.left > 0)).length;
  const sidesEl = $('#sides');
  if (!sidesEl.childElementCount) {
    sidesEl.replaceChildren(...TOP_TABS.map(([k, lbl]) =>
      h('button', { type: 'button', 'data-side': k, onclick: () => flip(k) }, h('span', { class: 'lbl' }, lbl()), h('span', { class: 'bdg', hidden: true }))));
  }
  for (const btn of sidesEl.children) {
    const k = btn.dataset.side;
    btn.classList.toggle('on', side === k);
    btn.setAttribute('aria-pressed', String(side === k));
    const bdg = btn.querySelector('.bdg');
    if (k === 'perks' && P.free > 0) { bdg.className = 'bdg dot'; bdg.textContent = P.free; bdg.title = `${P.free} technique point to spend`; bdg.hidden = false; }
    else if (k === 'perks' && readyPrep > 0) { bdg.className = 'bdg dot cyan'; bdg.textContent = readyPrep; bdg.title = `${readyPrep} prep ready to take`; bdg.hidden = false; }
    else if (bdg) { bdg.hidden = true; bdg.textContent = ''; }
  }

  houseRoot.hidden = side !== 'house';
  backRoot.hidden = side !== 'back';
  bookRoot.hidden = side !== 'book';
  perksRoot.hidden = side !== 'perks';

  if (side === 'back') {
    backRoot.replaceChildren(station());
  } else if (side === 'book') {
    renderBookTab();
  } else if (side === 'perks') {
    renderPerksTab();
  }
  paint();
}

function flip(k) {
  if (side === k) return;
  let_(); stirOff(); side = k; lastPaneKey = ''; sfx('click'); emit('side', k);
  render();
}

/* ───────── Dedicated Tab 3: Bar book (Recipes · Regulars · Signatures · Tonight · Club Bar Book) ───────── */
const BOOK_SUBS = [
  ['book', 'Recipes', 'assets/trinket-recipe-card.png'],
  ['regs', 'Regulars', 'assets/trinket-rack-key.png'],
  ['sig', 'Signatures', 'assets/drink-ping-fizz.png'],
  ['night', 'Tonight', 'assets/props-fair-board-night.webp'],
  ['boards', 'Leaderboards', 'assets/trinket-ribbon-darts.png'],
  ['drinks', 'Drinks tasted', 'assets/club-cocktail.png'],
  ['shelf', 'Smoke shelf', 'assets/drink-bottle-aged.png'],
  ['crew', 'Crew', 'assets/trinket-courier-tag.png'],
  ['year', 'Four Seasons', 'assets/crop-wild-strawberry.png'],
];
function renderBookTab() {
  const key = `book:${bookSub}:${!!bookMod}`;
  if (lastPaneKey === key && bookRoot.childElementCount) return;
  lastPaneKey = key;
  const body = h('div', { class: 'pane-body' });
  const nav = h('div', { class: 'pane-subnav', role: 'tablist' }, ...BOOK_SUBS.map(([k, label, ic]) =>
    h('button', { type: 'button', role: 'tab', class: bookSub === k ? 'on' : '', 'aria-selected': bookSub === k, onclick: () => { bookSub = k; lastPaneKey = ''; sfx('click'); renderBookTab(); } },
      ic ? img(ic, '', 'px') : null, label)));
  bookRoot.replaceChildren(nav, body);
  if (['book', 'regs', 'sig', 'night'].includes(bookSub)) {
    mountInto(body, 'book', 'renderPanel', [bookSub], H('bar.back.empty', 'The book is still loading.'));
  } else {
    mountInto(body, 'book', 'openBarbook', [bookSub], 'The bar book is not on the counter yet.');
  }
}

/* ───────── Dedicated Tab 4: Perks & Prep (8-branch visual skill tree + 4 Prep Stations) ───────── */
function renderPerksTab() {
  const key = `perks:${!!bookMod}`;
  if (lastPaneKey === key && perksRoot.childElementCount) return;
  lastPaneKey = key;
  const techSec = h('section', { class: 'perks-sec' });
  const prepSec = h('section', { class: 'perks-sec prep-sec' });
  perksRoot.replaceChildren(techSec, prepSec);
  mountInto(techSec, 'book', 'renderPanel', ['tech'], 'Loading techniques…');
  mountInto(prepSec, 'book', 'renderPanel', ['prep'], 'Loading prep stations…');
}


/* ───────── Back bar station ───────── */
function railWidget() {
  const list = (P.socWorld?.rail || []).filter(t => t.st === 'open' || t.st === 'taken');
  const slips = list.map(t => {
    const mine = t.st === 'taken' && t.by === 'you';
    const d = DRINKS[t.d];
    return h('button', {
      type: 'button',
      class: `slip${mine ? ' mine' : t.st === 'taken' ? ' taken' : ''}`,
      disabled: (t.st === 'taken' && !mine) || null,
      title: `${t.who || 'A cat'}: ${d?.name ?? t.d} (${mine ? 'Click to release' : t.st === 'open' ? 'Click to take ticket' : `Taken by ${t.by}`})`,
      onclick: () => { sfx('click'); socMod?.toggleTicket(t); render(); },
    },
    img(ART.drink(t.d), ''),
    h('small', {}, t.who || 'A cat'),
    h('span', { class: 'st' }, mine ? 'Yours' : t.st === 'open' ? 'Take' : t.by || 'Taken'));
  });
  return h('div', { class: 'rail', 'aria-label': 'Ticket rail' },
    h('span', { class: 'rbar', 'aria-hidden': 'true' }),
    h('div', { class: 'slips' }, slips.length ? slips : h('small', { class: 'empty' }, P.night === 'last' ? 'Last call — nobody new tonight' : 'No player tickets waiting')));
}

function ledgeWidget() {
  const fill = clamp(jarStars() / JAR_CAP, 0, 1), full = jarStars() > JAR.after, near = !full && jarStars() > JAR.after * .85;
  const tally = Math.min(P.row, 15);
  const bonusNext = rowBonus(P.row + 1) > 0;
  return h('div', { class: 'ledge', 'aria-label': 'Your evening' },
    h('button', { type: 'button', class: `jar${full ? ' full' : ''}`, onclick: showJar, title: full ? 'Tip jar full' : 'Tip jar' },
      h('span', { class: 'jglass' }, h('i', { style: `height:${fill * 100}%` }), h('span', { class: 'jlid' })),
      h('span', { class: 'lab' }, h('b', {}, full ? 'Tip jar full' : 'Tip jar'), h('small', {}, full ? 'tips pay less' : near ? 'nearly full' : `${Math.round(fill * 100)}%`))),
    h('div', { class: 'tally', title: 'Drinks in a row without a spill or a wrong mix' },
      h('span', { class: 'marks', 'aria-hidden': 'true' }, Array.from({ length: Math.ceil(tally / 5) }, (_, g) => h('span', { class: 'grp' }, Array.from({ length: Math.min(5, tally - g * 5) }, () => h('i'))))),
      h('span', { class: 'lab' }, h('b', {}, P.row ? `${P.row} in a row` : 'No row yet'), h('small', {}, bonusNext && P.row ? 'The next one pays a little extra' : 'without a spill'))),
    h('div', { class: 'stars' }, h('b', {}, `★ ${P.shift.on ? P.shift.stars : P.stars}`), h('small', {}, P.shift.on ? 'this shift' : 'tonight')));
}

function paperTicket(x, d, e, rec) {
  if (x?.md) {
    stampOrder(x);
    const faceEl = socMod?.moodFace ? socMod.moodFace(x.md, 2) : null;
    return h('div', { class: 'ticket', role: 'region', 'aria-label': 'Order ticket' },
      h('span', { class: 'pin' }),
      h('div', { class: 'r-head' }, h('span', {}, 'REGULAR · MOOD'), h('span', {}, P.night === 'rush' ? 'RUSH' : x.at)),
      h('p', { class: 't-who' }, faceEl, `for ${x.who || 'a regular'}`),
      h('div', { class: 't-wait', id: 'wait' }, h('i')),
      h('p', { class: 'order md' }, `“${H(`bar.md.${x.md}`, '')}”`),
      h('small', { class: 'line' }, H('bar.md.back', 'Any drink you know that tastes right will do.')),
      h('div', { class: 't-row' },
        h('button', { type: 'button', class: 'recipe-btn', onclick: () => flip('book') }, 'Bar book', h('kbd', {}, 'B'))));
  }
  if (x && d) {
    stampOrder(x);
    const st = P.stamps[d.id] || 0;
    const headLeft = x.kind === 'ticket' ? 'PLAYER TICKET' : `ORDER #${String(x.no).padStart(3, '0')}`;
    const whoText = x.kind === 'ticket' ? `ticket from ${x.who} · ★${d.pay || 3} paid` : `for ${x.who || 'a patron'}`;
    const t = h('div', { class: 'ticket', role: 'region', 'aria-label': 'Order ticket' },
      h('span', { class: 'pin' }),
      h('div', { class: 'r-head' }, h('span', {}, headLeft), h('span', {}, P.night === 'rush' ? 'RUSH' : x.at)),
      h('span', { class: 't-want' }, H('bar.back.wants', 'Wanted: ')),
      h('p', { class: 't-name' }, img(ART.drink(d.id), ''), h('span', {}, d.name)),
      h('p', { class: 't-who' }, whoText),
      h('div', { class: 't-wait', id: 'wait' }, h('i')),
      h('small', { class: 'line' }, e?.line ?? lineOf(d)));
    if (rec) {
      t.append(
        h('div', { class: 'steps', id: 'steps' }, rec.steps.map(s => h('span', { class: 'step', 'data-b': s.b, style: `--c:${CFG.bottles[s.b]?.col ?? '#fff'}` },
          h('small', {}, CFG.bottles[s.b]?.name ?? s.b),
          Array.from({ length: KQ(s.n) }, () => h('i'))))),
        h('div', { class: 't-row' },
          h('button', { type: 'button', class: 'recipe-btn', onclick: () => showRecipe(d) }, 'Recipe', h('kbd', {}, 'V')),
          st ? h('span', { class: `mstamp s${st}`, title: `${GAME.stamps[st]} stamp · ${P.stampDays[d.id] || 0} days Clean or better` }, GAME.stamps[st]) : null));
    } else {
      t.append(
        h('p', { class: 't-unknown' }, H('bar.back.unknown', 'Not in your book yet.')),
        ...(d.taste?.length ? [h('p', { class: 't-foot' }, `“Something ${d.taste.join(', ')}.”`)] : []));
    }
    return t;
  }
  // Blank / waiting paper ticket with 1:1 why-no-order states
  const w = o ? 'wait' : DS(B.on, book(), id => LS(nt(), DRINKS[id]));
  const blank = h('div', { class: 'ticket blank', role: 'region', 'aria-label': 'Order ticket' },
    h('span', { class: 'pin' }),
    h('div', { class: 'r-head' }, h('span', {}, 'CYBERIA · BACK BAR'), h('span', {}, NIGHT_NAMES[P.night] || 'Quiet')),
    h('p', { class: 't-unknown' }, w === 'wait' ? H('bar.back.wait', 'Waiting for an order from the back bar…') : 'No back-bar order right now'));
  if (w !== 'wait') {
    const why = h('div', { class: 'why' }, h('p', {}, {
      off: H('bar.how.off', 'The back bar is not taking orders yet. The House card is open as usual.'),
      learn: H('bar.how.learn', 'You do not know a back-bar drink yet. Pour from the House card to raise your bartending rank, and your first mixes come with the next one.'),
      dark: H('bar.how.dark', 'The power is out tonight, so the back bar only takes stirred drinks and you know none yet. The House card is open as usual.'),
      cannot: H('bar.how.cannot', 'None of the drinks you know can be made yet. Techniques shows what they need.'),
    }[w]));
    if (w === 'learn') why.append(h('div', { class: 'rank' }, h('small', {}, H('bar.how.rank', 'Next rank')), h('span', {}, h('i', { style: `width:${Math.round(rankInfo().pct * 100)}%` }))));
    blank.append(why);
  }
  if (w !== 'off') blank.append(h('small', { class: 'line' }, H('bar.back.shelf', 'Line up bottles and a method, then Try to experiment.')));
  return blank;
}

function station() {
  const x = bo(), d = x && !x.md ? DRINKS[x.d] : null, e = d ? entry(d.id) : null, rec = e?.known ? d : null;

  // LEFT COLUMN: hanging ticket rail · pour-off slot · paper order ticket · regular talk & 5-drop stamp · evening ledge
  const left = h('aside', { class: 'ticketcol' },
    railWidget(),
    pourOffSlot,
    paperTicket(x, d, e, rec),
    h('div', { class: 'ticket-feed' }, talkSlot, stampSlot),
    ledgeWidget());

  // RIGHT COLUMN: 2-plank physical wooden bottle shelf → counter (BAR neon · Jigger · Glass · Methods · Flair) → 3 aligned trays + stock
  const shelf = h('div', { class: 'shelf', role: 'group', 'aria-label': 'Back shelf' },
    PAGES.map((row, r) => h('div', { class: `plank${r === page ? ' on' : ''}`, onclick: e2 => { if (e2.target.classList.contains('plank')) { page = r; render(); } } },
      row.map((b, i) => {
        const c = CFG.bottles[b];
        const own = Object.entries(P.stock).find(([id, n]) => n > 0 && GAME.stock[id]?.bb === b);
        const kb = r === page ? String(i + 1) : r === (page + 1) % PAGES.length ? `⇧${i + 1}` : '';
        const isWant = !!rec?.steps.some(s => s.b === b);
        const el = h('button', {
          type: 'button',
          'data-b': b,
          style: `--c:${c.col}`,
          title: own ? `${c.name} · your ${GAME.stock[own[0]].name} (×${own[1]})` : `${c.name}${kb ? ` (${kb})` : ''}`,
          class: `btl${held?.b === b ? ' held' : ''}${parts.some(p => p.b === b) ? ' in' : ''}${isWant ? ' want' : ''}`,
        },
        h('span', { class: 'btop' },
          kb ? h('kbd', {}, kb) : null,
          own ? h('span', { class: 'own' }, `×${own[1]}`) : null,
          img(ART.bottle(b), c.name)),
        h('small', { class: 'blbl' }, isWant ? h('i', { class: 'wdot' }) : null, c.name));
        el.onpointerdown = ev => { ev.preventDefault(); page = r; hold(b); };
        el.oncontextmenu = ev => ev.preventDefault();
        return el;
      }))));

  const jig = h('div', { class: 'jigger', id: 'jig' },
    h('div', { class: 'jwrap' },
      h('div', { class: 'jsvw', id: 'jsv' }, h('div', { class: 'jsv-v' }), h('div', { class: 'gw-layer' }))),
    h('span', { class: 'jmeta', id: 'jmeta' }, h('i', { class: 'jdot' }), h('b', { class: 'jname', id: 'jname' }, 'Jigger'), h('b', { class: 'jread', id: 'jread' }, '')));

  const gl = h('div', { class: `gl${now() - buildAt < .3 ? ' built' : ''}`, id: 'gl', 'data-g': glass || 'tin' }, h('div', { class: 'gw-glass' }), h('div', { class: 'gw-tool' }), h('div', { class: 'gw-layer' }));
  // the shaker on the counter: tap it (or D) to shake; it rattles on every beat and frosts once shaken
  const shkBtn = h('button', { type: 'button', class: 'shk', title: 'Shaker · tap to shake (D)', 'aria-label': 'Shake' });
  shkBtn.innerHTML = shakerSVG(m.k === 'shake' && m.n > 0);
  shkBtn.onpointerdown = ev => { ev.preventDefault(); beat(); }; shkBtn.oncontextmenu = ev => ev.preventDefault();
  const shk = h('div', { class: `shkstage${m.k === 'shake' && now() - m.last < .25 ? ' go' : ''}` }, h('div', { class: 'shkwrap' }, shkBtn), h('span', { class: 'gname' }, m.k === 'shake' && m.n ? `Shaker · ${m.n}` : 'Shaker'));
  glKey = ''; drawGlass(gl, now());
  const gSummary = glass ? [CFG.glasses[glass], ice !== 'none' ? B.ice[ice] : '', gar !== 'none' ? B.garnish[gar] : ''].filter(Boolean).join(' · ')
    : (parts.length ? 'Mixing tin · pick a glass' : H('bar.back.hold', 'Hold a bottle to pour'));
  const gstage = h('div', { class: 'glassstage' },
    h('div', { class: 'glasswrap', id: 'gwrap' }, gl),
    h('span', { class: 'gname' }, gSummary));

  const mb = (k, label, kb) => {
    const isWantM = rec && rec.method === k;
    const b = h('button', { type: 'button', class: `mbtn${m.k === k ? ' on' : ''}${isWantM ? ' want' : ''}${k === 'shake' && m.k === 'shake' && now() - m.last < .15 ? ' jolt' : ''}`, 'data-m': k, 'aria-pressed': m.k === k },
      h('span', { class: 'mi', 'data-i': k }, k === 'shake' ? img(ART.shaker(m.k === 'shake' ? m.n % 3 : 0), '') : null),
      h('span', {}, label, kb ? h('kbd', {}, kb) : null));
    if (k === 'build') b.onclick = build;
    else if (k === 'stir') { b.onpointerdown = ev => { ev.preventDefault(); stirOn(); }; b.onpointerup = b.onpointerleave = stirOff; }
    else b.onpointerdown = ev => { ev.preventDefault(); beat(); };
    b.oncontextmenu = ev => ev.preventDefault();
    return b;
  };
  const method = h('div', { class: 'method' },
    h('div', { class: 'mrow' }, mb('build', H('bar.back.build', 'Build')), mb('stir', H('bar.back.stir', 'Hold to stir'), 'S'), mb('shake', H('bar.back.shake', 'Tap to shake'), 'D')),
    h('div', { class: 'chill', id: 'chill', hidden: m.k !== 'stir' }, h('i', { id: 'chillfill' }), h('b', { style: `left:${Math.min(100, CS(x, 9) / 1.5 * 100)}%` })));

  const counter = h('div', { class: 'counter' },
    h('span', { class: 'neonbar', 'aria-hidden': 'true' }, img('assets/club-barneon.png', '')),
    h('div', { class: 'stage' }, jig, gstage, shk),
    method,
    flairSlot);

  // 3 Labeled Trays: GLASSES [G] (3×2) · ICE [I] (2×2) · GARNISH [R] (4×2)
  const tray = (k, title, opts, art, kb) => h('div', { class: `tray tray-${k}`, role: 'group', 'aria-label': title },
    h('h3', {}, title, h('kbd', {}, kb)),
    h('div', { class: 'opts' }, Object.entries(opts).map(([v, label]) => {
      const sel = ({ glass, ice, gar })[k] === v;
      const wantOpt = rec && ({ glass: rec.glass, ice: rec.ice, gar: rec.gar })[k] === v;
      return h('button', {
        type: 'button',
        title: label,
        class: `opt${sel ? ' on' : ''}${wantOpt ? ' want' : ''}`,
        'aria-pressed': sel,
        onclick: () => { if (k === 'glass') glass = v; else if (k === 'ice') ice = v; else gar = v; sfx({ glass: 'glass', ice: 'ice', gar: 'garnish' }[k]); render(); },
      },
      h('span', { class: 'oico' }, v === 'none' ? h('span', { class: `none-ico ${k}-none` }) : img(art(v), label)),
      h('span', { class: 'olbl' }, label));
    })));
  const trays = h('div', { class: 'trays' },
    tray('glass', 'Glasses', CFG.glasses, ART.glass, 'G'),
    tray('ice', 'Ice', B.ice, ART.ice, 'I'),
    tray('gar', 'Garnish', B.garnish, ART.gar, 'R'));

  // Bag stock row (prepped syrups, steeps, clear ice, aged spirits)
  const own = Object.keys(P.stock).filter(id => P.stock[id] > 0).filter(id => { const bb = GAME.stock[id]?.bb; return bb && (bb === 'ice' ? ice === 'block' : parts.some(p => p.b === bb)); });
  for (const id of [...use]) if (!own.includes(id)) use.delete(id);
  const cof = d ? vS(d) : [];
  for (const p of parts) if ((hS(p.b) || cof.includes(p.b)) && ![...use].some(id => GAME.stock[id]?.bb === p.b)) { const id = own.find(y => GAME.stock[y]?.bb === p.b); if (id) use.add(id); }
  const stock = h('div', { class: 'stock', hidden: !own.length },
    h('span', { class: 'stock-lbl' }, 'Use stock:'),
    ...own.map(id => h('button', { type: 'button', class: use.has(id) ? 'on' : '', 'aria-pressed': use.has(id), onclick: () => { use.has(id) ? use.delete(id) : use.add(id); render(); } },
      img(`assets/${id.replace(':', '-')}.png`, '', 'px sicon'),
      h('small', {}, `${GAME.stock[id].name} (×${P.stock[id]})`))));

  const right = h('section', { class: 'back' }, shelf, counter, h('div', { class: 'traywrap' }, trays, stock));

  const foot = h('footer', { class: 'bottom' },
    h('button', { type: 'button', class: 'small', onclick: () => { clear(); render(); } }, H('bar.clear', 'Clear'), h('kbd', {}, '⌫')),
    h('button', { type: 'button', class: 'small', onclick: tryit, disabled: !parts.length || null, title: 'Experiment at the shelf to discover recipes' }, H('bar.back.try', 'Try'), h('kbd', {}, 'T')),
    h('p', { class: `says${now() - msgAt < .6 ? ' fresh' : ''}`, 'aria-live': 'polite' }, msg),
    h('span', { class: 'sp' }),
    h('button', { type: 'button', class: 'serve', disabled: !x || !parts.length || !!busy || null, onclick: serve }, H('bar.back.serve', 'Serve'), h('kbd', {}, '↵')));

  return h('div', { class: 'stationwrap' }, h('div', { class: 'scene' }, left, right), foot);
}

/* ───────── Header HUD: Rank · XP · Trial, Punch Clock ───────── */
function hud() {
  const r = rankInfo(), top = !r.next, full = !top && P.points >= r.hi;
  $('#rank').replaceChildren(
    h('span', { class: 'b-rank' }, h('small', {}, 'Rank'), h('b', {}, P.rank)),
    h('span', { class: 'b-main' }, h('span', { class: 'b-title' }, r.title),
      h('span', { class: 'xp' }, h('i', { style: `width:${(top ? 1 : r.pct) * 100}%` })),
      h('small', { class: 'b-next' }, top ? 'The top of this craft.' : full && !trialDone() ? `Trial · ${P.trial.n}/${P.trial.of}` : `${P.points - r.lo} / ${r.hi - r.lo} · ${r.next}`)));
  $('#clock').classList.toggle('on', P.shift.on);
  $('#clock').replaceChildren(h('span', { class: `cface${P.shift.on ? ' on' : ''}`, 'aria-hidden': 'true' }),
    h('span', { class: 'clbl' }, h('b', {}, P.shift.on ? `On shift · ${clockText()}` : H('shift.chip', 'Clock in')), h('small', {}, P.shift.on ? H('shift.out', 'Punch out') : H('shift.title', 'Punch clock'))));
}

/* ───────── Live Ticks: Jigger, Ticket Dots, Patience Bar, Stir Chill, Bottle Swap & Pour Stream ───────── */
let lastTick = now();
function paint() {
  const t = now(), dt = t - lastTick; lastTick = t;
  if (dt > 0 && dt < 5) setJar(jarStars() * .5 ** (dt / (JAR.drain * 3600)));
  if (!winOpen || side !== 'back') return;

  const x = bo();
  const waitEl = $('#wait');
  if (waitEl && x) {
    const waitTotal = x.kind === 'ticket' ? 180 : CLUB.wait;
    const left = 1 - (t - (x.t || t)) / waitTotal;
    waitEl.firstChild.style.width = `${clamp(left * 100, 0, 100)}%`;
    waitEl.classList.toggle('low', left < .25);
  }

  const jig = $('#jig');
  if (jig) {
    const b = held?.b ?? lastB ?? parts.at(-1)?.b;     // the bottle this measure belongs to: in the paw, else the one just poured
    const swapping = !!held && t < held.at;
    const secs = ((b ? parts.find(p => p.b === b) : null)?.h ?? 0) + (held && !swapping ? Math.max(0, t - held.at) : 0);
    const n = b ? want(b) : null, r = Math.max(3, (n ?? 0) * 1.6);
    const f = wS(secs);
    jig.classList.toggle('idle', !b);
    jig.style.setProperty('--c', b ? CFG.bottles[b]?.col ?? '#fff' : 'transparent');
    // label: the bottle and its measure so far (the client's reading); it slides when the bottle changes
    const jn = $('#jname'), jr = $('#jread'), jm = $('#jmeta');
    if (jn && jn._b !== b) { jn._b = b; jn.textContent = b ? CFG.bottles[b]?.name ?? b : 'Jigger'; jm.classList.remove('fresh'); void jm.offsetWidth; jm.classList.add('fresh'); }
    if (jr) jr.textContent = b ? fmt(f) : '';
    const dots = b && n != null && x && !x.md ? KQ(DRINKS[x.d].steps.find(s => s.b === b).n) : 0;
    // the vessel: fills while the bottle pours into it, holds this bottle's earlier measure when picked up again,
    // and tips into the glass on let-go (empty after that; the label keeps the reading)
    const dp = dump ? clamp((t - dump.at) / DUMP, 0, 1) : 1;
    const base = held ? wS(parts.find(p => p.b === held.b)?.h ?? 0) : 0;      // this bottle's earlier pours (already in the glass)
    const level = held ? f : dump && dp < 1 ? wS(dump.add) * (1 - dp) : 0;
    jig.classList.toggle('dump', !!dump && dp < 1);
    const jsv = $('#jsv');
    if (jsv) {
      const v = jsv.querySelector('.jsv-v'), over = jsv.querySelector('.gw-layer');
      if (!v.firstChild) v.innerHTML = jiggerSVG();
      const fillK = b ? Math.min(1, level / r) : 0;
      setJigger(v.firstChild, { fill: fillK, base: b ? Math.min(1, base / r) : 0, want: n == null ? null : Math.min(1, n / r), tick: dots ? n / dots / r : 0, c: b ? CFG.bottles[b]?.col ?? '#fff' : 'transparent' });
      const pouring = !!held && !swapping, pk = pouring ? held.b : '';
      if (over._k !== pk) { over._k = pk; over.innerHTML = pouring ? pourSVG('jig', { src: ART.bottle(held.b), c: CFG.bottles[held.b]?.col ?? '#fff', fill: fillK }) : ''; }
      if (pouring) { setPourLevel(over, 'jig', fillK); pourStart(fillK, held.b); pourLevel(fillK); } else pourStop();
    }
    jig.title = n == null ? 'Jigger (graduated in parts)' : H('bar.back.line', 'Let go at the line');
    const tol = TOL.full * (P.tech.has('free-pour') ? TOL.free : 1);
    const at = n != null && Math.abs(f - n) <= tol;
    if (at && !jig.classList.contains('at') && held && !swapping) sfx('mark');   // the pour just reached the line
    jig.classList.toggle('at', at);
    jig.classList.toggle('past', n != null && f - n > tol);
  }

  for (const el of document.querySelectorAll('#steps .step')) {
    const b = el.dataset.b, n = want(b); if (n == null) continue;
    const pips = [...el.querySelectorAll('i')], on = Math.floor(poured(b) / (n / pips.length) + .25);
    pips.forEach((p, i) => p.classList.toggle('on', i < on)); el.classList.toggle('over', on > pips.length);
  }

  const cf = $('#chillfill'); if (cf) { const s = m.k === 'stir' ? m.h + (m.at == null ? 0 : t - m.at) : 0; cf.style.width = `${TS(s) / 1.5 * 100}%`; }
  const sb = backRoot.querySelector('.mbtn[data-m="shake"]'); if (sb) sb.style.setProperty('--beat', `${Math.min(1, m.k === 'shake' ? m.n / SHAKE.need : 0) * 100}%`);
  backRoot.querySelector('.mbtn[data-m="stir"]')?.classList.toggle('busy', m.k === 'stir' && m.at != null);

  const swapping = !!held && t < held.at;
  for (const el of backRoot.querySelectorAll('.btl')) {
    el.classList.toggle('held', held?.b === el.dataset.b);
    el.classList.toggle('swap', swapping && held.b === el.dataset.b);
    if (swapping && held.b === el.dataset.b) el.style.setProperty('--sw', `${clamp(1 - (held.at - t) / held.swap, 0, 1) * 100}%`);
  }
  const gl = $('#gl'); if (gl) drawGlass(gl, t);
}
// The glass on the counter, live: what is poured so far plus the bottle in the paw, the bottle tilted over the rim while it pours.
const GLASS_CAP = 4.5;                                   // parts that fill a glass to the brim (recipes are 2–4 parts)
let glKey = '';
let lastDraw = 0, lastClink = 0;
const S_RIM = { high: 28, rocks: 38, coupe: 48, nick: 34, house: 34 };   // rim half-widths (glassware.js), for the slosh tilt
function drawGlass(el, t) {
  const dt = Math.min(.1, Math.max(0, t - lastDraw)); lastDraw = t;
  const kind = glass || 'tin';
  const tool = el.querySelector('.gw-tool');
  const stirring = m.k === 'stir' && m.at != null;
  if (tool._on !== stirring) {                                       // the spoon goes in, and lifts out on let-go
    tool._on = stirring; el.classList.toggle('stirring', stirring); clearTimeout(tool._out);
    if (stirring) { tool.classList.remove('out'); tool.innerHTML = spoonSVG(); }
    else { tool.classList.add('out'); tool._out = setTimeout(() => { if (!tool._on) { tool.innerHTML = ''; tool.classList.remove('out'); } }, 260); }
  }
  // the drink keeps its momentum: it spins up under the spoon and coasts on after let-go, mixing as long as it turns
  const moving = swirl.step(dt, stirring);
  if (swirl.w) liq.agitate(dt / 1.6 * swirl.w);
  const sp = swirl.spoon(), turn = tool.querySelector('.sp-turn');
  if (turn && stirring) turn.setAttribute('transform', `translate(${sp.dx.toFixed(2)} 0) rotate(${(-sp.dx * .45).toFixed(2)} 62 70)`);
  const busy = liq.step(dt, t);
  const dp = dump ? clamp((t - dump.at) / DUMP, 0, 1) : 1;
  const { layers, sink, foam } = liq.view(t, dump && dp < 1 ? { id: dump.id, sub: dump.add * (1 - dp) } : null);
  const fill = Math.min(1, layers.reduce((a, l) => a + l.v, 0) / GLASS_CAP);
  // the ice: falls in, floats, rides the swirl, is knocked by the spoon; the surface it floats on tilts with the slosh
  cubes.set(kind, ice);
  const sy = surfaceY(kind, fill), rr = (S_RIM[kind] ?? 30);
  const surf = fill > 0 ? x => sy + swirl.tilt * (x - 60) / rr * 9 * 1.3 : null;
  const iceBusy = cubes.step(dt, t, surf, swirl, stirring ? { x: 64 + sp.dx, z: sp.dz, vx: sp.vx, vz: sp.vz } : null);
  const hit = cubes.takeHit();
  if (hit > 45 && t - lastClink > .07) { lastClink = t; sfx('clink', { rate: .85 + Math.min(.5, hit / 400) + Math.random() * .2 }); }
  const motion = swirl.motion(cubes.splash.map(p => ({ x: p.x, a: p.a, age: t - p.t0 })));
  const key = `${kind}|${ice}|${gar}|${motion || moving || iceBusy || busy || dp < 1 ? t.toFixed(3) : ''}|${layers.map(l => l.c + l.v.toFixed(2) + l.soft.toFixed(2)).join(',')}`;
  if (key === glKey) return; glKey = key;
  el.dataset.g = kind;
  el.querySelector('.gw-glass').innerHTML = glassSVG(kind, { layers, fill, ice, gar: gar !== 'none' ? ART.gar(gar) : '', sink, foam, motion, bodies: cubes.view() });
}
(function loop() { paint(); requestAnimationFrame(loop); })();
setInterval(() => { if (P.shift.on) hud(); }, 15000);

/* ───────── Overlays (Recipe card, Tip jar, Rank, Shift card, Help) ───────── */
function overlay(title, opt, ...body) {
  const ov = $('#over'); ov.hidden = false;
  const close = h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: () => closeOver() }, '×');
  ov.replaceChildren(h('div', { class: `sheet${opt?.wide ? ' wide' : ''}`, role: 'dialog', 'aria-label': title }, h('div', { class: 'shead' }, h('h2', {}, title), close), ...body));
  ov.onclick = e => { if (e.target === ov) closeOver(); };
}
function closeOver() { const ov = $('#over'); ov.hidden = true; ov.replaceChildren(); }

function showRecipe(d) {
  if (!d?.steps) return;
  overlay(d.name, null,
    h('ul', { class: 'card' },
      ...d.steps.map(s => h('li', {}, img(ART.bottle(s.b), ''), CFG.bottles[s.b]?.name ?? s.b, h('span', {}, `${s.n} part${s.n === 1 ? '' : 's'}${s.float ? ' (float)' : ''}`))),
      h('li', {}, h('span'), METHOD[d.method] || d.method, h('span', {}, 'Method')),
      h('li', {}, img(ART.glass(d.glass), ''), CFG.glasses[d.glass], h('span', {}, 'Glass')),
      h('li', {}, d.ice !== 'none' ? img(ART.ice(d.ice), '') : h('span'), B.ice[d.ice], h('span', {}, 'Ice')),
      h('li', {}, d.gar !== 'none' ? img(ART.gar(d.gar), '') : h('span'), B.garnish[d.gar], h('span', {}, 'Garnish'))),
    h('p', { class: 'note' }, 'From your bar book.'));
}

function showJar() {
  const s = Math.round(jarStars()), full = s > JAR.after;
  overlay('Tip jar', null,
    h('p', { class: 'boardline' }, full ? 'Tip jar full' : `About ★${s} in the jar`),
    h('p', { class: 'note' }, full ? `Past ★${JAR.after} in the jar your tips are worth less: half for every ★${JAR.half} more, never under ${JAR.floor * 100}% (now ×${fmt(jarMult())}).` : `Tips fill it as you pour. Up to ★${JAR.after} they pay in full.`),
    h('p', { class: 'note' }, `It empties again as the evening goes on (by half every ${JAR.drain} h), and patrons still love a drink.`));
}


function stampBadgeEl(tier) { return h('span', { class: `pstamp t${tier}` }, h('b', {}, GAME.stamps[tier]), h('small', {}, tier === 4 ? `${B.stamps.neon} Perfect days` : `${STAMP_DAYS[tier]} days Clean+`)); }
function showRankUp() {
  const r = pendingRank; pendingRank = null; if (!r) return;
  const layer = h('div', { class: 'rankup', role: 'status' },
    h('div', { class: 'ru' }, h('small', { class: 'kick' }, `Rank ${r.rank}`), h('div', { class: 'ttl' }, r.title),
      h('p', { class: 'was' }, H('shift.card.rank', 'You are a {title} now.', { title: r.title })),
      h('ul', {},
        r.fresh.length ? h('li', {}, h('b', {}, `${r.fresh.length} new drink${r.fresh.length > 1 ? 's' : ''}`), ` in your book: ${r.fresh.map(d => d.name).join(', ')}`) : null,
        r.heard.length ? h('li', {}, h('b', {}, `${r.heard.length} new rumour${r.heard.length > 1 ? 's' : ''}`), ' at the bar') : null,
        h('li', {}, h('b', {}, '+1 technique point')),
        P.trial ? h('li', { class: 'dim' }, `Next: ${TRACK.trials[String(P.trial.rank)]}`) : null)));
  document.body.append(layer);
  $('#rank').classList.remove('flash'); void $('#rank').offsetWidth; $('#rank').classList.add('flash');
  sfx('claim');
  setTimeout(() => layer.classList.add('out'), 2800);
  setTimeout(() => layer.remove(), 3300);
}
function showShiftCard(s) {
  const mins = Math.max(1, Math.round((Date.now() - s.since) / 60000)), rankUp = P.rank > s.rank0;
  const tricks = Object.entries((s.tricks || []).reduce((a, k) => ((a[k] = (a[k] || 0) + 1), a), {}));
  overlay(H('shift.card.out', 'Your {role} shift', { role: ROLE }), null,
    s.poured ? h('ul', { class: 'praise' }, s.praise.map(p => h('li', {}, p))) : h('p', { class: 'praise q' }, H('shift.card.quiet', 'A quiet shift. Nothing went over the pass this time.')),
    s.stamps.length ? h('div', { class: 'sstamps' }, s.stamps.map(x => h('span', { class: 'sst' }, stampBadgeEl(x.tier), h('small', {}, DRINKS[x.id]?.name)))) : null,
    tricks.length ? h('div', { class: 'stricks' }, h('small', {}, 'Flair'), h('ul', {}, tricks.map(([k, n]) => h('li', {}, TRICK[k] ?? k, n > 1 ? h('em', {}, ` ×${n}`) : null)))) : null,
    rankUp ? h('p', { class: 'newtitle' }, H('shift.card.rank', 'You are a {title} now.', { title: TRACK.titles[P.rank - 1] })) : null,
    h('p', { class: 'note' }, `${new Date(s.since).toTimeString().slice(0, 5)}–${new Date().toTimeString().slice(0, 5)} · ${mins} min on the clock`));
}
function showRank() {
  const r = rankInfo(), t = P.trial && P.trial.rank === P.rank + 1 ? P.trial : null;
  const nextDrinks = BACK.filter(d => d.rank === P.rank + 1 && !P.known.has(d.id)).length;
  overlay('Bartending', null,
    h('div', { class: 'rk' }, h('small', {}, `Rank ${P.rank} of ${TRACK.titles.length}`), h('div', { class: 'rkt' }, r.title),
      h('div', { class: 'xp big' }, h('i', { style: `width:${(r.next ? r.pct : 1) * 100}%` })),
      h('p', { class: 'note' }, r.next ? `${P.points - r.lo} of ${r.hi - r.lo} pours toward ${r.next}.` : 'The top of this craft.')),
    t ? h('div', { class: 'node' }, h('b', {}, 'Trial for the next rank'), h('span', { class: 'tag' }, `${t.n} / ${t.of}`), h('small', {}, TRACK.trials[String(t.rank)]),
      h('span', { class: 'xp', style: 'grid-column:1/3;margin-top:6px' }, h('i', { style: `width:${t.n / t.of * 100}%` }))) : null,
    r.next ? h('p', { class: 'note' }, `At ${r.next}: ${nextDrinks ? `${nextDrinks} new drink${nextDrinks > 1 ? 's' : ''} and ` : ''}a technique point.`) : null,
    h('ol', { class: 'ladder' }, TRACK.titles.map((ti, i) => h('li', { class: i + 1 < P.rank ? 'past' : i + 1 === P.rank ? 'now' : '' }, h('span', {}, ti), h('small', {}, i ? TRACK.ranks[i - 1] : 0)))),
    h('p', { class: 'note' }, 'Ranks, titles and trials are the live client’s. Your points and trial progress are a sample.'));
}
function showHelp() {
  const k = [
    ['1–8 hold', 'Pour from the active shelf plank'],
    ['⇧1–8 hold', 'Pour from the other shelf plank'],
    ['Q · E', 'Switch active shelf plank'],
    ['S hold', 'Stir until the chill meets the line'],
    ['D tap', 'Shake to a steady beat'],
    ['F', 'Throw / catch a Flair trick'],
    ['G · I · R', 'Step Glass · Ice · Garnish'],
    ['V', 'Open Recipe card for current order'],
    ['B', 'Open Bar book tab'],
    ['T', 'Try (experiment at the shelf)'],
    ['⌫', 'Clear current mix'],
    ['Enter', 'Serve drink'],
    ['Tab', 'Switch House card ⇄ Back bar'],
  ];
  overlay(H('bar.how.title', 'How the back bar works'), null,
    h('p', { class: 'note' }, H('bar.how.pour', 'Hold a bottle to pour and let go when the fill reaches the white line. The dots by each bottle of the order show how much it takes.')),
    h('p', { class: 'note' }, H('bar.how.method', 'Then the method: Build needs nothing more, Stir is held until the chill meets its line, and Shake is tapped in a steady beat until the button fills.')),
    h('p', { class: 'note' }, H('bar.how.glass', 'Pick the glass, the ice and the garnish the drink calls for. The line on the paper ticket names them.')),
    h('div', { class: 'keys' }, k.flatMap(([a, b]) => [h('kbd', {}, a), h('span', {}, b)])));
}

function setNight(n) { if (P.night === n) return; P.night = n; lastPaneKey = ''; render(); emit('state'); }
function devStrip() {
  const r = rankInfo();
  const btn = (label, fn, on) => h('button', { type: 'button', class: on ? 'on' : '', 'aria-pressed': on ? 'true' : null, onclick: () => { fn(); devStrip(); } }, label);
  $('#dev').replaceChildren(h('b', {}, 'prototype'),
    h('span', {}, ...Object.entries(NIGHT_NAMES).map(([k, l]) => btn(l, () => setNight(k), P.night === k))),
    h('span', {}, btn('Host', () => { P.hosted = P.hosted?.by ? { ...P.hosted, by: null } : { c: P.hosted?.c ?? 'moths', by: 'Sample host', next: P.hosted?.next ?? 'quiet' }; render(); }, !!P.hosted?.by),
      btn('Craft on', () => { P.craft = !P.craft; render(); }, !!P.craft)),
    h('span', {}, btn('+XP to rank', () => { P.points = Math.max(P.points, r.hi - 1); hud(); emit('state'); }), btn('Pass trial', () => { if (P.trial) P.trial.n = P.trial.of; hud(); }),
      btn('Next day', () => { P.today.clear(); P.todayPerfect.clear(); })));
}

/* ───────── Wiring & Keyboard ───────── */
function closeWin() { let_(); stirOff(); winOpen = false; render(); }
function openWin() { winOpen = true; render(); }
$('#cardBtn').onclick = () => { setCardOn(!cardOn()); sfx('click'); render(); };
$('#helpBtn').onclick = showHelp;
$('#closeBtn').onclick = closeWin;
$('#reopen').onclick = openWin;
$('#reopen').textContent = H('bar.use', '🍹 Tend the bar');
$('#rank').onclick = showRank;
$('#clock').onclick = () => (P.shift.on ? punchOut() : clockIn());
on('card', () => render());
let rendering = false;
on('state', () => { if (!rendering) { rendering = true; queueMicrotask(() => { rendering = false; lastPaneKey = ''; render(); checkRank(); }); } });

addEventListener('pointerup', () => { let_(); stirOff(); });
addEventListener('pointercancel', () => { let_(); stirOff(); });

const KEYS = new Set(['d', 'enter', 'q', 'e', 't', 'g', 'i', 'r', 'n', 'v', 'b', 'backspace']);
const digitOf = e => (/^Digit[1-9]$/.test(e.code) ? Number(e.code.slice(5)) : 0);
function key(e, down) {
  const k = e.key.toLowerCase(), d = digitOf(e);
  if (d >= 1 && d <= 9) {
    const targetPage = e.shiftKey ? (page + 1) % PAGES.length : page;
    const row = PAGES[targetPage] ?? [];
    if (d <= row.length) {
      if (down && !e.repeat) hold(row[d - 1]);
      else if (!down) let_();
      return true;
    }
  }
  if (k === 's') { if (down && !e.repeat) stirOn(); else if (!down) stirOff(); return true; }
  if (!down) return KEYS.has(k);
  if (e.repeat) return KEYS.has(k);
  if (k === 'd') beat();
  else if (k === 'q') turn(-1);
  else if (k === 'e') turn(1);
  else if (k === 'enter') serve();
  else if (k === 't') tryit();
  else if (k === 'backspace') { clear(); render(); }
  else if (k === 'g') step('glass', Object.keys(CFG.glasses));
  else if (k === 'i') step('ice', Object.keys(B.ice));
  else if (k === 'r' || k === 'n') step('gar', Object.keys(B.garnish));
  else if (k === 'v') { const x = bo(); if (x && !x.md && entry(x.d)?.known) showRecipe(DRINKS[x.d]); }
  else if (k === 'b') flip('book');
  else return false;
  return true;
}
const typing = e => e.target.matches?.('input,textarea,select,[contenteditable]');
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
  if (!$('#over').hidden) { if (e.key === 'Escape') closeOver(); return; }
  if (!winOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); return closeWin(); }
  if (e.key === '?' || (e.key === '/' && e.shiftKey)) { e.preventDefault(); return showHelp(); }
  if (e.key === 'Tab') { e.preventDefault(); return flip(side === 'back' ? 'house' : 'back'); }
  if (side === 'back' && key(e, true)) { e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
addEventListener('keyup', e => { if (winOpen && side === 'back' && $('#over').hidden && !e.ctrlKey && !e.metaKey && !e.altKey && key(e, false)) e.stopImmediatePropagation(); }, true);
document.addEventListener('visibilitychange', () => { if (document.hidden) { let_(); stirOff(); } });

/* go */
P.shift.rank0 = P.rank;
if (!P.trial || !RULES[P.trial.rank]) setTrial();
devStrip(); render();
