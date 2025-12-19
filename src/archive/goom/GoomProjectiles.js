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

    fireHitscan(weapon, spread = 0) {
        const coords = new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread);
        this.raycaster.setFromCamera(coords, this.camera);

        // Calculate a point far down the ray for the "miss" tracer
        const maxDist = (weapon.name === 'SHOTGUN') ? 100.0 : 500.0;
        const rayTarget = new THREE.Vector3();
        this.raycaster.ray.at(maxDist, rayTarget);

        // OPTIMIZED: Raycast only against simplified hitboxes to prevent CPU lag
        const objects = this.game.enemies.map(e => e.hitbox).filter(h => h);

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
                    if (enemy.takeDamage(weapon.damage, target)) {
                        if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(enemy.type);
                        this.game.score += 100;
                        this.game.ui.updateHUD();
                        this.game.systems.createExplosion(enemy.mesh.position, 0xff0000, true);
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

        this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

        const objects = this.game.enemies.map(e => e.hitbox).filter(h => h);
        if (this.game.boss) objects.push(this.game.boss.mesh);

        let targetPoint = new THREE.Vector3();
        const hits = this.raycaster.intersectObjects(objects, true);

        if (hits.length > 0) {
            targetPoint.copy(hits[0].point);
        } else {
            this.raycaster.ray.at(100, targetPoint);
            if (this.raycaster.ray.direction.y < -0.05) {
                const t = (0 - this.raycaster.ray.origin.y) / this.raycaster.ray.direction.y;
                if (t > 0 && t < 200) {
                    this.raycaster.ray.at(t, targetPoint);
                }
            }
        }

        const velocityDir = new THREE.Vector3().subVectors(targetPoint, start).normalize();

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

        const geo = new THREE.SphereGeometry(1.5, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);
        this.scene.add(mesh);

        this.list.push({ mesh, velocity: velocityDir.multiplyScalar(30), life: 10.0, damage: weapon.damage, isBFG: true });
    }

    fireEnemyProjectile(start, dir, type = 'normal') {
        let geo, mat, speed, damage;
        const isBoss = (type === 'boss' || type === true);

        if (isBoss) {
            geo = new THREE.IcosahedronGeometry(0.6, 1);
            mat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, wireframe: true });
            speed = 40;
            damage = 25;
        } else if (type === 'scout') {
            geo = new THREE.ConeGeometry(0.2, 0.8, 8);
            geo.rotateX(Math.PI / 2);
            mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false });
            speed = 50;
            damage = 10;
        } else {
            geo = new THREE.DodecahedronGeometry(0.5);
            mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
            speed = 30;
            damage = 15;
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(start);
        if (type === 'scout') mesh.lookAt(start.clone().add(dir));

        this.scene.add(mesh);

        this.list.push({
            mesh,
            velocity: dir.multiplyScalar(speed),
            life: 5.0,
            damage: damage,
            isEnemy: true,
            isBossProjectile: isBoss
        });

        let pitch = isBoss ? 100 : 200;
        if (type === 'scout') pitch = 400;
        if (this.game.audio) this.game.audio.playSound(pitch, 'sawtooth', 0.2, 0.5);
    }

    update(delta) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const p = this.list[i];
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.life -= delta;

            if (p.isBFG) {
                this.game.enemies.forEach(e => {
                    const dist = e.mesh.position.distanceTo(p.mesh.position);
                    if (dist < 40.0) {
                        e.takeDamage(200 * delta);
                        if (Math.random() < 0.3) {
                            this.createTracer(e.mesh.position, 0x00ffff, p.mesh.position);
                        }
                    }
                });
                if (this.game.boss && this.game.boss.mesh.position.distanceTo(p.mesh.position) < 40.0) {
                    this.game.boss.takeDamage(100 * delta);
                    if (Math.random() < 0.3) this.createTracer(this.game.boss.mesh.position, 0x00ffff, p.mesh.position);
                }
            }

            let hit = false;
            if (p.isEnemy) {
                if (p.mesh.position.distanceTo(this.camera.position) < 3.0) {
                    hit = true;
                    this.game.takePlayerDamage(p.damage);
                    this.game.systems.createExplosion(this.camera.position, 0xff0000, true);
                }
                if (!hit) {
                    for (const c of this.game.ui.crystals) {
                        if (c.mesh && c.mesh.visible && c.mesh.userData.health > 0) {
                            if (p.mesh.position.distanceTo(c.mesh.position) < 8.0) {
                                hit = true;
                                c.mesh.userData.health -= p.damage;
                                this.game.systems.createExplosion(c.mesh.position, 0x00ffff, true);
                                if (c.mesh.userData.health <= 0) {
                                    this.game.destroyCrystal(c.mesh);
                                }
                                break;
                            }
                        }
                    }
                }
            } else {
                // Player Projectile vs Enemies
                for (const e of this.game.enemies) {
                    const dist = p.mesh.position.distanceTo(e.mesh.position);
                    const hitRadius = (e.scale / 2) + 1.0;
                    if (dist < hitRadius) {
                        hit = true;
                        e.takeDamage(p.damage);
                        break;
                    }
                }
                // Player Projectile vs Boss (Using fixed logic from recent step)
                if (this.game.boss && p.mesh.position.distanceTo(this.game.boss.mesh.position) < 30.0) {
                    hit = true;
                    this.game.boss.takeDamage(p.damage);
                }
            }

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
                    this.game.systems.createExplosion(p.mesh.position, p.mesh.material.color, true, isBFG ? 3.0 : 1.5);
                    if (this.game.audio) this.game.audio.playNoise(0.5, 0.5, 0.5);

                    const radius = isBFG ? 80.0 : 40.0;
                    const dmg = isBFG ? 800 : 150;

                    this.game.enemies.forEach(e => {
                        if (e.mesh.position.distanceTo(p.mesh.position) < radius) {
                            e.takeDamage(dmg);
                            if (this.game.audio.playMonsterPain) this.game.audio.playMonsterPain(e.type);
                        }
                    });
                    if (this.game.boss && this.game.boss.mesh.position.distanceTo(p.mesh.position) < radius) this.game.boss.takeDamage(dmg);
                } else {
                    this.game.systems.createExplosion(p.mesh.position, p.mesh.material.color, false);
                }
                this.scene.remove(p.mesh);
                this.list.splice(i, 1);
            }
        }
    }

    createTracer(targetPoint, color, startPoint = null) {
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
        mesh.scale.set(0.1, 0.1, dist);

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
