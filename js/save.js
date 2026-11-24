// localStorage persistence. The live sim (positions, cooldowns) is not
// saved — only the run and the permanent gold track.
//
// v1 saves (the endless pit) keep their gold and gold-shop ranks. Level,
// loose XP, and stats that came from old level-ups are dropped, and the
// knight is sent to the menu. A bad blob falls back to a fresh menu save.
//
// Load this script after upgrades.js.
(function (Dungeon) {
    "use strict";

    const SAVE_KEY = "slime-pit-save";

    function clamp(value, min, max, fallback) {
        if (typeof value !== "number" || !isFinite(value)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, value));
    }

    function blankRanks(list) {
        const ranks = {};
        const upgrades = list || [];
        for (let i = 0; i < upgrades.length; i++) {
            ranks[upgrades[i].id] = 0;
        }
        return ranks;
    }

    function readRanks(list, raw) {
        const ranks = blankRanks(list);
        const source = raw && typeof raw === "object" ? raw : {};
        const ids = Object.keys(ranks);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const upgrade = list[i];
            const maxRank = upgrade && upgrade.maxRank ? upgrade.maxRank : 999;
            ranks[id] = Math.round(clamp(source[id], 0, maxRank, 0));
        }
        return ranks;
    }

    function defaultSave() {
        return {
            v: 2,
            gold: 0,
            goldRanks: blankRanks(Dungeon.GOLD_UPGRADES),
            xpRanks: blankRanks(Dungeon.XP_UPGRADES),
            inRun: false,
            floor: 1,
            level: 1,
            xp: 0,
            xpBar: 0,
            hp: 48,
            maxHp: 48,
            strength: 5,
            attackSpeed: 1,
            floorKills: 0,
            runGold: 0,
            runKills: 0
        };
    }

    function finish(save) {
        const loadedHp = save.hp;
        if (typeof Dungeon.recomputeStats === "function") {
            Dungeon.recomputeStats(save, true);
        }
        if (!save.inRun || loadedHp <= 0) {
            save.hp = save.maxHp;
        } else {
            save.hp = Math.min(save.maxHp, loadedHp);
        }
        return save;
    }

    Dungeon.SAVE_KEY = SAVE_KEY;
    Dungeon.defaultSave = defaultSave;

    Dungeon.loadSave = function () {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                return finish(defaultSave());
            }
            const data = JSON.parse(raw);
            if (!data || typeof data !== "object") {
                return finish(defaultSave());
            }
            const save = defaultSave();
            save.gold = Math.round(clamp(data.gold, 0, 100000000, 0));

            // Endless-pit saves stored gold-shop ranks on `ranks`.
            const oldGoldRanks = data.goldRanks || data.ranks;
            save.goldRanks = readRanks(Dungeon.GOLD_UPGRADES, oldGoldRanks);
            save.xpRanks = readRanks(Dungeon.XP_UPGRADES, data.v >= 2 ? data.xpRanks : {});

            const legacy = !(data.v >= 2);
            if (legacy) {
                save.inRun = false;
                save.floor = 1;
                save.level = 1;
                save.xp = 0;
                save.xpBar = 0;
                save.floorKills = 0;
                save.runGold = 0;
                save.runKills = 0;
                return finish(save);
            }

            save.inRun = !!data.inRun;
            const floorCount = (Dungeon.FLOORS && Dungeon.FLOORS.length) || 10;
            save.floor = Math.round(clamp(data.floor, 1, floorCount, 1));
            save.level = Math.round(clamp(data.level, 1, 99, 1));
            save.xp = Math.round(clamp(data.xp, 0, 100000000, 0));
            save.xpBar = Math.round(clamp(data.xpBar, 0, 100000000, 0));
            save.floorKills = Math.round(clamp(data.floorKills, 0, 99, 0));
            save.runGold = Math.round(clamp(data.runGold, 0, 100000000, 0));
            save.runKills = Math.round(clamp(data.runKills, 0, 100000000, 0));
            save.hp = clamp(data.hp, 0, 100000, 48);
            return finish(save);
        } catch (err) {
            return finish(defaultSave());
        }
    };

    Dungeon.saveGame = function (save) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch (err) {
            // Private mode or a full quota should not stop the loop.
        }
    };

    Dungeon.clearSave = function () {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (err) {
            // Ignore. The in-memory run keeps going until reload.
        }
    };
})(window.Dungeon = window.Dungeon || {});
