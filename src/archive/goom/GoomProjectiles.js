import * as THREE from 'three';

export class GoomProjectiles {
    constructor(game) {
        this.game = game;
        this.scene = game.scene;
        this.camera = game.camera;
        this.list = []; // The projectiles array
        this.raycaster = new THREE.Raycaster();

        // Shared Resources
        this.sharedTracerGeo = new THREE.BoxGeometry(1, 1, 1);
        this.sharedTracerMats = {};
    }

    // DOOM STYLE AUTO AIM: Finds best target in center vertical column
    getAutoAimTarget() {
        // DESKTOP SAFEGUARD: Only enable Auto-Aim on Mobile
        if (window.innerWidth > 900) return null;

        const candidates = [];
        this.game.enemies.forEach(e => candidates.push(e.mesh));
        if (this.game.boss) candidates.push(this.game.boss.mesh);
        if (this.game.ui && this.game.ui.crystals) {
            this.game.ui.crystals.forEach(c => {
                if (c.mesh && c.mesh.visible && c.mesh.userData.isCorrupted) candidates.push(c.mesh);
            });
        }

        let bestTarget = null;
        let minAngle = Infinity;
        const maxAngle = 0.5; // ~30 degrees horizontal tolerance

        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        camDir.y = 0; camDir.normalize(); // Flatten to XZ plane

        const camPos = this.camera.position;

        for (const c of candidates) {
            if (!c.visible) continue;

            const toTarget = new THREE.Vector3().subVectors(c.position, camPos);
            toTarget.y = 0; // Flatten
            const dist = toTarget.length();
            if (dist > 200) continue; // Too far

            toTarget.normalize();

            // Angle check
            const angle = camDir.angleTo(toTarget);
            if (angle < maxAngle && angle < minAngle) {
                // Determine if we have line of sight? (Optional, maybe skip for classic Doom feel)
                minAngle = angle;
                bestTarget = c;
            }
        }
        return bestTarget;
    }

    fireHitscan(weapon, spread = 0) {
        const coords = new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
        this.raycaster.setFromCamera(coords, this.camera);

        // DOOM AUTO-AIM OVERRIDE
        const autoTarget = this.getAutoAimTarget();
        if (autoTarget) {
            const start = this.raycaster.ray.origin;
            const targetPos = autoTarget.position.clone();

            // Aim at center of mass? slightly higher/lower logic?
            // Goom enemies center is y=0 usually? No they float.
            // Let's rely on their position.

            let dir = new THREE.Vector3().subVectors(targetPos, start).normalize();
            // We want to KEEP variables spread but adjust base direction.
            // For hitscan, we just override direction if spread is low? 
            // Or just set direction to target + spread.

            // Apply spread to the perfect aim
            if (spread > 0) {
                dir.x += (Math.random() - 0.5) * spread;
                dir.y += (Math.random() - 0.5) * spread;
                dir.z += (Math.random() - 0.5) * spread;
                dir.normalize();
            }

            this.raycaster.ray.direction.copy(dir);
        }

        // Calculate a point far down the ray for the "miss" tracer
        const maxDist = (weapon.name === 'SHOTGUN') ? 100.0 : 500.0;
        const rayTarget = new THREE.Vector3();
        this.raycaster.ray.at(maxDist, rayTarget);

        // OPTIMIZED: Raycast only against simplified hitboxes to prevent CPU lag
        const objects = this.game.enemies.map(e => e.hitbox).filter(h => h);

        // Corrupted Crystals are also valid targets
        if (this.game.ui && this.game.ui.crystals) {
            this.game.ui.crystals.forEach(c => {
                if (c.mesh && c.mesh.visible && c.mesh.userData.isCorrupted) {
                    objects.push(c.mesh);
                }
            });
        }

        // Boss fallback
        if (this.game.boss) objects.push(this.game.boss.mesh);

        // Filter to ensure no undefineds
        const validObjects = objects.filter(o => o);

        this.raycaster.far = maxDist;
        const intersections = this.raycaster.intersectObjects(validObjects, true);
        this.raycaster.far = Infinity;
        let hitPoint = null;
        let target = null;

        if (intersections.length > 0) {
            const hit = intersections[0];
            hitPoint = hit.point;
            target = hit.object;
        }

        // VISUALS FIRST: Guaranteed Tracer
        const visualTarget = hitPoint || rayTarget;
        this.createTracer(visualTarget, weapon.color);

        // LOGIC SECOND: Damage & Explosions
        if (hitPoint && target) {
            try {
                let enemy = null;
                if (target.userData && target.userData.enemy) {
                    enemy = target.userData.enemy;
                } else if (this.game.boss) {
                    let curr = target;
                    while (curr && curr !== this.scene) {
                        if (curr === this.game.boss.mesh) { enemy = this.game.boss; break; }
                        curr = curr.parent;
                    }
                }

                if (enemy) {
                    this.game.systems.createExplosion(hitPoint, 0x00ff00, false);
                    const wasDead = enemy.takeDamage(weapon.damage, target);
                    if (wasDead) {
                        this.game.score += 100;
                        this.game.ui.updateHUD();
                        this.game.systems.createExplosion(enemy.mesh.position, 0xff0000, true);
                    } else {
                        if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(enemy.type);
                    }

                    // SPLASH DAMAGE (Shotgun)
                    if (weapon.splashRadius > 0) {
                        const splashSq = weapon.splashRadius * weapon.splashRadius;
                        for (const other of this.game.enemies) {
                            if (other === enemy) continue; // Already hit
                            if (other.mesh.position.distanceToSquared(hitPoint) < splashSq) {
                                other.takeDamage(weapon.damage); // Full damage per pellet to neighbors
                                this.game.systems.createExplosion(other.mesh.position, 0xffaa00, false, 0.5);
                            }
                        }
                    }
                } else if (target.userData && target.userData.isCorrupted) {
                    // Damage Corrupted Crystal
                    this.game.systems.createExplosion(hitPoint, 0x00ffff, false);
                    target.userData.health -= weapon.damage;
                    if (target.userData.health <= 0) {
                        this.game.destroyCrystal(target);
                        this.game.score += 500;
                        this.game.ui.updateHUD();
                    } else {
                        this.game.audio.playSound(150, 'square', 0.2, 0.2); // Hit sound
                    }
                } else {
                    this.game.systems.createExplosion(hitPoint, 0xffff00, false);
                }
            } catch (err) {
                console.error("Hit Logic Error:", err);
            }
        }
    }

