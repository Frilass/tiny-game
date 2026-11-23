// Idle loop for one dungeon floor.
//
// Each frame the knight runs to the nearest living slime and swings
// when the sword can reach it. Slimes hop toward the knight and bite
// back. Kills grant XP, gold, and a small strength bump. Gold spends
// in the shop (see js/upgrades.js). Level-ups raise max HP and strength.
//
// Death heals the knight back to full at the entrance and keeps every
// point of progress. Nothing here is a harsh penalty on purpose.
//
// A second floor later can swap the backdrop and the enemy pool when a
// save.floor counter increases; the update order below can stay.
(function (Dungeon) {
    "use strict";

    const WORLD_W = 520;
    const MAX_ENEMIES = 4;
    const PLAYER_SPEED = 118;
    const BASE_SWING = 0.34;
    const BASE_INTERVAL = 0.76;
    const HP_REGEN = 0.4;
    const REVIVE_TIME = 1.25;
    const INVULN_TIME = 1.7;
    const LEVEL_MAX_HP = 8;
    const LEVEL_STRENGTH = 1;

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
        level: document.getElementById("level"),
        strength: document.getElementById("strength"),
        kills: document.getElementById("kills"),
        gold: document.getElementById("gold"),
        hpText: document.getElementById("hpText"),
        xpText: document.getElementById("xpText"),
        hpFill: document.getElementById("hpFill"),
        xpFill: document.getElementById("xpFill"),
        hpTrack: document.getElementById("hpTrack"),
        xpTrack: document.getElementById("xpTrack"),
        toast: document.getElementById("toast"),
        reset: document.getElementById("reset")
    };

    let toastLeft = 0;
    let dirty = false;
    let saveTimer = 0;
    let resetArmedUntil = 0;
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

    function playerStopDistance(enemy) {
        return 30 + enemy.radius;
    }

    function enemyAttackReach(enemy) {
        return 42 + enemy.radius;
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
        save.xp += amount;
        let gained = 0;
        while (save.xp >= xpToNext(save.level) && save.level < 200) {
            save.xp -= xpToNext(save.level);
            save.level += 1;
            save.maxHp += LEVEL_MAX_HP;
            save.hp = save.maxHp;
            save.strength = Math.round((save.strength + LEVEL_STRENGTH) * 10) / 10;
            gained += 1;
        }
        if (gained > 0) {
            sim.banner = { text: "LEVEL " + save.level, life: 1.7 };
            toast("Level " + save.level + " — stronger, and fully healed");
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
        save.kills += 1;
        save.strength = Math.round((save.strength + enemy.strengthGain) * 10) / 10;
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
            player.downT = REVIVE_TIME;
            player.attackT = 0;
            player.fall = 0;
            toast("Defeated — reviving at the entrance");
        }
    }

    function revivePlayer() {
        const player = sim.player;
        save.hp = save.maxHp;
        player.mode = "idle";
        player.x = 132;
        player.facing = 1;
        player.invuln = INVULN_TIME;
        player.downT = 0;
        player.fall = 0;
        player.attackT = 0;
        player.attackCd = 0.35;
        player.flash = 0;
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (enemy.alive && enemy.x < 180) {
                enemy.x = 190 + Math.random() * 50;
            }
        }
        markDirty();
    }

    function spawnEnemy(x) {
        const type = Dungeon.pickEnemyType(save.level);
        const levels = Math.max(0, save.level - 1);
        const maxHp = Math.max(1, Math.round(type.hp + levels * type.hpPerLevel));
        const damage = Math.max(1, Math.round(type.damage + levels * type.damagePerLevel));
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
            gold: type.gold + Math.floor(Math.random() * 2),
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
    }

    function pickSpawnX() {
        for (let attempt = 0; attempt < 8; attempt++) {
            const x = 190 + Math.random() * (WORLD_W - 250);
            if (Math.abs(x - sim.player.x) > 120) {
                return x;
            }
        }
        return WORLD_W - 70;
    }

    function seedEnemies() {
        const slots = [268, 348, 420, 478];
        for (let i = 0; i < slots.length; i++) {
            spawnEnemy(slots[i]);
        }
    }

    function nearestLiving() {
        let best = null;
        let bestDist = Infinity;
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (!enemy.alive) {
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
            if (!enemy.alive) {
                continue;
            }
            const dist = Math.abs(enemy.x - sim.player.x);
            if (dist <= playerStopDistance(enemy) + 10 && dist < bestDist) {
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
        floater(victim.x, -victim.radius * 2.1, "-" + formatNumber(damage), "#ffe4e4");
        burst(victim.x - dir * victim.radius * 0.3, -victim.radius * 0.8, "#fff1c9", 4, 28);
        if (victim.hp <= 0) {
            defeat(victim);
        }
    }

    function clampX(entity, pad) {
        if (entity.x < pad) {
            entity.x = pad;
        } else if (entity.x > WORLD_W - pad) {
            entity.x = WORLD_W - pad;
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
                revivePlayer();
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
            const stop = playerStopDistance(target);
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
        clampX(player, 108);
    }

    function updateEnemy(enemy, dt, isEngaged) {
        if (!enemy.alive) {
            return;
        }
        const moving = isEngaged && Math.abs(enemy.x - sim.player.x) > enemyAttackReach(enemy) - 4;
        enemy.phase += dt * (moving ? 8 : 4.4);
        enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
        enemy.attackCd = Math.max(0, enemy.attackCd - dt);

        if (enemy.attackT > 0) {
            enemy.attackT += dt / 0.42;
            if (!enemy.hitApplied && enemy.attackT >= 0.62) {
                enemy.hitApplied = true;
                if (Math.abs(enemy.x - sim.player.x) <= enemyAttackReach(enemy) + 6) {
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
        const reach = enemyAttackReach(enemy);
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
            clampX(living[i], living[i].radius + 10);
        }
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
    }

    function updateSpawns(dt) {
        for (let i = 0; i < sim.enemies.length; i++) {
            const enemy = sim.enemies[i];
            if (!enemy.alive) {
                enemy.deathT -= dt;
            }
        }
        sim.enemies = sim.enemies.filter((enemy) => enemy.alive || enemy.deathT > 0);
        sim.spawnCooldown -= dt;
        let alive = 0;
        for (let i = 0; i < sim.enemies.length; i++) {
            if (sim.enemies[i].alive) {
                alive += 1;
            }
        }
        if (alive < MAX_ENEMIES && sim.spawnCooldown <= 0) {
            spawnEnemy(pickSpawnX());
            sim.spawnCooldown = 0.7;
        }
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
        updatePlayer(dt);
        updateEnemies(dt);
        updateSpawns(dt);
    }

    function setText(el, value) {
        const text = String(value);
        if (el.textContent !== text) {
            el.textContent = text;
        }
    }

    function renderHud() {
        const hpShown = save.hp <= 0 ? 0 : Math.max(0, Math.round(save.hp));
        const need = xpToNext(save.level);
        const hpRatio = save.maxHp > 0 ? save.hp / save.maxHp : 0;
        ui.hpFill.style.width = Math.max(0, Math.min(100, hpRatio * 100)) + "%";
        ui.hpFill.classList.toggle("low", hpRatio < 0.3);
        ui.xpFill.style.width = Math.max(0, Math.min(100, (save.xp / need) * 100)) + "%";

        const rankBits = [];
        const upgrades = Dungeon.UPGRADES;
        for (let i = 0; i < upgrades.length; i++) {
            rankBits.push(save.ranks[upgrades[i].id] || 0);
        }
        const sig = [
            save.level,
            save.xp,
            hpShown,
            save.maxHp,
            save.gold,
            save.strength,
            save.kills,
            need
        ].concat(rankBits).join("|");
        if (sig === lastHud) {
            return;
        }
        lastHud = sig;

        setText(ui.level, save.level);
        setText(ui.strength, formatNumber(save.strength));
        setText(ui.kills, save.kills);
        setText(ui.gold, formatGold(save.gold));
        setText(ui.hpText, hpShown + "/" + save.maxHp);
        setText(ui.xpText, save.xp + "/" + need);
        ui.hpTrack.setAttribute("aria-valuenow", String(hpShown));
        ui.hpTrack.setAttribute("aria-valuemax", String(save.maxHp));
        ui.xpTrack.setAttribute("aria-valuenow", String(save.xp));
        ui.xpTrack.setAttribute("aria-valuemax", String(need));
        updateShopButtons();
    }

    function updateShopButtons() {
        const buttons = document.querySelectorAll(".upgrade");
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            const upgrade = Dungeon.upgradeById(button.dataset.upgrade);
            if (!upgrade) {
                continue;
            }
            const rank = save.ranks[upgrade.id] || 0;
            const maxed = !!(upgrade.maxRank && rank >= upgrade.maxRank);
            const cost = Dungeon.upgradeCost(upgrade, rank);
            button.querySelector(".upgrade-name").firstChild.nodeValue = upgrade.name;
            button.querySelector(".upgrade-rank").textContent = maxed ? "MAX" : "r" + rank;
            button.querySelector(".upgrade-detail").textContent = upgrade.detail;
            button.querySelector(".upgrade-cost").textContent = maxed ? "—" : formatGold(cost) + "g";
            button.classList.toggle("poor", !maxed && save.gold < cost);
            button.disabled = maxed;
            button.setAttribute(
                "aria-label",
                upgrade.name + ", " + upgrade.detail + (maxed ? ", maxed" : ", costs " + cost + " gold")
            );
        }
    }

    function buyUpgrade(id) {
        const upgrade = Dungeon.upgradeById(id);
        if (!upgrade) {
            return;
        }
        const rank = save.ranks[id] || 0;
        if (upgrade.maxRank && rank >= upgrade.maxRank) {
            return;
        }
        const cost = Dungeon.upgradeCost(upgrade, rank);
        if (save.gold < cost) {
            toast("Need " + cost + " gold");
            const button = document.querySelector('.upgrade[data-upgrade="' + id + '"]');
            if (button) {
                button.classList.remove("shake");
                // Restart the CSS animation if they tap again immediately.
                void button.offsetWidth;
                button.classList.add("shake");
            }
            return;
        }
        save.gold -= cost;
        save.ranks[id] = rank + 1;
        upgrade.apply(save);
        toast(upgrade.name + " upgraded");
        markDirty();
        flushSave();
        lastHud = "";
        renderHud();
    }

    function buildShop() {
        const root = document.getElementById("shop-buttons");
        const upgrades = Dungeon.UPGRADES;
        for (let i = 0; i < upgrades.length; i++) {
            const upgrade = upgrades[i];
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
                buyUpgrade(upgrade.id);
            });
            root.appendChild(button);
        }
    }

    function bindInput() {
        ui.reset.addEventListener("click", function () {
            const now = performance.now();
            if (now < resetArmedUntil) {
                Dungeon.clearSave();
                location.reload();
                return;
            }
            resetArmedUntil = now + 2200;
            toast("Tap reset again to start over");
        });

        document.addEventListener("touchmove", function (event) {
            if (event.target.closest && event.target.closest("#shop")) {
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

    function layout() {
        const rect = stage.getBoundingClientRect();
        const w = Math.max(1, rect.width);
        const h = Math.max(1, rect.height);
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

    // file:// has no service worker. Registering there throws, so the
    // check stays on http(s) only. Insecure LAN http may also refuse the
    // worker; the catch keeps that from surfacing as an uncaught error.
    function registerServiceWorker() {
        if (location.protocol !== "http:" && location.protocol !== "https:") {
            return;
        }
        if (!("serviceWorker" in navigator)) {
            return;
        }
        navigator.serviceWorker.register("./service-worker.js").catch(function () {});
    }

    buildShop();
    bindInput();
    seedEnemies();
    layout();
    if (typeof ResizeObserver === "function") {
        new ResizeObserver(layout).observe(stage);
    }
    window.addEventListener("resize", layout);
    renderHud();
    if (freshSave) {
        toast("Your knight fights alone. Spend gold on the upgrades below.", 3.4);
    }

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
        Dungeon.drawFrame(ctx, view, sim);
        renderHud();
    }

    requestAnimationFrame(frame);
    registerServiceWorker();
})(window.Dungeon = window.Dungeon || {});
