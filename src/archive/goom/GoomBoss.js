import * as THREE from 'three';

export class GlitchBoss {
    constructor(scene, position, target, onShoot = null) {
        this.scene = scene;
        this.target = target;
        this.onShoot = onShoot;
        this.shootTimer = 0;
        this.active = true;
        this.isBoss = true;

        // Boss Stats - MASSIVE HEALTH (Tuned Down)
        this.life = 8000;
        this.maxLife = 8000;
        this.speed = 4.0;
        this.damage = 25; // Nerfed from 40 (was 100)
        this.scale = 20.0;
        this.phase = 1; // 1, 2, 3, 4
        this.spawnTimer = 0;
        this.lastDamageTime = 0;

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);
        this.mesh.position.y = 10; // Start high

        // --- VISUALS: THE AI BUBBLE ---
        // 1. The Bubble (Outer Shell) - Tougher looking
        const bubbleGeo = new THREE.SphereGeometry(1.5, 32, 32);
        const bubbleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        this.bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
        this.mesh.add(this.bubble);

        // 2. The Core (Inner Data)
        const coreGeo = new THREE.IcosahedronGeometry(0.8, 2);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.mesh.add(this.core);

        // 3. Floating Data Packets (GPUs) - Orbiting Cubes (More & Lower)
        this.chunks = [];
        this.activeWeakPoints = [];
        for (let i = 0; i < 24; i++) { // Increased to 24
            const chunk = new THREE.Mesh(
                new THREE.BoxGeometry(0.6, 0.6, 0.6), // CUBES (Easier to hit)
                new THREE.MeshStandardMaterial({
                    color: 0x6688aa, // Steel Blue (Brighter)
                    emissive: 0x112233, // Faint Glow
                    wireframe: false,
                    roughness: 0.2,
                    metalness: 0.5
                })
            );

            // Orbiting Init
            const angle = Math.random() * Math.PI * 2;
            // Radius 1.6 (Just outside 1.5 bubble)
            const r = 1.6 + Math.random() * 0.2;
            // Bias Y towards center (Equator): -1.2 to +1.2
            const y = (Math.random() - 0.5) * 2.4;

            chunk.position.set(
                Math.cos(angle) * r,
                y,
                Math.sin(angle) * r
            );
            chunk.lookAt(0, 0, 0); // Face inward

            this.mesh.add(chunk);
            this.chunks.push({
                mesh: chunk,
                angle: angle,
                radius: r,
                y: y,
                orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5)
            });
        }

        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.scene.add(this.mesh);

        // Start Weak Point Cycle
        this.cycleTimer = 0;
        this.cycleWeakPoint();
    }

    createWeakPoints() {
        // Deprecated: Using existing chunks as weak points
    }

    cycleWeakPoint() {
        // Reset all to Blue (Shielded)
        this.chunks.forEach(c => {
            if (c.mesh && c.mesh.material && c.mesh.material.color) {
                c.mesh.material.color.setHex(0x6688aa); // Steel Blue (Visible)
                if (c.mesh.material.emissive) c.mesh.material.emissive.setHex(0x112233); // Faint Glow
            }
        });
        this.activeWeakPoints = [];

        // Pick Random GPUs to Overheat (Vulnerable) based on Phase
        // Increases with phase: 5, 7, 9, 12
        const count = 3 + (this.phase * 2) + (this.phase >= 4 ? 2 : 0);

        if (this.chunks.length > 0) {
            const indices = new Set();
            while (indices.size < count && indices.size < this.chunks.length) {
                indices.add(Math.floor(Math.random() * this.chunks.length));
            }

            indices.forEach(idx => {
                const chunk = this.chunks[idx];
                if (chunk && chunk.mesh && chunk.mesh.material && chunk.mesh.material.color) {
                    chunk.mesh.material.color.setHex(0xffff00); // GOLD = VULNERABLE
                    if (chunk.mesh.material.emissive) {
                        chunk.mesh.material.emissive.setHex(0xffff00);
                        chunk.mesh.material.emissiveIntensity = 3.0; // GLOW
                    }
                    this.activeWeakPoints.push(chunk);
                }
            });
        }
    }

    spawnDollarSign(pos) {
        if (!GlitchBoss.dollarMat) {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128; // Higher res
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#00ff00';
            ctx.font = 'bold 100px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 64, 64);
            const tex = new THREE.CanvasTexture(canvas);
            GlitchBoss.dollarMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        }

        const s = new THREE.Sprite(GlitchBoss.dollarMat);
        const worldPos = new THREE.Vector3();
        pos.getWorldPosition(worldPos);
        s.position.copy(worldPos);
        // Random spread
        s.position.add(new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5));
        s.scale.set(20, 20, 1); // HUGE DOLLAR SIGNS
        this.scene.add(s);

        if (!this.effects) this.effects = [];
        this.effects.push({ mesh: s, life: 2.0, vel: new THREE.Vector3(0, 25, 0) });
    }

    updatePhase() {
        const pct = this.life / this.maxLife;
        const oldPhase = this.phase;

        if (pct < 0.25) this.phase = 4;
        else if (pct < 0.50) this.phase = 3;
        else if (pct < 0.75) this.phase = 2;
        else this.phase = 1;

        if (this.phase !== oldPhase) {
            console.log(`BOSS PHASE CHANGE: ${this.phase}`);
            // Phase Change AOE Knockback or Spawn
            // NERFED: 2, 2, 3, 4 minions (instead of 2, 4, 6, 8)
            const minions = Math.max(2, this.phase);
            this.spawnMinionWave(minions);
            this.cycleWeakPoint(); // Immediate cycle

            // Visual Flare
            this.bubble.scale.set(1.5, 1.5, 1.5); // Pulse
        }
    }

    spawnMinionWave(count) {
        if (!this.scene.userData.game) return;
        const game = this.scene.userData.game;
        console.log(`SPAWNING MINION WAVE: ${count}`);

        // Use Game's spawn logic if possible, or manual
        // We need 'tank' or 'scout'
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 20;
            const pos = new THREE.Vector3(
                this.mesh.position.x + Math.cos(angle) * dist,
                5,
                this.mesh.position.z + Math.sin(angle) * dist
            );

            // Random Type: mostly Scouts in P2, Tanks in P3/4
            let type = 'scout'; // GROWTH HACKER
            if (this.phase > 2 && Math.random() > 0.5) type = 'tank'; // VC WHALE
            if (this.phase > 3 && Math.random() > 0.7) type = 'berzerker'; // 10X DEV

            game.spawnEnemy(type, pos);

            // Teleport Effect
            game.systems.createTeleportEffect(pos);
        }
    }



    update(delta, playerPos) {
        if (!this.active) return 'remove';

        // DEATH SEQUENCE
        if (this.isDying) {
            this.deathTimer += delta;

            // Shake violently (Increased Intensity)
            this.mesh.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0,
                (Math.random() - 0.5) * 2.0
            ));

            // Death Spin
            this.mesh.rotation.x += delta * 5.0;
            this.mesh.rotation.y += delta * 10.0;

            // Implosion/Expansion wobble (Expand over time)
            // Starts at roughly 1.0, expands to 3.0 before popping
            const progress = this.deathTimer / this.deathDuration;
            const wobble = (1.0 + progress * 2.0) + Math.sin(this.deathTimer * 20.0) * (0.2 * progress);
            this.mesh.scale.setScalar(wobble);

            // Explosions
            if (Math.random() < 0.4) { // More frequent (50% per frame is A LOT, maybe too much? Frame rate dependent. Let's assume 60fps)
                // Actually 0.5 per frame is insane. Let's do 0.2 but bigger explosions
                if (this.scene.userData.game && this.scene.userData.game.systems) {
                    const offset = new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
                    this.scene.userData.game.systems.createExplosion(this.mesh.position.clone().add(offset), 0xff0000, true, 5.0);
                    const pitch = 50 + Math.random() * 100;
                    this.scene.userData.game.audio.playSound(pitch, 'sawtooth', 1.0, 0.5);
                }
            }

            if (this.deathTimer > this.deathDuration) {
                // Finale
                if (this.scene.userData.game && this.scene.userData.game.systems) {
                    this.scene.userData.game.systems.createExplosion(this.mesh.position, 0xffffff, true, 50.0); // NUKE
                }
                this.active = false;
                this.scene.remove(this.mesh); // Bye bye
                return 'dead'; // Trigger Victory
            }
            return 'dying'; // Boss is dying, ignore other logic
        }

        this.updatePhase();

        // Weak Point Cycling Speed depends on Phase
        const cycleTime = 12.0 - (this.phase * 2.0); // Gave more time 
        this.cycleTimer += delta;
        if (this.cycleTimer > cycleTime) { 
            this.cycleTimer = 0;
            this.cycleWeakPoint();
        }

        // Visual Animation
        const rotSpeed = 0.2 * this.phase;
        this.bubble.rotation.y += delta * rotSpeed;

        // Pulse Effect
        const pulse = 1.0 + Math.sin(Date.now() * 0.002 * this.phase) * (0.05 * this.phase);
        this.bubble.scale.setScalar(pulse);

        this.core.rotation.x -= delta * this.phase;
        this.core.rotation.y -= delta * this.phase;

        this.chunks.forEach((c) => {
            // Orbit logic
            c.angle += delta * c.orbitSpeed * this.phase; // Faster in later phases
            c.mesh.position.x = Math.cos(c.angle) * c.radius;
            c.mesh.position.z = Math.sin(c.angle) * c.radius;
            c.mesh.position.y = c.y + Math.sin(Date.now() * 0.001 + c.angle) * 0.5; // Bobbing

            c.mesh.lookAt(0, 0, 0); // Always face center
            c.mesh.rotation.z += delta * 2.0; // Spin self
        });

        // Effects Update
        if (this.effects) {
            for (let i = this.effects.length - 1; i >= 0; i--) {
                const e = this.effects[i];
                e.mesh.position.add(e.vel.clone().multiplyScalar(delta));
                e.life -= delta;
                e.mesh.material.opacity = e.life;
                if (e.life <= 0) {
                    this.scene.remove(e.mesh);
                    this.effects.splice(i, 1);
                }
            }
        }

        // AI Logic - Planar Pursuit with Hover
        const targetPos = playerPos; 
        const distSq = this.mesh.position.distanceToSquared(targetPos); 
        this.speed = 3.0 + (this.phase * 1.5); // Slightly slower to compensate for easier tracking

        // Move on XZ plane only
        const flatTarget = new THREE.Vector3(targetPos.x, 0, targetPos.z);
        const flatPos = new THREE.Vector3(this.mesh.position.x, 0, this.mesh.position.z);
        const dir = new THREE.Vector3().subVectors(flatTarget, flatPos).normalize();

        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));

        // Hover Physics
        const hoverHeight = 8.0 + Math.sin(Date.now() * 0.001) * 1.5;
        this.mesh.position.y += (hoverHeight - this.mesh.position.y) * delta * 2.0; // Smooth damping

        this.mesh.lookAt(targetPos);

        if (distSq < 100.0) { 
             return 'damage_player_boss';
        }

        // Shooting Logic
        this.shootTimer += delta;
        // NERFED Scaling: Slower max speed
        // Base 3.5s. P4: 3.5 - 1.2 = 2.3s (Manageable)
        const fireRate = Math.max(2.0, 3.5 - (this.phase * 0.3));

        if (this.shootTimer > fireRate) {
            this.shootTimer = 0;
            if (this.onShoot) {
                const start = this.mesh.position.clone().add(new THREE.Vector3(0, 5, 0));
                const baseDir = new THREE.Vector3().subVectors(targetPos, start).normalize();

                // Fan Attack NERFED: Projectiles = 3 + Phase (Max 7)
                const count = 3 + this.phase;
                const spreadAngle = 0.15;
                const half = Math.floor(count / 2);

                for (let i = -half; i <= half; i++) { 
                    const dir = baseDir.clone();
                    dir.x += Math.cos(Date.now() * 0.001) * 0.05; 
                    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spreadAngle);
                    dir.normalize();
                    this.onShoot(start, dir, true);
                }
            }
        }

        return 'move';
    }

    takeDamage(amount, hitObject = null) {
        let actualDamage = amount;
        let isCrit = false;
        let isImmune = true;

        // Weak Point Hit Check
        // Weak Point Hit Check
        if (this.activeWeakPoints && hitObject) {
            // Check if hitObject matches any active chunk mesh
            const hitWeak = this.activeWeakPoints.find(wp => wp.mesh === hitObject);

            if (hitWeak) {
                actualDamage *= 3.0; // 3x Damage for Hitting Weak Point (Balanced)
                isCrit = true;
                isImmune = false;
                console.log("DEBUG: WEAKPOINT HIT! 3x");

                // Visual Feedback
                hitWeak.mesh.scale.set(1.5, 1.5, 1.5);
                setTimeout(() => hitWeak.mesh.scale.set(1, 1, 1), 100);
            } else {
                // Check if we hit specific geometry inside a chunk?
                // Usually hitObject is the mesh itself.
            }
        }

        if (isImmune) {
            actualDamage *= 1.0; // Normal damage if hitting body (No Resistance)
        // Maybe play "Ding" sound or shield effect?
        }

        this.life -= actualDamage;
        
        // --- PAIN FEEDBACK (Throttled) ---
        const now = Date.now();
        if (!this.lastPainTime || now - this.lastPainTime > 200) { // Limit to 5 times per second
            this.lastPainTime = now;

            // 1. Audio: Yell (Low pitch random)
            if (this.scene.userData.game && this.scene.userData.game.audio) {
                const pitch = 100 + Math.random() * 200;
                this.scene.userData.game.audio.playSound(pitch, 'sawtooth', 0.5, 0.2 + (Math.random() * 0.2));
            }

            // 2. Visual: Core Twitch & Red Flash
            if (this.core) {
                this.core.scale.setScalar(0.8 + Math.random() * 0.4); // Shake
                if (this.core.material) {
                    this.core.material.color.setHex(0xff0000);
                    this.core.material.wireframe = false; // Solid

                    if (this.coreResetTimeout) clearTimeout(this.coreResetTimeout);
                    this.coreResetTimeout = setTimeout(() => {
                        if (this.core && this.core.material) {
                            this.core.material.color.setHex(0xffffff);
                            this.core.material.wireframe = true;
                            this.core.scale.setScalar(1.0);
                        }
                    }, 150);
                }
            }
        }

        // 3. Supply Drops (Splitting Loot)
        // Guaranteed on Crit (Weak Point), Chance on Normal
        if (this.scene.userData.game && this.scene.userData.game.systems) {
            if (isCrit) {
                // FORCE DROP on Weak Point Hit
                this.scene.userData.game.systems.spawnDrop(this.mesh.position, 6, true);
                // Maybe spawn EXTRA ammo too?
                if (Math.random() < 0.5) {
                    const offset = new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5);
                    this.scene.userData.game.systems.spawnDrop(this.mesh.position.clone().add(offset), 6, true);
                }
            } else {
                // Body Hit: Standard Chance (handled by spawnDrop default or we pass false)
                if (Math.random() < 0.2) { // 20% on body hit
                    this.scene.userData.game.systems.spawnDrop(this.mesh.position, 6, true);
                }
            }
        }

        // Pulse Bubble briefly
        this.bubble.material.opacity = 0.8;
        setTimeout(() => { if (this.active) this.bubble.material.opacity = 0.3; }, 50);

        // Spawn Dollars
        const particleCount = isCrit ? 10 : 1;
        for (let i = 0; i < particleCount; i++) this.spawnDollarSign(hitObject || this.core);

        if (this.life <= 0 && !this.isDying) {
            this.life = 0;
            this.isDying = true;
            this.deathTimer = 0;
            this.deathDuration = 4.0;

            // Turn Black/Red
            this.bubble.material.color.setHex(0xff0000);
            this.core.material.color.setHex(0x000000);
            this.activeWeakPoints = []; 

            if (this.scene && this.scene.userData && this.scene.userData.game && this.scene.userData.game.ui) {
                this.scene.userData.game.ui.updateBossHealth(0, this.maxLife);
            }
            console.log("BOSS ENTERING DEATH SEQUENCE");
            return true;
        }
        return false;
    }

    explode() {
        console.log("DEBUG: Boss Bursting!");
        const startScale = this.mesh.scale.x;
        const startTime = Date.now();

        const animateDeath = () => {
            const now = Date.now();
            const progress = (now - startTime) / 3000; // 3s Slow Motion Burst
            if (progress >= 1.0) {
                this.scene.remove(this.mesh);
                if (this.effects) this.effects.forEach(e => this.scene.remove(e.mesh));
                return;
            }
            const s = startScale * (1.0 + progress * 8.0); 
            this.mesh.scale.set(s, s, s);
            this.mesh.rotation.y += 0.5;
            this.bubble.material.opacity = 0.5 * (1.0 - progress);

            // Critical shake
            this.mesh.position.x += (Math.random() - 0.5) * 5.0;
            this.mesh.position.y += (Math.random() - 0.5) * 5.0;
            requestAnimationFrame(animateDeath);
        };
        animateDeath();

        for (let i = 0; i < 100; i++) {
            this.spawnDollarSign(this.core);
        }
    }
}
