// Gold shop. One button is built per entry, so adding an upgrade is data.
//
// To add an upgrade:
//   1. Copy an entry. `id` must be unique; it is the localStorage rank key.
//   2. baseCost is the price at rank 0. The next rank costs
//      round(baseCost * growth ^ rank).
//   3. apply(save) mutates the save object. It runs once per purchase.
//      Ranks already bought are not re-applied on load — the resulting
//      stats live on the save (strength, maxHp, attackSpeed).
//   4. maxRank is optional. Omit it for an uncapped upgrade.
//
// No other file needs a change. Bump the service-worker cache name only
// if you want existing installs to pick the new script up immediately.
(function (Dungeon) {
    "use strict";

    Dungeon.UPGRADES = [
        {
            id: "strength",
            name: "Strength",
            detail: "+2 power",
            baseCost: 10,
            growth: 1.5,
            maxRank: 40,
            apply: function (save) {
                save.strength = Math.round((save.strength + 2) * 10) / 10;
            }
        },
        {
            id: "vitality",
            name: "Max HP",
            detail: "+15 health",
            baseCost: 12,
            growth: 1.48,
            maxRank: 40,
            apply: function (save) {
                save.maxHp += 15;
                save.hp += 15;
            }
        },
        {
            id: "haste",
            name: "Atk Speed",
            detail: "+10% speed",
            baseCost: 18,
            growth: 1.55,
            maxRank: 18,
            apply: function (save) {
                save.attackSpeed = Math.round((save.attackSpeed + 0.1) * 100) / 100;
            }
        }
    ];

    Dungeon.upgradeById = function (id) {
        const list = Dungeon.UPGRADES;
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === id) {
                return list[i];
            }
        }
        return null;
    };

    Dungeon.upgradeCost = function (upgrade, rank) {
        return Math.round(upgrade.baseCost * Math.pow(upgrade.growth, rank));
    };
})(window.Dungeon = window.Dungeon || {});
