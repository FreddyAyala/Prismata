import * as THREE from 'three';
import { DoomAudio } from './DoomAudio.js';
import { GlitchEnemy } from './DoomEnemy.js';
import { GlitchBoss } from './DoomBoss.js';
import { WEAPONS } from './DoomWeapons.js';

export class DoomGame {
  constructor(scene, camera, player = null) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.active = false;

    // Systems
    this.audio = new DoomAudio();

    // Game State
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.pickups = [];
    this.boss = null;
    this.explosionPool = []; // For performance: pool of particle systems
    this.maxPoolSize = 30; // Maximum number of explosion objects to keep in memory

    this.gameInterval = null;
    this.spawnInterval = null;
    this.pickupInterval = null;
    this.enemiesToSpawn = 0;
    this.waveInProgress = false;
    this.lastHUDState = {};

    // Weapons
    // Weapons - DEEP COPY to reset ammo on every game instance
    this.weapons = WEAPONS.map(w => ({ ...w }));
    this.currentWeaponIdx = 0;
    this.weaponMesh = null;
    this.muzzleLight = null;
    this.weaponRecoil = 0;
    this.raycaster = new THREE.Raycaster();
  }

  activate(exhibits = null, skipIntro = false) {
    if (this.active) return;
    this.active = true;
    console.log("🛡️ DOOM GAME ACTIVATED");

    this.createHUD();
    this.exhibitsSource = exhibits || [];

    // RESET WEAPONS & STATE ON ACTIVATION
    // Must reset ammo to maxAmmo because the global WEAPONS array might be dirty/tainted with 0 ammo.
    this.weapons = WEAPONS.map(w => ({
      ...w,
      ammo: w.name === 'BLASTER' ? -1 : 0 // Start with 0 ammo for everything except Blaster
    }));
    this.currentWeaponIdx = 0;
    this.playerHealth = 100;

    this.createWeaponMesh();
    this.initModelHealthBars();

    // Input
    this.clickParams = { handler: (e) => this.shoot(e) };
    document.addEventListener('mousedown', this.clickParams.handler);

    this.keyParams = { handler: (e) => this.handleKeys(e) };
    window.addEventListener('keydown', this.keyParams.handler);

    this.lockParams = { handler: () => this.handlePointerLockChange() };
    document.addEventListener('pointerlockchange', this.lockParams.handler);
    document.addEventListener('mozpointerlockchange', this.lockParams.handler); // Firefox support

    if (!skipIntro) {
      this.showInstructions();
    } else {
      document.body.requestPointerLock();
    }

    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') {
      this.audio.audioCtx.resume();
    }
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;

    if (document.pointerLockElement) document.exitPointerLock();

    // Cleanup
    if (this.weaponMesh) { this.camera.remove(this.weaponMesh); this.weaponMesh = null; }
    if (this.clickParams) { document.removeEventListener('mousedown', this.clickParams.handler); this.clickParams = null; }
    if (this.keyParams) { window.removeEventListener('keydown', this.keyParams.handler); this.keyParams = null; }
    if (this.lockParams) {
      document.removeEventListener('pointerlockchange', this.lockParams.handler);
      document.removeEventListener('mozpointerlockchange', this.lockParams.handler);
      this.lockParams = null;
    }

    if (this.spawnInterval) clearInterval(this.spawnInterval);
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    if (this.musicInterval) clearInterval(this.musicInterval);

    if (this.hud) { this.hud.remove(); this.hud = null; }
    this.lastHUDState = {};

    // Clear Entities
    this.enemies.forEach(e => this.scene.remove(e.mesh));
    this.enemies = [];
    if (this.boss) { this.scene.remove(this.boss.mesh); this.boss = null; }

    this.pickups.forEach(p => this.scene.remove(p.mesh));
    this.pickups = [];

    this.projectiles.forEach(p => this.scene.remove(p.mesh));
    this.projectiles = [];

    this.particles.forEach(p => this.scene.remove(p.mesh));
    this.particles = [];

    // Crystals
    if (this.crystals) {
      this.crystals.forEach(c => c.mesh.remove(c.sprite));
      this.crystals = [];
    }
  }

  update(delta) {
    if (!this.active || this.isGameOver) return;

    // Auto Resume Audio
    if (this.audio.audioCtx && this.audio.audioCtx.state === 'suspended') this.audio.audioCtx.resume();

    // Wave Logic
    if (this.waveInProgress && this.enemiesToSpawn === 0 && this.enemies.length === 0 && !this.boss) {
      this.waveInProgress = false;
      this.wave++;
      this.audio.playSound(600, 'sine', 1.0, 0.5);
      setTimeout(() => this.startWave(), 3000);
    }

    this.updateModelHealthBars();

    // Entities Update
    this.updateEnemies(delta);
    this.updateBoss(delta);
    this.updateProjectiles(delta);
    this.updateParticles(delta);
    this.updatePickups(delta);
    this.updateWeaponRecoil(delta);
  }

  startWave() {
    if (this.spawnInterval) clearInterval(this.spawnInterval);

    // BOSS WAVE
    if (this.wave === 5) {
      this.startBossWave();
      return;
    }

    if (this.wave > 5) { this.triggerWin(); return; }

    this.waveInProgress = true;
    this.enemiesToSpawn = 10 + (this.wave * 5);
    const spawnRate = Math.max(500, 2500 - (this.wave * 300));

    this.showWaveTitle(`WAVE ${this.wave}`);

    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.enemiesToSpawn > 0 && this.enemies.length < 20) {
        this.spawnEnemy();
      }
    }, spawnRate);

    this.updateHUD();
  }

  startBossWave() {
    this.waveInProgress = true;
    this.showWaveTitle("FINAL PROTOCOL: TITAN");
    // Spawn Boss at (0, 20, -100) relative
    const spawnPos = this.camera.position.clone().add(new THREE.Vector3(0, 10, -80));
    const onShoot = (pos, dir) => this.fireEnemyProjectile(pos, dir);
    this.boss = new GlitchBoss(this.scene, spawnPos, this.camera, onShoot);

    // Create Boss Health Bar HUD
    if (this.hud) {
      const bossHud = document.createElement('div');
      bossHud.id = 'boss-health-container';
      bossHud.style.cssText = "position:absolute; top:20px; left:50%; transform:translateX(-50%); width:60%; height:30px; border:2px solid #ff0000; background: rgba(50,0,0,0.5);";
      bossHud.innerHTML = `
            <div id="boss-health-bar" style="width:100%; height:100%; background:#ff4400; transition:width 0.2s;"></div>
            <div style="position:absolute; top:5px; left:50%; transform:translateX(-50%); font-size:16px; color:white; font-weight:bold;">TITAN: FINAL PROTOCOL</div>
        `;
      this.hud.appendChild(bossHud);
    }

    // Still spawn minions?
    this.enemiesToSpawn = 50; // Infinite fodder?
    const spawnRate = 3000; // Slow trickle
    this.spawnInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      if (this.boss && this.enemies.length < 5) {
        this.spawnEnemy();
      }
    }, spawnRate);
  }

  spawnEnemy() {
    if (!this.active) return;

    // Find Targets (Crystals/Models)
    // Filter only alive crystals
    const validTargets = this.crystals.filter(c => c.mesh && c.mesh.visible && c.mesh.userData.health > 0).map(c => c.mesh);

    // Fallback to player if no crystals
    let target = this.camera;

    if (validTargets.length > 0 && Math.random() < 0.7) { // 70% chance to target crystal
      target = validTargets[Math.floor(Math.random() * validTargets.length)];
    }

    // Type Logic

    // Type Logic
    let type = 'normal';
    const roll = Math.random();
    // Wave 1+: Scouts
    if (this.wave >= 1 && roll < 0.2) type = 'scout';
    // Wave 2+: Tanks, Imps
    if (this.wave >= 2 && roll < 0.15) type = 'tank';
    if (this.wave >= 2 && roll < 0.15 && roll >= 0.05) type = 'imp'; // Fireballer
    // Wave 3+: Berzerkers/Wraiths
    if (this.wave >= 3 && roll < 0.15) type = 'berzerker';
    if (this.wave >= 3 && roll < 0.1) type = 'wraith';
    // Wave 4+: Chaos
    if (this.wave >= 4 && roll < 0.25) type = 'berzerker';

    // Position - Further away to give player time to react (120 - 180 units)
    const angle = Math.random() * Math.PI * 2;
    const radius = 120 + Math.random() * 60;
    const spawnX = this.camera.position.x + Math.cos(angle) * radius;
    const spawnZ = this.camera.position.z + Math.sin(angle) * radius;

    const onShoot = (pos, dir) => this.fireEnemyProjectile(pos, dir);

    const enemy = new GlitchEnemy(this.scene, new THREE.Vector3(spawnX, 4, spawnZ), target, type, onShoot);

    // Scaling Difficulty
    const multiplier = 1 + (this.wave - 1) * 0.15;
    enemy.life *= multiplier;

    this.enemies.push(enemy);
    if (this.wave !== 5) this.enemiesToSpawn--;
    this.updateHUD();
  }

  fireEnemyProjectile(start, dir) {
    const geo = new THREE.DodecahedronGeometry(0.5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, wireframe: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(30), // Slower than player rockets
      life: 5.0,
      damage: 15,
      isEnemy: true
    });

    // SFX
    if (this.audio) this.audio.playSound(200, 'sawtooth', 0.2, 0.5);
  }

  updateEnemies(delta) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const result = e.update(delta, this.camera.position);

      const distToPlayerSq = e.mesh.position.distanceToSquared(this.camera.position);
      if (distToPlayerSq < 25.0) { // Hitbox
        this.takePlayerDamage(e.damage * delta * 2);
      }

      if (result === 'damage_player') {
        e.takeDamage(999);
        this.createExplosion(e.mesh.position, 0xff0000, true);
        this.takePlayerDamage(15);
      } else if (result === 'damage_crystal') {
        // Crystal Dmg Logic...
        if (e.target) {
          e.target.userData.health -= 20;
          if (e.target.userData.health <= 0) e.target.visible = false;
        }
        e.takeDamage(999);
        this.createExplosion(e.mesh.position, 0x00ffff, true);
      }

      if (!e.active) {
        if (e.life <= 0) this.spawnDrop(e.mesh.position);
        this.enemies.splice(i, 1);
      }
    }
  }

  updateBoss(delta) {
    if (!this.boss) return;
    const result = this.boss.update(delta, this.camera.position);

    if (result === 'damage_player_boss') {
      this.takePlayerDamage(50 * delta); // Constant burn near boss
    }

    // Update Boss HUD
    const bar = document.getElementById('boss-health-bar');
    if (bar) {
      const pct = (this.boss.life / this.boss.maxLife) * 100;
      bar.style.width = pct + '%';
    }

    if (!this.boss.active) {
      // Remove Boss HUD
      const bossHud = document.getElementById('boss-health-container');
      if (bossHud) bossHud.remove();
      // Boss Dead
      this.createExplosion(this.boss.mesh.position, 0xffaa00, true, 5.0); // Massive explosion
      this.score += 5000;
      this.boss = null;
      setTimeout(() => this.triggerWin(), 2000);
    }
  }

  takePlayerDamage(amount) {
    this.playerHealth -= amount;
    if (Math.random() < 0.1) this.audio.playSound(80, 'square', 0.1, 0.2);

    if (this.hud && Math.random() < 0.3) {
      const flash = document.createElement('div');
      flash.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;background:red;opacity:0.3;pointer-events:none;z-index:4500;";
      this.hud.appendChild(flash);
      setTimeout(() => flash.remove(), 100);
    }

    if (this.playerHealth <= 0) this.triggerGameOver();
    this.updateHUD();
  }

  spawnDrop(pos) {
    const roll = Math.random();
    if (roll > 0.8) return; // 80% chance of drop

    let type = 'ammo_shotgun';
    let color = 0xffaa00;

    const r2 = Math.random();
    const waveHealthBonus = (this.wave - 1) * 0.1;

    if (r2 < 0.15 + waveHealthBonus) {
      type = 'health';
      color = 0xff0000;
    } else {
      // Ammo Weighted
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

  buildPickupVisual(type, color) {
    const group = new THREE.Group();
    const wireMat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: 0.8 });
    const solidMat = new THREE.MeshBasicMaterial({ color: color });

    if (type === 'health') {
      // Red Cross
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.0, 0.6), solidMat);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.6), solidMat);
      group.add(vBar, hBar);
      // Add glow box/wireframe outer
      const outer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 2.5), new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, transparent: true, opacity: 0.3 }));
      group.add(outer);
    }
    else if (type === 'ammo_shotgun') {
      // Shell Box
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), wireMat);
      group.add(box);
      // Shells inside
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8), solidMat);
      shell.rotation.x = Math.PI / 2;
      shell.position.set(-0.3, 0, 0);
      group.add(shell);
      const s2 = shell.clone(); s2.position.set(0, 0, 0); group.add(s2);
      const s3 = shell.clone(); s3.position.set(0.3, 0, 0); group.add(s3);
    }
    else if (type === 'ammo_launcher') {
      // Rocket
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
      // Battery Cell
      const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5, 8), wireMat);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.3, 8), solidMat);
      group.add(cell, core);
    }
    else if (type === 'ammo_bfg') {
      // Glowing Orb
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), wireMat);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), solidMat);
      group.add(orb, core);
    }
    else {
      // Fallback Box
      const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wireMat);
      group.add(box);
    }

    // Animation Metadata
    group.userData.rotateSpeed = 2.0;
    return group;
  }

  updatePickups(delta) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.mesh.rotation.y += delta * 2;
      const dist = p.mesh.position.distanceTo(this.camera.position);

      if (dist < 15.0) {
        if (p.type === 'health') this.playerHealth = Math.min(100, this.playerHealth + 50); // Buffed health recovery

        // Ammo Pickups
        const addAmmo = (name, amount) => {
          const w = this.weapons.find(x => x.name === name);
          if (w) w.ammo = Math.min(w.maxAmmo, w.ammo + amount);
        };

        if (p.type === 'ammo_shotgun') addAmmo('SHOTGUN', 8);
        if (p.type === 'ammo_launcher') addAmmo('LAUNCHER', 4);
        if (p.type === 'ammo_plasma') addAmmo('PLASMA', 40); // Buffed plasma ammo drop
        if (p.type === 'ammo_bfg') addAmmo('BFG 9000', 1);

        this.audio.playSound(400, 'sine', 0.1, 0.2);
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        this.updateHUD();
      }
    }
  }

  shoot(e) {
    if (e && e.type === 'mousedown') console.log("SHOOT EVENT", e);

    if (!this.active || this.isGameOver) return;
    const w = this.weapons[this.currentWeaponIdx];

    // console.log("Attempting shoot:", w.name, w.ammo);

    if (w.ammo !== -1 && w.ammo <= 0) {
      if (this.audio) this.audio.playSound(200, 'sine', 0.05, 0.1);
      return;
    }

    const now = Date.now();
    if (now - w.lastShot < w.cooldown) return;
    w.lastShot = now;

    if (w.ammo !== -1) w.ammo--;
    this.updateHUD();

    this.weaponRecoil = 0.2;
    if (this.muzzleLight) {
      this.muzzleLight.intensity = 5;
      setTimeout(() => { if (this.muzzleLight) this.muzzleLight.intensity = 0; }, 50);
    }

    try {
      if (this.audio) this.audio.playWeaponSound(w.name);
    } catch (err) {
      console.error("Audio Error:", err);
    }

    if (w.type === 'hitscan') this.fireHitscan(w);
    else if (w.type === 'spread') {
      this.fireHitscan(w, 0);
      for (let i = 0; i < 14; i++) this.fireHitscan(w, 0.15);
    }
    else if (w.type === 'projectile' || w.type === 'projectile_fast') {
      this.fireProjectile(w);
    }
    else if (w.type === 'bfg') {
      this.fireBFG(w);
    }
  }

  fireHitscan(weapon, spread = 0) {
    this.raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread), this.camera);
    // Only target enemies + boss
    const objects = this.enemies.map(e => e.mesh);
    if (this.boss) objects.push(this.boss.mesh);

    const intersections = this.raycaster.intersectObjects(objects, true);
    let hitPoint = null;

    if (intersections.length > 0) {
      const hit = intersections[0];
      hitPoint = hit.point;
      let target = hit.object;
      while (target.parent && target.parent !== this.scene && !objects.includes(target)) target = target.parent;

      // Find logic object
      let enemy = this.enemies.find(e => e.mesh === target);
      if (!enemy && this.boss && this.boss.mesh === target) enemy = this.boss;

      if (enemy) {
        this.createExplosion(hit.point, 0x00ff00, false);
        if (enemy.takeDamage(weapon.damage)) {
          this.score += 100;
          if (enemy.isBoss) this.score += 5000;
          this.updateHUD();
          this.createExplosion(enemy.mesh.position, 0xff0000, true);
        }
      }
    }
    // Always create tracer even if miss
    this.createTracer(hitPoint, weapon.color);
  }

  fireProjectile(weapon) {
    const start = new THREE.Vector3();
    if (this.muzzleLight) {
      this.muzzleLight.getWorldPosition(start);
    } else {
      this.camera.getWorldPosition(start);
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      start.add(dir.multiplyScalar(1.0));
    }

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const geo = new THREE.IcosahedronGeometry(weapon.type === 'projectile_fast' ? 0.2 : 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: weapon.color, wireframe: false }); // Solid now
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(weapon.type === 'projectile_fast' ? 150 : 50),
      life: 5.0,
      damage: weapon.damage,
      isRocket: weapon.name === 'LAUNCHER',
      isPlasma: weapon.name === 'PLASMA'
    });
  }

  fireBFG(weapon) {
    const start = new THREE.Vector3();
    if (this.muzzleLight) this.muzzleLight.getWorldPosition(start);
    else this.camera.getWorldPosition(start);

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const geo = new THREE.SphereGeometry(1.5, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    this.scene.add(mesh);

    this.projectiles.push({
      mesh,
      velocity: dir.multiplyScalar(30),
      life: 10.0,
      damage: weapon.damage,
      isBFG: true
    });
  }

  updateProjectiles(delta) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
      p.life -= delta;

      if (p.isBFG) {
        // BFG TICK LOGIC: Zap everything near
        this.enemies.forEach(e => {
          if (e.mesh.position.distanceTo(p.mesh.position) < 30.0) {
            e.takeDamage(100 * delta); // Zap!
            // Create Beam Visual
            if (Math.random() < 0.2) this.createTracer(e.mesh.position, 0x00ff00, p.mesh.position);
          }
        });
        if (this.boss && this.boss.mesh.position.distanceTo(p.mesh.position) < 30.0) {
          this.boss.takeDamage(100 * delta);
        }
      }

      // Collision
      let hit = false;

      if (p.isEnemy) {
        // 1. Check Player
        if (p.mesh.position.distanceTo(this.camera.position) < 3.0) {
          hit = true;
          this.takePlayerDamage(p.damage);
          this.createExplosion(this.camera.position, 0xff0000, true);
        }
        // 2. Check Crystal/Models
        if (!hit) {
          for (const c of this.crystals) {
            if (c.mesh && c.mesh.visible && c.mesh.userData.health > 0) {
              if (p.mesh.position.distanceTo(c.mesh.position) < 8.0) {
                hit = true;
                c.mesh.userData.health -= p.damage;
                this.createExplosion(c.mesh.position, 0x00ffff, true);
                break;
              }
            }
          }
        }
      } else {
        // Player Projectiles vs Enemies
        for (const e of this.enemies) {
          if (p.mesh.position.distanceTo(e.mesh.position) < (e.scale / 2 + 1)) {
            hit = true;
            e.takeDamage(p.damage);
            break;
          }
        }
        if (this.boss && p.mesh.position.distanceTo(this.boss.mesh.position) < 10.0) {
          hit = true;
          this.boss.takeDamage(p.damage);
        }
      }

      if (hit || p.life <= 0) {
        // EXPLODE
        if (p.isRocket || p.isBFG) {
          const isBFG = p.isBFG;
          this.createExplosion(p.mesh.position, p.mesh.material.color, true, isBFG ? 3.0 : 1.5);
          // Splash
          const radius = isBFG ? 60.0 : 25.0; // Buffed radius
          const dmg = isBFG ? 500 : 80; // Buffed damage

          this.enemies.forEach(e => {
            if (e.mesh.position.distanceTo(p.mesh.position) < radius) {
              e.takeDamage(dmg);
            }
          });
          if (this.boss && this.boss.mesh.position.distanceTo(p.mesh.position) < radius) {
            this.boss.takeDamage(dmg);
          }
        }

        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
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
    if (this.explosionPool.length > 0) {
      ps = this.explosionPool.pop();
      ps.visible = true;
      // Safety check: ensure it's actually Points before using as one
      if (ps.isPoints) {
        ps.geometry.attributes.position.array.set(positions);
        ps.material.color.set(color);
        ps.material.opacity = 1.0;
        ps.material.size = isBig ? 1.5 : 0.3;
        ps.geometry.attributes.position.needsUpdate = true;
      } else {
        // If we somehow got a non-Points object, remove it and create a new one
        this.scene.remove(ps);
        const mat = new THREE.PointsMaterial({ color, size: isBig ? 1.5 : 0.3, transparent: true });
        ps = new THREE.Points(geo, mat);
        this.scene.add(ps);
      }
    } else {
      const mat = new THREE.PointsMaterial({ color, size: isBig ? 1.5 : 0.3, transparent: true });
      ps = new THREE.Points(geo, mat);
      this.scene.add(ps);
    }
    this.particles.push({ mesh: ps, velocities, life });
  }

  updateParticles(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Update Physics for Points only
      if (p.mesh.isPoints && p.velocities && p.velocities.length > 0) {
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

      // Visual fade if transparent
      if (p.mesh.material && p.mesh.material.transparent) {
        p.mesh.material.opacity = Math.max(0, p.life * 2); // Faster fade
      }

      if (p.life <= 0) {
        p.mesh.visible = false;
        if (p.mesh.isPoints && this.explosionPool.length < this.maxPoolSize) {
          this.explosionPool.push(p.mesh);
        } else {
          this.scene.remove(p.mesh);
          if (p.mesh.geometry) p.mesh.geometry.dispose();
          if (p.mesh.material) p.mesh.material.dispose();
        }
        this.particles.splice(i, 1);
      }
    }
  }

  createTracer(hitPoint, color, startPoint = null) {
    const target = hitPoint || this.camera.position.clone().add(new THREE.Vector3(0, 0, -100).applyQuaternion(this.camera.quaternion));
    let start;
    if (startPoint) {
      start = startPoint;
    } else {
      start = this.weaponMesh.position.clone().add(new THREE.Vector3(0, -0.1, -0.5));
      start.applyMatrix4(this.camera.matrixWorld);
    }

    const dist = start.distanceTo(target);
    const thickness = 0.2; // Even thicker
    const geo = new THREE.BoxGeometry(thickness, thickness, dist);
    // Solid MeshBasicMaterial for maximum visibility (Glow-like effect via color)
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1.0
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start).lerp(target, 0.5);
    mesh.lookAt(target);
    this.scene.add(mesh);
    this.particles.push({ mesh, velocities: [], life: 0.2, initialLife: 0.2 }); // Corrected life to 0.2s
  }

  // --- UI & STATE ---

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    const hud = document.getElementById('doom-hud');
    if (hud) {
      if (document.pointerLockElement) document.exitPointerLock();
      hud.innerHTML += `
               <div style="position: absolute; top: 0; left: 0; width:100%; height:100%; 
                            background:rgba(50,0,0,0.8); z-index:5000; pointer-events:auto;
                            display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <h1 style="font-size: 80px; color: red; text-shadow: 0 0 20px red; font-family:'Orbitron', sans-serif;">GAME OVER</h1>
                    <button id="doom-restart-btn" style="padding: 15px 40px; font-size: 30px; margin-top: 30px;
                                border: 2px solid red; background: #220000; color: white; cursor: pointer; font-family:'Orbitron', sans-serif;">
                        RESTART SYSTEM
                    </button>
                    <div style="margin-top:10px; color:#aaa;">(OR PRESS 'R')</div>
                </div>
            `;
      setTimeout(() => {
        const btn = document.getElementById('doom-restart-btn');
        if (btn) btn.onclick = () => this.resetGame();
      }, 100);
    }
    this.audio.playSound(100, 'sawtooth', 2.0, 1.0);
  }

  triggerWin() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    const hud = document.getElementById('doom-hud');
    if (hud) {
      if (document.pointerLockElement) document.exitPointerLock();
      hud.innerHTML += `
                <div style="position: absolute; top: 0; left: 0; width:100%; height:100%; 
                            background:rgba(0,50,0,0.8); z-index:5000; pointer-events:auto;
                            display:flex; flex-direction:column; justify-content:center; align-items:center;">
                    <h1 style="font-size: 80px; color: #00ff00; text-shadow: 0 0 20px lime; font-family:'Orbitron', sans-serif;">VICTORY</h1>
                    <div style="font-size:30px; color:white; margin-bottom:20px;">FINAL SCORE: ${this.score}</div>
                    <button id="doom-restart-btn" style="padding: 15px 40px; font-size: 30px; margin-top: 30px;
                                border: 2px solid #00ff00; background: #002200; color: white; cursor: pointer; font-family:'Orbitron', sans-serif;">
                        PLAY AGAIN
                    </button>
                    <div style="margin-top:10px; color:#aaa;">(OR PRESS 'R')</div>
                </div>
            `;
      setTimeout(() => {
        const btn = document.getElementById('doom-restart-btn');
        if (btn) btn.onclick = () => this.resetGame();
      }, 100);
    }
    this.audio.playSound(600, 'sine', 1.0, 0.8);
  }

  resetGame() {
    this.deactivate();
    this.activate(this.exhibitsSource, true);
    this.score = 0;
    this.wave = 1;
    this.playerHealth = 100;

    // Ammo reset is handled in activate() now (Full Ammo)

    this.isGameOver = false;
    this.startWave();
    this.startPickups();
    this.musicInterval = this.audio.playMusic(() => this.active && !this.isGameOver);

    // Lock
    document.body.requestPointerLock();
  }

  createHUD() {
    if (document.getElementById('doom-hud')) return;
    this.hud = document.createElement('div');
    this.hud.id = 'doom-hud';
    this.hud.style.cssText = "position:absolute; bottom:20px; left:20px; width:100vw; height:100vh; pointer-events:none; color:#ff0033; font-family:'Orbitron', sans-serif; font-size:24px; text-shadow:0 0 10px #ff0000; z-index:4000;";
    this.hud.innerHTML = `
            <div style="position:absolute; bottom:20px; left:20px; pointer-events:none;">
                <div style="font-size:32px; color:#00ff88; margin-bottom:10px;">HP: <span id="doom-hp">100</span></div>
                <div>SCORE: <span id="doom-score">0</span></div>
                <div>WAVE: <span id="doom-wave">1</span>/5</div>

                <div style="margin-top:15px; width:150px; height:10px; border:1px solid #00f3ff; position:relative;">
                    <div id="doom-stamina-bar" style="width:100%; height:100%; background:#00f3ff; transition:width 0.1s;"></div>
                    <div style="position:absolute; top:-18px; left:0; font-size:12px; color:#00f3ff;">STAMINA</div>
                </div>

                <div style="margin-top:15px; font-size:18px;">WEAPON: <span id="doom-weapon">BLASTER</span></div>
            </div>

            <!-- CROSSHAIR -->
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;">
                <div style="width: 20px; height: 2px; background: #00ff88; position: absolute; left: -10px; top: 0; box-shadow: 0 0 5px #00ff88;"></div>
                <div style="width: 2px; height: 20px; background: #00ff88; position: absolute; left: 0; top: -10px; box-shadow: 0 0 5px #00ff88;"></div>
                <div style="width: 4px; height: 4px; background: #00ff88; border-radius: 50%; position: absolute; left: -1px; top: -1px; box-shadow: 0 0 5px #00ff88;"></div>
            </div>
        `;
    document.body.appendChild(this.hud);
  }

  updateHUD() {
    if (!this.hud) return;
    const w = this.weapons[this.currentWeaponIdx];
    const hp = Math.ceil(this.playerHealth);

    const elHP = document.getElementById('doom-hp');
    if (elHP) { elHP.innerText = hp; elHP.style.color = hp < 30 ? '#ff0000' : '#00ff88'; }

    document.getElementById('doom-score').innerText = this.score;
    document.getElementById('doom-wave').innerText = this.wave + "/5";

    // Stamina HUD Update
    if (this.player) {
      const elStamina = document.getElementById('doom-stamina-bar');
      if (elStamina) {
        const pct = (this.player.stamina / this.player.maxStamina) * 100;
        elStamina.style.width = pct + '%';
        // Color transition
        if (pct < 30) elStamina.style.background = '#ff0033';
        else elStamina.style.background = '#00f3ff';
      }
    }

    const elWep = document.getElementById('doom-weapon');
    if (elWep) {
      elWep.innerText = `${w.name} [${w.ammo === -1 ? '∞' : w.ammo}]`;
      elWep.style.color = '#' + new THREE.Color(w.color).getHexString();
    }
  }

  showInstructions() {
    const existing = document.getElementById('doom-instructions');
    if (existing) existing.remove();

    // UNLOCK POINTER so user can click if they want
    if (document.pointerLockElement) document.exitPointerLock();

    const hud = document.getElementById('doom-hud');
    if (!hud) return;

    hud.innerHTML += `
            <div id="doom-instructions" style="position: absolute; top:0; left:0; width:100%; height:100%; 
                            background: rgba(0,0,0,0.95); display:flex; flex-direction:column; justify-content:center; align-items:center;
                            text-align: center; color: white; z-index: 5000; pointer-events: auto;">
                    <h1 style="font-size: 60px; color: #ff0033; text-shadow:0 0 20px red; font-family:'Orbitron', sans-serif;">PROTOCOL: FIREWALL</h1>
                    <p style="font-size: 18px; max-width: 800px; line-height: 1.4; font-family:'Orbitron', sans-serif; text-align: left;">
                        <span style="color:#ff0033; font-weight:bold; font-size:24px;">MISSION: TERMINATE THE GLITCH TITAN</span><br>
                        Survive 5 Waves. Defeat the Titan.<br><br>

                        <span style="color:#00ff88; font-weight:bold;">ARSENAL:</span><br>
                        [1] BLASTER (Inf) - [2] SHOTGUN - [3] LAUNCHER<br>
                        [4] PLASMA RIFLE - [5] BFG 9000 (Ultimate)<br><br>

                        <span style="color:#ff0033; font-weight:bold;">CONTROLS:</span> [MOUSE1] Fire | [1-5] Switch | [R] Restart | [ESC] Exit<br><br>

                        <center><span style="color:#ffffff; font-weight:bold; font-size:24px;">PRESS [ENTER] TO INITIATE</span></center>
                    </p>
                    <button id="doom-start-btn" style="margin-top:20px; padding: 15px 30px; font-size: 24px;
                                border: 2px solid #ff0033; background: #330000; color: #ff0033; cursor: pointer; font-family: 'Orbitron', sans-serif;">
                        INITIATE SEQUENCE
                    </button>
            </div>
         `;

    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      const el = document.getElementById('doom-instructions');
      if (el) el.remove();
      window.removeEventListener('keydown', keyH); // Cleanup
      this.resetGame();
    };

    const keyH = (e) => {
      if (e.key === 'Enter') start();
    };
    window.addEventListener('keydown', keyH);

    const btn = document.getElementById('doom-start-btn');
    if (btn) btn.onclick = start;
  }

  showWaveTitle(text) {
    if (!this.hud) return;
    const div = document.createElement('div');
    div.innerText = text;
    div.style.cssText = `position:absolute; top:30%; left:50%; transform:translate(-50%, -50%); 
                font-size:80px; color:#ff0033; font-weight:bold; text-shadow:0 0 20px red; opacity:0; transition:opacity 0.5s;`;
    this.hud.appendChild(div);
    setTimeout(() => div.style.opacity = 1, 100);
    setTimeout(() => { div.style.opacity = 0; setTimeout(() => div.remove(), 500); }, 3000);
  }

  handleKeys(e) {
    if (this.isGameOver && e.key.toLowerCase() === 'r') {
      this.resetGame();
      return;
    }
    if (e.key === 'Escape') {
      this.deactivate();
      return;
    }
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const idx = parseInt(e.key) - 1;
      if (this.weapons[idx]) {
        this.currentWeaponIdx = idx;
        this.updateHUD();
        this.updateWeaponVisuals();
      }
    }
  }

  handlePointerLockChange() {
    if (!document.pointerLockElement && this.active && !this.isGameOver) {
      // If user manually exited pointer lock (ESC), deactivate game
      this.deactivate();
    }
  }

  // Stub methods for missing pieces from original DoomManager (Visuals)
  createWeaponMesh() {
    if (this.weaponMesh) this.camera.remove(this.weaponMesh);
    this.weaponMesh = new THREE.Group();
    this.weaponMesh.position.set(0.3, -0.3, -0.6);
    this.camera.add(this.weaponMesh);

    // Muzzle
    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 5);
    this.muzzleLight.position.set(0, 0, -1.0);
    this.weaponMesh.add(this.muzzleLight);

    // 1. Blaster Mesh (Legacy: Box, Green, Wireframe)
    this.blasterMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.3, 0.8),
      new THREE.MeshBasicMaterial({ color: 0x33ff33, wireframe: true })
    );
    this.weaponMesh.add(this.blasterMesh);

    // 2. Shotgun Mesh (Legacy: Double Barrel, Orange, SOLID)
    this.shotgunMesh = new THREE.Group();
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelL.rotation.x = Math.PI / 2; barrelL.position.set(-0.1, 0, 0);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    barrelR.rotation.x = Math.PI / 2; barrelR.position.set(0.1, 0, 0);
    this.shotgunMesh.add(barrelL, barrelR);
    this.weaponMesh.add(this.shotgunMesh);

    // 3. Launcher Mesh (Legacy: Cylinder, Red, Wireframe)
    this.launcherMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.2, 1.0, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    );
    this.launcherMesh.rotation.x = Math.PI / 2;
    this.weaponMesh.add(this.launcherMesh);

    // 4. Plasma Rifle
    this.plasmaMesh = new THREE.Group();
    const pMain = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.8, 8), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pMain.rotation.x = Math.PI / 2;
    const pCoil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }));
    pCoil.position.z = -0.2;
    this.plasmaMesh.add(pMain, pCoil);
    this.weaponMesh.add(this.plasmaMesh);

    // 5. BFG 9000
    this.bfgMesh = new THREE.Group();
    const bCore = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    const bBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.2, 1.0, 8), new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true }));
    bBarrel.rotation.x = Math.PI / 2;
    this.bfgMesh.add(bCore, bBarrel);
    this.weaponMesh.add(this.bfgMesh);

    this.updateWeaponVisuals();
  }

  updateWeaponVisuals() {
    if (!this.weaponMesh) return;
    const w = this.weapons[this.currentWeaponIdx];

    // Toggle Visibility
    if (this.blasterMesh) this.blasterMesh.visible = (w.name === "BLASTER");
    if (this.shotgunMesh) this.shotgunMesh.visible = (w.name === "SHOTGUN");
    if (this.launcherMesh) this.launcherMesh.visible = (w.name === "LAUNCHER");
    if (this.plasmaMesh) this.plasmaMesh.visible = (w.name === "PLASMA");
    if (this.bfgMesh) this.bfgMesh.visible = (w.name === "BFG 9000");

    this.muzzleLight.color.setHex(w.color);



  }

  updateWeaponRecoil(delta) {
    if (this.weaponMesh && this.weaponRecoil > 0) {
      this.weaponMesh.position.z += this.weaponRecoil * delta * 5;
      this.weaponRecoil -= delta * 2;
      if (this.weaponRecoil < 0) this.weaponRecoil = 0;
      this.weaponMesh.position.z = Math.min(-0.6 + this.weaponRecoil, -0.4);
    }
  }

  startPickups() {
    if (this.pickupInterval) clearInterval(this.pickupInterval);
    this.pickupInterval = setInterval(() => {
      if (!this.active || this.isGameOver) return;
      this.spawnHealthPickup();
    }, 15000);
  }

  spawnHealthPickup() {
    const radius = 20 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    const x = this.camera.position.x + Math.cos(angle) * radius;
    const z = this.camera.position.z + Math.sin(angle) * radius;

    const mesh = this.buildPickupVisual('health', 0x00ff00);
    mesh.position.set(x, 2.0, z);
    this.scene.add(mesh);
    this.pickups.push({ mesh, type: 'health' });
  }

  initModelHealthBars() {
    this.crystals = [];

    // Use passed exhibits if available
    if (this.exhibitsSource && this.exhibitsSource.length > 0) {
      this.exhibitsSource.forEach(ex => {
        if (ex.mesh && ex.loaded) {
          const obj = ex.mesh;
          if (obj.userData.health === undefined) obj.userData.health = 100;

          // Remove old bar
          const oldBar = obj.getObjectByName('healthBar');
          if (oldBar) obj.remove(oldBar);

          // Create Sprite Bar
          const canvas = document.createElement('canvas');
          canvas.width = 64; canvas.height = 8;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#00ff00';
          ctx.fillRect(0, 0, 64, 8);

          const tex = new THREE.CanvasTexture(canvas);
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
          const sprite = new THREE.Sprite(mat);
          sprite.name = 'healthBar';
          sprite.scale.set(10, 1.25, 1);
          sprite.position.y = 8;
          obj.add(sprite);

          this.crystals.push({ mesh: obj, sprite: sprite, tex: tex, ctx: ctx });
        }
      });
    }

    // Also fallback to any Points if needed (Legacy Support)
    if (this.crystals.length === 0) {
      this.scene.traverse(obj => {
        if (obj.isPoints && obj.visible) {
          if (obj.userData.health === undefined) obj.userData.health = 100;
          // ... (Simplified: Reuse logic if needed, but assuming Exhibits is primary now)
          this.crystals.push({ mesh: obj, sprite: null, tex: null, ctx: null }); // Placeholder
        }
      });
    }
  }

  updateModelHealthBars() {
    if (!this.crystals) return;

    this.crystals.forEach(c => {
      const hp = c.mesh.userData.health;
      if (hp < 100) {
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
}
