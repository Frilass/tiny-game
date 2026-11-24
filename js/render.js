// Canvas drawing for the single dungeon floor. Simulation lives in
// game.js; this file only reads `sim` and paints it.
//
// drawEnemy switches on look.draw. "slime" is the built-in blob.
// Add a branch there when a catalog entry uses a new draw value.
(function (Dungeon) {
    "use strict";

    const PALETTE = {
        cape: "#9a2c2c",
        capeDark: "#6e1c1c",
        armor: "#d7dee8",
        armorDark: "#8d99a8",
        skin: "#f0c7a4",
        plume: "#d23b3b",
        gold: "#e2b84a",
        blade: "#f4f7fb",
        bladeShade: "#c5d0dc",
        pants: "#3c4656",
        boot: "#241c16",
        eye: "#1a1d24",
        grip: "#6b4324"
    };

    function hash(n) {
        const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
        return x - Math.floor(x);
    }

    function roundRect(ctx, x, y, w, h, r) {
        const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.arcTo(x + w, y, x + w, y + h, rr);
        ctx.arcTo(x + w, y + h, x, y + h, rr);
        ctx.arcTo(x, y + h, x, y, rr);
        ctx.arcTo(x, y, x + w, y, rr);
        ctx.closePath();
    }

    function drawBackdrop(ctx, view) {
        const w = view.w;
        const h = view.h;
        const ground = h * 0.8;

        // Tall phone screens keep a dark ceiling so the brickwork stays a
        // band behind the fight instead of a wall of empty masonry.
        const ceiling = ctx.createLinearGradient(0, 0, 0, ground);
        ceiling.addColorStop(0, "#070504");
        ceiling.addColorStop(0.42, "#140e0b");
        ceiling.addColorStop(1, "#3a291f");
        ctx.fillStyle = ceiling;
        ctx.fillRect(0, 0, w, ground);

        const brickW = 46;
        const brickH = 22;
        // Portrait screens are tall, so let the masonry climb higher and
        // leave the dark ceiling as a shorter band behind the title.
        const brickTop = view.h > view.w
            ? Math.max(8, view.h * 0.2)
            : Math.max(8, ground - 210);
        for (let y = brickTop; y < ground - 8; y += brickH) {
            const row = Math.floor(y / brickH);
            const offset = (row % 2) * (brickW / 2);
            for (let x = -brickW; x < w + brickW; x += brickW) {
                const n = hash(row * 1000 + Math.floor((x + offset) / 3));
                const shade = 46 + Math.floor(n * 28);
                ctx.fillStyle = "rgb(" + (shade + 16) + "," + shade + "," + (shade - 12) + ")";
                ctx.fillRect(x + offset + 1.5, y + 1.5, brickW - 3, brickH - 3);
            }
        }

        ctx.fillStyle = "#140e0b";
        ctx.fillRect(0, ground, w, h - ground);
        ctx.fillStyle = "#6d5140";
        ctx.fillRect(0, ground - 3, w, 5);
        ctx.fillStyle = "#3a2920";
        ctx.fillRect(0, ground + 2, w, 7);

        const stone = 56;
        for (let x = 0; x < w; x += stone) {
            const n = hash(20000 + x);
            ctx.fillStyle = n > 0.55 ? "#2b1d16" : "#231610";
            ctx.fillRect(x + 3, ground + 14, stone - 6, Math.max(8, h - ground - 20));
        }

        const headroom = ground - 86 * view.scale;
        if (headroom > 34) {
            const titleSize = Math.max(16, Math.min(32, w * 0.05));
            ctx.textAlign = "center";
            ctx.font = "700 " + titleSize + "px Georgia, Palatino, serif";
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillText("SLIME PIT", w / 2 + 1, headroom * 0.42 + 1);
            ctx.fillStyle = "rgba(255, 220, 180, 0.5)";
            ctx.fillText("SLIME PIT", w / 2, headroom * 0.42);
            ctx.font = "600 " + Math.max(11, titleSize * 0.42) + "px Georgia, Palatino, serif";
            ctx.fillStyle = "rgba(255, 210, 160, 0.38)";
            ctx.fillText(view.floorText || "FLOOR 1", w / 2, headroom * 0.42 + titleSize * 0.7);
        }
    }

    function drawArch(ctx) {
        ctx.fillStyle = "#0c0806";
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(22, -118);
        ctx.arc(52, -118, 30, Math.PI, 0);
        ctx.lineTo(82, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#5a4538";
        ctx.fillRect(6, -158, 20, 158);
        ctx.fillRect(78, -158, 20, 158);
        ctx.strokeStyle = "#6a5646";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(52, -140, 46, Math.PI, 0);
        ctx.stroke();

        ctx.fillStyle = "#3d2e24";
        ctx.fillRect(6, -30, 20, 10);
        ctx.fillRect(78, -30, 20, 10);
    }

    function drawTunnel(ctx, worldW) {
        const x = worldW - 28;
        ctx.fillStyle = "#0c0806";
        ctx.beginPath();
        ctx.moveTo(x - 26, 0);
        ctx.lineTo(x - 26, -96);
        ctx.arc(x, -96, 26, Math.PI, 0);
        ctx.lineTo(x + 26, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#5a4538";
        ctx.fillRect(x - 44, -148, 16, 148);
        ctx.fillRect(x + 28, -148, 16, 148);
        ctx.strokeStyle = "#6a5646";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(x, -112, 38, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#3d2e24";
        ctx.fillRect(x - 44, -28, 16, 10);
        ctx.fillRect(x + 28, -28, 16, 10);
    }

    function drawTorch(ctx, x, time, index) {
        const flicker = 0.86 + Math.sin(time * 11 + index * 2.1) * 0.08 + Math.sin(time * 23 + index) * 0.05;
        const glow = ctx.createRadialGradient(x, -108, 2, x, -100, 48 * flicker);
        glow.addColorStop(0, "rgba(255, 214, 140, 0.55)");
        glow.addColorStop(0.4, "rgba(255, 120, 40, 0.16)");
        glow.addColorStop(1, "rgba(255, 80, 20, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, -104, 48 * flicker, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255, 170, 60, 0.13)";
        ctx.beginPath();
        ctx.ellipse(x, 2, 34, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#6b5344";
        ctx.fillRect(x - 2, -108, 4, 32);
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath();
        ctx.ellipse(x, -114, 4.2 * flicker, 9 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff4d0";
        ctx.beginPath();
        ctx.ellipse(x, -116, 2 * flicker, 4.5 * flicker, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawLeg(ctx, hipX, angle, color) {
        ctx.save();
        ctx.translate(hipX, -22);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        roundRect(ctx, -2.6, 0, 5.4, 15, 2);
        ctx.fill();
        ctx.fillStyle = "#5a4032";
        roundRect(ctx, -3.2, 12, 8, 6, 1.5);
        ctx.fill();
        ctx.fillStyle = "#2a1e16";
        ctx.fillRect(-3.2, 16.5, 8, 2);
        ctx.restore();
    }

    function drawPlayer(ctx, player, time) {
        const facing = player.facing || 1;
        const stride = player.mode === "run" ? Math.sin(player.runPhase) : 0;
        const bob = player.mode === "run"
            ? Math.abs(Math.sin(player.runPhase)) * -2.4
            : player.mode === "down"
                ? 0
                : Math.sin(time * 3) * -0.7;
        const attack = player.attackT > 0 ? player.attackT : 0;
        const swing = attack * attack * (3 - 2 * attack);
        const armAngle = attack > 0 ? -1.15 + swing * 1.4 : -0.45 + stride * 0.25;

        ctx.save();
        ctx.translate(player.x, 0);

        ctx.save();
        ctx.globalAlpha = 0.28 * (1 - player.fall * 0.4);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(player.fall * facing * 10, 1, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        if (player.flash > 0) {
            ctx.filter = "brightness(1.28)";
        }
        if (player.invuln > 0 && Math.sin(time * 30) > 0.15) {
            ctx.globalAlpha = 0.5;
        }
        ctx.scale(facing, 1);
        ctx.rotate(player.fall * 1.2);
        ctx.translate(0, bob);

        // A small resting stance so the boots stay two shapes while the
        // knight stands and swings. The run cycle adds on top of it.
        drawLeg(ctx, -6, stride * 0.85 - 0.4, "#4a5868");

        ctx.fillStyle = PALETTE.capeDark;
        ctx.beginPath();
        ctx.moveTo(-2, -48);
        ctx.quadraticCurveTo(-20, -36, -15 + Math.sin(time * 6 + stride) * 2, -16);
        ctx.quadraticCurveTo(-8, -30, -1, -28);
        ctx.fill();
        ctx.fillStyle = PALETTE.cape;
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.quadraticCurveTo(-14, -38, -11 + Math.sin(time * 6 + stride) * 2, -18);
        ctx.quadraticCurveTo(-6, -34, 1, -32);
        ctx.fill();

        ctx.fillStyle = PALETTE.armorDark;
        roundRect(ctx, -9, -46, 18, 24, 5);
        ctx.fill();
        ctx.fillStyle = PALETTE.armor;
        roundRect(ctx, -8, -47, 15, 16, 5);
        ctx.fill();
        ctx.fillStyle = "#6b4a2a";
        ctx.fillRect(-9, -28, 18, 4);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(-2, -29, 4, 6);

        drawLeg(ctx, 6, -stride * 0.85 + 0.18, "#7d8ea3");

        ctx.fillStyle = PALETTE.skin;
        ctx.beginPath();
        ctx.arc(3, -54, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.armor;
        ctx.beginPath();
        ctx.arc(2, -58, 10, Math.PI * 1.05, Math.PI * 1.95);
        ctx.fill();
        ctx.fillRect(-8, -60, 20, 5);
        ctx.fillStyle = PALETTE.eye;
        ctx.fillRect(7, -56, 3.2, 3.2);
        ctx.fillStyle = PALETTE.plume;
        ctx.beginPath();
        ctx.moveTo(-2, -64);
        ctx.quadraticCurveTo(-10, -78, -3, -86 + Math.sin(time * 5) * 1.4);
        ctx.quadraticCurveTo(2, -76, 4, -64);
        ctx.fill();

        ctx.save();
        ctx.translate(8, -42);
        ctx.rotate(armAngle);
        ctx.fillStyle = PALETTE.skin;
        roundRect(ctx, 0, -2.3, 11, 4.8, 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.armor;
        roundRect(ctx, 8, -3, 6, 6, 2);
        ctx.fill();
        ctx.translate(13, 0);
        ctx.fillStyle = PALETTE.grip;
        ctx.fillRect(-7, -2, 6, 4);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(-2, -5.2, 3.2, 10.4);
        ctx.fillStyle = PALETTE.blade;
        roundRect(ctx, 0, -1.7, 22, 3.4, 1);
        ctx.fill();
        ctx.fillStyle = PALETTE.bladeShade;
        ctx.fillRect(0, -0.3, 22, 1.1);
        ctx.beginPath();
        ctx.moveTo(22, -2.3);
        ctx.lineTo(29, 0);
        ctx.lineTo(22, 2.3);
        ctx.fillStyle = PALETTE.blade;
        ctx.fill();
        ctx.restore();

        if (attack > 0.18 && attack < 0.78) {
            ctx.save();
            ctx.translate(10, -42);
            ctx.strokeStyle = "rgba(255, 236, 196, " + (0.35 + Math.sin(attack * Math.PI) * 0.55) + ")";
            ctx.lineWidth = 2.4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(0, 0, 30, -1.15, 0.4);
            ctx.stroke();
            ctx.restore();
        }

        ctx.filter = "none";
        ctx.restore();
        ctx.restore();
    }

    function slimePath(ctx, r, h) {
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.bezierCurveTo(-r * 1.06, -h * 0.08, -r * 1.02, -h * 0.7, -r * 0.42, -h * 0.96);
        ctx.bezierCurveTo(-r * 0.08, -h * 1.08, r * 0.42, -h * 1.04, r * 0.74, -h * 0.76);
        ctx.bezierCurveTo(r * 1.16, -h * 0.42, r * 1.04, -h * 0.06, r, 0);
        ctx.closePath();
    }

    function drawEye(ctx, x, y, radius, look, color, squint) {
        ctx.fillStyle = "#fffdf8";
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 1.15, radius * 1.35 * squint, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x + look, y + radius * 0.15 * squint, radius * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + look + radius * 0.22, y - radius * 0.05, radius * 0.22, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawHpBar(ctx, x, y, w, h, ratio) {
        const clamped = Math.max(0, Math.min(1, ratio));
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        roundRect(ctx, x - w / 2, y, w, h, 2);
        ctx.fill();
        ctx.fillStyle = clamped > 0.35 ? "#8ee58a" : "#ef6a5a";
        const fillW = Math.max(0, (w - 2) * clamped);
        if (fillW > 0) {
            roundRect(ctx, x - w / 2 + 1, y + 1, fillW, h - 2, 1.5);
            ctx.fill();
        }
    }

    function drawSlime(ctx, enemy) {
        const look = enemy.look;
        const r = enemy.radius;
        const hop = Math.abs(Math.sin(enemy.phase));
        const lift = enemy.alive ? hop * enemy.hop : 0;
        const lunge = enemy.alive && enemy.attackT > 0 ? Math.sin(enemy.attackT * Math.PI) * 9 : 0;
        const death = enemy.alive ? 1 : Math.max(0, enemy.deathT / 0.45);
        let squash = 1.12 - hop * 0.26;
        if (!enemy.alive) {
            squash = 1.2 + (1 - death) * 0.85;
        }
        const bodyH = r * 1.72;

        ctx.save();
        ctx.translate(enemy.x + lunge * enemy.facing, -lift);
        ctx.globalAlpha = death;

        ctx.save();
        ctx.globalAlpha = 0.32 * death * (enemy.alive ? 1 - hop * 0.5 : 0.4);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * (enemy.alive ? 0.9 : 1.3), r * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        if (enemy.hitFlash > 0) {
            ctx.filter = "brightness(1.45)";
        }
        ctx.scale(squash, 1 / squash);

        const grad = ctx.createLinearGradient(-r, -bodyH, r * 0.4, 0);
        grad.addColorStop(0, look.shine);
        grad.addColorStop(0.42, look.body);
        grad.addColorStop(1, look.dark);
        ctx.fillStyle = grad;
        slimePath(ctx, r, bodyH);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.16)";
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.62)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.34, -bodyH * 0.64, r * 0.26, r * 0.14, -0.7, 0, Math.PI * 2);
        ctx.fill();

        const lookX = enemy.facing * r * 0.08;
        const eyeY = -bodyH * 0.48;
        const eyeR = r * 0.2;
        const squint = enemy.attackT > 0 && enemy.attackT < 0.5 ? 0.4 : 1;
        drawEye(ctx, -r * 0.28 + lookX, eyeY, eyeR, enemy.facing * eyeR * 0.5, look.eye, squint);
        drawEye(ctx, r * 0.28 + lookX, eyeY, eyeR, enemy.facing * eyeR * 0.5, look.eye, squint);

        ctx.lineCap = "round";
        ctx.strokeStyle = look.eye;
        ctx.lineWidth = Math.max(1.1, r * 0.07);
        ctx.beginPath();
        if (enemy.attackT > 0.5 && enemy.attackT < 0.92) {
            ctx.fillStyle = look.eye;
            ctx.ellipse(lookX, -bodyH * 0.28, r * 0.13, r * 0.11, 0, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.arc(lookX, -bodyH * 0.32, r * 0.22, 0.18 * Math.PI, 0.82 * Math.PI);
            ctx.stroke();
        }
        ctx.restore();
        ctx.filter = "none";
        ctx.restore();

        if (enemy.alive && enemy.hp < enemy.maxHp - 0.05) {
            const top = -lift - bodyH / squash - 8;
            drawHpBar(ctx, enemy.x, top, Math.max(26, r * 1.7), 5, enemy.hp / enemy.maxHp);
        }
    }

    // New draw styles plug in here. Unknown values fall back to the slime
    // so a half-finished catalog entry still shows up on the floor.
    function drawEnemy(ctx, enemy) {
        if (!enemy.look || enemy.look.draw === "slime") {
            drawSlime(ctx, enemy);
            return;
        }
        drawSlime(ctx, enemy);
    }

    function drawParticles(ctx, particles) {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            ctx.globalAlpha = Math.max(0, p.life / p.max);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawFloaters(ctx, floaters, scale) {
        ctx.textAlign = "center";
        ctx.font = "700 " + (14 / scale) + "px system-ui, sans-serif";
        ctx.lineWidth = 3 / scale;
        ctx.lineJoin = "round";
        for (let i = 0; i < floaters.length; i++) {
            const floater = floaters[i];
            ctx.globalAlpha = Math.max(0, Math.min(1, floater.life / 0.35));
            ctx.strokeStyle = "rgba(12, 6, 4, 0.9)";
            ctx.strokeText(floater.text, floater.x, floater.y);
            ctx.fillStyle = floater.color;
            ctx.fillText(floater.text, floater.x, floater.y);
        }
        ctx.globalAlpha = 1;
    }

    function drawBanner(ctx, view, banner) {
        if (!banner) {
            return;
        }
        const fade = Math.min(1, banner.life / 0.35);
        ctx.globalAlpha = Math.max(0, fade);
        ctx.textAlign = "center";
        const size = Math.max(22, Math.min(48, view.w * 0.07));
        ctx.font = "700 " + size + "px Georgia, Palatino, serif";
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillText(banner.text, view.w / 2 + 2, view.h * 0.34 + 2);
        ctx.fillStyle = "#ffd56a";
        ctx.fillText(banner.text, view.w / 2, view.h * 0.34);
        ctx.globalAlpha = 1;
    }

    function drawVignette(ctx, view) {
        const w = view.w;
        const h = view.h;
        const vignette = ctx.createRadialGradient(
            w / 2,
            h * 0.55,
            Math.min(w, h) * 0.28,
            w / 2,
            h * 0.5,
            Math.max(w, h) * 0.72
        );
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.42)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }

    Dungeon.drawFrame = function (ctx, view, sim) {
        const dpr = view.dpr || 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.clearRect(0, 0, view.w, view.h);

        ctx.save();
        if (sim.shake > 0) {
            const mag = sim.shake * 4;
            ctx.translate(Math.sin(sim.time * 46) * mag, Math.cos(sim.time * 33) * mag * 0.6);
        }

        drawBackdrop(ctx, view);

        const scale = view.scale;
        const originX = (view.w - view.worldW * scale) / 2;
        const groundY = view.h * 0.8;
        ctx.save();
        ctx.translate(originX, groundY);
        ctx.scale(scale, scale);

        drawArch(ctx);
        drawTunnel(ctx, view.worldW);
        drawTorch(ctx, 160, sim.time, 0);
        drawTorch(ctx, 280, sim.time, 1);
        drawTorch(ctx, 400, sim.time, 2);

        const enemies = sim.enemies;
        for (let i = 0; i < enemies.length; i++) {
            drawEnemy(ctx, enemies[i]);
        }
        drawPlayer(ctx, sim.player, sim.time);
        drawParticles(ctx, sim.particles);
        drawFloaters(ctx, sim.floaters, scale);

        ctx.restore();
        drawVignette(ctx, view);
        drawBanner(ctx, view, sim.banner);
        ctx.restore();
    };
})(window.Dungeon = window.Dungeon || {});
