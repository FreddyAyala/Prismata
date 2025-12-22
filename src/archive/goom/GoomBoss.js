import * as THREE from 'three';

export class GlitchBoss {
    constructor(scene, position, target, onShoot = null) {
        this.scene = scene;
        this.target = target;
        this.onShoot = onShoot;
        this.shootTimer = 0;
        this.active = true;
        this.isBoss = true;

        // Boss Stats
        this.life = 5000; // Buffed to 5000 (Tougher)
        this.maxLife = 5000;
        this.speed = 4;
        this.damage = 100;
        this.scale = 20.0;
        this.phase = 1;

        this.mesh = new THREE.Group();
        this.mesh.position.copy(position);

        // --- VISUALS: THE AI BUBBLE ---
        // 1. The Bubble (Outer Shell)
        const bubbleGeo = new THREE.SphereGeometry(1.5, 32, 32);
        const bubbleMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
        this.bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
        this.mesh.add(this.bubble);

        // 2. The Core (Inner Data)
        const coreGeo = new THREE.IcosahedronGeometry(0.8, 2);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.mesh.add(this.core);

        // 3. Floating Data Packets
        this.chunks = [];
        for (let i = 0; i < 12; i++) {
            const chunk = new THREE.Mesh(
                new THREE.BoxGeometry(0.3, 0.3, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x0088ff, wireframe: false, roughness: 0.2, metalness: 0.8 })
            );
            chunk.position.set(
                (Math.random() - 0.5) * 3.5,
                (Math.random() - 0.5) * 3.5,
                (Math.random() - 0.5) * 3.5
            );
            this.mesh.add(chunk);
            this.chunks.push({ mesh: chunk, speed: Math.random() * 2 + 1, offset: Math.random() * 100 });
        }

        this.createWeakPoints();
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
        // Reset all to Blue
        this.chunks.forEach(c => {
            if (c.mesh && c.mesh.material && c.mesh.material.color) {
                c.mesh.material.color.setHex(0x0088ff);
                if (c.mesh.material.emissive) c.mesh.material.emissive.setHex(0x000000);
            }
        });
        this.activeWeakPoints = [];

        // Pick 3 random
        if (this.chunks.length > 0) {
            const indices = new Set();
            while (indices.size < 3 && indices.size < this.chunks.length) {
                indices.add(Math.floor(Math.random() * this.chunks.length));
            }

            indices.forEach(idx => {
                const chunk = this.chunks[idx];
                if (chunk && chunk.mesh && chunk.mesh.material && chunk.mesh.material.color) {
                    chunk.mesh.material.color.setHex(0xffff00); // YELLOW (GPU OVERHEATING)
                    if (chunk.mesh.material.emissive) chunk.mesh.material.emissive.setHex(0xffaa00);
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

    update(delta, playerPos) {
        if (!this.active) return 'remove';

        // Weak Point Cycling
        this.cycleTimer += delta;
        if (this.cycleTimer > 5.0) { // Extended to 5s
            this.cycleTimer = 0;
            this.cycleWeakPoint();
        }

        // Visual Animation
        this.bubble.rotation.y += delta * 0.2;
        this.bubble.scale.setScalar(1.0 + Math.sin(Date.now() * 0.002) * 0.05);

        this.core.rotation.x -= delta;
        this.core.rotation.y -= delta;

        this.chunks.forEach((c) => {
            c.mesh.rotation.x += delta * c.speed;
            c.mesh.rotation.y += delta * c.speed;
            const time = Date.now() * 0.001 + c.offset;
            c.mesh.position.y += Math.sin(time) * 0.02;
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

        // AI Logic
        const targetPos = playerPos; 
        const distSq = this.mesh.position.distanceToSquared(targetPos); 

        const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));
        this.mesh.lookAt(targetPos);

        if (distSq < 100.0) { 
             return 'damage_player_boss';
        }

        this.shootTimer += delta;
        if (this.shootTimer > 1.5) { // Faster fire rate (was 2.0)
            this.shootTimer = 0;
            console.log("DEBUG: Boss Casting Virus Fan");
            if (this.onShoot) {
                const start = this.mesh.position.clone().add(new THREE.Vector3(0, 5, 0));
                const baseDir = new THREE.Vector3().subVectors(targetPos, start).normalize();

                // Fan Attack: 7 Projectiles (was 5)
                const spreadAngle = 0.2;
                for (let i = -3; i <= 3; i++) { // -3 to 3 = 7 projectiles
                    const dir = baseDir.clone();
                    // Rotate around Y axis (approximate)
                    dir.x += Math.cos(Date.now() * 0.001) * 0.05; // Slight wobble
                    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), i * spreadAngle);
                    dir.normalize();

                    // Pass 'true' for isBoss
                    this.onShoot(start, dir, true);
                }
            }
        }

        return 'move';
    }

    takeDamage(amount, hitObject = null) {
        let actualDamage = amount;
        let isCrit = false;

        // Weak Point Hit
        // Check if hitObject matches any active activeWeakPoint mesh
        if (this.activeWeakPoints && hitObject) {
            const hitWeak = this.activeWeakPoints.find(wp => wp.mesh === hitObject);
            if (hitWeak) {
                actualDamage *= 5; // 5x Damage (BUFFED)
                isCrit = true;
                console.log("DEBUG: CRITICAL HIT! 5x");
            }
        }

        this.life -= actualDamage;
        
        // Flash
        this.core.material.color.setHex(isCrit ? 0xffff00 : 0xffffff);
        this.bubble.material.opacity = 0.8;
        setTimeout(() => { 
            if (this.active) {
                this.core.material.color.setHex(0xffffff); // Core white
                this.bubble.material.opacity = 0.3;
            }
        }, 50);

        // Spawn Dollars
        const particleCount = isCrit ? 20 : 5;
        for (let i = 0; i < particleCount; i++) this.spawnDollarSign(hitObject || this.core);

        if (this.life <= 0) {
            this.life = 0;
            this.active = false;
            // Force UI Update to 0
            if (this.scene && this.scene.userData && this.scene.userData.game && this.scene.userData.game.ui) {
                this.scene.userData.game.ui.updateBossHealth(0, this.maxLife);
            }
            // DEATH ANIMATION: BURST
            // We want it to "Pop"
            this.explode();
            return true;
        }
        return false;
    }

    explode() {
        console.log("DEBUG: Boss Bursting!");
        // Visual Pop - Scale up rapidly then vanish
        const startScale = this.mesh.scale.x;
        const startTime = Date.now();

        const animateDeath = () => {
            const now = Date.now();
            const progress = (now - startTime) / 2000; // 2.0s burst (Slower, more dramatic)
            if (progress >= 1.0) {
                this.scene.remove(this.mesh);
                if (this.effects) this.effects.forEach(e => this.scene.remove(e.mesh));
                return;
            }
            const s = startScale * (1.0 + progress * 4.0); // Expand to 500%
            this.mesh.scale.set(s, s, s);
            this.mesh.rotation.y += 0.5;
            this.bubble.material.opacity = 0.3 * (1.0 - progress);
            requestAnimationFrame(animateDeath);
        };
        animateDeath();

        // Massive Particle Explosion
        for (let i = 0; i < 50; i++) {
            this.spawnDollarSign(this.core);
        }
    }
}
