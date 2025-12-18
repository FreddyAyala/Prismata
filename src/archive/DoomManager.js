import * as THREE from 'three';

// --- INLINED DEPENDENCIES TO FIX LOADING ISSUES ---

// STATIC VECTOR POOLING FOR PERFORMANCE
class GlitchEnemy {
    static tempDir = new THREE.Vector3();

    constructor(scene, position, target, type = 'normal') {
        this.scene = scene;
        this.target = target;
        this.type = type;
        this.active = true;

        // Base Stats
        this.life = 10;
        this.speed = 12;
        this.damage = 10;
        this.color = 0xff0000;
        this.scale = 6.0;

        // Specialized Variants
        if (type === 'scout') {
            this.life = 5;
            this.speed = 22;
            this.color = 0xffff00; // Yellow
            this.scale = 3.5;
        } else if (type === 'tank') {
            this.life = 50;
            this.speed = 7;
            this.damage = 50; // VERY DANGEROUS
            this.color = 0x660000; // Deep Red
            this.scale = 14.0;
        } else if (type === 'wraith') {
            this.life = 12;
            this.speed = 14;
            this.color = 0x00ffff; // Cyan/Ghostly
            this.scale = 5.0;
            this.isWraith = true; // Ignores player proximity
        }

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);

        // Demon Head Visuals
        const headGeo = new THREE.BoxGeometry(1, 1.2, 1);
        const mat = new THREE.MeshBasicMaterial({ color: this.color, wireframe: true, transparent: type === 'wraith', opacity: 0.6 });
        const head = new THREE.Mesh(headGeo, mat);
        this.mesh.add(head);

        // Horns
        const hornGeo = new THREE.ConeGeometry(0.2, 0.8, 8);
        const hornMat = new THREE.MeshBasicMaterial({ color: (type === 'tank' ? 0xff4400 : 0xffaa00) });

        const hornL = new THREE.Mesh(hornGeo, hornMat);
        hornL.position.set(-0.4, 0.8, 0);
        hornL.rotation.z = 0.3;
        this.mesh.add(hornL);

        const hornR = new THREE.Mesh(hornGeo, hornMat);
        hornR.position.set(0.4, 0.8, 0);
        hornR.rotation.z = -0.3;
        this.mesh.add(hornR);

        // Eyes
        const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const eyeMat = new THREE.MeshBasicMaterial({ color: (type === 'scout' ? 0xffffff : 0x00ff00) });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.25, 0.1, 0.5);
        this.mesh.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.25, 0.1, 0.5);
        this.mesh.add(eyeR);

        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.scene.add(this.mesh);
    }

    update(delta, playerPos) {
        if (!this.active) return 'remove';

        // TARGETING LOGIC
        let targetPos = this.target ? this.target.position : null;

        // Non-wraiths will hunt the player if they are close
        if (!this.isWraith && playerPos) {
            const distSq = this.mesh.position.distanceToSquared(playerPos);
            if (distSq < 2500) { // 50 units squared (Aggro Range UP)
                targetPos = playerPos;
            }
        }

        if (!targetPos) return 'remove';

        // VECTOR POOLING: REUSE STATIC VECTOR
        GlitchEnemy.tempDir.subVectors(targetPos, this.mesh.position).normalize();
        this.mesh.position.add(GlitchEnemy.tempDir.multiplyScalar(this.speed * delta));

        // Rotate
        this.mesh.rotation.y += delta * 5;

        // Attack Reach (Squared for performance)
        const attackDistSq = this.mesh.position.distanceToSquared(targetPos);
        if (attackDistSq < 16.0) { // 4.0 units squared
            return 'damage';
        }
        return 'move';
    }

    takeDamage(amount) {
        this.life -= amount;

        // Flash
        this.mesh.children.forEach(c => {
            if (c.material) {
                c.material.color.setHex(0xffffff);
                setTimeout(() => {
                    if (this.active && c.material) {
                        if (c.geometry.type === 'BoxGeometry' && c.position.y === 0) c.material.color.setHex(this.color);
                        else if (c.geometry.type === 'ConeGeometry') c.material.color.setHex(this.type === 'tank' ? 0xff4400 : 0xffaa00);
                        else c.material.color.setHex(this.type === 'scout' ? 0xffffff : 0x00ff00);
                    }
                }, 50);
            }
        });

        if (this.life <= 0) {
            this.active = false;
            this.scene.remove(this.mesh);
            this.mesh.children.forEach(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
            return true; // Dead
        }
        return false;
    }
}

class Weapon {
    constructor(name, cooldown, damage, color, type, maxAmmo = -1) {
        this.name = name;
        this.cooldown = cooldown;
        this.damage = damage;
        this.color = color;
        this.type = type; // 'hitscan', 'projectile', 'spread'
        this.ammo = maxAmmo;
        this.maxAmmo = maxAmmo;
        this.lastShot = 0;
    }
}

