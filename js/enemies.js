// Enemy catalog for the single dungeon floor.
//
// To add an enemy:
//   1. Copy an entry below. `id` must be unique.
//   2. Set minLevel (the player level that unlocks it) and weight
//      (how often it is picked relative to other unlocked entries).
//   3. Tune combat numbers. hpPerLevel / damagePerLevel are added once
//      per player level above 1 when the enemy is spawned, so older
//      slimes do not stay paper-thin.
//   4. Leave draw: "slime" to reuse the blob renderer. Colors and
//      radius are read straight from this object. A new draw value
//      needs a matching branch in js/render.js (drawEnemy).
//
// Game.js copies stats onto each spawn and keeps `look` pointing here
// for colors. Do not mutate these objects at runtime.
(function (Dungeon) {
    "use strict";

    Dungeon.ENEMY_TYPES = [
        {
            id: "green",
            name: "Slime",
            draw: "slime",
            minLevel: 1,
            weight: 8,
            hp: 22,
            hpPerLevel: 2,
            damage: 3,
            damagePerLevel: 0.25,
            speed: 28,
            attackCooldown: 1.35,
            xp: 6,
            gold: 4,
            strengthGain: 0.1,
            radius: 18,
            hop: 12,
            body: "#46d66e",
            dark: "#178a38",
            shine: "#e7ffe9",
            eye: "#102816",
            cheek: "#2eaf58"
        },
        {
            id: "blue",
            name: "Tide Slime",
            draw: "slime",
            minLevel: 3,
            weight: 5,
            hp: 36,
            hpPerLevel: 3,
            damage: 5,
            damagePerLevel: 0.3,
            speed: 22,
            attackCooldown: 1.5,
            xp: 10,
            gold: 7,
            strengthGain: 0.1,
            radius: 20,
            hop: 9,
            body: "#3aa0ff",
            dark: "#1a4fbf",
            shine: "#e5f4ff",
            eye: "#061428",
            cheek: "#2a74d0"
        },
        {
            id: "amber",
            name: "Amber Slime",
            draw: "slime",
            minLevel: 6,
            weight: 4,
            hp: 30,
            hpPerLevel: 2.5,
            damage: 6,
            damagePerLevel: 0.35,
            speed: 48,
            attackCooldown: 1.05,
            xp: 12,
            gold: 9,
            strengthGain: 0.15,
            radius: 16,
            hop: 15,
            body: "#f0a020",
            dark: "#a85a08",
            shine: "#fff1cc",
            eye: "#2a1604",
            cheek: "#d4841a"
        },
        {
            id: "brute",
            name: "Brute Slime",
            draw: "slime",
            minLevel: 9,
            weight: 2,
            hp: 72,
            hpPerLevel: 4,
            damage: 8,
            damagePerLevel: 0.4,
            speed: 16,
            attackCooldown: 1.65,
            xp: 20,
            gold: 14,
            strengthGain: 0.2,
            radius: 28,
            hop: 7,
            body: "#b07cff",
            dark: "#5a2ea8",
            shine: "#f3e8ff",
            eye: "#1a0830",
            cheek: "#8a56e0"
        }
    ];

    // Weighted pick among types the player has unlocked.
    Dungeon.pickEnemyType = function (level) {
        const all = Dungeon.ENEMY_TYPES;
        const pool = all.filter((type) => level >= type.minLevel);
        const usable = pool.length ? pool : all;
        let total = 0;
        for (let i = 0; i < usable.length; i++) {
            total += usable[i].weight;
        }
        let roll = Math.random() * total;
        for (let i = 0; i < usable.length; i++) {
            roll -= usable[i].weight;
            if (roll <= 0) {
                return usable[i];
            }
        }
        return usable[0];
    };
})(window.Dungeon = window.Dungeon || {});
