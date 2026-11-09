// Shared state + helpers for the Cyberia bar prototype. EVERY module imports from here; nobody redefines these.
// Real data: GAME (data.js) was read from the live client. P below is a SAMPLE player — the server owns the real one.
import { GAME } from './data.js';
import { play } from './sound.js';
export { GAME };

/* ── game constants (real) ── */
export const B = GAME.back;
export const DRINKS = GAME.drinks;
export const BACK = Object.values(DRINKS).filter(d => d.steps);
export const REGULARS = ['Pip', 'Moth', 'Bramble', 'Nib', 'Clover', 'Dusk', 'Tansy', 'Wren', 'Pebble', 'Fig', 'Sorrel', 'Juniper'];
export const METHOD = { build: 'Build', stir: 'Stir', shake: 'Shake' };
export const TRACK = GAME.track;           // { ranks:[10,30,…], titles:[…], trials:{"2":"…"}, tree:{branch:{name,nodes:[{id,name,text}]}} }
export const ART = {
  bottle: b => `assets/bar-bottle-${b}.png`, glass: g => `assets/bar-glass-${g}.png`, ice: i => `assets/bar-ice-${i}.png`,
  gar: g => `assets/bar-gar-${g}.png`, drink: id => `assets/${id.replace(':', '-')}.png`, shaker: n => `assets/bar-shaker-${n}.png`,
};

/* ── SAMPLE player (server-owned in the game) ── */
export const P = {
  rank: 2, points: 22,                                   // rank index is 1-based into TRACK.titles; points vs TRACK.ranks
  trial: { rank: 3, n: 4, of: 10 },                      // progress on the trial gating the next rank (sample)
  stars: 0, served: 0, row: 0,                           // row = drinks in a row without a spill or a wrong mix
  shift: { on: false, since: 0, poured: 0, perfect: 0, praise: [],
           stars: 0, best: 0, rank0: 2, ev: {}, stamps: [] },   // ev = shift.praise event counts {perfect:1,pour:3,…}; stamps = [{id,tier}] earned this shift
  night: 'calm',                                         // club night state: 'calm' | 'rush' | 'last' | 'dark' (power cut) — sample, server-owned
  today: new Set(), todayPerfect: new Set(),             // drinks already counted toward a mastery day today
  stampPerfect: {},                                      // days of Perfect pours on top of gold (neon needs B.stamps.neon of them)
  known: new Set([...BACK.filter(d => typeof d.rank === 'number' && d.rank <= 3).map(d => d.id), 'drink:copper-hour']),
  rumours: new Set(BACK.filter(d => d.rank === 4 || d.rank === 5).map(d => d.id)),
  stamps: { 'drink:ping-fizz': 2, 'drink:clean-signal': 1, 'drink:moss-highball': 1 },   // 1 bronze · 2 silver · 3 gold · 4 neon
  stampDays: { 'drink:ping-fizz': 6, 'drink:clean-signal': 3, 'drink:moss-highball': 2 },
  tech: new Set(['stir']), free: 1,
  stock: { 'farm:syrup-honey': 3, 'farm:steep-mint': 1 },
  prep: [{ station: 'infuser', recipe: 'Thyme steep', left: 5400 }],
  sigs: [],                                              // { base, spirit, prep, finish, name }
  regulars: { Pip: 2, Moth: 0, Bramble: 1, Nib: 3, Clover: 0, Dusk: 1 },   // story parts told (of 6)
  crew: null,                                            // { name, lead, members:[…], stamps:[…] }
  // ── House card and social SAMPLE fields ──
  flairTech: new Set(['toss', 'spin', 'tin-roll', 'crowd', 'flame']),   // sample flair nodes learned; real ones are P.tech nodes on the bar tree
  soc: { jarStars: 120 },                               // ★ in the tip jar tonight (pay falls off past the jar's "after")

  // book samples — server-owned in the game
  bag: { 'farm:honey': 4, 'crop:wild-thyme': 3, 'drink:bottle-clear': 1, 'crop:water-mint': 2, 'drink:bottle-gin': 1, 'farm:base-juniper': 1, 'crop:blackberry': 4 },  // ingredients in the bag (decides Make's `can`)
  heard: { Pip: ['l', 'j'], Nib: ['l', 'l'], Dusk: [] },  // regulars: your answer per story part told, 'l' listen · 'j' joke
  tasted: { 'drink:dew': 3, 'drink:fizz': 2, 'drink:mead': -1 },   // drinks tasted as a patron → best mark (0-4), -1 poured elsewhere
  tastedSigs: [['Velvet Static', 'Rook']],               // signatures tasted: [name, by] (sample)
  hosted: { c: 'moths', by: null, next: 'quiet' },  // tonight's hosted night (bar.nights cond id) + tomorrow's, null = board dark
  shelf: { p: [], l: [] },                               // smoke shelf: pack designs, lighters held
  mentor: 0,                                             // trainee step reached (0-4)
  craft: false,                                          // bar craft (prep stations) on — live default off; the Prep tab shows only when true
  relearns: 0,                                           // techniques relearned so far (the first is free, then bar respec ★)
};

/* ── tiny event bus so modules talk without importing each other ── */
const subs = new Map();
export const on = (ev, fn) => { (subs.get(ev) || subs.set(ev, new Set()).get(ev)).add(fn); return () => subs.get(ev).delete(fn); };
export const emit = (ev, data) => { for (const fn of subs.get(ev) || []) try { fn(data); } catch (e) { console.error(e); } };
// Events in use: 'served' {drink, grade, pay}, 'rank-up' {rank}, 'learned' {id}, 'state' (any P change → re-render),
// 'practice' {drinkId}, 'open' {panel, arg}  — the shell listens to 'open' and routes to the right module.

/* ── the House card's recipe list toggle, one source for every module (default on, like the client) ──
   Stored in localStorage `bb_bar_card` like the client; nothing stored = on. setCardOn emits 'card' (bool). */
export const cardOn = () => { try { return localStorage.getItem('bb_bar_card') !== '0'; } catch { return true; } };
export const setCardOn = v => { try { localStorage.setItem('bb_bar_card', v ? '1' : '0'); } catch { /* storage off */ } emit('card', !!v); };

/* ── sounds: tiny WebAudio blips for the client's sfx names (click, pop, claim, send, fail, react) ── */
export const sfx = play;                               // bar sounds (sound.js)

/* ── DOM helpers ── */
export const $ = s => document.querySelector(s);
export const h = (tag, a = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
export const img = (src, alt = '', cls = 'px') => h('img', { src, alt, class: cls, draggable: 'false' });
export const now = () => performance.now() / 1000;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const fmt = n => (Math.round(n * 10) / 10).toString();
export const rankInfo = () => { const i = P.rank - 1, lo = i ? TRACK.ranks[i - 1] : 0, hi = TRACK.ranks[i]; return { title: TRACK.titles[i], next: TRACK.titles[i + 1], lo, hi, pct: clamp((P.points - lo) / (hi - lo), 0, 1), trial: TRACK.trials[String(P.rank + 1)] }; };
