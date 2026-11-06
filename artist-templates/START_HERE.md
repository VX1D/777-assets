# Layer 777: artist pack

Everything here comes from the live game, dumped on 2026-11-06. Sprites are drawn at 100%, no scaling.

## What are you making?

| You want to draw | Read | Open |
|---|---|---|
| Anything | `guides/01_how_item_sheets_work.png` | |
| Hat or headwear | `guides/02_hat.png` | `templates/hat/` |
| Backpack, wings, cape | `guides/03_back.png` | `templates/back/` |
| Item held in hand | `guides/04_hold.png` | `templates/hold/` |
| Clothes with drawn details | `guides/05_clothes.png` | `templates/clothes/` |
| Whole-body costume | `guides/06_costume.png` | `templates/costume/` |
| Plain shirt, colours only | `guides/07_shirt_colours.png` | `templates/shirt-colours/` |
| New character | `guides/08_masks.png`, `guides/09_new_character.png` | `templates/new-character/` |
| Light effect on an item | `guides/01_how_item_sheets_work.png` | `templates/glow/` |
| Remicat smooth-animation clothes (optional) | `guides/10_rig.png` | `templates/rig/` |

Each template has one layered `.psd` and one flat `.png` per character. They open in Photoshop, Krita, GIMP and Photopea. If you use another editor, put the flat PNG on a bottom layer.

## Quick rules

1. Each item is 3 sets of art: Remicat, Milady, Retart.
2. Sheet is 288×576: 3 columns, 6 rows of 96×96 cells.
3. Draw only on `DRAW` layers. Hide everything else before export.
4. Export transparent PNG at the original size, one file per `DRAW` layer that has art.
5. Item colours are final. Only characters have masks.

## File names

Replace `name` with the item's name.

| File | Contents |
|---|---|
| `name.png` | Remicat, over the body |
| `name-milady.png` | Milady, over the body |
| `name-retart.png` | Retart, over the body |
| `name-behind.png`, `name-milady-behind.png`, `name-retart-behind.png` | Under the body |
| `name-glow.png`, `name-milady-glow.png`, `name-retart-glow.png` | Light layer, 384×768 |

## Reference

- `library/catalog_*.png`: every game item on all 3 characters, by type.
- `library/<type>/<item>/`: the original sheets. Open any of them to see how it was made.
- `library/trails`, `vehicles`, `toys`: other sprites, same across characters unless the file name says otherwise. Vehicles use 96×112 frames, most trails 24×24.
- `templates/new-character/example-*.psd`: the 3 real characters, split into layers.
- `templates/new-character/game-mask-*.png`, `game-base-*.png`: their final game files.

Each PSD has a hidden real example in its GUIDES group. Turn it on to compare size and position.
