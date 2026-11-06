# Layer 777: artist pack

Everything in this folder comes from the live game, taken on 2026-11-06. The library sheets are the exact files the game loads, and the templates line the body up exactly where the game draws it. Art is drawn at 100%: one pixel in your file is one pixel of the game world, so never scale a sheet up or down.

## What are you making?

| You want to draw | Read | Open |
|---|---|---|
| Anything (read this first) | `guides/01_how_item_sheets_work.png` | |
| Hat or headwear | `guides/02_hat.png` | `templates/hat/` |
| Backpack, wings, cape, tail | `guides/03_back.png` | `templates/back/` |
| Item held in the hand | `guides/04_hold.png` | `templates/hold/` |
| Clothes with drawn details | `guides/05_clothes.png` | `templates/clothes/` |
| Whole-body costume | `guides/06_costume.png` | `templates/costume/` |
| Plain shirt, colours only | `guides/07_shirt_colours.png` | `templates/shirt-colours/` |
| New character | `guides/08_masks.png`, `guides/09_new_character.png` | `templates/new-character/` |
| Light effect on an item | `guides/01_how_item_sheets_work.png` | `templates/glow/` |
| Remicat smooth animation for clothes (optional) | `guides/10_rig.png` | `templates/rig/` |

Each item folder has one layered `.psd` and one flat `.png` per character, named like `remicat-hat.psd` and `remicat-hat.png`. They open in Photoshop, Krita, GIMP and Photopea. If your editor cannot read PSDs, put the flat PNG on a bottom layer, draw above it, and hide it before you export. `templates/blank/` has empty sheets in the three sizes if you want to start from nothing.

The hat, back, hold, clothes and costume PSDs hide a real game item in their GUIDES group. Turn it on to compare size and position, then turn it off again.

## The item sheet

Every worn item is a sheet of **288×576** pixels: 3 columns and 6 rows of **96×96** cells.

**Rows** are the directions:

| Row | View | Used by the game |
|---|---|---|
| 0 | Front, facing down | yes |
| 1 | Side | no, never read. Copy row 2 here to keep it tidy |
| 2 | Side, facing right | yes |
| 3 | Back, facing up | yes |
| 4 | Side, flipped | no, never read. Copy row 5 here |
| 5 | Side for walking left | yes |

Row 5 is used when the character faces left. Draw it facing **right**, just like row 2, because the game mirrors the whole row. It exists so that a part can change layer when the character turns round. A held item, for example, is in front of the body in row 2 and behind it in row 5. If row 5 is empty, the item disappears whenever the character walks left.

**Columns** are the walk: left step, standing, right step. Walking plays step, standing, step, standing. A character who stands still shows the middle column, so that one is seen the most.

**Where the body sits.** In every 96×96 cell the character's 48×48 frame covers x 24 to 71 and y 40 to 87, so the feet stand on pixel row 87. The anchor, which is the point the game places on the map, is at x 48, y 73.6. The templates mark it with a small blue cross at pixel (48, 73). The body bobs a little from column to column, so follow the head and the hands as they move.

**Moving items.** For an item that animates, like a propeller or a flame, put the next drawing in 3 more columns to the right. The game shows 4 drawings per second. The sheets in the game use 1, 2, 3 or 6 drawings, which makes them 288, 576, 864 or 1728 pixels wide. The height always stays 576 (6 rows). A sheet that is less than 6 rows tall is shown as one still picture, so never crop it.

**Colours are final.** The game never recolours an item. Only the character's own body changes colour, through its masks (see `guides/08_masks.png`).

## File names

Replace `name` with the item's name, in lower case.

| File | What it holds |
|---|---|
| `name.png` | Remicat, drawn over the body |
| `name-milady.png` | Milady, drawn over the body |
| `name-retart.png` | Retart, drawn over the body |
| `name-behind.png`, `name-milady-behind.png`, `name-retart-behind.png` | The parts under the body |
| `name-glow.png`, `name-milady-glow.png`, `name-retart-glow.png` | Light layer, 384×768 |

Only send the files that have art in them. If `name-milady.png` or `name-retart.png` is missing, the game puts the Remicat drawing on that character instead, and it will not fit their head or hands. So please make all three.

## Each kind of item

**Hats** go on `name.png` and sit over the body and hair. The highest pixel in the front left-step cell (row 0, column 0) also decides how far up the player's name floats, so a tall hat pushes the name up.

**Back items** put the front view, and usually the side views, on `name-behind.png`, because from the front they are behind the body. The back view (row 3) goes on `name.png`. Wings and capes may fill the whole 96×96 cell.

**Held items** put rows 0 to 2 on `name.png` and rows 3 to 5 on `name-behind.png`, since from the back and when walking left the item is behind the body. Put the grip at the hand: the hands sit in different places on each character, so check all three templates. The game sometimes mirrors a held item into the other hand, so avoid letters or anything that must not be read backwards.

