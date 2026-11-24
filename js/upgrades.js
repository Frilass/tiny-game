// Two shops. Gold upgrades are bought on the menu and last forever.
// XP upgrades are bought during a run and last until that run ends.
//
// Ranks are the source of truth. recomputeStats writes strength, maxHp,
// and attackSpeed from the base knight plus both rank tracks. A level-up
// does not call this and does not change stats.
//
// To add an upgrade, copy an entry. `id` is the rank key. baseCost is the
// price at rank 0. The next rank costs round(baseCost * growth ^ rank).
(function (Dungeon) {
    "use strict";

    const BASE_STRENGTH = 5;
    const BASE_MAX_HP = 48;
    const BASE_ATTACK_SPEED = 1;

    Dungeon.GOLD_UPGRADES = [
        {
            id: "strength",
            name: "Strength",
            detail: "+2 power",
            baseCost: 10,
            growth: 1.5,
            maxRank: 40
        },
        {
            id: "vitality",
            name: "Max HP",
            detail: "+15 health",
            baseCost: 12,
            growth: 1.48,
            maxRank: 40
        },
        {
            id: "haste",
            name: "Atk Speed",
            detail: "+10% speed",
            baseCost: 18,
            growth: 1.55,
            maxRank: 18
        }
    ];

    Dungeon.XP_UPGRADES = [
        {
            id: "power",
            name: "Power",
            detail: "+1 power",
            baseCost: 12,
            growth: 1.45,
            maxRank: 30
        },
        {
            id: "vigor",
            name: "Vigor",
            detail: "+8 health",
            baseCost: 14,
            growth: 1.45,
            maxRank: 30
        },
        {
            id: "tempo",
            name: "Tempo",
            detail: "+5% speed",
            baseCost: 16,
            growth: 1.5,
            maxRank: 20
        }
    ];

    function find(list, id) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                return list[i];
            }
        }
        return null;
    }

    Dungeon.goldUpgradeById = function (id) {
        return find(Dungeon.GOLD_UPGRADES, id);
    };

    Dungeon.xpUpgradeById = function (id) {
        return find(Dungeon.XP_UPGRADES, id);
    };

    Dungeon.upgradeCost = function (upgrade, rank) {
        return Math.round(upgrade.baseCost * Math.pow(upgrade.growth, rank));
    };

    function rankOf(ranks, id) {
        if (!ranks || typeof ranks[id] !== "number" || !isFinite(ranks[id])) {
            return 0;
        }
        return Math.max(0, Math.round(ranks[id]));
    }

    // Writes the three combat stats. Current HP grows by the same amount
    // as max HP when a purchase raises the cap, unless keepHp is set
    // (used when loading a save that already stored the wounded HP).
    Dungeon.recomputeStats = function (save, keepHp) {
        const gold = save.goldRanks || {};
        const xp = save.xpRanks || {};
        const prevMax = save.maxHp;
        save.strength = BASE_STRENGTH + rankOf(gold, "strength") * 2 + rankOf(xp, "power");
        save.maxHp = BASE_MAX_HP + rankOf(gold, "vitality") * 15 + rankOf(xp, "vigor") * 8;
        const speed = BASE_ATTACK_SPEED + rankOf(gold, "haste") * 0.1 + rankOf(xp, "tempo") * 0.05;
        save.attackSpeed = Math.round(speed * 100) / 100;
        if (!keepHp && typeof prevMax === "number" && save.maxHp > prevMax && save.hp > 0) {
            save.hp += save.maxHp - prevMax;
        }
        if (typeof save.hp !== "number" || save.hp > save.maxHp) {
            save.hp = save.maxHp;
        }
        if (save.hp < 0) {
            save.hp = 0;
        }
    };
})(window.Dungeon = window.Dungeon || {});
