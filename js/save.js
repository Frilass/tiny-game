// localStorage persistence. The live sim (positions, cooldowns) is not
// saved — only progression. A bad or partial blob falls back to defaults
// so a corrupt save cannot blank the game.
//
// Load this script after upgrades.js. New upgrade ids picked up from
// Dungeon.UPGRADES start at rank 0 for existing saves.
(function (Dungeon) {
    "use strict";

    const SAVE_KEY = "slime-pit-save";

    function defaultSave() {
        return {
            v: 1,
            level: 1,
            xp: 0,
            gold: 0,
            hp: 48,
            maxHp: 48,
            strength: 5,
            attackSpeed: 1,
            kills: 0,
            ranks: {}
        };
    }

    function clamp(value, min, max, fallback) {
        if (typeof value !== "number" || !isFinite(value)) {
            return fallback;
        }
        return Math.min(max, Math.max(min, value));
    }

    function applyRanks(save, rawRanks) {
        const ranks = rawRanks && typeof rawRanks === "object" ? rawRanks : {};
        const upgrades = Dungeon.UPGRADES || [];
        save.ranks = {};
        for (let i = 0; i < upgrades.length; i++) {
            const upgrade = upgrades[i];
            const maxRank = upgrade.maxRank || 999;
            save.ranks[upgrade.id] = Math.round(clamp(ranks[upgrade.id], 0, maxRank, 0));
        }
        return save;
    }

    Dungeon.SAVE_KEY = SAVE_KEY;
    Dungeon.defaultSave = defaultSave;

    Dungeon.loadSave = function () {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) {
                return applyRanks(defaultSave(), {});
            }
            const data = JSON.parse(raw);
            if (!data || typeof data !== "object") {
                return applyRanks(defaultSave(), {});
            }
            const save = defaultSave();
            save.level = Math.round(clamp(data.level, 1, 200, 1));
            save.xp = Math.round(clamp(data.xp, 0, 100000000, 0));
            save.gold = Math.round(clamp(data.gold, 0, 100000000, 0));
            save.maxHp = Math.round(clamp(data.maxHp, 1, 100000, 48));
            save.hp = clamp(data.hp, 0, save.maxHp, save.maxHp);
            save.strength = Math.round(clamp(data.strength, 1, 100000, 5) * 10) / 10;
            save.attackSpeed = Math.round(clamp(data.attackSpeed, 0.2, 20, 1) * 100) / 100;
            save.kills = Math.round(clamp(data.kills, 0, 100000000, 0));
            applyRanks(save, data.ranks);
            // Dying and refreshing should not stick the knight at 0 HP.
            if (save.hp <= 0) {
                save.hp = save.maxHp;
            }
            return save;
        } catch (err) {
            return applyRanks(defaultSave(), {});
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
