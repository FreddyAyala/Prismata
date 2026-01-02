import * as THREE from 'three';

export class GoomSystems {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.explosionPool = [];
        this.maxPoolSize = 30;
        this.particles = [];
        this.pickups = [];
    }

    createExplosion(pos, color, isBig, life = 0.5, scaleMultiplier = 1.0) {
        // Handle older signature where life/scale might be swapped or life is the 4th arg
        // If 4th arg is > 1.0, it's probably scale, but let's stick to (pos, color, isBig, life, scale)
        // Adjust for BFG passing 10.0 as life? No, I passed 10.0 as 4th arg in Projectiles.js...
        // Wait, in Projectiles.js I wrote: createExplosion(p, 0x00ff00, true, 10.0);
        // So 4th arg IS life/scale?
        // Let's make it flexible.

        let actualLife = life;
        let actualScale = scaleMultiplier;

        // If life is suspiciously large (> 2.0), treat it as scale and reset life to default
        if (typeof life === 'number' && life > 5.0) {
            actualScale = life;
            actualLife = 1.0; // Default life
        }

        const count = isBig ? (12 * actualScale) : 6; // More particles for big explosions
        const spread = (isBig ? 8.0 : 1.5) * (actualScale > 1.0 ? actualScale * 0.5 : 1.0);

        // Use a shared geometry for debris
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ color: color, wireframe: false });

        for (let i = 0; i < Math.min(count, 50); i++) { // Cap at 50 particles
            const mesh = new THREE.Mesh(geometry, material.clone()); // Clone mat for opacity
            mesh.position.copy(pos);

            // Random Offset
            mesh.position.x += (Math.random() - 0.5) * 2.0 * actualScale;
            mesh.position.y += (Math.random() - 0.5) * 2.0 * actualScale;
            mesh.position.z += (Math.random() - 0.5) * 2.0 * actualScale;

            const scale = (isBig ? 1.0 + Math.random() * 2.0 : 0.3 + Math.random() * 0.4) * actualScale;
            mesh.scale.set(scale, scale, scale);

            this.scene.add(mesh);

            const velocity = {
                x: (Math.random() - 0.5) * 15 * spread,
                y: (Math.random() - 0.5) * 15 * spread,
                z: (Math.random() - 0.5) * 15 * spread
            };

            this.particles.push({
                mesh,
                velocity,
                life,
                initialLife: life,
                rotSpeed: { x: Math.random() * 5, y: Math.random() * 5 } 
            });
        }

        // Add a central flash sphere
        const flashGeo = new THREE.SphereGeometry(isBig ? 4.0 : 1.0, 4, 4); // Lower poly sphere
        const flashMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        flash.position.copy(pos);
        this.scene.add(flash);
        this.particles.push({ mesh: flash, life: 0.2, initialLife: 0.2, isFlash: true });
    }

    createTeleportEffect(pos) {
        // A tall cyberpunk cylinder beam
        const geometry = new THREE.CylinderGeometry(2, 2, 20, 6, 1, true); // Lower poly cylinder
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8,
            wireframe: true,
            side: THREE.DoubleSide
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(pos);
        mesh.position.y += 10; // Center it
        this.scene.add(mesh);

        // Animate scale/opacity
        this.particles.push({
            mesh,
            life: 0.5,
            initialLife: 0.5,
            isTeleport: true
        });

        // Add some floating bits
        this.createExplosion(pos, 0x00ffff, true, 1.0);
    }

    updateParticles(delta) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            if (p.mesh) {
                // Movement
                if (p.velocity) {
                    p.mesh.position.x += p.velocity.x * delta;
                    p.mesh.position.y += p.velocity.y * delta;
                    p.mesh.position.z += p.velocity.z * delta;
                    // Gravity
                    p.velocity.y -= 25.0 * delta;
                }

                // Rotation
                if (p.rotSpeed) {
                    p.mesh.rotation.x += p.rotSpeed.x * delta;
                    p.mesh.rotation.y += p.rotSpeed.y * delta;
                }

                // Flash expansion
                if (p.isFlash) {
                    const s = p.mesh.scale.x + delta * 15.0;
                    p.mesh.scale.set(s, s, s);
                }

                // Teleport Collapse (Beam)
                if (p.isTeleport) {
                    p.mesh.scale.x = Math.max(0.1, p.mesh.scale.x - delta * 0.5);
                    p.mesh.scale.z = Math.max(0.1, p.mesh.scale.z - delta * 0.5);
                    p.mesh.rotation.y += delta * 5.0;
                }

                // Rising Particles
                if (p.isRising) {
                    // Accelerate up
                    p.velocity.y += delta * 10.0;
                }

                // Expanding Rings
                if (p.isRing) {
                    if (p.delay > 0) {
                        p.delay -= delta;
                        p.mesh.visible = false;
                    } else {
                        p.mesh.visible = true;
                        const s = p.mesh.scale.x + delta * 10.0;
                        p.mesh.scale.set(s, s, 1);
                        if (p.mesh.material) p.mesh.material.opacity = p.life / p.initialLife;
                    }
                }
            }

            p.life -= delta;

            if (p.mesh && p.mesh.material) {
                const lifePct = Math.max(0, p.life / p.initialLife);
                if (p.mesh.material.transparent || p.isFlash) {
                    p.mesh.material.opacity = lifePct;
                }
                // Blink out debris
                if (!p.isFlash && lifePct < 0.2) {
                    p.mesh.visible = Math.random() > 0.5;
                }
            }

            if (p.life <= 0) {
                if (p.mesh) {
                    this.scene.remove(p.mesh);
                    if (p.mesh.geometry) p.mesh.geometry.dispose();
                    if (p.mesh.material) p.mesh.material.dispose();
                }
                this.particles.splice(i, 1);
            }
        }
    }

    spawnDrop(pos, wave = 1, force = false) {
        const roll = Math.random();
        if (!force && roll > 0.75) return; // 25% Chance unless forced

        let type = 'ammo_shotgun';
        let color = 0xffaa00;

        // Multiplier based on wave: +5% ammo per wave (Nerfed from 10%)
        const multiplier = 1.0 + ((wave - 1) * 0.05);

        const r2 = Math.random();
        // Health Chance: Base 15% + 5% per wave (Max 40%)
        const healthChance = 0.15 + ((wave - 1) * 0.05);

        if (r2 < healthChance) {
            type = 'health';
            color = 0xff0000;
        } else {
            // Armor Chance (10%)
            const r3 = Math.random();
            if (r3 < 0.10) {
                type = 'armor';
                color = 0x00ff00; // Green Armor
            } else {
                // Ammo Tiering
                const ar = Math.random();
                if (wave >= 4 && ar > 0.90) { type = 'ammo_bfg'; color = 0x00ff00; }
                else if (wave >= 3 && ar > 0.70) { type = 'ammo_plasma'; color = 0x00ffff; }
                else if (wave >= 2 && ar > 0.40) { type = 'ammo_launcher'; color = 0xff00ff; }
                else { type = 'ammo_shotgun'; color = 0xffaa00; }
            }
        }

        const mesh = this.buildPickupVisual(type, color);
        // Visual Scale Up (Users asked for "bigger")
        mesh.scale.set(3.0, 3.0, 3.0);

        mesh.position.copy(pos);
        mesh.position.y = 2.0;
        this.scene.add(mesh);

        this.pickups.push({ mesh, type: type, amountMultiplier: multiplier });
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
        else if (type === 'armor') {
            // Shield Icon
            const plate = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 0.5), wireMat);
            group.add(plate);
            const core = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), solidMat);
            group.add(core);
            // Floating particles?
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
                if (onPickup) onPickup(p.type, p.amountMultiplier || 1.0);
                this.scene.remove(p.mesh);
                this.pickups.splice(i, 1);
            }
        }
    }

    createLightning(start, end, color = 0x00ffff) {
        const dist = start.distanceTo(end);
        const segments = Math.floor(dist / 2.0);
        const points = [];
        points.push(start);

        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const p = new THREE.Vector3().lerpVectors(start, end, t);
            // Jitter
            p.x += (Math.random() - 0.5) * 1.5;
            p.y += (Math.random() - 0.5) * 1.5;
            p.z += (Math.random() - 0.5) * 1.5;
            points.push(p);
        }
        points.push(end);

        // Create line segments
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
            const mat = new THREE.LineBasicMaterial({ color: color });
            const mesh = new THREE.Line(geo, mat);
            this.scene.add(mesh);
            this.particles.push({ mesh, life: 0.1, initialLife: 0.1 }); // Short life
        }
    }

    clear() {
        this.particles.forEach(p => this.scene.remove(p.mesh));
        this.particles = [];
        this.pickups.forEach(p => this.scene.remove(p.mesh));
        this.pickups = [];
    }
}
