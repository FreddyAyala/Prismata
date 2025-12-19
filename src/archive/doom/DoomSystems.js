import * as THREE from 'three';

export class DoomSystems {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.explosionPool = [];
        this.maxPoolSize = 30;
        this.particles = [];
        this.pickups = [];
    }

    createExplosion(pos, color, isBig, life = 0.5) {
        const count = isBig ? 100 : 15;
        const spread = isBig ? 8.0 : 0.5;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];
        for (let i = 0; i < count; i++) {
            positions[i * 3] = pos.x; positions[i * 3 + 1] = pos.y; positions[i * 3 + 2] = pos.z;
            velocities.push({
                x: (Math.random() - 0.5) * 10 * spread,
                y: (Math.random() - 0.5) * 10 * spread,
                z: (Math.random() - 0.5) * 10 * spread
            });
        }
        let ps;
        // Verify pool has compatible mesh
        let foundIdx = -1;
        for (let i = 0; i < this.explosionPool.length; i++) {
            if (this.explosionPool[i].geometry.attributes.position.count === count) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx !== -1) {
            ps = this.explosionPool.splice(foundIdx, 1)[0];
            ps.visible = true;
            ps.geometry.attributes.position.array.set(positions);
            ps.material.color.set(color);
            ps.material.opacity = 1.0;
            ps.material.size = isBig ? 5.0 : 0.5; // BIGGER
            ps.material.blending = THREE.AdditiveBlending; // Ensure glow
            ps.geometry.attributes.position.needsUpdate = true;
        } else {
            // No suitable pooled mesh, create new
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({
                color,
                size: isBig ? 5.0 : 0.5,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            ps = new THREE.Points(geo, mat);
            this.scene.add(ps);
        }
        this.particles.push({ mesh: ps, velocities, life, initialLife: life });
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.mesh.isPoints && p.velocities && p.velocities.length > 0 && !p.isTracer) {
                const posAttr = p.mesh.geometry.attributes.position;
                if (posAttr) {
                    const pos = posAttr.array;
                    for (let j = 0; j < p.velocities.length; j++) {
                        pos[j * 3] += p.velocities[j].x * delta;
                        pos[j * 3 + 1] += p.velocities[j].y * delta;
                        pos[j * 3 + 2] += p.velocities[j].z * delta;
                    }
                    posAttr.needsUpdate = true;
                }
            }

            p.life -= delta;

            if (p.mesh.material && p.mesh.material.transparent && !p.isTracer) {
                const initialLife = p.initialLife || 0.5;
                const lifePct = Math.max(0, p.life / initialLife);
                p.mesh.material.opacity = lifePct > 0.3 ? 1.0 : (lifePct / 0.3);
            }

            if (p.life <= 0) {
                p.mesh.visible = false;
                if (p.mesh.isPoints && this.explosionPool.length < this.maxPoolSize) {
                    this.explosionPool.push(p.mesh);
                } else {
                    this.scene.remove(p.mesh);
                    if (!p.isTracer) {
                        if (p.mesh.geometry) p.mesh.geometry.dispose();
                        if (p.mesh.material) p.mesh.material.dispose();
                    }
                }
                this.particles.splice(i, 1);
            }
        }
    }

    spawnDrop(pos, wave) {
        const roll = Math.random();
        if (roll > 0.8) return;

        let type = 'ammo_shotgun';
        let color = 0xffaa00;

        const r2 = Math.random();
        const waveHealthBonus = (wave - 1) * 0.1;

        if (r2 < 0.15 + waveHealthBonus) {
            type = 'health';
            color = 0xff0000;
        } else {
            const ar = Math.random();
            if (ar > 0.92) { type = 'ammo_bfg'; color = 0x00ff00; }
            else if (ar > 0.80) { type = 'ammo_plasma'; color = 0x00ffff; }
            else if (ar > 0.60) { type = 'ammo_launcher'; color = 0xff00ff; }
            else { type = 'ammo_shotgun'; color = 0xffaa00; }
        }

        const mesh = this.buildPickupVisual(type, color);
        mesh.position.copy(pos);
        mesh.position.y = 2.0;
        this.scene.add(mesh);
        this.pickups.push({ mesh, type: type });
    }

    spawnHealthPickup(cameraPos) {
        const radius = 20 + Math.random() * 40;
        const angle = Math.random() * Math.PI * 2;
        const x = cameraPos.x + Math.cos(angle) * radius;
        const z = cameraPos.z + Math.sin(angle) * radius;

        const mesh = this.buildPickupVisual('health', 0x00ff00);
        mesh.position.set(x, 2.0, z);
        this.scene.add(mesh);
        this.pickups.push({ mesh, type: 'health' });
    }

    buildPickupVisual(type, color) {
        const group = new THREE.Group();
        const wireMat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.8 });
        const solidMat = new THREE.MeshBasicMaterial({ color: color });

        if (type === 'health') {
            const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 0.6), solidMat);
            const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.6), solidMat);
            group.add(vBar, hBar);
            const outer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 2.5), new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.3 }));
            group.add(outer);
        }
        else if (type === 'ammo_shotgun') {
            const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), wireMat);
            group.add(box);
            const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), solidMat);
            shell.rotation.x = Math.PI / 2;
            shell.position.set(-0.3, 0, 0);
            group.add(shell);
            const s2 = shell.clone(); s2.position.set(0, 0, 0); group.add(s2);
            const s3 = shell.clone(); s3.position.set(0.3, 0, 0); group.add(s3);
        }
        else if (type === 'ammo_launcher') {
            const rocket = new THREE.Group();
            const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5), solidMat);
            body.rotation.z = Math.PI / 2;
            const nose = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5), solidMat);
            nose.rotation.z = -Math.PI / 2;
            nose.position.x = 1.0;
            rocket.add(body, nose);
            group.add(rocket);
        }
        else if (type === 'ammo_plasma') {
            const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 8), wireMat);
            const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), solidMat);
            group.add(cell, core);
        }
        else if (type === 'ammo_bfg') {
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), wireMat);
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), solidMat);
            group.add(orb, core);
        }
        else {
            const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wireMat);
            group.add(box);
        }

        group.userData.rotateSpeed = 2.0;
        return group;
    }

    updatePickups(delta, cameraPos, onPickup) {
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            p.mesh.rotation.y += delta * 2;
            const dist = p.mesh.position.distanceTo(cameraPos);

            if (dist < 15.0) {
                if (onPickup) onPickup(p.type);
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
            }
        }
    }

    clear() {
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.particles = [];
        this.pickups.forEach(p => this.scene.remove(p.mesh));
        this.pickups = [];
    }
}