**Clothes with art** only draw what plain colours cannot do: skirts, collars, sleeves, trim. The torso colour comes from the item's 3 shirt colours, filled into the body's shirt area by the game.

**Costumes** are clothes that cover the whole body. They go in the shirt slot and are marked `cover: 1` in the catalog. The body is still drawn underneath in the player's own colours, so anything you leave open, like the face window of the pumpkin, shows the player through it. A hat is drawn on top of the costume.

**Plain shirts** need no drawing at all. Send 3 hex colours: light, mid and shade. A shirt that changes colour over time is a list of these sets that the game steps through. Stripes and a heart are the only print shapes. A new print shape needs a new mask layer for every character and a code change, so ask first.

**Glow** is a separate sheet of **384×768**: 3 columns and 6 rows of **128×128** cells. Each glow cell is the 96×96 item cell with 16 pixels added on every side, so the anchor sits at x 64, y 89.6 and the body covers x 40 to 87, y 56 to 103. Glow always has 3 columns, even for a moving item. It is only drawn at night, added on top of the picture as light, and it pulses gently. Paint it in the colour of the light you want; black adds nothing.

**Remicat smooth animation** is optional and only for clothes with art. It is one more sheet of **1024×192**: 16 columns and 3 rows of 64×64 cells, 47 of them used (the last cell stays empty). `templates/rig/shirt-cells.csv` says which pose each cell is. Cells 0, 4 and 8 are the middle column of rows 0, 2 and 3 of your normal sheet, cut out from x 16, y 28. Without this sheet the clothes still work, and a Remicat wearing them simply uses the normal animation. On the smooth animation, hats, back items and held items use only their standing column and are moved along with the body.

## Other sprites

These use the same art for every character unless the file name says otherwise.

- **Vehicles**: frames of 96×112, 16 in a row (1536 wide). Each frame turns the vehicle a further 22.5 degrees clockwise, starting from lying left to right. Extra rows are extra steps of the wheels turning. The anchor is at x 48, y 73.6, the same point as in an item cell.
- **Trails**: frames of 24×24. How many rows and columns a trail has depends on the trail. `name-night.png` is the same trail for the night.
- **Toys**: the glove, hammer and sparring gloves are normal 288×576 item sheets, with a `-milady` version. The pogo stick is one 96×112 picture and the rope is 12 frames of 96×96 in a row.

## New characters

A character is two files. The base sheet is **144×192**: 3 columns and 4 rows of 48×48 frames. Row 0 is the front, rows 1 and 2 are the side facing right (both the same), and row 3 is the back. The columns are left step, standing, right step. The mask sheet is **144×1728**: 9 copies of the base sheet stacked on top of each other, one per colour zone. Layer 0 is the outline, 1 to 3 are the fur or hair, 4 to 6 the shirt, and 7 and 8 are the stripes and heart prints. Mask pixels must be fully on or fully off; their colour does not matter, only the shape. The feet end on the bottom pixel row of each 48×48 frame and the anchor is at x 24, y 33.6.

Start from `templates/new-character/new-character.psd`. The `example-*.psd` files are the three real characters split into layers, and `game-base-*.png` and `game-mask-*.png` are their final game files. A new character also needs its own version of every item and a small code change, so talk to the developer before you draw a whole set.

## Check before you send

1. The file is exactly the right size: 288×576 (or wider for a moving item), 384×768 for glow.
2. The background is transparent and the GUIDES, BODY and grass layers are hidden.
3. You exported one PNG per DRAW layer that has art, named as in the table above.
4. Row 5 faces right like row 2, and rows 0, 2, 3 and 5 all have art.
5. There are Remicat, Milady and Retart versions, and they all sit right on their bodies.
6. Your item looks right next to a similar item in `library/`.

## Common mistakes

- Cropping or resizing the export. The game reads the sheet by cell, so every cell must stay in place.
- Drawing row 5 already mirrored. The game mirrors it, so it ends up facing the wrong way.
- Leaving the part that goes under the body on the main file, so it covers the character's face or arms.
- Exporting with the body still visible, which bakes a second body into the item.
- Painting the torso colour into clothes. Leave it out and give the 3 shirt colours instead.
- Drawing glow into the main sheet. Light goes only in the `-glow` file.

## How to send your art

Put your files in a folder named after the item at the top of this repository, like the `retart/` and `trashcan/` folders, and open a pull request. In the description, say what kind of item it is (hat, back, held, clothes, costume, shirt or something else), list the shirt colours if it has any, and say if the item moves.

## Reference

- `library/catalog_*.png`: every item in the game on all 3 characters, by type.
- `library/<type>/<item>/`: the original sheets. Open any of them to see how it was made.
- `library/clothes-rig/`: the smooth-animation sheets of the clothes that have one.
- `library/trails`, `library/vehicles`, `library/toys`: the other sprites described above.
