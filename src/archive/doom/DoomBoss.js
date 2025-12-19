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
        this.life = 2000;
        this.maxLife = 2000;
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
                new THREE.MeshBasicMaterial({ color: 0x0088ff, wireframe: false })
            );
            chunk.position.set(
                (Math.random() - 0.5) * 3.5,
                (Math.random() - 0.5) * 3.5,
                (Math.random() - 0.5) * 3.5
            );
            this.mesh.add(chunk);
            this.chunks.push({ mesh: chunk, speed: Math.random() * 2 + 1, offset: Math.random() * 100 });
        }

        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.scene.add(this.mesh);
    }

    update(delta, playerPos) {
        if (!this.active) return 'remove';

        // Visual Animation
        this.bubble.rotation.y += delta * 0.2;
        this.bubble.scale.setScalar(1.0 + Math.sin(Date.now() * 0.002) * 0.05);

        this.core.rotation.x -= delta;
        this.core.rotation.y -= delta;

        this.chunks.forEach((c) => {
            c.mesh.rotation.x += delta * c.speed;
            c.mesh.rotation.y += delta * c.speed;
            // Orbit calculation
            const time = Date.now() * 0.001 + c.offset;
            c.mesh.position.y += Math.sin(time) * 0.02;
        });

        // AI Logic
        const targetPos = playerPos; 
        const distSq = this.mesh.position.distanceToSquared(targetPos); // FIXED: Defined distSq

        // Move towards player
        const dir = new THREE.Vector3().subVectors(targetPos, this.mesh.position).normalize();
        this.mesh.position.add(dir.multiplyScalar(this.speed * delta));

        // Face player
        this.mesh.lookAt(targetPos);

        if (distSq < 100.0) { // Large Hitbox
             return 'damage_player_boss';
        }

        // Projectile Attack
        this.shootTimer += delta;
        if (this.shootTimer > 1.5) {
            this.shootTimer = 0;
            if (this.onShoot) {
                const start = this.mesh.position.clone().add(new THREE.Vector3(0, 5, 0));
                const dir = new THREE.Vector3().subVectors(targetPos, start).normalize();
                // Burst attack
                for (let i = 0; i < 5; i++) { // Increased burst count
                    setTimeout(() => {
                        if (this.active) {
                            const variation = new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
                            this.onShoot(start, dir.clone().add(variation).normalize());
                        }
                    }, i * 100);
                }
            }
        }

        return 'move';
    }

    takeDamage(amount) {
        this.life -= amount;
        
        // Flash
        this.core.material.color.setHex(0xffffff);
        setTimeout(() => { 
            if(this.active) this.core.material.color.setHex(0xff0000); 
        }, 50);

        if (this.life <= 0) {
            this.active = false;
            this.scene.remove(this.mesh);
            return true;
        }
        return false;
    }
}