    fireProjectile(weapon) {
        const start = new THREE.Vector3();
        if (this.game.muzzleLight) this.game.muzzleLight.getWorldPosition(start);
        else {
            this.camera.getWorldPosition(start);
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            start.add(dir.multiplyScalar(1.0));
        }

        let velocityDir;

        // DOOM AUTO-AIM
        const autoTarget = this.getAutoAimTarget();
        if (autoTarget) {
            velocityDir = new THREE.Vector3().subVectors(autoTarget.position, start).normalize();
        // Small compensation for projectile speed vs target movement? Nah, minimal.
        } else {
            // Standard Aim
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            const targetPoint = new THREE.Vector3();
            this.raycaster.ray.at(100, targetPoint);

            // Floor clamp logic from original?
            if (this.raycaster.ray.direction.y < -0.05) {
                const t = (0 - this.raycaster.ray.origin.y) / this.raycaster.ray.direction.y;
                if (t > 0 && t < 200) {
                    this.raycaster.ray.at(t, targetPoint);
                }
            }
            velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();
        }

        const geo = new THREE.IcosahedronGeometry(weapon.type === 'projectile_fast' ? 0.2 : 0.5, 0);
        const mat = new THREE.MeshBasicMaterial({ color: weapon.color, wireframe: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);
        this.scene.add(mesh);

        this.list.push({
            mesh,
            velocity: velocityDir.multiplyScalar(weapon.type === 'projectile_fast' ? 300 : 80),
            life: 5.0,
            damage: weapon.damage,
            isRocket: weapon.name === 'LAUNCHER',
            isPlasma: weapon.name === 'PLASMA'
        });
    }

    fireBFG(weapon) {
        const start = new THREE.Vector3();
        if (this.game.muzzleLight) this.game.muzzleLight.getWorldPosition(start);
        else this.camera.getWorldPosition(start);

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const targetPoint = new THREE.Vector3();
        this.raycaster.ray.at(100, targetPoint);
        const velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();

        // Complex BFG Mesh
        const group = new THREE.Group();

        // Green Outer Shell
        const geoOuter = new THREE.SphereGeometry(3.0, 16, 16);
        const matOuter = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.4, wireframe: true });
        const meshOuter = new THREE.Mesh(geoOuter, matOuter);

        // White Hot Core
        const geoCore = new THREE.SphereGeometry(1.5, 16, 16);
        const matCore = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const meshCore = new THREE.Mesh(geoCore, matCore);

        group.add(meshOuter);
        group.add(meshCore);
        group.position.copy(start);
        this.scene.add(group);

