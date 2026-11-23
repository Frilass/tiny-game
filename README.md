# Slime Pit

An idle dungeon for a phone home screen. One floor, side view. Your knight runs to the nearest slime, swings, and takes a few hits back. Kills pay XP, gold, and a little strength. Gold buys upgrades. Closing the page keeps your progress in this browser.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Visit the URL it prints (usually `http://localhost:3000`).

Paths are relative, so the same files also work on GitHub Pages under a project subpath like `https://user.github.io/slime-pit/`.

Opening `index.html` directly (`file://`) runs the game. The service worker is registered only on `http:` and `https:`, so a file open does not throw.

## Install on iPhone

1. Serve the folder and open it in Safari on the phone, on the same Wi-Fi. A LAN address looks like `http://192.168.1.20:3000`. GitHub Pages (`https://…`) works too.
2. Tap Share, then **Add to Home Screen**.
3. Open **Slime Pit** from the home screen. It launches without the Safari toolbar.

The home-screen icon, standalone window, and notch padding come from the tags in `index.html` plus `manifest.json`. After the first load over localhost or HTTPS, the service worker saves the app for offline play. While you are online, each visit asks the network for fresh files and updates that saved copy, so a new deploy shows up without clearing the browser cache. Opening the page after an update reloads once on its own. A plain `http://` LAN address can still be added to the home screen; iOS only installs the offline cache from a secure origin (localhost or HTTPS).

## How to extend

- **New enemy:** copy an object in `js/enemies.js` (`ENEMY_TYPES`). `minLevel` gates when it can spawn and `weight` sets how often. Leave `draw` as `"slime"` to reuse the blob, with your own colors and `radius`. A different `draw` value needs a branch in `drawEnemy` inside `js/render.js`.
- **New upgrade:** copy an object in `js/upgrades.js` (`UPGRADES`). The shop adds one button per entry. `apply(save)` should mutate the save (for example `save.strength` or `save.maxHp`). Rank and cost are handled for you.
- **Pace:** XP to level up and the level-up bonuses (`LEVEL_MAX_HP`, `LEVEL_STRENGTH`) live at the top of `js/game.js`. Per-kill strength is `strengthGain` on the enemy.
- **Offline cache:** add new files to `FILES_TO_CACHE` in `service-worker.js` so a first install has them before they are requested. Online loads refresh the saved copies on their own. Change `CACHE_NAME` when you want the next visit to throw away older caches immediately.

Progress is stored in `localStorage` under `slime-pit-save`. The Reset button in the corner asks for a second tap, then clears that key.
