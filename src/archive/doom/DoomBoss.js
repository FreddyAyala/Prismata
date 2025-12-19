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

        // --- VISUALS ---
        // 1. Core (Pulsing Heart)
        const coreGeo = new THREE.IcosahedronGeometry(1.0, 1);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        this.core = new THREE.Mesh(coreGeo, coreMat);
        this.mesh.add(this.core);

        // 2. Spinning Rings
        const ringGeo = new THREE.TorusGeometry(2.0, 0.1, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe:true });
        this.ring1 = new THREE.Mesh(ringGeo, ringMat);
        this.ring2 = new THREE.Mesh(ringGeo, ringMat);
        this.ring2.rotation.x = Math.PI / 2;
        this.mesh.add(this.ring1);
        this.mesh.add(this.ring2);

        // 3. Floating Chunks
        this.chunks = [];
        for(let i=0; i<8; i++) {
            const chunk = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 0.5, 0.5),
                new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true })
            );
            chunk.position.set(
                (Math.random()-0.5)*4,
                (Math.random()-0.5)*4,
                (Math.random()-0.5)*4
            );
            this.mesh.add(chunk);
            this.chunks.push(chunk);
        }

        this.mesh.scale.set(this.scale, this.scale, this.scale);
        this.scene.add(this.mesh);
    }

    update(delta, playerPos) {
        if (!this.active) return 'remove';

        // Visual Animation
        this.core.rotation.y += delta;
        this.core.scale.setScalar(1.0 + Math.sin(Date.now()*0.005)*0.2);
        
        this.ring1.rotation.y -= delta * 2;
        this.ring1.rotation.z += delta;

        this.ring2.rotation.x -= delta * 2;
        this.ring2.rotation.z -= delta;

        this.chunks.forEach((c, i) => {
            c.rotation.x += delta;
            c.rotation.y += delta;
            // Orbit?
            c.position.y += Math.sin(Date.now()*0.005 + i)*0.01;
        });

        // AI Logic
        // Phase 1: Slow Approach
        // Phase 2: Enraged (Handled by game logic spawning minions?) for now just approach
        const targetPos = playerPos; 

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
                for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                        if (this.active) {
                            const variation = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
                            this.onShoot(start, dir.clone().add(variation).normalize());
                        }
                    }, i * 200);
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