        this.list.push({ mesh: group, velocity: velocityDir.multiplyScalar(30), life: 10.0, damage: weapon.damage, isBFG: true });
    }

    fireEnemyProjectile(start, dir, type = 'normal', owner = null) {
        // HITSCAN REDIRECTION
        if (type === 'normal') {
            this.fireEnemyHitscan(start, dir, type, 0); // Pistol (Accuracy)
            if (this.game.audio) this.game.audio.playSound(400, 'square', 0.1, 0.1);
            return;
        }
        if (type === 'berzerker') { // Shotgun (10x Dev)
            // Fire 6 Pellets
            for (let i = 0; i < 6; i++) {
                this.fireEnemyHitscan(start, dir, type, 0.15); // Spread
            }
            if (this.game.audio) this.game.audio.playSound(150, 'sawtooth', 0.3, 0.2); // Boom
            return;
        }

        let geo, mat, speed, damage;
        const isBoss = (type === 'boss' || type === true);
        let isRocket = false; // Add rocket flag

        if (isBoss) {
            geo = new THREE.IcosahedronGeometry(0.6, 1);
            mat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, wireframe: true });
            speed = 40;
            damage = 25;
        } else if (type === 'scout') { // Intern (Fast, weak)
            geo = new THREE.ConeGeometry(0.2, 0.8, 8);
            geo.rotateX(Math.PI / 2);
            mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false });
            speed = 50;
            damage = 8;
        } else if (type === 'tank') { // VC Whale (Rocket, Explosive)
            geo = new THREE.BoxGeometry(2.0, 2.0, 4.0); // MASSIVE ROCKET
            mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
            speed = 50; // Fast (Was 25)
            damage = 80; // Heavy (Was 50)
            isRocket = true;
        } else if (type === 'corrupted') {
            geo = new THREE.IcosahedronGeometry(0.8, 1);
            mat = new THREE.MeshPhongMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 2.0, wireframe: false });
            speed = 25;
            damage = 15;
        } else if (type === 'imp') { // Prompt Engineer (Plasma Spread)
            geo = new THREE.DodecahedronGeometry(0.3);
            mat = new THREE.MeshBasicMaterial({ color: 0xffaa00, wireframe: false });
            speed = 35;
            damage = 12;
        } else {
            geo = new THREE.DodecahedronGeometry(0.5);
            mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
            speed = 30;
            damage = 15;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);
        if (type === 'scout' || type === 'tank') mesh.lookAt(start.clone().add(dir));

        this.scene.add(mesh);

        this.list.push({
            mesh,
            velocity: dir.multiplyScalar(speed),
            life: 5.0,
            damage: damage,
            isEnemy: true,
            isBossProjectile: isBoss,
            owner: owner,
            isRocket: isRocket // Persist rocket property
        });

        let pitch = isBoss ? 100 : 200;
        if (type === 'scout') pitch = 400;
        if (type === 'tank') pitch = 100; // Deep launch sound
        if (this.game.audio) this.game.audio.playSound(pitch, 'sawtooth', 0.2, 0.5);
    }

    update(delta) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.life -= delta;

            if (p.isBFG) {
                // Rotate Shell
                if (p.mesh.children && p.mesh.children[0]) {
                    p.mesh.children[0].rotation.y += delta * 5.0;
                    p.mesh.children[0].rotation.z += delta * 2.0;
                }

                // PATH OF DESTRUCTION
                const range = 60.0;
                this.game.enemies.forEach(e => {
                    const dist = e.mesh.position.distanceTo(p.mesh.position);
                    if (dist < range) {
                        e.takeDamage(1000 * delta); // MELT
                    // Visuals
                        if (Math.random() < 0.3) {
                            if (this.game.systems.createLightning) {
                                this.game.systems.createLightning(p.mesh.position, e.mesh.position, 0x00ff00);
                            } else {
                                this.createTracer(e.mesh.position, 0x00ff00, p.mesh.position);
                            }
                        }
                    }
                });
                if (this.game.boss && this.game.boss.mesh.position.distanceTo(p.mesh.position) < range) {
                    this.game.boss.takeDamage(500 * delta);
                    if (Math.random() < 0.3 && this.game.systems.createLightning) {
                        this.game.systems.createLightning(p.mesh.position, this.game.boss.mesh.position, 0x00ff00);
                    }
                }
            }

            let hit = false;

            // --- ENEMY PROJECTILE ---
            if (p.isEnemy) {
                // Hit Player?
                if (p.mesh.position.distanceTo(this.camera.position) < 3.0) {
                    hit = true;
                    this.game.takePlayerDamage(p.damage);
                    this.game.systems.createExplosion(this.camera.position, 0xff0000, true);
                }

                // Hit Crystals?
                if (!hit && this.game.ui && this.game.ui.crystals) {
                    const worldPos = new THREE.Vector3();
                    for (const c of this.game.ui.crystals) {
                        // Prevent Friendly Fire (Crystal Turret -> Itself)
                        if (p.owner === c.mesh) continue;

                        if (c.mesh && c.mesh.visible && c.mesh.userData.health > 0) {
                            c.mesh.getWorldPosition(worldPos);
                            if (p.mesh.position.distanceTo(worldPos) < 8.0) {
                                hit = true;
                                c.mesh.userData.health -= p.damage;
                                this.game.systems.createExplosion(worldPos, 0x00ffff, true);

                                // Alert Logic
                                if (!this.game.lastAlertTime || (this.game.audio.audioCtx && this.game.audio.audioCtx.currentTime - this.game.lastAlertTime > 1.5)) {
                                    this.game.lastAlertTime = this.game.audio.audioCtx ? this.game.audio.audioCtx.currentTime : Date.now();
                                    this.game.audio.playAlert();
                                    if (this.game.ui.showWarning) {
                                        const name = c.mesh.userData.name || "SYSTEM";
                                        this.game.ui.showWarning(`${name} UNDER FIRE!`);
                                    }
                                }

                                if (c.mesh.userData.health <= 0) {
                                    // If already corrupted, destroy it (rare). If healthy, corrupt it.
                                    if (c.mesh.userData.isCorrupted) this.game.destroyCrystal(c.mesh);
                                    else this.game.corruptCrystal(c.mesh);
                                }
                                break;
                            }
                        }
                    }
                }
            }
            // --- PLAYER PROJECTILE ---
            else {
                // 1. Hit Enemies
                for (const e of this.game.enemies) {
                    const dist = p.mesh.position.distanceTo(e.mesh.position);
                    const hitRadius = (e.scale / 2) + 1.0;
                    if (dist < hitRadius) {
                        hit = true;
                        const wasDead = e.takeDamage(p.damage);
                        if (wasDead) {
                            this.game.score += 100;
                            this.game.ui.updateHUD();
                            this.game.systems.createExplosion(e.mesh.position, 0xff0000, true);
                        } else {
                            if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(e.type);
                        }
                        break;
                    }
                }

                // 2. Hit Corrupted Crystals & Boss
                if (!hit) {
                    // Corrupted Crystals
                    if (this.game.ui && this.game.ui.crystals) {
                        const worldPos = new THREE.Vector3();
                        for (const c of this.game.ui.crystals) {
                            if (c.mesh && c.mesh.visible && c.mesh.userData.isCorrupted && c.mesh.userData.health > 0) {
                                c.mesh.getWorldPosition(worldPos);
                                if (p.mesh.position.distanceTo(worldPos) < 8.0) {
                                    hit = true;
                                    c.mesh.userData.health -= p.damage;
                                    this.game.systems.createExplosion(worldPos, 0xff00ff, true);
                                    if (c.mesh.userData.health <= 0) {
                                        this.game.destroyCrystal(c.mesh);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                    // Boss
                    if (!hit && this.game.boss && p.mesh.position.distanceTo(this.game.boss.mesh.position) < 30.0) {
                        hit = true;
                        this.game.boss.takeDamage(p.damage);
                    }
                }
            }

            // Floor/Wall Collision
            if (p.isRocket || p.isBFG) {
                if (p.mesh.position.y < 0.5) {
                    hit = true;
                    p.mesh.position.y = 0.5;
                }
                const b = this.game.arena.bounds;
                if (b) {
                    if (p.mesh.position.x < b.minX || p.mesh.position.x > b.maxX ||
                        p.mesh.position.z < b.minZ || p.mesh.position.z > b.maxZ) {
                        hit = true;
                    }
                }
            }

            if (hit || p.life <= 0) {
                if (p.isRocket || p.isBFG) {
                    const isBFG = p.isBFG;
                    const color = isBFG ? 0x00ff00 : (p.mesh.material ? p.mesh.material.color : 0xffffff);
                    this.game.systems.createExplosion(p.mesh.position, color, true, isBFG ? 5.0 : 1.5);
                    if (this.game.audio) this.game.audio.playNoise(0.5, 0.5, 0.5);

                    const radius = isBFG ? 100.0 : 40.0;
                    const dmg = isBFG ? 2000 : 150;

                    // DAMAGE ENEMIES
                    this.game.enemies.forEach(e => {
                        if (e.mesh.position.distanceTo(p.mesh.position) < radius) {
                            e.takeDamage(dmg);
                            if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(e.type);
                        }
                    });
                    if (this.game.boss && this.game.boss.mesh.position.distanceTo(p.mesh.position) < radius) this.game.boss.takeDamage(dmg);

                    // DAMAGE PLAYER (Splash)
                    const distPlayer = this.camera.position.distanceTo(p.mesh.position);
                    if (distPlayer < radius) {
                        // Linear falloff? Or full dmg? Let's do falloff.
                        const falloff = 1.0 - (distPlayer / radius);
                        if (falloff > 0) {
                            this.game.takePlayerDamage(30 * falloff); // Cap splash to 30 to avoid instant death
                        }
                    }

                } else {
                    if (p.mesh.material && p.mesh.material.color) {
                        this.game.systems.createExplosion(p.mesh.position, p.mesh.material.color, false);
                    }
                }
                this.scene.remove(p.mesh);
                this.list.splice(i, 1);
            }
        }
    }

    fireEnemyHitscan(start, dir, type, spread = 0) {
        // VISUALS: Tracer
        const targetPoint = start.clone().add(dir.clone().multiplyScalar(100)); // Visual Range
        // Apply Spread
        if (spread > 0) {
            targetPoint.x += (Math.random() - 0.5) * spread * 20;
            targetPoint.y += (Math.random() - 0.5) * spread * 20;
            targetPoint.z += (Math.random() - 0.5) * spread * 20;
        }

        let color = 0xffff00; // Default
        let thickness = 0.1;

        if (type === 'berzerker') color = 0xff00ff; // Shotgun (Pink/Magenta)
        if (type === 'normal') {
            color = 0x00ff00; // GREEN
            thickness = 0.4; // WIDER (4x standard)
        }

        this.createTracer(targetPoint, color, start, thickness);

        // HIT LOGIC: Raycast against Player
        // We cheat slightly: If aimed at player within angle tolerance + valid raycast = Hit
        const toPlayer = new THREE.Vector3().subVectors(this.camera.position, start);
        const dist = toPlayer.length();
        toPlayer.normalize();

        // Angle Check (Aim Cone)
        const angle = dir.angleTo(toPlayer);
        // Spread acts as forgiveness or misses.
        // If angle is small, it hits.
        // Shotgun has wider hit cone.

        let hitChance = 0.0;
        if (type === 'normal') hitChance = (angle < 0.05) ? 1.0 : 0.0; // Precise
        if (type === 'berzerker') hitChance = (angle < 0.15) ? 0.6 : 0.0; // Spread checks

        // Force Raycast to check walls?
        // GoomProjectiles raycaster is reused.
        // Let's keep it simple: Distance check + Angle check = Damage.

        if (hitChance > 0 && Math.random() < hitChance) {
            // Wall check?
            // Raycast from enemy to player.
            this.raycaster.set(start, toPlayer);
            const intersects = this.raycaster.intersectObjects(this.game.platform ? [this.game.platform] : [], true); // Only check environment
            // Actually we don't store walls easily, just check distance.

            if (dist < 100) {
                this.game.takePlayerDamage(type === 'berzerker' ? 10 : 5);
                this.game.systems.createExplosion(this.camera.position.clone().add(new THREE.Vector3(0, -0.5, 0)), 0xff0000, false);
            }
        }
    }

    createTracer(targetPoint, color, startPoint = null, thickness = 0.1) {
        if (!this.sharedTracerMats[color]) this.sharedTracerMats[color] = new THREE.MeshBasicMaterial({ color: color });

        const target = targetPoint;
        let start = new THREE.Vector3();

        if (startPoint) {
            start.copy(startPoint);
        } else if (this.game.muzzleLight) {
            this.game.muzzleLight.getWorldPosition(start);
        } else {
            const offset = new THREE.Vector3(0.2, -0.2, -0.5);
            offset.applyQuaternion(this.camera.quaternion);
            start = this.camera.position.clone().add(offset);
        }
        const dist = start.distanceTo(target);

        const mesh = new THREE.Mesh(this.sharedTracerGeo, this.sharedTracerMats[color]);
        mesh.scale.set(thickness, thickness, dist);

        mesh.position.copy(start).lerp(target, 0.5);
        mesh.lookAt(target);
        this.scene.add(mesh);

        this.game.systems.particles.push({ mesh, velocities: [], life: 0.5, initialLife: 0.5, isTracer: true });
    }

    clear() {
        this.list.forEach(p => this.scene.remove(p.mesh));
        this.list = [];
    }
}
