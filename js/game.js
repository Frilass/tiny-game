// Run loop for ten dungeon floors.
//
// Each frame the knight runs to the nearest living slime he can walk to
// and swings when the sword can reach it. Slimes hop toward the knight
// and bite back. Sword and bite share one distance (meleeReach).
//
// A floor spawns a fixed count of one slime kind. When the last one
// dies, the next floor starts. Floor 10 clears the run. Gold is kept
// and spent on the menu. XP is spent during the run. A level-up does
// not change stats. Death ends the run: level, XP, and XP upgrades
// reset, and the menu comes back.
(function (Dungeon) {
    "use strict";

    const WORLD_W = 520;
    // Shared floor. The knight used to stop 108px from the wall while a
    // slime could be shoved to radius+10, then hold still inside its own
    // bite and outside the sword.
    const WALK_MIN = 108;
    const WALK_MAX = WORLD_W - 108;
    // Extra pixels a swing or a bite may still connect after it starts.
    // Both sides use it so neither reach is longer.
    const MELEE_SLOP = 6;
    const PLAYER_SPEED = 118;
    const BASE_SWING = 0.34;
    const BASE_INTERVAL = 0.76;
    const HP_REGEN = 0.4;
    const DOWN_TIME = 1.05;
    const INVULN_TIME = 0.7;

    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }

    const stage = document.getElementById("stage");
    const save = Dungeon.loadSave();
    let freshSave = false;
    try {
        freshSave = !localStorage.getItem(Dungeon.SAVE_KEY);
    } catch (err) {
        freshSave = false;
    }

    const sim = {
        time: 0,
        shake: 0,
        spawnCooldown: 0.4,
        banner: null,
        player: {
            x: 132,
            facing: 1,
            mode: "idle",
            runPhase: 0,
            attackT: 0,
            attackCd: 0.2,
            hitApplied: false,
            invuln: 0,
            flash: 0,
            fall: 0,
            downT: 0
        },
        enemies: [],
        particles: [],
        floaters: []
    };

    const view = {
        w: 1,
        h: 1,
        dpr: 1,
        scale: 1,
        worldW: WORLD_W
    };

    const ui = {
        menu: document.getElementById("menu"),
        run: document.getElementById("run"),
        summary: document.getElementById("summary"),
        summaryTitle: document.getElementById("summary-title"),
        summaryFloor: document.getElementById("summary-floor"),
        summaryGold: document.getElementById("summary-gold"),
        summaryButton: document.getElementById("summary-menu"),
        start: document.getElementById("start"),
        menuGold: document.getElementById("menu-gold"),
        permStats: document.getElementById("perm-stats"),
        floor: document.getElementById("floor"),
        left: document.getElementById("left"),
        level: document.getElementById("level"),
        strength: document.getElementById("strength"),
        gold: document.getElementById("gold"),
        hpText: document.getElementById("hpText"),
        xpText: document.getElementById("xpText"),
        hpFill: document.getElementById("hpFill"),
        xpFill: document.getElementById("xpFill"),
        hpTrack: document.getElementById("hpTrack"),
        xpTrack: document.getElementById("xpTrack"),
        toast: document.getElementById("toast"),
        reset: document.getElementById("reset"),
        shopTitle: document.getElementById("shop-title"),
        menuNote: document.getElementById("menu-note")
    };

    // "menu" shows the gold shop. "run" is the fight. "summary" is the
    // death or victory card. Combat only ticks during "run".
    let mode = "menu";

    let toastLeft = 0;
    let dirty = false;
    let saveTimer = 0;
    let resetArmedUntil = 0;
    // How long the knight has been pinned on an edge, short of his target.
    let stuckTime = 0;
    let lastHud = "";

    // XP required to leave this level. Early levels are a few slimes;
    // the curve steepens after that.
    function xpToNext(level) {
        return Math.round(12 + 14 * Math.pow(level, 1.28));
    }

    function swingTime() {
        return Math.max(0.16, BASE_SWING / save.attackSpeed);
    }

    function attackInterval() {
        const swing = swingTime();
        return Math.max(swing + 0.04, BASE_INTERVAL / save.attackSpeed);
    }

    // Sword and bite share one distance. The bite used to be longer, so a
    // slime on the edge could stop and hit the knight while he was still
    // short of the distance that starts his swing.
    function meleeReach(enemy) {
        return 42 + enemy.radius;
    }

    function inMelee(enemy) {
        return Math.abs(enemy.x - sim.player.x) <= meleeReach(enemy) + MELEE_SLOP;
    }

    // True when some spot the knight can walk to is inside sword range.
    function canReach(enemy) {
        const stand = Math.max(WALK_MIN, Math.min(WALK_MAX, enemy.x));
        return Math.abs(enemy.x - stand) <= meleeReach(enemy) + MELEE_SLOP;
    }

    function clampWalk(entity) {
        if (entity.x < WALK_MIN) {
            entity.x = WALK_MIN;
        } else if (entity.x > WALK_MAX) {
            entity.x = WALK_MAX;
        }
    }

    function formatNumber(value) {
        const rounded = Math.round(value * 10) / 10;
        if (Math.abs(rounded - Math.round(rounded)) < 0.001) {
            return String(Math.round(rounded));
        }
        return rounded.toFixed(1);
    }

    function formatGold(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + "m";
        }
        if (value >= 10000) {
            return (value / 1000).toFixed(1) + "k";
        }
        return String(value);
    }

    function markDirty() {
        dirty = true;
    }

    function flushSave() {
        Dungeon.saveGame(save);
        dirty = false;
        saveTimer = 0;
    }

    function toast(message, duration) {
        ui.toast.textContent = message;
        ui.toast.classList.add("show");
        if (ui.menuNote) {
            ui.menuNote.textContent = message;
        }
        toastLeft = duration || 2.3;
    }

    function floater(x, y, text, color) {
        sim.floaters.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 0.9,
            vy: -32
        });
        if (sim.floaters.length > 24) {
            sim.floaters.shift();
        }
    }

    function burst(x, y, color, count, speed) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const mag = speed * (0.4 + Math.random());
            sim.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * mag,
                vy: Math.sin(angle) * mag - 20,
                life: 0.4 + Math.random() * 0.25,
                max: 0.65,
                size: 1.8 + Math.random() * 2.4,
                color: color,
                gravity: 90
            });
        }
        if (sim.particles.length > 80) {
            sim.particles.splice(0, sim.particles.length - 80);
        }
    }

    function spawnDust(x, facing) {
        sim.particles.push({
            x: x - facing * 8 + (Math.random() * 6 - 3),
            y: -1,
            vx: -facing * (10 + Math.random() * 14),
            vy: -6 - Math.random() * 8,
            life: 0.32,
            max: 0.32,
            size: 1.6 + Math.random() * 1.6,
            color: "#7a6254",
            gravity: 20
        });
    }

    function addXp(amount) {
        // xp is the unspent shop pool. xpBar is only the level meter.
        // Crossing a level does not heal or raise a stat.
        save.xp += amount;
        save.xpBar += amount;
        let gained = 0;
        while (save.xpBar >= xpToNext(save.level) && save.level < 99) {
            save.xpBar -= xpToNext(save.level);
            save.level += 1;
            gained += 1;
        }
        if (gained > 0) {
            sim.banner = { text: "LEVEL " + save.level, life: 1.6 };
            toast("Level " + save.level + " — spend XP in the shop");
        }
    }

    function defeat(enemy) {
        if (!enemy.alive) {
            return;
        }
        enemy.alive = false;
        enemy.deathT = 0.45;
        enemy.hp = 0;
        save.gold += enemy.gold;
        save.runGold += enemy.gold;
        save.runKills += 1;
        save.floorKills += 1;
        addXp(enemy.xp);
        floater(enemy.x, -enemy.radius * 2.3, "+" + enemy.xp + " XP", "#9fd0ff");
        floater(enemy.x, -enemy.radius * 1.5, "+" + enemy.gold + "g", "#ffd56a");
        burst(enemy.x, -enemy.radius, enemy.look.body, 8, 55);
        sim.spawnCooldown = Math.max(sim.spawnCooldown, 0.6);
        markDirty();
    }

    function damagePlayer(amount) {
        const player = sim.player;
        if (player.mode === "down" || player.invuln > 0) {
            return;
        }
        save.hp -= amount;
        player.flash = 0.14;
        sim.shake = 1;
        floater(player.x, -74, "-" + amount, "#ff8f8f");
        markDirty();
        if (save.hp <= 0) {
            save.hp = 0;
            player.mode = "down";
            player.downT = DOWN_TIME;
            player.attackT = 0;
            player.fall = 0;
            toast("Defeated");
        }
    }

    function spawnEnemy(x, type) {
        const maxHp = Math.max(1, Math.round(type.hp));
        const damage = Math.max(1, Math.round(type.damage));
        sim.enemies.push({
            look: type,
            x: x,
            hp: maxHp,
            maxHp: maxHp,
            damage: damage,
            speed: type.speed,
            radius: type.radius,
            hop: type.hop,
            attackCooldown: type.attackCooldown,
            xp: type.xp,
            gold: type.gold,
            strengthGain: type.strengthGain,
            facing: x >= sim.player.x ? -1 : 1,
            phase: Math.random() * Math.PI * 2,
            wobble: Math.random() * Math.PI * 2,
            attackCd: 0.35 + Math.random() * 0.7,
            attackT: 0,
            hitApplied: false,
            hitFlash: 0,
            alive: true,
            deathT: 0
        });
        // Keep the spawn on the shared floor even if the caller asked
        // for a point past the knight's last step.
        clampWalk(sim.enemies[sim.enemies.length - 1]);
    }

    // Spread `count` slimes across the shared walk span. clampWalk inside
    // spawnEnemy keeps a wide floor from pushing one past the knight.
    function spawnCount(count) {
        sim.enemies = [];
        const type = Dungeon.floorDef(save.floor);
        const n = Math.max(0, count);
        const lo = 220;
        const hi = WALK_MAX;
        for (let i = 0; i < n; i++) {
            const x = n === 1 ? (lo + hi) / 2 : lo + (hi - lo) * (i / (n - 1));
            spawnEnemy(x, type);
        }
    }

    function spawnCurrentFloor() {
        save.floorKills = 0;
        spawnCount(Dungeon.floorDef(save.floor).count);
    }

    function nearestLiving() {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            // Skip a slime the knight cannot walk to. Locking onto it
            // left him running in place while it kept biting.
            if (!enemy.alive || !canReach(enemy)) {
                continue;
            }
            const dist = Math.abs(enemy.x - sim.player.x);
            if (dist < bestDist) {
                bestDist = dist;
                best = enemy;
            }
        }
        return best;
    }

    function enemyInReach() {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (!enemy.alive || !inMelee(enemy)) {
                continue;
            }
            const dist = Math.abs(enemy.x - sim.player.x);
            if (dist < bestDist) {
                best = enemy;
                bestDist = dist;
            }
        }
        return best;
    }

    function strike() {
        const victim = enemyInReach();
        if (!victim) {
            return;
        }
        const damage = Math.round(save.strength * 10) / 10;
        victim.hp -= damage;
        victim.hitFlash = 0.12;
        const dir = Math.sign(victim.x - sim.player.x) || sim.player.facing;
        victim.x += dir * 7;
        // Knockback used to leave the slime past the knight's walk limit.
        clampWalk(victim);
        floater(victim.x, -victim.radius * 2.1, "-" + formatNumber(damage), "#ffe4e4");
        burst(victim.x - dir * victim.radius * 0.3, -victim.radius * 0.8, "#fff1c9", 4, 28);
        if (victim.hp <= 0) {
            defeat(victim);
        }
    }

    function updatePlayer(dt) {
        const player = sim.player;
        player.flash = Math.max(0, player.flash - dt);
        player.invuln = Math.max(0, player.invuln - dt);

        if (player.mode === "down") {
            player.downT -= dt;
            player.fall = Math.min(1, player.fall + dt / 0.26);
            if (player.downT <= 0) {
                openSummary("death");
            }
            return;
        }

        if (save.hp > 0 && save.hp < save.maxHp) {
            save.hp = Math.min(save.maxHp, save.hp + HP_REGEN * dt);
        }

        const target = nearestLiving();
        if (!target) {
            if (player.attackT <= 0) {
                player.mode = "idle";
            }
        } else if (player.attackT <= 0) {
            const dx = target.x - player.x;
            const dist = Math.abs(dx);
            const stop = meleeReach(target);
            player.facing = dx === 0 ? player.facing : Math.sign(dx);
            if (dist > stop + 0.8) {
                player.mode = "run";
                const step = Math.min(PLAYER_SPEED * dt, dist - stop);
                player.x += player.facing * step;
                player.runPhase += dt * 13;
                if (Math.random() < dt * 16) {
                    spawnDust(player.x, player.facing);
                }
            } else if (player.attackCd <= 0) {
                player.mode = "attack";
                player.attackT = 0.001;
                player.attackCd = attackInterval();
                player.hitApplied = false;
            } else {
                player.mode = "idle";
            }
        } else {
            player.mode = "attack";
        }

        if (player.attackT > 0) {
            player.attackT += dt / swingTime();
            if (!player.hitApplied && player.attackT >= 0.42) {
                player.hitApplied = true;
                strike();
            }
            if (player.attackT >= 1) {
                player.attackT = 0;
            }
        }
        player.attackCd = Math.max(0, player.attackCd - dt);
        clampWalk(player);
    }

    function updateEnemy(enemy, dt, isEngaged) {
        if (!enemy.alive) {
            return;
        }
        const reach = meleeReach(enemy);
        const moving = isEngaged && Math.abs(enemy.x - sim.player.x) > reach - 4;
        enemy.phase += dt * (moving ? 8 : 4.4);
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        enemy.attackCd = Math.max(0, enemy.attackCd - dt);

        if (enemy.attackT > 0) {
            enemy.attackT += dt / 0.42;
            if (!enemy.hitApplied && enemy.attackT >= 0.62) {
                enemy.hitApplied = true;
                if (inMelee(enemy)) {
                    damagePlayer(enemy.damage);
                }
            }
            if (enemy.attackT >= 1) {
                enemy.attackT = 0;
            }
        }

        if (!isEngaged || sim.player.mode === "down") {
            enemy.x += Math.sin(sim.time * 0.8 + enemy.wobble) * 12 * dt;
            enemy.facing = enemy.x <= sim.player.x ? 1 : -1;
            return;
        }

        const dx = sim.player.x - enemy.x;
        const dist = Math.abs(dx);
        enemy.facing = dx === 0 ? enemy.facing : Math.sign(dx);
        if (dist > reach) {
            enemy.x += enemy.facing * enemy.speed * dt;
        } else if (enemy.attackT <= 0 && enemy.attackCd <= 0) {
            enemy.attackT = 0.001;
            enemy.attackCd = enemy.attackCooldown;
            enemy.hitApplied = false;
        }
    }

    function separateEnemies() {
        const living = [];
        for (let i = 0; i < sim.enemies.length; i++) {
            if (sim.enemies[i].alive) {
                living.push(sim.enemies[i]);
            }
        }
        for (let i = 0; i < living.length; i++) {
            for (let j = i + 1; j < living.length; j++) {
                const a = living[i];
                const b = living[j];
                const dx = b.x - a.x;
                const minDist = (a.radius + b.radius) * 0.82;
                const adx = Math.abs(dx);
                if (adx >= minDist) {
                    continue;
                }
                const dir = adx < 0.01 ? 1 : Math.sign(dx);
                const push = (minDist - adx) / 2;
                a.x -= dir * push;
                b.x += dir * push;
            }
        }
        for (let i = 0; i < living.length; i++) {
            clampWalk(living[i]);
        }
    }

    // Clamp is the immediate recovery: a slime shoved past the floor is
    // back on it the same frame. If one is still outside sword range
    // after that, pull it to the knight so the lock cannot last.
    function recoverStuck(dt) {
        const player = sim.player;
        let stranded = null;
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (!enemy.alive) {
                continue;
            }
            clampWalk(enemy);
            if (!canReach(enemy)) {
                stranded = enemy;
            }
        }
        if (!stranded || player.mode === "down") {
            stuckTime = 0;
            return;
        }
        stuckTime += dt;
        if (stuckTime < 0.4) {
            return;
        }
        stranded.x = player.x;
        clampWalk(stranded);
        stuckTime = 0;
    }

    function updateEnemies(dt) {
        const living = [];
        for (let i = 0; i < sim.enemies.length; i++) {
            if (sim.enemies[i].alive) {
                living.push(sim.enemies[i]);
            }
        }
        const target = nearestLiving();
        const engaged = new Set();
        if (target && sim.player.mode !== "down") {
            engaged.add(target);
        }
        let extra = null;
        let extraDist = Infinity;
        for (let i = 0; i < living.length; i++) {
            const enemy = living[i];
            if (enemy === target) {
                continue;
            }
            if (!canReach(enemy)) {
                continue;
            }
            const dist = Math.abs(enemy.x - sim.player.x);
            if (dist < 120 && dist < extraDist) {
                extra = enemy;
                extraDist = dist;
            }
        }
        if (extra && sim.player.mode !== "down") {
            engaged.add(extra);
        }
        for (let i = 0; i < sim.enemies.length; i++) {
            updateEnemy(sim.enemies[i], dt, engaged.has(sim.enemies[i]));
        }
        separateEnemies();
        recoverStuck(dt);
    }

    // Corpses fade, then a cleared floor advances. Nothing respawns.
    function updateFloor(dt) {
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (!enemy.alive) {
                enemy.deathT -= dt;
            }
        }
        sim.enemies = sim.enemies.filter((enemy) => enemy.alive || enemy.deathT > 0);
        if (mode !== "run" || sim.enemies.length > 0) {
            return;
        }
        const def = Dungeon.floorDef(save.floor);
        if (save.floorKills < def.count) {
            return;
        }
        if (save.floor >= Dungeon.FLOORS.length) {
            openSummary("victory");
            return;
        }
        save.floor += 1;
        save.floorKills = 0;
        sim.player.x = 132;
        sim.player.facing = 1;
        sim.player.invuln = INVULN_TIME;
        spawnCurrentFloor();
        const next = Dungeon.floorDef(save.floor);
        sim.banner = { text: "FLOOR " + save.floor, life: 1.8 };
        toast("Floor " + save.floor + " — " + next.name);
        markDirty();
    }

    function updateEffects(dt) {
        sim.time += dt;
        sim.shake = Math.max(0, sim.shake - dt * 2.6);
        if (sim.banner) {
            sim.banner.life -= dt;
            if (sim.banner.life <= 0) {
                sim.banner = null;
            }
        }
        if (toastLeft > 0) {
            toastLeft -= dt;
            if (toastLeft <= 0) {
                ui.toast.classList.remove("show");
            }
        }
        for (let i = sim.particles.length - 1; i >= 0; i--) {
            const particle = sim.particles[i];
            particle.life -= dt;
            if (particle.life <= 0) {
                sim.particles.splice(i, 1);
                continue;
            }
            particle.vy += particle.gravity * dt;
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
        }
        for (let i = sim.floaters.length - 1; i >= 0; i--) {
            const item = sim.floaters[i];
            item.life -= dt;
            item.y += item.vy * dt;
            if (item.life <= 0) {
                sim.floaters.splice(i, 1);
            }
        }
        saveTimer += dt;
        if (dirty && saveTimer > 1.5) {
            flushSave();
        }
    }

    function update(dt) {
        updateEffects(dt);
        if (mode !== "run") {
            return;
        }
        updatePlayer(dt);
        if (mode !== "run") {
            return;
        }
        updateEnemies(dt);
        updateFloor(dt);
    }

    function setText(el, value) {
        const text = String(value);
        if (el.textContent !== text) {
            el.textContent = text;
        }
    }

    function clearRanks(list) {
        const ranks = {};
        for (let i = 0; i < list.length; i++) {
            ranks[list[i].id] = 0;
        }
        return ranks;
    }

    function setScreen(next) {
        mode = next;
        ui.menu.hidden = next !== "menu";
        ui.run.hidden = next === "menu";
        ui.summary.hidden = next !== "summary";
    }

    function placeKnight() {
        const player = sim.player;
        player.x = 132;
        player.facing = 1;
        player.mode = "idle";
        player.runPhase = 0;
        player.attackT = 0;
        player.attackCd = 0.2;
        player.hitApplied = false;
        player.invuln = 0.35;
        player.flash = 0;
        player.fall = 0;
        player.downT = 0;
    }

    // Drops the run. Gold and gold ranks stay. Level goes back to 1.
    function endRun() {
        save.inRun = false;
        save.floor = 1;
        save.level = 1;
        save.xp = 0;
        save.xpBar = 0;
        save.floorKills = 0;
        save.runGold = 0;
        save.runKills = 0;
        save.xpRanks = clearRanks(Dungeon.XP_UPGRADES);
        Dungeon.recomputeStats(save, true);
        save.hp = save.maxHp;
        sim.enemies = [];
        flushSave();
    }

    function openSummary(kind) {
        if (mode !== "run") {
            return;
        }
        const floor = save.floor;
        const earned = save.runGold;
        const won = kind === "victory";
        endRun();
        sim.player.mode = "down";
        sim.player.fall = 1;
        sim.player.downT = 0;
        ui.summaryTitle.textContent = won ? "Pit cleared" : "Defeated";
        ui.summaryFloor.textContent = won
            ? "All 10 floors are clear."
            : "Reached floor " + floor + ".";
        ui.summaryGold.textContent = "Gold earned: " + earned;
        setScreen("summary");
        lastHud = "";
    }

    function startRun() {
        save.inRun = true;
        save.floor = 1;
        save.level = 1;
        save.xp = 0;
        save.xpBar = 0;
        save.floorKills = 0;
        save.runGold = 0;
        save.runKills = 0;
        save.xpRanks = clearRanks(Dungeon.XP_UPGRADES);
        Dungeon.recomputeStats(save, true);
        save.hp = save.maxHp;
        placeKnight();
        spawnCurrentFloor();
        sim.banner = { text: "FLOOR 1", life: 1.6 };
        setScreen("run");
        lastHud = "";
        markDirty();
        flushSave();
        layout();
    }

    function resumeRun() {
        Dungeon.recomputeStats(save, true);
        placeKnight();
        const def = Dungeon.floorDef(save.floor);
        const left = def.count - save.floorKills;
        if (left <= 0) {
            save.floorKills = def.count;
            sim.enemies = [];
        } else {
            spawnCount(left);
        }
        setScreen("run");
        layout();
    }

    function backToMenu() {
        sim.player.mode = "idle";
        sim.player.fall = 0;
        setScreen("menu");
        lastHud = "";
        renderHud();
    }

    function renderHud() {
        const hpShown = save.hp <= 0 ? 0 : Math.max(0, Math.round(save.hp));
        const need = xpToNext(save.level);
        const hpRatio = save.maxHp > 0 ? save.hp / save.maxHp : 0;
        const floorDef = Dungeon.floorDef(save.floor);
        const left = Math.max(0, floorDef.count - save.floorKills);
        ui.hpFill.style.width = Math.max(0, Math.min(100, hpRatio * 100)) + "%";
        ui.hpFill.classList.toggle("low", hpRatio < 0.3);
        const bar = Math.max(0, save.xpBar);
        ui.xpFill.style.width = Math.max(0, Math.min(100, (bar / need) * 100)) + "%";
        view.floorText = "FLOOR " + save.floor;

        const sig = [
            mode,
            save.level,
            save.xp,
            bar,
            hpShown,
            save.maxHp,
            save.gold,
            save.strength,
            save.attackSpeed,
            save.floor,
            left,
            need
        ].concat(rankList(save.goldRanks), rankList(save.xpRanks)).join("|");
        if (sig === lastHud) {
            return;
        }
        lastHud = sig;

        setText(ui.floor, save.floor);
        setText(ui.left, left);
        setText(ui.level, save.level);
        setText(ui.strength, formatNumber(save.strength));
        setText(ui.gold, formatGold(save.gold));
        setText(ui.menuGold, formatGold(save.gold));
        setText(ui.permStats, "Power " + formatNumber(save.strength) + "  ·  HP " + save.maxHp + "  ·  Speed " + save.attackSpeed.toFixed(1));
        setText(ui.hpText, hpShown + "/" + save.maxHp);
        setText(ui.xpText, bar + "/" + need);
        setText(ui.shopTitle, "XP shop  ·  " + save.xp);
        ui.hpTrack.setAttribute("aria-valuenow", String(hpShown));
        ui.hpTrack.setAttribute("aria-valuemax", String(save.maxHp));
        ui.xpTrack.setAttribute("aria-valuenow", String(bar));
        ui.xpTrack.setAttribute("aria-valuemax", String(need));
        paintShop(document.getElementById("gold-buttons"), Dungeon.GOLD_UPGRADES, "gold");
        paintShop(document.getElementById("shop-buttons"), Dungeon.XP_UPGRADES, "xp");
    }

    function rankList(ranks) {
        const list = [];
        const keys = ranks ? Object.keys(ranks) : [];
        for (let i = 0; i < keys.length; i++) {
            list.push(ranks[keys[i]]);
        }
        return list;
    }

    function paintShop(root, list, currency) {
        if (!root) {
            return;
        }
        const buttons = root.querySelectorAll(".upgrade");
        const ranks = currency === "xp" ? save.xpRanks : save.goldRanks;
        const purse = currency === "xp" ? save.xp : save.gold;
        const suffix = currency === "xp" ? "xp" : "g";
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const upgrade = list[i];
            if (!upgrade) {
                continue;
            }
            const rank = ranks[upgrade.id] || 0;
            const maxed = !!(upgrade.maxRank && rank >= upgrade.maxRank);
            const cost = Dungeon.upgradeCost(upgrade, rank);
            button.querySelector(".upgrade-name").firstChild.nodeValue = upgrade.name;
            button.querySelector(".upgrade-rank").textContent = maxed ? "MAX" : "r" + rank;
            button.querySelector(".upgrade-detail").textContent = upgrade.detail;
            button.querySelector(".upgrade-cost").textContent = maxed ? "—" : formatGold(cost) + suffix;
            button.classList.toggle("poor", !maxed && purse < cost);
            button.disabled = maxed;
            button.setAttribute(
                "aria-label",
                upgrade.name + ", " + upgrade.detail + (maxed ? ", maxed" : ", costs " + cost + " " + (currency === "xp" ? "XP" : "gold"))
            );
        }
    }

    function shakeButton(button) {
        if (!button) {
            return;
        }
        button.classList.remove("shake");
        void button.offsetWidth;
        button.classList.add("shake");
    }

    function buy(currency, id) {
        const xp = currency === "xp";
        if (xp && mode !== "run") {
            return;
        }
        if (!xp && mode !== "menu") {
            return;
        }
        const upgrade = xp ? Dungeon.xpUpgradeById(id) : Dungeon.goldUpgradeById(id);
        if (!upgrade) {
            return;
        }
        const ranks = xp ? save.xpRanks : save.goldRanks;
        const rank = ranks[id] || 0;
        if (upgrade.maxRank && rank >= upgrade.maxRank) {
            return;
        }
        const cost = Dungeon.upgradeCost(upgrade, rank);
        const purse = xp ? save.xp : save.gold;
        const rootId = xp ? "shop-buttons" : "gold-buttons";
        const button = document.querySelector("#" + rootId + ' .upgrade[data-upgrade="' + id + '"]');
        if (purse < cost) {
            toast("Need " + cost + (xp ? " XP" : " gold"));
            shakeButton(button);
            return;
        }
        if (xp) {
            save.xp -= cost;
        } else {
            save.gold -= cost;
        }
        ranks[id] = rank + 1;
        Dungeon.recomputeStats(save);
        if (!xp) {
            save.hp = save.maxHp;
        }
        toast(upgrade.name + " upgraded");
        markDirty();
        flushSave();
        lastHud = "";
        renderHud();
    }

    function buildShop(root, list, currency) {
        for (let i = 0; i < list.length; i++) {
            const upgrade = list[i];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "upgrade";
            button.dataset.upgrade = upgrade.id;
            button.innerHTML =
                '<span class="upgrade-name">' + upgrade.name +
                '<span class="upgrade-rank"></span></span>' +
                '<span class="upgrade-detail"></span>' +
                '<span class="upgrade-cost"></span>';
            button.addEventListener("click", function () {
                buy(currency, upgrade.id);
            });
            root.appendChild(button);
        }
    }

    function bindInput() {
        ui.start.addEventListener("click", function () {
            startRun();
        });
        ui.summaryButton.addEventListener("click", function () {
            backToMenu();
        });
        ui.reset.addEventListener("click", function () {
            const now = performance.now();
            if (now < resetArmedUntil) {
                Dungeon.clearSave();
                location.reload();
                return;
            }
            resetArmedUntil = now + 2200;
            toast("Tap reset again to wipe the save");
        });

        document.addEventListener("touchmove", function (event) {
            if (event.target.closest && (
                event.target.closest("#shop") ||
                event.target.closest("#menu") ||
                event.target.closest("#summary")
            )) {
                return;
            }
            event.preventDefault();
        }, { passive: false });

        const blockGesture = function (event) {
            event.preventDefault();
        };
        document.addEventListener("gesturestart", blockGesture);
        document.addEventListener("gesturechange", blockGesture);
        document.addEventListener("gestureend", blockGesture);

        window.addEventListener("keydown", function (event) {
            const tag = event.target && event.target.tagName;
            if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA") {
                return;
            }
            if (event.code === "Space" || event.code === "ArrowUp" || event.code === "ArrowDown") {
                event.preventDefault();
            }
        });

        canvas.addEventListener("contextmenu", function (event) {
            event.preventDefault();
        });

        document.addEventListener("visibilitychange", function () {
            if (document.visibilityState === "hidden") {
                flushSave();
            }
        });
        window.addEventListener("pagehide", flushSave);
    }

    // The bitmap size must not become the element's layout size. A stale
    // stylesheet leaves the canvas at its attribute size, the stage grows to
    // fit it, and the next measure writes an even bigger bitmap. Pin the
    // display size, and never measure larger than the screen.
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    stage.style.minHeight = "160px";

    function layout() {
        const maxW = Math.max(1, window.innerWidth || 1);
        const maxH = Math.max(1, window.innerHeight || 1);
        const rect = stage.getBoundingClientRect();
        let w = rect.width;
        let h = rect.height;
        if (!isFinite(w) || w < 1) {
            w = maxW;
        }
        if (!isFinite(h) || h < 1) {
            h = Math.max(160, Math.round(maxH * 0.45));
        }
        w = Math.min(w, maxW);
        h = Math.min(h, maxH);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const bufferW = Math.max(1, Math.floor(w * dpr));
        const bufferH = Math.max(1, Math.floor(h * dpr));
        if (canvas.width !== bufferW || canvas.height !== bufferH) {
            canvas.width = bufferW;
            canvas.height = bufferH;
        }
        view.w = w;
        view.h = h;
        view.dpr = dpr;
        view.scale = Math.max(0.35, Math.min(w / WORLD_W, h / 300));
        view.worldW = WORLD_W;
    }

    buildShop(document.getElementById("gold-buttons"), Dungeon.GOLD_UPGRADES, "gold");
    buildShop(document.getElementById("shop-buttons"), Dungeon.XP_UPGRADES, "xp");
    bindInput();
    layout();
    if (typeof ResizeObserver === "function") {
        new ResizeObserver(layout).observe(stage);
    }
    window.addEventListener("resize", layout);
    if (save.inRun) {
        resumeRun();
    } else {
        setScreen("menu");
    }
    renderHud();

    let last = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        layout();
        if (document.hidden) {
            last = 0;
            return;
        }
        let dt = 0;
        if (last) {
            dt = Math.min(0.05, (now - last) / 1000);
        }
        last = now;
        if (dt > 0) {
            update(dt);
        }
        if (mode !== "menu") {
            Dungeon.drawFrame(ctx, view, sim);
        }
        renderHud();
    }

    requestAnimationFrame(frame);
})(window.Dungeon = window.Dungeon || {});