const WEAPONS = [
    new Weapon("BLASTER", 90, 1, 0x00ff00, 'hitscan', -1), // Infinite
    new Weapon("SHOTGUN", 1000, 1, 0xffaa00, 'spread', 12),
    new Weapon("LAUNCHER", 1500, 20, 0xff0000, 'projectile', 4)
];

// --- DOOM MANAGER ---

export class DoomManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.active = false;

        // Game State
        this.score = 0;
        this.wave = 1;
        this.playerHealth = 100; // New: Player HP
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.pickups = []; // New: Health pickups
        this.gameInterval = null;
        this.spawnInterval = null;
        this.pickupInterval = null;
        this.enemiesToSpawn = 0; // Wave Logic
        this.waveInProgress = false;
        this.lastHUDState = {}; // Performance: Track state to minimize DOM updates

        // Weapons
        this.weapons = WEAPONS;
        this.currentWeaponIdx = 0;
        this.weaponMesh = null;
        this.muzzleLight = null;
        this.weaponRecoil = 0;

        // Tools
        this.raycaster = new THREE.Raycaster();
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.noiseBuffer = this.createNoiseBuffer(); // NEW: Pre-generated noise
    }

    createNoiseBuffer() {
        if (!this.audioCtx) return null;
        const bufferSize = this.audioCtx.sampleRate * 2.0; // 2 seconds of noise
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    playNoise(duration, vol = 1.0, rate = 1.0, highpass = 0) {
        if (!this.audioCtx || !this.noiseBuffer) return;
        const src = this.audioCtx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.playbackRate.value = rate;

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        // Filter
        let dest = gain;
        if (highpass > 0) {
            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = highpass;
            src.connect(filter);
            filter.connect(gain);
        } else {
            src.connect(gain);
        }

        gain.connect(this.audioCtx.destination);
        src.start();
        src.stop(this.audioCtx.currentTime + duration);
    }

    activate() {
        if (this.active) return;
        if (this.cooldown && Date.now() < this.cooldown) return; // Cooldown check

        this.active = true;
        console.log("🛡️ DEFENSE MODE ACTIVATED - FORCING START");

        // UI Startup
        this.createHUD();
        this.createWeaponMesh();
        this.initModelHealthBars(); // NEW: Attach Health Bars

        // Input
        this.clickParams = { handler: (e) => this.shoot(e) };
        document.addEventListener('mousedown', this.clickParams.handler);

        this.keyParams = { handler: (e) => this.handleKeys(e) };
        window.addEventListener('keydown', this.keyParams.handler);

        // IMMEDIATE INSTRUCTIONS
        this.showInstructions();

        // Resume audio if possible
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().then(() => console.log("Audio Resumed")).catch(console.error);
        }
    }

    showInstructions() {
        // Fallback: Remove if exists
        const existing = document.getElementById('doom-instructions');
        if (existing) existing.remove();

        const hud = document.getElementById('doom-hud');
        if (!hud) this.createHUD();

        // 1. Force Unlock Pointer so mouse is visible/usable if they want
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        const container = document.getElementById('doom-hud');
        if (container) {
            container.innerHTML += `
                <div id="doom-instructions" style="position: absolute; top:0; left:0; width:100%; height:100%; 
                            background: rgba(0,0,0,0.9); display:flex; flex-direction:column; justify-content:center; align-items:center;
                            text-align: center; color: white; z-index: 5000; pointer-events: auto;">
                    <h1 style="font-size: 60px; color: #ff0033; text-shadow:0 0 20px red; font-family:'Orbitron', sans-serif;">PROTOCOL: FIREWALL</h1>
                    <p style="font-size: 18px; max-width: 800px; line-height: 1.4; font-family:'Orbitron', sans-serif; text-align: left;">
                        <span style="color:#ff0033; font-weight:bold; font-size:24px;">OBJECTIVE: DEFEND THE ARCHIVE</span><br>
                        Stop the Glitch demons from corrupting the AI Model Crystals.<br><br>

                        <span style="color:#00ff88; font-weight:bold;">WEAPONS & AMMO:</span><br>
                        • [1] BLASTER: Infinite Energy. Your reliable base defense.<br>
                        • [2] SHOTGUN: Devastating spread. Requires <span style="color:#ffaa00;">ORANGE SHELLS</span>.<br>
                        • [3] LAUNCHER: Heavy explosives. Requires <span style="color:#ff00ff;">PURPLE ROCKETS</span>.<br><br>

                        <span style="color:#00ffff; font-weight:bold;">RESOURCES:</span><br>
                        • <span style="color:#ffaa00; font-weight:bold;">ORANGE/PURPLE BOXES</span>: Dropped by enemies. Refills Ammo.<br>
                        • <span style="color:#00ff88; font-weight:bold;">GREEN CROSSES</span>: Medical Nanites. Restores 30% Health.<br><br>

                        <span style="color:#ff0033; font-weight:bold;">CONTROLS:</span> [MOUSE1] Fire | [1-3] Switch | [ESC] Exit<br><br>

                        <center><span style="color:#ffffff; font-weight:bold; font-size:24px;">PRESS [ENTER] TO INITIATE</span></center>
                    </p>
                    <button id="doom-start-btn" style="margin-top:20px; padding: 15px 30px; font-size: 24px;
                                border: 2px solid #ff0033; background: #330000; color: #ff0033; cursor: pointer; font-family: 'Orbitron', sans-serif;">
                        START SIMULATION
                    </button>
                </div>
            `;

            // Handler for Start
            const startGame = () => {
                const instr = document.getElementById('doom-instructions');
                if (instr) instr.remove();

                // Cleanup temporary listener
                window.removeEventListener('keydown', keyHandler);

                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                this.playMusic();
                this.startWave();
                this.startPickups(); // NEW: Start spawning health

                // Lock pointer again for gameplay
                document.body.requestPointerLock();
            };

            // Handler for Cancel
            const cancelGame = () => {
                const instr = document.getElementById('doom-instructions');
                if (instr) instr.remove();
                window.removeEventListener('keydown', keyHandler);
                this.deactivate();
            };

            // Keyboard Listener
            const keyHandler = (e) => {
                if (e.key === 'Enter') startGame();
                if (e.key === 'Escape') cancelGame();
            };
            window.addEventListener('keydown', keyHandler);

            // Button Click Listener
            const btn = document.getElementById('doom-start-btn');
            if (btn) btn.onclick = (e) => {
                e.stopPropagation();
                startGame();
            };
        }
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        console.log("🛡️ DEFENSE MODE DEACTIVATED");

        // Force Unlock Pointer IMMEDIATELY
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Standard Cleanup
        if (this.weaponMesh) { this.camera.remove(this.weaponMesh); this.weaponMesh = null; }
        if (this.clickParams) { document.removeEventListener('mousedown', this.clickParams.handler); this.clickParams = null; }
        if (this.keyParams) { window.removeEventListener('keydown', this.keyParams.handler); this.keyParams = null; }
        if (this.musicInterval) { clearInterval(this.musicInterval); this.musicInterval = null; }
        if (this.spawnInterval) { clearInterval(this.spawnInterval); this.spawnInterval = null; }
        if (this.pickupInterval) { clearInterval(this.pickupInterval); this.pickupInterval = null; }

        if (this.hud) { this.hud.remove(); this.hud = null; }
        this.lastHUDState = {};

        this.enemies.forEach(e => { if (e.active) this.scene.remove(e.mesh); });
        this.enemies = [];

        if (this.pickups) {
            this.pickups.forEach(p => { if (p.mesh) this.scene.remove(p.mesh); });
            this.pickups = [];
        }

        this.projectiles.forEach(p => {
            if (p.mesh) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
            }
        });
        this.projectiles = [];

        this.particles.forEach(p => {
            if (p.mesh) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
            }
        });
        this.particles = [];

        // Clean Crystal Health Bars
        if (this.crystals) {
            this.crystals.forEach(c => {
                if (c.sprite) c.mesh.remove(c.sprite);
            });
            this.crystals = [];
        }
    }

    startWave() {
        if (this.spawnInterval) clearInterval(this.spawnInterval);
        if (this.wave > 5) { this.triggerWin(); return; }

        this.waveInProgress = true;
        this.enemiesToSpawn = 10 + (this.wave * 5); // 15, 20, 25...

        console.log(`Starting Wave ${this.wave}, Enemies: ${this.enemiesToSpawn}`);
        const spawnRate = Math.max(500, 2500 - (this.wave * 300));

        // SHOW WAVE TITLE
        const hud = document.getElementById('doom-hud');
        if (hud) {
            const title = document.createElement('div');
            title.innerText = `WAVE ${this.wave}`;
            title.style.cssText = `position:absolute; top:30%; left:50%; transform:translate(-50%, -50%); 
                font-size:80px; color:#ff0033; font-weight:bold; text-shadow:0 0 20px red; opacity:0; transition:opacity 0.5s;`;
            hud.appendChild(title);
            setTimeout(() => title.style.opacity = 1, 100);
            setTimeout(() => { title.style.opacity = 0; setTimeout(() => title.remove(), 500); }, 3000);
        }

        this.spawnInterval = setInterval(() => {
            if (!this.active || this.isGameOver) return;
            if (this.enemiesToSpawn > 0) {
                if (this.enemies.length < 15) { // Max concurrent
                    this.spawnEnemy();
                }
            }
        }, spawnRate);

        this.updateHUD();
    }

    spawnEnemy() {
        if (this.enemiesToSpawn <= 0) return;

        // 1. Get ALL valid targets
        const targets = [];
        this.scene.traverse(obj => {
            if (obj.isPoints && obj.visible) {
                if (obj.userData.health === undefined) obj.userData.health = 100;
                targets.push(obj);
            }
        });

        if (targets.length === 0) {
            this.triggerGameOver();
            return;
        }

        const target = targets[Math.floor(Math.random() * targets.length)];

        // 2. Decide TYPE based on Wave
        let type = 'normal';
        const roll = Math.random();
        if (this.wave >= 2 && roll < 0.3) type = 'scout';
        if (this.wave >= 3 && roll < 0.15) type = 'tank';
        if (this.wave >= 4 && roll < 0.1) type = 'wraith';

        // 3. Spawning relative to player
        const angle = Math.random() * Math.PI * 2;
        const radius = 60 + Math.random() * 40;
        const spawnX = this.camera.position.x + Math.cos(angle) * radius;
        const spawnZ = this.camera.position.z + Math.sin(angle) * radius;

        const enemy = new GlitchEnemy(this.scene, new THREE.Vector3(spawnX, 4, spawnZ), target, type);

        const multiplier = 1 + (this.wave - 1) * 0.15;
        enemy.life *= multiplier;
        enemy.speed *= (1 + (this.wave - 1) * 0.1);

        this.enemies.push(enemy);
        this.enemiesToSpawn--;
        this.updateHUD();
    }

    spawnDrop(pos) {
        const roll = Math.random();
        if (roll > 0.4) return; // 40% chance for ANY drop

        let type = 'ammo_shotgun';
        let color = 0xffaa00; // Orange
        if (Math.random() > 0.7) {
            type = 'ammo_launcher';
            color = 0xff00ff; // Purple/Magenta
        }

        const geo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
        const mat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.position.y = 2.0;
        this.scene.add(mesh);

        // Solid core
        const core = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: color }));
        mesh.add(core);

        this.pickups.push({ mesh, type: type });
    }

    startPickups() {
        if (this.pickupInterval) clearInterval(this.pickupInterval);
        this.pickupInterval = setInterval(() => {
            if (!this.active || this.isGameOver) return;
            this.spawnHealthPickup();
        }, 20000); // Every 20 seconds
    }

    spawnHealthPickup() {
        const radius = 20 + Math.random() * 40;
        const angle = Math.random() * Math.PI * 2;
        const x = this.camera.position.x + Math.cos(angle) * radius;
        const z = this.camera.position.z + Math.sin(angle) * radius;

        const geo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true, transparent: true, opacity: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 2.5, z);
        this.scene.add(mesh);

        // HEALTH CROSS VISUAL
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
        mesh.add(crossH);
        mesh.add(crossV);

        this.pickups.push({ mesh, type: 'health', value: 30 });
    }

    triggerGameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        const hud = document.getElementById('doom-hud');
        if (hud) {
            hud.innerHTML += `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            font-size: 80px; color: red; text-align: center; text-shadow: 0 0 20px red; pointer-events:none;">
                    GAME OVER<br>
                    <span style="font-size: 30px; color: white;">PRESS 'R' TO RESTART</span>
                </div>
            `;
        }
        this.playSound(100, 'sawtooth', 2.0, 1.0);
    }

    triggerWin() {
        this.isGameOver = true;
        const hud = document.getElementById('doom-hud');
        if (hud) {
            hud.innerHTML += `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                            font-size: 80px; color: #00ff00; text-align: center; text-shadow: 0 0 20px lime; pointer-events:none;">
                    ARCHIVE SECURED<br>
                    <span style="font-size: 30px; color: white;">SIMULATION COMPLETE</span><br>
                    <span style="font-size: 20px; color: #aaaaaa;">PRESS 'R' TO PLAY AGAIN</span>
                </div>
            `;
        }
        this.playSound(400, 'sine', 0.5, 0.5);
        this.playSound(600, 'sine', 0.5, 0.5);
    }

    resetGame() {
        this.isGameOver = false;
        this.score = 0;
        this.wave = 1;
        this.playerHealth = 100;
        this.scene.traverse(obj => {
            if (obj.isPoints) {
                obj.visible = true;
                obj.userData.health = 100;
                if (obj.material) obj.material.color.setHex(0x00f3ff);
            }
        });
        this.enemies.forEach(e => { this.scene.remove(e.mesh); e.active = false; });
        this.enemies = [];
        this.pickups.forEach(p => { this.scene.remove(p.mesh); });
        this.pickups = [];

        if (this.hud) this.hud.remove();
        this.createHUD();
        this.updateHUD();
        this.initModelHealthBars(); // Re-initialize bars on reset
        this.playMusic();
        this.startWave();
        this.startPickups();
    }

    update(delta) {
        if (!this.active || this.isGameOver) return;

        // AUTO-RESUME AUDIO
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        // WAVE CHECK
        if (this.waveInProgress && this.enemiesToSpawn === 0 && this.enemies.length === 0) {
            this.waveInProgress = false;
            console.log("Wave Complete!");
            this.wave++;
            this.playSound(600, 'sine', 1.0, 0.5);
            setTimeout(() => this.startWave(), 3000); // 3s Intermission
        }

        this.updateModelHealthBars(); // NEW: Update Crystal Health

        try {
            // ... (rest of update)
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                const result = e.update(delta, this.camera.position);

                // PLAYER DAMAGE CHECK (Squared for performance)
                const distToPlayerSq = e.mesh.position.distanceToSquared(this.camera.position);
                if (distToPlayerSq < 16.0) { // 4.0 units squared
                    this.playerHealth -= e.damage * delta * 2; // Scaled damage
                    if (Math.random() < 0.05) this.playSound(80, 'square', 0.1, 0.2); // Pain sound
                    if (this.playerHealth <= 0) { this.triggerGameOver(); return; }
                    this.updateHUD();
                }

                if (result === 'damage') {
                    this.createExplosion(e.mesh.position, 0x00ffff, true);
                    if (e.target) {
                        e.target.userData.health -= 20;
                        if (e.target.material) {
                            e.target.material.color.setHex(0xff0000);
                            setTimeout(() => { if (e.target.material) e.target.material.color.setHex(0x00f3ff); }, 100);
                        }
                        if (e.target.userData.health <= 0) {
                            e.target.visible = false;
                            this.playSound(200, 'sawtooth', 0.5, 0.5);
                        } else {
                            this.playSound(100, 'square', 0.1, 0.3);
                        }
                    }
                    e.takeDamage(999);
                }

                // DEAD ENEMY LOGIC (DROPS)
                if (!e.active) {
                    if (e.life <= 0) {
                        this.spawnDrop(e.mesh.position);
                    }
                    this.enemies.splice(i, 1);
                }
            }

            // Pickups
            for (let i = this.pickups.length - 1; i >= 0; i--) {
                const p = this.pickups[i];
                p.mesh.rotation.y += delta * 2;
                p.mesh.position.y = 1 + Math.sin(Date.now() * 0.005) * 0.5;

                // 2D Distance Check (ignores height differences)
                const dx = p.mesh.position.x - this.camera.position.x;
                const dz = p.mesh.position.z - this.camera.position.z;
                const dist2D = Math.sqrt(dx * dx + dz * dz);

                if (dist2D < 10.0) {
                    if (p.type === 'health') {
                        this.playerHealth = Math.min(100, this.playerHealth + p.value);
                        this.playSound(600, 'sine', 0.3, 0.4);
                    } else if (p.type === 'ammo_shotgun') {
                        const w = this.weapons.find(nw => nw.name === "SHOTGUN");
                        if (w) {
                            w.ammo = Math.min(w.maxAmmo, w.ammo + 8); // Increased ammo reward
                            this.playSound(400, 'sine', 0.1, 0.2);
                        }
                    } else if (p.type === 'ammo_launcher') {
                        const w = this.weapons.find(nw => nw.name === "LAUNCHER");
                        if (w) {
                            w.ammo = Math.min(w.maxAmmo, w.ammo + 2); // Increased ammo reward
                            this.playSound(300, 'sine', 0.1, 0.2);
                        }
                    }
                    this.scene.remove(p.mesh);
                    this.pickups.splice(i, 1);
                    this.updateHUD();
                }
            }

            this.updateProjectiles(delta);
            this.updateParticles(delta);

            // Recoil
            if (this.weaponMesh && this.weaponRecoil > 0) {
                this.weaponMesh.position.z += this.weaponRecoil * delta * 5;
                this.weaponRecoil -= delta * 2;
                if (this.weaponRecoil < 0) this.weaponRecoil = 0;
                this.weaponMesh.position.z = Math.min(-0.6 + this.weaponRecoil, -0.4);
            }
        } catch (err) {
            console.error("DoomManager Update Error:", err);
        }
    }

    shoot() {
        if (!this.active || this.isGameOver) return;
        const w = this.weapons[this.currentWeaponIdx];

        // AMMO CHECK
        if (w.ammo !== -1 && w.ammo <= 0) {
            this.playSound(200, 'sine', 0.05, 0.1); // Dry fire click
            return;
        }

        const now = Date.now();
        if (now - w.lastShot < w.cooldown) return;
        w.lastShot = now;

        // CONSUME AMMO
        if (w.ammo !== -1) w.ammo--;
        this.updateHUD();

        this.weaponRecoil = 0.2;
        this.muzzleLight.intensity = 5;
        setTimeout(() => { if (this.muzzleLight) this.muzzleLight.intensity = 0; }, 50);

        // Sounds
        this.playWeaponSound(w.name);

        if (w.type === 'hitscan') {
            this.fireHitscan(w);
        } else if (w.type === 'spread') {
            this.fireHitscan(w, 0);
            for (let i = 0; i < 14; i++) {
                this.fireHitscan(w, 0.15);
            }
        } else if (w.type === 'projectile') {
            this.fireProjectile(w);
        }
    }

    fireHitscan(weapon, spread = 0) {
        this.raycaster.setFromCamera(new THREE.Vector2(
            (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread
        ), this.camera);

        const enemyMeshes = this.enemies.map(e => e.mesh);
        const intersections = this.raycaster.intersectObjects(enemyMeshes, true);

        let hitPoint = null;

        if (intersections.length > 0) {
            const hit = intersections[0];
            hitPoint = hit.point;

            let curr = hit.object;
            while (curr && !enemyMeshes.includes(curr)) {
                curr = curr.parent;
            }

            if (curr) {
                const enemy = this.enemies.find(e => e.mesh === curr);
                if (enemy) {
                    this.createExplosion(hit.point, 0x00ff00, false);
                    if (enemy.takeDamage(weapon.damage)) {
                        this.score += 100;
                        this.updateHUD();
                        this.createExplosion(enemy.mesh.position, 0xff0000, true);
                    }
                }
            }
        }
        this.createTracer(hitPoint, weapon.color);
    }

    fireProjectile(weapon) {
        const start = this.weaponMesh.position.clone().add(new THREE.Vector3(0, 0, -1));
        start.applyMatrix4(this.camera.matrixWorld);
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);

        const geo = new THREE.IcosahedronGeometry(0.5, 0);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);

        this.scene.add(mesh);
        this.projectiles.push({
            mesh,
            velocity: forward.multiplyScalar(80), // FASTER (was 30)
            life: 5.0,
            damage: weapon.damage,
            isRocket: true
        });
    }

    updateProjectiles(delta) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (p.mesh) {
                p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
                p.life -= delta;

                if (p.isRocket) {
                    p.mesh.rotation.x += delta * 5;
                    p.mesh.rotation.z += delta * 2;

                    // ROCKET COLLISION CHECK
                    let hit = false;
                    for (const enemy of this.enemies) {
                        if (p.mesh.position.distanceTo(enemy.mesh.position) < 3.0) {
                            hit = true;
                            break;
                        }
                    }
                    if (p.mesh.position.y < 0.5) hit = true;

                    if (hit) {
                        p.life = 0; // Trigger explosion
                        // SPLASH DAMAGE Logic
                        this.enemies.forEach(enemy => {
                            const dist = enemy.mesh.position.distanceTo(p.mesh.position);
                            if (dist < 10.0) {
                                enemy.takeDamage(p.damage);
                                if (enemy.life <= 0) {
                                    this.score += 100;
                                    this.updateHUD();
                                }
                            }
                        });
                    }
                }

                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    if (p.mesh.geometry) p.mesh.geometry.dispose();
                    if (p.mesh.material) p.mesh.material.dispose();

                    if (p.isRocket) {
                        this.createExplosion(p.mesh.position, 0xff4400, true);
                        // ROCKET IMPACT: Boom!
                        this.playSound(50, 'square', 0.5, 0.8);
                        this.playNoise(0.5, 1.0, 0.4); // Deep rumble noise
                    }
                    this.projectiles.splice(i, 1);
                }
            } else {
                this.projectiles.splice(i, 1);
            }
        }
    }

    createTracer(hitPoint, color) {
        const target = hitPoint || this.camera.position.clone().add(new THREE.Vector3(0, 0, -100).applyQuaternion(this.camera.quaternion));
        const start = this.weaponMesh.position.clone().add(new THREE.Vector3(0, -0.1, -0.5));
        start.applyMatrix4(this.camera.matrixWorld);

        const dist = start.distanceTo(target);
        const geo = new THREE.BoxGeometry(0.05, 0.05, dist);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start).lerp(target, 0.5);
        mesh.lookAt(target);
        this.scene.add(mesh);
        this.projectiles.push({ mesh, velocity: new THREE.Vector3(), life: 0.1 });
    }

    createExplosion(pos, color, isBig = false, life = null) {
        // HUGE EXPLOSION for Rockets
        const count = isBig ? 100 : 15;
        const spread = isBig ? 8.0 : 0.5; // MUCH BIGGER SPREAD (was 3.0)

        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
            velocities.push({
                x: (Math.random() - 0.5) * 10 * spread,
                y: (Math.random() - 0.5) * 10 * spread + (isBig ? 5 : 0),
                z: (Math.random() - 0.5) * 10 * spread
            });
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
            color, size: isBig ? 1.5 : 0.3, transparent: true, blending: THREE.AdditiveBlending
        });
        const ps = new THREE.Points(geo, mat);
        this.scene.add(ps);
        this.particles.push({ mesh: ps, velocities, life: life !== null ? life : (isBig ? 1.5 : 0.5) });
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            const pos = p.mesh.geometry.attributes.position.array;
            for (let j = 0; j < p.velocities.length; j++) {
                pos[j * 3] += p.velocities[j].x * delta;
                pos[j * 3 + 1] += p.velocities[j].y * delta;
                pos[j * 3 + 2] += p.velocities[j].z * delta;
            }
            p.mesh.geometry.attributes.position.needsUpdate = true;
            p.life -= delta;
            p.mesh.material.opacity = p.life;
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                if (p.mesh.geometry) p.mesh.geometry.dispose();
                if (p.mesh.material) p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }

    playSound(freq, type, duration, vol, detune = 0) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        if (detune) o.detune.setValueAtTime(detune, this.audioCtx.currentTime);

        g.gain.setValueAtTime(vol, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

        o.connect(g);
        g.connect(this.audioCtx.destination);
        o.start();
        o.stop(this.audioCtx.currentTime + duration);
    }

    playWeaponSound(type) {
        if (!this.audioCtx) return;

        if (type === 'BLASTER') {
            this.playSound(800, 'sine', 0.1, 0.3);
            this.playSound(400, 'sawtooth', 0.05, 0.1);
        } else if (type === 'SHOTGUN') {
            // DOOM SHOTGUN: Boom + Snap + Rack
            // 1. The Blast (Low Pulse)
            this.playSound(60, 'square', 0.3, 0.6);
            this.playSound(100, 'sawtooth', 0.2, 0.4, -1200);

            // 2. The Snap (High Noise)
            this.playNoise(0.3, 0.8, 1.5, 500); // Fast, high-pitch noise

            // 3. The Rack (Mechanical Click) - Delayed
            setTimeout(() => {
                this.playNoise(0.1, 0.4, 2.0, 1000); // Click 1
                setTimeout(() => this.playNoise(0.15, 0.3, 1.2, 200), 150); // Clunk 2
            }, 500);
        } else if (type === 'LAUNCHER') {
            // ROCKET LAUNCH: Whoosh + Thump
            this.playSound(50, 'triangle', 0.5, 0.6); // Thump
            this.playNoise(0.6, 0.5, 0.5, 200); // Whoosh drag

            // Sliding whistle
            const osc = this.audioCtx.createOscillator();
            const g = this.audioCtx.createGain();
            osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.5);
            g.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
            g.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.5);
            osc.connect(g);
            g.connect(this.audioCtx.destination);
            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.5);
        }
    }


    playMusic() {
        if (!this.audioCtx) return;
        if (this.musicInterval) clearInterval(this.musicInterval);

        let noteIdx = 0;
        const notes = [
            110, 110, 220, 110, 110, 196, 110, 110, 185, 110, 110, 174, 110, 110, 164, 155
        ];

        const playNote = () => {
            if (!this.active || this.isGameOver) return;

            const freq = notes[noteIdx];
            noteIdx = (noteIdx + 1) % notes.length;

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

            const filter = this.audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;

            gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.15);
        };

        this.musicInterval = setInterval(playNote, 150);
    }

    createHUD() {
        if (document.getElementById('doom-hud')) return;

        this.hud = document.createElement('div');
        this.hud.id = 'doom-hud';
        this.hud.style.position = 'absolute';
        this.hud.style.bottom = '20px';
        this.hud.style.left = '20px';
        this.hud.style.width = '100vw'; // Viewport width
        this.hud.style.height = '100vh'; // Viewport height
        this.hud.style.pointerEvents = 'none';
        this.hud.style.color = '#ff0033';
        this.hud.style.fontFamily = "'Orbitron', sans-serif";
        this.hud.style.fontSize = '24px';
        this.hud.style.textShadow = '0 0 10px #ff0000';
        this.hud.style.zIndex = '4000'; // HIGHER THAN ARCHIVE CONTAINER (3000)

        this.hud.innerHTML = `
            <div style="position:absolute; bottom:20px; left:20px; pointer-events:none;">
                <div style="font-size:32px; color:#00ff88; margin-bottom:10px;">HP: <span id="doom-hp">100</span></div>
                <div>SCORE: <span id="doom-score">0</span></div>
                <div>WAVE: <span id="doom-wave">1</span>/5</div>
                <div style="margin-top:10px; font-size:18px;">WEAPON: <span id="doom-weapon">BLASTER</span></div>
            </div>
        `;
        document.body.appendChild(this.hud);
    }

    updateHUD() {
        if (!this.hud) return;
        const w = this.weapons[this.currentWeaponIdx];
        const hp = Math.ceil(this.playerHealth);
        const score = this.score;
        const wave = this.wave;
        const weaponName = w.name;
        const ammo = w.ammo;

        // PERFORMANCE: ONLY UPDATE CHANGED ELEMENTS
        if (this.lastHUDState.hp !== hp) {
            const el = document.getElementById('doom-hp');
            if (el) {
                el.innerText = hp;
                el.style.color = hp < 30 ? '#ff0000' : '#00ff88';
            }
            this.lastHUDState.hp = hp;
        }

        if (this.lastHUDState.score !== score) {
            const el = document.getElementById('doom-score');
            if (el) el.innerText = score;
            this.lastHUDState.score = score;
        }

        if (this.lastHUDState.wave !== wave) {
            const el = document.getElementById('doom-wave');
            if (el) el.innerText = `${wave}/5`;
            this.lastHUDState.wave = wave;
        }

        // Enemies Left
        const left = this.enemies.length + this.enemiesToSpawn;
        if (this.lastHUDState.left !== left) {
            const el = document.getElementById('doom-left');
            if (el) el.innerText = left;
            else if (this.hud) {
                // Inject if missing (lazy init)
                const div = document.createElement('div');
                div.innerHTML = `ENEMIES: <span id="doom-left">${left}</span>`;
                this.hud.children[0].appendChild(div);
            }
            this.lastHUDState.left = left;
        }

        const ammoStr = ammo === -1 ? "∞" : ammo;
        const stateStr = `${weaponName}_${ammoStr}`;
        if (this.lastHUDState.weaponState !== stateStr) {
            const el = document.getElementById('doom-weapon');
            if (el) {
                el.innerText = `${weaponName} [${ammoStr}]`;
                el.style.color = '#' + new THREE.Color(w.color).getHexString();
            }
            this.lastHUDState.weaponState = stateStr;
        }
    }

    // Removed second shoot method


    createWeaponMesh() {
        if (this.weaponMesh) this.camera.remove(this.weaponMesh);

        this.weaponMesh = new THREE.Group();
        this.weaponMesh.position.set(0.3, -0.3, -0.6);
        this.camera.add(this.weaponMesh);

        // 1. Blaster Mesh
        this.blasterMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.3, 0.8),
            new THREE.MeshBasicMaterial({ color: 0x33ff33, wireframe: true })
        );
        this.weaponMesh.add(this.blasterMesh);

        // 2. Shotgun Mesh 
        this.shotgunMesh = new THREE.Group();
        const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.1, 0, 0);
        const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.1, 0, 0);
        this.shotgunMesh.add(barrelL, barrelR);
        this.weaponMesh.add(this.shotgunMesh);

        // 3. Launcher Mesh 
        this.launcherMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.15, 0.2, 1.0, 8),
            new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        this.launcherMesh.rotation.x = Math.PI / 2;
        this.weaponMesh.add(this.launcherMesh);

        this.muzzleLight = new THREE.PointLight(0xffffff, 0, 5);
        this.muzzleLight.position.set(0, 0, -1.0);
        this.weaponMesh.add(this.muzzleLight);

        this.updateWeaponVisuals();
    }

    updateWeaponVisuals() {
        if (!this.weaponMesh) return;
        const w = this.weapons[this.currentWeaponIdx];
        this.blasterMesh.visible = (w.name === "BLASTER");
        this.shotgunMesh.visible = (w.name === "SHOTGUN");
        this.launcherMesh.visible = (w.name === "LAUNCHER");
        this.muzzleLight.color.setHex(w.color);
    }

    initModelHealthBars() {
        this.crystals = [];
        this.scene.traverse(obj => {
            if (obj.isPoints && obj.visible) {
                if (obj.userData.health === undefined) obj.userData.health = 100;

                // Remove old bar if exists
                const oldBar = obj.getObjectByName('healthBar');
                if (oldBar) obj.remove(oldBar);

                // Create Sprite Bar
                const canvas = document.createElement('canvas'); // Create once? No, unique per crystal for potential future optimization, but actually they can share texture? 
                // Actually distinct textures are needed if we want distinct healths without uniforms. CanvasTexture is easy.
                canvas.width = 64; canvas.height = 8;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(0, 0, 64, 8);

                const tex = new THREE.CanvasTexture(canvas);
                const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
                const sprite = new THREE.Sprite(mat);
                sprite.name = 'healthBar';
                sprite.scale.set(10, 1.25, 1);
                sprite.position.y = 8; // Above model
                obj.add(sprite);

                this.crystals.push({ mesh: obj, sprite: sprite, tex: tex, ctx: ctx, canvas: canvas });
            }
        });
    }

    updateModelHealthBars() {
        if (!this.crystals) return;

        this.crystals.forEach(c => {
            const hp = c.mesh.userData.health;
            if (hp < 100) {
                // Redraw texture if HP changed
                // Optimization: Only redraw if dirty? For now, redraw every frame is fine for < 10 items.
                // Actually lets check against lastHp if we can, but storing lastHp on object is cleaner.
                if (c.lastHp !== hp) {
                    const width = Math.max(0, (hp / 100) * 64);
                    c.ctx.clearRect(0, 0, 64, 8);
                    c.ctx.fillStyle = '#330000'; // Background
                    c.ctx.fillRect(0, 0, 64, 8);
                    c.ctx.fillStyle = hp < 30 ? '#ff0000' : '#00ff00';
                    c.ctx.fillRect(0, 0, width, 8);
                    c.tex.needsUpdate = true;
                    c.lastHp = hp;
                    c.sprite.visible = true;
                }
            } else {
                c.sprite.visible = false; // Hide if full health
            }
        });
    }

    handleKeys(e) {
        if (this.isGameOver && e.key.toLowerCase() === 'r') {
            this.resetGame();
            return;
        }

        // ESCAPE TO EXIT
        if (e.key === 'Escape') {
            this.deactivate();
            this.cooldown = Date.now() + 3000; // 3 second cooldown to prevent re-trigger on pad
            return;
        }

        if (e.key === '1') this.currentWeaponIdx = 0;
        if (e.key === '2') this.currentWeaponIdx = 1;
        if (e.key === '3') this.currentWeaponIdx = 2;
        this.updateWeaponVisuals();
        this.updateHUD();
    }
}
