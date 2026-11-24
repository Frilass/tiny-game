# Slime Pit

An idle dungeon for a phone home screen. Ten floors, one slime kind on each. Your knight runs to the nearest slime, swings, and takes a few hits back. Clear every slime on a floor to go deeper. Floor 10 ends the run.

Gold drops during a run and stays in your pocket after you die. Spend it on the menu. Those upgrades are permanent. XP is only for the run you are in. Leveling up does not raise your stats. Buying from the XP shop does. Death, or a cleared pit, sends you back to the menu at level 1 with the XP shop emptied. Gold and the gold shop stay.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

Visit the URL it prints (usually `http://localhost:3000`).

Paths are relative, so the same files also work on GitHub Pages under a project subpath like `https://user.github.io/tiny-game/`.

Opening `index.html` directly (`file://`) runs the game. The service worker is registered only on `http:` and `https:`, so a file open does not throw.

## Install on iPhone

1. Serve the folder and open it in Safari on the phone, on the same Wi-Fi. A LAN address looks like `http://192.168.1.20:3000`. GitHub Pages (`https://…`) works too.
2. Tap Share, then **Add to Home Screen**.
3. Open **Slime Pit** from the home screen. It launches without the Safari toolbar.

The home-screen icon, standalone window, and notch padding come from the tags in `index.html` plus `manifest.json`. After the first load over localhost or HTTPS, the service worker saves the app for offline play. While you are online, each visit asks the network for fresh files and updates that saved copy, so a new deploy shows up without clearing the browser cache. Opening the page after an update reloads once on its own. A plain `http://` LAN address can still be added to the home screen; iOS only installs the offline cache from a secure origin (localhost or HTTPS).

## How to extend

- **New floor:** copy an object in `js/enemies.js` (`FLOORS`). `count` is how many of that slime spawn. Colors and `radius` feed the blob. A different `draw` value needs a branch in `drawEnemy` inside `js/render.js`. There is no respawn on a floor.
- **Gold upgrade:** copy an object in `js/upgrades.js` (`GOLD_UPGRADES`). The menu builds one button per entry. Also teach `recomputeStats` what the rank adds.
- **XP upgrade:** copy an object in `XP_UPGRADES`. Same idea, spent from the XP pool during a run. Ranks reset when the run ends.
- **Pace:** XP to the next level is `xpToNext` in `js/game.js`. It does not change strength or HP.
- **Offline cache:** add new files to `FILES_TO_CACHE` in `service-worker.js` so a first install has them before they are requested. Online loads refresh the saved copies on their own. Change `CACHE_NAME` when you want the next visit to throw away older caches immediately.

Progress is stored in `localStorage` under `slime-pit-save`. An older save keeps its gold and gold-shop ranks and opens on the menu. Reset save on the menu asks for a second tap, then clears that key.
