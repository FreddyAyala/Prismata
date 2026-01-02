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

        // Projectile Resources
        this.sharedGeo = new THREE.IcosahedronGeometry(1, 0);
        this.sharedMats = {};
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

    fireCluster(weapon) {
        // 3 Rockets, Horizontal Wall (No Spread Angle, Just Offset)
        const alt = weapon.altFire;
        const subWeapon = {
            name: 'LAUNCHER',
            damage: alt.damage,
            color: alt.color,
            type: 'projectile',
            splashRadius: 8.0
        };

        // Wall of 3
        const offsetDist = 1.5; // Distance between rockets
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

        // Center
        this.fireProjectile(subWeapon);
        // Left - Use Offset to start them apart, but fire parallel? 
        // fireProjectile consumes 'offset' as direction bias currently.
        // I need to override 'start' position support in fireProjectile to do this properly.
        // HACK: I will just use the current 'offset' param (which biases direction) but careful tuning 
        // makes them feel like a spread. 
        // User wants "next to each other" "not triangular". 
        // If I can't change start pos in fireProjectile easily without refactor, 
        // I'll stick to directional spread but FLAT horizontal.

        // Horizontal Spread (Left/Right only, no Up/Down)
        this.fireProjectile(subWeapon, false, new THREE.Vector3(-0.05, 0, 0)); // Tight Left
        this.fireProjectile(subWeapon, false, new THREE.Vector3(0.05, 0, 0));  // Tight Right
    }

    fireHitscan(weapon, spread = 0, isHelix = false) {
        const coords = new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
        this.raycaster.setFromCamera(coords, this.camera);

        // DOOM AUTO-AIM OVERRIDE
        const autoTarget = this.getAutoAimTarget();
        if (autoTarget) {
            const start = this.raycaster.ray.origin;
            const targetPos = autoTarget.position.clone();
            let dir = new THREE.Vector3().subVectors(targetPos, start).normalize();
            if (spread > 0) {
                dir.x += (Math.random() - 0.5) * spread;
                dir.y += (Math.random() - 0.5) * spread;
                dir.z += (Math.random() - 0.5) * spread;
                dir.normalize();
            }
            this.raycaster.ray.direction.copy(dir);
        }

        // Calculate a point far down the ray for the "miss" tracer
        // Calculate a point far down the ray for the "miss" tracer
        const maxDist = (weapon.name === 'SHOTGUN') ? 150.0 : 500.0; // Increased range for Shotgun
        const rayTarget = new THREE.Vector3();
        this.raycaster.ray.at(maxDist, rayTarget);

        const objects = this.game.enemies.map(e => e.hitbox).filter(h => h);
        if (this.game.ui && this.game.ui.crystals) {
            this.game.ui.crystals.forEach(c => {
                if (c.mesh && c.mesh.visible && c.mesh.userData.isCorrupted) {
                    objects.push(c.mesh);
                }
            });
        }
        if (this.game.boss) objects.push(this.game.boss.mesh);
        const validObjects = objects.filter(o => o);

        const rayStart = this.raycaster.ray.origin.clone(); // Capture start for falloff calc

        this.raycaster.far = maxDist;
        const intersections = this.raycaster.intersectObjects(validObjects, true);
        this.raycaster.far = Infinity;
        let hitPoint = null;
        let target = null;
        let hits = [];

        // PENETRATION LOGIC (Blaster Alt / Railgun)
        if (weapon.type === 'hitscan_beam' && intersections.length > 0) {
            // Hit EVERYTHING in the line
            hits = intersections;
            hitPoint = intersections[intersections.length - 1].point; // End of beam
        } else if (intersections.length > 0) {
            // Standard one-hit
            hits = [intersections[0]];
            hitPoint = hits[0].point;
            target = hits[0].object;
        }

        // VISUALS
        const visualTarget = hitPoint || rayTarget;
        this.createTracer(visualTarget, weapon.color, null, isHelix ? 0.3 : 0.1, isHelix);

        // LOGIC ... (Rest is same)

        // LOGIC SECOND: Damage & Explosions
        // LOGIC TWO: Damage Loop
        const processedEnemies = new Set();

        for (const hit of hits) {
            const t = hit.object;
            const p = hit.point;

            try {
                let enemy = null;
                if (t.userData && t.userData.enemy) {
                    enemy = t.userData.enemy;
                } else if (this.game.boss) {
                    let curr = t;
                    while (curr && curr !== this.scene) {
                        if (curr === this.game.boss.mesh) { enemy = this.game.boss; break; }
                        curr = curr.parent;
                    }
                }

                if (enemy) {
                    if (processedEnemies.has(enemy)) continue; // Don't hit same enemy twice
                    processedEnemies.add(enemy);

                    this.game.systems.createExplosion(p, 0x00ff00, false);

                    // DAMAGE LOGIC WITH FALLOFF
                    let finalDmg = weapon.damage;

                    // Shotgun Falloff
                    if (weapon.name === 'SHOTGUN' && !isHelix) {
                        const dist = rayStart ? rayStart.distanceTo(p) : 0;
                        const maxRange = 80.0;
                        const minRange = 15.0;
                        if (dist > minRange) {
                            const falloff = Math.min(1.0, (dist - minRange) / (maxRange - minRange));
                            finalDmg = weapon.damage * (1.0 - (falloff * 0.8));
                        }
                    }

                    const wasDead = enemy.takeDamage(finalDmg, t);
                    if (wasDead) {
                        this.game.score += 100;
                        this.game.ui.updateHUD();
                        this.game.systems.createExplosion(enemy.mesh.position, 0xff0000, true);
                    } else {
                        if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(enemy.type);
                    }

                    // SPLASH DAMAGE (Shotgun OR Railgun)
                    const isRailgun = (weapon.type === 'hitscan_beam');
                    if (weapon.splashRadius > 0 || isRailgun) {
                        const sRad = isRailgun ? 15.0 : weapon.splashRadius;
                        const sDmg = isRailgun ? 25 : weapon.damage;
                        const sColor = isRailgun ? 0x00ffff : 0xffaa00;

                        const splashSq = sRad * sRad;
                        for (const other of this.game.enemies) {
                            if (other === enemy) continue;
                            if (other.mesh.position.distanceToSquared(p) < splashSq) {
                                other.takeDamage(sDmg);
                                this.game.systems.createExplosion(other.mesh.position, sColor, false, 0.5);
                            }
                        }
                    }
                } else if (t.userData && t.userData.isCorrupted) {
                    // Damage Corrupted Crystal
                    this.game.systems.createExplosion(p, 0x00ffff, false);
                    t.userData.health -= weapon.damage;
                    if (t.userData.health <= 0) {
                        this.game.destroyCrystal(t);
                        this.game.score += 500;
                        this.game.ui.updateHUD();
                    } else {
                        this.game.audio.playSound(150, 'square', 0.2, 0.2); 
                    }
                    if (weapon.type !== 'hitscan_beam') break; // Solids stop non-railgun
                } else {
                    this.game.systems.createExplosion(p, 0xffff00, false);
                    if (weapon.type !== 'hitscan_beam') break; // Solids stop non-railgun
                }
            } catch (err) {
                console.error("Hit Logic Error:", err);
            }
        }
    }

    fireProjectile(weapon, isSlug = false, offset = null) {
        const start = new THREE.Vector3();
        if (this.game.muzzleLight) this.game.muzzleLight.getWorldPosition(start);
        else {
            this.camera.getWorldPosition(start);
            const dir = new THREE.Vector3();
            this.camera.getWorldDirection(dir);
            start.add(dir.multiplyScalar(1.0));
        }

        let velocityDir;

        // DOOM AUTO-AIM (Offset support handles spread)
        if (offset) {
            // If offset is provided, start is same, but direction is biased
            // Calculate Base Direction
            this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
            velocityDir = this.raycaster.ray.direction.clone();
            // Apply offset as direction bias
            velocityDir.add(offset).normalize();
        } else {
            // Standard
            const autoTarget = this.getAutoAimTarget();
            if (autoTarget) {
                velocityDir = new THREE.Vector3().subVectors(autoTarget.position, start).normalize();
            } else {
                this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
                velocityDir = this.raycaster.ray.direction.clone();
                // Floor clamping ignored for spread shots to keep it simple
            }
        }

        // Slug Speed vs Normal
        const speed = isSlug ? 300 : (weapon.type === 'projectile_fast' ? 300 : 80);
        const size = isSlug ? 0.3 : (weapon.type === 'projectile_fast' ? 0.2 : 0.5);

        const geo = new THREE.IcosahedronGeometry(size, 0);
        const mat = new THREE.MeshBasicMaterial({ color: weapon.color, wireframe: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);
        this.scene.add(mesh);

        this.list.push({
            mesh,
            velocity: velocityDir.multiplyScalar(speed),
            life: 5.0,
            damage: weapon.damage,
            isRocket: weapon.name === 'LAUNCHER',
            isPlasma: weapon.name === 'PLASMA',
            splashRadius: weapon.splashRadius || 0 // Store Splash
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

    // --- ALT FIRES ---

    fireSlug(weapon) {
        // Fast, Accurate, Splash
        const alt = weapon.altFire;
        // Reuse fireProjectile but override props
        // We create a custom object to mimic weapon but with alt stats
        const slugWeapon = {
            name: 'SLUG',
            damage: alt.damage,     // 60
            color: alt.color,       // Orange
            type: 'projectile_fast',
            splashRadius: 10.0      // Explicit Splash
        };
        this.fireProjectile(slugWeapon, true); // true = isSlug
    }

    fireCluster(weapon) {
        // 3 Rockets, Horizontal Wall
        const alt = weapon.altFire;
        const subWeapon = {
            name: 'LAUNCHER',
            damage: alt.damage,
            color: alt.color,
            type: 'projectile',
            splashRadius: 8.0
        };

        // Center
        this.fireProjectile(subWeapon);
        // Horizontal Tight Spread
        this.fireProjectile(subWeapon, false, new THREE.Vector3(-0.05, 0, 0)); // Tight Left
        this.fireProjectile(subWeapon, false, new THREE.Vector3(0.05, 0, 0));  // Tight Right
    }

    fireFlak(weapon) {
        // Arcing Grenade
        const alt = weapon.altFire;
        const speed = 220.0; // Buffed Speed (was 150) for more range

        // Ensure Material
        if (!this.sharedMats[alt.color]) {
            this.sharedMats[alt.color] = new THREE.MeshBasicMaterial({ color: alt.color, wireframe: true });
        }

        // Create Projectile manually to add Gravity
        const mesh = new THREE.Mesh(this.sharedGeo, this.sharedMats[alt.color]);
        mesh.scale.setScalar(2.0); // Big chunky grenade

        const start = new THREE.Vector3(0.5, -0.5, -1.0).applyQuaternion(this.camera.quaternion).add(this.camera.position);
        mesh.position.copy(start);

        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
        // Pitch up slightly for arc
        dir.y += 0.2;
        dir.normalize();

        const velocity = dir.multiplyScalar(speed);

        this.scene.add(mesh);

        this.list.push({
            mesh: mesh,
            velocity: velocity,
            type: 'flak_grenade', // Special type
            damage: alt.damage,
            color: alt.color,
            gravity: 150.0, // Heavy gravity
            life: 3.0,
            radius: 2.0
        });

        this.game.systems.createExplosion(start, alt.color, false, 0.5); // Muzzle pop
    }

    fireVent(weapon) {
        // 10 Plasma Bolts, Shotgun Spread
        const alt = weapon.altFire;
        const subWeapon = {
            name: 'PLASMA',
            damage: alt.damage,
            color: alt.color,
            type: 'projectile_fast',
            splashRadius: 0
        };

        for (let i = 0; i < 10; i++) {
            const spread = new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1, 0);
            this.fireProjectile(subWeapon, false, spread);
        }
    }

    fireSingularity(weapon) {
        const alt = weapon.altFire;
        const start = new THREE.Vector3();
        if (this.game.muzzleLight) this.game.muzzleLight.getWorldPosition(start);
        else this.camera.getWorldPosition(start);

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        const targetPoint = new THREE.Vector3();
        this.raycaster.ray.at(100, targetPoint);
        const velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();

        // Dark Orb Mesh
        const geo = new THREE.IcosahedronGeometry(1.5, 2);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaa00aa, wireframe: true });
        const mesh = new THREE.Mesh(geo, mat);

        // Inner Black Hole
        const innerGeo = new THREE.SphereGeometry(0.8);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const innerMesh = new THREE.Mesh(innerGeo, innerMat);
        mesh.add(innerMesh);

        mesh.position.copy(start);
        this.scene.add(mesh);

        this.list.push({
            mesh,
            velocity: velocityDir.multiplyScalar(20), // Slow
            life: 8.0,
            damage: alt.damage,
            isSingularity: true,
            splashRadius: 25.0
        });
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
            damage = 50; // Buffed to 50 (Direct) + Splash
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

            if (p.type === 'shockwave') {
                p.mesh.scale.addScalar(80.0 * delta); // Expand
                if (p.mesh.material) p.mesh.material.opacity = Math.min(1.0, p.life * 2.0); // Fade
                p.life -= delta;
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    this.list.splice(i, 1);
                }
                continue;
            }

            // Gravity
            if (p.gravity) {
                p.velocity.y -= p.gravity * delta;
            }

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
            if (p.isRocket || p.isBFG || p.type === 'flak_grenade') {
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
                if (p.type === 'flak_grenade') {
                    // FLAK BURST LOGIC
                    this.game.systems.createExplosion(p.mesh.position, 0xffaa00, true, 2.0);
                    if (this.game.audio) this.game.audio.playSound(100, 'noise', 0.8, 0.4); // BOOM

                    // 1. AOE SPLASH DAMAGE (Guaranteed Hit)
                    const splashRange = 45.0; // Mega AOE
                    this.game.enemies.forEach(e => {
                        const dist = e.mesh.position.distanceTo(p.mesh.position);
                        if (dist < splashRange) {
                            e.takeDamage(250); // Buffed to 250
                        }
                    });

                    // VISUAL SHOCKWAVE
                    const waveGeo = new THREE.RingGeometry(0.5, 1.0, 32);
                    const waveMat = new THREE.MeshBasicMaterial({
                        color: 0xffaa00,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.8
                    });
                    const wave = new THREE.Mesh(waveGeo, waveMat);
                    wave.position.copy(p.mesh.position);
                    wave.rotation.x = -Math.PI / 2; // Flat on ground
                    this.scene.add(wave);

                    // Add to a visual list to animate (or simple timeout/interval if no generic update)
                    // We can reuse the projectile list with a special type 'visual_effect' or just animate manually in update
                    this.list.push({
                        mesh: wave,
                        life: 0.5,
                        type: 'shockwave',
                        velocity: new THREE.Vector3(0, 0, 0),
                        maxScale: 40.0
                    });

                    // 2. Release Shrapnel (Bonus Damage)

                    // Release Shrapnel
                    const origin = p.mesh.position.clone();
                    for (let k = 0; k < 20; k++) {
                        // Random direction
                        const dir = new THREE.Vector3(
                            Math.random() - 0.5,
                            Math.random() - 0.5,
                            Math.random() - 0.5
                        ).normalize();

                        // Raycast for instant hit (Shrapnel)
                        this.raycaster.set(origin, dir);
                        this.raycaster.far = 15.0; // Short range burst

                        // Hit Logic (Simplified for performance, reuse hitscan logic if possible or inline)
                        // INLINE HIT CHECK
                        let targetHit = null;

                        // 1. Check Enemies
                        for (const e of this.game.enemies) {
                            const intersect = this.raycaster.intersectObject(e.hitbox || e.mesh);
                            if (intersect.length > 0) {
                                targetHit = e;
                                e.takeDamage(5); // 5 Dmg per pellet * 20 = 100 max
                                this.game.systems.createExplosion(intersect[0].point, 0xffaa00, true, 0.2);
                                break; // penetration? no.
                            }
                        }

                        // Visual Tracer
                        const end = origin.clone().add(dir.multiplyScalar(15.0));
                        this.createTracer(targetHit ? origin.clone().add(dir.multiplyScalar(this.raycaster.far)) : end, 0xffaa00, origin, 0.05);
                    }
                } else if (p.isRocket || p.isBFG) {
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
                this.game.takePlayerDamage(type === 'berzerker' ? 4 : 5); // Nerfed Berzerker (4 dmg * 5 pellets = 20 max)
                this.game.systems.createExplosion(this.camera.position.clone().add(new THREE.Vector3(0, -0.5, 0)), 0xff0000, false);
            }
        }
    }

    createTracer(targetPoint, color, startPoint = null, thickness = 0.1, isHelix = false) {
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

        // CORE BEAM
        const mesh = new THREE.Mesh(this.sharedTracerGeo, this.sharedTracerMats[color]);
        mesh.scale.set(thickness, thickness, dist);
        mesh.position.copy(start).lerp(target, 0.5);
        mesh.lookAt(target);
        this.scene.add(mesh);
        this.game.systems.particles.push({ mesh, velocities: [], life: 0.5, initialLife: 0.5, isTracer: true });

        // HELIX EFFECT
        if (isHelix) {
            const points = [];
            const segments = 20;
            const radius = 0.5;
            const axis = new THREE.Vector3().subVectors(target, start);
            const axisNorm = axis.clone().normalize();

            // Create a perpendicular vector for rotation
            const perp = new THREE.Vector3(0, 1, 0);
            if (Math.abs(axisNorm.y) > 0.9) perp.set(1, 0, 0); // Handle vertical case
            perp.cross(axisNorm).normalize();

            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const pos = new THREE.Vector3().copy(start).lerp(target, t);

                // Spiral offset
                const angle = t * Math.PI * 4; // 2 turns
                const offset = perp.clone().applyAxisAngle(axisNorm, angle).multiplyScalar(radius * Math.sin(t * Math.PI)); // Taper ends
                pos.add(offset);
                points.push(pos);
            }

            // Simple Line for Helix (Tracer style implementation limit, using thin cylinders or just dots?)
            // Let's use small dots for style
            points.forEach(p => {
                const dGeo = new THREE.IcosahedronGeometry(0.1, 0);
                const dMesh = new THREE.Mesh(dGeo, this.sharedTracerMats[color]);
                dMesh.position.copy(p);
                this.scene.add(dMesh);
                this.game.systems.particles.push({ mesh: dMesh, velocities: [], life: 0.5, initialLife: 0.5 });
            });
        }
    }

    clear() {
        this.list.forEach(p => this.scene.remove(p.mesh));
        this.list = [];
    }
}
