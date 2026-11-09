# Cyberia bar: UI redesign

A working prototype of a new UI for the bartending minigame: the **House card**, the **Back bar**, and the two tabs that
feed them, **Bar book** and **Perks & Prep**. The look is new. The rules and the information on screen follow the live
client: what is shown, when, and how a pour is judged.

## Open it

- **`demo.html`**: double-click it. Everything is inlined except the sprites, which load from `assets/` next to it.
- **`index.html`**: the source version. It loads ES modules, so serve the folder first:
  `python3 -m http.server` and open <http://localhost:8000/>.

To rebuild `demo.html` after editing the source: `npm install`, then `npm run demo`.

## What is in it

| Tab | What you do there |
|---|---|
| House card | The menu board with the house recipes, the order, the glass and the shaker on the counter, the pour bar, flair, the four house bottles. |
| Back bar | The order ticket, the bottle shelf, the counter (jigger, glass, shaker), Build / Stir / Shake, flair, glass, ice and garnish, bag stock, Serve and Try. |
| Bar book | Recipes, regulars, signatures, tonight, and the bar-book window (leaderboards, drinks tasted, crew, seasons). |
| Perks & Prep | The technique tree (learned in order, with what each node changes in numbers) and the prep stations. |

Rank, XP, trial and the punch clock sit in the header. The tip jar, row and stars sit under the Back bar ticket.

## Design notes

- **One window size on every tab.** The frame never changes height. A tab's content scrolls inside it.
- **Tonight board is one line.** Click it to open the full night over the station.
- **Real glassware.** Each glass has its own see-through shape with an open rim, ice and garnish. The tin, mug and cup are opaque, so only the surface shows.
- **Pours go bottle → jigger → glass.** A held bottle tilts over the jigger. On let-go the jigger tips into the glass and a new layer rises, in pour order. Picking a bottle up again shows its earlier measure as a pale shadow under the new pour.
- **The liquid behaves.** Each layer has a density: a heavier pour sinks through a lighter one in streaks and settles below, neighbouring layers slowly diffuse into each other (a float on a syrup stays sharp), stirring swirls them together and shaking sloshes them into one colour with foam. Mixing never undoes; a pour after it lands on top as a new layer. This is looks only: the pour is still judged from the measures, like the client.
- **The shaker has a place on the counter.** Tap it, or press 5 on the House card or D on the Back bar. It rattles on every beat, frosts once shaken, and the mix in the glass blends to one colour.
- **No hand-holding beyond the client.** The House card lights the ordered row. The Back bar shows Wanted, the glass · ice · garnish line, dots per bottle and the line in the jigger, only for known drinks. Nothing marks what to press next.
- **Sound.** Every action has a sound: the bottle lifted, the pour bubbling up the jigger, the splash into the glass, glass and ice, the shaker and the spoon, a coin for a tip, a dull miss. Each bottle pours in its own voice (spirits, wine, syrups, fizzy, juices, creamy, then its own tuning), every layer of a drink plays the next note of a pentatonic scale, the jigger dings when it meets its line, and tips ring higher the longer the row.
- **Phone.** On the House card the lit recipe row is pinned under the order, and the full card opens as a sheet. On the Back bar the order ticket stays pinned at the top while you scroll to the picks.

Keys (`?` in the header lists them): 1–8 hold to pour, ⇧1–8 for the other plank, Q / E to switch planks, S hold to stir,
D to shake, F for flair, G / I / R to step glass, ice and garnish, V for the recipe card, T to Try, ⌫ to clear, Enter to serve,
Tab to switch sides. House card: 1–4 to pour, 5 to shake, Space to stop the bar.

## Real and sample

- **Real:** `data.js` and the `REAL` block in `book.js`. Both were read from the live client on 2026-11-08 and cover the recipes, bottles, tolerances, ranks, the technique tree, nights, strings and flair. The House card numbers at the top of `social.js` come from the client's `Club bar` config.
- **Sample:** the player in `state.js` (`P`). Anything the server owns is simulated: patrons, player tickets, other cats, the bag. The UI marks it SAMPLE where it shows.
- **Prototype controls:** the strip under the window (Quiet / Rush hour / Last call / Power cut, Host, Craft on, +XP to rank, Pass trial, Next day) switches sample state for testing. It is not part of the design.

## Files

| File | |
|---|---|
| `index.html` | Window shell, tokens and the Back bar styles. |
| `bar.js` | The window, tabs, header, Back bar station and its state machine, scoring, overlays. |
| `social.js` / `social.css` | House card, ticket rail, regulars' talk, the stamp after a pour, flair and pour-off rows. |
| `book.js` / `book.css` | Bar book panels, the bar-book window, techniques, prep. |
| `glassware.js` / `glassware.css` | SVG drawing of the glasses, jigger, shaker, bar spoon and the pouring bottle. |
| `sound.js` | Bar sounds, synthesised once at load into short buffers (no audio files); play only starts buffers. Pour and stir are pre-rendered loops. |
| `state.js` | Shared state and helpers, sample player, sound, the Card toggle. |
| `data.js` | Client config (generated, do not hand-edit). |
| `build-demo.mjs` | Builds `demo.html`. |
| `assets/` | Sprites from the game. |
